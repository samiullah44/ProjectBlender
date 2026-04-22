import mongoose from 'mongoose';
import { Job } from '../models/Job';
import { AuditLog } from '../models/AuditLog';
import { env } from '../config/env';

async function debugData() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/render-nodes';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const completedJobsCount = await Job.countDocuments({ status: 'completed' });
    console.log('Completed Jobs Count:', completedJobsCount);

    const jobsWithCost = await Job.find({ status: 'completed', actualCost: { $gt: 0 } }).limit(5);
    console.log('Jobs with actualCost > 0:', jobsWithCost.length);
    jobsWithCost.forEach(j => console.log(`Job ${j._id}: cost=${j.actualCost}, date=${j.completedAt}`));

    const auditLogsCount = await AuditLog.countDocuments();
    console.log('Audit Logs Count:', auditLogsCount);
    
    const latestLogs = await AuditLog.find().sort({ createdAt: -1 }).limit(5);
    console.log('Latest Audit Logs:', JSON.stringify(latestLogs, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error('Debug error:', err);
  }
}

debugData();
