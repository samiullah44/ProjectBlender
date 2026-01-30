// Shared types for the application
export interface Job {
  jobId: string;
  projectId: string;
  userId: string;
  blendFileUrl: string;
  blendFileName: string;
  type: 'image' | 'animation';
  
  settings: {
    engine: string;
    device: string;
    samples: number;
    resolutionX: number;
    resolutionY: number;
    denoiser?: string;
    tileSize?: number;
  };
  
  frames: {
    start: number;
    end: number;
    total: number;
    rendered: number[];
    failed: number[];
  };
  
  tiles?: {
    totalX: number;
    totalY: number;
    rendered: string[];
  };
  
  assignedNodes: Map<string, number[]>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  
  outputUrls: string[];
  renderTime?: number;
  
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface Node {
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
    supportedEngines: string[];
    supportedGPUs: string[];
    maxSamples: number;
    maxResolutionX: number;
    maxResolutionY: number;
    supportsTiles: boolean;
  };
  ipAddress: string;
  lastHeartbeat: Date;
  currentJob?: string;
  jobsCompleted: number;
  createdAt: Date;
  updatedAt: Date;
}