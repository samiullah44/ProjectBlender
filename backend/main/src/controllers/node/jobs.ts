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
import { dequeueFramesForNode, nackFrame, requeueFramesFromOfflineNode, ackFrame, getQueueName, forceRequeueActiveJobs, purgeJobFromAllQueues } from '../../services/FrameQueueService';
import { JobService } from '../../services/JobService';

const s3Service = new S3Service();

const HEARTBEAT_TIMEOUT_MS = 60000;
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

          // Resolve extension based on job settings
          let extension = 'png';
          if (job.settings?.outputFormat) {
            const format = job.settings.outputFormat.toUpperCase();
            if (format === 'JPEG' || format === 'JPG') extension = 'jpg';
            else if (format === 'OPEN_EXR' || format === 'EXR') extension = 'exr';
            else if (format === 'TIFF') extension = 'tif';
            else if (format === 'TARGA' || format === 'TGA') extension = 'tga';
            else if (format === 'BMP') extension = 'bmp';
          }

          // Generate upload URLs for pending frames
          const frameUploadUrls: Record<number, { uploadUrl: string, s3Key: string }> = {};
          for (const frame of pendingAssignedFrames) {
            const { uploadUrl, s3Key } = await s3Service.generateFrameUploadUrl(job.jobId, frame, extension);
            frameUploadUrls[frame] = { uploadUrl, s3Key };
          }

          res.json({
            jobId: job.jobId,
            frames: pendingAssignedFrames,
            blendFileUrl,
            frameUploadUrls,
            settings: job.settings,
            inputType: job.inputType,
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
          node.status = 'online';
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
      // NOTE: We removed the aggressive forceRequeueActiveJobs sweep here.
      // Recovery is now handled by the background SettlementScheduler to prevent
      // race conditions where multiple nodes fight for the same "stuck" frame.
      res.json({ jobId: null });
      return;
    }

    console.log(`📥 Dequeued ${dequeuedAll.length} frame(s) from BullMQ for node ${nodeId}: [${dequeuedAll.map(f => `${f.jobId}:${f.frame}`).join(', ')}]`);

    // 4. Node client only accepts ONE jobId at a time.
    // Filter out frames from secondary jobs and return them to the queue immediately.
    const targetJobId = dequeuedAll[0]!.jobId;
    const assignedBullFrames = dequeuedAll.filter(f => f.jobId === targetJobId);
    const rejectedBullFrames = dequeuedAll.filter(f => f.jobId !== targetJobId);

    // Immediately return frames from other jobs to the queue
    if (rejectedBullFrames.length > 0) {
      await Promise.all(rejectedBullFrames.map(f =>
        nackFrame(f.bullJobId, f.lockToken, 'Node requested frames but was grouped into another job', f.queueName)
      ));
    }

    try {
      // 5. Fetch the ONE target Job from MongoDB to track progress & stats
      const job = await Job.findOne({ jobId: targetJobId });
      if (!job || ['completed', 'failed', 'cancelled'].includes(job.status)) {
        console.warn(`🗑️ Job ${targetJobId} is inactive/deleted. Discarding ${assignedBullFrames.length} stale frames from queue.`);
        // ACK frames to remove them from the queue permanently
        await Promise.all(assignedBullFrames.map(f =>
          ackFrame(f.bullJobId, f.lockToken, f.queueName)
        ));
        
        // Launch asynchronous sweeping to aggressively slaughter all ghost frames from this job globally
        purgeJobFromAllQueues(targetJobId).catch(err => console.error('Failed to aggressively purge ghost frames:', err));

        // Return null so the node immediately polls again without error
        res.json({ jobId: null });
        return;
      }

      // Build array of extracted frame indices
      const assignedFrames = assignedBullFrames.map(f => f.frame);

      // Resolve extension based on job settings
      let extension = 'png';
      if (job.settings?.outputFormat) {
        const format = job.settings.outputFormat.toUpperCase();
        if (format === 'JPEG' || format === 'JPG') extension = 'jpg';
        else if (format === 'OPEN_EXR' || format === 'EXR') extension = 'exr';
        else if (format === 'TIFF') extension = 'tif';
        else if (format === 'TARGA' || format === 'TGA') extension = 'tga';
        else if (format === 'BMP') extension = 'bmp';
      }

      // Generate S3 upload URLs for each frame
      const frameUploadUrls: Record<number, { uploadUrl: string, s3Key: string }> = {};
      for (const frame of assignedFrames) {
        const { uploadUrl, s3Key } = await s3Service.generateFrameUploadUrl(job.jobId, frame, extension);
        frameUploadUrls[frame] = { uploadUrl, s3Key };
      }

      // Use atomic operations to prevent duplicates
      const updateOp: any = {
        $set: {
          status: 'processing',
          updatedAt: now,
          [`assignedNodes.${nodeId}`]: assignedFrames
        },
        $addToSet: {
          'frames.assigned': { $each: assignedFrames }
        },
        $pullAll: {
          'frames.pending': assignedFrames,
          'frames.failed': assignedFrames
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

      // If this is the start of a rendering session (status was pending), set startedAt
      if (job.status !== 'processing') {
        updateOp.$set.startedAt = now;
        if (job.renderTime === undefined) {
          updateOp.$set.renderTime = 0;
        }
      }

      // Remove any of the newly-assigned frames from the failed list (retry log)
      const reassignedFailedFrames = assignedFrames.filter(f => (job.frames.failed || []).includes(f));
      if (reassignedFailedFrames.length > 0) {
        console.log(`🔄 Retrying ${reassignedFailedFrames.length} previously-failed frame(s): [${reassignedFailedFrames.join(', ')}]`);
      }

      // Execute atomic update
      const result = await Job.findOneAndUpdate(
        { jobId: targetJobId },
        updateOp,
        { new: true }
      );

      if (!result) {
        throw new AppError('Failed to update job status in MongoDB', 500);
      }

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

      const totalFramesCount = result.frames.total;
      const renderedCount = result.frames.rendered.length;
      const jobProgress = Math.round((renderedCount / totalFramesCount) * 100);

      console.log(`📋 Smart assigned ${assignedFrames.length} frames to node ${nodeId} for job ${result.jobId}`);

      // Broadcast updates via WebSocket
      const wsService = getWsService(req);
      if (wsService) {
        wsService.sendToNode(nodeId, {
          type: 'job_assigned',
          jobId: result.jobId,
          frames: assignedFrames,
          blendFileUrl,
          frameUploadUrls,
          settings: result.settings,
          inputType: result.inputType,
          totalFrames: result.frames.total,
          selectedFrames: result.frames.selected || [],
          assignedFramesCount: assignedFrames.length,
          jobProgress
        });

        await wsService.broadcastJobUpdate(result.jobId);
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
        inputType: result.inputType,
        totalFrames: result.frames.total,
        selectedFrames: result.frames.selected || [],
        assignedFramesCount: assignedFrames.length,
        jobProgress,
        nextHeartbeatExpectedIn: 30000,
        fileStructure: {
          blendFile: result.blendFileKey,
          uploadsFolder: `uploads/${result.jobId}/`,
          rendersFolder: `renders/${result.jobId}/`
        }
      });

    } catch (innerError) {
      // CRITICAL: NACK frames so they can be picked up by another node
      await Promise.all(assignedBullFrames.map(f =>
        nackFrame(f.bullJobId, f.lockToken, innerError instanceof Error ? innerError.message : 'Assignment error', f.queueName)
      ));
      throw innerError; // Fall through to main catch block
    }

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

    const newUrlEntry = {
      frame,
      url: downloadUrl,
      s3Key,
      fileSize: fileSize || 0,
      uploadedAt: now
    };

    // Replace if exists, else push
    const existingIndex = job.outputUrls.findIndex((u: any) => u.frame === frame);
    if (existingIndex !== -1) {
      job.outputUrls[existingIndex] = newUrlEntry;
    } else {
      job.outputUrls.push(newUrlEntry);
    }

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
    // Frames that failed and haven't been successfully re-rendered yet
    const stillFailed = job.frames.failed.filter((f: number) => !job.frames.rendered.includes(f)).length;

    // Check if the overall rendering process is "finished" for now
    // (All frames have either succeeded or failed, and none are currently being rendered by any node)
    if ((renderedFrames + stillFailed >= totalFramesToRender) && stillInFlight === 0) {
      const oldStatus = job.status;
      // Determine job status: 'completed' if any frames rendered, 'failed' if all failed.
      if (renderedFrames > 0) {
        job.status = 'completed';
      } else if (stillFailed > 0) {
        job.status = 'failed';
      }
      
      job.completedAt = now;

      // Aggressively purge any remaining frames from BullMQ (e.g. if stillFailed > 0 or ghost frames exist)
      purgeJobFromAllQueues(jobId).catch(err => console.error(`❌ Global Purge Error for job ${jobId}:`, err));

      // Accumulate total render time based on wall-clock duration of the job.
      // We only accumulate if this is the first time the job reaches a final state in this session.
      if (oldStatus !== 'completed' && oldStatus !== 'failed' && oldStatus !== 'cancelled') {
        const sessionStart = job.startedAt || job.createdAt;
        const sessionDurationMs = Math.max(0, now.getTime() - sessionStart.getTime());
        job.renderTime = (job.renderTime || 0) + sessionDurationMs;
      }

      // Calculate total credits distributed across all successfully rendered frames.
      let totalCredits = 0;
      job.frameAssignments.forEach((a: IFrameAssignment) => {
        if (a.status === 'rendered') {
          totalCredits += (a.creditsEarned || 0);
        }
      });
      job.totalCreditsDistributed = totalCredits;

      console.log(`🏁 Rendering process finished for job ${job.jobId}. Status: ${job.status}`);
      console.log(`📊 Rendered: ${renderedFrames}/${totalFramesToRender}, Failed: ${stillFailed}`);
      console.log(`💰 Total credits distributed: ${totalCredits}`);
      console.log(`⏱️ Total Accumulated Render Time: ${Math.round((job.renderTime || 0) / 1000)}s`);
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

      // Update node if it has finished its assigned frames for this job
      if (nodeFrames.length === 0 && (node.currentJob === jobId || !node.currentJob)) {
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

    // ✅ CRITICAL FIX: Re-read the job from the DB to get the TRUE current status.
    // The in-memory `job.status` was loaded at the start of this handler and may be STALE.
    // A concurrent cancelJob() call could have set status='cancelling' in the DB while
    // this frame was being processed. We MUST check the DB value after our save.
    const freshJob = await Job.findOne({ jobId });
    const freshStillInFlight = freshJob?.frames?.assigned?.length ?? 0;
    if (freshJob?.status === 'cancelling' && freshStillInFlight === 0) {
      console.log(`[frameCompleted] Job ${jobId} is cancelling with 0 assigned frames after frame ${frame} — triggering graceful finalize.`);
      const wsSvc = getWsService(req);
      const tempJobService = new JobService(s3Service, wsSvc);
      await tempJobService.syncJobStatus(jobId);
      job.status = 'cancelled';
    }

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
      // 🛡️ FALLBACK ACK: If the node lost its local tracking (due to a heartbeat timeout blip),
      // try to find the job in its likely queue and ACK it anyway to keep BullMQ in sync.
      try {
        const queueName = getQueueName(job.settings.engine, job.settings.device);
        await ackFrame(expectedBullJobId, String(nodeId), queueName);
        // We log it as a recovery success instead of a warning
        console.log(`🛡️  Fallback ACK: Recovered sync for ${expectedBullJobId} in ${queueName}`);
      } catch (err: any) {
        console.warn(`⚠️ Could not ACK ${expectedBullJobId} on node ${nodeId}: ${err.message}`);
      }
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

    // Find or create the frameAssignment record
    let assignment = job.frameAssignments.find(
      (a: IFrameAssignment) => a.frame === frameNum && a.nodeId === nodeId && a.status === 'assigned'
    ) as (IFrameAssignment & { retryCount?: number }) | undefined;

    const currentRetries: number = (assignment as any)?.retryCount ?? 0;
    const nextRetry = currentRetries + 1;
    const shouldRequeue = nextRetry < MAX_FRAME_RETRIES;

    console.log(`⚠️  Frame ${frameNum} failure reported by node ${nodeId} for job ${jobId} (attempt ${nextRetry}/${MAX_FRAME_RETRIES}): ${errorMessage}`);

    // 1. NACK or Requeue the frame in BullMQ
    const expectedBullJobId = `${jobId}-${frameNum}`;
    const node = await Node.findOne({ nodeId });
    const bullJobTarget = node?.activeBullJobIds?.find(bj => bj.id === expectedBullJobId);

    if (bullJobTarget) {
      // If we still have retries, move back to waiting. Otherwise, move to failed.
      await nackFrame(bullJobTarget.id, bullJobTarget.lockToken, errorMessage || 'Frame failed naturally', bullJobTarget.queueName, shouldRequeue);
      await Node.updateOne(
        { nodeId },
        { $pull: { activeBullJobIds: { id: expectedBullJobId } } }
      );
    } else {
      console.warn(`⚠️ Could not find active BullMQ job ${expectedBullJobId} on node ${nodeId} for NACK/Requeue`);
    }

    if (shouldRequeue) {
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
