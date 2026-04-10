// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/AuthService';

export interface AuthRequest extends Request {
  user?: any;
}

// Authentication middleware
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication token required'
      });
    }

    const decoded = authService.verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    // Proactive check for revoked users
    const { User } = require('../models/User');
    const user = await User.findById(decoded.userId).select('isRevoked');
    if (!user || user.isRevoked) {
      return res.status(401).json({
        success: false,
        error: 'Account suspended or not found'
      });
    }

    req.user = decoded;

    // ── IMPERSONATION SUPPORT ────────────────────────────────────────────────
    const impersonatedUserId = req.headers['x-impersonating-user'] as string;
    if (impersonatedUserId && req.user.roles?.includes('admin')) {
      const { User } = require('../models/User');
      const targetUser = await User.findById(impersonatedUserId).lean();
      if (targetUser) {
        req.user = {
          userId: targetUser._id.toString(),
          email: targetUser.email,
          username: targetUser.username,
          roles: targetUser.roles || [targetUser.role],
          isImpersonated: true,
          adminId: decoded.userId // Original admin ID for audit trail
        };
        console.log(`[Auth] Admin ${decoded.userId} impersonating user ${impersonatedUserId}`);
      }
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

// Role-based authorization middleware
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userRoles = req.user.roles || [req.user.role];
    const hasPermission = roles.some(role => userRoles.includes(role));

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Optional authentication (attaches user if token exists)
export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    if (token) {
      const decoded = authService.verifyToken(token);
      if (decoded) {
        req.user = decoded;
      }
    }

    next();
  } catch (error) {
    next();
  }
};