import fs from "fs";
import { getSignedUrl } from "@aws-sdk/cloudfront-signer";
import env from "../config/env.js"; // import your env

const { CF_DISTRIBUTION_DOMAIN, CF_PRIVATE_KEY_PATH, CF_KEY_PAIR_ID } = env;

/**
 * Generate a CloudFront signed URL for a given file path
 * @param {string} filePath - File path on CloudFront (e.g. /renders/job-123/frame_001.png)
 * @param {number} expireSeconds - Expiration time in seconds
 * @returns {string} signed URL
 */
export const generateSignedUrl = (filePath, expireSeconds = 60) => {
  const expireDate = new Date(Date.now() + expireSeconds * 1000);

  return getSignedUrl({
    url: `https://${CF_DISTRIBUTION_DOMAIN}${filePath}`,
    keyPairId: CF_KEY_PAIR_ID,
    privateKey: fs.readFileSync(CF_PRIVATE_KEY_PATH, "utf8"),
    dateLessThan: expireDate,
  });
};
