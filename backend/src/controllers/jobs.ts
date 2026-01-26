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
        framesPerNode = 1,
        // Image rendering specific parameters
        denoiser = 'OPTIX', // 'NONE', 'OPTIX', 'OPENIMAGEDENOISE', 'NLM'
        tileSize = 256,
        outputFormat = 'PNG' // 'PNG', 'JPEG', 'EXR', 'TIFF'
      } = req.body;
      
      const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Calculate total frames
      let totalFrames = 1; // Default for image
      if (type === 'animation') {
        totalFrames = parseInt(endFrame as string) - parseInt(startFrame as string) + 1;
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
          outputFormat
        },
        frames: {
          start: type === 'animation' ? parseInt(startFrame as string) : 1,
          end: type === 'animation' ? parseInt(endFrame as string) : 1,
          total: totalFrames,
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
        console.log(`🖼️  Image settings: ${resolutionX}x${resolutionY}, ${samples} samples, ${denoiser} denoiser`);
      }
      
      res.json({
        success: true,
        jobId: job.jobId,
        message: 'Job created successfully',
        type: job.type,
        totalFrames: job.frames.total,
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
      
      // Update frame status using atomic operation
      const updatedJob = await Job.findOneAndUpdate(
        { 
          jobId,
          'frames.rendered': { $ne: frameNumber }
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
            'frames.failed': frameNumber,
            'frames.assigned': frameNumber
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

  // Report frame failure (updated for S3)
  static async failFrame(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const { frame, nodeId, error: errorMessage, s3Key } = req.body;
      
      const job = await Job.findOne({ jobId });
      if (!job) {
        throw new AppError('Job not found', 404);
      }
      
      const frameNumber = parseInt(frame as string);
      
      // Add to failed frames
      if (!job.frames.failed.includes(frameNumber)) {
        job.frames.failed.push(frameNumber);
      }
      
      // Remove from rendered and assigned if it was there
      job.frames.rendered = job.frames.rendered.filter(f => f !== frameNumber);
      job.frames.assigned = job.frames.assigned.filter(f => f !== frameNumber);
      
      // Remove from assigned nodes
      const assignedNodesMap = job.assignedNodes as unknown as Map<string, number[]>;
      const nodeFrames = assignedNodesMap?.get(nodeId) || [];
      const updatedNodeFrames = nodeFrames.filter(f => f !== frameNumber);
      
      if (updatedNodeFrames.length === 0) {
        assignedNodesMap?.delete(nodeId);
      } else {
        assignedNodesMap?.set(nodeId, updatedNodeFrames);
      }
      
      // Update progress
      const totalFrames = job.frames.total;
      const renderedFrames = job.frames.rendered.length;
      const failedFrames = job.frames.failed.length;
      job.progress = Math.round((renderedFrames / totalFrames) * 100);
      
      // Check if all frames failed
      if (failedFrames === totalFrames) {
        job.status = 'failed';
      } else if (renderedFrames + failedFrames === totalFrames) {
        job.status = 'failed';
      } else {
        job.status = 'processing';
      }
      
      job.updatedAt = new Date();
      await job.save();
      
      console.log(`❌ Frame ${frame} failed for job ${jobId} by node ${nodeId}: ${errorMessage}`);
      
      res.json({ 
        success: true, 
        message: 'Frame failure recorded',
        progress: job.progress,
        status: job.status,
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
          pending: pendingFrames
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
          failed: job.frames.failed.length
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
  
  // Health check endpoint
  static async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      // Test S3 connection using the new method
      const bucketInfo = s3Service.getBucketInfo();
      
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        s3: {
          bucketName: bucketInfo.bucketName,
          region: bucketInfo.region,
          publicUrlBase: bucketInfo.publicUrlBase,
          status: 'connected'
        }
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