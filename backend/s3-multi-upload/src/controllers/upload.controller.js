// controllers/upload.controller.js
import { initiateMultipartUpload } from "../services/s3.service.js";
import { completeS3Upload, createJob } from "../services/uploadService.js";

/**
 * Initiate multipart upload
 */
export const initiateUpload = async (req, res) => {
  try {
    const { filename, parts } = req.body;

    if (!filename || !parts) {
      return res.status(400).json({ error: "filename and parts are required" });
    }

    const data = await initiateMultipartUpload({ filename, parts });

    res.json(data); // presigned URLs, uploadId, key
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to initiate upload" });
  }
};

/**
 * Complete multipart upload + create Job + JobFrames
 */

export const completeUpload = async (req, res) => {
  try {
    const {
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
    } = req.body;

    // 1️⃣ Complete the upload
    await completeS3Upload({ key, uploadId, parts });

    // 2️⃣ Create job and frames
    const result = await createJob({
      key,
      uploadId,
      jobSettings,
      userId,
      projectId,
      type,
      startFrame,
      endFrame,
      selectedFrame,
    });

    // 3️⃣ Return response
    res.json({
      success: true,
      message: "Upload completed and job created!",
      job: result.job,
      totalFrames: result.totalFrames,
      selectedFrames: result.selectedFrames,
      blendFilePath: result.blendFilePath,
      blendFileUrl: result.blendFileUrl,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to complete upload and create job",
      details: err.message,
    });
  }
};
