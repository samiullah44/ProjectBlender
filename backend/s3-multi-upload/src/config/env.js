import dotenv from "dotenv";

dotenv.config();

const env = {
  // AWS / S3
  AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY,
  AWS_SECRET_KEY: process.env.AWS_SECRET_KEY,
  AWS_REGION: process.env.AWS_REGION,
  S3_BUCKET: process.env.S3_BUCKET,

  // CloudFront
  CF_DISTRIBUTION_DOMAIN: process.env.CF_DISTRIBUTION_DOMAIN,
  CF_PRIVATE_KEY_PATH: process.env.CF_PRIVATE_KEY_PATH,
  CF_KEY_PAIR_ID: process.env.CF_KEY_PAIR_ID,

  // Server
  PORT: process.env.PORT || 3000,
  MONGO_URI: process.env.MONGO_URI,
};

// Optional: fail fast if something is missing (except PORT)
Object.entries(env).forEach(([key, value]) => {
  if (!value && key !== "PORT") {
    console.warn(`⚠️ Missing environment variable: ${key}`);
  }
});

export default env;
