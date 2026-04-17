// // backend/src/index.ts
// import express from 'express';
// import http from 'http';
// import cors from 'cors';
// import dotenv from 'dotenv';
// import mongoose from 'mongoose';

// // Import WebSocketService
// import { WebSocketService } from './services/WebSocketService';

// // Config
// dotenv.config();

// // Import routes
// import jobRoutes from './routes/api/jobs';
// import nodeRoutes from './routes/api/nodes';

// const app = express();
// const server = http.createServer(app);

// // ============ CORS Configuration ============
// const corsOptions = {
//   origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
//     const allowedOrigins = [
//       'http://localhost:3000',
//       'http://localhost:5173',
//       'http://localhost:8080',
//       process.env.FRONTEND_URL || '',
//       /\.awsapprunner\.com$/
//     ].filter(Boolean);

//     if (!origin) return callback(null, true);

//     const isAllowed = allowedOrigins.some(allowed => {
//       if (typeof allowed === 'string') {
//         return origin === allowed;
//       } else if (allowed instanceof RegExp) {
//         return allowed.test(origin);
//       }
//       return false;
//     });

//     if (isAllowed) {
//       callback(null, true);
//     } else {
//       console.log(`CORS blocked: ${origin}`);
//       callback(new Error('Not allowed by CORS'));
//     }
//   },
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
//   credentials: true,
//   maxAge: 86400
// };

// // Apply CORS
// app.use(cors(corsOptions));

// // Middleware
// app.use(express.json({ limit: '500mb' }));
// app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// // Routes
// app.use('/api/jobs', jobRoutes);
// app.use('/api/nodes', nodeRoutes);

// // WebSocket endpoint
// app.get('/ws', (req, res) => {
//   res.status(400).json({ error: 'WebSocket connection required' });
// });

// // Initialize WebSocketService
// const wsService = new WebSocketService(server);

// // Make WebSocket service available to controllers
// app.set('wsService', wsService);

// // Start WebSocket cleanup and stats broadcasting
// wsService.startCleanupInterval();
// wsService.startStatsBroadcast();

// // Health check endpoint
// app.get('/health', (req, res) => {
//   const wsService = req.app.get('wsService') as WebSocketService;

//   res.json({
//     status: 'ok',
//     timestamp: new Date().toISOString(),
//     version: '1.0.0',
//     environment: process.env.NODE_ENV || 'development',
//     storage: 'aws-s3',
//     bucket: process.env.S3_BUCKET_NAME || 'not-configured',
//     websocket: {
//       connectedClients: wsService.getConnectionCount(),
//       activeSubscriptions: wsService.getSubscriptionCount()
//     }
//   });
// });

// // Connect to MongoDB
// const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/blendfarm';
// mongoose.connect(MONGODB_URI)
//   .then(() => console.log('✅ MongoDB connected'))
//   .catch(err => console.error('MongoDB connection error:', err));

// const PORT = parseInt(process.env.PORT || '3000', 10);
// const HOST = process.env.HOST || '0.0.0.0';

// server.listen(PORT, HOST, () => {
//   console.log('\n' + '='.repeat(50));
//   console.log('🚀 BlendFarm Backend Server Started');
//   console.log('='.repeat(50));
//   console.log(`📊 Port: ${PORT}`);
//   console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
//   console.log(`☁️  Storage: AWS S3 (${process.env.S3_BUCKET_NAME || 'not-configured'})`);
//   console.log(`🗄️  MongoDB: ${MONGODB_URI.includes('@') ? 'connected' : MONGODB_URI}`);
//   console.log(`🔌 WebSocket: ws://${HOST}:${PORT}/ws`);
//   console.log('='.repeat(50));
// });

// // Error handlers
// process.on('uncaughtException', (error) => {
//   console.error('Uncaught Exception:', error);
// });

// process.on('unhandledRejection', (reason, promise) => {
//   console.error('Unhandled Rejection at:', promise, 'reason:', reason);
// });

// // Export for use in controllers
// export { wsService };



// backend/src/index.ts
import dotenv from 'dotenv';
dotenv.config();

import { server } from './app';
import { connectDatabase } from './config/database';
import { closeQueue, redis } from './services/FrameQueueService';

console.log('🚀 Booting system...');
console.log('📡 Redis URL detected:', process.env.REDIS_URL ? 'YES' : 'NO (Using localhost)');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Check Redis connection ping utility
async function checkRedisConnection() {
  try {
    // Shared redis instance already handles connection and error events
    if (redis.status === 'ready') return true;
    
    await redis.ping();
    console.log('✅ Redis connected successfully');
    return true;
  } catch (err) {
    console.error('❌ Redis connection test failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

(async () => {
  try {
    // Initialize BullMQ queues
    const { initializeQueues } = require('./services/FrameQueueService');
    initializeQueues();

    // Connect to MongoDB
    await connectDatabase();

    // Check Redis
    const redisConnected = await checkRedisConnection();

    // Start the server
    server.listen(PORT, HOST, () => {
      console.log('\n' + '='.repeat(50));
      console.log('🚀 BlendFarm Backend Server Started');
      console.log('='.repeat(50));
      console.log(`📊 Port: ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`☁️ Storage: AWS S3 (${process.env.S3_BUCKET_NAME || 'not-configured'})`);
      console.log(`🔌 WebSocket: ws://${HOST}:${PORT}/ws`);
      console.log(`🗄️  Redis: ${redisConnected ? 'Connected (Queue System Live)' : 'Disconnected (Queues Offline)'}`);
      console.log('='.repeat(50));
    });
  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
})();

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('\n🔄 Received shutdown signal, closing queues...');
  await closeQueue();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
