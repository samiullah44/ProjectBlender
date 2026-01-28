import express from "express";
import cors from "cors";
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from "dotenv";

dotenv.config();
// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});

// Step 1: Initiate Multipart Upload & generate pre-signed URLs
app.post("/api/initiate-upload", async (req, res) => {
  try {
    const { filename, parts } = req.body;
    const key = `uploads/${Date.now()}-${filename}`;

    const createCommand = new CreateMultipartUploadCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ACL: "private",
      ContentType: "application/octet-stream",
    });

    const uploadData = await s3.send(createCommand);
    const uploadId = uploadData.UploadId;

    const presignedUrls = [];
    for (let partNumber = 1; partNumber <= parts; partNumber++) {
      const url = await getSignedUrl(
        s3,
        new UploadPartCommand({
          Bucket: process.env.S3_BUCKET,
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber,
        }),
        { expiresIn: 60 * 10 }
      );
      presignedUrls.push(url);
    }

    res.json({ key, uploadId, presignedUrls });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to initiate upload" });
  }
});

// Step 2: Complete Multipart Upload
app.post("/api/complete-upload", async (req, res) => {
  try {
    const { key, uploadId, parts } = req.body; // parts = [{ETag, PartNumber}, ...]
    
    const completeCommand = new CompleteMultipartUploadCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts,
      },
    });

    const data = await s3.send(completeCommand);
    res.json({ message: "Upload completed!", location: data.Location || `s3://${process.env.S3_BUCKET}/${key}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to complete upload" });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));
