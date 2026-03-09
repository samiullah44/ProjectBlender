import { Request, Response } from 'express';
import { Node } from '../../models/Node';
import { Job } from '../../models/Job';
import { User } from '../../models/User';
import { Notification } from '../../models/Notification';
import { HardwareValidationService } from '../../services/HardwareValidationService';
import { IFrameAssignment } from '../../types/job.types';
import { AppError } from '../../middleware/error';
import { S3Service } from '../../services/S3Service';
import { AuthRequest } from '../../middleware/auth';
import os from 'os';
import { wsService } from '../../app';
import { dequeueFramesForNode, nackFrame, requeueFramesFromOfflineNode, ackFrame, getQueueName } from '../../services/FrameQueueService';

const s3Service = new S3Service();

const HEARTBEAT_TIMEOUT_MS = 35000;
const OFFLINE_CHECK_INTERVAL_MS = 30000;
const MAX_NODES_PER_JOB = 10;
const MIN_FRAMES_PER_NODE = 1;
const MAX_FRAMES_PER_NODE = 20;
const ASSIGNMENT_COOLDOWN_MS = 10000;
const DEFAULT_CREDITS_PER_FRAME = 1;

import { getWsService } from './shared';
  // Heartbeat endpoint with performance tracking and WebSocket updates
  export const heartbeat = async (req: Request, res: Response): Promise<void> => {
    try {
      const { nodeId } = req.params;
      if (!nodeId || Array.isArray(nodeId)) {
        throw new AppError('Invalid node ID', 400);
      }

      const heartbeatData = req.body;
      const now = new Date();

      const node = await Node.findOne({ nodeId });

      if (!node) {
        throw new AppError('Node not found', 404);
      }

      // Check if node actually has a current job
      let shouldBeBusy = false;
      if (node.currentJob) {
        const job = await Job.findOne({ jobId: node.currentJob });
        if (job && (job.status === 'processing' || job.status === 'pending')) {
          const assignedNodesMap = job.assignedNodes as unknown as Map<string, number[]>;
          const assignedFrames = assignedNodesMap?.get(nodeId) || [];

          // Check if node still has pending frames (considering selected frames)
          const pendingFrames = assignedFrames.filter(frame => {
            // Only check frames that are in the selected frames list
            const isSelected = !job.frames.selected || job.frames.selected.length === 0 ||
              job.frames.selected.includes(frame);
            return isSelected &&
              !job.frames.rendered.includes(frame) &&
              !job.frames.failed.includes(frame);
          });

          shouldBeBusy = pendingFrames.length > 0;

          // If no pending frames, clear the job
          if (!shouldBeBusy) {
            node.currentJob = undefined;
            node.currentProgress = undefined;
            console.log(`🔄 Node ${nodeId} has no pending frames, clearing job assignment`);
          }
        } else {
          // Job is completed/failed, clear it
          node.currentJob = undefined;
          node.currentProgress = undefined;
          console.log(`🔄 Node ${nodeId}'s job is ${job?.status}, clearing assignment`);
        }
      }

      const previousStatus = node.status;
      node.status = shouldBeBusy ? 'busy' : 'online';
      node.lastHeartbeat = now;
      node.updatedAt = now;

      if (previousStatus !== node.status) {
        node.lastStatusChange = now;
        console.log(`🔄 Node ${nodeId} status changed from ${previousStatus} to ${node.status}`);
      }

      if (heartbeatData.resources) {
        node.set('lastResources', {
          ...heartbeatData.resources,
          timestamp: now
        });

        if (!node.resourceHistory) {
          node.resourceHistory = [];
        }
        node.resourceHistory.push({
          ...heartbeatData.resources,
          timestamp: now
        });

        if (node.resourceHistory.length > 20) {
          node.resourceHistory = node.resourceHistory.slice(-20);
        }
      }

      if ('currentJob' in heartbeatData && heartbeatData.progress !== undefined) {
        node.currentJob = heartbeatData.currentJob || undefined;
        node.set('currentProgress', heartbeatData.progress);
      }

      // Update performance metrics if provided
      if (heartbeatData.performance && node.performance) {
        node.performance = {
          ...JSON.parse(JSON.stringify(node.performance)),
          ...heartbeatData.performance,
          lastUpdated: now
        };
      }

      if (heartbeatData.lastFrameTime && node.performance) {
        const framesRendered = (node.performance.framesRendered || 0) + 1;
        const totalTime = (node.performance.totalRenderTime || 0) + heartbeatData.lastFrameTime;

        node.performance.framesRendered = framesRendered;
        node.performance.totalRenderTime = totalTime;
        node.performance.avgFrameTime = totalTime / framesRendered;
        node.performance.lastUpdated = now;

        // Update reliability score
        if (heartbeatData.frameSuccess === true) {
          node.performance.reliabilityScore = Math.min(100, (node.performance.reliabilityScore || 100) + 1);
        } else if (heartbeatData.frameSuccess === false) {
          node.performance.reliabilityScore = Math.max(10, (node.performance.reliabilityScore || 100) - 5);
        }
      }

      // Update storage info if provided
      if (heartbeatData.storageFreeGB !== undefined) {
        const storageFreeGB = Number(heartbeatData.storageFreeGB);
        node.set('hardware.storageFreeGB', storageFreeGB);

        // Check for threshold drop mid-session
        const diskCheck = HardwareValidationService.checkFreeDisk(storageFreeGB);
        if (!diskCheck.allowed) {
          // AUTO-REVOCATION
          node.status = 'offline';
          node.isRevoked = true;
          node.revokedAt = now;
          node.revokedReason = diskCheck.message;

          await node.save();

          console.log(`🚫 Node ${nodeId} has been AUTO-REVOKED due to low storage: ${storageFreeGB.toFixed(1)}GB`);

          // Notify user
          try {
            const { notificationService } = await import('../../services/NotificationService');
            await notificationService.createNotification(
              node.userId as any,
              'system',
              'Node Revoked',
              `Node "${node.name || node.nodeId}" has been revoked: ${diskCheck.message}`
            );
          } catch (e) {
            console.error('Failed to send mid-session revocation notification:', e);
          }

          // Broadcast node revocation via WebSocket
          const wsService = getWsService(req);
          if (wsService) {
            // Broadcast system update for dashboard
            wsService.broadcastSystemUpdate({
              type: 'node_revoked',
              data: {
                nodeId,
                name: node.name,
                reason: diskCheck.message
              }
            });
          }

          res.status(403).json({
            error: 'NODE_REVOKED',
            message: diskCheck.message
          });
          return;
        }

        if (diskCheck.warn) {
          // Create a throttled notification (once per hour per node)
          try {
            const oneHourAgo = new Date(Date.now() - 3600000);
            const existingWarn = await Notification.findOne({
              userId: node.userId,
              type: 'system',
              title: 'Low Disk Space Warning',
              createdAt: { $gte: oneHourAgo }
            });

            if (!existingWarn) {
              const { notificationService } = await import('../../services/NotificationService');
              await notificationService.createNotification(
                node.userId as any,
                'system',
                'Low Disk Space Warning',
                diskCheck.message
              );
            }
          } catch (e) {
            console.error('Failed to send mid-session disk warning:', e);
          }
        }
      }

      await node.save();

      console.log(`💓 Heartbeat from ${nodeId}: ${node.status} (${now.toISOString()})`);

      // Broadcast node heartbeat via WebSocket
      const wsService = getWsService(req);
      if (wsService) {
        const broadcastData = {
          status: node.status,
          lastHeartbeat: node.lastHeartbeat,
          currentJob: node.currentJob,
          currentProgress: node.currentProgress,
          resources: heartbeatData.resources,
          performance: node.performance
        };

        // Broadcast to node-specific subscribers
        wsService.broadcastNodeUpdate(nodeId, broadcastData);

        // Broadcast system update for dashboard
        wsService.broadcastSystemUpdate({
          type: 'node_heartbeat',
          data: {
            nodeId,
            status: node.status,
            timestamp: now.toISOString()
          }
        });
      }

      // FIX (Ghost Rendering): tell the node to stop immediately if its current
      // job was cancelled, completed, or failed while the node was mid-render.
      // The node client checks for this command field and aborts gracefully.
      let command: string | undefined;
      if (heartbeatData.currentJob) {
        const activeJob = await Job.findOne({ jobId: heartbeatData.currentJob })
          .select('status')
          .lean();
        if (activeJob && ['cancelled', 'completed', 'failed'].includes(activeJob.status)) {
          command = 'STOP_JOB';
          console.log(`🛑 Sending STOP_JOB to node ${nodeId} — job ${heartbeatData.currentJob} is ${activeJob.status}`);
        }
      }

      res.json({
        success: true,
        message: 'Heartbeat received',
        timestamp: now.toISOString(),
        nextHeartbeatIn: 30000,
        ...(command ? { command } : {})
      });

    } catch (error) {
      console.error('❌ Heartbeat error:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({
          error: error.message
        });
      } else {
        res.status(500).json({
          error: 'Failed to process heartbeat',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }