import mongoose, { Schema, Document } from 'mongoose';

export type ReportReason =
  | 'spam'
  | 'misinformation'
  | 'hate_speech'
  | 'harassment'
  | 'inappropriate_content'
  | 'other';

export interface IReport extends Document {
  targetType: 'blog' | 'comment';
  targetId: mongoose.Types.ObjectId;
  reportedBy: mongoose.Types.ObjectId;   // ref: User
  reason: ReportReason;
  details?: string;                       // optional extra context
  status: 'pending' | 'reviewed' | 'dismissed';
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<IReport>(
  {
    targetType: { type: String, enum: ['blog', 'comment'], required: true },
    targetId:   { type: Schema.Types.ObjectId, required: true },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: {
      type: String,
      enum: ['spam', 'misinformation', 'hate_speech', 'harassment', 'inappropriate_content', 'other'],
      required: true,
    },
    details: { type: String, maxlength: 500, trim: true },
    status: { type: String, enum: ['pending', 'reviewed', 'dismissed'], default: 'pending' },
  },
  { timestamps: true }
);

// One report per user per target — prevent duplicate reports
reportSchema.index({ targetId: 1, reportedBy: 1 }, { unique: true });
// Efficient admin queries by status
reportSchema.index({ status: 1, createdAt: -1 });

export const Report = mongoose.model<IReport>('Report', reportSchema);
