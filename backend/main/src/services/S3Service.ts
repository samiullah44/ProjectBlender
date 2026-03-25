import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from "../config/env";
import { Readable } from 'stream';

export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;
  private region: string;

  constructor() {
    this.bucketName = env.aws.s3Bucket;
    this.region = env.aws.region;

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: env.aws.accessKeyId!,
        secretAccessKey: env.aws.secretAccessKey!
      }
    });
  }

  // Cache signed URLs to drastically reduce latency for API list views
  private urlCache = new Map<string, { url: string; expiresAt: number }>();

  /**
   * Upload a blend file to S3 in uploads folder
   */
  async uploadBlendFile(file: Express.Multer.File, jobId: string): Promise<string> {
    const fileName = `${file.originalname}`;
    const fileKey = `uploads/${jobId}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        'job-id': jobId,
        'original-name': file.originalname,
        'upload-type': 'blend-file'
      }
    });

    await this.s3Client.send(command);

    return fileKey;
  }

  /**
   * Generate a pre-signed URL for downloading blend file
   */
  async generateBlendFileDownloadUrl(fileKey: string, expiresIn: number = 3600): Promise<string> {
    const cacheKey = `download_${fileKey}`;
    const cached = this.urlCache.get(cacheKey);
    // Add 5 min buffer so we do not return a URL that's about to expire
    if (cached && cached.expiresAt > Date.now() + 300000) {
      return cached.url;
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn });
    this.urlCache.set(cacheKey, { url, expiresAt: Date.now() + (expiresIn * 1000) });

    // Auto-cleanup cache occasionally to prevent memory leaks if it grows too large
    if (this.urlCache.size > 1000) {
      const now = Date.now();
      for (const [key, value] of this.urlCache.entries()) {
        if (value.expiresAt <= now) {
          this.urlCache.delete(key);
        }
      }
    }

    return url;
  }

  /**
   * Generate a pre-signed URL for uploading rendered frames
   */
  async generateFrameUploadUrl(
    jobId: string,
    frame: number,
    extension: string = 'png',
    expiresIn: number = 3600
  ): Promise<{ uploadUrl: string; s3Key: string }> {
    const fileName = `frame_${frame.toString().padStart(4, '0')}.${extension}`;
    const fileKey = `renders/${jobId}/${fileName}`;

    // Determine Content-Type based on extension
    let contentType = 'image/png';
    const ext = extension.toLowerCase();
    if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
    else if (ext === 'exr') contentType = 'image/x-exr';
    else if (ext === 'tif' || ext === 'tiff') contentType = 'image/tiff';
    else if (ext === 'tga') contentType = 'image/x-targa';
    else if (ext === 'bmp') contentType = 'image/bmp';

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      ContentType: contentType,
      Metadata: {
        'job-id': jobId,
        'frame-number': frame.toString(),
        'upload-type': 'rendered-frame'
      }
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

    return {
      uploadUrl,
      s3Key: fileKey
    };
  }

  /**
   * Generate download URL for rendered frame
   */
  async generateFrameDownloadUrl(fileKey: string, expiresIn: number = 86400): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Get a readable stream for an S3 object (used for server-side ZIP streaming)
   */
  async getObjectStream(fileKey: string): Promise<Readable> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey
    });

    const response: any = await this.s3Client.send(command);
    if (!response.Body) {
      throw new Error(`No body returned for S3 object: ${fileKey}`);
    }
    // In Node.js runtime, Body will be a Readable stream compatible with Node's Readable.
    return response.Body as Readable;
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(fileKey: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey
    });

    await this.s3Client.send(command);
  }

  /**
   * Delete all files for a job
   */
  async deleteJobFiles(jobId: string): Promise<void> {
    try {
      // Delete blend file
      const blendFilePattern = `uploads/${jobId}/`;
      // Note: For production, you would need to list and delete all files
      // This is simplified version

      // Delete rendered frames
      const rendersPattern = `renders/${jobId}/`;
      // Similarly, list and delete all files

      console.log(`Would delete files for job ${jobId}: ${blendFilePattern}, ${rendersPattern}`);
    } catch (error) {
      console.error(`Failed to delete job files for ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Get public URL (if bucket is public)
   */
  getPublicUrl(fileKey: string): string {
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${fileKey}`;
  }

  /**
   * List all files for a job
   */
  async listJobFiles(jobId: string): Promise<{ blendFiles: string[], renderedFrames: string[] }> {
    // This is a placeholder - in production, you would use listObjectsV2
    return {
      blendFiles: [`uploads/${jobId}/`],
      renderedFrames: [`renders/${jobId}/`]
    };
  }

  /**
   * Get S3 bucket info
   */
  getBucketInfo(): { bucketName: string; region: string; publicUrlBase: string } {
    return {
      bucketName: this.bucketName,
      region: this.region,
      publicUrlBase: `https://${this.bucketName}.s3.${this.region}.amazonaws.com/`
    };
  }
  async initiateMultipartUpload(filename: string, parts: number): Promise<{
    key: string;
    uploadId: string;
    presignedUrls: { partNumber: number; url: string }[]
  }> {
    const key = `uploads/${Date.now()}-${filename}`;

    const createCommand = new CreateMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: key,
      ACL: "private",
      ContentType: "application/octet-stream",
    });

    const { UploadId } = await this.s3Client.send(createCommand);

    const presignedUrls = [];

    for (let partNumber = 1; partNumber <= parts; partNumber++) {
      const url = await getSignedUrl(
        this.s3Client,
        new UploadPartCommand({
          Bucket: this.bucketName,
          Key: key,
          UploadId,
          PartNumber: partNumber,
        }),
        { expiresIn: 3600 * 10 }, // 10 minutes
      );

      presignedUrls.push({ partNumber, url });
    }

    return { key, uploadId: UploadId!, presignedUrls };
  }

  /**
   * NEW: Complete multipart upload
   */
  async completeMultipartUpload(key: string, uploadId: string, parts: Array<{ PartNumber: number; ETag: string }>): Promise<void> {
    const command = new CompleteMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    });

    await this.s3Client.send(command);
  }

  /**
   * NEW: Abort multipart upload
   */
  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    const command = new AbortMultipartUploadCommand({
      Bucket: this.bucketName,
      Key: key,
      UploadId: uploadId,
    });

    await this.s3Client.send(command);
  }

  // ── Node Software Distribution ─────────────────────────────────

  /** S3 key where node software is stored. Single canonical location. */
  static readonly NODE_SOFTWARE_KEY = 'Node Software/BlendFarmNode.zip';

  /**
   * Upload (or replace) the node software ZIP to the fixed key.
   * Called by the seed script; returns the S3 key.
   */
  async uploadNodeSoftware(fileBuffer: Buffer): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: S3Service.NODE_SOFTWARE_KEY,
      Body: fileBuffer,
      ContentType: 'application/zip',
      ContentDisposition: 'attachment; filename="BlendFarmNode.zip"',
      Metadata: {
        'upload-type': 'node-software',
        'updated-at': new Date().toISOString(),
      },
    });

    await this.s3Client.send(command);
    return S3Service.NODE_SOFTWARE_KEY;
  }

  /**
   * Generate a time-limited pre-signed URL for downloading the node software.
   * Default expiry: 24 hours (86400 seconds).
   */
  async getNodeSoftwareDownloadUrl(expiresIn: number = 86400): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: S3Service.NODE_SOFTWARE_KEY,
      // Force browser to download as a file with correct name
      ResponseContentDisposition: 'attachment; filename="BlendFarmNode.zip"',
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }
}