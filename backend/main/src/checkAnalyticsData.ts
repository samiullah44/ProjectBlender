import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { AnalyticsUser, AnalyticsSession, AnalyticsEvent } from './models/Analytics';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function check() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not found in environment');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const latestUsers = await AnalyticsUser.find().sort({ lastSeen: -1 }).limit(5);
  console.log('\n--- LATEST USERS ---');
  latestUsers.forEach(u => {
    console.log(`ID: ${u.userId.slice(0,8)}... | Email: ${u.email || 'Anonymous'} | IP: ${u.ipAddress} | Geo: ${JSON.stringify(u.geo)} | Seen: ${u.lastSeen.toLocaleString()}`);
  });

  const latestSessions = await AnalyticsSession.find().sort({ startTime: -1 }).limit(5);
  console.log('\n--- LATEST SESSIONS ---');
  latestSessions.forEach(s => {
    console.log(`ID: ${s.sessionId.slice(0,8)}... | IP: ${s.userId.slice(0,8)}... | Geo: ${s.geo?.country || 'NULL'} | Pages: ${s.pageViews} | Start: ${s.startTime.toLocaleString()}`);
  });

  const latestEvents = await AnalyticsEvent.find().sort({ timestamp: -1 }).limit(10);
  console.log('\n--- LATEST EVENTS ---');
  latestEvents.forEach(e => {
    console.log(`Type: ${e.eventType} | User: ${e.userId.slice(0,8)}... | Geo: ${e.geo?.country || 'NULL'} | Page: ${e.page} | Time: ${e.timestamp.toLocaleString()}`);
  });

  await mongoose.disconnect();
}

check().catch(console.error);
