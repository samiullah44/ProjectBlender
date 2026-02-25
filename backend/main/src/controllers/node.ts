import { Request, Response } from 'express';
import { Node } from '../models/Node';
import { Job } from '../models/Job';
import { IFrameAssignment } from '../types/job.types';
import { AppError } from '../middleware/error';
import { S3Service } from '../services/S3Service';
import { AuthRequest } from '../middleware/auth';
import os from 'os';
import { wsService } from '../app';

const s3Service = new S3Service();

const HEARTBEAT_TIMEOUT_MS = 35000;
const OFFLINE_CHECK_INTERVAL_MS = 30000;
const MAX_NODES_PER_JOB = 10;
const MIN_FRAMES_PER_NODE = 1;
const MAX_FRAMES_PER_NODE = 20;
const ASSIGNMENT_COOLDOWN_MS = 10000;
const DEFAULT_CREDITS_PER_FRAME = 1;

// Performance tracking interface
interface NodePerformance {
  nodeId: string;
  hardwareScore: number;
  reliabilityScore: number;
  avgFrameTime: number;
  lastHeartbeatAge: number;
  framesRendered: number;
  currentLoad: number; // 0-1, how busy the node is
}

export class NodeController {
  // Get WebSocket service from app
  private static getWsService(req: Request) {
    return req.app.get('wsService');
  }

  // Offline node checker
  private static offlineCheckInterval: NodeJS.Timeout | null = null;

  static startOfflineNodeChecker(): void {
    if (this.offlineCheckInterval) {
      clearInterval(this.offlineCheckInterval);
    }

    this.offlineCheckInterval = setInterval(
      this.checkAndUpdateOfflineNodes.bind(this),
      OFFLINE_CHECK_INTERVAL_MS
    );
    console.log('🔄 Offline node checker started');
  }

  static stopOfflineNodeChecker(): void {
    if (this.offlineCheckInterval) {
      clearInterval(this.offlineCheckInterval);
      this.offlineCheckInterval = null;
    }
    console.log('🛑 Offline node checker stopped');
  }

  private static async checkAndUpdateOfflineNodes(): Promise<void> {
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
        for (const node of offlineNodes) {
          if (node.currentJob) {
            await this.reassignFramesFromOfflineNode(node.nodeId, node.currentJob);
          }
        }
      }
    } catch (error) {
      console.error('Error checking offline nodes:', error);
    }
  }

  private static async reassignFramesFromOfflineNode(nodeId: string, jobId: string): Promise<void> {
    try {
      const job = await Job.findOne({ jobId });
      if (!job) return;

      const assignedNodesMap = job.assignedNodes as unknown as Map<string, number[]>;
      const assignedFrames = assignedNodesMap?.get(nodeId) || [];

      if (assignedFrames.length > 0) {
        // Update frame assignments status to failed
        for (const frame of assignedFrames) {
          const assignment = job.frameAssignments.find(
            (a: IFrameAssignment) => a.frame === frame && a.nodeId === nodeId && a.status === 'assigned'
          );

          if (assignment) {
            assignment.status = 'failed';
            assignment.completedAt = new Date();
          }

          // Remove from assigned frames
          const assignedIndex = job.frames.assigned.indexOf(frame);
          if (assignedIndex !== -1) {
            job.frames.assigned.splice(assignedIndex, 1);
          }

          // Add to failed frames if not already there
          if (!job.frames.failed.includes(frame)) {
            job.frames.failed.push(frame);
          }
        }

        // Remove node from assigned nodes
        assignedNodesMap?.delete(nodeId);

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
      }

      // Clear current job from the offline node
      await Node.updateOne(
        { nodeId },
        {
          $unset: { currentJob: 1, currentProgress: 1 },
          updatedAt: new Date(),
          status: 'offline'
        }
      );
    } catch (error) {
      console.error('Error reassigning jobs from offline node:', error);
    }
  }

  // Node registration with performance initialization
  static async registerNode(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.userId;
      const nodeInfo = req.body;
      const nodeId = nodeInfo.nodeId || `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();
      const incomingFingerprint: string | undefined = nodeInfo.hardware?.hardwareFingerprint
        || nodeInfo.hardwareFingerprint;

      // ── Security: Block duplicate hardware registrations ──────────────────
      if (incomingFingerprint) {
        const hwMatch = await Node.findOne({ hardwareFingerprint: incomingFingerprint });
        if (hwMatch && hwMatch.nodeId !== nodeId) {
          // Same hardware, but a DIFFERENT nodeId → duplicate device
          if (hwMatch.status !== 'offline') {
            // Active duplicate → reject
            console.warn(`🚫 Duplicate hardware fingerprint from ${nodeId} — already registered as ${hwMatch.nodeId}`);
            res.status(409).json({
              error: 'HARDWARE_ALREADY_REGISTERED',
              message: 'This hardware is already registered under a different node. Only one node per physical machine is allowed.',
              existingNodeId: hwMatch.nodeId
            });
            return;
          } else {
            // The previous node with this hardware is offline → reuse its record
            console.log(`🔄 Reclaiming offline node ${hwMatch.nodeId} for hardware fingerprint re-registration as ${nodeId}`);
            hwMatch.nodeId = nodeId;
            hwMatch.status = 'online';
            hwMatch.lastHeartbeat = now;
            hwMatch.updatedAt = now;
            hwMatch.connectionCount = (hwMatch.connectionCount || 0) + 1;
            if (userId) hwMatch.userId = userId as any;
            if (nodeInfo.hardware) hwMatch.hardware = { ...hwMatch.hardware, ...nodeInfo.hardware };
            (hwMatch as any).hardwareFingerprint = incomingFingerprint;
            (hwMatch as any).publicIp = nodeInfo.publicIp || hwMatch.ipAddress;
            (hwMatch as any).hostname = nodeInfo.hostname || os.hostname();
            if (nodeInfo.name) hwMatch.name = nodeInfo.name;
            await hwMatch.save();
            console.log(`🔒 Node hardware reclaimed: ${nodeInfo.name || nodeId} (fp: ${incomingFingerprint.substring(0, 8)}...)`);
            res.json({ success: true, message: 'Node re-registered (hardware reclaimed)', nodeId, heartbeatInterval: 30000 });
            return;
          }
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      const existingNode = await Node.findOne({ nodeId });

      if (existingNode) {
        // Update existing node
        existingNode.status = existingNode.currentJob ? 'busy' : 'online';
        existingNode.lastHeartbeat = now;
        existingNode.updatedAt = now;
        existingNode.connectionCount = (existingNode.connectionCount || 0) + 1;
        existingNode.lastStatusChange = existingNode.status !== 'online' && existingNode.status !== 'busy' ? now : existingNode.lastStatusChange;

        // Link node to user if not already linked (for backward compatibility)
        if (!existingNode.userId && userId) {
          existingNode.userId = userId as any;
        }

        if (nodeInfo.hardware) {
          existingNode.hardware = {
            ...existingNode.hardware,
            ...nodeInfo.hardware
          };
        }
        if (nodeInfo.capabilities) {
          existingNode.capabilities = {
            ...existingNode.capabilities,
            ...nodeInfo.capabilities
          };
        }
        if (nodeInfo.performance) {
          existingNode.performance = {
            ...(existingNode.performance || {}),
            ...nodeInfo.performance
          };
        }

        // Persist fingerprint / IP fields
        if (incomingFingerprint) existingNode.hardwareFingerprint = incomingFingerprint;
        if (nodeInfo.publicIp) existingNode.publicIp = nodeInfo.publicIp;
        if (nodeInfo.hostname) existingNode.hostname = nodeInfo.hostname;
        if (nodeInfo.hardwareVerifiedAt) existingNode.hardwareVerifiedAt = nodeInfo.hardwareVerifiedAt;
        if (nodeInfo.name) existingNode.name = nodeInfo.name;

        // Initialize performance tracking if not exists
        if (!existingNode.performance) {
          existingNode.performance = {
            framesRendered: 0,
            totalRenderTime: 0,
            avgFrameTime: 0,
            reliabilityScore: 100,
            lastUpdated: now
          };
        }

        await existingNode.save();

        console.log(`🔄 Node reconnected: ${existingNode.name || nodeId} (${existingNode.status})`);

        // Broadcast node registration via WebSocket (include all hardware data)
        const wsService = NodeController.getWsService(req);
        if (wsService) {
          wsService.broadcastNodeUpdate(nodeId, {
            status: existingNode.status,
            hardware: existingNode.hardware,
            performance: existingNode.performance,
            lastHeartbeat: existingNode.lastHeartbeat,
            registeredAt: now.toISOString()
          });
        }

        res.json({
          success: true,
          message: 'Node updated successfully',
          nodeId,
          heartbeatInterval: 30000
        });
      } else {
        // Create new node with performance tracking
        const node = new Node({
          nodeId,
          userId,
          name: nodeInfo.name || `Node-${nodeId.substring(0, 8)}`,
          status: 'online',
          os: nodeInfo.os || 'Unknown',
          hardware: {
            cpuCores: 1,
            cpuScore: 0,
            gpuName: 'Unknown',
            gpuVRAM: 0,
            gpuScore: 0,
            ramGB: 0,
            blenderVersion: 'unknown',
            ...nodeInfo.hardware
          },
          capabilities: {
            supportedEngines: ['CYCLES', 'EEVEE'],
            supportedGPUs: ['CUDA', 'OPTIX'],
            maxSamples: 1024,
            maxResolutionX: 3840,
            maxResolutionY: 2160,
            supportsTiles: true,
            ...nodeInfo.capabilities
          },
          performance: {
            tier: 'Unknown',
            effectiveScore: 0,
            gpuScore: 0,
            cpuScore: 0,
            framesRendered: 0,
            totalRenderTime: 0,
            avgFrameTime: 0,
            reliabilityScore: 100,
            lastUpdated: now,
            ...nodeInfo.performance
          },
          ipAddress: nodeInfo.ipAddress || '127.0.0.1',
          hardwareFingerprint: incomingFingerprint,
          publicIp: nodeInfo.publicIp,
          hostname: nodeInfo.hostname,
          hardwareVerifiedAt: nodeInfo.hardwareVerifiedAt || now,
          lastHeartbeat: now,
          lastStatusChange: now,
          connectionCount: 1,
          jobsCompleted: 0,
          createdAt: now,
          updatedAt: now
        });

        await node.save();

        console.log('✅ Node registered:', nodeId, incomingFingerprint ? `(fp: ${incomingFingerprint.substring(0, 12)}…)` : '');

        // Broadcast new node registration via WebSocket
        const wsService = NodeController.getWsService(req);
        if (wsService) {
          wsService.broadcastSystemUpdate({
            type: 'node_registered',
            data: {
              nodeId,
              name: node.name,
              status: node.status,
              hardware: node.hardware,
              registeredAt: now.toISOString()
            }
          });
        }

        res.json({
          success: true,
          message: 'Node registered successfully',
          nodeId,
          heartbeatInterval: 30000
        });
      }

    } catch (error) {
      console.error('❌ Node registration error:', error);
      res.status(500).json({
        error: 'Failed to register node',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Heartbeat endpoint with performance tracking and WebSocket updates
  static async heartbeat(req: Request, res: Response): Promise<void> {
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

      // Update legacy metrics if frame render time is provided
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

      await node.save();

      console.log(`💓 Heartbeat from ${nodeId}: ${node.status} (${now.toISOString()})`);

      // Broadcast node heartbeat via WebSocket
      const wsService = NodeController.getWsService(req);
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

      res.json({
        success: true,
        message: 'Heartbeat received',
        timestamp: now.toISOString(),
        nextHeartbeatIn: 30000
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

  // IMPROVED: Job assignment with smart load balancing and frame tracking
  static async assignJob(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;
      if (!nodeId || Array.isArray(nodeId)) {
        throw new AppError('Invalid node ID', 400);
      }

      const now = new Date();

      // Check node exists and is online
      const node = await Node.findOne({ nodeId });
      if (!node) {
        throw new AppError('Node not found', 404);
      }

      // Verify node is actually online
      const lastHeartbeatAge = now.getTime() - new Date(node.lastHeartbeat).getTime();
      if (lastHeartbeatAge > HEARTBEAT_TIMEOUT_MS) {
        node.status = 'offline';
        node.updatedAt = now;
        node.lastStatusChange = node.status !== 'offline' ? now : node.lastStatusChange;
        await node.save();

        // Broadcast node offline status
        const wsService = NodeController.getWsService(req);
        if (wsService) {
          wsService.broadcastNodeUpdate(nodeId, {
            status: 'offline',
            lastHeartbeat: node.lastHeartbeat,
            offlineReason: 'Heartbeat timeout'
          });
        }

        throw new AppError(
          `Node is offline (no recent heartbeat). Last heartbeat was ${Math.floor(lastHeartbeatAge / 1000)} seconds ago`,
          400
        );
      }

      // Check if node already has a job and frames
      if (node.currentJob) {
        const job = await Job.findOne({ jobId: node.currentJob });
        if (job && (job.status === 'processing' || job.status === 'pending')) {
          const assignedNodesMap = job.assignedNodes as unknown as Map<string, number[]>;
          const assignedFrames = assignedNodesMap?.get(nodeId) || [];

          // Check which frames are still pending and not yet completed
          const pendingAssignedFrames: number[] = [];
          for (const frame of assignedFrames) {
            const assignment = job.frameAssignments.find(
              (a: IFrameAssignment) => a.frame === frame && a.nodeId === nodeId
            );

            if (!assignment || assignment.status === 'assigned') {
              // Only include frames that are selected (if selection exists)
              if (!job.frames.selected || job.frames.selected.length === 0 ||
                job.frames.selected.includes(frame)) {
                pendingAssignedFrames.push(frame);
              }
            }
          }

          if (pendingAssignedFrames.length > 0) {
            // Generate fresh S3 URLs for blend file
            const blendFileUrl = await s3Service.generateBlendFileDownloadUrl(job.blendFileKey);

            // Generate upload URLs for pending frames
            const frameUploadUrls: Record<number, { uploadUrl: string, s3Key: string }> = {};
            for (const frame of pendingAssignedFrames) {
              const { uploadUrl, s3Key } = await s3Service.generateFrameUploadUrl(job.jobId, frame);
              frameUploadUrls[frame] = { uploadUrl, s3Key };
            }

            res.json({
              jobId: job.jobId,
              frames: pendingAssignedFrames,
              blendFileUrl,
              frameUploadUrls,
              settings: job.settings,
              totalFrames: job.frames.total,
              selectedFrames: job.frames.selected || [], // NEW: Include selected frames
              assignedFramesCount: pendingAssignedFrames.length,
              isResume: true,
              fileStructure: {
                blendFile: job.blendFileKey,
                uploadsFolder: `uploads/${job.jobId}/`,
                rendersFolder: `renders/${job.jobId}/`
              }
            });
            return;
          } else {
            // All assigned frames are done, clear current job
            node.currentJob = undefined;
            node.currentProgress = undefined;
            await node.save();
          }
        }
      }

      // Ensure node status is correct
      if (node.status !== 'online' && node.status !== 'busy') {
        node.status = 'online';
        node.updatedAt = now;
        await node.save();
      }

      // Find available jobs
      const jobs = await Job.find({
        $or: [
          { status: 'pending' },
          {
            status: 'processing',
            $expr: { $lt: [{ $size: '$frames.rendered' }, '$frames.total'] }
          }
        ]
      }).sort({ createdAt: 1 });

      if (jobs.length === 0) {
        res.json({ jobId: null });
        return;
      }

      // Get all online nodes for load balancing
      const cutoffTime = new Date(now.getTime() - HEARTBEAT_TIMEOUT_MS);
      const onlineNodes = await Node.find({
        lastHeartbeat: { $gte: cutoffTime },
        status: { $in: ['online', 'busy'] }
      });

      // Calculate node performance scores
      const nodePerformances = onlineNodes.map(n => NodeController.calculateNodePerformance(n, now));

      for (const job of jobs) {
        // Skip if job is already completed or failed
        if (job.status === 'completed' || job.status === 'failed') {
          continue;
        }

        const settings = job.settings;
        const capabilities = node.capabilities;

        // Compatibility checks
        const engineSupported = capabilities.supportedEngines.includes(settings.engine);
        const deviceSupported = settings.device === 'CPU' ||
          (settings.device === 'GPU' && capabilities.supportedGPUs.length > 0);
        const resolutionSupported = settings.resolutionX <= capabilities.maxResolutionX &&
          settings.resolutionY <= capabilities.maxResolutionY;
        const samplesSupported = settings.samples <= capabilities.maxSamples;

        if (!engineSupported || !deviceSupported || !resolutionSupported || !samplesSupported) {
          continue;
        }

        // Get frames that need to be rendered (considering selected frames)
        // IMPORTANT: Include failed frames so they can be retried (node may have disconnected)
        const pendingFrames: number[] = [];
        const failedFrames: number[] = [];  // track which ones were previously failed
        const framesToCheck = job.frames.selected && job.frames.selected.length > 0
          ? job.frames.selected
          : Array.from({ length: job.frames.end - job.frames.start + 1 },
            (_, i) => job.frames.start + i);

        for (const frame of framesToCheck) {
          if (!job.frames.rendered.includes(frame) &&
            !job.frames.assigned.includes(frame)) {
            pendingFrames.push(frame);
            if (job.frames.failed.includes(frame)) {
              failedFrames.push(frame); // mark so we can remove from failed on assignment
            }
          }
        }

        if (pendingFrames.length === 0) {
          // Check if all frames are rendered
          const totalFramesToRender = job.frames.selected && job.frames.selected.length > 0
            ? job.frames.selected.length
            : job.frames.total;

          if (job.frames.rendered.length === totalFramesToRender) {
            job.status = 'completed';
            job.completedAt = now;
            job.progress = 100;
            await job.save();
            console.log(`✅ Job ${job.jobId} completed automatically (all frames rendered)`);

            // Broadcast job completion
            const wsService = NodeController.getWsService(req);
            if (wsService) {
              await wsService.broadcastJobUpdate(job.jobId);
            }
          }
          continue;
        }

        // Get current node's performance
        const currentNodePerf = nodePerformances.find(p => p.nodeId === nodeId);
        if (!currentNodePerf) {
          continue;
        }

        // Calculate how many frames this node should get based on performance
        const framesToAssign = NodeController.calculateOptimalFrameAssignment(
          currentNodePerf,
          nodePerformances,
          pendingFrames.length,
          job
        );

        if (framesToAssign === 0) {
          continue;
        }

        // Select frames strategically (not just from beginning)
        const assignedFrames = NodeController.selectFramesForNode(pendingFrames, framesToAssign, job);

        // Generate S3 upload URLs for each frame
        const frameUploadUrls: Record<number, { uploadUrl: string, s3Key: string }> = {};
        for (const frame of assignedFrames) {
          const { uploadUrl, s3Key } = await s3Service.generateFrameUploadUrl(job.jobId, frame);
          frameUploadUrls[frame] = { uploadUrl, s3Key };
        }

        // Use atomic operations to prevent duplicates
        // Also pull retried frames out of frames.failed so they can be tracked properly again
        const updateOp: any = {
          $set: {
            status: 'processing',
            updatedAt: now,
            [`assignedNodes.${nodeId}`]: assignedFrames
          },
          $addToSet: {
            'frames.assigned': { $each: assignedFrames }
          },
          $push: {
            frameAssignments: {
              $each: assignedFrames.map(frame => ({
                frame,
                nodeId,
                status: 'assigned',
                assignedAt: now,
                creditsEarned: job.settings.creditsPerFrame || DEFAULT_CREDITS_PER_FRAME
              }))
            }
          }
        };

        // Remove any of the newly-assigned frames from the failed list (retry)
        const reassignedFailedFrames = assignedFrames.filter(f => failedFrames.includes(f));
        if (reassignedFailedFrames.length > 0) {
          updateOp.$pull = { 'frames.failed': { $in: reassignedFailedFrames } };
          console.log(`🔄 Retrying ${reassignedFailedFrames.length} previously-failed frame(s): [${reassignedFailedFrames.join(', ')}]`);
        }

        const result = await Job.findOneAndUpdate(
          {
            jobId: job.jobId,
            'frames.assigned': { $nin: assignedFrames }
          },
          updateOp,
          {
            new: true,
            timestamps: false
          }
        );

        if (!result) {
          continue;
        }

        // Generate fresh blend file URL
        const blendFileUrl = await s3Service.generateBlendFileDownloadUrl(result.blendFileKey);

        // Update node status
        await Node.updateOne(
          { nodeId },
          {
            $set: {
              currentJob: result.jobId,
              status: 'busy',
              updatedAt: now
            }
          }
        );

        // Calculate job progress
        const totalFrames = result.frames.total;
        const renderedFrames = result.frames.rendered.length;
        const progress = Math.round((renderedFrames / totalFrames) * 100);

        console.log(`📋 Smart assigned ${assignedFrames.length} frames to node ${nodeId} for job ${result.jobId}`);
        console.log(`📊 Job ${result.jobId} progress: ${progress}% (${renderedFrames}/${totalFrames} frames)`);
        console.log(`⚡ Node performance: ${currentNodePerf.hardwareScore.toFixed(2)} hardware, ${currentNodePerf.reliabilityScore.toFixed(2)} reliability, ${currentNodePerf.avgFrameTime.toFixed(2)}s avg frame time`);

        // Broadcast job assignment via WebSocket
        const wsService = NodeController.getWsService(req);
        if (wsService) {
          // Push job directly to the node if it is connected via WebSocket
          const wsDelivered = wsService.sendToNode(nodeId, {
            type: 'job_assigned',
            jobId: result.jobId,
            frames: assignedFrames,
            blendFileUrl,
            frameUploadUrls,
            settings: result.settings,
            totalFrames: result.frames.total,
            selectedFrames: result.frames.selected || [],
            assignedFramesCount: assignedFrames.length,
            jobProgress: progress
          });
          if (wsDelivered) {
            console.log(`📡 Job pushed to node ${nodeId} via WebSocket`);
          }

          // Broadcast job update to dashboard
          await wsService.broadcastJobUpdate(result.jobId);

          // Broadcast node update
          wsService.broadcastNodeUpdate(nodeId, {
            status: 'busy',
            currentJob: result.jobId,
            assignedFrames: assignedFrames.length,
            lastAssignment: now.toISOString()
          });
        }

        res.json({
          jobId: result.jobId,
          frames: assignedFrames,
          blendFileUrl,
          frameUploadUrls,
          settings: result.settings,
          totalFrames: result.frames.total,
          selectedFrames: result.frames.selected || [], // NEW: Include selected frames
          assignedFramesCount: assignedFrames.length,
          jobProgress: progress,
          nextHeartbeatExpectedIn: 30000,
          fileStructure: {
            blendFile: result.blendFileKey,
            uploadsFolder: `uploads/${result.jobId}/`,
            rendersFolder: `renders/${job.jobId}/`
          }
        });

        return;
      }

      // No frames available for assignment
      res.json({ jobId: null });

    } catch (error) {
      console.error('❌ Job assignment error:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({
          error: error.message
        });
      } else {
        res.status(500).json({
          error: 'Failed to assign job',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // Calculate node performance metrics
  private static calculateNodePerformance(node: any, now: Date): NodePerformance {
    const lastHeartbeatAge = now.getTime() - new Date(node.lastHeartbeat).getTime();

    // Calculate hardware score
    let hardwareScore = 0;
    hardwareScore += node.hardware.cpuCores * 100;
    hardwareScore += node.hardware.gpuScore || 0;
    hardwareScore += node.hardware.ramGB * 50;

    // Normalize hardware score
    hardwareScore = hardwareScore / 1000;

    // Get performance data
    const perf = node.performance || {};
    const avgFrameTime = perf.avgFrameTime || 60; // Default 60 seconds if unknown
    const reliabilityScore = perf.reliabilityScore || 1.0;
    const framesRendered = perf.framesRendered || 0;

    // Calculate current load (0 = idle, 1 = fully loaded)
    let currentLoad = 0;
    if (node.status === 'busy' && node.currentProgress !== undefined) {
      currentLoad = node.currentProgress / 100;
    }

    return {
      nodeId: node.nodeId,
      hardwareScore,
      reliabilityScore,
      avgFrameTime,
      lastHeartbeatAge,
      framesRendered,
      currentLoad
    };
  }

  // Calculate optimal number of frames to assign to a node
  private static calculateOptimalFrameAssignment(
    nodePerf: NodePerformance,
    allNodePerfs: NodePerformance[],
    pendingFrames: number,
    job: any
  ): number {
    // Base capacity calculation
    let capacity = MIN_FRAMES_PER_NODE;

    // Adjust based on hardware
    capacity += Math.floor(nodePerf.hardwareScore * 2);

    // Adjust based on performance (faster nodes get more frames)
    if (nodePerf.avgFrameTime > 0) {
      const performanceFactor = Math.max(0.5, Math.min(2.0, 60 / nodePerf.avgFrameTime));
      capacity = Math.floor(capacity * performanceFactor);
    }

    // Adjust based on reliability
    capacity = Math.floor(capacity * nodePerf.reliabilityScore);

    // Adjust based on current load (busy nodes get fewer frames)
    const loadFactor = 1 - (nodePerf.currentLoad * 0.5); // Reduce by up to 50% if busy
    capacity = Math.floor(capacity * loadFactor);

    // For jobs with few frames, give fewer frames per node
    if (pendingFrames < 10) {
      capacity = Math.min(capacity, Math.max(1, Math.floor(pendingFrames / 2)));
    }

    // Cap at maximum
    capacity = Math.min(capacity, MAX_FRAMES_PER_NODE);
    capacity = Math.max(capacity, MIN_FRAMES_PER_NODE);

    // Ensure we don't assign more frames than available
    capacity = Math.min(capacity, pendingFrames);

    // Calculate fair distribution among all nodes
    const totalHardwareScore = allNodePerfs.reduce((sum, np) => sum + np.hardwareScore, 0);
    if (totalHardwareScore > 0) {
      const fairShare = Math.floor((pendingFrames * nodePerf.hardwareScore) / totalHardwareScore);
      capacity = Math.min(capacity, fairShare);
    }

    return Math.max(MIN_FRAMES_PER_NODE, capacity);
  }

  // Select which frames to assign to a node (strategic selection)
  private static selectFramesForNode(
    pendingFrames: number[],
    framesToAssign: number,
    job: any
  ): number[] {
    if (pendingFrames.length <= framesToAssign) {
      return [...pendingFrames];
    }

    // Sort frames to distribute work evenly
    const sortedFrames = [...pendingFrames].sort((a, b) => a - b);

    // For image rendering with single frame selection
    if (job.type === 'image' && job.frames.selected && job.frames.selected.length > 0) {
      // For image rendering, just return the first selected frame
      return [job.frames.selected[0]];
    }

    // For animation rendering, distribute frames across the timeline
    if (job.type === 'animation' && pendingFrames.length > 1) {
      const startFrame = job.frames.start;
      const endFrame = job.frames.end;
      const totalFrames = endFrame - startFrame + 1;

      // Calculate step size to distribute frames evenly
      const step = Math.max(1, Math.floor(totalFrames / framesToAssign));

      const selectedFrames: number[] = [];
      for (let i = 0; i < framesToAssign && i * step < totalFrames; i++) {
        const frameIndex = Math.min(startFrame + i * step, endFrame);
        if (pendingFrames.includes(frameIndex) && !selectedFrames.includes(frameIndex)) {
          selectedFrames.push(frameIndex);
        }
      }

      // If we didn't get enough frames, fill with remaining ones
      if (selectedFrames.length < framesToAssign) {
        const remainingFrames = pendingFrames.filter(f => !selectedFrames.includes(f));
        selectedFrames.push(...remainingFrames.slice(0, framesToAssign - selectedFrames.length));
      }

      return selectedFrames;
    }

    // For image rendering or small animations, just take from the front
    return sortedFrames.slice(0, framesToAssign);
  }

  // Frame completion with credits tracking and WebSocket updates
  static async frameCompleted(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;
      const { jobId, frame, renderTime, s3Key, fileSize } = req.body;

      if (!jobId || !frame || !s3Key) {
        throw new AppError('Missing required fields: jobId, frame, s3Key', 400);
      }

      const now = new Date();

      // Find the job
      const job = await Job.findOne({ jobId });
      if (!job) {
        throw new AppError('Job not found', 404);
      }

      // Type guard to ensure frameAssignments exists
      if (!job.frameAssignments) {
        job.frameAssignments = [];
      }

      // Find the frame assignment
      const assignment = job.frameAssignments.find(
        (a: IFrameAssignment) => a.frame === frame && a.nodeId === nodeId
      );

      if (!assignment) {
        throw new AppError('Frame assignment not found', 404);
      }

      // Update assignment
      const creditsEarned = job.settings.creditsPerFrame || DEFAULT_CREDITS_PER_FRAME;

      assignment.status = 'rendered';
      assignment.completedAt = now;
      assignment.renderTime = renderTime || 0;
      assignment.creditsEarned = creditsEarned;
      assignment.s3Key = s3Key;

      // Update job frames
      if (!job.frames.rendered.includes(frame)) {
        job.frames.rendered.push(frame);
      }

      // Remove from assigned frames
      const assignedIndex = job.frames.assigned.indexOf(frame);
      if (assignedIndex !== -1) {
        job.frames.assigned.splice(assignedIndex, 1);
      }

      // Update progress
      const totalFrames = job.frames.total;
      const renderedFrames = job.frames.rendered.length;
      job.progress = Math.round((renderedFrames / totalFrames) * 100);

      // Update output URLs
      const downloadUrl = await s3Service.generateFrameDownloadUrl(s3Key);

      // Initialize outputUrls if it doesn't exist
      if (!job.outputUrls) {
        job.outputUrls = [];
      }

      job.outputUrls.push({
        frame,
        url: downloadUrl,
        s3Key,
        fileSize: fileSize || 0,
        uploadedAt: now
      });

      // Check if job is completed
      // Re-count pending failed frames to decide if this job truly can complete now
      const selectedOrAll = job.frames.selected && job.frames.selected.length > 0
        ? job.frames.selected
        : Array.from({ length: job.frames.total }, (_, i) => job.frames.start + i);

      const totalFramesToRender = selectedOrAll.length;
      // Frames still needing work: assigned (in-flight) OR still failed (will retry)
      const stillInFlight = job.frames.assigned.length;
      const stillFailed = job.frames.failed.filter((f: number) => !job.frames.rendered.includes(f)).length;

      if (renderedFrames === totalFramesToRender) {
        job.status = 'completed';
        job.completedAt = now;

        // Calculate total credits distributed
        const totalCredits = job.frameAssignments
          .filter((a: IFrameAssignment) => a.status === 'rendered')
          .reduce((sum: number, a: IFrameAssignment) => sum + (a.creditsEarned || 0), 0);

        job.totalCreditsDistributed = totalCredits || 0;

        console.log(`🎉 Job ${job.jobId} completed! All ${totalFrames} frames rendered.`);
        console.log(`💰 Total credits distributed: ${totalCredits}`);
      }

      // Update node performance
      const node = await Node.findOne({ nodeId });
      if (node && node.performance) {
        const perf = node.performance;
        perf.framesRendered = (perf.framesRendered || 0) + 1;
        perf.totalRenderTime = (perf.totalRenderTime || 0) + (renderTime || 0);
        perf.avgFrameTime = perf.totalRenderTime / perf.framesRendered;
        perf.reliabilityScore = Math.min(1.0, (perf.reliabilityScore || 1.0) * 1.01);
        perf.lastUpdated = now;

        // Update jobs completed if this was the last frame
        if (renderedFrames === totalFrames && node.currentJob === jobId) {
          node.jobsCompleted = (node.jobsCompleted || 0) + 1;
          node.currentJob = undefined;
          node.currentProgress = undefined;
        }

        await node.save();
      }

      await job.save();

      console.log(`✅ Frame ${frame} completed for job ${jobId} by node ${nodeId} (Progress: ${job.progress}%)`);
      console.log(`📁 Frame stored at: ${s3Key}`);

      // Broadcast frame completion via WebSocket
      const wsService = NodeController.getWsService(req);
      if (wsService) {
        // Broadcast job update
        await wsService.broadcastJobUpdate(jobId);

        // Broadcast node update
        wsService.broadcastNodeUpdate(nodeId, {
          frameCompleted: frame,
          renderTime: renderTime || 0,
          creditsEarned: creditsEarned,
          lastUpdate: now.toISOString()
        });

        // If the job is not yet done, trigger poll for remaining/retryable frames
        if (job.status !== 'completed' && job.status !== 'failed') {
          // Always ask the completing node to check for more work
          wsService.sendToNode(nodeId, { type: 'request_job_poll' });

          // If there are failed frames still waiting to be retried and no in-flight assignments,
          // broadcast to ALL online nodes so any available node can pick them up immediately
          if (stillFailed > 0 && stillInFlight === 0) {
            console.log(`🔄 ${stillFailed} failed frame(s) need retry — broadcasting poll to all online nodes`);
            const onlineNodes = await Node.find({ status: { $in: ['online', 'busy'] } }, { nodeId: 1 });
            for (const n of onlineNodes) {
              if (n.nodeId !== nodeId) {  // completing node already polled above
                wsService.sendToNode(n.nodeId, { type: 'request_job_poll' });
              }
            }
          }
        }
      }

      res.json({
        success: true,
        message: 'Frame completion recorded',
        progress: job.progress,
        creditsEarned,
        jobStatus: job.status
      });

    } catch (error) {
      console.error('❌ Frame completion error:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({
          error: error.message
        });
      } else {
        res.status(500).json({
          error: 'Failed to record frame completion',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // Get job distribution report
  static async getJobDistributionReport(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;

      const job = await Job.findOne({ jobId });
      if (!job) {
        throw new AppError('Job not found', 404);
      }

      // Group assignments by node
      const nodeContributions: Record<string, {
        frames: number[],
        renderTimes: number[],
        totalRenderTime: number,
        creditsEarned: number,
        avgFrameTime: number
      }> = {};

      for (const assignment of job.frameAssignments) {
        if (assignment.status === 'rendered') {
          if (!nodeContributions[assignment.nodeId]) {
            nodeContributions[assignment.nodeId] = {
              frames: [],
              renderTimes: [],
              totalRenderTime: 0,
              creditsEarned: 0,
              avgFrameTime: 0
            };
          }

          const contribution = nodeContributions[assignment.nodeId];
          if (contribution) {
            contribution.frames.push(assignment.frame);
            contribution.renderTimes.push(assignment.renderTime || 0);
            contribution.totalRenderTime += assignment.renderTime || 0;
            contribution.creditsEarned += assignment.creditsEarned || 0;
          }
        }
      }

      // Calculate averages
      for (const nodeId in nodeContributions) {
        const contribution = nodeContributions[nodeId];
        if (contribution) {
          contribution.avgFrameTime = contribution.renderTimes.length > 0
            ? contribution.totalRenderTime / contribution.renderTimes.length
            : 0;
        }
      }

      const report = {
        jobId: job.jobId,
        status: job.status,
        totalFrames: job.frames.total,
        renderedFrames: job.frames.rendered.length,
        failedFrames: job.frames.failed.length,
        progress: job.progress,
        selectedFrames: job.frames.selected || [], // NEW: Include selected frames
        totalCreditsDistributed: job.totalCreditsDistributed || 0,
        nodeContributions: nodeContributions,
        frameAssignments: job.frameAssignments.map((a: IFrameAssignment) => ({
          frame: a.frame,
          nodeId: a.nodeId,
          status: a.status,
          renderTime: a.renderTime,
          creditsEarned: a.creditsEarned,
          assignedAt: a.assignedAt,
          completedAt: a.completedAt
        }))
      };

      res.json(report);

    } catch (error) {
      console.error('❌ Get job distribution report error:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({
          error: error.message
        });
      } else {
        res.status(500).json({
          error: 'Failed to get job distribution report',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // Get all nodes with WebSocket integration
  static async getAllNodes(req: Request, res: Response): Promise<void> {
    try {
      await NodeController.checkAndUpdateOfflineNodes();

      const authReq = req as AuthRequest;
      const isAdmin = authReq.user?.role === 'admin' || authReq.user?.roles?.includes('admin');
      const userId = authReq.user?.userId;

      let query = {};
      if (!isAdmin) {
        if (!userId) {
          res.json({
            nodes: [],
            statistics: {
              total: 0,
              online: 0,
              offline: 0,
              busy: 0,
              onlinePercentage: 0
            }
          });
          return;
        }
        query = { userId };
      }

      const nodes = await Node.find(query).sort({ createdAt: -1 });
      const now = new Date();

      const nodeList = nodes.map(node => {
        const lastHeartbeatAge = now.getTime() - new Date(node.lastHeartbeat).getTime();
        let computedStatus = node.status;
        let isActuallyOnline = lastHeartbeatAge <= HEARTBEAT_TIMEOUT_MS;

        if (!isActuallyOnline && (node.status === 'online' || node.status === 'busy')) {
          computedStatus = 'offline';

          // Update node status if needed
          Node.updateOne(
            { nodeId: node.nodeId },
            {
              status: 'offline',
              updatedAt: now,
              lastStatusChange: now
            }
          ).catch(err => console.error('Error updating node status:', err));
        }

        return {
          nodeId: node.nodeId,
          name: node.name,
          status: computedStatus,
          lastHeartbeat: node.lastHeartbeat,
          lastHeartbeatAge: `${Math.floor(lastHeartbeatAge / 1000)}s ago`,
          hardware: node.hardware,
          capabilities: node.capabilities,
          performance: node.performance,
          ipAddress: node.ipAddress,
          currentJob: node.currentJob,
          currentProgress: node.currentProgress,
          jobsCompleted: node.jobsCompleted,
          connectionCount: node.connectionCount || 0,
          createdAt: node.createdAt,
          updatedAt: node.updatedAt,
          lastStatusChange: node.lastStatusChange
        };
      });

      const onlineNodes = nodeList.filter(n => n.status === 'online' || n.status === 'busy');
      const offlineNodes = nodeList.filter(n => n.status === 'offline');
      const busyNodes = nodeList.filter(n => n.status === 'busy');

      res.json({
        nodes: nodeList,
        statistics: {
          total: nodeList.length,
          online: onlineNodes.length,
          offline: offlineNodes.length,
          busy: busyNodes.length,
          onlinePercentage: nodeList.length > 0 ? Math.round((onlineNodes.length / nodeList.length) * 100) : 0
        }
      });

    } catch (error) {
      console.error('❌ Get nodes error:', error);
      res.status(500).json({
        error: 'Failed to get nodes',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get node details with current job information
  static async getNode(req: Request, res: Response): Promise<void> {
    try {
      const { nodeId } = req.params;

      const node = await Node.findOne({ nodeId });
      if (!node) {
        throw new AppError('Node not found', 404);
      }

      let currentJobDetails = null;
      if (node.currentJob) {
        const job = await Job.findOne({ jobId: node.currentJob });
        if (job) {
          // Get frames assigned to this node
          const assignedFrames = job.frameAssignments
            .filter((a: IFrameAssignment) => a.nodeId === nodeId && a.status === 'assigned')
            .map((a: IFrameAssignment) => a.frame);

          const renderedFrames = job.frameAssignments
            .filter((a: IFrameAssignment) => a.nodeId === nodeId && a.status === 'rendered')
            .map((a: IFrameAssignment) => a.frame);

          const totalCreditsEarned = job.frameAssignments
            .filter((a: IFrameAssignment) => a.nodeId === nodeId && a.status === 'rendered')
            .reduce((sum: number, a: IFrameAssignment) => sum + (a.creditsEarned || 0), 0);

          currentJobDetails = {
            jobId: job.jobId,
            status: job.status,
            progress: job.progress,
            frames: {
              total: job.frames.total,
              rendered: renderedFrames.length,
              assigned: assignedFrames.length,
              selected: job.frames.selected || [] // NEW: Include selected frames
            },
            creditsEarned: totalCreditsEarned,
            settings: job.settings
          };
        }
      }

      const lastHeartbeatAge = Date.now() - new Date(node.lastHeartbeat).getTime();
      const isActuallyOnline = lastHeartbeatAge <= HEARTBEAT_TIMEOUT_MS;

      res.json({
        success: true,
        node: {
          nodeId: node.nodeId,
          name: node.name,
          status: isActuallyOnline ? node.status : 'offline',
          hardware: node.hardware,
          capabilities: node.capabilities,
          performance: node.performance,
          currentJob: currentJobDetails,
          jobsCompleted: node.jobsCompleted,
          connectionCount: node.connectionCount,
          lastHeartbeat: node.lastHeartbeat,
          createdAt: node.createdAt,
          updatedAt: node.updatedAt,
          isRevoked: node.isRevoked,
          revokedAt: node.revokedAt,
          revokedReason: node.revokedReason
        }
      });

    } catch (error) {
      console.error('❌ Get node error:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({
          error: error.message
        });
      } else {
        res.status(500).json({
          error: 'Failed to get node details',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // Get node statistics with performance data
  static async getNodeStatistics(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const isAdmin = authReq.user?.role === 'admin' || authReq.user?.roles?.includes('admin');
      const userId = authReq.user?.userId;

      let query = {};
      if (!isAdmin) {
        if (!userId) {
          res.json({
            total: 0,
            byStatus: { online: 0, offline: 0, busy: 0, maintenance: 0 },
            byHardware: { totalCpuCores: 0, totalRamGB: 0, totalVRAMGB: 0, gpuCount: 0 },
            performance: { totalJobsCompleted: 0, avgJobsPerNode: 0, totalConnections: 0, nodesWithPerformanceData: 0, avgFrameTime: "0.00", fastestNode: 'N/A', slowestNode: 'N/A' },
            onlineStatus: { actuallyOnline: 0, markedOnline: 0 }
          });
          return;
        }
        query = { userId };
      }

      const nodes = await Node.find(query);
      const now = new Date();

      // Calculate performance statistics
      const perfNodes = nodes.filter(n => n.performance && n.performance.framesRendered > 0);
      const avgFrameTime = perfNodes.length > 0
        ? perfNodes.reduce((sum, n) => sum + (n.performance?.avgFrameTime || 0), 0) / perfNodes.length
        : 0;

      // Get job statistics for node contributions (if method exists)
      const jobStats = (Job as any).getNodeContributions ? await (Job as any).getNodeContributions() : {};

      const statistics = {
        total: nodes.length,
        byStatus: {
          online: nodes.filter(n => n.status === 'online').length,
          offline: nodes.filter(n => n.status === 'offline').length,
          busy: nodes.filter(n => n.status === 'busy').length,
          maintenance: nodes.filter(n => n.status === 'maintenance').length
        },
        byHardware: {
          totalCpuCores: nodes.reduce((sum, n) => sum + (n.hardware?.cpuCores || 0), 0),
          totalRamGB: nodes.reduce((sum, n) => sum + (n.hardware?.ramGB || 0), 0),
          totalVRAMGB: nodes.reduce((sum, n) => sum + Math.floor((n.hardware?.gpuVRAM || 0) / 1024), 0),
          gpuCount: nodes.filter(n => n.hardware?.gpuName !== 'Unknown').length
        },
        performance: {
          totalJobsCompleted: nodes.reduce((sum, n) => sum + (n.jobsCompleted || 0), 0),
          avgJobsPerNode: nodes.length > 0 ?
            Math.round(nodes.reduce((sum, n) => sum + (n.jobsCompleted || 0), 0) / nodes.length) : 0,
          totalConnections: nodes.reduce((sum, n) => sum + (n.connectionCount || 0), 0),
          nodesWithPerformanceData: perfNodes.length,
          avgFrameTime: avgFrameTime.toFixed(2),
          fastestNode: perfNodes.length > 0
            ? perfNodes.sort((a, b) => (a.performance!.avgFrameTime - b.performance!.avgFrameTime))[0]?.nodeId
            : 'N/A',
          slowestNode: perfNodes.length > 0
            ? perfNodes.sort((a, b) => (b.performance!.avgFrameTime - a.performance!.avgFrameTime))[0]?.nodeId
            : 'N/A'
        },
        contributions: jobStats,
        onlineStatus: {
          actuallyOnline: nodes.filter(n => {
            const lastHeartbeatAge = now.getTime() - new Date(n.lastHeartbeat).getTime();
            return lastHeartbeatAge <= HEARTBEAT_TIMEOUT_MS;
          }).length,
          markedOnline: nodes.filter(n => n.status === 'online' || n.status === 'busy').length
        }
      };

      res.json(statistics);

    } catch (error) {
      console.error('❌ Get node statistics error:', error);
      res.status(500).json({
        error: 'Failed to get node statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ── Token-based node registration ─────────────────────────────────────────

  /**
   * POST /api/nodes/tokens/generate
   * Authenticated node_provider generates a one-time pairing token.
   */
  static async generateToken(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.userId;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const { User } = await import('../models/User');
      const { RegistrationToken } = await import('../models/RegistrationToken');
      const { Node } = await import('../models/Node');

      const user = await User.findById(userId);
      if (!user || !user.roles.includes('node_provider')) {
        res.status(403).json({ success: false, error: 'node_provider role required' });
        return;
      }

      // Enforce maxNodes limit: count non-revoked nodes belonging to this user
      const nodeCount = await Node.countDocuments({ userId, isRevoked: { $ne: true } });
      const maxNodes = user.maxNodes ?? 10;
      if (nodeCount >= maxNodes) {
        res.status(403).json({
          success: false,
          error: 'NODE_LIMIT_REACHED',
          message: `You have reached your node limit (${maxNodes}). Revoke an existing node before adding a new one.`,
          currentCount: nodeCount,
          maxNodes,
        });
        return;
      }

      const { label } = req.body;
      let tokenString = '';
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 10) {
        tokenString = (RegistrationToken as any).generateTokenString
          ? (RegistrationToken as any).generateTokenString()
          : require('crypto').randomBytes(24).toString('hex').toUpperCase();

        const existingToken = await RegistrationToken.findOne({ token: tokenString });
        if (!existingToken) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        res.status(500).json({ success: false, error: 'Failed to generate a unique token after multiple attempts' });
        return;
      }

      const expiresAt = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes

      const token = await RegistrationToken.create({
        token: tokenString,
        userId,
        label: label || undefined,
        expiresAt,
      });

      console.log(`🔑 Registration token generated for user ${userId}: ${tokenString.substring(0, 8)}...`);

      res.json({
        success: true,
        token: tokenString,
        expiresAt,
        label: token.label,
        instructions: 'Paste this token into your node software within 20 minutes. It can only be used once.',
      });
    } catch (error) {
      console.error('❌ Token generation error:', error);
      res.status(500).json({ success: false, error: 'Failed to generate token' });
    }
  }

  /**
   * POST /api/nodes/register-with-token
   * Node software calls this with a registration token.
   * On success returns { nodeId, nodeSecret } — the secret is NEVER stored in plain text again.
   *
   * Secret enforcement is controlled by ENFORCE_NODE_SECRET env var (default: strict / true).
   */
  static async registerWithToken(req: Request, res: Response): Promise<void> {
    try {
      const { registrationToken, name, hardware, os, capabilities, performance,
        ipAddress, publicIp, hostname, hardwareFingerprint, hardwareVerifiedAt } = req.body;

      if (!registrationToken) {
        res.status(400).json({ success: false, error: 'registrationToken is required' });
        return;
      }

      const { RegistrationToken } = await import('../models/RegistrationToken');
      const { Node } = await import('../models/Node');
      const { User } = await import('../models/User');
      const notificationService = (await import('../services/NotificationService')).notificationService;
      const bcrypt = await import('bcryptjs');
      const crypto = await import('crypto');
      const { HardwareValidationService } = await import('../services/HardwareValidationService');
      const { Application } = await import('../models/Application');

      // Find the token
      const tokenDoc = await RegistrationToken.findOne({ token: registrationToken });

      if (!tokenDoc) {
        res.status(400).json({ success: false, error: 'TOKEN_INVALID', message: 'Invalid registration token.' });
        return;
      }
      if (tokenDoc.used || tokenDoc.useCount >= tokenDoc.maxUses) {
        res.status(400).json({ success: false, error: 'TOKEN_ALREADY_USED', message: 'This token has already been used.' });
        return;
      }
      if (new Date() > tokenDoc.expiresAt) {
        res.status(400).json({ success: false, error: 'TOKEN_EXPIRED', message: 'This token has expired. Please generate a new one from the dashboard.' });
        return;
      }

      const userId = tokenDoc.userId;

      // Re-check user still under maxNodes
      const user = await User.findById(userId);
      if (!user) {
        res.status(400).json({ success: false, error: 'USER_NOT_FOUND' });
        return;
      }
      const nodeCount = await Node.countDocuments({ userId, isRevoked: { $ne: true } });
      const maxNodes = user.maxNodes ?? 10;
      if (nodeCount >= maxNodes) {
        res.status(403).json({
          success: false,
          error: 'NODE_LIMIT_REACHED',
          message: `Account node limit (${maxNodes}) reached.`,
        });
        return;
      }

      // Block duplicate hardware fingerprints across the whole system
      if (hardwareFingerprint) {
        const hwMatch = await Node.findOne({ hardwareFingerprint, isRevoked: { $ne: true } });
        if (hwMatch) {
          res.status(409).json({
            success: false,
            error: 'HARDWARE_ALREADY_REGISTERED',
            message: 'This hardware is already registered. Revoke the existing node first.',
            existingNodeId: hwMatch.nodeId,
          });
          return;
        }
      }

      // ── Hardware Validation & Tagging ─────────────────────────────────────────
      // 1. Minimum Requirements Check
      const incomingHardware = {
        ramGB: hardware?.ramGB,
        gpuVRAM: hardware?.gpuVRAM,
        cpuCores: hardware?.cpuCores,
        gpuName: hardware?.gpuName
      };

      const minCheck = HardwareValidationService.checkMinimumRequirements(incomingHardware);

      if (!minCheck.meetsRequirements) {
        // Notify the user why their node was rejected via WebSocket & DB
        try {
          const notifyTitle = 'Node Registration Rejected';
          const notifyMsg = `Your node "${name || 'Unknown'}" does not meet our minimum hardware requirements. ${minCheck.reason}`;

          await notificationService.createNotification(
            userId,
            'system',
            notifyTitle,
            notifyMsg
          );

          const wsService = req.app.get('wsService');
          if (wsService && wsService.emitToUser) {
            wsService.emitToUser(userId.toString(), 'notification', {
              type: 'system',
              title: notifyTitle,
              message: notifyMsg
            });
          }
        } catch (e) { /* ignore notification errors */ }

        res.status(403).json({
          success: false,
          error: 'HARDWARE_REQUIREMENTS_NOT_MET',
          message: `Node does not meet minimum hardware requirements. ${minCheck.reason}`
        });
        return; // Abort node registration!
      }

      // 2. Suspicion Tagging (against Application Data)
      try {
        const userApplication = await Application.findOne({ userId }).sort({ createdAt: -1 });
        const suspicionLevel = HardwareValidationService.evaluateSuspicionLevel(userApplication, incomingHardware);

        // Only update if it increases the suspicion level (to prevent downgrading a 'complete suspicious' user back to 'none')
        const levels = ['none', 'little suspicious', 'more suspicious', 'complete suspicious'];
        const currentLevelIdx = levels.indexOf(user.suspicionTag || 'none');
        const newLevelIdx = levels.indexOf(suspicionLevel);

        if (newLevelIdx > currentLevelIdx) {
          user.suspicionTag = suspicionLevel;
          await user.save();
          console.warn(`⚠️ User ${userId} tagged as "${suspicionLevel}" due to hardware spec discrepancies on node registration.`);
        }
      } catch (err) {
        console.error('⚠️ Failed to evaluate suspicion level during registration:', err);
        // Non-fatal, continue with registration
      }
      // ────────────────────────────────────────────────────────────────────────

      // Generate nodeId + nodeSecret
      const nodeId = `node-${crypto.randomBytes(5).toString('hex')}-${Date.now().toString(36)}`;
      const nodeSecret = crypto.randomBytes(48).toString('hex'); // 96-char hex secret
      const nodeSecretHash = await bcrypt.hash(nodeSecret, 10);

      const nodeName = name || tokenDoc.label || `Node-${nodeId.substring(0, 12)}`;
      const now = new Date();

      // Create the node, permanently linked to the user
      const node = new Node({
        nodeId,
        userId,
        name: nodeName,
        status: 'online',
        os: os || 'Unknown',
        hardware: {
          cpuCores: 1,
          cpuScore: 0,
          gpuName: 'Unknown',
          gpuVRAM: 0,
          gpuScore: 0,
          ramGB: 0,
          blenderVersion: 'unknown',
          ...(hardware || {}),
        },
        capabilities: {
          supportedEngines: ['CYCLES', 'EEVEE'],
          supportedGPUs: ['CUDA', 'OPTIX'],
          maxSamples: 1024,
          maxResolutionX: 3840,
          maxResolutionY: 2160,
          supportsTiles: true,
          ...(capabilities || {}),
        },
        performance: {
          tier: 'Unknown',
          effectiveScore: 0,
          gpuScore: 0,
          cpuScore: 0,
          framesRendered: 0,
          totalRenderTime: 0,
          avgFrameTime: 0,
          reliabilityScore: 100,
          lastUpdated: now,
          ...(performance || {}),
        },
        ipAddress: ipAddress || '0.0.0.0',
        publicIp: publicIp || undefined,
        hostname: hostname || undefined,
        hardwareFingerprint: hardwareFingerprint || undefined,
        hardwareVerifiedAt: hardwareVerifiedAt ? new Date(hardwareVerifiedAt) : now,
        nodeSecretHash,
        registeredViaToken: registrationToken,
        lastHeartbeat: now,
        lastStatusChange: now,
        connectionCount: 1,
        jobsCompleted: 0,
        createdAt: now,
        updatedAt: now,
      });

      await node.save();

      // Mark token as used (atomic)
      await RegistrationToken.updateOne(
        { _id: tokenDoc._id },
        { $set: { used: true, usedAt: now, usedByNodeId: nodeId, useCount: 1 } }
      );

      console.log(`✅ Node registered via token: ${nodeName} (${nodeId}) → user ${userId}`);

      // Send in-app notification + real-time WS push to the token owner
      try {
        await notificationService.createNotification(
          userId,
          'node_registered',
          '� Final Approval Complete: Node Registered',
          `Congratulations! Your hardware meets the requirements. "${nodeName}" has been successfully connected and verified.`,
          { nodeId, nodeName }
        );

        const wsService = req.app.get('wsService');
        if (wsService && wsService.emitToUser) {
          wsService.emitToUser(userId.toString(), 'notification', {
            type: 'node_registered',
            title: '� Final Approval Complete: Node Registered',
            message: `Congratulations! Your hardware meets the requirements. "${nodeName}" has been successfully connected and verified.`,
            nodeId,
            nodeName,
          });
        }

        // Also broadcast system update for the admin dashboard
        if (wsService) {
          wsService.broadcastSystemUpdate({
            type: 'node_registered',
            data: { nodeId, nodeName, userId, timestamp: now.toISOString() },
          });
        }
      } catch (notifyErr) {
        console.warn('⚠️ Failed to send node_registered notification:', notifyErr);
        // Non-fatal — don't fail the registration
      }

      res.status(201).json({
        success: true,
        message: 'Node registered and linked to your account.',
        nodeId,
        nodeSecret,  // Only time the plain-text secret is ever returned
        nodeName,
        heartbeatInterval: 30000,
        warning: 'Store nodeSecret securely — it will never be shown again.',
      });
    } catch (error) {
      console.error('❌ registerWithToken error:', error);
      res.status(500).json({ success: false, error: 'Failed to register node', details: String(error) });
    }
  }

  /**
   * POST /api/nodes/revoke
   * Authenticated node_provider revokes one of their own nodes.
   */
  static async revokeNode(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.userId;
      const { nodeId, reason } = req.body;

      if (!nodeId) {
        res.status(400).json({ success: false, error: 'nodeId is required' });
        return;
      }

      const { Node } = await import('../models/Node');
      const notificationService = (await import('../services/NotificationService')).notificationService;

      const node = await Node.findOne({ nodeId });
      if (!node) {
        res.status(404).json({ success: false, error: 'Node not found' });
        return;
      }

      // Only the owner (or admin) can revoke
      const userIdStr = userId?.toString();
      const nodeUserIdStr = node.userId?.toString();
      const isAdmin = authReq.user?.roles?.includes('admin') || authReq.user?.role === 'admin';

      if (!isAdmin && userIdStr !== nodeUserIdStr) {
        res.status(403).json({ success: false, error: 'You do not own this node' });
        return;
      }

      if (node.isRevoked) {
        res.status(400).json({ success: false, error: 'Node is already revoked' });
        return;
      }

      const now = new Date();
      await Node.updateOne(
        { nodeId },
        {
          $set: {
            isRevoked: true,
            revokedAt: now,
            revokedReason: reason || 'Revoked by owner',
            status: 'offline',
            offlineReason: 'Node revoked by owner',
            wsConnected: false,
            updatedAt: now,
            lastStatusChange: now,
          },
        }
      );

      console.log(`🚫 Node revoked: ${nodeId} by user ${userId}. Reason: ${reason || 'N/A'}`);

      // Notify the owner
      try {
        await notificationService.createNotification(
          node.userId,
          'node_revoked',
          '🚫 Node Revoked',
          `"${node.name || nodeId}" has been revoked. ${reason ? `Reason: ${reason}` : ''}`,
          { nodeId, reason }
        );
      } catch { /* non-fatal */ }

      // Broadcast to dashboard
      const wsService = req.app.get('wsService');
      if (wsService) {
        wsService.broadcastSystemUpdate({
          type: 'node_revoked',
          data: { nodeId, nodeName: node.name, reason, timestamp: now.toISOString() },
        });
        wsService.broadcastNodeUpdate(nodeId, {
          status: 'offline',
          isRevoked: true,
          revokedAt: now,
        });
      }

      res.json({ success: true, message: `Node "${node.name || nodeId}" has been revoked.` });
    } catch (error) {
      console.error('❌ revokeNode error:', error);
      res.status(500).json({ success: false, error: 'Failed to revoke node' });
    }
  }

  /**
   * POST /api/nodes/tokens/list
   * Returns active (unused, unexpired) tokens for the authenticated node_provider.
   */
  static async listTokens(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.userId;
      const { RegistrationToken } = await import('../models/RegistrationToken');

      const tokens = await RegistrationToken.find({
        userId,
        used: false,
        expiresAt: { $gt: new Date() },
      }).select('-__v').sort({ createdAt: -1 });

      res.json({ success: true, tokens });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to list tokens' });
    }
  }
}