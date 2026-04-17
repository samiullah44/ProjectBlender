import cors, { CorsOptions } from 'cors';
import dotenv from 'dotenv';
import { env } from "./env"

dotenv.config();

export const createCorsOptions = (): CorsOptions => ({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = [
      `http://localhost:${env.port}`,
      'http://localhost:5173',
      'http://localhost:8080',
      'https://main.d1zbjn2d2gkpde.amplifyapp.com',
      env.frontendUrl || '',
      /\.awsapprunner\.com$/
    ].filter(Boolean);

    // Allow requests with no origin
    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.some(allowed => {
      if (typeof allowed === 'string') return origin === allowed;
      if (allowed instanceof RegExp) return allowed.test(origin);
      return false;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.log(`CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400
});

export const corsMiddleware = cors(createCorsOptions());