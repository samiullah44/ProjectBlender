// backend/src/services/AuthService.ts
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import { env } from '../config/env';

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    email: string;
    username: string;
    role: string;
    credits: number;
    isVerified: boolean;
  };
  error?: string;
}

export interface RegisterResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    username: string;
    role: string;
  };
  error?: string;
}

export class AuthService {
  // Generate JWT token
  private generateToken(user: IUser): string {
    return jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
        username: user.username
      },
      env.jwtSecret!,
      { expiresIn: '7d' }
    );
  }

  // Register new user
  async register(
    email: string,
    username: string,
    password: string,
    role: 'client' | 'node_provider' = 'client'
  ): Promise<RegisterResponse> {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return {
          success: false,
          error: 'Email already registered'
        };
      }

      // Create new user
      const user = new User({
        email,
        username,
        password,
        role,
        credits: role === 'node_provider' ? 0 : 1000, // Node providers start with 0 credits
        isVerified: true, // For simplicity, auto-verify users
        stats: {
          jobsCreated: 0,
          framesRendered: 0,
          totalSpent: 0,
          totalEarned: 0
        }
      });

      await user.save();

      return {
        success: true,
        user: {
          id: user._id.toString(),
          email: user.email,
          username: user.username,
          role: user.role
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Registration failed'
      };
    }
  }

  // Login user
  async login(email: string, password: string): Promise<LoginResponse> {
    try {
      // Find user with password
      const user = await User.findOne({ email }).select('+password');
      
      if (!user) {
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      // Check password
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      // Update last login
      user.lastLoginAt = new Date();
      await user.save();

      // Generate token
      const token = this.generateToken(user);

      return {
        success: true,
        token,
        user: {
          id: user._id.toString(),
          email: user.email,
          username: user.username,
          role: user.role,
          credits: user.credits,
          isVerified: user.isVerified
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Login failed'
      };
    }
  }

  // Get user profile
  async getProfile(userId: string) {
    try {
      const user = await User.findById(userId).select('-password');
      if (!user) {
        throw new Error('User not found');
      }
      return user;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to get profile');
    }
  }

  // Update user credits
  async updateCredits(userId: string, amount: number, action: 'add' | 'deduct') {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (action === 'add') {
        await user.addCredits(amount);
      } else {
        await user.deductCredits(amount);
      }

      return user;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update credits');
    }
  }

  // Verify token
  verifyToken(token: string): any {
    try {
      return jwt.verify(token, env.jwtSecret!);
    } catch (error) {
      return null;
    }
  }
  // backend/src/services/AuthService.ts - Add method to link node to user
// Add this method to the AuthService class:

async registerNodeProvider(userId: string, nodeId: string, nodeName?: string) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.role !== 'node_provider') {
      throw new Error('User must have node_provider role');
    }

    user.nodeProvider = {
      nodeId,
      nodeName: nodeName || `Node-${nodeId.substring(0, 8)}`,
      earnings: 0
    };

    await user.save();
    
    return {
      success: true,
      message: 'Node registered to user successfully'
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to register node to user'
    };
  }
}
}

export const authService = new AuthService();