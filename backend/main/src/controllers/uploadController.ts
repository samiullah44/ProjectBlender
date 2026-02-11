// controllers/uploadController.ts
import { Request, Response } from 'express';
import { S3Service } from '../services/S3Service';
import { UploadService } from '../services/UploadService';
import { AppError } from '../middleware/error';

const s3Service = new S3Service();
const uploadService = new UploadService();

export class UploadController {
  /**
   * Initiate multipart upload
   */
  static async initiateUpload(req: Request, res: Response): Promise<void> {
    try {
      const { filename, parts } = req.body;

      if (!filename || !parts) {
        throw new AppError('Filename and parts are required', 400);
      }

      const partsNum = parseInt(parts as string);
      if (isNaN(partsNum) || partsNum < 1) {
        throw new AppError('Parts must be a positive integer', 400);
      }

      const data = await s3Service.initiateMultipartUpload(filename as string, partsNum);

      res.json({
        success: true,
        ...data
      });
    } catch (error) {
      console.error('Initiate upload error:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({
          error: error.message
        });
      } else {
        res.status(500).json({
          error: 'Failed to initiate upload',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Complete multipart upload and create job
   */
  static async completeUpload(req: Request, res: Response): Promise<void> {
    try {
      // Extract the authenticated user from the request (set by authenticate middleware)
      const user = (req as any).user;
      if (!user || !user.userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const {
        key,
        uploadId,
        parts,
        jobSettings,
        projectId = 'default-project',
        type = 'animation',
        startFrame = 1,
        endFrame = 10,
        selectedFrame = 1,
        filename
      } = req.body;

      // Use the authenticated user's ID, NOT the body's userId
      const userId = user.userId;

      // Validate required fields
      if (!key || !uploadId || !parts || !filename) {
        throw new AppError('Key, uploadId, parts, and filename are required', 400);
      }

      // Validate parts array
      if (!Array.isArray(parts)) {
        throw new AppError('Parts must be an array', 400);
      }

      // Parse settings
      const parsedSettings = {
        engine: jobSettings?.engine || 'CYCLES',
        device: jobSettings?.device || 'GPU',
        samples: parseInt(jobSettings?.samples || '128'),
        resolutionX: parseInt(jobSettings?.resolutionX || '1920'),
        resolutionY: parseInt(jobSettings?.resolutionY || '1080'),
        tileSize: parseInt(jobSettings?.tileSize || '256'),
        denoiser: type === 'image' ? jobSettings?.denoiser || 'OPTIX' : undefined,
        outputFormat: jobSettings?.outputFormat || 'PNG',
        creditsPerFrame: jobSettings?.creditsPerFrame || 1
      };

      // Complete upload and create job
      const result = await uploadService.completeUploadAndCreateJob({
        key,
        uploadId,
        parts,
        jobSettings: parsedSettings,
        userId,
        projectId,
        type: type as 'image' | 'animation',
        startFrame: parseInt(startFrame as string),
        endFrame: parseInt(endFrame as string),
        selectedFrame: parseInt(selectedFrame as string),
        filename
      });

      // Broadcast job creation (if WebSocket is available)
      const wsService = req.app.get('wsService');
      if (wsService) {
        wsService.broadcastSystemUpdate({
          type: 'job_created',
          data: {
            jobId: result.jobId,
            type: result.type,
            status: 'pending',
            blendFileName: filename,
            totalFrames: result.totalFrames
          }
        });
      }

      res.json(result);
    } catch (error) {
      console.error('Complete upload error:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({
          error: error.message
        });
      } else {
        res.status(500).json({
          error: 'Failed to complete upload and create job',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }
  /**
   * Abort multipart upload
   */
  static async abortUpload(req: Request, res: Response): Promise<void> {
    try {
      const { key, uploadId } = req.body;

      if (!key || !uploadId) {
        throw new AppError('Key and uploadId are required', 400);
      }

      await s3Service.abortMultipartUpload(key, uploadId);

      res.json({
        success: true,
        message: 'Upload aborted successfully'
      });
    } catch (error) {
      console.error('Abort upload error:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode || 500).json({
          error: error.message
        });
      } else {
        res.status(500).json({
          error: 'Failed to abort upload',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }
}