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

const HEARTBEAT_TIMEOUT_MS = 60000;
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

    // --- FIX: Prioritize reported job status to prevent "busy" race condition ---
    let shouldBeBusy = false;
    const reportedJobId = heartbeatData.currentJob;

    // If the node reports it has no job, it's not busy (trust the node's current state)
    if (reportedJobId === null || reportedJobId === undefined || reportedJobId === "") {
      shouldBeBusy = false;

      // If DB thinks there's a job, clear it now to be safe
      if (node.currentJob) {
        console.log(`🔄 Node ${nodeId} reported no job but DB had ${node.currentJob}, clearing`);
        node.currentJob = undefined;
        node.currentProgress = undefined;
      }
    } else {
      // Node reports it HAS a job, check if it truly has pending frames in the DB
      const jobIdToCheck = reportedJobId || node.currentJob;
      if (jobIdToCheck) {
        const job = await Job.findOne({ jobId: jobIdToCheck });
        if (job && (job.status === 'processing' || job.status === 'pending')) {
          // Robust check: are there any frames specifically assigned to this node that aren't done?
          const pendingAssignments = job.frameAssignments.filter(
            (a: IFrameAssignment) => a.nodeId === nodeId && a.status === 'assigned'
          );

          shouldBeBusy = pendingAssignments.length > 0;

          // If no pending frames for this specific job, clear the assignment
          if (!shouldBeBusy) {
            console.log(`🔄 Node ${nodeId} has no pending frames for ${jobIdToCheck}, clearing job`);
            node.currentJob = undefined;
            node.currentProgress = undefined;
          }
        } else {
          // Job is completed/failed/cancelled, node is not busy
          shouldBeBusy = false;
          node.currentJob = undefined;
          node.currentProgress = undefined;
          console.log(`🔄 Node ${nodeId}'s reported job ${jobIdToCheck} is ${job?.status || 'missing'}, clearing`);
        }
      }
    }

    const previousStatus = node.status;
    node.status = shouldBeBusy ? 'busy' : 'online';

    // Safety check: if no job but status is busy, fix it
    if (!node.currentJob && node.status === 'busy') {
      console.log(`🛠️ Safety: Resetting node ${nodeId} status to online (no job found)`);
      node.status = 'online';
    }
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

    // Sync current job and progress from heartbeat
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

      wsService.broadcastNodeUpdate(nodeId, broadcastData);

      wsService.broadcastSystemUpdate({
        type: 'node_heartbeat',
        data: {
          nodeId,
          status: node.status,
          timestamp: now.toISOString()
        }
      });
    }

    // STOP_JOB command if job cancelled/completed/failed
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
};
