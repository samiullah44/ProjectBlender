import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand,  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from "../config/env";

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
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Generate a pre-signed URL for uploading rendered frames
   */
  async generateFrameUploadUrl(jobId: string, frame: number, expiresIn: number = 3600): Promise<{ uploadUrl: string; s3Key: string }> {
    const fileName = `frame_${frame.toString().padStart(4, '0')}.png`;
    const fileKey = `renders/${jobId}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      ContentType: 'image/png',
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
}