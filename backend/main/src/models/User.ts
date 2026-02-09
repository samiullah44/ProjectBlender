// backend/src/models/User.ts
import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  username: string;
  password: string;
  isVerified: boolean;
  role: 'client' | 'node_provider' | 'admin';
  credits: number;
  
  // Node provider specific fields (if user is also a node provider)
  nodeProvider?: {
    nodeId?: string;
    nodeName?: string;
    earnings: number;
  };
  
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
  
  // Methods
  comparePassword(password: string): Promise<boolean>;
  addCredits(amount: number): Promise<void>;
  deductCredits(amount: number): Promise<void>;
  addEarnings(amount: number): Promise<void>;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    username: {
      type: String,
      required: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      select: false
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    role: {
      type: String,
      enum: ['client', 'node_provider', 'admin'],
      default: 'client'
    },
    credits: {
      type: Number,
      default: 1000
    },
    nodeProvider: {
      nodeId: String,
      nodeName: String,
      earnings: {
        type: Number,
        default: 0
      }
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

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(password: string): Promise<boolean> {
  return bcrypt.compare(password, this.password);
};

// Update user credits
userSchema.methods.deductCredits = async function(amount: number): Promise<void> {
  if (this.credits < amount) {
    throw new Error('Insufficient credits');
  }
  this.credits -= amount;
  this.stats.totalSpent += amount;
  await this.save();
};

// Add credits to user
userSchema.methods.addCredits = async function(amount: number): Promise<void> {
  this.credits += amount;
  await this.save();
};

// Update node provider earnings
userSchema.methods.addEarnings = async function(amount: number): Promise<void> {
  if (this.role === 'node_provider' && this.nodeProvider) {
    this.nodeProvider.earnings += amount;
    this.stats.totalEarned += amount;
    await this.save();
  }
};

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ credits: 1 });
userSchema.index({ 'nodeProvider.nodeId': 1 }, { sparse: true });

export const User = mongoose.model<IUser>('User', userSchema);