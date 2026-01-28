import mongoose from 'mongoose';

export interface IFrameAssignment {
  jobId: string;
  frameNumber: number;
  nodeId: string;
  status: 'pending' | 'rendering' | 'completed' | 'failed';
  outputUrl?: string;
  renderTime?: number;
  error?: string;
  assignedAt: Date;
  completedAt?: Date;
}

export interface ITileAssignment {
  jobId: string;
  tileX: number;
  tileY: number;
  nodeId: string;
  status: 'pending' | 'rendering' | 'completed' | 'failed';
  outputUrl?: string;
  renderTime?: number;
  error?: string;
  assignedAt: Date;
  completedAt?: Date;
}

const frameAssignmentSchema = new mongoose.Schema<IFrameAssignment>({
  jobId: { type: String, required: true },
  frameNumber: { type: Number, required: true },
  nodeId: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'rendering', 'completed', 'failed'],
    default: 'pending'
  },
  outputUrl: String,
  renderTime: Number,
  error: String,
  assignedAt: { type: Date, default: Date.now },
  completedAt: Date
});

const tileAssignmentSchema = new mongoose.Schema<ITileAssignment>({
  jobId: { type: String, required: true },
  tileX: { type: Number, required: true },
  tileY: { type: Number, required: true },
  nodeId: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'rendering', 'completed', 'failed'],
    default: 'pending'
  },
  outputUrl: String,
  renderTime: Number,
  error: String,
  assignedAt: { type: Date, default: Date.now },
  completedAt: Date
});

// Compound indexes for faster queries
frameAssignmentSchema.index({ jobId: 1, frameNumber: 1 }, { unique: true });
frameAssignmentSchema.index({ nodeId: 1, status: 1 });
frameAssignmentSchema.index({ jobId: 1, status: 1 });

tileAssignmentSchema.index({ jobId: 1, tileX: 1, tileY: 1 }, { unique: true });
tileAssignmentSchema.index({ nodeId: 1, status: 1 });
tileAssignmentSchema.index({ jobId: 1, status: 1 });

export const FrameAssignment = mongoose.model<IFrameAssignment>('FrameAssignment', frameAssignmentSchema);
export const TileAssignment = mongoose.model<ITileAssignment>('TileAssignment', tileAssignmentSchema);