// backend/src/models/Node.ts
import mongoose from 'mongoose';

export interface INode {
  nodeId: string;
  name?: string;
  userId: mongoose.Types.ObjectId;
  status: 'online' | 'offline' | 'busy' | 'maintenance';
  os: string;
  hardware: {
    cpuModel?: string;
    cpuCores: number;
    cpuThreads?: number;
    cpuSpeedGHz?: number;
    cpuScore: number;
    gpuName: string;
    gpuVRAM: number;
    gpuScore: number;
    allGpus?: Array<{
      model: string;
      vramMB: number;
      cudaSupported?: boolean;
      optixSupported?: boolean;
    }>;
    ramGB: number;
    ramAvailableGB?: number;
    ramType?: string;
    storageFreeGB?: number;
    storageType?: string;
    uploadSpeedMbps?: number;
    downloadSpeedMbps?: number;
    latencyMs?: number;
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
    tier?: string;                // 'Low' | 'Mid' | 'High' | 'Enterprise'
    effectiveScore?: number;
    gpuScore?: number;
    cpuScore?: number;
    framesRendered: number;
    totalRenderTime: number;
    avgFrameTime: number;
    reliabilityScore: number;
    lastUpdated: Date;
    benchmarkDate?: Date;
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
  hardwareFingerprint?: string;    // SHA-256 of CPU+RAM+GPU+BIOS+MB+Disk
  hardwareVerifiedAt?: Date;
  publicIp?: string;
  hostname?: string;
  wsConnected?: boolean;           // true while node holds an active WS connection
  wsConnectedAt?: Date;
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
    cpuModel: String,
    cpuCores: Number,
    cpuThreads: Number,
    cpuSpeedGHz: Number,
    cpuScore: Number,
    gpuName: String,
    gpuVRAM: Number,
    gpuScore: Number,
    allGpus: [{
      model: String,
      vramMB: Number,
      cudaSupported: Boolean,
      optixSupported: Boolean
    }],
    ramGB: Number,
    ramAvailableGB: Number,
    ramType: String,
    storageFreeGB: Number,
    storageType: String,
    uploadSpeedMbps: Number,
    downloadSpeedMbps: Number,
    latencyMs: Number,
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
    tier: { type: String, default: 'Unknown' },
    effectiveScore: { type: Number, default: 0 },
    gpuScore: { type: Number, default: 0 },
    cpuScore: { type: Number, default: 0 },
    framesRendered: { type: Number, default: 0 },
    totalRenderTime: { type: Number, default: 0 },
    avgFrameTime: { type: Number, default: 0 },
    reliabilityScore: { type: Number, default: 100 },
    lastUpdated: { type: Date, default: Date.now },
    benchmarkDate: Date
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
  hardwareFingerprint: { type: String, index: true, sparse: true },
  hardwareVerifiedAt: Date,
  publicIp: String,
  hostname: String,
  wsConnected: { type: Boolean, default: false },
  wsConnectedAt: Date,
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