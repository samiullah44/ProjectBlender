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
  // Offline node checker
  let offlineCheckInterval: NodeJS.Timeout | null = null;

  export const startOfflineNodeChecker = (): void => {
    if (offlineCheckInterval) {
      clearInterval(offlineCheckInterval);
    }

    offlineCheckInterval = setInterval(
      checkAndUpdateOfflineNodes,
      OFFLINE_CHECK_INTERVAL_MS
    );
    console.log('🔄 Offline node checker started');
  }

  export const stopOfflineNodeChecker = (): void => {
    if (offlineCheckInterval) {
      clearInterval(offlineCheckInterval);
      offlineCheckInterval = null;
    }
    console.log('🛑 Offline node checker stopped');
  }

  export const checkAndUpdateOfflineNodes = async (): Promise<void> => {
    try {
      const now = new Date();
      const cutoffTime = new Date(now.getTime() - HEARTBEAT_TIMEOUT_MS);

      const offlineNodes = await Node.find({
        status: { $in: ['online', 'busy'] },
        lastHeartbeat: { $lt: cutoffTime }
      });

      if (offlineNodes.length > 0) {
        const nodeIds = offlineNodes.map(node => node.nodeId);

        await Node.updateMany(
          { nodeId: { $in: nodeIds } },
          {
            status: 'offline',
            updatedAt: now,
            $set: {
              'lastStatusChange': now,
              'offlineReason': 'Heartbeat timeout'
            }
          }
        );

        console.log(`🔄 Marked ${offlineNodes.length} nodes as offline:`, nodeIds);

        // Broadcast offline status for marked nodes
        for (const node of offlineNodes) {
          if (wsService) {
            wsService.broadcastSystemUpdate({
              type: 'node_status_change',
              data: {
                nodeId: node.nodeId,
                status: 'offline',
                name: node.name
              }
            });
            wsService.broadcastNodeUpdate(node.nodeId, { status: 'offline' });
          }
        }

        // Reassign frames from offline nodes
        let anyFramesFreed = false;
        for (const node of offlineNodes) {
          if (node.currentJob) {
            await reassignFramesFromOfflineNode(node.nodeId, node.currentJob);
            anyFramesFreed = true;
          }
        }

        // ✅ GAP FIX: Immediately tell all free nodes to poll for the newly freed frames
        // Without this, nodes would wait up to 30 s before picking up reassigned frames.
        if (anyFramesFreed && wsService) {
          console.log('📢 Freed frames detected — notifying all free nodes to pick them up...');
          await wsService.notifyNodesToCheckJobs();
        }
      }
    } catch (error) {
      console.error('Error checking offline nodes:', error);
    }
  }

  export const reassignFramesFromOfflineNode = async (nodeId: string, jobId: string): Promise<void> => {
    try {
      const job = await Job.findOne({ jobId });
      if (!job) return;

      const node = await Node.findOne({ nodeId });
      if (node && node.activeBullJobIds && node.activeBullJobIds.length > 0) {
        await requeueFramesFromOfflineNode(node.activeBullJobIds, nodeId);
      }

      const assignedNodesMap = job.assignedNodes as unknown as Map<string, number[]>;
      const assignedFrames = assignedNodesMap?.get(nodeId) || [];

      if (assignedFrames.length > 0) {
        // FIX (Lost Node): Mark assignment records as 'failed' for history,
        // but put the frames back into 'pending' so they are retried automatically.
        for (const frame of assignedFrames) {
          const assignment = job.frameAssignments.find(
            (a: IFrameAssignment) => a.frame === frame && a.nodeId === nodeId && a.status === 'assigned'
          );

          if (assignment) {
            assignment.status = 'failed';
            assignment.completedAt = new Date();
            assignment.errorMessage = 'Node went offline mid-render';
          }

          // Remove from assigned frames
          const assignedIndex = job.frames.assigned.indexOf(frame);
          if (assignedIndex !== -1) {
            job.frames.assigned.splice(assignedIndex, 1);
          }

          // Put back into PENDING (not failed) so assignJob picks them up for retry
          if (!job.frames.rendered.includes(frame) && !job.frames.pending.includes(frame)) {
            job.frames.pending.push(frame);
          }
        }

        // Remove node from assigned nodes map and persist the change reliably
        assignedNodesMap?.delete(nodeId);
        job.markModified('assignedNodes');

        // Update status if needed
        // Update status if needed
        const totalFramesToRender = job.frames.selected && job.frames.selected.length > 0
          ? job.frames.selected.length
          : job.frames.total;
        const renderedFrames = job.frames.rendered.length;

        // ONLY mark as completed if all frames that were supposed to be rendered are actually rendered
        if (renderedFrames === totalFramesToRender) {
          job.status = 'completed';
          job.completedAt = new Date();
        } else {
          // Check if it's actually failed (all possible frames have been attempted and failed or rendered, but not all rendered)
          // For now, keep it in processing if there are still pending or failed frames that could be retried
          const pendingCount = job.frames.pending?.length || 0;
          const assignedCount = job.frames.assigned?.length || 0;

          if (pendingCount === 0 && assignedCount === 0 && renderedFrames < totalFramesToRender) {
            job.status = 'failed';
          }
        }

        job.progress = Math.round((renderedFrames / totalFramesToRender) * 100);
        job.updatedAt = new Date();

        await job.save();

        console.log(`🔄 Unassigned ${assignedFrames.length} frames from offline node ${nodeId} for job ${jobId}`);

        // Notify other nodes to pick up the reassigned frames
        if (wsService) {
          await wsService.notifyNodesToCheckJobs();
        }
      }

      // Clear current job from the offline node
      await Node.updateOne(
        { nodeId },
        {
          $unset: { currentJob: 1, currentProgress: 1 },
          $set: { activeBullJobIds: [] },
          updatedAt: new Date(),
          status: 'offline'
        }
      );
    } catch (error) {
      console.error('Error reassigning jobs from offline node:', error);
    }
  }