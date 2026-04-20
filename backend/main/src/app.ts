// backend/src/app.ts
/// <reference path="./types/express-session.d.ts" />
import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
dotenv.config();

import MongoStore from 'connect-mongo';
import session from 'express-session';
import { WebSocketService } from './services/WebSocketService';
import { env } from "./config/env"
import { S3Service } from './services/S3Service';
import { JobService } from './services/JobService';
import { initializeQueues, getQueueStats } from './services/FrameQueueService';

// Initialize BullMQ topic queues at startup
initializeQueues();

// Import routes
import jobRoutes from './routes/api/jobs';
import nodeRoutes from './routes/api/nodes';
import authRoutes from './routes/api/auth';
import notificationRoutes from './routes/api/notification';
import analyticsRoutes from './routes/api/analytics';
import newsletterRoutes from './routes/api/newsletter';

// Import your CORS middleware
import { corsMiddleware } from './config/cors';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Trust proxy — required when deployed behind nginx/Cloudflare/load balancers
// so req.ip and X-Forwarded-For headers contain the real client IP
app.set('trust proxy', true);

// Use your CORS middleware
app.use(corsMiddleware);

// Session configuration
app.use(session({
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: env.mongodbUri,
    collectionName: 'sessions'
  }),
  cookie: {
    secure: env.nodeEnv === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
import passport from './config/passport';
app.use(passport.initialize());
app.use(passport.session());

// Middleware
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Routes
app.use('/api/jobs', jobRoutes);
app.use('/api/nodes', nodeRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/newsletter', newsletterRoutes);

// WebSocket endpoint
app.get('/ws', (req, res) => {
  res.status(400).json({ error: 'WebSocket connection required' });
});
const s3Service = new S3Service();
const wsService = new WebSocketService(server);
const jobService = new JobService(s3Service, wsService);

// Make services available to controllers via app
app.set('s3Service', s3Service);
app.set('wsService', wsService);
app.set('jobService', jobService);

// Start WebSocket cleanup and stats broadcasting
wsService.startCleanupInterval();
wsService.startStatsBroadcast();

// Health check endpoint
app.get('/health', (req, res) => {
  const wsService = req.app.get('wsService') as WebSocketService;
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: env.nodeEnv || 'development',
    storage: 'aws-s3',
    bucket: env.aws.s3Bucket || 'not-configured',
    websocket: {
      connectedClients: wsService.getConnectionCount(),
      activeSubscriptions: wsService.getSubscriptionCount()
    }
  });
});

// Queue stats endpoint
app.get('/api/queue/stats', async (req, res) => {
  try {
    const stats = await getQueueStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch queue stats', details: err.message });
  }
});

export { app, server, wsService };
