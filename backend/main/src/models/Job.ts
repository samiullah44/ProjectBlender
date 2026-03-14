// backend/src/models/Job.ts
import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  IJob,
  IJobOutput,
  IFrameAssignment,
  IJobSettings,
  IJobFrames,
  IJobTiles,
  IUploadMetadata
} from '../types/job.types';

// Helper schemas
const JobOutputSchema = new Schema<IJobOutput>({
  frame: { type: Number, required: true },
  url: { type: String, required: true },
  s3Key: { type: String, required: true },
  fileSize: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now },
  thumbnailUrl: String
});

const FrameAssignmentSchema = new Schema<IFrameAssignment>({
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
  s3Key: String,
  errorMessage: String
});

const JobSettingsSchema = new Schema<IJobSettings>({
  engine: {
    type: String,
    enum: ['CYCLES', 'EEVEE', 'BLENDER_EEVEE'],
    default: 'CYCLES'
  },
  device: {
    type: String,
    enum: ['CPU', 'GPU', 'GPU_CUDA', 'GPU_OPTIX'],
    default: 'GPU'
  },
  samples: { type: Number, default: 128 },
  resolutionX: { type: Number, default: 1920 },
  resolutionY: { type: Number, default: 1080 },
  tileSize: { type: Number, default: 256 },
  denoiser: {
    type: String,
    enum: ['NONE', 'OPTIX', 'OPENIMAGEDENOISE', 'NLM']
  },
  outputFormat: {
    type: String,
    enum: ['PNG', 'JPEG', 'EXR', 'TIFF', 'TARGA', 'BMP', 'OPEN_EXR'],
    default: 'PNG'
  },
  colorMode: {
    type: String,
    enum: ['BW', 'RGB', 'RGBA'],
    default: 'RGBA'
  },
  colorDepth: {
    type: String,
    enum: ['8', '16', '32'],
    default: '8'
  },
  compression: { type: Number, default: 90 },
  exrCodec: {
    type: String,
    enum: ['ZIP', 'PIZ', 'RLE', 'ZIPS', 'BXR', 'DWAA', 'DWAB'],
    default: 'ZIP'
  },
  tiffCodec: {
    type: String,
    enum: ['NONE', 'PACKBITS', 'DEFLATE', 'LZW'],
    default: 'DEFLATE'
  },
  scene: String,
  camera: String,
  creditsPerFrame: { type: Number, default: 1 },
  blenderVersion: { type: String, default: '4.5.0' },
  selectedFrame: Number,
  animationFrameRate: Number,
  useCompositing: Boolean,
  useSequencer: Boolean
});

const JobFramesSchema = new Schema<IJobFrames>({
  start: { type: Number, default: 1 },
  end: { type: Number, default: 1 },
  total: { type: Number, default: 1 },
  selected: { type: [Number], default: [] },
  rendered: { type: [Number], default: [] },
  failed: { type: [Number], default: [] },
  assigned: { type: [Number], default: [] },
  pending: { type: [Number], default: [] }
});

const JobTilesSchema = new Schema<IJobTiles>({
  totalX: Number,
  totalY: Number,
  rendered: [String],
  failed: [String],
  assigned: [String]
});

const UploadMetadataSchema = new Schema<IUploadMetadata>({
  type: {
    type: String,
    enum: ['multipart', 'single', 'direct'],
    default: 'single'
  },
  uploadId: String,
  parts: Number,
  completedAt: Date,
  fileSize: Number,
  checksum: String
});

// Main Job Schema
const JobSchema = new Schema<IJob>({
  jobId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  projectId: {
    type: String,
    required: true,
    default: 'default-project'
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
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
  name: {
    type: String
  },
  type: {
    type: String,
    enum: ['image', 'animation'],
    required: true
  },
  inputType: {
    type: String,
    enum: ['blend', 'archive'],
    default: 'blend'
  },

  // Settings
  settings: JobSettingsSchema,

  // Frames
  frames: JobFramesSchema,

  // Tiles (optional)
  tiles: JobTilesSchema,

  // Distribution
  assignedNodes: {
    type: Map,
    of: [Number],
    default: new Map()
  },

  // Enhanced tracking
  frameAssignments: [FrameAssignmentSchema],

  uploadMetadata: UploadMetadataSchema,

  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'paused'],
    default: 'pending',
    index: true
  },

  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
    index: true
  },

  // Results
  outputUrls: [JobOutputSchema],

  renderTime: Number,
  totalCreditsDistributed: Number,

  // Metadata
  estimatedRenderTime: Number,
  estimatedCost: Number,
  actualCost: Number,
  tags: [String],
  description: String,

  // Timestamps
  cancelledAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  completedAt: { type: Date, index: true },
  startedAt: Date,
  pausedAt: Date,

  // System fields
  retryCount: { type: Number, default: 0 },
  maxRetries: { type: Number, default: 3 },
  userRerenderCount: { type: Number, default: 0 },
  userRerenderMax: { type: Number, default: 2 },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  requireApproval: Boolean,
  approved: Boolean,
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  rerenderedHistory: { type: [Number], default: [] }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for faster dashboard sorting and filtering
JobSchema.index({ userId: 1, createdAt: -1 });
JobSchema.index({ status: 1, createdAt: -1 });
JobSchema.index({ projectId: 1, createdAt: -1 });

// Virtual for calculating pending frames
JobSchema.virtual('pendingFrames').get(function () {
  return this.frames.total - this.frames.rendered.length - this.frames.failed.length;
});

// Virtual for user relationship
JobSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Virtual for node relationships
JobSchema.virtual('nodes', {
  ref: 'Node',
  localField: 'assignedNodes',
  foreignField: 'nodeId',
  justOne: false
});

// Pre-save middleware
JobSchema.pre('save', function (next) {
  this.updatedAt = new Date();

  // Auto-calculate pending frames
  if (this.isModified('frames')) {
    const total = this.frames.total;
    const rendered = this.frames.rendered.length;
    const failed = this.frames.failed.length;
    const assigned = this.frames.assigned.length;

    // Calculate pending frames by filtering selected frames that are not rendered or failed
    if (this.frames.selected && this.frames.selected.length > 0) {
      this.frames.pending = this.frames.selected.filter(
        (f: number) => !this.frames.rendered.includes(f) && !this.frames.failed.includes(f)
      );
    } else {
      this.frames.pending = [];
    }

    // Update progress
    if (total > 0) {
      this.progress = Math.round((rendered / total) * 100);
    }
  }

  next();
});

// Indexes for optimized queries
JobSchema.index({ jobId: 1, userId: 1 });
JobSchema.index({ userId: 1, status: 1 });
JobSchema.index({ userId: 1, createdAt: -1 });
JobSchema.index({ projectId: 1, userId: 1 });
JobSchema.index({ status: 1, priority: -1, createdAt: 1 });
JobSchema.index({ tags: 1 });
JobSchema.index({ approved: 1, status: 1 });
JobSchema.index({ createdAt: -1 });
JobSchema.index({ updatedAt: -1 });
JobSchema.index({ 'frameAssignments.nodeId': 1 });
JobSchema.index({ 'frameAssignments.status': 1 });

// Static methods
JobSchema.statics.findByUserId = function (userId: string, options: any = {}) {
  const { page = 1, limit = 50, status, type, sortBy = 'createdAt', sortOrder = 'desc' } = options;

  const query: any = { userId };
  if (status) query.status = status;
  if (type) query.type = type;

  const skip = (page - 1) * limit;

  return this.find(query)
    .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'username name email')
    .lean();
};

JobSchema.statics.getUserStats = async function (userId: string) {
  const stats = await this.aggregate([
    { $match: { userId: new Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        totalJobs: { $sum: 1 },
        completedJobs: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        activeJobs: {
          $sum: {
            $cond: [{ $in: ['$status', ['pending', 'processing', 'paused']] }, 1, 0]
          }
        },
        totalSpent: { $sum: { $ifNull: ['$actualCost', 0] } },
        totalCreditsSpent: { $sum: { $ifNull: ['$totalCreditsDistributed', 0] } },
        totalRenderTime: { $sum: { $ifNull: ['$renderTime', 0] } },
        totalFramesRendered: {
          $sum: { $size: { $ifNull: ['$frames.rendered', []] } }
        }
      }
    }
  ]);

  return stats[0] || {
    totalJobs: 0,
    completedJobs: 0,
    activeJobs: 0,
    totalSpent: 0,
    totalCreditsSpent: 0,
    totalRenderTime: 0,
    totalFramesRendered: 0
  };
};

// Instance methods
JobSchema.methods.assignFrameToNode = async function (frame: number, nodeId: string) {
  if (this.frames.assigned.includes(frame)) {
    throw new Error(`Frame ${frame} is already assigned`);
  }

  this.frames.assigned.push(frame);

  const assignedNodes = this.assignedNodes.get(nodeId) || [];
  assignedNodes.push(frame);
  this.assignedNodes.set(nodeId, assignedNodes);

  this.frameAssignments.push({
    frame,
    nodeId,
    status: 'assigned',
    assignedAt: new Date()
  });

  await this.save();
  return this;
};

JobSchema.methods.completeFrame = async function (frame: number, data: Partial<IFrameAssignment>) {
  const assignment = this.frameAssignments.find(
    (a: IFrameAssignment) => a.frame === frame && a.nodeId === data.nodeId
  );

  if (!assignment) {
    throw new Error(`No assignment found for frame ${frame}`);
  }

  // Update assignment
  Object.assign(assignment, {
    ...data,
    status: 'rendered',
    completedAt: new Date()
  });

  // Update frames
  const frameIndex = this.frames.assigned.indexOf(frame);
  if (frameIndex > -1) {
    this.frames.assigned.splice(frameIndex, 1);
  }
  this.frames.rendered.push(frame);

  // Remove from assigned nodes
  const nodeFrames = this.assignedNodes.get(data.nodeId!) || [];
  const updatedFrames = nodeFrames.filter((f: number) => f !== frame);
  if (updatedFrames.length === 0) {
    this.assignedNodes.delete(data.nodeId!);
  } else {
    this.assignedNodes.set(data.nodeId!, updatedFrames);
  }

  // Update progress
  const total = this.frames.total;
  const rendered = this.frames.rendered.length;
  this.progress = Math.round((rendered / total) * 100);

  // Update status if complete
  if (rendered === total) {
    const oldStatus = this.status;
    this.status = 'completed';
    const now = new Date();
    this.completedAt = now;
    
    // REFINE: Use session-based wall-clock accumulation
    // Only accumulate if we were previously in a non-final state
    if (oldStatus !== 'completed' && oldStatus !== 'failed' && oldStatus !== 'cancelled') {
        const sessionStart = this.startedAt || this.createdAt;
        const sessionDurationMs = Math.max(0, now.getTime() - sessionStart.getTime());
        this.renderTime = (this.renderTime || 0) + sessionDurationMs;
    }
  }

  await this.save();
  return this;
};

JobSchema.methods.failFrame = async function (frame: number, nodeId: string, errorMessage: string) {
  const assignment = this.frameAssignments.find(
    (a: IFrameAssignment) => a.frame === frame && a.nodeId === nodeId
  );

  if (!assignment) {
    throw new Error(`No assignment found for frame ${frame}`);
  }

  // Update assignment
  assignment.status = 'failed';
  assignment.errorMessage = errorMessage;
  assignment.completedAt = new Date();

  // Update frames
  const frameIndex = this.frames.assigned.indexOf(frame);
  if (frameIndex > -1) {
    this.frames.assigned.splice(frameIndex, 1);
  }
  this.frames.failed.push(frame);

  // Remove from assigned nodes
  const nodeFrames = this.assignedNodes.get(nodeId) || [];
  const updatedFrames = nodeFrames.filter((f: number) => f !== frame);
  if (updatedFrames.length === 0) {
    this.assignedNodes.delete(nodeId);
  } else {
    this.assignedNodes.set(nodeId, updatedFrames);
  }

  // Check if all frames failed
  if (this.frames.failed.length === this.frames.total) {
    this.status = 'failed';
  }

  await this.save();
  return this;
};

export const Job = mongoose.model<IJob>('Job', JobSchema);