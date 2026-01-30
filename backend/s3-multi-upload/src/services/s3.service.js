import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "../config/aws.config.js";

export const initiateMultipartUpload = async ({ filename, parts }) => {
  const key = `uploads/${Date.now()}-${filename}`;

  const createCommand = new CreateMultipartUploadCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ACL: "private",
    ContentType: "application/octet-stream",
  });

  const { UploadId } = await s3.send(createCommand);

  const presignedUrls = [];

  for (let partNumber = 1; partNumber <= parts; partNumber++) {
    const url = await getSignedUrl(
      s3,
      new UploadPartCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        UploadId,
        PartNumber: partNumber,
      }),
      { expiresIn: 60 * 10 },
    );

    presignedUrls.push({ partNumber, url });
  }

  return { key, uploadId: UploadId, presignedUrls };
};

export const completeMultipartUpload = async ({ key, uploadId, parts }) => {
  const command = new CompleteMultipartUploadCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts },
  });

  return await s3.send(command);
};
