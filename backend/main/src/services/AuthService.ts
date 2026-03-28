import * as mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User';
import { Application } from '../models/Application';
import { OTP } from '../models/OTP';
import { ResetToken } from '../models/ResetToken';
import { env } from '../config/env';
import { EmailService } from './EmailService';
import { oauthService } from './OAuthService';
import { generateOTP, generateToken } from '../utils/authUtils';
import { notificationService } from './NotificationService';
import { wsService } from '../app';

const emailService = new EmailService();

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: any;
  message?: string;
  error?: string;
  autoApproved?: boolean; // Added for node provider application
}

export const MIN_REQUIREMENTS = {
  ramSize: 8,
  gpuVram: 4,
  storageSize: 100,
  internetSpeed: 5, // Download
  uploadSpeed: 5,
  cpuCores: 4
};

export const GPU_BLACKLIST = [
  'gtx 750', 'gtx 650', 'gt 1030', 'gt 710', 'gt 730', 'quadro k620', 'nvs', 'intel hd', 'intel iris', 'amd radeon r5', 'amd radeon r7'
];

export class AuthService {
  // Register new user with OTP
  async register(email: string, username: string, name: string, password: string, role: 'client' | 'node_provider' = 'client'): Promise<AuthResponse> {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return {
          success: false,
          error: 'Email already registered'
        };
      }

      // Generate OTP
      const otp = generateOTP();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + env.otpExpiryMinutes);

      // Create temporary user
      const tempUser = new User({
        email,
        username,
        name,
        password,
        role,
        credits: role === 'node_provider' ? 0 : 1000,
        isVerified: false,
        otp,
        expiresAt,
        provider: 'local',
        stats: {
          jobsCreated: 0,
          framesRendered: 0,
          totalSpent: 0,
          totalEarned: 0
        }
      });

      await tempUser.save();

      // Save OTP
      const otpDoc = new OTP({ email, otp, expiresAt });
      await otpDoc.save();

      // Send OTP email
      const emailSent = await emailService.sendOTPEmail(email, otp);

      if (!emailSent) {
        // Cleanup if email fails
        await User.deleteOne({ email });
        await OTP.deleteOne({ email });
        return {
          success: false,
          error: 'Failed to send verification email'
        };
      }

      return {
        success: true,
        message: 'Registration successful. Please check your email for OTP verification.'
      };

    } catch (error: any) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: error.message || 'Registration failed'
      };
    }
  }

  // Verify OTP
  async verifyOTP(email: string, otp: string): Promise<AuthResponse> {
    try {
      const otpDoc = await OTP.findOne({ email });
      const user = await User.findOne({ email });

      if (!otpDoc || !user) {
        return {
          success: false,
          error: 'Invalid email or OTP expired'
        };
      }

      // Check if OTP is expired
      if (new Date(otpDoc.expiresAt) < new Date()) {
        await OTP.deleteOne({ email });
        await User.deleteOne({ email });
        return {
          success: false,
          error: 'OTP has expired. Please register again.'
        };
      }

      // Check if OTP matches
      if (otpDoc.otp !== otp) {
        return {
          success: false,
          error: 'Invalid OTP'
        };
      }

      // Verify user
      user.isVerified = true;
      user.otp = undefined;
      user.expiresAt = undefined;
      user.lastLoginAt = new Date();
      await user.save();

      // Delete OTP
      await OTP.deleteOne({ email });

      // Generate token
      const token = this.generateToken(user);

      return {
        success: true,
        token,
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          name: user.name,
          role: user.role,
          credits: user.credits,
          tokenBalance: user.tokenBalance || 0,
          depositTokenAddress: user.depositTokenAddress,
          isVerified: user.isVerified
        }
      };

    } catch (error: any) {
      console.error('OTP verification error:', error);
      return {
        success: false,
        error: error.message || 'OTP verification failed'
      };
    }
  }

  // Login user
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      // Find user with password
      const user = await User.findOne({ email }).select('+password');

      if (!user) {
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      // Check if user is verified
      if (!user.isVerified) {
        return {
          success: false,
          error: 'Please verify your email first'
        };
      }

      // Check password (only for local auth)
      if (user.provider === 'local' || user.password) {
        const isValidPassword = await user.comparePassword!(password);
        if (!isValidPassword) {
          return {
            success: false,
            error: 'Invalid credentials'
          };
        }
      } else {
        return {
          success: false,
          error: 'Please use OAuth login for this account'
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
          id: user._id,
          email: user.email,
          username: user.username,
          name: user.name,
          role: user.role,
          credits: user.credits,
          tokenBalance: user.tokenBalance || 0,
          depositTokenAddress: user.depositTokenAddress,
          isVerified: user.isVerified,
          provider: user.provider
        }
      };

    } catch (error: any) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error.message || 'Login failed'
      };
    }
  }

  // Forgot password
  async forgotPassword(email: string, resetUrl?: string): Promise<AuthResponse> {
    try {
      const user = await User.findOne({ email });

      if (!user) {
        // Return success even if user not found (security measure)
        return {
          success: true,
          message: 'If your email is registered, you will receive a password reset link'
        };
      }

      // Generate reset token
      const resetToken = generateToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Save reset token
      const resetTokenDoc = new ResetToken({
        token: resetToken,
        email,
        expiresAt
      });
      await resetTokenDoc.save();

      // Generate reset link
      const resetLink = resetUrl
        ? `${resetUrl}?token=${resetToken}`
        : `${env.frontendUrl}/reset-password?token=${resetToken}`;

      // Send reset email
      const emailSent = await emailService.sendResetEmail(email, resetToken, resetLink);

      if (!emailSent) {
        await ResetToken.deleteOne({ token: resetToken });
        return {
          success: false,
          error: 'Failed to send reset email'
        };
      }

      return {
        success: true,
        message: 'Password reset email sent. Please check your inbox.'
      };

    } catch (error: any) {
      console.error('Forgot password error:', error);
      return {
        success: false,
        error: error.message || 'Failed to process forgot password request'
      };
    }
  }

  // Reset password
  async resetPassword(token: string, newPassword: string): Promise<AuthResponse> {
    try {
      const resetTokenDoc = await ResetToken.findOne({ token });

      if (!resetTokenDoc) {
        return {
          success: false,
          error: 'Invalid or expired reset token'
        };
      }

      // Check if token is expired
      if (new Date(resetTokenDoc.expiresAt) < new Date()) {
        await ResetToken.deleteOne({ token });
        return {
          success: false,
          error: 'Reset token has expired'
        };
      }

      const user = await User.findOne({ email: resetTokenDoc.email });

      if (!user) {
        await ResetToken.deleteOne({ token });
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Check if new password is same as old
      if (user.password) {
        const isSameAsOld = await user.comparePassword!(newPassword);
        if (isSameAsOld) {
          await ResetToken.deleteOne({ token });
          return {
            success: false,
            error: 'You cannot use your old password to reset'
          };
        }
      }

      // Update password
      user.password = newPassword;
      user.provider = 'local'; // Switch to local auth
      await user.save();

      // Delete reset token
      await ResetToken.deleteOne({ token });

      return {
        success: true,
        message: 'Password reset successfully. You can now login with your new password.'
      };

    } catch (error: any) {
      console.error('Reset password error:', error);
      return {
        success: false,
        error: error.message || 'Failed to reset password'
      };
    }
  }

  // Resend OTP
  async resendOTP(email: string): Promise<AuthResponse> {
    try {
      const user = await User.findOne({ email });

      if (!user || user.isVerified) {
        return {
          success: false,
          error: 'Invalid request'
        };
      }

      // Generate new OTP
      const otp = generateOTP();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + env.otpExpiryMinutes);

      // Update user
      user.otp = otp;
      user.expiresAt = expiresAt;
      await user.save();

      // Update OTP in database
      await OTP.findOneAndUpdate(
        { email },
        { otp, expiresAt },
        { upsert: true, new: true }
      );

      // Send OTP email
      const emailSent = await emailService.sendOTPEmail(email, otp);

      if (!emailSent) {
        return {
          success: false,
          error: 'Failed to send OTP email'
        };
      }

      return {
        success: true,
        message: 'New OTP sent to your email'
      };

    } catch (error: any) {
      console.error('Resend OTP error:', error);
      return {
        success: false,
        error: error.message || 'Failed to resend OTP'
      };
    }
  }

  // Get user profile
  async getProfile(userId: string): Promise<IUser> {
    const user = await User.findById(userId).select('-password -otp -expiresAt');
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  // Update user profile
  async updateProfile(userId: string, updates: any): Promise<AuthResponse> {
    try {
      const user = await User.findById(userId);

      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Update allowed fields
      if (updates.username) user.username = updates.username;
      if (updates.name) user.name = updates.name;
      if (updates.preferences) {
        user.preferences = { ...user.preferences, ...updates.preferences };
      }

      await user.save();

      return {
        success: true,
        message: 'Profile updated successfully',
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          name: user.name,
          preferences: user.preferences
        }
      };

    } catch (error: any) {
      console.error('Update profile error:', error);
      return {
        success: false,
        error: error.message || 'Failed to update profile'
      };
    }
  }

  // OAuth authentication
  async oauthAuthenticate(profile: any, provider: 'google' | 'github', role?: 'client' | 'node_provider') {
    const oauthProfile = {
      email: profile.email,
      name: profile.name || profile.displayName || profile.username,
      picture: profile.picture || profile.avatar_url,
      provider,
      providerId: profile.id
    };

    return await oauthService.findOrCreateUser(oauthProfile, role);
  }

  // Generate JWT token
  public generateToken(user: any): string {
    return jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role, // Legacy fallback
        roles: user.roles || [user.role],
        primaryRole: user.primaryRole,
        username: user.username,
        name: user.name
      },
      env.jwtSecret!,
      { expiresIn: env.jwtExpiry as any }
    );
  }

  // Verify JWT token
  verifyToken(token: string): any {
    try {
      return jwt.verify(token, env.jwtSecret!);
    } catch (error) {
      return null;
    }
  }

  // Add credits to user
  async addCredits(userId: string, amount: number): Promise<IUser> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    await user.addCredits(amount);
    return user;
  }

  // Deduct credits from user
  async deductCredits(userId: string, amount: number): Promise<IUser> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    await user.deductCredits(amount);
    return user;
  }

  // Sync crypto deposit to database
  async syncDeposit(userId: string, depositTokenAddress: string, amount: number): Promise<AuthResponse> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Add to database token balance (Real tokens)
      user.tokenBalance += amount;
      
      // Permanently attach their generated PDA Escrow Token Account to their profile
      if (depositTokenAddress && user.depositTokenAddress !== depositTokenAddress) {
        user.depositTokenAddress = depositTokenAddress;
      }

      await user.save();

      return {
        success: true,
        message: 'Token deposit synced successfully',
        user: {
          tokenBalance: user.tokenBalance,
          depositTokenAddress: user.depositTokenAddress
        }
      };
    } catch (error: any) {
      console.error('Sync deposit error:', error);
      return { success: false, error: 'Failed to sync deposit' };
    }
  }

  // backend/src/services/authService.ts - AUTOMATED applyForNodeProvider
  async applyForNodeProvider(userId: string, applicationData: {
    operatingSystem: string;
    cpuModel: string;
    cpuCores: number;
    gpuModel: string;
    gpuVram: number;
    gpuCount: number;
    ramSize: number;
    storageSize: number;
    storageType: 'ssd' | 'hdd';
    internetSpeed: number;
    uploadSpeed: number;
    country: string;
    ipAddress: string;
    additionalNotes?: string;
  }): Promise<AuthResponse> {
    try {
      const user = await User.findById(userId);

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const existingRoles = user.roles || [];
      if (existingRoles.includes('node_provider')) {
        return { success: false, error: 'You are already a node provider' };
      }

      if (user.nodeProviderStatus === 'pending') {
        return { success: false, error: 'Application already pending' };
      }

      // 🎯 Step 1: Automated Filtering
      const autoResult = this.autoApproveApplication(applicationData);
      const now = new Date();

      // Update User Model
      user.nodeProviderStatus = autoResult.approved ? 'approved' : 'rejected';
      user.nodeProviderApplicationDate = now;
      user.nodeProviderApplication = {
        operatingSystem: applicationData.operatingSystem,
        cpuModel: applicationData.cpuModel,
        gpuModel: applicationData.gpuModel,
        ramSize: applicationData.ramSize,
        storageSize: applicationData.storageSize,
        internetSpeed: applicationData.internetSpeed,
        country: applicationData.country,
        ipAddress: applicationData.ipAddress,
        additionalNotes: applicationData.additionalNotes
      };

      if (autoResult.approved) {
        if (!user.roles.includes('node_provider')) {
          user.roles.push('node_provider');
        }
        if (!user.primaryRole || user.primaryRole === 'client') {
          user.primaryRole = 'node_provider';
        }
        user.rejectionReason = undefined;
      } else {
        user.rejectionReason = autoResult.reason;
      }

      await user.save();

      // 🎯 Step 2: Create Application Record (Always store for audit)
      await Application.findOneAndUpdate(
        { userId, status: 'pending' },
        {
          userId,
          status: user.nodeProviderStatus as any,
          applicationData,
          rejectionReason: autoResult.approved ? undefined : autoResult.reason,
          submittedAt: now,
          reviewedAt: now, // Auto-reviewed!
          reviewedBy: null // System auto-reviewed
        },
        { upsert: true, new: true }
      );

      // 🎯 Step 3: Notifications (In-app and WebSocket ONLY)
      const notificationTitle = autoResult.approved ? 'Preliminary Approval! 🎉' : 'Application Update';
      const notificationMessage = autoResult.approved
        ? 'Your application holds preliminary approval! To get your final approval and start earning, you must now download our node software and connect your hardware for final verification.'
        : `Your application does not meet the minimum requirements at this time. Reason: ${autoResult.reason}`;

      await notificationService.createNotification(
        userId,
        autoResult.approved ? 'application_approved' : 'application_rejected',
        notificationTitle,
        notificationMessage,
        { autoApproved: autoResult.approved, reason: autoResult.reason }
      );

      wsService.emitToUser(userId, 'notification:new', {
        notification: {
          type: autoResult.approved ? 'application_approved' : 'application_rejected',
          title: notificationTitle,
          message: notificationMessage
        }
      });

      // Emit system update for admins
      wsService.broadcastSystemUpdate({ type: 'application_status_change' });

      return {
        success: true,
        message: autoResult.approved
          ? 'Preliminary approval granted! Your system claims meet our requirements. Please connect your node for final verification.'
          : `Application processed. Unfortunately, your system does not meet requirements: ${autoResult.reason}`,
        user: autoResult.approved ? { role: user.role, roles: user.roles, primaryRole: user.primaryRole } : undefined,
        autoApproved: autoResult.approved
      };
    } catch (error) {
      console.error('Apply for node provider error:', error);
      return { success: false, error: 'Failed to process application' };
    }
  }

  private autoApproveApplication(data: any): { approved: boolean; reason?: string } {
    const errors: string[] = [];

    // 1. RAM Check
    if (data.ramSize < MIN_REQUIREMENTS.ramSize) {
      errors.push(`RAM: ${data.ramSize}GB (Min ${MIN_REQUIREMENTS.ramSize}GB)`);
    }

    // 2. VRAM Check
    if (data.gpuVram < MIN_REQUIREMENTS.gpuVram) {
      errors.push(`VRAM: ${data.gpuVram}GB (Min ${MIN_REQUIREMENTS.gpuVram}GB)`);
    }

    // 3. CPU Cores Check
    if (data.cpuCores < MIN_REQUIREMENTS.cpuCores) {
      errors.push(`CPU Cores: ${data.cpuCores} (Min ${MIN_REQUIREMENTS.cpuCores})`);
    }

    // 4. Storage Check
    if (data.storageSize < MIN_REQUIREMENTS.storageSize) {
      errors.push(`Storage: ${data.storageSize}GB (Min ${MIN_REQUIREMENTS.storageSize}GB)`);
    }

    // 5. Network Speed Check
    if (data.internetSpeed < MIN_REQUIREMENTS.internetSpeed) {
      errors.push(`Download: ${data.internetSpeed}Mbps (Min ${MIN_REQUIREMENTS.internetSpeed}Mbps)`);
    }
    if (data.uploadSpeed < MIN_REQUIREMENTS.uploadSpeed) {
      errors.push(`Upload: ${data.uploadSpeed}Mbps (Min ${MIN_REQUIREMENTS.uploadSpeed}Mbps)`);
    }

    // 6. GPU Blacklist Check
    const gpuModelLower = data.gpuModel.toLowerCase();
    const isBlacklisted = GPU_BLACKLIST.some(blacklisted => gpuModelLower.includes(blacklisted));
    if (isBlacklisted) {
      errors.push(`GPU Model: "${data.gpuModel}" is not compatible with our rendering engine.`);
    }

    if (errors.length === 0) {
      return { approved: true };
    }

    return {
      approved: false,
      reason: errors.join('. ')
    };
  }

  // Approve Node Provider Application
  async approveNodeProviderApplication(userId: string, adminId: string): Promise<AuthResponse> {
    try {
      const user = await User.findById(userId);

      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      if (user.nodeProviderStatus !== 'pending') {
        return {
          success: false,
          error: 'No pending application found'
        };
      }

      // Add node_provider to roles array
      if (!user.roles.includes('node_provider')) {
        user.roles.push('node_provider');
      }

      // Set primary role to node_provider if not already set
      if (!user.primaryRole) {
        user.primaryRole = 'node_provider';
      }

      user.nodeProviderStatus = 'approved';
      user.rejectionReason = undefined;

      await user.save();

      // Update separate Application record
      await Application.findOneAndUpdate(
        { userId, status: 'pending' },
        {
          status: 'approved',
          reviewedAt: new Date(),
          reviewedBy: new mongoose.Types.ObjectId(adminId)
        }
      );

      // Create notification
      await notificationService.createNotification(
        userId,
        'application_approved',
        'Preliminary Approval! 🎉',
        'Your node provider application has been preliminarily approved! Please download the node software and connect to the network for final verification.',
        { applicationId: userId }
      );

      wsService.emitToUser(userId, 'notification:new', {
        notification: {
          type: 'application_approved',
          title: 'Preliminary Approval! 🎉',
          message: 'Your node provider application has been preliminarily approved! Please download the node software and connect to the network for final verification.'
        }
      });

      // Emit system update for admins
      wsService.broadcastSystemUpdate({ type: 'application_status_change' });

      return {
        success: true,
        message: 'Application approved successfully'
      };
    } catch (error) {
      console.error('Approve application error:', error);
      return {
        success: false,
        error: 'Failed to approve application'
      };
    }
  }

  // Reject Node Provider Application
  async rejectNodeProviderApplication(userId: string, adminId: string, reason: string): Promise<AuthResponse> {
    try {
      const user = await User.findById(userId);

      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      if (user.nodeProviderStatus !== 'pending') {
        return {
          success: false,
          error: 'No pending application found'
        };
      }

      user.nodeProviderStatus = 'rejected';
      user.rejectionReason = reason;

      await user.save();

      // Update separate Application record
      await Application.findOneAndUpdate(
        { userId, status: 'pending' },
        {
          status: 'rejected',
          rejectionReason: reason,
          reviewedAt: new Date(),
          reviewedBy: new mongoose.Types.ObjectId(adminId)
        }
      );

      // Create notification
      await notificationService.createNotification(
        userId,
        'application_rejected',
        'Application Update',
        `Your node provider application was not approved. Reason: ${reason}`,
        { applicationId: userId, reason }
      );

      // Emit WebSocket event
      wsService.emitToUser(userId, 'notification:new', {
        notification: {
          type: 'application_rejected',
          title: 'Application Update',
          message: `Your node provider application was not approved. Reason: ${reason}`
        }
      });

      // Emit system update for admins
      wsService.broadcastSystemUpdate({ type: 'application_status_change' });

      return {
        success: true,
        message: 'Application rejected'
      };
    } catch (error) {
      console.error('Reject application error:', error);
      return {
        success: false,
        error: 'Failed to reject application'
      };
    }
  }

  // Update Primary Role
  async updatePrimaryRole(userId: string, role: 'client' | 'node_provider' | 'admin'): Promise<AuthResponse> {
    try {
      const user = await User.findById(userId);

      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      if (!user.roles.includes(role)) {
        return {
          success: false,
          error: 'You do not have this role'
        };
      }

      user.primaryRole = role;
      await user.save();

      return {
        success: true,
        message: 'Primary role updated successfully',
        user: {
          id: user._id.toString(),
          email: user.email,
          username: user.username,
          name: user.name,
          role: user.role,
          roles: user.roles,
          primaryRole: user.primaryRole,
          credits: user.credits,
          isVerified: user.isVerified,
          provider: user.provider,
          nodeProvider: user.nodeProvider,
          nodeProviderStatus: user.nodeProviderStatus,
          stats: user.stats,
          preferences: user.preferences,
          createdAt: user.createdAt.toISOString(),
          lastLoginAt: user.lastLoginAt?.toISOString()
        }
      };
    } catch (error) {
      console.error('Update primary role error:', error);
      return {
        success: false,
        error: 'Failed to update primary role'
      };
    }
  }

  // Get Node Provider Applications (for admin)
  async getNodeProviderApplications(): Promise<any[]> {
    try {
      // Fetch from Application model to get full history and all data fields
      const applications = await Application.find()
        .populate('userId', 'name email')
        .sort({ submittedAt: -1 })
        .lean();

      // Map to a cleaner format for the frontend
      return applications.map((app: any) => ({
        _id: app._id,
        userId: app.userId?._id,
        name: app.userId?.name || 'Unknown',
        email: app.userId?.email || 'Unknown',
        status: app.status,
        applicationData: app.applicationData,
        submittedAt: app.submittedAt,
        reviewedAt: app.reviewedAt,
        rejectionReason: app.rejectionReason,
        // Fallback for frontend compatibility
        nodeProviderApplicationDate: app.submittedAt,
        nodeProviderApplication: app.applicationData
      }));
    } catch (error) {
      console.error('Get applications error:', error);
      throw error;
    }
  }
}

export const authService = new AuthService();