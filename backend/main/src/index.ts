// backend/src/index.ts
import dotenv from 'dotenv';
dotenv.config();

import { server } from './app';
import { connectDatabase } from './config/database';
import { settlementScheduler } from './services/SettlementScheduler';
import { closeQueue, redis } from './services/FrameQueueService';
import { env } from './config/env';

console.log('🚀 Booting system...');
console.log('📡 Redis URL detected:', process.env.REDIS_URL ? 'YES' : 'NO (Using localhost)');

const PORT = env.port;
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

      // Start Settlement Scheduler
      settlementScheduler.start();
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
  settlementScheduler.stop();
  await closeQueue();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
