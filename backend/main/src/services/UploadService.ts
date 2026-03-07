// services/UploadService.ts
import { Job } from '../models/Job';
import { S3Service } from './S3Service';
import { v4 as uuidv4 } from 'uuid';
import { normalizeBlenderVersion } from '../utils/blenderVersionMapper';
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

      const jobId = `job-${Date.now()}-${uuidv4().substr(0, 8)}`;

      // 4. Create job in database
      const job = new Job({
        jobId,
        projectId,
        userId,
        blendFileKey: key,
        blendFileUrl,
        blendFileName: filename,
        type,
        settings: {
          ...jobSettings,
          blenderVersion: normalizeBlenderVersion(jobSettings?.blenderVersion || '4.5.0')
        },
        frames: {
          start: type === 'animation' ? startFrame : selectedFrame,
          end: type === 'animation' ? endFrame : selectedFrame,
          total: totalFrames,
          selected: selectedFrames,
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

      // Enqueue frames to BullMQ for atomic distribution
      try {
        await enqueueJobFrames(jobId, selectedFrames, job.settings.engine, job.settings.device);
      } catch (queueErr) {
        console.error(`⚠️  Failed to enqueue multipart frames for job ${jobId} into BullMQ:`, queueErr);
      }

      console.log(`🎬 New ${type} job created via multipart upload: ${jobId}`);
      console.log(`📁 Blend file uploaded to S3: ${key}`);

      return {
        success: true,
        jobId: job.jobId,
        message: 'Upload completed and job created!',
        type: job.type,
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