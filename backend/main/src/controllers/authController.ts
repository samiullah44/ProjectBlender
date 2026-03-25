// backend/src/controllers/authController.ts
import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { authService } from '../services/AuthService';
import { validateEmail, validatePassword } from '../utils/authUtils';
import { env } from '../config/env';

export class AuthController {
  // Register new user
  static async register(req: Request, res: Response) {
    try {
      const { email, username, name, password, role } = req.body;

      // Validation
      if (!email || !username || !name || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email, username, name, and password are required'
        });
      }

      if (!validateEmail(email)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email format'
        });
      }

      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: passwordValidation.errors.join(', ')
        });
      }

      if (role && !['client', 'node_provider'].includes(role)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid role'
        });
      }

      const result = await authService.register(
        email,
        username,
        name,
        password,
        (role as 'client' | 'node_provider') || 'client'
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.status(201).json(result);
    } catch (error: any) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Verify OTP
  static async verifyOTP(req: Request, res: Response) {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.status(400).json({
          success: false,
          error: 'Email and OTP are required'
        });
      }

      const result = await authService.verifyOTP(email, otp);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error: any) {
      console.error('OTP verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Login user
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required'
        });
      }

      const result = await authService.login(email, password);

      if (!result.success) {
        return res.status(401).json(result);
      }

      res.json(result);
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Forgot password
  static async forgotPassword(req: Request, res: Response) {
    try {
      const { email, resetUrl } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email is required'
        });
      }

      const result = await authService.forgotPassword(email, resetUrl);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error: any) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Reset password
  static async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Token and new password are required'
        });
      }

      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: passwordValidation.errors.join(', ')
        });
      }

      const result = await authService.resetPassword(token, newPassword);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error: any) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Get user profile
  static async getProfile(req: AuthRequest, res: Response) {
    try {
      const user = await authService.getProfile(req.user.userId);
      const token = authService.generateToken(user);

      res.json({
        success: true,
        token: token,
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          name: user.name,
          role: user.role,
          roles: user.roles,
          primaryRole: user.primaryRole,
          credits: user.credits,
          isVerified: user.isVerified,
          provider: user.provider,
          stats: user.stats,
          preferences: user.preferences,
          nodeProvider: user.nodeProvider,
          nodeProviderStatus: user.nodeProviderStatus,
          nodeProviderApplication: user.nodeProviderApplication,
          rejectionReason: user.rejectionReason,
          createdAt: user.createdAt,
          lastLoginAt: user.lastLoginAt
        }
      });
    } catch (error: any) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get profile'
      });
    }
  }

  // Update user profile
  static async updateProfile(req: AuthRequest, res: Response) {
    try {
      const { username, name, preferences } = req.body;

      // Basic validation
      if (username && username.length < 3) {
        return res.status(400).json({
          success: false,
          error: 'Username must be at least 3 characters long'
        });
      }

      if (name && name.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Name must be at least 2 characters long'
        });
      }

      const result = await authService.updateProfile(req.user.userId, {
        username,
        name,
        preferences
      });

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error: any) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update profile'
      });
    }
  }

  // Resend OTP
  static async resendOTP(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Email is required'
        });
      }

      const result = await authService.resendOTP(email);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error: any) {
      console.error('Resend OTP error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // OAuth callbacks
  static async googleCallback(req: Request, res: Response) {
    try {
      const { profile } = req.body;

      if (!profile || !profile.email) {
        return res.status(400).json({
          success: false,
          error: 'Invalid profile data'
        });
      }

      const result = await authService.oauthAuthenticate(profile, 'google');

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error: any) {
      console.error('Google OAuth error:', error);
      res.status(500).json({
        success: false,
        error: 'Google authentication failed'
      });
    }
  }

  static async githubCallback(req: Request, res: Response) {
    try {
      const { profile } = req.body;

      if (!profile || !profile.email) {
        return res.status(400).json({
          success: false,
          error: 'Invalid profile data'
        });
      }

      const result = await authService.oauthAuthenticate(profile, 'github');

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error: any) {
      console.error('GitHub OAuth error:', error);
      res.status(500).json({
        success: false,
        error: 'GitHub authentication failed'
      });
    }
  }

  // Add credits (admin only)
  static async addCredits(req: AuthRequest, res: Response) {
    try {
      const { userId, amount } = req.body;

      if (!userId || !amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Valid userId and amount are required'
        });
      }

      const user = await authService.addCredits(userId, amount);

      res.json({
        success: true,
        message: 'Credits added successfully',
        credits: user.credits
      });
    } catch (error: any) {
      console.error('Add credits error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add credits'
      });
    }
  }

  // Health check
  static async healthCheck(req: Request, res: Response) {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'auth',
      version: '1.0.0'
    });
  }

  // Apply as Node Provider
  static async applyAsNodeProvider(req: AuthRequest, res: Response) {
    try {
      const applicationData = req.body;
      const result = await authService.applyForNodeProvider(req.user.userId, applicationData);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error: any) {
      console.error('Apply as node provider error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit application'
      });
    }
  }

  // Approve Node Provider Application (Admin)
  static async approveApplication(req: AuthRequest, res: Response) {
    try {
      const { userId } = req.params;
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }
      const result = await authService.approveNodeProviderApplication(userId as string, req.user.userId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error: any) {
      console.error('Approve application error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to approve application'
      });
    }
  }

  // Reject Node Provider Application (Admin)
  static async rejectApplication(req: AuthRequest, res: Response) {
    try {
      const { userId } = req.params;
      const { reason } = req.body;

      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'Rejection reason is required'
        });
      }

      const result = await authService.rejectNodeProviderApplication(userId as string, req.user.userId, reason);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error: any) {
      console.error('Reject application error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reject application'
      });
    }
  }

  // Update Primary Role
  static async updatePrimaryRole(req: AuthRequest, res: Response) {
    try {
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({
          success: false,
          error: 'Role is required'
        });
      }

      const result = await authService.updatePrimaryRole(req.user.userId, role);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error: any) {
      console.error('Update primary role error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update primary role'
      });
    }
  }

  // Get Node Provider applications (Admin)
  static async getApplications(req: AuthRequest, res: Response) {
    try {
      const applications = await authService.getNodeProviderApplications();

      res.json({
        success: true,
        applications
      });
    } catch (error: any) {
      console.error('Get applications error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get applications'
      });
    }
  }
}