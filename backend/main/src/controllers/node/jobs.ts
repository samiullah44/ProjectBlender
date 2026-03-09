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

import { getWsService, NodePerformance } from './shared';
  // IMPROVED: Job assignment with smart load balancing and frame tracking
  export const assignJob = async (req: Request, res: Response): Promise<void> => {
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
        const wsService = getWsService(req);
        throw new AppError(
          `Node is offline (no recent heartbeat). Last heartbeat was ${Math.floor(lastHeartbeatAge / 1000)} seconds ago`,
          400
        );
      }

      // ── Disk Space Pre-Check before Job Assignment ───────────────────
      const currentFreeGB = node.hardware?.storageFreeGB;
      if (currentFreeGB !== undefined) {
        const diskCheck = HardwareValidationService.checkFreeDisk(currentFreeGB);
        if (!diskCheck.allowed) {
          throw new AppError(diskCheck.message, 400);
        }
      }
      // ──────────────────────────────────────────────────────────────────

      // Check if node already has a job and frames
      if (node.currentJob) {
        const job = await Job.findOne({ jobId: node.currentJob });
        if (job && (job.status === 'processing' || job.status === 'pending')) {
          const assignedNodesMap = job.assignedNodes as unknown as Map<string, number[]>;
          const nodeIdKey = String(nodeId);
          const assignedFrames = assignedNodesMap?.get(nodeIdKey) || [];

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

      // 1. Determine local queue topics based on node hardware capabilities
      const queueNames: string[] = [];
      const engines = node.capabilities.supportedEngines || [];
      const hasGpus = node.capabilities.supportedGPUs && node.capabilities.supportedGPUs.length > 0;

      for (const engine of engines) {
        const eng = engine.toUpperCase();
        if (hasGpus) queueNames.push(getQueueName(eng, 'GPU'));
        queueNames.push(getQueueName(eng, 'CPU'));
      }

      if (queueNames.length === 0) {
        console.warn(`⚠️ Node ${nodeId} has no supported queues for assignment`);
        res.json({ jobId: null });
        return;
      }

      console.log(`🔍 Node ${nodeId} polling queues: ${queueNames.join(', ')}`);

      // 2. Fetch load-balancing metrics to calculate optimal assignment size
      const cutoffTime = new Date(now.getTime() - HEARTBEAT_TIMEOUT_MS);
      const onlineNodes = await Node.find({
        lastHeartbeat: { $gte: cutoffTime },
        status: { $in: ['online', 'busy'] }
      });

      const nodePerformances = onlineNodes.map(n => calculateNodePerformance(n, now));
      const currentNodePerf = nodePerformances.find(p => p.nodeId === nodeId);

      if (!currentNodePerf) {
        res.json({ jobId: null });
        return;
      }

      // Max frames per batch based on hardware score (between 1 and 20)
      const maxFramesToRequest = Math.max(1, Math.min(20, Math.ceil(currentNodePerf.hardwareScore * 1.5)));

      // 3. Atomically pop frames from BullMQ/Redis (replaces heavy MongoDB job $expr scan)
      const dequeuedAll = await dequeueFramesForNode(nodeId, queueNames, maxFramesToRequest);

      if (dequeuedAll.length === 0) {
        // console.log(`📭 No frames found in BullMQ for node ${nodeId} (requested up to ${maxFramesToRequest})`);
        res.json({ jobId: null });
        return;
      }

      console.log(`📥 Dequeued ${dequeuedAll.length} frame(s) from BullMQ for node ${nodeId}: [${dequeuedAll.map(f => `${f.jobId}:${f.frame}`).join(', ')}]`);

      // 4. Node client only accepts ONE jobId at a time.
      // Filter out frames from secondary jobs and return them to the queue immediately.
      const targetJobId = dequeuedAll[0]!.jobId;
      const assignedBullFrames = dequeuedAll.filter(f => f.jobId === targetJobId);
      const rejectedBullFrames = dequeuedAll.filter(f => f.jobId !== targetJobId);

      if (rejectedBullFrames.length > 0) {
        await Promise.all(rejectedBullFrames.map(f =>
          nackFrame(f.bullJobId, f.lockToken, 'Node requested frames but was grouped into another job, returning', f.queueName)
        ));
      }

      // 5. Fetch the ONE target Job from MongoDB to track progress & stats
      const job = await Job.findOne({ jobId: targetJobId });
      if (!job || job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        await Promise.all(assignedBullFrames.map(f =>
          nackFrame(f.bullJobId, f.lockToken, 'Job is no longer active in MongoDB', f.queueName)
        ));
        res.json({ jobId: null });
        return;
      }

      // Build array of extracted frame indices
      const assignedFrames = assignedBullFrames.map(f => f.frame);

      // 6. Mark frames as in-progress inside MongoDB (for Dashboard fidelity)
      // Remove them from frames.pending and frames.failed since they are assigned again

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
      const failedFrames = job.frames.failed || [];
      const reassignedFailedFrames = assignedFrames.filter(f => failedFrames.includes(f));
      if (reassignedFailedFrames.length > 0) {
        updateOp.$pull = { 'frames.failed': { $in: reassignedFailedFrames } };
        console.log(`🔄 Retrying ${reassignedFailedFrames.length} previously-failed frame(s): [${reassignedFailedFrames.join(', ')}]`);
      }

      // Remove newly assigned frames from pending/failed tracking arrays
      const pendingFrames = job.frames.pending || [];
      const failedFramesList = job.frames.failed || [];

      assignedFrames.forEach(frame => {
        const pendingIdx = pendingFrames.indexOf(frame);
        if (pendingIdx !== -1) pendingFrames.splice(pendingIdx, 1);

        const failedIdx = failedFramesList.indexOf(frame);
        if (failedIdx !== -1) failedFramesList.splice(failedIdx, 1);
      });

      // Update the objects back
      job.frames.pending = pendingFrames;
      job.frames.failed = failedFramesList;

      // Execute atomic update
      const result = await Job.findOneAndUpdate(
        { jobId: targetJobId },
        updateOp,
        { new: true }
      );

      if (result) {
        const blendFileUrl = await s3Service.generateBlendFileDownloadUrl(job.blendFileKey);

        // Update node status & save active BullMQ jobs
        await Node.updateOne(
          { nodeId },
          {
            $set: {
              currentJob: result.jobId,
              status: 'busy',
              updatedAt: now
            },
            $addToSet: {
              activeBullJobIds: {
                $each: assignedBullFrames.map(f => ({ id: f.bullJobId, queueName: f.queueName, lockToken: f.lockToken }))
              }
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
        const wsService = getWsService(req);
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

      // If we fall through and didn't return, something failed. NACK the frames.
      await Promise.all(assignedBullFrames.map(f =>
        nackFrame(f.bullJobId, f.lockToken, 'MongoDB job assignment transaction failed', f.queueName)
      ));
      res.json({ jobId: null });

    } catch (error) {
      console.error('❌ Job assignment error:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to assign job', details: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  }

  // Calculate node performance metrics
  export const calculateNodePerformance = (node: any, now: Date): NodePerformance => {
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
  export const calculateOptimalFrameAssignment = (
    nodePerf: NodePerformance,
    allNodePerfs: NodePerformance[],
    pendingFrames: number,
    job: any
  ): number => {
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
  export const selectFramesForNode = (
    pendingFrames: number[],
    framesToAssign: number,
    job: any
  ): number[] => {
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
  export const frameCompleted = async (req: Request, res: Response): Promise<void> => {
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

      // ✅ FIX: Also remove from assignedNodes map to prevent stale tracking
      const assignedNodesMap = job.assignedNodes as unknown as Map<string, number[]>;
      const nodeIdKey = String(nodeId); // Safely cast to string
      const nodeFrames = assignedNodesMap?.get(nodeIdKey) || [];
      const frameIdx = nodeFrames.indexOf(frame);
      if (frameIdx !== -1) {
        nodeFrames.splice(frameIdx, 1);
      }

      // If node has no more frames for this job, cleanup the map entry
      if (nodeFrames.length === 0) {
        assignedNodesMap?.delete(nodeIdKey);
      }

      // Tell Mongoose that the Map has changed
      job.markModified('assignedNodes');

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

      // Update Client Stats: Increment framesRendered
      await User.findByIdAndUpdate(job.userId, {
        $inc: { 'stats.framesRendered': 1 }
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
        // Update Provider Stats: Increment framesRendered and totalEarned
        if (node.userId) {
          await User.findByIdAndUpdate(node.userId, {
            $inc: {
              'stats.framesRendered': 1,
              'stats.totalEarned': job.settings.creditsPerFrame || DEFAULT_CREDITS_PER_FRAME
            }
          });
        }

        const perf = node.performance;
        perf.framesRendered = (perf.framesRendered || 0) + 1;
        perf.totalRenderTime = (perf.totalRenderTime || 0) + (renderTime || 0);
        perf.avgFrameTime = perf.totalRenderTime / perf.framesRendered;
        perf.reliabilityScore = Math.min(1.0, (perf.reliabilityScore || 1.0) * 1.01);
        perf.lastUpdated = now;

        // Update jobs completed if this was the last frame
        if (renderedFrames === totalFramesToRender && node.currentJob === jobId) {
          node.jobsCompleted = (node.jobsCompleted || 0) + 1;
          node.currentJob = undefined;
          node.currentProgress = undefined;
          node.status = 'online';
        }

        await node.save();
      }

      // Extra safety: ensure Mongoose sees all changes to the Map
      job.markModified('assignedNodes');
      await job.save();

      console.log(`✅ Frame ${frame} completed for job ${jobId} by node ${nodeId} (Progress: ${job.progress}%)`);
      console.log(`📁 Frame stored at: ${s3Key}`);

      // 1. ACK the frame in BullMQ
      const expectedBullJobId = `${jobId}-${frame}`;
      const bullJobTarget = node?.activeBullJobIds?.find(bj => bj.id === expectedBullJobId);

      if (bullJobTarget) {
        // The lock token is simply `nodeId` as established in dequeueFramesForNode
        await ackFrame(bullJobTarget.id, bullJobTarget.lockToken, bullJobTarget.queueName);

        // 2. Remove from node's active list
        await Node.updateOne(
          { nodeId },
          { $pull: { activeBullJobIds: { id: expectedBullJobId } } }
        );
      } else {
        console.warn(`⚠️ Could not find active BullMQ job ${expectedBullJobId} on node ${nodeId} for ACK`);
      }

      // Broadcast frame completion via WebSocket
      const wsService = getWsService(req);
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
          wsService.sendToNode(String(nodeId), { type: 'request_job_poll' });

          // FIX (Polling Storm): instead of broadcasting to every single node on every
          // failed frame (which causes O(nodes × frames) DB queries), we only fire a
          // single global notify when ALL in-flight frames are done and failed frames
          // still need workers. The offline-node checker handles the periodic sweep.
          if (stillFailed > 0 && stillInFlight === 0) {
            console.log(`🔄 ${stillFailed} failed frame(s) ready for retry — notifying available nodes`);
            await wsService.notifyNodesToCheckJobs();
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

  // ── Blender crash / frame failure report (called by node via POST /api/jobs/:jobId/fail-frame) ──
  export const reportFrameFailure = async (req: Request, res: Response): Promise<void> => {
    const MAX_FRAME_RETRIES = 3;
    try {
      const { jobId } = req.params;
      const { nodeId, frame, error: errorMessage } = req.body;

      if (!jobId || frame == null || !nodeId) {
        res.status(400).json({ error: 'jobId, frame and nodeId are required' });
        return;
      }

      const frameNum = Number(frame);
      if (isNaN(frameNum)) {
        res.status(400).json({ error: 'frame must be a number' });
        return;
      }

      const job = await Job.findOne({ jobId });
      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      // 1. NACK the frame in BullMQ
      const expectedBullJobId = `${jobId}-${frameNum}`;
      const node = await Node.findOne({ nodeId });
      const bullJobTarget = node?.activeBullJobIds?.find(bj => bj.id === expectedBullJobId);

      if (bullJobTarget) {
        // lockToken is bullJobTarget.lockToken
        await nackFrame(bullJobTarget.id, bullJobTarget.lockToken, errorMessage || 'Frame failed naturally', bullJobTarget.queueName);
        await Node.updateOne(
          { nodeId },
          { $pull: { activeBullJobIds: { id: expectedBullJobId } } }
        );
      } else {
        console.warn(`⚠️ Could not find active BullMQ job ${expectedBullJobId} on node ${nodeId} for NACK`);
      }

      // ── Find or create the frameAssignment record ──────────────────────────
      let assignment = job.frameAssignments.find(
        (a: IFrameAssignment) => a.frame === frameNum && a.nodeId === nodeId && a.status === 'assigned'
      ) as (IFrameAssignment & { retryCount?: number }) | undefined;

      const currentRetries: number = (assignment as any)?.retryCount ?? 0;
      const nextRetry = currentRetries + 1;

      console.log(`⚠️  Frame ${frameNum} failure reported by node ${nodeId} for job ${jobId} (attempt ${nextRetry}/${MAX_FRAME_RETRIES}): ${errorMessage}`);

      if (nextRetry < MAX_FRAME_RETRIES) {
        // ── RETRY: move frame back to pending so any node can pick it up ──────
        if (assignment) {
          (assignment as any).retryCount = nextRetry;
          assignment.status = 'failed';         // mark this attempt failed
          assignment.completedAt = new Date();
          if (errorMessage) assignment.errorMessage = errorMessage;
        }

        // Remove from assigned list
        const assignedIdx = job.frames.assigned.indexOf(frameNum);
        if (assignedIdx !== -1) job.frames.assigned.splice(assignedIdx, 1);

        // Put back into pending so the distributor can re-assign it
        if (!job.frames.pending.includes(frameNum)) {
          job.frames.pending.push(frameNum);
        }

        // Remove from node's assignedNodes map
        const assignedNodesMap = job.assignedNodes as unknown as Map<string, number[]>;
        const nodeIdKey = String(nodeId); // Safely cast to string
        const nodeFrames = assignedNodesMap?.get(nodeIdKey) ?? [];
        const frameIdx = nodeFrames.indexOf(frameNum);
        if (frameIdx !== -1) nodeFrames.splice(frameIdx, 1);
        if (nodeFrames.length === 0) assignedNodesMap?.delete(nodeIdKey);

        // Tell Mongoose that the Map has changed
        job.markModified('assignedNodes');
        job.updatedAt = new Date();
        await job.save();

        console.log(`🔄 Frame ${frameNum} queued for retry (attempt ${nextRetry}/${MAX_FRAME_RETRIES}) — re-added to pending`);

        // Broadcast immediately so a free node picks it up
        const wsService = getWsService(req);
        if (wsService) {
          await wsService.notifyNodesToCheckJobs();
          await wsService.broadcastJobUpdate(jobId);
        }

        res.json({
          success: true,
          action: 'retry',
          retryAttempt: nextRetry,
          maxRetries: MAX_FRAME_RETRIES,
          message: `Frame ${frameNum} queued for retry (${nextRetry}/${MAX_FRAME_RETRIES})`
        });

      } else {
        // ── PERMANENT FAILURE: all retries exhausted ───────────────────────────
        if (assignment) {
          (assignment as any).retryCount = nextRetry;
          assignment.status = 'failed';
          assignment.completedAt = new Date();
          if (errorMessage) assignment.errorMessage = errorMessage;
        }

        // Remove from assigned, add to permanently failed
        const assignedIdx = job.frames.assigned.indexOf(frameNum);
        if (assignedIdx !== -1) job.frames.assigned.splice(assignedIdx, 1);

        // Also remove from pending in case it was re-added
        const pendingIdx = job.frames.pending.indexOf(frameNum);
        if (pendingIdx !== -1) job.frames.pending.splice(pendingIdx, 1);

        if (!job.frames.failed.includes(frameNum)) {
          job.frames.failed.push(frameNum);
        }

        // Remove from node's assignedNodes map
        const assignedNodesMap = job.assignedNodes as unknown as Map<string, number[]>;
        const nodeIdKey = String(nodeId); // Safely cast to string
        const nodeFrames = assignedNodesMap?.get(nodeIdKey) ?? [];
        const fidx = nodeFrames.indexOf(frameNum);
        if (fidx !== -1) nodeFrames.splice(fidx, 1);
        if (nodeFrames.length === 0) assignedNodesMap?.delete(nodeIdKey);

        // Tell Mongoose that the Map has changed
        job.markModified('assignedNodes');

        // Recalculate job status
        const totalFramesToRender = job.frames.selected?.length > 0 ? job.frames.selected.length : job.frames.total;
        const renderedFrames = job.frames.rendered.length;
        const pendingCount = job.frames.pending?.length || 0;
        const assignedCount = job.frames.assigned?.length || 0;

        if (renderedFrames === totalFramesToRender) {
          job.status = 'completed';
          job.completedAt = new Date();
        } else if (pendingCount === 0 && assignedCount === 0 && renderedFrames < totalFramesToRender) {
          job.status = 'failed';
        }
        // Otherwise stays 'processing' — other frames may still finish

        job.progress = Math.round((renderedFrames / totalFramesToRender) * 100);
        job.updatedAt = new Date();
        await job.save();

        console.log(`❌ Frame ${frameNum} permanently failed after ${MAX_FRAME_RETRIES} attempts for job ${jobId}`);

        const wsService = getWsService(req);
        if (wsService) {
          await wsService.broadcastJobUpdate(jobId);
          // Notify other free nodes in case more pending frames exist
          if (pendingCount > 0) {
            await wsService.notifyNodesToCheckJobs();
          }
        }

        res.json({
          success: true,
          action: 'permanent_failure',
          retryAttempt: nextRetry,
          maxRetries: MAX_FRAME_RETRIES,
          message: `Frame ${frameNum} permanently failed after ${MAX_FRAME_RETRIES} attempts`
        });
      }

    } catch (error) {
      console.error('❌ reportFrameFailure error:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({ error: error.message });
      } else {
        res.status(500).json({
          error: 'Failed to record frame failure',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // Get job distribution report
  export const getJobDistributionReport = async (req: Request, res: Response): Promise<void> => {
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