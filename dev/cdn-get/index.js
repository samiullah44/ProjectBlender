const fs = require("fs");
const { getSignedUrl } = require("@aws-sdk/cloudfront-signer");

// CloudFront details
const distributionDomain = "d1iwbbmguehnc3.cloudfront.net";
const privateKeyPath = "./cloudfront-private.pem";
const keyPairId = "KB6YVAITUH91C"; // your CloudFront key pair

// File path in CloudFront
const filePath = "/renders/job-1769059639043-vetbn682p/frame_0001.png";

// Expiration time (1 minute from now)
const expireDate = new Date(Date.now() + 60 * 1000); // 1 min

// Generate signed URL
const signedUrl = getSignedUrl({
  url: `https://${distributionDomain}${filePath}`,
  keyPairId: keyPairId,
  privateKey: fs.readFileSync(privateKeyPath, "utf8"),
  dateLessThan: expireDate,
});

console.log("Signed URL:", signedUrl);
