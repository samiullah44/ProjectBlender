// backend/src/controllers/authController.ts
import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { authService } from '../services/AuthService';
import { User } from '../models/User';

export class AuthController {
  // Register new user
  static async register(req: Request, res: Response) {
    try {
      const { email, username, password, role } = req.body;

      if (!email || !username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email, username, and password are required'
        });
      }

      const result = await authService.register(
        email,
        username,
        password,
        role || 'client'
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

  // Get user profile
  static async getProfile(req: AuthRequest, res: Response) {
    try {
      const user = await authService.getProfile(req.user.userId);
      
      res.json({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          role: user.role,
          credits: user.credits,
          isVerified: user.isVerified,
          stats: user.stats,
          preferences: user.preferences,
          nodeProvider: user.nodeProvider,
          createdAt: user.createdAt
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
      const { username, preferences } = req.body;
      const userId = req.user.userId;

      // Find and update user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      if (username) user.username = username;
      if (preferences) user.preferences = { ...user.preferences, ...preferences };

      await user.save();

      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          preferences: user.preferences
        }
      });
    } catch (error: any) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update profile'
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

      const user = await authService.updateCredits(userId, amount, 'add');

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
}