// backend/src/services/WebSocketService.ts
import WebSocket, { WebSocketServer } from 'ws';
import { Job } from '../models/Job';
import { Node } from '../models/Node';
import { Server } from 'http';
import { getQueueStats } from './FrameQueueService';

interface Client {
  ws: WebSocket;
  subscriptions: Set<string>;
  userId?: string;
  nodeId?: string;
  isNode?: boolean;   // true when this is a C# node client (not a browser)
}

export class WebSocketService {
  private wss: WebSocketServer;
  private clients: Set<Client> = new Set();
  private jobSubscriptions: Map<string, Set<Client>> = new Map();
  // keyed by nodeId — only one entry per node (latest connection wins)
  private nodeClients: Map<string, Client> = new Map();
  // keyed by userId — set of clients connected for that user (rooms)
  private userClients: Map<string, Set<Client>> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server });
    this.initialize();
  }

  private initialize() {
    this.wss.on('connection', (ws, req) => {
      const client: Client = { ws, subscriptions: new Set() };
      this.clients.add(client);

      console.log(`✅ New WebSocket connection from ${req.socket.remoteAddress}`);

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(client, message);
        } catch (error) {
          console.error('WebSocket message error:', error);
          this.send(client, {
            type: 'error',
            message: 'Invalid message format'
          });
        }
      });

      ws.on('close', () => {
        console.log(`❌ WebSocket connection closed`);
        this.clients.delete(client);
        // If this was a node, clear its WS connection state
        if (client.isNode && client.nodeId) {
          this.nodeClients.delete(client.nodeId);
          this.markNodeWsDisconnected(client.nodeId).catch(() => { });
        }
        // Clean up user rooms
        if (client.userId) {
          const userSet = this.userClients.get(client.userId);
          if (userSet) {
            userSet.delete(client);
            if (userSet.size === 0) {
              this.userClients.delete(client.userId);
            }
          }
        }

        // Clean up subscriptions
        for (const [jobId, clients] of this.jobSubscriptions) {
          clients.delete(client);
          if (clients.size === 0) {
            this.jobSubscriptions.delete(jobId);
          }
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(client);
      });

      // Send welcome message
      this.send(client, {
        type: 'connected',
        message: 'WebSocket connected successfully',
        timestamp: Date.now()
      });
    });

    console.log('✅ WebSocket server started on /ws');
  }

  private async handleMessage(client: Client, message: any) {
    try {
      switch (message.type) {
        case 'subscribe':
          if (message.event) {
            await this.handleSubscribe(client, message.event, message.data);
          }
          break;
        case 'unsubscribe':
          if (message.event) {
            this.handleUnsubscribe(client, message.event);
          }
          break;
        case 'auth':
          await this.handleAuth(client, message);
          break;
        case 'ping':
          this.send(client, { type: 'pong', timestamp: Date.now() });
          break;
        // ── Node-originated messages ──────────────────────────────────────
        case 'node_connect':
          await this.handleNodeConnect(client, message);
          break;
        case 'heartbeat':
          await this.handleNodeHeartbeat(client, message);
          break;
        case 'pong':
          // Echo from node — no action needed
          break;
        default:
          this.send(client, {
            type: 'error',
            message: `Unknown message type: ${message.type}`
          });
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      this.send(client, {
        type: 'error',
        message: 'Internal server error'
      });
    }
  }

  private async handleSubscribe(client: Client, event: string, data?: any) {
    if (event.startsWith('job:')) {
      const jobId = event.split(':')[1];
      if (!jobId) {
        this.send(client, {
          type: 'error',
          message: 'Invalid job ID format'
        });
        return;
      }

      try {
        // Verify job exists
        const job = await Job.findOne({ jobId });
        if (!job) {
          this.send(client, {
            type: 'error',
            message: `Job ${jobId} not found`
          });
          return;
        }

        if (!this.jobSubscriptions.has(jobId)) {
          this.jobSubscriptions.set(jobId, new Set());
        }
        this.jobSubscriptions.get(jobId)!.add(client);
        client.subscriptions.add(event);

        // Send current job state immediately
        const jobData = await this.getJobData(jobId);
        if (jobData) {
          this.send(client, {
            type: 'job_update',
            event,
            data: jobData,
            timestamp: Date.now()
          });
        }

        console.log(`📡 Client subscribed to job ${jobId}`);
      } catch (error) {
        console.error('Error subscribing to job:', error);
        this.send(client, {
          type: 'error',
          message: 'Failed to subscribe to job'
        });
      }
    } else if (event.startsWith('node:')) {
      // Handle node subscriptions
      const nodeId = event.split(':')[1];
      client.subscriptions.add(event);
      console.log(`📡 Client subscribed to node ${nodeId}`);
    }
  }

  private handleUnsubscribe(client: Client, event: string) {
    if (event.startsWith('job:')) {
      const jobId = event.split(':')[1];
      if (!jobId) return;

      const subscribers = this.jobSubscriptions.get(jobId);
      if (subscribers) {
        subscribers.delete(client);
        if (subscribers.size === 0) {
          this.jobSubscriptions.delete(jobId);
        }
      }
    }
    client.subscriptions.delete(event);
    console.log(`📡 Client unsubscribed from ${event}`);
  }

  // ── Node connection & heartbeat handlers ──────────────────────────────────

  private async handleNodeConnect(client: Client, message: any): Promise<void> {
    const { nodeId, hardwareFingerprint, hostname, localIP, publicIP } = message;
    if (!nodeId) {
      this.send(client, { type: 'error', message: 'node_connect requires nodeId' });
      return;
    }

    client.nodeId = nodeId;
    client.isNode = true;
    // Replace any stale connection for this node
    const existing = this.nodeClients.get(nodeId);
    if (existing && existing !== client) {
      existing.ws.close(1000, 'replaced by newer connection');
      this.clients.delete(existing);
    }
    this.nodeClients.set(nodeId, client);

    try {
      const node = await Node.findOne({ nodeId });
      const newStatus = (node && node.currentJob) ? 'busy' : 'online';

      await Node.updateOne(
        { nodeId },
        {
          $set: {
            wsConnected: true,
            wsConnectedAt: new Date(),
            status: newStatus,
            lastHeartbeat: new Date(),
            updatedAt: new Date(),
            ...(hardwareFingerprint && { hardwareFingerprint }),
            ...(publicIP && { publicIp: publicIP }),
            ...(hostname && { hostname }),
            ...(localIP && { ipAddress: localIP })
          }
        }
      );
    } catch (err) {
      console.error(`Failed to update node ${nodeId} on WS connect:`, err);
    }

    console.log(`✅ Node connected via WebSocket: ${nodeId}`);
    this.send(client, { type: 'ack', nodeId, message: 'connected', timestamp: Date.now() });

    // Immediately ask the freshly-connected node to poll for pending jobs.
    // This handles jobs that existed in the DB before the node came online.
    setTimeout(() => {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(JSON.stringify({ type: 'request_job_poll', timestamp: Date.now() }));
          console.log(`📢 Sent request_job_poll to newly connected node ${nodeId}`);
        } catch (err) {
          console.error(`Failed to send initial job poll to node ${nodeId}:`, err);
        }
      }
    }, 1500); // small delay so the node finishes its connect handshake first

    // Notify dashboard
    this.broadcastSystemUpdate({ type: 'node_ws_connected', data: { nodeId, timestamp: Date.now() } });
  }

  private async handleNodeHeartbeat(client: Client, message: any): Promise<void> {
    const nodeId = client.nodeId || message.nodeId;
    if (!nodeId) return;

    const now = new Date();
    try {
      const resources = message.resources || {};

      // Status auto-recovery: if node is 'busy' but job is inactive, reset it
      const node = await Node.findOne({ nodeId });
      if (node && node.status === 'busy' && node.currentJob) {
        const activeJob = await Job.findOne({ jobId: node.currentJob }).select('status').lean() as any;
        if (!activeJob || ['cancelled', 'completed', 'failed'].includes(activeJob.status)) {
          console.log(`🔄 Heartbeat Recovery: Node ${nodeId} was stuck in 'busy' for ${activeJob?.status || 'missing'} job, resetting to 'online'`);
          await Node.updateOne(
            { nodeId },
            { $set: { status: 'online', currentJob: undefined, currentProgress: undefined } }
          );
        }
      }

      await Node.updateOne(
        { nodeId },
        {
          $set: {
            lastHeartbeat: now,
            updatedAt: now,
            'lastResources': { ...resources, timestamp: now }
          },
          $push: {
            resourceHistory: {
              $each: [{ ...resources, timestamp: now }],
              $slice: -10
            }
          }
        }
      );
    } catch (err) {
      console.error(`Failed to update node ${nodeId} heartbeat:`, err);
    }

    // FIX (Ghost Rendering): tell the WS-connected node to stop immediately if its current
    // job was cancelled, completed, or failed.
    let command: string | undefined;
    if (message.currentJob) {
      const activeJob = await Job.findOne({ jobId: message.currentJob })
        .select('status')
        .lean() as any;
      if (activeJob && ['cancelled', 'completed', 'failed'].includes(activeJob.status)) {
        command = 'STOP_JOB';
        console.log(`🛑 Sending STOP_JOB to WS node ${nodeId} — job ${message.currentJob} is ${activeJob.status}`);
      }
    }

    console.log(`💓 WS Heartbeat from ${nodeId}`);

    // Acknowledge back to node
    this.send(client, {
      type: 'ack',
      nodeId,
      timestamp: Date.now(),
      ...(command ? { command } : {})
    });

    // Broadcast heartbeat to dashboard subscribers
    this.broadcastSystemUpdate({
      type: 'node_heartbeat',
      data: { nodeId, status: 'online', timestamp: now.toISOString() }
    });
    await this.broadcastNodeUpdate(nodeId, {
      status: 'online',
      lastHeartbeat: now,
      resources: message.resources
    });
  }

  private async markNodeWsDisconnected(nodeId: string): Promise<void> {
    try {
      await Node.updateOne(
        { nodeId },
        { $set: { wsConnected: false, updatedAt: new Date() } }
      );
    } catch { /* ignore */ }
    console.log(`⚠️  Node ${nodeId} WS disconnected`);
    this.broadcastSystemUpdate({ type: 'node_ws_disconnected', data: { nodeId, timestamp: Date.now() } });
  }

  // ── Node-push API (used by NodeController to push jobs to nodes) ──────────

  /** Push a message directly to a connected node, returns true if delivered */
  public sendToNode(nodeId: string, data: any): boolean {
    const client = this.nodeClients.get(nodeId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return false;
    try {
      client.ws.send(JSON.stringify({ ...data, timestamp: Date.now() }));
      return true;
    } catch (err) {
      console.error(`Failed to send to node ${nodeId}:`, err);
      return false;
    }
  }

  /** Returns true if the node has an active WS connection */
  public isNodeConnected(nodeId: string): boolean {
    const client = this.nodeClients.get(nodeId);
    return !!client && client.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Tells every connected node to poll the /assign endpoint immediately.
   * Called after a new job is created so idle nodes pick it up without
   * waiting for their next REST fallback poll interval.
   */
  public async notifyNodesToCheckJobs(): Promise<void> {
    let notified = 0;
    try {
      // SMART CHECK: Only bother nodes if there are actually frames waiting in BullMQ
      const stats = await getQueueStats();
      if (stats.waiting === 0) {
        // No waiting jobs, no need to notify
        return;
      }

      // Find all online nodes (not busy) from the database
      const onlineNodes = await Node.find({
        nodeId: { $in: Array.from(this.nodeClients.keys()) }
      }).select('nodeId status');

      const freeNodes = onlineNodes.filter(n => n.status === 'online');
      const busyNodes = onlineNodes.filter(n => n.status === 'busy');

      if (onlineNodes.length === 0) {
        console.log(`⚠️  Job Notification: No WS-connected nodes found in database tracking.`);
      }

      for (const [nodeId, client] of this.nodeClients) {
        if (freeNodes.some(n => n.nodeId === nodeId) && client.ws.readyState === WebSocket.OPEN) {
          try {
            client.ws.send(JSON.stringify({ type: 'request_job_poll', timestamp: Date.now() }));
            notified++;
          } catch (err) {
            console.error(`Failed to notify node ${nodeId} to check jobs:`, err);
          }
        }
      }

      if (notified > 0) {
        console.log(`📢 Notified ${notified} free connected node(s) to poll for jobs (${stats.waiting} frames waiting)`);
      } else if (onlineNodes.length > 0) {
        console.log(`ℹ️  Job Notification: Found ${onlineNodes.length} connected nodes, but ${freeNodes.length} are online and ${busyNodes.length} are busy. No one was notified.`);
      }
    } catch (err) {
      console.error('Error during notifyNodesToCheckJobs status query:', err);
    }
  }

  // ── Auth handler ──────────────────────────────────────────────────────────

  private async handleAuth(client: Client, message: any) {
    try {
      // Implement authentication if needed
      if (message.userId) {
        // Remove from old room if changed
        if (client.userId && client.userId !== message.userId) {
          const oldSet = this.userClients.get(client.userId);
          if (oldSet) {
            oldSet.delete(client);
            if (oldSet.size === 0) this.userClients.delete(client.userId);
          }
        }

        client.userId = message.userId;

        // Add to new room
        if (!this.userClients.has(message.userId)) {
          this.userClients.set(message.userId, new Set());
        }
        this.userClients.get(message.userId)!.add(client);
      }

      if (message.nodeId) {
        client.nodeId = message.nodeId;
      }
      this.send(client, {
        type: 'auth_success',
        message: 'Authentication successful',
        userId: client.userId
      });
      console.log(`🔐 WS User Authenticated: ${client.userId}`);
    } catch (error) {
      this.send(client, {
        type: 'auth_error',
        message: 'Authentication failed'
      });
    }
  }

  private send(client: Client, data: any) {
    try {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(data));
      } else {
        // Remove disconnected client
        this.clients.delete(client);
      }
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      this.clients.delete(client);
    }
  }

  // Send message to a specific user (using rooms)
  public emitToUser(userId: string, type: string, data: any) {
    const clients = this.userClients.get(userId);
    if (!clients || clients.size === 0) return;

    const message = {
      type,
      data,
      timestamp: Date.now()
    };
    const messageJson = JSON.stringify(message);

    for (const client of clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(messageJson);
        } catch (error) {
          console.error(`Error emitting to user client in room ${userId}:`, error);
        }
      }
    }
  }

  // Broadcast job updates to all subscribed clients
  public async broadcastJobUpdate(jobId: string) {
    const subscribers = this.jobSubscriptions.get(jobId);
    if (!subscribers) return;

    try {
      const jobData = await this.getJobData(jobId);
      if (!jobData) return;

      const updateMessage = {
        type: 'job_update',
        event: `job:${jobId}`,
        data: jobData,
        timestamp: Date.now()
      };

      const messageJson = JSON.stringify(updateMessage);

      for (const client of subscribers) {
        if (client.ws.readyState === WebSocket.OPEN) {
          try {
            client.ws.send(messageJson);
          } catch (error) {
            console.error('Error broadcasting to client:', error);
            this.clients.delete(client);
            subscribers.delete(client);
          }
        } else {
          // Remove disconnected client
          this.clients.delete(client);
          subscribers.delete(client);
        }
      }

      // Clean up empty subscriptions
      if (subscribers.size === 0) {
        this.jobSubscriptions.delete(jobId);
      }
    } catch (error) {
      console.error('Error broadcasting job update:', error);
    }
  }

  // Broadcast node updates
  public async broadcastNodeUpdate(nodeId: string, data: any) {
    const updateMessage = {
      type: 'node_update',
      event: `node:${nodeId}`,
      data,
      timestamp: Date.now()
    };

    const messageJson = JSON.stringify(updateMessage);

    for (const client of this.clients) {
      if (client.subscriptions.has(`node:${nodeId}`) && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(messageJson);
        } catch (error) {
          console.error('Error broadcasting node update:', error);
        }
      }
    }
  }

  // Broadcast system-wide updates
  public broadcastSystemUpdate(data: any) {
    const updateMessage = {
      type: 'system_update',
      data,
      timestamp: Date.now()
    };

    const messageJson = JSON.stringify(updateMessage);

    for (const client of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(messageJson);
        } catch (error) {
          console.error('Error broadcasting system update:', error);
        }
      }
    }
  }

  private async getJobData(jobId: string) {
    try {
      const job = await Job.findOne({ jobId });
      if (!job) return null;

      // Real-time Sync: If job is stuck in processing but all frames are done, update it
      if (['pending', 'pending_payment', 'processing'].includes(job.status)) {
        const selectedOrAll = job.frames.selected && job.frames.selected.length > 0
          ? job.frames.selected
          : Array.from({ length: job.frames.total }, (_, i) => job.frames.start + i);

        const totalFramesToRender = selectedOrAll.length;
        const renderedFrames = job.frames.rendered.length;
        const stillInFlight = job.frames.assigned.length;
        const stillFailed = job.frames.failed.filter((f: number) => !job.frames.rendered.includes(f)).length;

        if ((renderedFrames + stillFailed >= totalFramesToRender) && stillInFlight === 0) {
          const oldStatus = job.status;
          if (renderedFrames > 0) {
            job.status = 'completed';
          } else if (stillFailed > 0) {
            job.status = 'failed';
          }

          if (job.status !== oldStatus) {
            job.completedAt = new Date();
            
            // REFINE: Use session-based wall-clock accumulation (User requirement)
            const sessionStart = job.startedAt || job.createdAt;
            const sessionDurationMs = Math.max(0, job.completedAt.getTime() - sessionStart.getTime());
            
            // Add current session to accumulated time
            job.renderTime = (job.renderTime || 0) + sessionDurationMs;
            
            await job.save();
            console.log(`🔌 WS Sync: Job ${jobId} auto-completed during subscription`);
          }
        }
      }

      // Calculate statistics for returned data
      const totalFrames = job.frames.total;
      const renderedFrames = job.frames.rendered.length;
      const failedFrames = job.frames.failed.length;
      const pendingFrames = totalFrames - renderedFrames - failedFrames;
      const progress = totalFrames > 0 ? Math.round((renderedFrames / totalFrames) * 100) : 0;

      // Convert assignedNodes Map to plain object safely
      let assignedNodes = {};
      if (job.assignedNodes) {
        if (job.assignedNodes instanceof Map) {
          assignedNodes = Object.fromEntries(job.assignedNodes);
        } else if (typeof job.assignedNodes === 'object') {
          assignedNodes = job.assignedNodes as any;
        }
      }

      return {
        jobId: job.jobId,
        status: job.status,
        progress: progress,
        frames: {
          total: totalFrames,
          renderedCount: renderedFrames,
          failedCount: failedFrames,
          pendingCount: pendingFrames,
          rendered: job.frames.rendered || [],
          failed: job.frames.failed || [],
          start: job.frames.start,
          end: job.frames.end,
          assigned: job.frames.assigned || [],
          selected: job.frames.selected || []
        },
        outputUrls: job.outputUrls || [],
        settings: job.settings,
        blendFileName: job.blendFileName,
        blendFileUrl: job.blendFileUrl,
        blendFileKey: job.blendFileKey,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        completedAt: job.completedAt,
        renderTime: job.renderTime,
        assignedNodes: assignedNodes,
        frameAssignments: job.frameAssignments || [],
        type: job.type,
        projectId: job.projectId,
        userId: job.userId,
        userRerenderCount: job.userRerenderCount || 0,
        userRerenderMax: job.userRerenderMax || 0,
        rerenderedHistory: job.rerenderedHistory || []
      };
    } catch (error) {
      console.error('Error getting job data:', error);
      return null;
    }
  }

  // Periodically broadcast system stats
  public startStatsBroadcast(intervalMs = 30000) {
    setInterval(async () => {
      try {
        const stats = await this.getSystemStats();
        this.broadcastSystemUpdate(stats);
      } catch (error) {
        console.error('Error broadcasting stats:', error);
      }
    }, intervalMs);
  }

  private async getSystemStats() {
    try {
      const [totalJobs, activeJobs, completedJobs, totalNodes, activeNodes] = await Promise.all([
        Job.countDocuments(),
        Job.countDocuments({ status: { $in: ['pending', 'processing'] } }),
        Job.countDocuments({ status: 'completed' }),
        Node.countDocuments(),
        Node.countDocuments({ status: { $in: ['online', 'busy'] } })
      ]);

      return {
        type: 'system_stats',
        data: {
          globalJobs: totalJobs,
          globalActiveJobs: activeJobs,
          globalCompletedJobs: completedJobs,
          totalNodes,
          activeNodes,
          timestamp: Date.now(),
          connectedClients: this.clients.size
        }
      };
    } catch (error) {
      console.error('Error getting system stats:', error);
      return {
        type: 'system_stats',
        data: {
          error: 'Failed to fetch system stats',
          timestamp: Date.now()
        }
      };
    }
  }

  // Clean up disconnected clients periodically
  public startCleanupInterval(intervalMs = 60000) {
    setInterval(() => {
      let removed = 0;
      for (const client of this.clients) {
        if (client.ws.readyState !== WebSocket.OPEN) {
          this.clients.delete(client);
          removed++;
        }
      }
      if (removed > 0) {
        console.log(`🧹 Cleaned up ${removed} disconnected WebSocket clients`);
      }
    }, intervalMs);
  }

  public getConnectionCount() {
    return this.clients.size;
  }

  public getSubscriptionCount(jobId?: string) {
    if (jobId) {
      return this.jobSubscriptions.get(jobId)?.size || 0;
    }
    let total = 0;
    for (const subscribers of this.jobSubscriptions.values()) {
      total += subscribers.size;
    }
    return total;
  }
}