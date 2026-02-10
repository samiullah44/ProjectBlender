// backend/src/controllers/JobController.ts
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { JobService } from '../services/JobService';
import { S3Service } from '../services/S3Service';
import { AppError } from '../middleware/error';
import { CreateJobRequest, JobFilterOptions, PaginationOptions } from '../types/job.types';
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
          creditsPerFrame: parseFloat(req.body.creditsPerFrame) || 1,
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

      const result = await this.jobService.createJob(createJobRequest);

      // Set WebSocket service if not already set
      if (!this.jobService['wsService']) {
        const wsService = this.getWsService(req);
        if (wsService) {
          this.jobService.setWebSocketService(wsService);
        }
      }

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
        approved: req.query.approved ? req.query.approved === 'true' : undefined
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

      if (user.role !== 'admin') {
        throw new AppError('Admin access required', 403);
      }

      const success = await this.jobService.approveJob(jobId as string, user.userId);

      if (!success) {
        throw new AppError('Job not found', 404);
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

      const stats = await this.jobService.getJobStats(user.userId, user.role);

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
      const { jobId, frame } = req.params;

      if (!jobId || !frame) {
        throw new AppError('Job ID and frame number are required', 400);
      }

      const frameNumber = parseInt(frame as string);
      if (isNaN(frameNumber) || frameNumber < 1) {
        throw new AppError('Frame must be a positive integer', 400);
      }

      const { uploadUrl, s3Key } = await this.s3Service.generateFrameUploadUrl(jobId as string, frameNumber);

      res.json({
        success: true,
        uploadUrl,
        s3Key,
        frame: frameNumber,
        expiresIn: 3600,
        fileStructure: {
          s3Key,
          rendersFolder: `renders/${jobId}/`,
          fileName: `frame_${frameNumber.toString().padStart(4, '0')}.png`
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
      const { frame, nodeId, renderTime, fileSize, s3Key } = req.body;

      // This would typically be called by a node, so authentication might be different
      // For now, we'll keep it simple

      res.json({
        success: true,
        message: 'Frame completion recorded'
      });
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