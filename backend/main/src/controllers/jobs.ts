// backend/src/controllers/JobController.ts
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { JobService } from '../services/JobService';
import { S3Service } from '../services/S3Service';
import { AppError } from '../middleware/error';
import { CreateJobRequest, JobFilterOptions, PaginationOptions } from '../types/job.types';
import archiver from 'archiver';
import { Job } from '../models/Job';
import { User } from '../models/User';
import { enqueueJobFrames } from '../services/FrameQueueService';
// Removed unused authMiddleware import

export class JobController {
  private jobService: JobService;
  private s3Service: S3Service;

  constructor(jobService: JobService, s3Service: S3Service) {
    this.jobService = jobService;
    this.s3Service = s3Service;
  }

  // Set WebSocket service from app
  private getWsService(req: Request) {
    return req.app.get('wsService');
  }

  // Create new job
  async createJob(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new AppError('Authentication required', 401);
      }

      if (!req.file) {
        throw new AppError('No file uploaded', 400);
      }

      const createJobRequest: CreateJobRequest = {
        blendFile: req.file,
        userId: user.userId,
        projectId: req.body.projectId,
        type: req.body.type || 'animation',
        settings: {
          engine: req.body.engine,
          device: req.body.device,
          samples: parseInt(req.body.samples) || 128,
          resolutionX: parseInt(req.body.resolutionX) || 1920,
          resolutionY: parseInt(req.body.resolutionY) || 1080,
          tileSize: parseInt(req.body.tileSize) || 256,
          denoiser: req.body.denoiser,
          outputFormat: req.body.outputFormat || 'PNG',
          colorMode: req.body.colorMode || 'RGBA',
          colorDepth: req.body.colorDepth || '8',
          compression: (() => {
            const raw = (req.body as any).compression;
            if (raw === undefined || raw === null || raw === '') return 90;
            const n = typeof raw === 'number' ? raw : parseInt(raw, 10);
            if (Number.isNaN(n)) return 90;
            return Math.min(100, Math.max(0, n));
          })(),
          exrCodec: req.body.exrCodec || 'ZIP',
          tiffCodec: req.body.tiffCodec || 'DEFLATE',
          creditsPerFrame: parseFloat(req.body.creditsPerFrame) || 1,
          blenderVersion: req.body.blenderVersion || '4.5.0',
          selectedFrame: parseInt(req.body.selectedFrame)
        },
        startFrame: parseInt(req.body.startFrame) || 1,
        endFrame: parseInt(req.body.endFrame) || 10,
        selectedFrame: parseInt(req.body.selectedFrame) || 1,
        name: req.body.name || req.file.originalname,
        description: req.body.description,
        tags: req.body.tags ? JSON.parse(req.body.tags) : [],
        priority: req.body.priority || 'normal',
        requireApproval: req.body.requireApproval === 'true'
      };

      // Ensure wsService is available on the jobService BEFORE creating the job
      // so the job_created notification reaches connected nodes immediately.
      const wsService = this.getWsService(req);
      if (wsService && !this.jobService['wsService']) {
        this.jobService.setWebSocketService(wsService);
      }

      const result = await this.jobService.createJob(createJobRequest);

      res.status(201).json(result);
    } catch (error) {
      console.error('Job creation error:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to create job',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // Get job by ID
  async getJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const user = (req as any).user;

      if (!user) {
        throw new AppError('Authentication required', 401);
      }

      const job = await this.jobService.getJobById(jobId as string, user.userId, user.role);

      if (!job) {
        throw new AppError('Job not found', 404);
      }

      res.json({
        success: true,
        job
      });
    } catch (error) {
      console.error('Get job error:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to get job',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // Stream all rendered frames for a job as a ZIP archive
  async downloadJobFramesZip(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const user = (req as any).user;

      if (!user) {
        throw new AppError('Authentication required', 401);
      }

      // Large ZIPs can take a long time; disable request/response timeouts.
      // (Note: upstream proxies/load balancers may still impose their own limits.)
      try {
        (req as any).setTimeout?.(0);
        res.setTimeout?.(0);
      } catch {}

      const job = await this.jobService.getJobById(jobId as string, user.userId, user.role);

      if (!job) {
        throw new AppError('Job not found', 404);
      }

      const outputs = job.outputUrls || [];
      const outputsWithKeys = outputs.filter((o: any) => o && o.s3Key);

      if (!outputsWithKeys.length) {
        throw new AppError('No rendered frames available for this job', 400);
      }

      const safeJobId = job.jobId || jobId;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="job_${safeJobId}_frames.zip"`
      );
      res.setHeader('X-Frames-Total', String(outputsWithKeys.length));
      res.setHeader('Cache-Control', 'no-store');

      const archive = archiver('zip', {
        zlib: { level: 0 } // Images are already compressed; avoid extra CPU
      });

      archive.on('error', (err: Error) => {
        console.error('ZIP archive error:', err);
        if (!res.headersSent) {
          res.status(500).end('Failed to generate ZIP archive');
        } else {
          res.end();
        }
      });

      archive.pipe(res);

      // Append each frame from S3 into the archive
      for (const output of outputsWithKeys) {
        const key: string = output.s3Key;
        const frameNumber: number = output.frame ?? 0;
        const ext = key.includes('.') ? key.split('.').pop() || 'png' : 'png';
        const fileName = `frame_${String(frameNumber).padStart(4, '0')}.${ext}`;

        try {
          const stream = await this.s3Service.getObjectStream(key);
          archive.append(stream, { name: fileName });
        } catch (err) {
          console.warn(`Failed to append frame ${frameNumber} (${key}) to ZIP:`, err);
          // Skip this frame but continue with others
        }
      }

      archive.finalize();
    } catch (error) {
      console.error('Download job frames ZIP error:', error);
      if (error instanceof AppError) {
        if (!res.headersSent) {
          res.status(error.statusCode || 500).json({
            success: false,
            error: error.message
          });
        }
      } else {
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Failed to download frames ZIP',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }
  }

  // Allow user to re-render selected frames (up to 2 attempts per job)
  async rerenderFrames(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const user = (req as any).user;

      if (!user) {
        throw new AppError('Authentication required', 401);
      }

      const frames: number[] = Array.isArray(req.body.frames) ? req.body.frames : [];
      if (!frames.length) {
        throw new AppError('No frames specified for re-render', 400);
      }

      const job = await this.jobService.getJobById(jobId as string, user.userId, user.role);
      if (!job) {
        throw new AppError('Job not found', 404);
      }

      if (job.status !== 'completed') {
        throw new AppError('Re-render is only allowed for completed jobs', 400);
      }

      const currentCount = job.userRerenderCount ?? 0;
      const maxCount = job.userRerenderMax ?? 2;
      if (currentCount >= maxCount) {
        throw new AppError('Maximum re-render attempts reached for this job', 400);
      }

      const jobStart = job.frames.start;
      const jobEnd = job.frames.end;
      const invalidFrames = frames.filter(f => !Number.isInteger(f) || f < jobStart || f > jobEnd);
      if (invalidFrames.length) {
        throw new AppError(`Invalid frame numbers: ${invalidFrames.join(', ')}`, 400);
      }

      // Only allow re-render of frames that have been rendered at least once
      const renderedSet = new Set(job.frames.rendered);
      const framesToRerender = frames.filter(f => renderedSet.has(f));
      if (!framesToRerender.length) {
        throw new AppError('Selected frames are not rendered yet', 400);
      }

      await this.jobService.rerenderFrames(job, framesToRerender, user.userId, req);

      res.json({
        success: true,
        message: 'Frames queued for re-render',
        jobId: job.jobId,
        frames: framesToRerender,
        remainingRerenders: maxCount - (currentCount + 1)
      });
    } catch (error) {
      console.error('Re-render frames error:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to re-render frames',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // List jobs with filtering
  async listJobs(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new AppError('Authentication required', 401);
      }

      const filters: JobFilterOptions = {
        userId: req.query.userId as string,
        projectId: req.query.projectId as string,
        status: req.query.status as string,
        type: req.query.type as 'image' | 'animation',
        priority: req.query.priority as string,
        tags: req.query.tags ? JSON.parse(req.query.tags as string) : undefined,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        search: req.query.search as string,
        approved: req.query.approved ? req.query.approved === 'true' : undefined,
        adminView: req.query.adminView === 'true'
      };

      const pagination: PaginationOptions = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
        sortBy: req.query.sortBy as string || 'createdAt',
        sortOrder: req.query.sortOrder as 'asc' | 'desc' || 'desc'
      };

      const result = await this.jobService.listJobs(
        filters,
        pagination,
        user.userId,
        user.role
      );

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('List jobs error:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to list jobs',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // Update job
  async updateJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const user = (req as any).user;

      if (!user) {
        throw new AppError('Authentication required', 401);
      }

      const updates = req.body;
      const job = await this.jobService.updateJob(jobId as string, updates, user.userId, user.role);

      if (!job) {
        throw new AppError('Job not found or access denied', 404);
      }

      res.json({
        success: true,
        message: 'Job updated successfully',
        job
      });
    } catch (error) {
      console.error('Update job error:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to update job',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // Cancel job
  async cancelJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const user = (req as any).user;

      if (!user) {
        throw new AppError('Authentication required', 401);
      }

      const cleanupS3 = req.body.cleanupS3 === true;
      const success = await this.jobService.cancelJob(
        jobId as string,
        user.userId,
        user.role,
        cleanupS3
      );

      if (!success) {
        throw new AppError('Job not found or access denied', 404);
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
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to cancel job',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // Approve job (admin only)
  async approveJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const user = (req as any).user;

      if (!user) {
        throw new AppError('Authentication required', 401);
      }

      // We pass the role to the service, which determines if they have permission
      // based on the current job status and ownership
      const success = await this.jobService.approveJob(jobId as string, user.userId, user.role);

      if (!success) {
        throw new AppError('Job not found or access denied', 404);
      }

      res.json({
        success: true,
        message: 'Job approved successfully'
      });
    } catch (error) {
      console.error('Approve job error:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to approve job',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // Get job statistics
  async getJobStats(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new AppError('Authentication required', 401);
      }

      const adminView = req.query.adminView === 'true';
      const stats = await this.jobService.getJobStats(user.userId, user.role, adminView);

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('Get job stats error:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to get job statistics',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // Get user-specific job statistics
  async getUserJobStats(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user) {
        throw new AppError('Authentication required', 401);
      }

      const stats = await this.jobService.getUserJobStats(user.userId);

      res.json({
        success: true,
        stats
      });
    } catch (error) {
      console.error('Get user job stats error:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to get user job statistics',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // Generate frame upload URL
  async generateFrameUploadUrl(req: Request, res: Response): Promise<void> {
    try {
      const { jobId, frame } = req.params as { jobId: string, frame: string };

      if (!jobId || !frame) {
        throw new AppError('Job ID and frame number are required', 400);
      }

      const frameNumber = parseInt(frame);
      if (isNaN(frameNumber) || frameNumber < 1) {
        throw new AppError('Frame must be a positive integer', 400);
      }

      // Resolve extension based on job settings if possible
      let extension = 'png';
      try {
        const job = await this.jobService.getJobByIdMinimal(jobId);
        if (job && job.settings?.outputFormat) {
          const format = job.settings.outputFormat.toUpperCase();
          if (format === 'JPEG' || format === 'JPG') extension = 'jpg';
          else if (format === 'OPEN_EXR' || format === 'EXR') extension = 'exr';
          else if (format === 'TIFF') extension = 'tif';
          else if (format === 'TARGA' || format === 'TGA') extension = 'tga';
          else if (format === 'BMP') extension = 'bmp';
        }
      } catch (err) {
        console.warn('Failed to fetch job settings for extension resolution, defaulting to png');
      }

      const { uploadUrl, s3Key } = await this.s3Service.generateFrameUploadUrl(jobId, frameNumber, extension);

      res.json({
        success: true,
        uploadUrl,
        s3Key,
        frame: frameNumber,
        expiresIn: 3600,
        fileStructure: {
          s3Key,
          rendersFolder: `renders/${jobId}/`,
          fileName: `frame_${frameNumber.toString().padStart(4, '0')}.${extension}`
        }
      });
    } catch (error) {
      console.error('Generate upload URL error:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to generate upload URL',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // Complete frame
  async completeFrame(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const { nodeId, frame, renderTime, fileSize, s3Key } = req.body;

      if (!req.body.jobId) {
          req.body.jobId = jobId;
      }
      
      // If nodeId is not in params but in body, we need to adapt for NodeController.frameCompleted
      if (!req.params.nodeId && nodeId) {
          req.params.nodeId = nodeId;
      }

      // Import NodeController dynamically to avoid circular dependency if any
      const { NodeController } = require('./node');
      await NodeController.frameCompleted(req, res);
    } catch (error) {
      console.error('Complete frame error:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to record frame completion',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // Get job status for node
  async getJobStatusForNode(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;

      if (!jobId) {
        throw new AppError('Job ID is required', 400);
      }

      const job = await this.jobService.getJobByIdMinimal(jobId as string);

      if (!job) {
        res.json({
          success: true,
          status: 'not_found'
        });
        return;
      }

      res.json({
        success: true,
        status: job.status,
        jobId: job.jobId
      });
    } catch (error) {
      console.error('Get job status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get job status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // USER: After on-chain lock_payment succeeds, mark job as ready and enqueue frames.
  async lockOnchainPayment(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const user = (req as any).user;

      if (!user) {
        throw new AppError('Authentication required', 401);
      }
      const jobIdStr = Array.isArray(jobId) ? jobId[0] : jobId;
      if (!jobIdStr) {
        throw new AppError('Job ID is required', 400);
      }

      const { txSignature, escrowAddress, lockedAmount, escrowJobId } = req.body || {};
      if (!txSignature || !escrowAddress || typeof lockedAmount !== 'number' || !escrowJobId) {
        throw new AppError('txSignature, escrowAddress, lockedAmount, and escrowJobId are required', 400);
      }

      const job = await Job.findOne({ jobId: jobIdStr });
      if (!job) {
        throw new AppError('Job not found', 404);
      }

      // Security: only job owner (or admin) can lock the payment for their job.
      if (user.role !== 'admin') {
        if (!job.userId || job.userId.toString() !== user.userId) {
          throw new AppError('Unauthorized', 403);
        }
      }

      // Idempotency: if we already locked and enqueued, return the current state.
      if (job.escrow?.status === 'locked') {
        res.json({ success: true, jobId: job.jobId, status: job.status, escrow: job.escrow });
        return;
      }

      // Only allow the transition from "waiting for lock" to "ready to run".
      if (job.status !== 'pending_payment') {
        throw new AppError(`Job is not ready to be locked (current status: ${job.status})`, 400);
      }

      // Record escrow details and transition job state.
      job.escrow = {
        txSignature,
        escrowAddress,
        escrowJobId,
        lockedAmount,
        status: 'locked',
        lockedAt: new Date()
      } as any;

      job.status = 'pending';
      await job.save();

      // Deduct from User's DB tokenBalance (Maintain sync with On-chain)
      // This is crucial to fix the "Balance not updating in DB" issue reported by the user
      if (job.userId && lockedAmount) {
        await User.findByIdAndUpdate(job.userId, {
            $inc: { tokenBalance: -Number(lockedAmount) }
        });
        console.log(`Deducted ${lockedAmount} from User ${job.userId} DB balance`);
      }

      // Enqueue frames now that payment is locked.
      const selectedFrames: number[] = job.frames?.selected || [];
      if (!selectedFrames.length) {
        throw new AppError('No selected frames found for this job', 400);
      }

      const engine = (job.settings?.engine || 'CYCLES').toString();
      const device = (job.settings?.device || 'GPU').toString();
      await enqueueJobFrames(jobIdStr, selectedFrames, engine, device);

      const wsService = this.getWsService(req);
      if (wsService) {
        wsService.broadcastJobUpdate(jobIdStr);
        wsService.notifyNodesToCheckJobs();
      }

      res.json({
        success: true,
        jobId: job.jobId,
        status: job.status,
        escrow: job.escrow
      });
      return;
    } catch (error) {
      console.error('lockOnchainPayment error:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to lock on-chain payment',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  // Health check
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const wsService = this.getWsService(req);
      const bucketInfo = this.s3Service.getBucketInfo();

      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'job',
        version: '1.0.0',
        s3: {
          bucketName: bucketInfo.bucketName,
          region: bucketInfo.region,
          publicUrlBase: bucketInfo.publicUrlBase,
          status: 'connected'
        },
        websocket: wsService ? {
          connectedClients: wsService.getConnectionCount(),
          activeSubscriptions: wsService.getSubscriptionCount()
        } : { connectedClients: 0, activeSubscriptions: 0 }
      });
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Service check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}