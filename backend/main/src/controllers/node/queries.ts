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

const HEARTBEAT_TIMEOUT_MS = 35000;
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

      const nodeList = nodes.map(node => {
        const lastHeartbeatAge = now.getTime() - new Date(node.lastHeartbeat).getTime();
        let computedStatus = node.status;
        let isActuallyOnline = lastHeartbeatAge <= HEARTBEAT_TIMEOUT_MS;

        if (!isActuallyOnline && (node.status === 'online' || node.status === 'busy')) {
          computedStatus = 'offline';

          // Update node status if needed
          Node.updateOne(
            { nodeId: node.nodeId },
            {
              status: 'offline',
              updatedAt: now,
              lastStatusChange: now
            }
          ).catch(err => console.error('Error updating node status:', err));
        }

        return {
          nodeId: node.nodeId,
          name: node.name,
          status: computedStatus,
          lastHeartbeat: node.lastHeartbeat,
          lastHeartbeatAge: `${Math.floor(lastHeartbeatAge / 1000)}s ago`,
          hardware: node.hardware,
          capabilities: node.capabilities,
          performance: node.performance,
          ipAddress: node.ipAddress,
          currentJob: node.currentJob,
          currentProgress: node.currentProgress,
          jobsCompleted: node.jobsCompleted,
          connectionCount: node.connectionCount || 0,
          isRevoked: node.isRevoked || false,
          revokedReason: node.revokedReason,
          revokedAt: node.revokedAt,
          createdAt: node.createdAt,
          updatedAt: node.updatedAt,
          lastStatusChange: node.lastStatusChange
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

      res.json({
        success: true,
        node: {
          nodeId: node.nodeId,
          name: node.name,
          status: isActuallyOnline ? node.status : 'offline',
          hardware: node.hardware,
          capabilities: node.capabilities,
          performance: node.performance,
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
      const now = new Date();

      // Calculate performance statistics
      const perfNodes = nodes.filter(n => n.performance && n.performance.framesRendered > 0);
      const avgFrameTime = perfNodes.length > 0
        ? perfNodes.reduce((sum, n) => sum + (n.performance?.avgFrameTime || 0), 0) / perfNodes.length
        : 0;

      // Get job statistics for node contributions (if method exists)
      const jobStats = (Job as any).getNodeContributions ? await (Job as any).getNodeContributions() : {};

      const statistics = {
        total: nodes.length,
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
          gpuCount: nodes.filter(n => n.hardware?.gpuName !== 'Unknown').length
        },
        performance: {
          totalJobsCompleted: nodes.reduce((sum, n) => sum + (n.jobsCompleted || 0), 0),
          avgJobsPerNode: nodes.length > 0 ?
            Math.round(nodes.reduce((sum, n) => sum + (n.jobsCompleted || 0), 0) / nodes.length) : 0,
          totalConnections: nodes.reduce((sum, n) => sum + (n.connectionCount || 0), 0),
          nodesWithPerformanceData: perfNodes.length,
          avgFrameTime: avgFrameTime.toFixed(2),
          fastestNode: perfNodes.length > 0
            ? perfNodes.sort((a, b) => (a.performance!.avgFrameTime - b.performance!.avgFrameTime))[0]?.nodeId
            : 'N/A',
          slowestNode: perfNodes.length > 0
            ? perfNodes.sort((a, b) => (b.performance!.avgFrameTime - a.performance!.avgFrameTime))[0]?.nodeId
            : 'N/A'
        },
        contributions: jobStats,
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