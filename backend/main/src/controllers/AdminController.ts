import { Request, Response } from 'express';
import { solanaService } from '../services/SolanaService';
import { Job as JobModel } from '../models/Job';
import { Node as NodeModel } from '../models/Node';
import { User as UserModel } from '../models/User';
import { AuditService } from '../services/AuditService';

// Helper to compute date range from a period string
function getDateRange(period: string): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  const p = period.toLowerCase();

  switch (p) {
    case '24h':  from.setDate(to.getDate() - 1); break;
    case '7d':   from.setDate(to.getDate() - 7); break;
    case '30d':  from.setMonth(to.getMonth() - 1); break;
    case '3mo':  from.setMonth(to.getMonth() - 3); break;
    case '1yr':  from.setFullYear(to.getFullYear() - 1); break;
    case 'all':  from.setFullYear(2020); break; // Platform start epoch
    // Backwards compatibility for old internal strings
    case 'daily':   from.setDate(to.getDate() - 1); break;
    case 'weekly':  from.setDate(to.getDate() - 7); break;
    case 'monthly': from.setMonth(to.getMonth() - 1); break;
    default:        from.setMonth(to.getMonth() - 1); // Default to monthly
  }
  return { from, to };
}

export class AdminController {
  /**
   * GET /api/admin/platform-fees
   */
  public static async getPlatformFees(req: any, res: any) {
    try {
      const stats = await solanaService.getPlatformFeeStats();
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'Failed to fetch platform fee statistics', details: error.message });
    }
  }

  /**
   * POST /api/admin/update-config
   */
  public static async updateConfig(req: any, res: any) {
    try {
      const { newAdmin, newFeeCollector, platformFeeBps } = req.body;
      const adminId = (req as any).user?.userId;

      const tx = await solanaService.updateGlobalConfig(
        newAdmin || null,
        newFeeCollector || null,
        platformFeeBps !== undefined ? Number(platformFeeBps) : null
      );

      // Log the action
      await AuditService.log({
        adminId,
        action: 'CONFIG_UPDATE',
        targetType: 'Config',
        details: { newAdmin, newFeeCollector, platformFeeBps },
        req
      });

      res.json({ success: true, message: 'On-chain configuration updated successfully', transaction: tx });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'Failed to update on-chain configuration', details: error.message });
    }
  }

  /**
   * GET /api/admin/analytics?period=daily|weekly|monthly|3months|yearly|all
   * 
   * Returns comprehensive analytics for the admin dashboard.
   */
  public static async getAnalytics(req: any, res: any) {
    try {
      const period = (req.query.period as string) || 'monthly';
      const limit = parseInt(req.query.limit as string) || 10;
      const { from, to } = getDateRange(period);

      // ── 1. Job volume over time (grouped by day) ─────────────────────────
      const jobsOverTime = await JobModel.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: {
              year:  { $year:  '$createdAt' },
              month: { $month: '$createdAt' },
              day:   { $dayOfMonth: '$createdAt' },
            },
            total:     { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            failed:    { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
            cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
        {
          $project: {
            _id: 0,
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: {
                  $dateFromParts: { year: '$_id.year', month: '$_id.month', day: '$_id.day' },
                },
              },
            },
            total: 1, completed: 1, failed: 1, cancelled: 1,
          },
        },
      ]);

      // ── 2. Revenue over time (credits spent, grouped by day) ─────────────
      const revenueOverTime = await JobModel.aggregate([
        {
          $match: {
            status: 'completed',
            completedAt: { $gte: from, $lte: to },
            $or: [
              { actualCost: { $gt: 0 } },
              { estimatedCost: { $gt: 0 } }
            ]
          },
        },
        {
          $group: {
            _id: {
              year:  { $year:  '$completedAt' },
              month: { $month: '$completedAt' },
              day:   { $dayOfMonth: '$completedAt' },
            },
            revenue: { $sum: { $ifNull: ['$actualCost', '$estimatedCost'] } },
            jobs:    { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
        {
          $project: {
            _id: 0,
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: { $dateFromParts: { year: '$_id.year', month: '$_id.month', day: '$_id.day' } },
              },
            },
            revenue: 1, jobs: 1,
          },
        },
      ]);

      // ── 3. Overall job status breakdown ──────────────────────────────────
      const [totalJobs, pendingJobs, processingJobs, completedJobs, failedJobs, cancelledJobs] = await Promise.all([
        JobModel.countDocuments({ createdAt: { $gte: from, $lte: to } }),
        JobModel.countDocuments({ status: { $in: ['pending', 'pending_payment'] }, createdAt: { $gte: from, $lte: to } }),
        JobModel.countDocuments({ status: 'processing', createdAt: { $gte: from, $lte: to } }),
        JobModel.countDocuments({ status: 'completed', createdAt: { $gte: from, $lte: to } }),
        JobModel.countDocuments({ status: 'failed', createdAt: { $gte: from, $lte: to } }),
        JobModel.countDocuments({ status: 'cancelled', createdAt: { $gte: from, $lte: to } }),
      ]);

      // ── 4. Top 10 clients by total spending ──────────────────────────────
      const topClients = await JobModel.aggregate([
        { $match: { status: 'completed', $or: [{ actualCost: { $exists: true, $gt: 0 } }, { estimatedCost: { $exists: true, $gt: 0 } }] } },
        {
          $group: {
            _id: '$userId',
            totalSpent:    { $sum: { $ifNull: ['$actualCost', '$estimatedCost'] } },
            totalJobs:     { $sum: 1 },
            totalFrames:   { $sum: { $size: { $ifNull: ['$frames.rendered', []] } } },
          },
        },
        { $sort: { totalSpent: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'userInfo',
          },
        },
        {
          $project: {
            _id: 0,
            userId:      '$_id',
            totalSpent:  1,
            totalJobs:   1,
            totalFrames: 1,
            name:  { $ifNull: [{ $arrayElemAt: ['$userInfo.name', 0] }, 'Unknown'] },
            email: { $ifNull: [{ $arrayElemAt: ['$userInfo.email', 0] }, ''] },
          },
        },
      ]);

      // ── 5. Top 10 node providers by frames rendered ────────────────────
      const topNodes = await NodeModel.aggregate([
        { $match: { 'performance.framesRendered': { $exists: true, $gt: 0 } } },
        { $sort: { 'performance.framesRendered': -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'ownerInfo',
          },
        },
        {
          $project: {
            _id: 0,
            nodeId: 1,
            name: 1,
            status: 1,
            totalFramesRendered: '$performance.framesRendered',
            totalEarnings: { $ifNull: [{ $arrayElemAt: ['$ownerInfo.nodeProvider.earnings', 0] }, 0] },
            totalJobsCompleted: '$jobsCompleted',
            gpuModel: '$hardware.gpuName',
            ownerName:  { $ifNull: [{ $arrayElemAt: ['$ownerInfo.name', 0] }, 'Unknown'] },
            ownerEmail: { $ifNull: [{ $arrayElemAt: ['$ownerInfo.email', 0] }, ''] },
          },
        },
      ]);

      // ── 6. Network health summary ─────────────────────────────────────────
      const [totalNodes, onlineNodes, busyNodes, offlineNodes, totalUsers] = await Promise.all([
        NodeModel.countDocuments(),
        NodeModel.countDocuments({ status: 'online' }),
        NodeModel.countDocuments({ status: 'busy' }),
        NodeModel.countDocuments({ status: 'offline' }),
        UserModel.countDocuments(),
      ]);

      // ── 7. Total revenue (all time) ───────────────────────────────────────
      const revenueAgg = await JobModel.aggregate([
        { $match: { status: 'completed', $or: [{ actualCost: { $gt: 0 } }, { estimatedCost: { $gt: 0 } }] } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$actualCost', '$estimatedCost'] } } } },
      ]);
      const totalRevenue = revenueAgg[0]?.total || 0;

      // ── 8. Frames rendered total ──────────────────────────────────────────
      const framesAgg = await JobModel.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: { $size: '$frames.rendered' } } } },
      ]);
      const totalFramesRendered = framesAgg[0]?.total || 0;

      // ── 9. Avg render time (ms) ───────────────────────────────────────────
      const renderTimeAgg = await JobModel.aggregate([
        { $match: { status: 'completed', renderTime: { $exists: true, $gt: 0 } } },
        { $group: { _id: null, avg: { $avg: '$renderTime' } } },
      ]);
      const avgRenderTimeMs = renderTimeAgg[0]?.avg || 0;

      // ── 10. Job type breakdown ────────────────────────────────────────────
      const jobTypeBreakdown = await JobModel.aggregate([
        { $match: { createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $project: { _id: 0, type: '$_id', count: 1 } },
      ]);

      res.json({
        success: true,
        period,
        dateRange: { from: from.toISOString(), to: to.toISOString() },
        data: {
          // --- Charts ---
          jobsOverTime,
          revenueOverTime,
          jobTypeBreakdown,
          // --- Rankings ---
          topClients,
          topNodes,
          // --- KPIs ---
          kpi: {
            totalJobs, pendingJobs, processingJobs, completedJobs, failedJobs, cancelledJobs,
            totalRevenue, totalFramesRendered, avgRenderTimeMs,
            totalUsers, totalNodes, onlineNodes, busyNodes, offlineNodes,
            successRate: totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0,
          },
        },
      });
    } catch (error: any) {
      console.error('[AdminController] getAnalytics error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch analytics', details: error.message });
    }
  }

  /**
   * GET /api/admin/users
   * Returns all platform users with basic stats for admin user management.
   */
  public static async getAllUsers(req: any, res: any) {
    try {
      const page  = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = req.query.search as string || '';

      const query: any = {};
      if (search) {
        query.$or = [
          { name:  { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ];
      }

      const [users, total] = await Promise.all([
        UserModel.find(query)
          .select('name email roles primaryRole solanaSeed payoutWallet isRevoked suspicionTag createdAt totalSpent totalJobsSubmitted')
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        UserModel.countDocuments(query),
      ]);

      res.json({ success: true, users, total, page, pages: Math.ceil(total / limit) });
    } catch (error: any) {
      console.error('[AdminController] getAllUsers error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch users' });
    }
  }

  /**
   * POST /api/admin/users/:userId/ban
   */
  public static async banUser(req: any, res: any) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const adminId = (req as any).user?.userId;

      const user = await UserModel.findByIdAndUpdate(
        userId,
        { $set: { isRevoked: true, suspicionTag: reason || 'Banned by admin' } },
        { new: true }
      ).select('name email isRevoked');

      if (!user) return res.status(404).json({ success: false, error: 'User not found' });

      // Log the action
      await AuditService.log({
        adminId,
        action: 'USER_BAN',
        targetId: userId,
        targetType: 'User',
        details: { reason },
        req
      });

      res.json({ success: true, message: 'User banned', user });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'Failed to ban user' });
    }
  }

  /**
   * POST /api/admin/users/:userId/unban
   */
  public static async unbanUser(req: any, res: any) {
    try {
      const { userId } = req.params;
      const adminId = (req as any).user?.userId;

      const user = await UserModel.findByIdAndUpdate(
        userId,
        { $set: { isRevoked: false }, $unset: { suspicionTag: '' } },
        { new: true }
      ).select('name email isRevoked');

      if (!user) return res.status(404).json({ success: false, error: 'User not found' });

      // Log the action
      await AuditService.log({
        adminId,
        action: 'USER_UNBAN',
        targetId: userId,
        targetType: 'User',
        req
      });

      res.json({ success: true, message: 'User unbanned', user });
    } catch (error: any) {
      res.status(500).json({ success: false, error: 'Failed to unban user' });
    }
  }

  /**
   * GET /api/admin/audit-logs
   */
  public static async getAuditLogs(req: any, res: any) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const action = req.query.action as string;

      const query: any = {};
      if (action) query.action = action;

      const result = await AuditService.getLogs(query, { page, limit });
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('[AdminController] getAuditLogs error:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
    }
  }
}
