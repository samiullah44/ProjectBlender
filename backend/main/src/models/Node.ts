import mongoose from 'mongoose';

export interface INode {
  nodeId: string;
  name?: string;
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
  performance?: { // ADD THIS
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
  connectionCount: number; // ADD THIS
  lastStatusChange?: Date; // ADD THIS (optional since it might not exist on older records)
  resourceHistory?: Array<{ // ADD THIS (optional)
    cpuUsage?: number;
    gpuUsage?: number;
    ramUsage?: number;
    vramUsage?: number;
    timestamp: Date;
  }>;
  lastResources?: { // ADD THIS (optional)
    cpuUsage?: number;
    gpuUsage?: number;
    ramUsage?: number;
    vramUsage?: number;
    timestamp: Date;
  };
  offlineReason?: string; // ADD THIS (optional)
  currentProgress?: number; // ADD THIS (optional)
  createdAt: Date;
  updatedAt: Date;
}

const nodeSchema = new mongoose.Schema<INode>({
  nodeId: { type: String, required: true, unique: true },
  name: String,
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
  ipAddress: String,
  lastHeartbeat: Date,
  currentJob: String,
  jobsCompleted: { type: Number, default: 0 },
  connectionCount: { type: Number, default: 0 }, // ADD THIS
  lastStatusChange: Date, // ADD THIS
  resourceHistory: [{ // ADD THIS
    cpuUsage: Number,
    gpuUsage: Number,
    ramUsage: Number,
    vramUsage: Number,
    timestamp: Date
  }],
  lastResources: { // ADD THIS
    cpuUsage: Number,
    gpuUsage: Number,
    ramUsage: Number,
    vramUsage: Number,
    timestamp: Date
  },
  offlineReason: String, // ADD THIS
  currentProgress: Number, // ADD THIS
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const Node = mongoose.model<INode>('Node', nodeSchema);