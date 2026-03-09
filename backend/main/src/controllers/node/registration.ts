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

import { getWsService } from './shared';
  // Node registration with performance initialization
  export const registerNode = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.userId;
      const nodeInfo = req.body;
      const nodeId = nodeInfo.nodeId || `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();
      const incomingFingerprint: string | undefined = nodeInfo.hardware?.hardwareFingerprint
        || nodeInfo.hardwareFingerprint;

      // ── Security: Block duplicate hardware registrations ──────────────────
      if (incomingFingerprint) {
        const hwMatch = await Node.findOne({ hardwareFingerprint: incomingFingerprint }).select('+nodeSecretHash');
        if (hwMatch && hwMatch.nodeId !== nodeId) {
          // Same hardware, but a DIFFERENT nodeId → check if the INCOMING nodeId already
          // has a properly registered document (with a nodeSecretHash). If so, do NOT reclaim —
          // the connecting node is legitimate and the old doc is a leftover/duplicate.
          const incomingNodeDoc = await Node.findOne({ nodeId }).select('+nodeSecretHash');
          if (incomingNodeDoc?.nodeSecretHash) {
            // The connecting node has its own valid registered record — skip reclaim.
            // The old fingerprint-only document is a stale orphan; delete it to keep DB clean.
            console.log(`🧹 Deleting stale orphan node document ${hwMatch.nodeId} — connecting node ${nodeId} is the legitimate owner of this hardware.`);
            await Node.deleteOne({ nodeId: hwMatch.nodeId });
            // Fall through to the normal existingNode update path below
          } else if (hwMatch.status !== 'offline') {
            // Active duplicate → reject
            console.warn(`🚫 Duplicate hardware fingerprint from ${nodeId} — already registered as ${hwMatch.nodeId}`);
            res.status(409).json({
              error: 'HARDWARE_ALREADY_REGISTERED',
              message: 'This hardware is already registered under a different node. Only one node per physical machine is allowed.',
              existingNodeId: hwMatch.nodeId
            });
            return;
          } else {
            // The previous node with this hardware is offline and no better record exists → reuse its record
            console.log(`🔄 Reclaiming offline node ${hwMatch.nodeId} for hardware fingerprint re-registration as ${nodeId}`);
            hwMatch.nodeId = nodeId;
            hwMatch.status = 'online';
            hwMatch.lastHeartbeat = now;
            hwMatch.updatedAt = now;
            hwMatch.connectionCount = (hwMatch.connectionCount || 0) + 1;
            if (userId) hwMatch.userId = userId as any;
            if (nodeInfo.hardware) hwMatch.hardware = { ...hwMatch.hardware, ...nodeInfo.hardware };
            (hwMatch as any).hardwareFingerprint = incomingFingerprint;
            (hwMatch as any).publicIp = nodeInfo.publicIp || hwMatch.ipAddress;
            (hwMatch as any).hostname = nodeInfo.hostname || os.hostname();
            if (nodeInfo.name) hwMatch.name = nodeInfo.name;
            await hwMatch.save();
            console.log(`🔒 Node hardware reclaimed: ${nodeInfo.name || nodeId} (fp: ${incomingFingerprint.substring(0, 8)}...)`);
            res.json({ success: true, message: 'Node re-registered (hardware reclaimed)', nodeId, heartbeatInterval: 30000 });
            return;
          }
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      // ── Disk Space Validation ──────────────────────────────────────────
      const storageFreeGB = nodeInfo.hardware?.storageFreeGB || nodeInfo.storageFreeGB;
      if (storageFreeGB !== undefined) {
        const diskCheck = HardwareValidationService.checkFreeDisk(Number(storageFreeGB));
        if (!diskCheck.allowed) {
          // If node exists, revoke it first
          const existing = await Node.findOne({ nodeId });
          if (existing) {
            existing.isRevoked = true;
            existing.status = 'offline';
            existing.revokedReason = diskCheck.message;
            existing.revokedAt = now;
            await existing.save();

            // Notify user
            try {
              const { notificationService } = await import('../../services/NotificationService');
              await notificationService.createNotification(
                userId || existing.userId as any,
                'system',
                'Node Revoked',
                `Node "${existing.name || nodeId}" has been revoked: ${diskCheck.message}`
              );
            } catch (e) {
              console.error('Failed to send registration revocation notification:', e);
            }
          }

          res.status(403).json({
            error: 'INSUFFICIENT_DISK_SPACE',
            message: diskCheck.message
          });
          return;
        }
        if (diskCheck.warn && userId) {
          // Create a warning notification for the user
          try {
            const { notificationService } = await import('../../services/NotificationService');
            await notificationService.createNotification(
              userId as any,
              'system',
              'Low Disk Space Warning',
              diskCheck.message
            );
          } catch (e) {
            console.error('Failed to send disk warning notification:', e);
          }
        }
      }
      // ──────────────────────────────────────────────────────────────────

      const existingNode = await Node.findOne({ nodeId });

      if (existingNode) {
        // Update existing node
        existingNode.status = existingNode.currentJob ? 'busy' : 'online';
        existingNode.lastHeartbeat = now;
        existingNode.updatedAt = now;
        existingNode.connectionCount = (existingNode.connectionCount || 0) + 1;
        existingNode.lastStatusChange = existingNode.status !== 'online' && existingNode.status !== 'busy' ? now : existingNode.lastStatusChange;
        // Link node to user if not already linked (for backward compatibility)
        if (!existingNode.userId && userId) {
          existingNode.userId = userId as any;
        }

        // --- NEW: Auto-Recovery Logic for Revoked Nodes ---
        if (existingNode.isRevoked && nodeInfo.hardware) {
          const recoveryCheck = HardwareValidationService.checkMinimumRequirements(nodeInfo.hardware);
          if (recoveryCheck.meetsRequirements) {
            console.log(`🔓 Node ${nodeId} hardware requirements restored. Auto-recovering status...`);
            existingNode.isRevoked = false;
            existingNode.revokedReason = undefined;
            existingNode.revokedAt = undefined;
            existingNode.status = 'online';

            // Notify User: Hardware Restored
            if (existingNode.userId) {
              Notification.create({
                userId: existingNode.userId,
                type: 'system',
                title: 'Node Access Restored! ✅',
                message: `Great news! Your node "${existingNode.name}" now meets the minimum system requirements again. Access has been automatically restored.`,
                metadata: { nodeId }
              }).catch(err => console.error('Failed to create recovery notification:', err));
            }
          }
        }
        // --- End Auto-Recovery ---

        // --- Hardware Specification Change Detection (Upgrade/Downgrade) ---
        let hwChangeMessage = '';
        let isDowngrade = false;
        let isUpgrade = false;

        if (nodeInfo.hardware && existingNode.hardware) {
          const oldHw = existingNode.hardware as any;
          const newHw = nodeInfo.hardware;

          // Check RAM
          if (newHw.ramGB !== undefined && oldHw.ramGB !== undefined) {
            const diff = Math.round(newHw.ramGB) - Math.round(oldHw.ramGB);
            if (diff <= -2) { hwChangeMessage += `RAM decreased from ${oldHw.ramGB}GB to ${newHw.ramGB}GB. `; isDowngrade = true; }
            else if (diff >= 2) { hwChangeMessage += `RAM increased from ${oldHw.ramGB}GB to ${newHw.ramGB}GB. `; isUpgrade = true; }
          }

          // Check CPU Cores
          if (newHw.cpuCores !== undefined && oldHw.cpuCores !== undefined) {
            if (newHw.cpuCores < oldHw.cpuCores) { hwChangeMessage += `CPU Cores decreased from ${oldHw.cpuCores} to ${newHw.cpuCores}. `; isDowngrade = true; }
            else if (newHw.cpuCores > oldHw.cpuCores) { hwChangeMessage += `CPU Cores increased from ${oldHw.cpuCores} to ${newHw.cpuCores}. `; isUpgrade = true; }
          }

          // Check CPU Model Swap
          if (newHw.cpuModel && oldHw.cpuModel && newHw.cpuModel !== oldHw.cpuModel) {
            hwChangeMessage += `CPU Model changed from '${oldHw.cpuModel}' to '${newHw.cpuModel}'. `;
            // We don't mark as up/down immediately, benchmarking handles true performance.
          }

          // Check GPU VRAM
          if (newHw.gpuVRAM !== undefined && oldHw.gpuVRAM !== undefined) {
            const diffMB = newHw.gpuVRAM - oldHw.gpuVRAM;
            if (diffMB <= -1000) { hwChangeMessage += `GPU VRAM decreased from ${oldHw.gpuVRAM}MB to ${newHw.gpuVRAM}MB. `; isDowngrade = true; }
            else if (diffMB >= 1000) { hwChangeMessage += `GPU VRAM increased from ${oldHw.gpuVRAM}MB to ${newHw.gpuVRAM}MB. `; isUpgrade = true; }
          }

          // Check GPU Model Swap
          if (newHw.gpuName && oldHw.gpuName && newHw.gpuName !== oldHw.gpuName) {
            hwChangeMessage += `GPU changed from '${oldHw.gpuName}' to '${newHw.gpuName}'. `;
          }

          if (hwChangeMessage.trim().length > 0) {
            console.log(`⚠️ Hardware change detected for node ${nodeId}: ${hwChangeMessage}`);

            // Check minimum requirements if it was a downgrade
            let failedMinReqs = false;
            let reqReason = '';

            if (isDowngrade) {
              const check = HardwareValidationService.checkMinimumRequirements(newHw);
              if (!check.meetsRequirements) {
                failedMinReqs = true;
                reqReason = check.reason || 'Failed minimum rendering requirements.';
                console.warn(`🚫 Node ${nodeId} degraded below minimum specs: ${reqReason}`);
                existingNode.status = 'offline';
                existingNode.isRevoked = true; // Hide from frontend as requested
                existingNode.revokedReason = reqReason;
                existingNode.revokedAt = new Date();
              }
            }

            // Send Notifications
            if (existingNode.userId) {
              try {
                const adminUsers = await User.find({ roles: 'admin' }).select('_id');

                if (failedMinReqs) {
                  // Notify User: Rejected
                  const notifyDoc = await Notification.create({
                    userId: existingNode.userId,
                    type: 'system',
                    title: 'Node Status Revoked (Hardware Degradation)',
                    message: `Your node "${existingNode.name}" no longer meets the minimum system requirements because hardware was removed/downgraded.\n\nChanges: ${hwChangeMessage}\nReason: ${reqReason}\n\n💡 Tip: Upgrade your hardware components to meet requirements and earn more from the network!`,
                    metadata: { nodeId }
                  });

                  // --- Real-time WebSocket Updates ---
                  const wsService = getWsService(req);
                  if (wsService) {
                    // 1. Tell the Node software to SHUT DOWN immediately
                    wsService.sendToNode(nodeId, {
                      type: 'command',
                      command: 'node_rejected',
                      reason: reqReason
                    });

                    // 2. Push Notification to User Dashboard (real-time popup)
                    // The frontend handleNotification expects type 'notification:new' 
                    // and then looks into 'data.notification' (emitToUser wraps our payload in a 'data' property)
                    wsService.emitToUser(existingNode.userId.toString(), 'notification:new', {
                      notification: notifyDoc
                    });
                  }

                  // Notify Admins
                  for (const admin of adminUsers) {
                    await Notification.create({
                      userId: admin._id,
                      type: 'system',
                      title: '[Admin Alert] Node Degraded Below Minimum',
                      message: `Node "${existingNode.name}" (${nodeId}) downgraded and failed minimum requirements.\nChanges: ${hwChangeMessage}`,
                      metadata: { nodeId }
                    });
                  }
                }
                else if (isUpgrade) {
                  // Notify User: Encouraging Upgrade
                  await Notification.create({
                    userId: existingNode.userId,
                    type: 'system',
                    title: 'Node Hardware Upgraded! 🚀',
                    message: `Awesome! We noticed you upgraded your node "${existingNode.name}". A benchmark test has been scheduled.\n\nChanges: ${hwChangeMessage}\n\nThis may increase your Node Tier and earnings!`,
                    metadata: { nodeId }
                  });
                }
                else if (isDowngrade) {
                  // Notify User: Downgrade Warning
                  await Notification.create({
                    userId: existingNode.userId,
                    type: 'system',
                    title: 'Node Hardware Degraded',
                    message: `We detected hardware was removed or downgraded on node "${existingNode.name}". A new benchmark test has been scheduled.\n\nChanges: ${hwChangeMessage}\n\nYour Node Tier may be re-evaluated.`,
                    metadata: { nodeId }
                  });
                  // Notify Admins
                  for (const admin of adminUsers) {
                    await Notification.create({
                      userId: admin._id,
                      type: 'system',
                      title: '[Admin Alert] Node Hardware Degraded',
                      message: `Node "${existingNode.name}" (${nodeId}) reported a hardware downgrade.\nChanges: ${hwChangeMessage}`,
                      metadata: { nodeId }
                    });
                  }
                }
              } catch (notifErr) {
                console.error('Failed to send hardware change notifications:', notifErr);
              }
            }
          }
        }
        // --- End Hardware Detection ---

        if (nodeInfo.hardware) {
          existingNode.hardware = {
            ...existingNode.hardware,
            ...nodeInfo.hardware
          };
        }
        if (nodeInfo.capabilities) {
          existingNode.capabilities = {
            ...existingNode.capabilities,
            ...nodeInfo.capabilities
          };
        }
        if (nodeInfo.performance) {
          existingNode.performance = {
            ...(existingNode.performance || {}),
            ...nodeInfo.performance
          };
        }

        // Persist fingerprint / IP fields
        if (incomingFingerprint) existingNode.hardwareFingerprint = incomingFingerprint;
        if (nodeInfo.publicIp) existingNode.publicIp = nodeInfo.publicIp;
        if (nodeInfo.hostname) existingNode.hostname = nodeInfo.hostname;
        if (nodeInfo.hardwareVerifiedAt) existingNode.hardwareVerifiedAt = nodeInfo.hardwareVerifiedAt;
        if (nodeInfo.name) existingNode.name = nodeInfo.name;

        // If node re-regristers while it has active jobs (e.g. after a crash/restart)
        // we must requeue those frames so they aren't lost.
        if (existingNode.activeBullJobIds && existingNode.activeBullJobIds.length > 0) {
          console.log(`🔄 Node ${nodeId} re-registered with ${existingNode.activeBullJobIds.length} leftover jobs. Requeueing...`);
          try {
            // Filter out any items missing lockToken (legacy data) to prevent crashes
            const validJobs = existingNode.activeBullJobIds.filter(j => !!j.lockToken);
            if (validJobs.length > 0) {
              await requeueFramesFromOfflineNode(validJobs, nodeId);
            }
            existingNode.activeBullJobIds = [];
          } catch (err) {
            console.error(`⚠️ Failed to requeue leftover jobs for node ${nodeId}:`, err);
          }
        }

        // Initialize performance tracking if not exists
        if (!existingNode.performance) {
          existingNode.performance = {
            framesRendered: 0,
            totalRenderTime: 0,
            avgFrameTime: 0,
            reliabilityScore: 100,
            lastUpdated: now
          };
        }

        await existingNode.save();

        console.log(`🔄 Node reconnected: ${existingNode.name || nodeId} (${existingNode.status})`);

        // Broadcast node registration via WebSocket (include all hardware data)
        const wsService = getWsService(req);
        if (wsService) {
          wsService.broadcastNodeUpdate(nodeId, {
            status: existingNode.status,
            isRevoked: existingNode.isRevoked, // Add this
            hardware: existingNode.hardware,
            performance: existingNode.performance,
            lastHeartbeat: existingNode.lastHeartbeat,
            registeredAt: now.toISOString()
          });
        }

        res.json({
          success: true,
          message: 'Node updated successfully',
          nodeId,
          heartbeatInterval: 30000
        });
      } else {
        // Create new node with performance tracking
        const node = new Node({
          nodeId,
          userId,
          name: nodeInfo.name || `Node-${nodeId.substring(0, 8)}`,
          status: 'online',
          os: nodeInfo.os || 'Unknown',
          hardware: {
            cpuCores: 1,
            cpuScore: 0,
            gpuName: 'Unknown',
            gpuVRAM: 0,
            gpuScore: 0,
            ramGB: 0,
            blenderVersion: 'unknown',
            ...nodeInfo.hardware
          },
          capabilities: {
            supportedEngines: ['CYCLES', 'EEVEE'],
            supportedGPUs: ['CUDA', 'OPTIX'],
            maxSamples: 1024,
            maxResolutionX: 3840,
            maxResolutionY: 2160,
            supportsTiles: true,
            ...nodeInfo.capabilities
          },
          performance: {
            tier: 'Unknown',
            effectiveScore: 0,
            gpuScore: 0,
            cpuScore: 0,
            framesRendered: 0,
            totalRenderTime: 0,
            avgFrameTime: 0,
            reliabilityScore: 100,
            lastUpdated: now,
            ...nodeInfo.performance
          },
          ipAddress: nodeInfo.ipAddress || '127.0.0.1',
          hardwareFingerprint: incomingFingerprint,
          publicIp: nodeInfo.publicIp,
          hostname: nodeInfo.hostname,
          hardwareVerifiedAt: nodeInfo.hardwareVerifiedAt || now,
          lastHeartbeat: now,
          lastStatusChange: now,
          connectionCount: 1,
          jobsCompleted: 0,
          createdAt: now,
          updatedAt: now
        });

        await node.save();

        console.log('✅ Node registered:', nodeId, incomingFingerprint ? `(fp: ${incomingFingerprint.substring(0, 12)}…)` : '');

        // Broadcast new node registration via WebSocket
        const wsService = getWsService(req);
        if (wsService) {
          wsService.broadcastSystemUpdate({
            type: 'node_registered',
            data: {
              nodeId,
              name: node.name,
              status: node.status,
              hardware: node.hardware,
              registeredAt: now.toISOString()
            }
          });
        }

        res.json({
          success: true,
          message: 'Node registered successfully',
          nodeId,
          heartbeatInterval: 30000
        });
      }

    } catch (error) {
      console.error('❌ Node registration error:', error);
      res.status(500).json({
        error: 'Failed to register node',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  // ── Token-based node registration ─────────────────────────────────────────

  /**
   * POST /api/nodes/tokens/generate
   * Authenticated node_provider generates a one-time pairing token.
   */
  export const generateToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.userId;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const { User } = await import('../../models/User');
      const { RegistrationToken } = await import('../../models/RegistrationToken');
      const { Node } = await import('../../models/Node');

      const user = await User.findById(userId);
      if (!user || !user.roles.includes('node_provider')) {
        res.status(403).json({ success: false, error: 'node_provider role required' });
        return;
      }

      // Enforce maxNodes limit: count non-revoked nodes belonging to this user
      const nodeCount = await Node.countDocuments({ userId, isRevoked: { $ne: true } });
      const maxNodes = user.maxNodes ?? 10;
      if (nodeCount >= maxNodes) {
        res.status(403).json({
          success: false,
          error: 'NODE_LIMIT_REACHED',
          message: `You have reached your node limit (${maxNodes}). Revoke an existing node before adding a new one.`,
          currentCount: nodeCount,
          maxNodes,
        });
        return;
      }

      const { label } = req.body;
      let tokenString = '';
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 10) {
        tokenString = (RegistrationToken as any).generateTokenString
          ? (RegistrationToken as any).generateTokenString()
          : require('crypto').randomBytes(24).toString('hex').toUpperCase();

        const existingToken = await RegistrationToken.findOne({ token: tokenString });
        if (!existingToken) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        res.status(500).json({ success: false, error: 'Failed to generate a unique token after multiple attempts' });
        return;
      }

      const expiresAt = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes

      const token = await RegistrationToken.create({
        token: tokenString,
        userId,
        label: label || undefined,
        expiresAt,
      });

      console.log(`🔑 Registration token generated for user ${userId}: ${tokenString.substring(0, 8)}...`);

      res.json({
        success: true,
        token: tokenString,
        expiresAt,
        label: token.label,
        instructions: 'Paste this token into your node software within 20 minutes. It can only be used once.',
      });
    } catch (error) {
      console.error('❌ Token generation error:', error);
      res.status(500).json({ success: false, error: 'Failed to generate token' });
    }
  }

  /**
   * POST /api/nodes/register-with-token
   * Node software calls this with a registration token.
   * On success returns { nodeId, nodeSecret } — the secret is NEVER stored in plain text again.
   *
   * Secret enforcement is controlled by ENFORCE_NODE_SECRET env var (default: strict / true).
   */
  export const registerWithToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        registrationToken, name, hardware, os, capabilities, performance,
        ipAddress, publicIp, hostname, hardwareFingerprint, hardwareVerifiedAt
      } = req.body;

      if (!registrationToken) {
        res.status(400).json({ success: false, error: 'registrationToken is required' });
        return;
      }

      const bcrypt = await import('bcryptjs');
      const crypto = await import('crypto');
      const { Application } = await import('../../models/Application');
      const { RegistrationToken } = await import('../../models/RegistrationToken');
      const notificationService = (await import('../../services/NotificationService')).notificationService;

      // Find the token
      const tokenDoc = await RegistrationToken.findOne({ token: registrationToken });

      if (!tokenDoc) {
        res.status(400).json({ success: false, error: 'TOKEN_INVALID', message: 'Invalid registration token.' });
        return;
      }
      if (tokenDoc.used || tokenDoc.useCount >= tokenDoc.maxUses) {
        res.status(400).json({ success: false, error: 'TOKEN_ALREADY_USED', message: 'This token has already been used.' });
        return;
      }
      if (new Date() > tokenDoc.expiresAt) {
        res.status(400).json({ success: false, error: 'TOKEN_EXPIRED', message: 'This token has expired. Please generate a new one from the dashboard.' });
        return;
      }

      const userId = tokenDoc.userId;

      // Re-check user still under maxNodes
      const user = await User.findById(userId);
      if (!user) {
        res.status(400).json({ success: false, error: 'USER_NOT_FOUND' });
        return;
      }
      const nodeCount = await Node.countDocuments({ userId, isRevoked: { $ne: true } });
      const maxNodes = user.maxNodes ?? 10;
      if (nodeCount >= maxNodes) {
        res.status(403).json({
          success: false,
          error: 'NODE_LIMIT_REACHED',
          message: `Account node limit (${maxNodes}) reached.`,
        });
        return;
      }

      // ── Hardware Validation & Tagging ─────────────────────────────────────────
      // 1. Minimum Requirements Check
      const incomingHardware = {
        ramGB: hardware?.ramGB,
        gpuVRAM: hardware?.gpuVRAM,
        cpuCores: hardware?.cpuCores,
        gpuName: hardware?.gpuName
      };

      const minCheck = HardwareValidationService.checkMinimumRequirements(incomingHardware);

      if (!minCheck.meetsRequirements) {
        // Notify the user why their node was rejected via WebSocket & DB
        try {
          const notifyTitle = 'Node Registration Rejected';
          const notifyMsg = `Your node "${name || 'Unknown'}" does not meet our minimum hardware requirements. ${minCheck.reason}`;

          await notificationService.createNotification(
            userId,
            'system',
            notifyTitle,
            notifyMsg
          );

          const wsService = req.app.get('wsService');
          if (wsService && wsService.emitToUser) {
            wsService.emitToUser(userId.toString(), 'notification', {
              type: 'system',
              title: notifyTitle,
              message: notifyMsg
            });
          }
        } catch (e) { /* ignore notification errors */ }

        res.status(403).json({
          success: false,
          error: 'HARDWARE_REQUIREMENTS_NOT_MET',
          message: `Node does not meet minimum hardware requirements. ${minCheck.reason}`
        });
        return; // Abort node registration!
      }

      // 2. Suspicion Tagging (against Application Data)
      try {
        const userApplication = await Application.findOne({ userId }).sort({ createdAt: -1 });
        const suspicionLevel = HardwareValidationService.evaluateSuspicionLevel(userApplication, incomingHardware);

        // Only update if it increases the suspicion level (to prevent downgrading a 'complete suspicious' user back to 'none')
        const levels = ['none', 'little suspicious', 'more suspicious', 'complete suspicious'];
        const currentLevelIdx = levels.indexOf(user.suspicionTag || 'none');
        const newLevelIdx = levels.indexOf(suspicionLevel);

        if (newLevelIdx > currentLevelIdx) {
          user.suspicionTag = suspicionLevel;
          await user.save();
          console.warn(`⚠️ User ${userId} tagged as "${suspicionLevel}" due to hardware spec discrepancies on node registration.`);
        }
      } catch (err) {
        console.error('⚠️ Failed to evaluate suspicion level during registration:', err);
        // Non-fatal, continue with registration
      }
      // ────────────────────────────────────────────────────────────────────────

      // ── Disk Space Validation ──────────────────────────────────────────
      const storageFreeGB = hardware?.storageFreeGB;
      if (storageFreeGB !== undefined) {
        const diskCheck = HardwareValidationService.checkFreeDisk(Number(storageFreeGB));
        if (!diskCheck.allowed) {
          res.status(403).json({
            success: false,
            error: 'INSUFFICIENT_DISK_SPACE',
            message: diskCheck.message
          });
          return;
        }
        if (diskCheck.warn) {
          // Create a warning notification for the user
          try {
            await notificationService.createNotification(
              userId,
              'system',
              'Low Disk Space Warning',
              diskCheck.message
            );
          } catch (e) {
            console.error('Failed to send disk warning notification:', e);
          }
        }
      }
      // ──────────────────────────────────────────────────────────────────

      // Generate nodeId + nodeSecret
      const nodeId = `node-${crypto.randomBytes(5).toString('hex')}-${Date.now().toString(36)}`;
      const nodeSecret = crypto.randomBytes(48).toString('hex'); // 96-char hex secret
      const nodeSecretHash = await bcrypt.hash(nodeSecret, 10);

      const nodeName = name || tokenDoc.label || `Node-${nodeId.substring(0, 12)}`;
      const now = new Date();

      // Create the node, permanently linked to the user
      const node = new Node({
        nodeId,
        userId,
        name: nodeName,
        status: 'online',
        os: os || 'Unknown',
        hardware: {
          cpuCores: 1,
          cpuScore: 0,
          gpuName: 'Unknown',
          gpuVRAM: 0,
          gpuScore: 0,
          ramGB: 0,
          blenderVersion: 'unknown',
          ...(hardware || {}),
        },
        capabilities: {
          supportedEngines: ['CYCLES', 'EEVEE'],
          supportedGPUs: ['CUDA', 'OPTIX'],
          maxSamples: 1024,
          maxResolutionX: 3840,
          maxResolutionY: 2160,
          supportsTiles: true,
          ...(capabilities || {}),
        },
        performance: {
          tier: 'Unknown',
          effectiveScore: 0,
          gpuScore: 0,
          cpuScore: 0,
          framesRendered: 0,
          totalRenderTime: 0,
          avgFrameTime: 0,
          reliabilityScore: 100,
          lastUpdated: now,
          ...(performance || {}),
        },
        ipAddress: ipAddress || '0.0.0.0',
        publicIp: publicIp || undefined,
        hostname: hostname || undefined,
        hardwareFingerprint: hardwareFingerprint || undefined,
        hardwareVerifiedAt: hardwareVerifiedAt ? new Date(hardwareVerifiedAt) : now,
        nodeSecretHash,
        registeredViaToken: registrationToken,
        lastHeartbeat: now,
        lastStatusChange: now,
        connectionCount: 1,
        jobsCompleted: 0,
        createdAt: now,
        updatedAt: now,
      });

      await node.save();

      // Mark token as used (atomic)
      await RegistrationToken.updateOne(
        { _id: tokenDoc._id },
        { $set: { used: true, usedAt: now, usedByNodeId: nodeId, useCount: 1 } }
      );

      console.log(`✅ Node registered via token: ${nodeName} (${nodeId}) → user ${userId}`);

      // Send in-app notification + real-time WS push to the token owner
      try {
        await notificationService.createNotification(
          userId,
          'node_registered',
          '🤝 Final Approval Complete: Node Registered',
          `Congratulations! Your hardware meets the requirements. "${nodeName}" has been successfully connected and verified.`,
          { nodeId, nodeName }
        );

        const wsService = req.app.get('wsService');
        if (wsService && wsService.emitToUser) {
          wsService.emitToUser(userId.toString(), 'notification', {
            type: 'node_registered',
            title: '🤝 Final Approval Complete: Node Registered',
            message: `Congratulations! Your hardware meets the requirements. "${nodeName}" has been successfully connected and verified.`,
            nodeId,
            nodeName,
          });
        }

        // Also broadcast system update for the admin dashboard
        if (wsService) {
          wsService.broadcastSystemUpdate({
            type: 'node_registered',
            data: { nodeId, nodeName, userId, timestamp: now.toISOString() },
          });
        }
      } catch (notifyErr) {
        console.warn('⚠️ Failed to send node_registered notification:', notifyErr);
        // Non-fatal — don't fail the registration
      }

      res.status(201).json({
        success: true,
        message: 'Node registered and linked to your account.',
        nodeId,
        nodeSecret,  // Only time the plain-text secret is ever returned
        nodeName,
        heartbeatInterval: 30000,
        warning: 'Store nodeSecret securely — it will never be shown again.',
      });
    } catch (error) {
      console.error('❌ registerWithToken error:', error);
      res.status(500).json({ success: false, error: 'Failed to register node', details: String(error) });
    }
  }

  /**
   * POST /api/nodes/revoke
   * Authenticated node_provider revokes one of their own nodes.
   */
  export const revokeNode = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.userId;
      const { nodeId, reason } = req.body;

      if (!nodeId) {
        res.status(400).json({ success: false, error: 'nodeId is required' });
        return;
      }

      const notificationService = (await import('../../services/NotificationService')).notificationService;

      const node = await Node.findOne({ nodeId });
      if (!node) {
        res.status(404).json({ success: false, error: 'Node not found' });
        return;
      }

      // Only the owner (or admin) can revoke
      const userIdStr = userId?.toString();
      const nodeUserIdStr = node.userId?.toString();
      const isAdmin = authReq.user?.roles?.includes('admin') || authReq.user?.role === 'admin';

      if (!isAdmin && userIdStr !== nodeUserIdStr) {
        res.status(403).json({ success: false, error: 'You do not own this node' });
        return;
      }

      if (node.isRevoked) {
        res.status(400).json({ success: false, error: 'Node is already revoked' });
        return;
      }

      const now = new Date();
      await Node.updateOne(
        { nodeId },
        {
          $set: {
            isRevoked: true,
            revokedAt: now,
            revokedReason: reason || 'Revoked by owner',
            status: 'offline',
            offlineReason: 'Node revoked by owner',
            wsConnected: false,
            updatedAt: now,
            lastStatusChange: now,
          },
        }
      );

      console.log(`🚫 Node revoked: ${nodeId} by user ${userId}. Reason: ${reason || 'N/A'}`);

      // Notify the owner
      try {
        await notificationService.createNotification(
          node.userId,
          'node_revoked',
          '🚫 Node Revoked',
          `"${node.name || nodeId}" has been revoked. ${reason ? `Reason: ${reason}` : ''}`,
          { nodeId, reason }
        );
      } catch { /* non-fatal */ }

      // Broadcast to dashboard
      const wsService = req.app.get('wsService');
      if (wsService) {
        wsService.broadcastSystemUpdate({
          type: 'node_revoked',
          data: { nodeId, nodeName: node.name, reason, timestamp: now.toISOString() },
        });
        wsService.broadcastNodeUpdate(nodeId, {
          status: 'offline',
          isRevoked: true,
          revokedAt: now,
        });
      }

      res.json({ success: true, message: `Node "${node.name || nodeId}" has been revoked.` });
    } catch (error) {
      console.error('❌ revokeNode error:', error);
      res.status(500).json({ success: false, error: 'Failed to revoke node' });
    }
  }

  /**
   * POST /api/nodes/tokens/list
   * Returns active (unused, unexpired) tokens for the authenticated node_provider.
   */
  export const listTokens = async (req: Request, res: Response): Promise<void> => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.userId;
      const { RegistrationToken } = await import('../../models/RegistrationToken');

      const tokens = await RegistrationToken.find({
        userId,
        used: false,
        expiresAt: { $gt: new Date() },
      }).select('-__v').sort({ createdAt: -1 });

      res.json({ success: true, tokens });
    } catch (error) {
      res.status(500).json({ success: false, error: 'Failed to list tokens' });
    }
  }