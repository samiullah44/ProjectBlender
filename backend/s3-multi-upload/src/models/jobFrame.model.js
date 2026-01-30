// src/models/jobFrame.model.js
import mongoose from 'mongoose';
const { Schema } = mongoose;

const JobFrameSchema = new Schema({
  jobId: { type: String, required: true, index: true },
  frameNumber: { type: Number, required: true },
  assignedNode: { type: String },
  status: { type: String, enum: ['pending','assigned','rendered','failed'], default: 'pending' },
  renderTime: { type: Number },
  creditsEarned: { type: Number },
  outputUrl: { type: String },
  s3Key: { type: String },
  updatedAt: { type: Date, default: Date.now },
});

JobFrameSchema.index({ jobId: 1, frameNumber: 1 }, { unique: true });

const JobFrame = mongoose.model('JobFrame', JobFrameSchema);
export default JobFrame;
