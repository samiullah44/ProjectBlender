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

// Performance tracking interface
interface NodePerformance {
  nodeId: string;
  hardwareScore: number;
  reliabilityScore: number;
  avgFrameTime: number;
  lastHeartbeatAge: number;
  framesRendered: number;
  currentLoad: number; // 0-1, how busy the node is
}

  // Get WebSocket service from app
  export const getWsService = (req: Request) => {
    return req.app.get('wsService');
  }
export type { NodePerformance };
