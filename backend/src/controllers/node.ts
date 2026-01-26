import { Request, Response } from 'express';
import { Node } from '../models/Node';
import { Job, IFrameAssignment } from '../models/Job';
import { AppError } from '../middleware/error';
import { S3Service } from '../services/S3Service';

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
        const totalFrames = job.frames.total;
        const renderedFrames = job.frames.rendered.length;
        const failedFrames = job.frames.failed.length;
        
        if (renderedFrames + failedFrames === totalFrames) {
          job.status = renderedFrames > 0 ? 'completed' : 'failed';
          if (job.status === 'completed') {
            job.completedAt = new Date();
          }
        }
        
        job.progress = Math.round((renderedFrames / totalFrames) * 100);
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
      const nodeInfo = req.body;
      const nodeId = nodeInfo.nodeId || `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();
      
      const existingNode = await Node.findOne({ nodeId });
      
      if (existingNode) {
        // Update existing node
        existingNode.status = existingNode.currentJob ? 'busy' : 'online';
        existingNode.lastHeartbeat = now;
        existingNode.updatedAt = now;
        existingNode.connectionCount = (existingNode.connectionCount || 0) + 1;
        existingNode.lastStatusChange = existingNode.status !== 'online' && existingNode.status !== 'busy' ? now : existingNode.lastStatusChange;
        
        if (nodeInfo.hardware) existingNode.hardware = { ...existingNode.hardware, ...nodeInfo.hardware };
        if (nodeInfo.capabilities) existingNode.capabilities = { ...existingNode.capabilities, ...nodeInfo.capabilities };
        
        // Initialize performance tracking if not exists
        if (!existingNode.performance) {
          existingNode.performance = {
            framesRendered: 0,
            totalRenderTime: 0,
            avgFrameTime: 0,
            reliabilityScore: 1.0,
            lastUpdated: now
          };
        }
        
        await existingNode.save();
        
        console.log(`🔄 Node reconnected: ${nodeId} (status: ${existingNode.status})`);
        
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
          name: nodeInfo.name || `Node-${nodeId.substring(0, 8)}`,
          status: 'online',
          os: nodeInfo.os || 'Unknown',
          hardware: nodeInfo.hardware || {
            cpuCores: 1,
            cpuScore: 1000,
            gpuName: 'Unknown',
            gpuVRAM: 0,
            gpuScore: 0,
            ramGB: 8,
            blenderVersion: 'unknown'
          },
          capabilities: nodeInfo.capabilities || {
            supportedEngines: ['CYCLES', 'EEVEE'],
            supportedGPUs: ['CUDA', 'OPTIX'],
            maxSamples: 4096,
            maxResolutionX: 7680,
            maxResolutionY: 4320,
            supportsTiles: true
          },
          performance: {
            framesRendered: 0,
            totalRenderTime: 0,
            avgFrameTime: 0,
            reliabilityScore: 1.0,
            lastUpdated: now
          },
          ipAddress: nodeInfo.ipAddress || '127.0.0.1',
          lastHeartbeat: now,
          lastStatusChange: now,
          connectionCount: 1,
          jobsCompleted: 0,
          createdAt: now,
          updatedAt: now
        });
        
        await node.save();
        
        console.log('✅ Node registered:', nodeId);
        
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

  // Heartbeat endpoint with performance tracking
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
          
          // Check if node still has pending frames
          const pendingFrames = assignedFrames.filter(frame => 
            !job.frames.rendered.includes(frame) && !job.frames.failed.includes(frame)
          );
          
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
        
        if (node.resourceHistory.length > 10) {
          node.resourceHistory = node.resourceHistory.slice(-10);
        }
      }
      
      if (heartbeatData.currentJob && heartbeatData.progress !== undefined) {
        node.currentJob = heartbeatData.currentJob;
        node.set('currentProgress', heartbeatData.progress);
      }
      
      // Update performance metrics if frame render time is provided
      if (heartbeatData.lastFrameTime && node.performance) {
        const framesRendered = (node.performance.framesRendered || 0) + 1;
        const totalTime = (node.performance.totalRenderTime || 0) + heartbeatData.lastFrameTime;
        
        node.performance.framesRendered = framesRendered;
        node.performance.totalRenderTime = totalTime;
        node.performance.avgFrameTime = totalTime / framesRendered;
        node.performance.lastUpdated = now;
        
        // Update reliability score (simple implementation)
        if (heartbeatData.frameSuccess === true) {
          node.performance.reliabilityScore = Math.min(1.0, (node.performance.reliabilityScore || 1.0) * 1.01);
        } else if (heartbeatData.frameSuccess === false) {
          node.performance.reliabilityScore = Math.max(0.1, (node.performance.reliabilityScore || 1.0) * 0.9);
        }
      }
      
      await node.save();
      
      console.log(`💓 Heartbeat from ${nodeId}: ${node.status} (${now.toISOString()})`);
      
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
              pendingAssignedFrames.push(frame);
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
        
        // Get frames that need to be rendered
        const pendingFrames: number[] = [];
        for (let frame = job.frames.start; frame <= job.frames.end; frame++) {
          if (!job.frames.rendered.includes(frame) && 
              !job.frames.failed.includes(frame) &&
              !job.frames.assigned.includes(frame)) {
            pendingFrames.push(frame);
          }
        }
        
        if (pendingFrames.length === 0) {
          // Check if all frames are rendered
          if (job.frames.rendered.length === job.frames.total) {
            job.status = 'completed';
            job.completedAt = now;
            job.progress = 100;
            await job.save();
            console.log(`✅ Job ${job.jobId} completed automatically`);
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
        const result = await Job.findOneAndUpdate(
          { 
            jobId: job.jobId,
            'frames.assigned': { $nin: assignedFrames }
          },
          {
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
          },
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
        
        res.json({
          jobId: result.jobId,
          frames: assignedFrames,
          blendFileUrl,
          frameUploadUrls,
          settings: result.settings,
          totalFrames: result.frames.total,
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

  // New endpoint for frame completion with credits tracking
// New endpoint for frame completion with credits tracking
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
    
    // Update output URLs - use correct method name
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
    if (renderedFrames === totalFrames) {
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

  // Get all nodes (unchanged)
  static async getAllNodes(req: Request, res: Response): Promise<void> {
    try {
      await this.checkAndUpdateOfflineNodes();
      
      const nodes = await Node.find().sort({ createdAt: -1 });
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
              assigned: assignedFrames.length
            },
            creditsEarned: totalCreditsEarned,
            settings: job.settings
          };
        }
      }
      
      const lastHeartbeatAge = Date.now() - new Date(node.lastHeartbeat).getTime();
      const isActuallyOnline = lastHeartbeatAge <= HEARTBEAT_TIMEOUT_MS;
      
      res.json({
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
        updatedAt: node.updatedAt
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
      const nodes = await Node.find();
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
}