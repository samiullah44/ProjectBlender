// backend/src/services/JobService.ts
import mongoose, { Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Job } from '../models/Job';
import { User } from '../models/User';
import { Node } from '../models/Node';
import { S3Service } from './S3Service';
import { WebSocketService } from './WebSocketService';
import {
    IJob,
    IJobOutput,
    IFrameAssignment,
    CreateJobRequest,
    CreateJobResponse,
    JobFilterOptions,
    PaginationOptions,
    JobStats,
    UserJobStats
} from '../types/job.types';
import { AppError } from '../middleware/error';

export class JobService {
    private s3Service: S3Service;
    private wsService?: WebSocketService;

    constructor(s3Service: S3Service, wsService?: WebSocketService) {
        this.s3Service = s3Service;
        this.wsService = wsService;
    }

    setWebSocketService(wsService: WebSocketService) {
        this.wsService = wsService;
    }

    // Create a new job
    async createJob(data: CreateJobRequest): Promise<CreateJobResponse> {
        const {
            blendFile,
            userId,
            projectId = 'default-project',
            type = 'animation',
            settings = {},
            startFrame = 1,
            endFrame = 10,
            selectedFrame = 1,
            name = 'Untitled Job',
            description = '',
            tags = [],
            priority = 'normal',
            requireApproval = false
        } = data;

        try {
            // Validate user exists
            const user = await User.findById(userId);
            if (!user) {
                throw new AppError('User not found', 404);
            }

            // Check user credits if not admin
            if (user.role !== 'admin') {
                const estimatedCredits = this.calculateEstimatedCredits(type, settings, startFrame, endFrame);
                if (user.credits < estimatedCredits) {
                    throw new AppError('Insufficient credits', 400);
                }
            }

            // Generate job ID
            const jobId = `job-${Date.now()}-${uuidv4().slice(0, 8)}`;

            // Calculate frames
            const { totalFrames, selectedFrames } = this.calculateFrames(type, startFrame, endFrame, selectedFrame);

            // Upload blend file to S3
            const blendFileKey = await this.s3Service.uploadBlendFile(blendFile, jobId);
            const blendFileUrl = await this.s3Service.generateBlendFileDownloadUrl(blendFileKey);

            // Calculate estimated cost and time
            const estimatedCost = this.calculateEstimatedCost(totalFrames, settings);
            const estimatedTime = this.calculateEstimatedRenderTime(totalFrames, settings);

            // Create job document
            const job = new Job({
                jobId,
                projectId,
                userId: new Types.ObjectId(userId),
                blendFileKey,
                blendFileUrl,
                blendFileName: blendFile.originalname || name,
                type,
                settings: {
                    engine: settings.engine || 'CYCLES',
                    device: settings.device || 'GPU',
                    samples: settings.samples || 128,
                    resolutionX: settings.resolutionX || 1920,
                    resolutionY: settings.resolutionY || 1080,
                    tileSize: settings.tileSize || 256,
                    denoiser: settings.denoiser,
                    outputFormat: settings.outputFormat || 'PNG',
                    creditsPerFrame: settings.creditsPerFrame || 1,
                    selectedFrame: settings.selectedFrame || selectedFrame
                },
                frames: {
                    start: type === 'animation' ? startFrame : selectedFrame,
                    end: type === 'animation' ? endFrame : selectedFrame,
                    total: totalFrames,
                    selected: selectedFrames,
                    rendered: [],
                    failed: [],
                    assigned: [],
                    pending: selectedFrames
                },
                description,
                tags,
                priority,
                requireApproval,
                approved: !requireApproval,
                estimatedCost,
                estimatedRenderTime: estimatedTime,
                status: requireApproval ? 'pending' : 'pending',
                progress: 0,
                frameAssignments: [],
                assignedNodes: new Map(),
                outputUrls: []
            });

            await job.save();

            // Deduct credits if not admin
            if (user.role !== 'admin') {
                await user.deductCredits(estimatedCost);
            }

            // Update user stats
            await User.findByIdAndUpdate(userId, {
                $inc: { 'stats.jobsCreated': 1 }
            });

            console.log(`🎬 New ${type} job created: ${jobId} by user ${userId}`);

            // Broadcast via WebSocket
            this.wsService?.broadcastSystemUpdate({
                type: 'job_created',
                data: {
                    jobId,
                    userId,
                    type,
                    estimatedCost,
                    estimatedTime
                }
            });

            return {
                success: true,
                jobId,
                message: requireApproval ? 'Job created and pending approval' : 'Job created successfully',
                type,
                totalFrames,
                selectedFrames,
                blendFileUrl,
                settings: job.settings,
                estimatedCost,
                estimatedTime,
                fileStructure: {
                    blendFile: blendFileKey,
                    uploadsFolder: `uploads/${jobId}/`,
                    rendersFolder: `renders/${jobId}/`
                }
            };

        } catch (error) {
            console.error('Job creation error:', error);
            throw error;
        }
    }

    // Get job by ID with user access control
    async getJobById(jobId: string, userId: string, role?: string): Promise<IJob | null> {
        const query: any = { jobId };

        // Non-admin users can only see their own jobs
        if (role !== 'admin') {
            query.userId = new Types.ObjectId(userId);
        }

        const job = await Job.findOne(query)
            .populate('user', 'username name email role')
            .populate('approvedBy', 'username name')
            .lean();

        if (!job) return null;

        // Generate fresh URLs
        const blendFileUrl = await this.s3Service.generateBlendFileDownloadUrl(job.blendFileKey);
        const outputUrlsWithFreshUrls = await Promise.all(
            job.outputUrls.map(async (output: IJobOutput) => ({
                ...output,
                freshUrl: await this.s3Service.generateFrameDownloadUrl(output.s3Key),
                thumbnailUrl: await this.generateThumbnailUrl(output.s3Key)
            }))
        );

        return {
            ...job,
            blendFileUrl,
            outputUrls: outputUrlsWithFreshUrls
        };
    }

    // List jobs with filtering and pagination
    async listJobs(
        filters: JobFilterOptions,
        pagination: PaginationOptions,
        requestingUserId?: string,
        requestingUserRole?: string
    ): Promise<any> {
        const {
            userId,
            projectId,
            status,
            type,
            priority,
            tags,
            startDate,
            endDate,
            search,
            approved
        } = filters;

        const { page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;

        const query: any = {};

        // Apply user filtering
        if (userId) {
            query.userId = new Types.ObjectId(userId);
        } else if (requestingUserId && requestingUserRole !== 'admin') {
            // Non-admin users can only see their own jobs
            query.userId = new Types.ObjectId(requestingUserId);
        }

        // Apply other filters
        if (projectId) query.projectId = projectId;
        if (status) query.status = status;
        if (type) query.type = type;
        if (priority) query.priority = priority;
        if (approved !== undefined) query.approved = approved;
        if (tags && tags.length > 0) query.tags = { $all: tags };

        // Date range
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        // Text search
        if (search) {
            query.$or = [
                { jobId: { $regex: search, $options: 'i' } },
                { blendFileName: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { 'user.username': { $regex: search, $options: 'i' } },
                { 'user.name': { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;
        const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

        const [jobs, total] = await Promise.all([
            Job.find(query)
                .populate('user', 'username name email role')
                .populate('approvedBy', 'username name')
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            Job.countDocuments(query)
        ]);

        // Generate fresh URLs for blend files
        const jobsWithUrls = await Promise.all(
            jobs.map(async (job) => ({
                ...job,
                blendFileUrl: await this.s3Service.generateBlendFileDownloadUrl(job.blendFileKey),
                outputCount: job.outputUrls?.length || 0
            }))
        );

        return {
            jobs: jobsWithUrls,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        };
    }

    // Update job
    async updateJob(jobId: string, updates: Partial<IJob>, userId: string, role?: string): Promise<IJob | null> {
        const query: any = { jobId };

        // Non-admin users can only update their own jobs
        if (role !== 'admin') {
            query.userId = new Types.ObjectId(userId);
        }

        const job = await Job.findOne(query);
        if (!job) return null;

        // Validate updates based on job status
        if (job.status === 'completed' || job.status === 'failed') {
            throw new AppError('Cannot update completed or failed job', 400);
        }

        // Update allowed fields
        const allowedUpdates = [
            'description',
            'tags',
            'priority',
            'frames.selected',
            'settings'
        ];

        Object.keys(updates).forEach(key => {
            if (allowedUpdates.includes(key)) {
                (job as any)[key] = updates[key as keyof IJob];
            }
        });

        // Recalculate if frames changed
        if (updates.frames?.selected) {
            job.frames.total = updates.frames.selected.length;
            // Calculate pending frames correctly
            job.frames.pending = updates.frames.selected.filter(
                (f: number) => !job.frames.rendered.includes(f) && !job.frames.failed.includes(f)
            );
            job.progress = Math.round((job.frames.rendered.length / job.frames.total) * 100);
        }

        await job.save();

        // Broadcast update
        this.wsService?.broadcastJobUpdate(jobId);

        return job.toObject();
    }

    // Cancel job
    async cancelJob(jobId: string, userId: string, role?: string, cleanupS3: boolean = false): Promise<boolean> {
        const query: any = { jobId };

        // Non-admin users can only cancel their own jobs
        if (role !== 'admin') {
            query.userId = new Types.ObjectId(userId);
        }

        const job = await Job.findOne(query);
        if (!job) return false;

        // Validate job can be cancelled
        if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
            throw new AppError(`Job is already ${job.status}`, 400);
        }

        const wasProcessing = job.status === 'processing';

        job.status = 'cancelled';
        job.cancelledAt = new Date();
        await job.save();

        // Refund credits if job was in progress
        if (wasProcessing) {
            const user = await User.findById(userId);
            if (user && user.role !== 'admin') {
                const spentCredits = job.totalCreditsDistributed || 0;
                const refundAmount = Math.max(0, job.estimatedCost! - spentCredits);
                if (refundAmount > 0) {
                    await user.addCredits(refundAmount);
                }
            }
        }

        // Cleanup S3 files if requested
        if (cleanupS3) {
            try {
                await this.s3Service.deleteFile(job.blendFileKey);
                for (const output of job.outputUrls) {
                    await this.s3Service.deleteFile(output.s3Key);
                }
            } catch (error) {
                console.error('Failed to cleanup S3 files:', error);
            }
        }

        // Update nodes that were working on this job
        let nodeIds: string[] = [];
        if (job.assignedNodes instanceof Map) {
            nodeIds = Array.from(job.assignedNodes.keys());
        } else if (typeof job.assignedNodes === 'object' && job.assignedNodes !== null) {
            nodeIds = Object.keys(job.assignedNodes);
        }

        if (nodeIds.length > 0) {
            await Node.updateMany(
                { nodeId: { $in: nodeIds } },
                {
                    $set: {
                        status: 'online',
                        currentJob: undefined,
                        currentProgress: undefined
                    }
                }
            );
        }

        // Broadcast updates
        this.wsService?.broadcastJobUpdate(jobId);
        nodeIds.forEach(nodeId => {
            this.wsService?.broadcastNodeUpdate(nodeId, {
                status: 'online',
                currentJob: undefined
            });
        });

        return true;
    }

    // Approve job (admin only)
    async approveJob(jobId: string, adminId: string): Promise<boolean> {
        const job = await Job.findOne({ jobId });
        if (!job) return false;

        if (job.approved) {
            throw new AppError('Job is already approved', 400);
        }

        if (!job.requireApproval) {
            throw new AppError('Job does not require approval', 400);
        }

        job.approved = true;
        job.approvedBy = new Types.ObjectId(adminId);
        job.approvedAt = new Date();
        job.status = 'pending'; // Ready for processing

        await job.save();

        // Broadcast update
        this.wsService?.broadcastJobUpdate(jobId);

        return true;
    }

    // Get job statistics
    async getJobStats(userId?: string, role?: string): Promise<JobStats> {
        const matchStage: any = {};

        // Non-admin users can only see their own stats
        if (userId && role !== 'admin') {
            matchStage.userId = new Types.ObjectId(userId);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const stats = await Job.aggregate([
            { $match: matchStage },
            {
                $facet: {
                    statusCounts: [
                        {
                            $group: {
                                _id: '$status',
                                count: { $sum: 1 }
                            }
                        }
                    ],
                    totals: [
                        {
                            $group: {
                                _id: null,
                                totalJobs: { $sum: 1 },
                                totalRenderTime: { $sum: { $ifNull: ['$renderTime', 0] } },
                                totalCreditsUsed: { $sum: { $ifNull: ['$totalCreditsDistributed', 0] } },
                                estimatedTotalCost: { $sum: { $ifNull: ['$estimatedCost', 0] } },
                                actualTotalCost: { $sum: { $ifNull: ['$actualCost', 0] } },
                                totalFramesRendered: {
                                    $sum: { $size: { $ifNull: ['$frames.rendered', []] } }
                                }
                            }
                        }
                    ],
                    todayStats: [
                        {
                            $match: {
                                createdAt: { $gte: today, $lt: tomorrow }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                completedToday: {
                                    $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                                },
                                framesRenderedToday: {
                                    $sum: { $size: { $ifNull: ['$frames.rendered', []] } }
                                }
                            }
                        }
                    ]
                }
            }
        ]);

        const statusCounts = stats[0].statusCounts.reduce((acc: any, curr: any) => {
            acc[curr._id] = curr.count;
            return acc;
        }, {});

        const totals = stats[0].totals[0] || {
            totalJobs: 0,
            totalRenderTime: 0,
            totalCreditsUsed: 0,
            estimatedTotalCost: 0,
            actualTotalCost: 0,
            totalFramesRendered: 0
        };

        const todayStats = stats[0].todayStats[0] || {
            completedToday: 0,
            framesRenderedToday: 0
        };

        return {
            totalJobs: totals.totalJobs,
            activeJobs: (statusCounts.pending || 0) + (statusCounts.processing || 0) + (statusCounts.paused || 0),
            completedJobs: statusCounts.completed || 0,
            failedJobs: statusCounts.failed || 0,
            cancelledJobs: statusCounts.cancelled || 0,
            pausedJobs: statusCounts.paused || 0,
            completedToday: todayStats.completedToday,
            totalRenderTime: totals.totalRenderTime,
            totalCreditsUsed: totals.totalCreditsUsed,
            totalFramesRendered: totals.totalFramesRendered,
            avgRenderTimePerFrame: totals.totalFramesRendered > 0
                ? totals.totalRenderTime / totals.totalFramesRendered
                : 0,
            framesRenderedToday: todayStats.framesRenderedToday,
            estimatedTotalCost: totals.estimatedTotalCost,
            actualTotalCost: totals.actualTotalCost
        };
    }

    // Get user-specific job statistics
    async getUserJobStats(userId: string): Promise<UserJobStats> {
        const stats = await (Job as any).getUserStats(userId);

        const successRate = stats.totalJobs > 0
            ? (stats.completedJobs / stats.totalJobs) * 100
            : 0;

        const avgJobCompletionTime = stats.completedJobs > 0
            ? stats.totalRenderTime / stats.completedJobs
            : 0;

        const user = await User.findById(userId).select('credits');

        return {
            totalJobs: stats.totalJobs,
            activeJobs: stats.activeJobs,
            completedJobs: stats.completedJobs,
            totalSpent: stats.totalSpent,
            creditsRemaining: user?.credits || 0,
            avgJobCompletionTime,
            successRate
        };
    }

    // Helper methods
    private calculateFrames(
        type: 'image' | 'animation',
        startFrame: number,
        endFrame: number,
        selectedFrame: number
    ): { totalFrames: number; selectedFrames: number[] } {
        if (type === 'image') {
            return {
                totalFrames: 1,
                selectedFrames: [selectedFrame || 1]
            };
        } else {
            const totalFrames = endFrame - startFrame + 1;
            const selectedFrames = Array.from(
                { length: totalFrames },
                (_, i) => startFrame + i
            );
            return { totalFrames, selectedFrames };
        }
    }

    private calculateEstimatedCredits(
        type: 'image' | 'animation',
        settings: any,
        startFrame: number,
        endFrame: number
    ): number {
        const frames = type === 'image' ? 1 : endFrame - startFrame + 1;
        const creditsPerFrame = settings.creditsPerFrame || 1;

        // Adjust based on settings complexity
        let complexityMultiplier = 1;
        if (settings.samples && settings.samples > 256) complexityMultiplier *= 1.5;
        if (settings.resolutionX * settings.resolutionY > 1920 * 1080) complexityMultiplier *= 2;
        if (settings.denoiser && settings.denoiser !== 'NONE') complexityMultiplier *= 1.2;

        return Math.ceil(frames * creditsPerFrame * complexityMultiplier);
    }

    private calculateEstimatedCost(frames: number, settings: any): number {
        const baseCostPerFrame = 0.1; // $0.10 per frame
        const creditsPerFrame = settings.creditsPerFrame || 1;
        return frames * creditsPerFrame * baseCostPerFrame;
    }

    private calculateEstimatedRenderTime(frames: number, settings: any): number {
        const baseTimePerFrame = 60; // 60 seconds per frame at 1080p, 128 samples
        const resolutionFactor = (settings.resolutionX * settings.resolutionY) / (1920 * 1080);
        const samplesFactor = (settings.samples || 128) / 128;

        return frames * baseTimePerFrame * resolutionFactor * samplesFactor;
    }

    private async generateThumbnailUrl(s3Key: string): Promise<string> {
        // This would generate a thumbnail URL (implement based on your thumbnail service)
        // For now, return the original URL
        return await this.s3Service.generateFrameDownloadUrl(s3Key);
    }
}