// backend/src/models/Node.ts
import mongoose from 'mongoose';

export interface INode {
  nodeId: string;
  name?: string;
  userId: mongoose.Types.ObjectId;
  status: 'online' | 'offline' | 'busy' | 'maintenance';
  os: string;
  hardware: {
    cpuCores: number;
    cpuScore: number;
    gpuName: string;
    gpuVRAM: number;
    gpuScore: number;
    ramGB: number;
    blenderVersion: string;
  };
  capabilities: {
    supportedEngines: string[];  // ['CYCLES', 'EEVEE']
    supportedGPUs: string[];     // ['CUDA', 'OPTIX', 'OPENCL']
    maxSamples: number;
    maxResolutionX: number;
    maxResolutionY: number;
    supportsTiles: boolean;
  };
  performance?: {
    framesRendered: number;
    totalRenderTime: number;
    avgFrameTime: number;
    reliabilityScore: number;
    lastUpdated: Date;
  };
  ipAddress: string;
  lastHeartbeat: Date;
  currentJob?: string;
  jobsCompleted: number;
  connectionCount: number;
  lastStatusChange?: Date;
  resourceHistory?: Array<{
    cpuUsage?: number;
    gpuUsage?: number;
    ramUsage?: number;
    vramUsage?: number;
    timestamp: Date;
  }>;
  lastResources?: {
    cpuUsage?: number;
    gpuUsage?: number;
    ramUsage?: number;
    vramUsage?: number;
    timestamp: Date;
  };
  offlineReason?: string;
  currentProgress?: number;
  createdAt: Date;
  updatedAt: Date;
}

const nodeSchema = new mongoose.Schema<INode>({
  nodeId: { type: String, required: true, unique: true },
  name: String,
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true,
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'busy', 'maintenance'],
    default: 'online'
  },
  os: { type: String, required: true },
  hardware: {
    cpuCores: Number,
    cpuScore: Number,
    gpuName: String,
    gpuVRAM: Number,
    gpuScore: Number,
    ramGB: Number,
    blenderVersion: String
  },
  capabilities: {
    supportedEngines: [String],
    supportedGPUs: [String],
    maxSamples: Number,
    maxResolutionX: Number,
    maxResolutionY: Number,
    supportsTiles: Boolean
  },
  performance: {
    framesRendered: { type: Number, default: 0 },
    totalRenderTime: { type: Number, default: 0 },
    avgFrameTime: { type: Number, default: 0 },
    reliabilityScore: { type: Number, default: 100 },
    lastUpdated: { type: Date, default: Date.now }
  },
  ipAddress: String,
  lastHeartbeat: { type: Date, default: Date.now },
  currentJob: String,
  jobsCompleted: { type: Number, default: 0 },
  connectionCount: { type: Number, default: 0 },
  lastStatusChange: { type: Date, default: Date.now },
  resourceHistory: [{
    cpuUsage: Number,
    gpuUsage: Number,
    ramUsage: Number,
    vramUsage: Number,
    timestamp: { type: Date, default: Date.now }
  }],
  lastResources: {
    cpuUsage: Number,
    gpuUsage: Number,
    ramUsage: Number,
    vramUsage: Number,
    timestamp: Date
  },
  offlineReason: String,
  currentProgress: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Pre-save validation: Ensure user has node_provider role
nodeSchema.pre('save', async function (next) {
  if (this.isModified('userId') && this.userId) {
    const User = mongoose.model('User');
    const user = await User.findById(this.userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user has node_provider role (using roles array)
    const hasNodeRole = user.roles && user.roles.includes('node_provider');

    if (!hasNodeRole) {
      throw new Error('User must have node_provider role to register nodes');
    }
  }
  next();
});

// Update timestamp on save
nodeSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const Node = mongoose.model<INode>('Node', nodeSchema);