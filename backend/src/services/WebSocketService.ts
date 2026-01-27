// backend/src/services/WebSocketService.ts
import WebSocket, { WebSocketServer } from 'ws';
import { Job } from '../models/Job';
import { Node } from '../models/Node';
import { Server } from 'http';

interface Client {
  ws: WebSocket;
  subscriptions: Set<string>;
  userId?: string;
  nodeId?: string;
}

export class WebSocketService {
  private wss: WebSocketServer;
  private clients: Set<Client> = new Set();
  private jobSubscriptions: Map<string, Set<Client>> = new Map();

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

  private async handleAuth(client: Client, message: any) {
    try {
      // Implement authentication if needed
      if (message.userId) {
        client.userId = message.userId;
      }
      if (message.nodeId) {
        client.nodeId = message.nodeId;
      }
      this.send(client, { 
        type: 'auth_success', 
        message: 'Authentication successful' 
      });
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
      const job = await Job.findOne({ jobId }).lean();
      if (!job) return null;

      // Calculate pending frames
      const totalFrames = job.frames.total;
      const renderedFrames = job.frames.rendered.length;
      const failedFrames = job.frames.failed.length;
      const pendingFrames = totalFrames - renderedFrames - failedFrames;

      // Convert assignedNodes Map to plain object safely
      let assignedNodes = {};
      if (job.assignedNodes) {
        if (job.assignedNodes instanceof Map) {
          assignedNodes = Object.fromEntries(job.assignedNodes);
        } else if (typeof job.assignedNodes === 'object') {
          assignedNodes = job.assignedNodes;
        }
      }

      return {
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
        frames: {
          total: totalFrames,
          rendered: renderedFrames,
          failed: failedFrames,
          pending: pendingFrames,
          list: job.frames.rendered,
          start: job.frames.start,
          end: job.frames.end,
          assigned: job.frames.assigned || []
        },
        outputUrls: job.outputUrls || [],
        settings: job.settings,
        blendFileName: job.blendFileName,
        blendFileUrl: job.blendFileUrl,
        blendFileKey: job.blendFileKey,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        completedAt: job.completedAt,
        assignedNodes: assignedNodes,
        frameAssignments: job.frameAssignments || [],
        type: job.type,
        projectId: job.projectId,
        userId: job.userId
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
          totalJobs,
          activeJobs,
          completedJobs,
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