import dotenv from 'dotenv';

dotenv.config(); // Load .env variables

// Export typed environment variables
export const env = {
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/blendfarm',

  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || '',

  jwtSecret: process.env.JWT_SECRET || 'default_jwt_secret_change_me',

  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    region: process.env.AWS_REGION || 'ap-south-1',
    s3Bucket: process.env.S3_BUCKET_NAME || 'not-configured',
  },
};
