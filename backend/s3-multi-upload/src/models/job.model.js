import mongoose from "mongoose";
const { Schema, model } = mongoose;

/**
 * Embedded file metadata
 */
const JobInputFileSchema = new Schema({
  s3Key: { type: String, required: true }, // store the S3 file path
  uploadId: { type: String, required: true }, // store the multipart upload ID
  uploadedAt: { type: Date, default: Date.now },
});

/**
 * Embedded output URLs
 */
const JobOutputUrlSchema = new Schema({
  frame: { type: Number, required: true },
  s3Key: { type: String, required: true },
  url: { type: String, required: true },
  fileSize: { type: Number, required: true },
  uploadedAt: { type: Date, default: Date.now },
});

/**
 * Main Job Schema
 */
const JobSchema = new Schema({
  jobId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  projectId: { type: String, default: "default-project" },
  type: { type: String, enum: ["image", "animation"], required: true },

  settings: {
    engine: { type: String, default: "CYCLES" },
    device: { type: String, default: "GPU" },
    samples: { type: Number, default: 128 },
    resolutionX: { type: Number, default: 1920 },
    resolutionY: { type: Number, default: 1080 },
    tileSize: { type: Number, default: 256 },
    denoiser: { type: String },
    outputFormat: { type: String, default: "PNG" },
    selectedFrame: { type: Number },
  },

  inputFiles: [JobInputFileSchema],
  outputUrls: [JobOutputUrlSchema],

  status: {
    type: String,
    enum: ["pending", "processing", "completed", "failed", "cancelled"],
    default: "pending",
  },
  progress: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// ✅ Pre-save hook
JobSchema.pre("save", function () {
  this.updatedAt = new Date();
});

// ✅ Pre findOneAndUpdate hook (query middleware does NOT receive `next`)
JobSchema.pre("findOneAndUpdate", function () {
  this.set({ updatedAt: new Date() });
});

const Job = model("Job", JobSchema);

export default Job;
