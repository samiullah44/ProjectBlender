import dotenv from "dotenv";

dotenv.config();

const env = {
  AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY,
  AWS_SECRET_KEY: process.env.AWS_SECRET_KEY,
  AWS_REGION: process.env.AWS_REGION,
  S3_BUCKET: process.env.S3_BUCKET,
  PORT: process.env.PORT || 3000,
};

// Optional: fail fast if something is missing
Object.entries(env).forEach(([key, value]) => {
  if (!value && key !== "PORT") {
    console.warn(`⚠️ Missing environment variable: ${key}`);
  }
});

export default env;
