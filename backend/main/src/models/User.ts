// backend/src/models/User.ts
import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface IUser extends Document {
  email: string;
  username: string;
  name: string;
  password?: string;
  isVerified: boolean;
  // CHANGE 1: role → roles array (with backward compatibility)
  roles: ('client' | 'node_provider' | 'admin')[];
  role?: 'client' | 'node_provider' | 'admin'; // Kept for backward compatibility
  credits: number;
  // NEW: Store the specific generated PDA token account
  depositTokenAddress?: string;
  tokenBalance: number;
  solanaSeed?: string;
  payoutWallet?: string; // NEW: Specific wallet for receiving render earnings

  // OAuth fields
  provider?: 'google' | 'github' | 'local';
  providerId?: string;

  // OTP fields
  otp?: string;
  expiresAt?: Date;

  // CHANGE 2: Node provider specific fields - REMOVED nodeId, nodeName
  nodeProvider?: {
    earnings: number;
  };
  nodeProviderStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  maxNodes: number; // max render nodes this user can register (default 10)
  nodeProviderApplicationDate?: Date;
  nodeProviderApplication?: {
    operatingSystem: string;
    cpuModel: string;
    gpuModel: string;
    ramSize: number;
    storageSize: number;
    internetSpeed: number;
    country: string;
    ipAddress: string;
    additionalNotes?: string;
  };
  primaryRole?: 'client' | 'node_provider' | 'admin';
  rejectionReason?: string;
  suspicionTag?: 'none' | 'little suspicious' | 'more suspicious' | 'complete suspicious';

  // Preferences
  preferences?: {
    defaultProjectId?: string;
    notificationEnabled?: boolean;
  };

  // Stats
  stats?: {
    jobsCreated: number;
    framesRendered: number;
    totalSpent: number;
    totalEarned: number;
  };

  // Timestamps
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  // OAuth state (transient)
  _oauthState?: {
    siteId?: string;
    redirectUrl?: string;
  };

  // Methods
  comparePassword?(password: string): Promise<boolean>;
  addCredits(amount: number): Promise<void>;
  deductCredits(amount: number): Promise<void>;
  addEarnings(amount: number): Promise<void>;
  // NEW: Helper method
  hasRole(role: string): boolean;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    username: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    password: {
      type: String,
      select: false
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    // CHANGE 1: Keep old role field for backward compatibility
    role: {
      type: String,
      enum: ['client', 'node_provider', 'admin'],
      default: 'client'
    },
    // CHANGE 1: ADD new roles array
    roles: {
      type: [String],
      enum: ['client', 'node_provider', 'admin'],
      default: ['client']
    },
    credits: {
      type: Number,
      default: 1000
    },
    depositTokenAddress: {
      type: String,
      sparse: true,
      index: true
    },
    tokenBalance: {
      type: Number,
      default: 0,
      min: 0
    },
    solanaSeed: {
      type: String,
      sparse: true,
      index: true
    },
    payoutWallet: {
      type: String,
      sparse: true,
      index: true
    },

    provider: {
      type: String,
      enum: ['google', 'github', 'local'],
      default: 'local'
    },
    providerId: String,
    otp: String,
    expiresAt: Date,
    // CHANGE 2: Updated nodeProvider - REMOVED nodeId and nodeName
    nodeProvider: {
      earnings: {
        type: Number,
        default: 0
      }
    },
    nodeProviderStatus: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none'
    },
    maxNodes: {
      type: Number,
      default: 10,
      min: 0,
    },
    nodeProviderApplicationDate: Date,
    nodeProviderApplication: {
      operatingSystem: String,
      cpuModel: String,
      gpuModel: String,
      ramSize: Number,
      storageSize: Number,
      internetSpeed: Number,
      country: String,
      ipAddress: String,
      additionalNotes: String
    },
    primaryRole: {
      type: String,
      enum: ['client', 'node_provider', 'admin']
    },
    rejectionReason: String,
    suspicionTag: {
      type: String,
      enum: ['none', 'little suspicious', 'more suspicious', 'complete suspicious'],
      default: 'none'
    },
    preferences: {
      defaultProjectId: {
        type: String,
        default: 'default-project'
      },
      notificationEnabled: {
        type: Boolean,
        default: true
      }
    },
    stats: {
      jobsCreated: {
        type: Number,
        default: 0
      },
      framesRendered: {
        type: Number,
        default: 0
      },
      totalSpent: {
        type: Number,
        default: 0
      },
      totalEarned: {
        type: Number,
        default: 0
      }
    },
    lastLoginAt: Date
  },
  {
    timestamps: true
  }
);

// PRE-SAVE HOOK: Sync role with roles array for backward compatibility
userSchema.pre('save', function (next) {
  // If roles array exists, update legacy role field to first role
  if (this.roles && this.roles.length > 0) {
    this.role = this.roles[0];
  }
  // If only legacy role exists, migrate to roles array
  else if (this.role && (!this.roles || this.roles.length === 0)) {
    this.roles = [this.role];
  }

  // Auto-initialize nodeProvider for node_provider users
  if (this.roles && this.roles.includes('node_provider') && !this.nodeProvider) {
    this.nodeProvider = { earnings: 0 };
  }

  next();
});

// Hash password before saving (only for local auth)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare password method (only for local auth)
userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  if (!this.password) return false; // For OAuth users
  return bcrypt.compare(password, this.password);
};

// NEW: Helper method to check roles
userSchema.methods.hasRole = function (role: string): boolean {
  return this.roles && this.roles.includes(role);
};

// Update user credits
userSchema.methods.deductCredits = async function (amount: number): Promise<void> {
  if (this.credits < amount) {
    throw new Error('Insufficient credits');
  }
  this.credits -= amount;
  this.stats!.totalSpent += amount;
  await this.save();
};

// Add credits to user
userSchema.methods.addCredits = async function (amount: number): Promise<void> {
  this.credits += amount;
  await this.save();
};

// Update node provider earnings - UPDATED to use roles array
userSchema.methods.addEarnings = async function (amount: number): Promise<void> {
  if (this.roles && this.roles.includes('node_provider') && this.nodeProvider) {
    this.nodeProvider.earnings += amount;
    this.stats!.totalEarned += amount;
    await this.save();
  }
};

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ roles: 1 }); // NEW: Index roles array
userSchema.index({ credits: 1 });
userSchema.index({ provider: 1, providerId: 1 }, { sparse: true });
userSchema.index({ isVerified: 1 });
userSchema.index({ createdAt: -1 });

export const User = mongoose.model<IUser>('User', userSchema);