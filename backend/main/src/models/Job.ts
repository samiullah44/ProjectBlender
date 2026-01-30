import mongoose, { Schema, Document } from 'mongoose';

// Interface for output URL with S3 metadata
export interface IJobOutput {
  frame: number;
  url: string;           // Pre-signed URL
  s3Key: string;         // S3 key for the file
  fileSize: number;
  uploadedAt: Date;
}

// Frame assignment tracking interface
export interface IFrameAssignment {
  frame: number;
  nodeId: string;
  status: 'assigned' | 'rendered' | 'failed';
  assignedAt: Date;
  completedAt?: Date;
  renderTime?: number; // Time taken to render this frame in seconds
  creditsEarned?: number; // Credits earned for this frame
  s3Key?: string; // S3 key for the rendered frame
}

// Main Job interface
export interface IJob extends Document {
  jobId: string;
  projectId: string;
  userId: string;
  blendFileKey: string;    // S3 key for blend file
  blendFileUrl: string;    // Pre-signed URL for blend file
  blendFileName: string;
  type: 'image' | 'animation';
  
  // Render settings
  settings: {
    engine: string;           // CYCLES, EEVEE
    device: string;           // CPU, GPU
    samples: number;
    resolutionX: number;
    resolutionY: number;
    tileSize: number;         // For tiled rendering
    denoiser?: string;        // OPTIX, OPENIMAGEDENOISE
    outputFormat?: string;    // PNG, JPEG, EXR, etc.
    creditsPerFrame?: number; // Credits allocated per frame (optional)
  };
  
  // Frames information
  frames: {
    start: number;
    end: number;
    total: number;
    selected: number[];
    rendered: number[];      // Successfully rendered frames
    failed: number[];        // Failed frames
    assigned: number[];      // Currently assigned frames
  };
  
  // Tiles information (for single image rendering)
  tiles?: {
    totalX: number;
    totalY: number;
    rendered: string[];      // Format: "x_y"
  };
  
  // Distribution - which node is rendering which frames
  assignedNodes: Map<string, number[]>;  // nodeId -> frames[]
  
  // Enhanced distribution tracking
  frameAssignments: IFrameAssignment[];
  
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'; 
  progress: number;  // 0-100
  
  // Results - now using IJobOutput structure
  outputUrls: IJobOutput[];
  renderTime?: number;  // Total render time in seconds
  totalCreditsDistributed?: number; // Total credits distributed to nodes
  
  // Timestamps
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// Job schema definition
const jobSchema = new mongoose.Schema<IJob>({
  jobId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  projectId: { 
    type: String, 
    required: true,
    default: 'default-project'
  },
  userId: { 
    type: String, 
    required: true,
    default: 'default-user'
  },
  blendFileKey: { 
    type: String, 
    required: true 
  },
  blendFileUrl: { 
    type: String, 
    required: true 
  },
  blendFileName: { 
    type: String,
    required: true
  },
  type: { 
    type: String, 
    enum: ['image', 'animation'], 
    required: true 
  },
  
  // Render settings
  settings: {
    engine: { 
      type: String, 
      default: 'CYCLES' 
    },
    device: { 
      type: String, 
      default: 'GPU' 
    },
    samples: { 
      type: Number, 
      default: 128 
    },
    resolutionX: { 
      type: Number, 
      default: 1920 
    },
    resolutionY: { 
      type: Number, 
      default: 1080 
    },
    tileSize: { 
      type: Number, 
      default: 256 
    },
    denoiser: { 
      type: String 
    },
    outputFormat: { 
      type: String, 
      default: 'PNG' 
    },
    creditsPerFrame: {
      type: Number,
      default: 1 // Default 1 credit per frame
    }
  },
  
  // Frames information
  frames: {
    start: { 
      type: Number, 
      default: 1 
    },
    end: { 
      type: Number, 
      default: 1 
    },
    total: { 
      type: Number, 
      default: 1 
    },
    rendered: { 
      type: [Number], 
      default: [] 
    },
    failed: { 
      type: [Number], 
      default: [] 
    },
    assigned: { 
      type: [Number], 
      default: [] 
    }
  },
  
  // Tiles information (optional)
  tiles: {
    totalX: Number,
    totalY: Number,
    rendered: [String]
  },
  
  // Distribution tracking
  assignedNodes: {
    type: Map,
    of: [Number],
    default: new Map()
  },
  
  // Enhanced frame assignment tracking
  frameAssignments: [{
    frame: { type: Number, required: true },
    nodeId: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['assigned', 'rendered', 'failed'],
      default: 'assigned'
    },
    assignedAt: { type: Date, default: Date.now },
    completedAt: Date,
    renderTime: Number,
    creditsEarned: Number,
    s3Key: String
  }],
  
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  
  progress: { 
    type: Number, 
    default: 0, 
    min: 0, 
    max: 100 
  },
  
  // Results - updated for S3 storage
  outputUrls: [{
    frame: { 
      type: Number, 
      required: true 
    },
    url: { 
      type: String, 
      required: true 
    },
    s3Key: { 
      type: String, 
      required: true 
    },
    fileSize: { 
      type: Number, 
      required: true 
    },
    uploadedAt: { 
      type: Date, 
      default: Date.now 
    }
  }],
  
  renderTime: Number,
  totalCreditsDistributed: Number,
  
  // Timestamps
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  },
  cancelledAt: Date,
  completedAt: Date
});

// Middleware to update updatedAt timestamp
jobSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Middleware for findOneAndUpdate operations
jobSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

// Indexes for optimized queries
// jobSchema.index({ jobId: 1 }, { unique: true });
jobSchema.index({ status: 1, createdAt: 1 });
jobSchema.index({ projectId: 1, status: 1 });
jobSchema.index({ userId: 1, createdAt: -1 });
jobSchema.index({ 'frames.rendered': 1 });
jobSchema.index({ 'frames.assigned': 1 });
jobSchema.index({ 'outputUrls.s3Key': 1 });
jobSchema.index({ blendFileKey: 1 });
jobSchema.index({ createdAt: -1 });
jobSchema.index({ updatedAt: -1 });
jobSchema.index({ 'frameAssignments.nodeId': 1 });
jobSchema.index({ 'frameAssignments.frame': 1 });
jobSchema.index({ 'frameAssignments.status': 1 });

// Virtual field for pending frames count
jobSchema.virtual('frames.pending').get(function() {
  const total = this.frames.total;
  const rendered = this.frames.rendered.length;
  const failed = this.frames.failed.length;
  return total - rendered - failed;
});

// Method to calculate progress
jobSchema.methods.calculateProgress = function(): number {
  const total = this.frames.total;
  const rendered = this.frames.rendered.length;
  return total > 0 ? Math.round((rendered / total) * 100) : 0;
};

// Method to get all output URLs with fresh pre-signed URLs
jobSchema.methods.getFreshOutputUrls = async function(s3Service: any) {
  const freshUrls = await Promise.all(
    this.outputUrls.map(async (output: IJobOutput) => ({
      ...output,
      freshUrl: await s3Service.generateDownloadUrl(output.s3Key)
    }))
  );
  return freshUrls;
};

// Method to get frames rendered by a specific node
jobSchema.methods.getFramesByNode = function(nodeId: string): number[] {
  return this.frameAssignments
    .filter((assignment: IFrameAssignment) => 
      assignment.nodeId === nodeId && assignment.status === 'rendered'
    )
    .map((assignment: IFrameAssignment) => assignment.frame);
};

// Method to get credits earned by a specific node
jobSchema.methods.getCreditsByNode = function(nodeId: string): number {
  return this.frameAssignments
    .filter((assignment: IFrameAssignment) => 
      assignment.nodeId === nodeId && assignment.status === 'rendered'
    )
    .reduce((total: number, assignment: IFrameAssignment) => 
      total + (assignment.creditsEarned || 0), 0
    );
};

// Method to calculate total render time by node
jobSchema.methods.getRenderTimeByNode = function(nodeId: string): number {
  return this.frameAssignments
    .filter((assignment: IFrameAssignment) => 
      assignment.nodeId === nodeId && assignment.status === 'rendered'
    )
    .reduce((total: number, assignment: IFrameAssignment) => 
      total + (assignment.renderTime || 0), 0
    );
};

// Method to update frame assignment
jobSchema.methods.updateFrameAssignment = async function(
  frame: number, 
  nodeId: string, 
  updates: Partial<IFrameAssignment>
) {
  const assignment = this.frameAssignments.find(
    (a: IFrameAssignment) => a.frame === frame && a.nodeId === nodeId
  );
  
  if (assignment) {
    Object.assign(assignment, updates);
    if (updates.status === 'rendered' && !assignment.completedAt) {
      assignment.completedAt = new Date();
    }
    await this.save();
  }
  
  return assignment;
};

// Static method to find jobs by status with pagination
jobSchema.statics.findByStatus = function(
  status: string, 
  page: number = 1, 
  limit: number = 50
) {
  const skip = (page - 1) * limit;
  return this.find({ status })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get job statistics with node contributions
jobSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalFrames: { $sum: '$frames.total' },
        renderedFrames: { $sum: { $size: '$frames.rendered' } },
        avgProgress: { $avg: '$progress' },
        totalCredits: { $sum: '$totalCreditsDistributed' }
      }
    },
    {
      $project: {
        status: '$_id',
        count: 1,
        totalFrames: 1,
        renderedFrames: 1,
        avgProgress: { $round: ['$avgProgress', 2] },
        totalCredits: 1,
        _id: 0
      }
    }
  ]);
  
  return stats;
};

// Static method to get node contributions across all jobs
jobSchema.statics.getNodeContributions = async function() {
  const result = await this.aggregate([
    { $unwind: '$frameAssignments' },
    { 
      $match: { 
        'frameAssignments.status': 'rendered' 
      } 
    },
    {
      $group: {
        _id: '$frameAssignments.nodeId',
        totalFramesRendered: { $sum: 1 },
        totalRenderTime: { $sum: '$frameAssignments.renderTime' },
        totalCreditsEarned: { $sum: '$frameAssignments.creditsEarned' },
        avgFrameTime: { $avg: '$frameAssignments.renderTime' }
      }
    },
    {
      $project: {
        nodeId: '$_id',
        totalFramesRendered: 1,
        totalRenderTime: { $round: ['$totalRenderTime', 2] },
        totalCreditsEarned: 1,
        avgFrameTime: { $round: ['$avgFrameTime', 2] },
        _id: 0
      }
    },
    { $sort: { totalCreditsEarned: -1 } }
  ]);
  
  return result;
};

export const Job = mongoose.model<IJob>('Job', jobSchema);