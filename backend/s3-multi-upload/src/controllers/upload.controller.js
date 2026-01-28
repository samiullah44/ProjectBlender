import {
  initiateMultipartUpload,
  completeMultipartUpload,
} from "../services/s3.service.js";

export const initiateUpload = async (req, res) => {
  try {
    const { filename, parts } = req.body;

    const data = await initiateMultipartUpload({ filename, parts });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to initiate upload" });
  }
};

export const completeUpload = async (req, res) => {
  try {
    const { key, uploadId, parts } = req.body;

    const data = await completeMultipartUpload({ key, uploadId, parts });

    res.json({
      message: "Upload completed!",
      location: data.Location || `s3://${process.env.S3_BUCKET}/${key}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to complete upload" });
  }
};
