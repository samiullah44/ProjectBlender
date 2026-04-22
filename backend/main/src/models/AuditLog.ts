import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  adminId: mongoose.Types.ObjectId;
  action: string; // e.g., 'USER_BAN', 'USER_UNBAN', 'APPLICATION_APPROVE', 'APPLICATION_REJECT', 'FEE_UPDATE'
  targetId?: string; // e.g., userId, jobId, nodeId
  targetType?: string; // 'User' | 'Job' | 'Node' | 'Application' | 'Config'
  details?: any; // JSON object with extra info
  previousValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: { type: String, required: true, index: true },
  targetId: { type: String, index: true },
  targetType: { type: String, index: true },
  details: { type: Schema.Types.Mixed },
  previousValue: { type: Schema.Types.Mixed },
  newValue: { type: Schema.Types.Mixed },
  ipAddress: String,
  userAgent: String,
  createdAt: { type: Date, default: Date.now, index: true }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
