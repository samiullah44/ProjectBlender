import { AuditLog, IAuditLog } from '../models/AuditLog';
import { Request } from 'express';

export class AuditService {
  /**
   * Logs an administrative action.
   */
  public static async log(params: {
    adminId: string;
    action: string;
    targetId?: string;
    targetType?: string;
    details?: any;
    previousValue?: any;
    newValue?: any;
    req?: Request;
  }): Promise<void> {
    try {
      const { adminId, action, targetId, targetType, details, previousValue, newValue, req } = params;
      
      const logEntry = new AuditLog({
        adminId,
        action,
        targetId,
        targetType,
        details,
        previousValue,
        newValue,
        ipAddress: req?.ip || req?.socket.remoteAddress,
        userAgent: Array.isArray(req?.headers['user-agent']) 
          ? req?.headers['user-agent'].join(' ') 
          : req?.headers['user-agent'] as string
      });

      await logEntry.save();
      console.log(`[AuditLog] ${action} by ${adminId} on ${targetType}:${targetId}`);
    } catch (error) {
      console.error('[AuditService] Failed to create audit log:', error);
    }
  }

  /**
   * Retrieves audit logs with optional filtering.
   */
  public static async getLogs(query: any = {}, options: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('adminId', 'name email'),
      AuditLog.countDocuments(query)
    ]);

    return { logs, total, page, pages: Math.ceil(total / limit) };
  }
}
