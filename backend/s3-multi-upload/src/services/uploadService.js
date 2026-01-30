import Job from "../models/job.model.js";
import JobFrame from "../models/jobFrame.model.js";
import { completeMultipartUpload } from "./s3.service.js"; // assume you already have this

/**
 * Complete S3 multipart upload
 */
export const completeS3Upload = async ({ key, uploadId, parts }) => {
  if (!key || !uploadId || !parts) {
    throw new Error("key, uploadId and parts are required");
  }

  await completeMultipartUpload({ key, uploadId, parts });
  return key; // return the S3 key
};

/**
 * Create a Job document in DB
 */
export const createJob = async ({
  key,
  uploadId,
  jobSettings = {},
  userId = "default-user",
  projectId = "default-project",
  type = "animation",
  startFrame = 1,
  endFrame = 10,
  selectedFrame = 1,
}) => {
  const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const totalFrames = type === "animation" ? endFrame - startFrame + 1 : 1;
  const selectedFrames =
    type === "animation"
      ? Array.from({ length: totalFrames }, (_, i) => startFrame + i)
      : [selectedFrame];

  const job = new Job({
    jobId,
    userId,
    projectId,
    type,
    settings: jobSettings,
    inputFiles: [
      {
        s3Key: key,
        uploadId,
        uploadedAt: new Date(),
      },
    ],
    status: "pending",
    progress: 0,
    outputUrls: [],
  });

  await job.save();

  const frameDocs = selectedFrames.map((frameNumber) => ({
    jobId: job.jobId,
    frameNumber,
    status: "pending",
  }));

  await JobFrame.insertMany(frameDocs);

  return {
    job,
    totalFrames,
    selectedFrames,
    blendFilePath: key,
    blendFileUrl: `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
  };
};
