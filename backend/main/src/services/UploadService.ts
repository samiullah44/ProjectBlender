// services/UploadService.ts
import { Job } from '../models/Job';
import { User } from '../models/User';
import { S3Service } from './S3Service';
import { v4 as uuidv4 } from 'uuid';
import { normalizeBlenderVersion } from '../utils/blenderVersionMapper';
import { wsService } from '../app';
import { solanaService } from './SolanaService';
import { AppError } from '../middleware/error';
import { enqueueJobFrames } from './FrameQueueService';

export class UploadService {
  private s3Service: S3Service;

  constructor() {
    this.s3Service = new S3Service();
  }

  /**
   * Complete multipart upload and create job
   */
  async completeUploadAndCreateJob({
    key,
    uploadId,
    parts,
    jobSettings,
    userId,
    projectId,
    type,
    inputType,
    startFrame,
    endFrame,
    selectedFrame,
    filename
  }: {
    key: string;
    uploadId: string;
    parts: Array<{ PartNumber: number; ETag: string }>;
    jobSettings: any;
    userId: string;
    projectId: string;
    type: 'image' | 'animation';
    inputType: 'blend' | 'archive';
    startFrame: number;
    endFrame: number;
    selectedFrame: number;
    filename: string;
  }) {
    try {
      // 1. Complete the multipart upload
      await this.s3Service.completeMultipartUpload(key, uploadId, parts);

      // 2. Generate download URL for the blend file
      const blendFileUrl = await this.s3Service.generateBlendFileDownloadUrl(key);

      // 3. Calculate frame details
      let totalFrames = 1;
      let selectedFrames: number[] = [];

      if (type === 'animation') {
        totalFrames = endFrame - startFrame + 1;
        selectedFrames = Array.from({ length: totalFrames }, (_, i) => startFrame + i);
      } else if (type === 'image') {
        totalFrames = 1;
        selectedFrames = [selectedFrame];
      }
      
      // --- SOLANA ZERO-PROMPT LOCKING ---
      const user = await User.findById(userId);
      if (!user) throw new AppError('User not found', 404);

      // Simple frame-based estimate for the lock (Matching JobService)
      const creditsPerFrame = jobSettings?.creditsPerFrame || 1;
      const complexityFactor = (jobSettings?.samples || 128) / 128;
      const resolutionFactor = ((jobSettings?.resolutionX || 1920) * (jobSettings?.resolutionY || 1080)) / (1920 * 1080);
      let estimatedCredits = totalFrames * creditsPerFrame * complexityFactor * resolutionFactor;
      if (jobSettings?.engine === 'CYCLES') estimatedCredits *= 1.2;
      if (jobSettings?.device === 'GPU') estimatedCredits *= 0.8;
      const roundedCredits = Math.ceil(estimatedCredits);

      let lockTxSignature = '';
      const onchainJobId = Date.now();

      if (user.role !== 'admin' && user.solanaSeed) {
        try {
          console.log(`[UploadService] Initiating on-chain lock for user ${userId}, amount: ${roundedCredits}`);
          lockTxSignature = await solanaService.lockPayment(
            user.solanaSeed,
            onchainJobId,
            roundedCredits
          );
          console.log(`[UploadService] ✅ Solana Lock Successful: ${lockTxSignature}`);
        } catch (solanaErr: any) {
          console.error('[UploadService] ❌ Solana Lock Failed:', solanaErr);
          throw new AppError(`On-chain payment reservation failed: ${solanaErr.message}`, 402);
        }
      }
      // ----------------------------------

      const jobId = `job-${Date.now()}-${uuidv4().substr(0, 8)}`;

      // 4. Create job in database
      const engine = (jobSettings?.engine || 'CYCLES').toUpperCase();
      const device = (jobSettings?.device || 'GPU').toUpperCase();

      const job = new Job({
        jobId,
        projectId,
        userId,
        blendFileKey: key,
        blendFileUrl,
        blendFileName: filename,
        type,
        inputType,
        settings: {
          ...jobSettings,
          engine,
          device,
          blenderVersion: normalizeBlenderVersion(jobSettings?.blenderVersion || '4.5.0')
        },
        frames: {
          start: type === 'animation' ? startFrame : selectedFrame,
          end: type === 'animation' ? endFrame : selectedFrame,
          total: totalFrames,
          selected: selectedFrames,
          rendered: [],
          failed: [],
          assigned: [],
          pending: selectedFrames
        },
        assignedNodes: new Map(),
        status: 'pending', // Now that payment is locked, it's ready.
        progress: 0,
        outputUrls: [],
        estimatedCost: roundedCredits,
        escrow: {
          onchainJobId,
          txSignature: lockTxSignature,
          status: lockTxSignature ? 'locked' : 'none',
          lockedAmount: roundedCredits,
          lockedAt: lockTxSignature ? new Date() : undefined
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await job.save();

      // Enqueue frames for nodes (Matching JobService)
      try {
        await enqueueJobFrames(jobId, selectedFrames, job.settings.engine, job.settings.device);
      } catch (queueErr) {
        console.error(`⚠️  Failed to enqueue frames for job ${jobId} into BullMQ:`, queueErr);
      }

      // Update user stats
      await User.findByIdAndUpdate(userId, {
        $inc: { 'stats.jobsCreated': 1 }
      });

      // Broadcast job creation (nodes won't start because BullMQ frames are enqueued only after lock_payment)
      if (wsService) {
        wsService.broadcastSystemUpdate({
          type: 'job_created',
          data: {
            jobId: job.jobId,
            userId: job.userId,
            type: job.type,
            totalFrames: job.frames.total,
            status: job.status
          }
        });
      }

      console.log(`🎬 New ${type} job created via multipart upload: ${jobId}`);
      console.log(`📁 Blend file uploaded to S3: ${key}`);

      return {
        success: true,
        jobId: job.jobId,
        message: 'Upload completed and job created!',
        type: job.type,
        inputType: job.inputType,
        totalFrames: job.frames.total,
        selectedFrames: job.frames.selected,
        blendFileUrl: job.blendFileUrl,
        settings: job.settings,
        fileStructure: {
          blendFile: key,
          uploadsFolder: `uploads/${job.jobId}/`,
          rendersFolder: `renders/${job.jobId}/`
        }
      };
    } catch (error) {
      console.error('Complete upload and create job error:', error);
      throw error;
    }
  }
}