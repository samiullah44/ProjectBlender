import { Request, Response } from 'express';
import { Node } from '../../models/Node';
import { Job } from '../../models/Job';
import { User } from '../../models/User';
import { Notification } from '../../models/Notification';
import { HardwareValidationService } from '../../services/HardwareValidationService';
import { IFrameAssignment } from '../../types/job.types';
import { AppError } from '../../middleware/error';
import { S3Service } from '../../services/S3Service';
import { AuthRequest } from '../../middleware/auth';
import os from 'os';
import { wsService } from '../../app';
import { dequeueFramesForNode, nackFrame, requeueFramesFromOfflineNode, ackFrame, getQueueName } from '../../services/FrameQueueService';

const s3Service = new S3Service();

const HEARTBEAT_TIMEOUT_MS = 60000;
const OFFLINE_CHECK_INTERVAL_MS = 30000;
const MAX_NODES_PER_JOB = 10;
const MIN_FRAMES_PER_NODE = 1;
const MAX_FRAMES_PER_NODE = 20;
const ASSIGNMENT_COOLDOWN_MS = 10000;
const DEFAULT_CREDITS_PER_FRAME = 1;

import { checkAndUpdateOfflineNodes } from './offline';
// Get all nodes with WebSocket integration
export const getAllNodes = async (req: Request, res: Response): Promise<void> => {
  try {
    await checkAndUpdateOfflineNodes();

    const authReq = req as AuthRequest;
    const isAdmin = authReq.user?.role === 'admin' || authReq.user?.roles?.includes('admin');
    const userId = authReq.user?.userId;

    let query = {};
    if (!isAdmin) {
      if (!userId) {
        res.json({
          nodes: [],
          statistics: {
            total: 0,
            online: 0,
            offline: 0,
            busy: 0,
            onlinePercentage: 0
          }
        });
        return;
      }
      query = { userId };
    }

    const nodes = await Node.find(query).sort({ createdAt: -1 });
    const now = new Date();
    const nodeIds = nodes.map(n => n.nodeId);

    // BULK AGGREGATION: Get accurate historical stats for ALL nodes in the list in one query
    const bulkStatsAgg = await Job.aggregate([
      { $match: { "frameAssignments.nodeId": { $in: nodeIds }, "frameAssignments.status": "rendered" } },
      { $unwind: "$frameAssignments" },
      { $match: { "frameAssignments.nodeId": { $in: nodeIds }, "frameAssignments.status": "rendered" } },
      {
        $group: {
          _id: "$frameAssignments.nodeId",
          totalEarnings: { $sum: { $ifNull: ["$frameAssignments.creditsEarned", 0] } },
          totalFrames: { $sum: 1 }
        }
      }
    ]);

    // Create a map for quick lookup
    const statsMap = new Map(bulkStatsAgg.map(s => [s._id, s]));

    const nodeList = nodes.map(node => {
      const lastHeartbeatAge = now.getTime() - new Date(node.lastHeartbeat).getTime();
      let computedStatus = node.status;
      let isActuallyOnline = lastHeartbeatAge <= HEARTBEAT_TIMEOUT_MS;

      if (!isActuallyOnline && (node.status === 'online' || node.status === 'busy')) {
        computedStatus = 'offline';
        // (background update logic preserved...)
        Node.updateOne({ nodeId: node.nodeId }, { status: 'offline', updatedAt: now, lastStatusChange: now }).catch(() => {});
      }

      const hStats = statsMap.get(node.nodeId) || { totalEarnings: 0, totalFrames: 0 };

      return {
        nodeId: node.nodeId,
        name: node.name,
        status: computedStatus,
        lastHeartbeat: node.lastHeartbeat,
        lastHeartbeatAge: `${Math.floor(lastHeartbeatAge / 1000)}s ago`,
        hardware: node.hardware,
        capabilities: node.capabilities,
        performance: {
          ...node.performance,
          framesRendered: hStats.totalFrames,
          earnings: hStats.totalEarnings,
          totalGrossEarnings: hStats.totalEarnings
        },
        ipAddress: node.ipAddress,
        currentJob: node.currentJob,
        currentProgress: node.currentProgress,
        jobsCompleted: node.jobsCompleted,
        connectionCount: node.connectionCount || 0,
        isRevoked: node.isRevoked || false,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt
      };
    });

    const onlineNodes = nodeList.filter(n => n.status === 'online' || n.status === 'busy');
    const offlineNodes = nodeList.filter(n => n.status === 'offline');
    const busyNodes = nodeList.filter(n => n.status === 'busy');

    res.json({
      nodes: nodeList,
      statistics: {
        total: nodeList.length,
        online: onlineNodes.length,
        offline: offlineNodes.length,
        busy: busyNodes.length,
        onlinePercentage: nodeList.length > 0 ? Math.round((onlineNodes.length / nodeList.length) * 100) : 0
      }
    });

  } catch (error) {
    console.error('❌ Get nodes error:', error);
    res.status(500).json({
      error: 'Failed to get nodes',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Get node details with current job information
export const getNode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nodeId } = req.params;

    const node = await Node.findOne({ nodeId });
    if (!node) {
      throw new AppError('Node not found', 404);
    }

    let currentJobDetails = null;
    if (node.currentJob) {
      const job = await Job.findOne({ jobId: node.currentJob });
      if (job) {
        // Get frames assigned to this node
        const assignedFrames = job.frameAssignments
          .filter((a: IFrameAssignment) => a.nodeId === nodeId && a.status === 'assigned')
          .map((a: IFrameAssignment) => a.frame);

        const renderedFrames = job.frameAssignments
          .filter((a: IFrameAssignment) => a.nodeId === nodeId && a.status === 'rendered')
          .map((a: IFrameAssignment) => a.frame);

        const totalCreditsEarned = job.frameAssignments
          .filter((a: IFrameAssignment) => a.nodeId === nodeId && a.status === 'rendered')
          .reduce((sum: number, a: IFrameAssignment) => sum + (a.creditsEarned || 0), 0);

        currentJobDetails = {
          jobId: job.jobId,
          status: job.status,
          progress: job.progress,
          frames: {
            total: job.frames.total,
            rendered: renderedFrames.length,
            assigned: assignedFrames.length,
            selected: job.frames.selected || [] // NEW: Include selected frames
          },
          creditsEarned: totalCreditsEarned,
          settings: job.settings
        };
      }
    }

    const lastHeartbeatAge = Date.now() - new Date(node.lastHeartbeat).getTime();
    const isActuallyOnline = lastHeartbeatAge <= HEARTBEAT_TIMEOUT_MS;

    // Calculate node-specific historical stats
    const nodeStatsAgg = await Job.aggregate([
      { $match: { "frameAssignments.nodeId": nodeId, "frameAssignments.status": "rendered" } },
      { $unwind: "$frameAssignments" },
      { $match: { "frameAssignments.nodeId": nodeId, "frameAssignments.status": "rendered" } },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: "$frameAssignments.creditsEarned" },
          totalFrames: { $sum: 1 }
        }
      }
    ]);

    const historicalStats = nodeStatsAgg[0] || { totalEarnings: 0, totalFrames: 0 };

    res.json({
      success: true,
      node: {
        nodeId: node.nodeId,
        name: node.name,
        status: isActuallyOnline ? node.status : 'offline',
        hardware: node.hardware,
        capabilities: node.capabilities,
        performance: {
          ...node.performance,
          framesRendered: historicalStats.totalFrames, // Use accurate count
          earnings: historicalStats.totalEarnings, // Match frontend expected field name
          totalGrossEarnings: historicalStats.totalEarnings // Keep for safety/new UI
        },
        currentJob: currentJobDetails,
        jobsCompleted: node.jobsCompleted,
        connectionCount: node.connectionCount,
        lastHeartbeat: node.lastHeartbeat,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        isRevoked: node.isRevoked,
        revokedAt: node.revokedAt,
        revokedReason: node.revokedReason
      }
    });

  } catch (error) {
    console.error('❌ Get node error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode || 500).json({
        error: error.message
      });
    } else {
      res.status(500).json({
        error: 'Failed to get node details',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// Get node statistics with performance data
export const getNodeStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const isAdmin = authReq.user?.role === 'admin' || authReq.user?.roles?.includes('admin');
    const userId = authReq.user?.userId;

    let query = {};
    if (!isAdmin) {
      if (!userId) {
        res.json({
          total: 0,
          byStatus: { online: 0, offline: 0, busy: 0, maintenance: 0 },
          byHardware: { totalCpuCores: 0, totalRamGB: 0, totalVRAMGB: 0, gpuCount: 0 },
          performance: { totalJobsCompleted: 0, avgJobsPerNode: 0, totalConnections: 0, nodesWithPerformanceData: 0, avgFrameTime: "0.00", fastestNode: 'N/A', slowestNode: 'N/A' },
          onlineStatus: { actuallyOnline: 0, markedOnline: 0 }
        });
        return;
      }
      query = { userId };
    }

    const nodes = await Node.find(query);
    const nodeIds = nodes.map(n => n.nodeId);
    const now = new Date();

    // 1. Calculate Earnings (Released vs Pending) and Performance
    // Optimization: Use aggregation to get totals across all jobs for these nodes
    const statsAggregation = await Job.aggregate([
      { 
        $match: { 
          "frameAssignments.nodeId": { $in: nodeIds },
          "status": { $in: ["completed", "failed", "cancelled"] } // Include cancelled to show historical work
        } 
      },
      { $unwind: "$frameAssignments" },
      { 
        $match: { 
          "frameAssignments.nodeId": { $in: nodeIds }, 
          "frameAssignments.status": "rendered" 
        } 
      },
      {
        $group: {
          _id: {
            paymentStatus: "$escrow.paymentStatus" ,
            jobStatus: "$status"
          },
          totalCredits: { $sum: "$frameAssignments.creditsEarned" },
          totalFrames: { $sum: 1 },
          totalRenderTime: { $sum: "$frameAssignments.renderTime" },
          uniqueJobs: { $addToSet: "$jobId" }
        }
      }
    ]);

    let pendingEarnings = 0;
    let totalEarnedTokens = 0;
    let totalFramesRendered = 0;
    let totalRenderTime = 0;
    const uniqueJobIds = new Set<string>();

    for (const group of statsAggregation) {
      const isSettled = group._id.paymentStatus === 'settled';
      const jobStatus = group._id.jobStatus;
      
      totalEarnedTokens += group.totalCredits;
      totalFramesRendered += group.totalFrames;
      totalRenderTime += group.totalRenderTime;
      group.uniqueJobs.forEach((id: string) => uniqueJobIds.add(id));

      // ONLY count as pending if the job is eligible for settlement (not cancelled)
      // and hasn't been settled yet.
      if (!isSettled && (jobStatus === 'completed' || jobStatus === 'failed')) {
        pendingEarnings += group.totalCredits;
      }
    }

    const user = await User.findById(userId);
    const releasedEarnings = user?.nodeProvider?.earnings || 0;

    // 2. Node-specific performance
    const perfNodes = nodes.filter(n => n.performance && n.performance.framesRendered > 0);
    const avgFrameTimeValue = totalFramesRendered > 0 
      ? totalRenderTime / totalFramesRendered / 1000 // Convert ms to s
      : 0;

    const statistics = {
      total: nodes.length,
      earnings: {
        total: totalEarnedTokens,
        released: releasedEarnings,
        pending: pendingEarnings
      },
      byStatus: {
        online: nodes.filter(n => n.status === 'online').length,
        offline: nodes.filter(n => n.status === 'offline').length,
        busy: nodes.filter(n => n.status === 'busy').length,
        maintenance: nodes.filter(n => n.status === 'maintenance').length
      },
      byHardware: {
        totalCpuCores: nodes.reduce((sum, n) => sum + (n.hardware?.cpuCores || 0), 0),
        totalRamGB: nodes.reduce((sum, n) => sum + (n.hardware?.ramGB || 0), 0),
        totalVRAMGB: nodes.reduce((sum, n) => sum + Math.floor((n.hardware?.gpuVRAM || 0) / 1024), 0),
        gpuCount: nodes.filter(n => n.hardware?.gpuName && n.hardware.gpuName !== 'Unknown').length
      },
      performance: {
        totalJobsCompleted: uniqueJobIds.size, // Use unique jobs instead of node counter
        avgJobsPerNode: nodes.length > 0 ? Math.round(uniqueJobIds.size / nodes.length) : 0,
        totalConnections: nodes.reduce((sum, n) => sum + (n.connectionCount || 0), 0),
        nodesWithPerformanceData: perfNodes.length,
        avgFrameTime: avgFrameTimeValue.toFixed(2),
        fastestNode: perfNodes.length > 0
          ? perfNodes.sort((a, b) => (a.performance!.avgFrameTime - b.performance!.avgFrameTime))[0]?.nodeId
          : 'N/A',
        slowestNode: perfNodes.length > 0
          ? perfNodes.sort((a, b) => (b.performance!.avgFrameTime - a.performance!.avgFrameTime))[0]?.nodeId
          : 'N/A'
      },
      onlineStatus: {
        actuallyOnline: nodes.filter(n => {
          const lastHeartbeatAge = now.getTime() - new Date(n.lastHeartbeat).getTime();
          return lastHeartbeatAge <= HEARTBEAT_TIMEOUT_MS;
        }).length,
        markedOnline: nodes.filter(n => n.status === 'online' || n.status === 'busy').length
      }
    };

    res.json(statistics);

  } catch (error) {
    console.error('❌ Get node statistics error:', error);
    res.status(500).json({
      error: 'Failed to get node statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Get historical jobs for a specific node
export const getNodeHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nodeId } = req.params;

    // Verify the node exists
    const node = await Node.findOne({ nodeId });
    if (!node) {
      throw new AppError('Node not found', 404);
    }

    // Find all jobs where this node has assigned or rendered frames
    const jobs = await Job.find({ "frameAssignments.nodeId": nodeId })
      .sort({ createdAt: -1 })
      .lean(); // Use lean for faster subsequent processing

    // Format the response to highlight what THIS node did
    const history = jobs.map(job => {
      // Find assignments specific to this node
      const nodeAssignments = job.frameAssignments.filter(
        (a: any) => a.nodeId === nodeId
      );

      const renderedFrames = nodeAssignments
        .filter((a: any) => a.status === 'rendered')
        .map((a: any) => ({ frameNumber: a.frame, credits: a.creditsEarned || 0 }));

      const assignedFrames = nodeAssignments
        .filter((a: any) => a.status === 'assigned')
        .map((a: any) => a.frame);

      const failedFrames = nodeAssignments
        .filter((a: any) => a.status === 'failed')
        .map((a: any) => a.frame);

      const totalCreditsEarned = renderedFrames.reduce((sum, a) => sum + a.credits, 0);

      return {
        jobId: job.jobId,
        name: (job as any).name || job.blendFileName,
        status: job.status,
        createdAt: job.createdAt,
        totalJobFrames: job.frames.total,
        nodeContribution: {
          renderedFrames: renderedFrames.map(f => f.frameNumber),
          assignedFrames,
          failedFrames,
          totalFramesInvolved: nodeAssignments.length,
          creditsEarned: totalCreditsEarned
        }
      };
    });

    res.json({
      success: true,
      history
    });

  } catch (error) {
    console.error('❌ Get node history error:', error);
    if (error instanceof AppError) {
      res.status(error.statusCode || 500).json({
        error: error.message
      });
    } else {
      res.status(500).json({
        error: 'Failed to get node history',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
