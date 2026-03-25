import { Job } from '../models/Job';
import { Node } from '../models/Node';
import { FrameAssignment, TileAssignment } from '../models/Frame';
import { v4 as uuidv4 } from 'uuid';


export class JobDistributor {

  /**
   * Create a new render job
   */
  static async createJob(
    projectId: string,
    userId: string,
    blendFileUrl: string,
    blendFileName: string,
    type: 'image' | 'animation',
    settings: any,
    frameRange?: { start: number; end: number },
    tileInfo?: { totalX: number; totalY: number }
  ) {
    const jobId = uuidv4();

    // Calculate total frames
    let totalFrames = 1;
    if (type === 'animation' && frameRange) {
      totalFrames = frameRange.end - frameRange.start + 1;
    }

    // Create job
    const job = new Job({
      jobId,
      projectId,
      userId,
      blendFileUrl,
      blendFileName,
      type,
      settings,
      frames: {
        start: frameRange?.start || 1,
        end: frameRange?.end || 1,
        total: totalFrames,
        rendered: [],
        failed: [],
        pending: type === 'animation' && frameRange
          ? Array.from({ length: totalFrames }, (_, i) => frameRange.start + i)
          : [1] // Default single frame
      },
      tiles: tileInfo ? {
        totalX: tileInfo.totalX,
        totalY: tileInfo.totalY,
        rendered: [] // This should be string[] in your Job model
      } : undefined
    });

    await job.save();

    // Create frame/tile assignments
    if (type === 'animation' && frameRange) {
      await this.createFrameAssignments(jobId, frameRange.start, frameRange.end);
    } else if (type === 'image' && tileInfo) {
      await this.createTileAssignments(jobId, tileInfo.totalX, tileInfo.totalY);
    } else {
      // Single frame
      await this.createFrameAssignments(jobId, 1, 1);
    }

    // Start distribution
    this.distributeJob(jobId);

    return job;
  }

  /**
   * Create frame assignments for animation
   */
  static async createFrameAssignments(jobId: string, start: number, end: number) {
    const assignments = [];

    for (let frame = start; frame <= end; frame++) {
      assignments.push({
        jobId,
        frameNumber: frame,
        nodeId: null,
        status: 'pending'
      });
    }

    await FrameAssignment.insertMany(assignments);
  }

  /**
   * Create tile assignments for image
   */
  static async createTileAssignments(jobId: string, totalX: number, totalY: number) {
    const assignments = [];

    for (let x = 0; x < totalX; x++) {
      for (let y = 0; y < totalY; y++) {
        assignments.push({
          jobId,
          tileX: x,
          tileY: y,
          nodeId: null,
          status: 'pending'
        });
      }
    }

    await TileAssignment.insertMany(assignments);
  }

  /**
   * Distribute job frames/tiles to available nodes
   */
  static async distributeJob(jobId: string) {
    const job = await Job.findOne({ jobId });
    if (!job || job.status === 'completed' || job.status === 'failed') return;

    // Update job status
    if (job.status === 'pending') {
      job.status = 'processing';
      await job.save();
    }

    // Get available nodes
    const availableNodes = await Node.find({
      status: 'online',
      currentJob: { $exists: false }
    });

    if (availableNodes.length === 0) {
      console.log('No available nodes for job:', jobId);
      return;
    }

    // Distribute based on job type
    if (job.type === 'animation') {
      await this.distributeFrames(jobId, availableNodes);
    } else {
      await this.distributeTiles(jobId, availableNodes);
    }
  }

  /**
   * Distribute frames to nodes
   */
  static async distributeFrames(jobId: string, nodes: any[]) {
    // Get pending frames
    const pendingFrames = await FrameAssignment.find({
      jobId,
      status: 'pending'
    }).limit(nodes.length * 5); // Assign 5 frames per node

    // Distribute frames to nodes
    const assignments = new Map<string, number[]>();

    for (let i = 0; i < pendingFrames.length; i++) {
      const nodeIndex = i % nodes.length;
      const node = nodes[nodeIndex];
      const frame = pendingFrames[i];

      // Add null check for frame
      if (!frame) continue;

      // Assign frame to node
      frame.nodeId = node.nodeId;
      frame.status = 'rendering';
      await frame.save();

      // Update assignments map
      if (!assignments.has(node.nodeId)) {
        assignments.set(node.nodeId, []);
      }

      // Add null check for frame.frameNumber
      if (frame.frameNumber !== undefined) {
        assignments.get(node.nodeId)!.push(frame.frameNumber);
      }

      // Update node status
      node.currentJob = jobId;
      await node.save();
    }

    // Update job with assignments
    await Job.findOneAndUpdate(
      { jobId },
      {
        assignedNodes: assignments,
        $set: { updatedAt: new Date() }
      }
    );
  }

  /**
   * Distribute tiles to nodes
   */
  static async distributeTiles(jobId: string, nodes: any[]) {
    // Get pending tiles
    const pendingTiles = await TileAssignment.find({
      jobId,
      status: 'pending'
    }).limit(nodes.length * 2); // Assign 2 tiles per node

    // Distribute tiles to nodes
    const assignments = new Map<string, { x: number, y: number }[]>();

    for (let i = 0; i < pendingTiles.length; i++) {
      const nodeIndex = i % nodes.length;
      const node = nodes[nodeIndex];
      const tile = pendingTiles[i];

      // Add null check for tile
      if (!tile) continue;

      // Assign tile to node
      tile.nodeId = node.nodeId;
      tile.status = 'rendering';
      await tile.save();

      // Update assignments map
      if (!assignments.has(node.nodeId)) {
        assignments.set(node.nodeId, []);
      }

      // Add tile coordinates to assignments
      if (tile.tileX !== undefined && tile.tileY !== undefined) {
        assignments.get(node.nodeId)!.push({ x: tile.tileX, y: tile.tileY });
      }

      // Update node status
      node.currentJob = jobId;
      await node.save();
    }

    // Update job with assignments
    await Job.findOneAndUpdate(
      { jobId },
      {
        assignedNodes: assignments,
        $set: { updatedAt: new Date() }
      }
    );
  }

  /**
   * Handle frame completion
   */
  static async completeFrame(jobId: string, frameNumber: number, nodeId: string, outputUrl: string) {
    // Update frame assignment
    await FrameAssignment.findOneAndUpdate(
      { jobId, frameNumber },
      {
        status: 'completed',
        outputUrl,
        completedAt: new Date()
      }
    );

    // Update job progress
    const job = await Job.findOne({ jobId });
    if (!job) return;

    if (!job.frames.rendered.includes(frameNumber)) {
      job.frames.rendered.push(frameNumber);
    }

    // Calculate progress
    const totalFramesToRender = job.frames.selected && job.frames.selected.length > 0
      ? job.frames.selected.length
      : job.frames.total;
    const renderedFramesCount = job.frames.rendered.length;
    job.progress = Math.round((renderedFramesCount / totalFramesToRender) * 100);

    // Check if job is complete
    if (renderedFramesCount === totalFramesToRender) {
      job.status = 'completed';
      job.completedAt = new Date();
    }

    await job.save();

    // Free up node
    await Node.findOneAndUpdate(
      { nodeId },
      { currentJob: null }
    );

    // Distribute more frames if available
    this.distributeJob(jobId);
  }

  /**
   * Handle tile completion
   */
  static async completeTile(jobId: string, tileX: number, tileY: number, nodeId: string, outputUrl: string) {
    // Update tile assignment
    await TileAssignment.findOneAndUpdate(
      { jobId, tileX, tileY },
      {
        status: 'completed',
        outputUrl,
        completedAt: new Date()
      }
    );

    // Update job progress
    const job = await Job.findOne({ jobId });
    if (!job) return;

    // Create tile identifier string like "0-0", "1-0", etc.
    const tileIdentifier = `${tileX}-${tileY}`;

    if (job.tiles && !job.tiles.rendered.includes(tileIdentifier)) {
      job.tiles.rendered.push(tileIdentifier);
    }

    // Calculate progress for tile-based jobs
    if (job.tiles) {
      const totalTiles = job.tiles.totalX * job.tiles.totalY;
      const renderedTiles = job.tiles.rendered.length;
      job.progress = Math.round((renderedTiles / totalTiles) * 100);

      // Check if job is complete
      if (renderedTiles === totalTiles) {
        job.status = 'completed';
        job.completedAt = new Date();
      }
    }

    await job.save();

    // Free up node
    await Node.findOneAndUpdate(
      { nodeId },
      { currentJob: null }
    );

    // Distribute more tiles if available
    this.distributeJob(jobId);
  }

  /**
   * Handle frame failure
   */
  static async failFrame(jobId: string, frameNumber: number, nodeId: string, error: string) {
    // Update frame assignment
    await FrameAssignment.findOneAndUpdate(
      { jobId, frameNumber },
      {
        status: 'failed',
        error,
        completedAt: new Date()
      }
    );

    // Update job
    const job = await Job.findOne({ jobId });
    if (job) {
      if (!job.frames.failed.includes(frameNumber)) {
        job.frames.failed.push(frameNumber);
      }
      await job.save();
    }

    // Free up node
    await Node.findOneAndUpdate(
      { nodeId },
      { currentJob: null }
    );

    // Retry frame
    setTimeout(() => {
      this.retryFrame(jobId, frameNumber);
    }, 5000);
  }

  /**
   * Handle tile failure
   */
  static async failTile(jobId: string, tileX: number, tileY: number, nodeId: string, error: string) {
    // Update tile assignment
    await TileAssignment.findOneAndUpdate(
      { jobId, tileX, tileY },
      {
        status: 'failed',
        error,
        completedAt: new Date()
      }
    );

    // Update job
    const job = await Job.findOne({ jobId });
    if (job && job.tiles) {
      // You might want to track failed tiles separately
      await job.save();
    }

    // Free up node
    await Node.findOneAndUpdate(
      { nodeId },
      { currentJob: null }
    );

    // Retry tile
    setTimeout(() => {
      this.retryTile(jobId, tileX, tileY);
    }, 5000);
  }

  /**
   * Retry failed frame
   */
  static async retryFrame(jobId: string, frameNumber: number) {
    await FrameAssignment.findOneAndUpdate(
      { jobId, frameNumber, status: 'failed' },
      {
        status: 'pending',
        nodeId: null,
        error: null
      }
    );

    this.distributeJob(jobId);
  }

  /**
   * Retry failed tile
   */
  static async retryTile(jobId: string, tileX: number, tileY: number) {
    await TileAssignment.findOneAndUpdate(
      { jobId, tileX, tileY, status: 'failed' },
      {
        status: 'pending',
        nodeId: null,
        error: null
      }
    );

    this.distributeJob(jobId);
  }

  /**
   * Get job progress
   */
  static async getJobProgress(jobId: string) {
    const job = await Job.findOne({ jobId });
    if (!job) return null;

    if (job.type === 'animation') {
      // Get frame assignments status
      const frameAssignments = await FrameAssignment.find({ jobId });
      const pending = frameAssignments.filter(f => f.status === 'pending').length;
      const rendering = frameAssignments.filter(f => f.status === 'rendering').length;
      const completed = frameAssignments.filter(f => f.status === 'completed').length;
      const failed = frameAssignments.filter(f => f.status === 'failed').length;

      return {
        jobId,
        type: 'animation',
        total: job.frames.total,
        pending,
        rendering,
        completed,
        failed,
        progress: job.progress || 0,
        status: job.status
      };
    } else {
      // Get tile assignments status
      const tileAssignments = await TileAssignment.find({ jobId });
      const pending = tileAssignments.filter(t => t.status === 'pending').length;
      const rendering = tileAssignments.filter(t => t.status === 'rendering').length;
      const completed = tileAssignments.filter(t => t.status === 'completed').length;
      const failed = tileAssignments.filter(t => t.status === 'failed').length;

      return {
        jobId,
        type: 'image',
        total: job.tiles ? job.tiles.totalX * job.tiles.totalY : 0,
        pending,
        rendering,
        completed,
        failed,
        progress: job.progress || 0,
        status: job.status
      };
    }
  }

  /**
   * Cancel a job
   */
  static async cancelJob(jobId: string) {
    const job = await Job.findOne({ jobId });
    if (!job) return false;

    // Update job status - use 'failed' since 'cancelled' isn't in your status enum
    job.status = 'failed';
    await job.save();

    // Free all nodes assigned to this job
    let nodeIds: string[] = [];
    if (job.assignedNodes instanceof Map) {
      nodeIds = Array.from(job.assignedNodes.keys());
    } else if (typeof job.assignedNodes === 'object' && job.assignedNodes !== null) {
      nodeIds = Object.keys(job.assignedNodes);
    }

    if (nodeIds.length > 0) {
      await Node.updateMany(
        { nodeId: { $in: nodeIds } },
        { currentJob: null }
      );
    }

    // Reset all frame/tile assignments
    if (job.type === 'animation') {
      await FrameAssignment.updateMany(
        { jobId, status: 'rendering' },
        {
          status: 'pending',
          nodeId: null
        }
      );
    } else {
      await TileAssignment.updateMany(
        { jobId, status: 'rendering' },
        {
          status: 'pending',
          nodeId: null
        }
      );
    }

    return true;
  }
}