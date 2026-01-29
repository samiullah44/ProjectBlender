import { generateSignedUrl } from "../services/cloudfrontService.js";

export const getSignedUrlController = (req, res) => {
  try {
    const { filePath, expireSeconds } = req.body;

    if (!filePath) {
      return res.status(400).json({ error: "filePath is required" });
    }

    const signedUrl = generateSignedUrl(filePath, expireSeconds || 60);

    res.json({
      success: true,
      filePath,
      signedUrl,
      expiresIn: expireSeconds || 60,
    });
  } catch (err) {
    console.error("CloudFront signed URL error:", err);
    res.status(500).json({ error: "Failed to generate signed URL", details: err.message });
  }
};
