// backend/src/app.ts
import express from 'express';
import http from 'http';
import dotenv from 'dotenv';
import { WebSocketService } from './services/WebSocketService';
import {env} from "./config/env"

// Import routes
import jobRoutes from './routes/api/jobs';
import nodeRoutes from './routes/api/nodes';

// Import your CORS middleware
import { corsMiddleware } from './config/cors';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Use your CORS middleware
app.use(corsMiddleware);

// Middleware
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Routes
app.use('/api/jobs', jobRoutes);
app.use('/api/nodes', nodeRoutes);

// WebSocket endpoint
app.get('/ws', (req, res) => {
  res.status(400).json({ error: 'WebSocket connection required' });
});

// Initialize WebSocketService
const wsService = new WebSocketService(server);

// Make WebSocket service available to controllers
app.set('wsService', wsService);

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

export { app, server, wsService };
