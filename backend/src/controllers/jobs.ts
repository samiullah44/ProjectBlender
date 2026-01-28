import { Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { Job } from '../models/Job';
import { Node } from '../models/Node';
import { AppError } from '../middleware/error';
import { S3Service } from '../services/S3Service';

const s3Service = new S3Service();

// Configure multer for memory storage
const storage = multer.memoryStorage();
export const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }
});

export class JobController {
  // Get WebSocket service from app
  private static getWsService(req: Request) {
    return req.app.get('wsService');
  }

  // Create job from blend file upload with S3 integration
  static async createJob(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError('No file uploaded', 400);
      }
      
      const { 
        projectId = 'default-project',
        userId = 'default-user',
        type = 'animation', // 'image' or 'animation'
        engine = 'CYCLES',
        device = 'GPU',
        samples = 128,
        resolutionX = 1920,
        resolutionY = 1080,
        startFrame = 1,
        endFrame = 10,
        selectedFrame = 1, // NEW: For single image rendering - selected frame
        framesPerNode = 1,
        // Image rendering specific parameters
        denoiser = 'OPTIX', // 'NONE', 'OPTIX', 'OPENIMAGEDENOISE', 'NLM'
        tileSize = 256,
        outputFormat = 'PNG' // 'PNG', 'JPEG', 'EXR', 'TIFF'
      } = req.body;
      
      const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Calculate total frames
      let totalFrames = 1; // Default for image
      let selectedFrames: number[] = [];
      
      if (type === 'animation') {
        totalFrames = parseInt(endFrame as string) - parseInt(startFrame as string) + 1;
        selectedFrames = Array.from({ length: totalFrames }, (_, i) => parseInt(startFrame as string) + i);
      } else if (type === 'image') {
        // For image rendering, use the selected frame or default to frame 1
        const frame = parseInt(selectedFrame as string) || 1;
        totalFrames = 1;
        selectedFrames = [frame];
      }
      
      // Upload blend file to S3 in uploads folder using the new method
      const blendFileKey = await s3Service.uploadBlendFile(req.file, jobId);
      const blendFileUrl = await s3Service.generateBlendFileDownloadUrl(blendFileKey);
      
      const job = new Job({
        jobId,
        projectId,
        userId,
        blendFileKey, // Store S3 key (uploads/{jobId}/filename.blend)
        blendFileUrl, // Store pre-signed URL
        blendFileName: req.file.originalname,
        type: type as 'image' | 'animation',
        settings: {
          engine,
          device,
          samples: parseInt(samples as string),
          resolutionX: parseInt(resolutionX as string),
          resolutionY: parseInt(resolutionY as string),
          tileSize: parseInt(tileSize as string),
          denoiser: type === 'image' ? denoiser : undefined,
          outputFormat,
          selectedFrame: type === 'image' ? parseInt(selectedFrame as string) || 1 : undefined
        },
        frames: {
          start: type === 'animation' ? parseInt(startFrame as string) : (parseInt(selectedFrame as string) || 1),
          end: type === 'animation' ? parseInt(endFrame as string) : (parseInt(selectedFrame as string) || 1),
          total: totalFrames,
          selected: selectedFrames, // NEW: Store which frames are selected
          rendered: [],
          failed: [],
          assigned: []
        },
        assignedNodes: new Map(),
        status: 'pending',
        progress: 0,
        outputUrls: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await job.save();
      
      console.log(`🎬 New ${type} job created: ${jobId} with ${totalFrames} frame${totalFrames > 1 ? 's' : ''}`);
      console.log(`📁 Blend file uploaded to S3: ${blendFileKey}`);
      if (type === 'image') {
        console.log(`🖼️  Image settings: ${resolutionX}x${resolutionY}, ${samples} samples, ${denoiser} denoiser, Frame: ${selectedFrame}`);
      }
      
      // Broadcast new job creation via WebSocket
      const wsService = JobController.getWsService(req);
      if (wsService) {
        wsService.broadcastSystemUpdate({
          type: 'job_created',
          data: { 
            jobId: job.jobId, 
            type: job.type, 
            status: job.status,
            blendFileName: job.blendFileName,
            totalFrames: job.frames.total
          }
        });
      }
      
      res.json({
        success: true,
        jobId: job.jobId,
        message: 'Job created successfully',
        type: job.type,
        totalFrames: job.frames.total,
        selectedFrames: job.frames.selected, // NEW: Return selected frames
        blendFileUrl: job.blendFileUrl,
        settings: job.settings,
        fileStructure: {
          blendFile: blendFileKey,
          uploadsFolder: `uploads/${jobId}/`,
          rendersFolder: `renders/${jobId}/`
        }
      });
      
    } catch (error) {
      console.error('Job creation error:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({ 
          error: error.message
        });
      } else {
        res.status(500).json({ 
          error: 'Failed to create job',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // Generate pre-signed URL for node to upload rendered frame directly to S3
  static async generateFrameUploadUrl(req: Request, res: Response): Promise<void> {
    try {
      const { jobId, frame } = req.params;
      
      if (typeof jobId !== 'string' || !jobId.trim()) {
        throw new AppError('Invalid job ID', 400);
      }
      
      const frameNumber = parseInt(frame as string);
      
      if (isNaN(frameNumber) || !Number.isInteger(frameNumber) || frameNumber < 1) {
        throw new AppError('Frame must be a positive integer', 400);
      }
      
      // Generate pre-signed URL for node to upload directly to S3 using the new method
      const { uploadUrl, s3Key } = await s3Service.generateFrameUploadUrl(jobId, frameNumber);
      
      res.json({
        success: true,
        uploadUrl,
        s3Key,
        frame: frameNumber,
        expiresIn: 3600,
        fileStructure: {
          s3Key: s3Key,
          rendersFolder: `renders/${jobId}/`,
          fileName: `frame_${frameNumber.toString().padStart(4, '0')}.png`
        }
      });
      
    } catch (error) {
      console.error('Generate upload URL error:', error);
      res.status(500).json({
        error: 'Failed to generate upload URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Report frame completion (no file upload - file goes directly to S3)
  static async completeFrame(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const { frame, nodeId, renderTime, fileSize, s3Key } = req.body;
      
      const job = await Job.findOne({ jobId });
      if (!job) {
        throw new AppError('Job not found', 404);
      }
      
      const frameNumber = parseInt(frame as string);
      
      // Check if frame is already rendered
      if (job.frames.rendered.includes(frameNumber)) {
        res.json({ 
          success: true, 
          message: 'Frame already recorded as completed',
          progress: job.progress,
          status: job.status
        });
        return;
      }
      
      // Generate download URL for the rendered frame using the new method
      const downloadUrl = await s3Service.generateFrameDownloadUrl(s3Key as string);
      
      // Update frame status using atomic operation - ensure frame is removed from failed/assigned when completed
      const updatedJob = await Job.findOneAndUpdate(
        { 
          jobId,
          'frames.rendered': { $ne: frameNumber } // Only update if not already rendered
        },
        {
          $addToSet: {
            'frames.rendered': frameNumber,
            'outputUrls': {
              frame: frameNumber,
              url: downloadUrl,
              s3Key: s3Key,
              fileSize: fileSize,
              uploadedAt: new Date()
            }
          },
          $pull: {
            'frames.failed': frameNumber,    // Remove from failed if it was there
            'frames.assigned': frameNumber   // Remove from assigned
          },
          $set: {
            updatedAt: new Date()
          }
        },
        { new: true }
      );
      
      if (!updatedJob) {
        throw new AppError('Failed to update frame status', 500);
      }
      
      // Remove frame from assigned nodes
      const assignedNodesMap = updatedJob.assignedNodes as unknown as Map<string, number[]>;
      const nodeFrames = assignedNodesMap?.get(nodeId) || [];
      const updatedNodeFrames = nodeFrames.filter(f => f !== frameNumber);
      
      let isNodeDone = false;
      
      if (updatedNodeFrames.length === 0) {
        assignedNodesMap?.delete(nodeId);
        isNodeDone = true;
      } else {
        assignedNodesMap?.set(nodeId, updatedNodeFrames);
      }
      
      // Calculate progress
      const totalFrames = updatedJob.frames.total;
      const renderedFrames = updatedJob.frames.rendered.length;
      const failedFrames = updatedJob.frames.failed.length;
      const progress = Math.round((renderedFrames / totalFrames) * 100);
      
      // Update job status
      let status = updatedJob.status;
      if (renderedFrames === totalFrames) {
        status = 'completed';
        updatedJob.completedAt = new Date();
        console.log(`🎉 Job ${jobId} completed! All ${totalFrames} frames rendered.`);
        
        // Mark all nodes that worked on this job as online
        const allNodeIds = Array.from(assignedNodesMap.keys());
        if (allNodeIds.length > 0) {
          await Node.updateMany(
            { nodeId: { $in: allNodeIds } },
            { 
              $set: { 
                status: 'online',
                currentJob: undefined,
                currentProgress: undefined,
                updatedAt: new Date()
              }
            }
          );
          console.log(`🔄 Marked ${allNodeIds.length} nodes as online after job completion`);
        }
      } else if (renderedFrames + failedFrames === totalFrames) {
        status = 'failed';
      } else {
        status = 'processing';
      }
      
      // Save updates
      updatedJob.status = status;
      updatedJob.progress = progress;
      updatedJob.assignedNodes = assignedNodesMap as any;
      await updatedJob.save();
      
      // Update node status if it's done
      if (isNodeDone) {
        await Node.updateOne(
          { nodeId },
          {
            $set: {
              status: 'online',
              currentJob: undefined,
              currentProgress: undefined,
              updatedAt: new Date()
            },
            $inc: { jobsCompleted: 1 }
          }
        );
        console.log(`🔄 Node ${nodeId} marked as online (all frames completed)`);
      }
      
      console.log(`✅ Frame ${frame} completed for job ${jobId} by node ${nodeId} (Progress: ${progress}%)`);
      console.log(`📁 Frame stored at: ${s3Key}`);
      
      // Broadcast job update via WebSocket
      const wsService = JobController.getWsService(req);
      if (wsService) {
        await wsService.broadcastJobUpdate(jobId);
        
        // Also broadcast node update
        wsService.broadcastNodeUpdate(nodeId, {
          status: isNodeDone ? 'online' : 'busy',
          currentJob: isNodeDone ? undefined : updatedJob.jobId,
          jobsCompleted: isNodeDone ? 1 : 0,
          lastUpdate: new Date().toISOString()
        });
      }
      
      res.json({ 
        success: true, 
        message: 'Frame completion recorded',
        progress: progress,
        status: status,
        renderedFrames: renderedFrames,
        totalFrames: totalFrames,
        frameUrl: downloadUrl,
        s3Key: s3Key,
        remainingFrames: updatedNodeFrames.length,
        isNodeDone: isNodeDone
      });
      
    } catch (error) {
      console.error('Complete frame error:', error);
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

  // Report frame failure (updated for S3) - Fixed to prevent race conditions
  static async failFrame(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const { frame, nodeId, error: errorMessage, s3Key } = req.body;
      
      const job = await Job.findOne({ jobId });
      if (!job) {
        throw new AppError('Job not found', 404);
      }
      
      const frameNumber = parseInt(frame as string);
      
      // Check if frame is already rendered - don't mark as failed if it's already completed
      if (job.frames.rendered.includes(frameNumber)) {
        res.json({ 
          success: true, 
          message: 'Frame already completed, not marking as failed',
          progress: job.progress,
          status: job.status
        });
        return;
      }
      
      // Use atomic operation to prevent race conditions
      const updatedJob = await Job.findOneAndUpdate(
        { 
          jobId,
          'frames.rendered': { $ne: frameNumber }, // Only update if not already rendered
          'frames.failed': { $ne: frameNumber }    // Only update if not already failed
        },
        {
          $addToSet: {
            'frames.failed': frameNumber
          },
          $pull: {
            'frames.assigned': frameNumber   // Remove from assigned
          },
          $set: {
            updatedAt: new Date()
          }
        },
        { new: true }
      );
      
      if (!updatedJob) {
        // Frame was already processed or doesn't exist
        res.json({ 
          success: true, 
          message: 'Frame already processed or job not found',
          progress: job.progress,
          status: job.status
        });
        return;
      }
      
      // Remove frame from assigned nodes
      const assignedNodesMap = updatedJob.assignedNodes as unknown as Map<string, number[]>;
      const nodeFrames = assignedNodesMap?.get(nodeId) || [];
      const updatedNodeFrames = nodeFrames.filter(f => f !== frameNumber);
      
      if (updatedNodeFrames.length === 0) {
        assignedNodesMap?.delete(nodeId);
      } else {
        assignedNodesMap?.set(nodeId, updatedNodeFrames);
      }
      
      // Update progress and status
      const totalFrames = updatedJob.frames.total;
      const renderedFrames = updatedJob.frames.rendered.length;
      const failedFrames = updatedJob.frames.failed.length;
      const progress = Math.round((renderedFrames / totalFrames) * 100);
      
      let status = updatedJob.status;
      if (failedFrames === totalFrames) {
        status = 'failed';
      } else if (renderedFrames + failedFrames === totalFrames) {
        status = 'failed';
      } else {
        status = 'processing';
      }
      
      // Save updates
      updatedJob.status = status;
      updatedJob.progress = progress;
      updatedJob.assignedNodes = assignedNodesMap as any;
      await updatedJob.save();
      
      console.log(`❌ Frame ${frame} failed for job ${jobId} by node ${nodeId}: ${errorMessage}`);
      
      // Broadcast job update via WebSocket
      const wsService = JobController.getWsService(req);
      if (wsService) {
        await wsService.broadcastJobUpdate(jobId);
      }
      
      res.json({ 
        success: true, 
        message: 'Frame failure recorded',
        progress: progress,
        status: status,
        s3Key: s3Key
      });
      
    } catch (error) {
      console.error('Fail frame error:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({ 
          error: error.message
        });
      } else {
        res.status(500).json({ 
          error: 'Failed to record frame failure',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // Get job details with S3 URLs
  static async getJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      
      const job = await Job.findOne({ jobId });
      
      if (!job) {
        throw new AppError('Job not found', 404);
      }
      
      // Generate fresh download URL for blend file using the new method
      const blendFileUrl = await s3Service.generateBlendFileDownloadUrl(job.blendFileKey);
      
      // Calculate pending frames
      const totalFrames = job.frames.total;
      const renderedFrames = job.frames.rendered.length;
      const failedFrames = job.frames.failed.length;
      const pendingFrames = totalFrames - renderedFrames - failedFrames;
      
      // Generate fresh URLs for all rendered frames using the new method
      const outputUrlsWithFreshUrls = await Promise.all(
        job.outputUrls.map(async (output) => ({
          ...output,
          freshUrl: await s3Service.generateFrameDownloadUrl(output.s3Key)
        }))
      );
      
      res.json({
        jobId: job.jobId,
        projectId: job.projectId,
        userId: job.userId,
        blendFileName: job.blendFileName,
        blendFileUrl: blendFileUrl,
        type: job.type,
        settings: job.settings,
        status: job.status,
        progress: job.progress,
        frames: {
          start: job.frames.start,
          end: job.frames.end,
          total: totalFrames,
          rendered: renderedFrames,
          failed: failedFrames,
          pending: pendingFrames,
          selected: job.frames.selected || [] // NEW: Include selected frames
        },
        outputUrls: outputUrlsWithFreshUrls,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        completedAt: job.completedAt,
        fileStructure: {
          blendFile: job.blendFileKey,
          uploadsFolder: `uploads/${job.jobId}/`,
          rendersFolder: `renders/${job.jobId}/`
        }
      });
      
    } catch (error) {
      console.error('Get job error:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({ 
          error: error.message
        });
      } else {
        res.status(500).json({ 
          error: 'Failed to get job status',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // Cancel job (with optional S3 cleanup)
  static async cancelJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const { cleanupS3 = false } = req.body;
      
      const job = await Job.findOne({ jobId });
      
      if (!job) {
        throw new AppError('Job not found', 404);
      }
      
      // Only allow cancelling if job is pending or processing
      if (job.status === 'completed' || job.status === 'failed') {
        throw new AppError('Cannot cancel a completed or failed job', 400);
      }
      
      job.status = 'cancelled';
      job.updatedAt = new Date();
      await job.save();
      
      console.log(`❌ Cancelled job: ${jobId}`);
      
      // Broadcast job update via WebSocket
      const wsService = JobController.getWsService(req);
      if (wsService) {
        await wsService.broadcastJobUpdate(jobId);
      }
      
      // Optional: Clean up S3 files
      if (cleanupS3) {
        try {
          // Delete blend file using the new method
          await s3Service.deleteFile(job.blendFileKey);
          
          // Delete rendered frames
          for (const output of job.outputUrls) {
            await s3Service.deleteFile(output.s3Key);
          }
          
          console.log(`🗑️  Cleaned up S3 files for job ${jobId}`);
        } catch (s3Error) {
          console.error('Failed to cleanup S3 files:', s3Error);
          // Don't fail the cancellation if S3 cleanup fails
        }
      }
      
      res.json({ 
        success: true, 
        message: 'Job cancelled successfully',
        cleanupPerformed: cleanupS3
      });
      
    } catch (error) {
      console.error('Cancel job error:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({ 
          error: error.message
        });
      } else {
        res.status(500).json({ 
          error: 'Failed to cancel job',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // List all jobs
  static async listJobs(req: Request, res: Response): Promise<void> {
    try {
      const { projectId, status, limit = '50', page = '1' } = req.query;
      
      const query: any = {};
      if (projectId) query.projectId = projectId;
      if (status) query.status = status;
      
      const limitNum = parseInt(limit as string);
      const pageNum = parseInt(page as string);
      const skip = (pageNum - 1) * limitNum;
      
      const [jobs, total] = await Promise.all([
        Job.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum),
        Job.countDocuments(query)
      ]);
      
      const simplifiedJobs = jobs.map(job => ({
        jobId: job.jobId,
        projectId: job.projectId,
        status: job.status,
        type: job.type,
        progress: job.progress,
        blendFileName: job.blendFileName,
        frames: {
          total: job.frames.total,
          rendered: job.frames.rendered.length,
          failed: job.frames.failed.length,
          selected: job.frames.selected || [] // NEW: Include selected frames
        },
        outputCount: job.outputUrls.length,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        fileStructure: {
          uploadsFolder: `uploads/${job.jobId}/`,
          rendersFolder: `renders/${job.jobId}/`
        }
      }));
      
      res.json({
        jobs: simplifiedJobs,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum)
        }
      });
      
    } catch (error) {
      console.error('Get jobs error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch jobs',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // NEW: Select specific frame(s) for rendering (for image type)
  static async selectFrames(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const { frames } = req.body; // Array of frame numbers to render
      
      if (!Array.isArray(frames) || frames.length === 0) {
        throw new AppError('Frames must be a non-empty array', 400);
      }
      
      const job = await Job.findOne({ jobId });
      if (!job) {
        throw new AppError('Job not found', 404);
      }
      
      // Validate frames are within range
      const minFrame = job.frames.start;
      const maxFrame = job.frames.end;
      
      for (const frame of frames) {
        const frameNum = parseInt(frame);
        if (isNaN(frameNum) || frameNum < minFrame || frameNum > maxFrame) {
          throw new AppError(`Frame ${frame} is out of range (${minFrame}-${maxFrame})`, 400);
        }
      }
      
      // Update selected frames
      job.frames.selected = frames;
      job.frames.total = frames.length;
      job.updatedAt = new Date();
      
      // Remove any rendered/failed frames that are no longer selected
      job.frames.rendered = job.frames.rendered.filter(f => frames.includes(f));
      job.frames.failed = job.frames.failed.filter(f => frames.includes(f));
      job.frames.assigned = job.frames.assigned.filter(f => frames.includes(f));
      
      // Clear assigned nodes for frames that are no longer selected
      const assignedNodesMap = job.assignedNodes as unknown as Map<string, number[]>;
      for (const [nodeId, nodeFrames] of assignedNodesMap.entries()) {
        const updatedFrames = nodeFrames.filter(f => frames.includes(f));
        if (updatedFrames.length === 0) {
          assignedNodesMap.delete(nodeId);
        } else {
          assignedNodesMap.set(nodeId, updatedFrames);
        }
      }
      
      // Recalculate progress
      job.progress = Math.round((job.frames.rendered.length / job.frames.total) * 100);
      
      await job.save();
      
      console.log(`🎯 Updated selected frames for job ${jobId}: ${frames.join(', ')}`);
      
      // Broadcast job update via WebSocket
      const wsService = JobController.getWsService(req);
      if (wsService) {
        await wsService.broadcastJobUpdate(jobId);
      }
      
      res.json({
        success: true,
        message: 'Frames updated successfully',
        frames: {
          selected: job.frames.selected,
          total: job.frames.total,
          rendered: job.frames.rendered.length,
          failed: job.frames.failed.length
        }
      });
      
    } catch (error) {
      console.error('Select frames error:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({ 
          error: error.message
        });
      } else {
        res.status(500).json({ 
          error: 'Failed to update frames',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // Dashboard statistics endpoint
  static async getDashboardStats(req: Request, res: Response): Promise<void> {
    try {
      const { userId, startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : new Date();
      start.setHours(0, 0, 0, 0);
      
      const end = endDate ? new Date(endDate as string) : new Date();
      end.setHours(23, 59, 59, 999);
      
      const query: any = { createdAt: { $gte: start, $lte: end } };
      if (userId) query.userId = userId;
      
      // Get job statistics
      const [jobs, activeJobs, completedJobs, failedJobs] = await Promise.all([
        Job.find(query),
        Job.countDocuments({ ...query, status: { $in: ['pending', 'processing'] } }),
        Job.countDocuments({ ...query, status: 'completed' }),
        Job.countDocuments({ ...query, status: 'failed' })
      ]);
      
      // Calculate total render time and credits
      let totalRenderTime = 0;
      let totalCreditsUsed = 0;
      let totalFramesRendered = 0;
      
      jobs.forEach(job => {
        if (job.frameAssignments) {
          job.frameAssignments.forEach((assignment: any) => {
            if (assignment.status === 'rendered' && assignment.renderTime) {
              totalRenderTime += assignment.renderTime;
            }
          });
        }
        
        if (job.outputUrls) {
          totalFramesRendered += job.outputUrls.length;
        }
        
        if (job.totalCreditsDistributed) {
          totalCreditsUsed += job.totalCreditsDistributed;
        }
      });
      
      // Get today's completed jobs
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);
      
      const completedToday = await Job.countDocuments({
        status: 'completed',
        createdAt: { $gte: today, $lte: todayEnd }
      });
      
      res.json({
        success: true,
        stats: {
          totalJobs: jobs.length,
          activeJobs,
          completedJobs,
          failedJobs,
          completedToday,
          totalRenderTime,
          totalCreditsUsed,
          totalFramesRendered,
          avgRenderTimePerFrame: totalFramesRendered > 0 ? totalRenderTime / totalFramesRendered : 0
        },
        timeframe: {
          start,
          end
        }
      });
      
    } catch (error) {
      console.error('Dashboard stats error:', error);
      res.status(500).json({
        error: 'Failed to fetch dashboard statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  // Health check endpoint
  static async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Test S3 connection using the new method
      const bucketInfo = s3Service.getBucketInfo();
      
      // Get WebSocket service stats
      const wsService = JobController.getWsService(req);
      const wsStats = wsService ? {
        connectedClients: wsService.getConnectionCount(),
        activeSubscriptions: wsService.getSubscriptionCount()
      } : { connectedClients: 0, activeSubscriptions: 0 };
      
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        s3: {
          bucketName: bucketInfo.bucketName,
          region: bucketInfo.region,
          publicUrlBase: bucketInfo.publicUrlBase,
          status: 'connected'
        },
        websocket: wsStats
      });
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'S3 connection failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}