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
import { normalizeBlenderVersion } from '../utils/blenderVersionMapper';
import { enqueueJobFrames, removeJobFrames } from './FrameQueueService';
import { solanaService } from './SolanaService';

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
            let estimatedCredits = this.calculateEstimatedCredits(type, settings, startFrame, endFrame);
            if (user.role !== 'admin') {
                if (user.credits < estimatedCredits) {
                    throw new AppError('Insufficient credits', 400);
                }
            }

            // --- SOLANA ZERO-PROMPT LOCKING ---
            let lockTxSignature = '';
            const onchainJobId = Date.now();
            
            if (user.role !== 'admin' && user.solanaSeed) {
                try {
                    console.log(`[JobService] Initiating on-chain lock for user ${userId}, amount: ${estimatedCredits}`);
                    // Lock payment on-chain using backend admin signature
                    lockTxSignature = await solanaService.lockPayment(
                        user.solanaSeed, 
                        onchainJobId, 
                        estimatedCredits
                    );
                    console.log(`[JobService] ✅ Solana Lock Successful: ${lockTxSignature}`);
                } catch (solanaErr: any) {
                    console.error('[JobService] ❌ Solana Lock Failed:', solanaErr);
                    // Block job creation if payment reservation fails
                    throw new AppError(`On-chain payment reservation failed: ${solanaErr.message}`, 402);
                }
            }
            // ----------------------------------

            // Generate job ID
            const jobId = `job-${Date.now()}-${uuidv4().slice(0, 8)}`;

            // Calculate frames
            const { totalFrames, selectedFrames } = this.calculateFrames(type, startFrame, endFrame, selectedFrame);

            // Upload blend file to S3
            const blendFileKey = await this.s3Service.uploadBlendFile(blendFile, jobId);
            const blendFileUrl = await this.s3Service.generateBlendFileDownloadUrl(blendFileKey);

            // Calculate estimated cost and credits
            const jobCredits = this.calculateEstimatedCredits(type, settings, startFrame, endFrame);
            const estimatedCost = this.calculateEstimatedCost(type, settings, startFrame, endFrame);
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
                    ...settings,
                    engine: settings.engine || 'CYCLES',
                    device: settings.device || 'GPU',
                    samples: settings.samples || 128,
                    resolutionX: settings.resolutionX || 1920,
                    resolutionY: settings.resolutionY || 1080,
                    tileSize: settings.tileSize || 256,
                    outputFormat: settings.outputFormat || 'PNG',
                    compression: settings.compression ?? 90,
                    creditsPerFrame: (jobCredits / totalFrames) || 1, // DERIVED: Ensure node payout matches escrow
                    blenderVersion: normalizeBlenderVersion(settings.blenderVersion || '4.5.0'),
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
                status: 'pending',
                progress: 0,
                frameAssignments: [],
                assignedNodes: new Map(),
                outputUrls: [],
                escrow: {
                    onchainJobId,
                    txSignature: lockTxSignature,
                    status: lockTxSignature ? 'locked' : 'none',
                    lockedAmount: jobCredits,
                    lockedAt: lockTxSignature ? new Date() : undefined
                }
            });

            await job.save();

            // Enqueue all selected frames into BullMQ for atomic distribution to nodes.
            // This replaces the MongoDB frames.pending array as the source-of-truth
            // for which frames are available to be picked up.
            try {
                await enqueueJobFrames(jobId, selectedFrames, job.settings.engine, job.settings.device);
            } catch (queueErr) {
                // Queue failure is non-fatal for job creation — nodes can still
                // fall back to the MongoDB frames.pending array if Redis is down.
                console.error(`⚠️  Failed to enqueue frames for job ${jobId} into BullMQ:`, queueErr);
            }

            // Deduct credits if not admin
            if (user.role !== 'admin') {
                await user.deductCredits(estimatedCost);
            }

            // Update user stats
            await User.findByIdAndUpdate(userId, {
                $inc: { 'stats.jobsCreated': 1 }
            });

            console.log(`🎬 New ${type} job created: ${jobId} by user ${userId}`);

            // Broadcast via WebSocket and notify nodes to check for work
            if (this.wsService) {
                this.wsService.emitToUser(userId, 'system_update', {
                    type: 'job_created',
                    data: {
                        jobId,
                        userId,
                        type,
                        estimatedCost,
                        estimatedTime
                    }
                });
                // Proactively tell every connected node to poll for the new job
                // so it doesn't have to wait for the next REST fallback cycle.
                this.wsService.notifyNodesToCheckJobs();
            }

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
            if (mongoose.isValidObjectId(userId)) {
                query.userId = new Types.ObjectId(userId);
            } else {
                return null; // Invalid user ID for non-admin
            }
        }

        try {
            const job = await Job.findOne(query)
                .populate('user', 'username name email role')
                .populate('approvedBy', 'username name')
                .lean()
                .catch(err => {
                    console.error(`Population error in getJobById for ${jobId}:`, err);
                    // Fallback to unpopulated job if population fails due to bad data
                    return Job.findOne(query).lean();
                });

            if (!job) return null;

            // Generate fresh URLs (with fallback if S3 fails)
            let blendFileUrl = job.blendFileUrl;
            try {
                if (job.blendFileKey) {
                    blendFileUrl = await this.s3Service.generateBlendFileDownloadUrl(job.blendFileKey);
                }
            } catch (err) {
                console.warn(`Failed to generate fresh blend file URL for job ${jobId}:`, err);
            }

            let outputUrlsWithFreshUrls = job.outputUrls || [];
            try {
                outputUrlsWithFreshUrls = await Promise.all(
                    (job.outputUrls || []).map(async (output: IJobOutput) => {
                        let freshUrl = output.url;
                        let thumbnailUrl = output.thumbnailUrl;
                        try {
                            if (output.s3Key) {
                                freshUrl = await this.s3Service.generateFrameDownloadUrl(output.s3Key);
                                thumbnailUrl = await this.generateThumbnailUrl(output.s3Key);
                            }
                        } catch (urlErr) {
                            console.warn(`Failed to generate URL for frame ${output.frame}:`, urlErr);
                        }
                        return {
                            ...output,
                            freshUrl,
                            thumbnailUrl
                        };
                    })
                );
            } catch (err) {
                console.warn(`Failed to generate fresh output URLs for job ${jobId}:`, err);
            }

            return {
                ...job,
                blendFileUrl,
                outputUrls: outputUrlsWithFreshUrls
            } as any;
        } catch (error) {
            console.error(`Error in getJobById for ${jobId}:`, error);
            throw error;
        }
    }

    /**
     * Synchronize job status based on frame rendering progress.
     * Useful for fixing "stuck" jobs or ensuring status is correct upon subscription.
     */
    async syncJobStatus(jobId: string): Promise<IJob | null> {
        const job = await Job.findOne({ jobId });
        if (!job) return null;

        if (['completed', 'failed', 'cancelled'].includes(job.status)) {
            return job;
        }

        const selectedOrAll = job.frames.selected && job.frames.selected.length > 0
            ? job.frames.selected
            : Array.from({ length: job.frames.total }, (_, i) => job.frames.start + i);

        const totalFramesToRender = selectedOrAll.length;
        const renderedFrames = job.frames.rendered.length;
        const stillInFlight = job.frames.assigned.length;
        const stillFailed = job.frames.failed.filter((f: number) => !job.frames.rendered.includes(f)).length;

        // If the job is cancelling and all active frames have finished shutting down gracefully
        if (job.status === 'cancelling' && stillInFlight === 0) {
            job.status = 'cancelled';
            job.completedAt = new Date();

            // Calculate actual credits distributed for all successfully rendered frames
            // This is critical because normal `totalCreditsDistributed` is only computed for
            // normally completed jobs, but for cancelled jobs, we compute it proportionally here.
            let dynamicCreditsSpent = 0;
            job.frameAssignments.forEach((a: any) => {
                if (a.status === 'rendered') {
                    dynamicCreditsSpent += (a.creditsEarned || 0);
                }
            });
            job.totalCreditsDistributed = dynamicCreditsSpent;

            const usesOnchainEscrow = !!(job as any).escrow?.txSignature;
            try {
                // Determine precision refund amount (locked minus actually spent)
                const refundAmount = usesOnchainEscrow
                    ? ((job as any).escrow?.lockedAmount || job.estimatedCost) - dynamicCreditsSpent
                    : Math.max(0, job.estimatedCost! - dynamicCreditsSpent);

                if (refundAmount > 0) {
                    const user = await User.findById(job.userId);
                    if (user && user.solanaSeed) {
                        // 1. Release unused locked funds on-chain
                        if (usesOnchainEscrow && (job as any).escrow.status === 'locked') {
                            try {
                                console.log(`[JobService] Attempting precision on-chain unlock for gracefully cancelled job ${jobId}`);
                                const unlockTx = await solanaService.cancelPayment(
                                    user.solanaSeed,
                                    (job as any).escrow.onchainJobId,
                                    refundAmount
                                );
                                console.log(`[JobService] ✅ Precision Unlock Successful: ${unlockTx}`);
                                (job as any).escrow.status = 'refunded';
                                (job as any).escrow.unlockTxSignature = unlockTx;
                            } catch (err) {
                                console.error('[JobService] ❌ Precision On-chain Unlock Failed:', err);
                            }
                        }

                        // 2. Refund DB UI balance
                        if (user.role !== 'admin') {
                            await User.findByIdAndUpdate(job.userId, {
                                $inc: { tokenBalance: Number(refundAmount) }
                            });
                            console.log(`Refunded ${refundAmount} DB balance for gracefully cancelled job ${jobId}`);
                            this.wsService?.emitToUser(job.userId.toString(), 'credit_balance_updated', {});
                        }
                    }
                }
            } catch (refundErr) {
                console.error(`[JobService] Error processing refund for graceful cancellation of job ${jobId}:`, refundErr);
            }

            // Clean up any remaining nodes assigned to this job just in case
            let nodeIds: string[] = [];
            if (job.assignedNodes instanceof Map) {
                nodeIds = Array.from(job.assignedNodes.keys());
            } else if (typeof job.assignedNodes === 'object' && job.assignedNodes !== null) {
                nodeIds = Object.keys(job.assignedNodes);
            }
            if (nodeIds.length > 0) {
                await Node.updateMany(
                    { nodeId: { $in: nodeIds } },
                    { $set: { status: 'online', currentJob: undefined, currentProgress: undefined } }
                );
                nodeIds.forEach(nodeId => {
                    this.wsService?.broadcastNodeUpdate(nodeId, { status: 'online', currentJob: undefined });
                });
            }

            await job.save();
            this.wsService?.broadcastJobUpdate(jobId);
            return job;
        }

        // If rendering is done (all frames reached rendered or failed state, and none are in progress)
        if ((renderedFrames + stillFailed >= totalFramesToRender) && stillInFlight === 0) {
            const oldStatus = job.status;

            if (renderedFrames > 0) {
                job.status = 'completed';
            } else if (stillFailed > 0) {
                job.status = 'failed';
            }

            if (job.status !== oldStatus) {
                job.completedAt = new Date();

                // REFINE: Use session-based wall-clock accumulation
                const sessionStart = job.startedAt || job.createdAt;
                const sessionDurationMs = Math.max(0, job.completedAt.getTime() - sessionStart.getTime());

                // Add current session to accumulated time
                job.renderTime = (job.renderTime || 0) + sessionDurationMs;

                await job.save();
                console.log(`🔄 Sync: Job ${jobId} status updated to ${job.status}. Added ${Math.round(sessionDurationMs / 1000)}s to renderTime (Total: ${Math.round((job.renderTime || 0) / 1000)}s)`);
            }
        }

        return job;
    }

    // Re-render selected frames for a completed job (user-initiated, max attempts enforced by controller)
    async rerenderFrames(job: IJob, frames: number[], userId: string, req: any): Promise<void> {
        const JobModel = Job; // mongoose model

        const currentCount = job.userRerenderCount ?? 0;
        const maxCount = job.userRerenderMax ?? 2;

        const uniqueFrames = Array.from(new Set(frames));

        const nextCount = currentCount + 1;

        // Update job document
        const jobDoc = await JobModel.findOne({ jobId: job.jobId });
        if (!jobDoc) {
            throw new AppError('Job not found', 404);
        }

        // Ensure arrays exist
        jobDoc.frames.rendered = jobDoc.frames.rendered || [];
        jobDoc.frames.failed = jobDoc.frames.failed || [];
        jobDoc.frames.pending = jobDoc.frames.pending || [];
        jobDoc.frames.selected = jobDoc.frames.selected || [];

        for (const frame of uniqueFrames) {
            // Remove from rendered/failed
            jobDoc.frames.rendered = jobDoc.frames.rendered.filter((f: number) => f !== frame);
            jobDoc.frames.failed = jobDoc.frames.failed.filter((f: number) => f !== frame);

            // Add back to pending & selected
            if (!jobDoc.frames.pending.includes(frame)) {
                jobDoc.frames.pending.push(frame);
            }
            if (!jobDoc.frames.selected.includes(frame)) {
                jobDoc.frames.selected.push(frame);
            }

            // Clear existing assignments for this frame so frontend doesn't show it as "rendered"
            if (Array.isArray(jobDoc.frameAssignments)) {
                jobDoc.frameAssignments = jobDoc.frameAssignments.filter((a: any) => a.frame !== frame);
            }

            // Clear from assignedNodes Map as well
            if (jobDoc.assignedNodes instanceof Map) {
                jobDoc.assignedNodes.delete(frame.toString());
            } else if (jobDoc.assignedNodes && typeof jobDoc.assignedNodes === 'object') {
                for (const nodeId in (jobDoc.assignedNodes as any)) {
                    (jobDoc.assignedNodes as any)[nodeId] = (jobDoc.assignedNodes as any)[nodeId].filter((f: number) => f !== frame);
                }
            }
        }

        // Reset status & progress
        jobDoc.status = 'processing';
        jobDoc.startedAt = new Date();
        jobDoc.renderTime = jobDoc.renderTime || 0; // Ensure it's initialized
        jobDoc.userRerenderCount = nextCount;
        jobDoc.userRerenderMax = maxCount;

        // Track historically re-rendered frames
        const existingHistory = jobDoc.rerenderedHistory || [];
        jobDoc.rerenderedHistory = Array.from(new Set([...existingHistory, ...uniqueFrames]));

        jobDoc.updatedAt = new Date();
        await jobDoc.save();

        // First remove existing jobs from BullMQ so they can be re-queued with the same ID
        try {
            await removeJobFrames(job.jobId, uniqueFrames, job.settings.engine, job.settings.device);
        } catch (removeErr) {
            console.warn(`⚠️  Failed to remove previous frames from BullMQ for job ${job.jobId}:`, removeErr);
        }

        // Enqueue frames into BullMQ
        try {
            await enqueueJobFrames(job.jobId, uniqueFrames, job.settings.engine, job.settings.device);
        } catch (queueErr) {
            console.error(`⚠️  Failed to enqueue re-render frames for job ${job.jobId}:`, queueErr);
        }

        // Broadcast update and notify nodes
        if (this.wsService) {
            await this.wsService.broadcastJobUpdate(job.jobId);
            await this.wsService.notifyNodesToCheckJobs();
        }
    }

    // Get job status/basic info by ID (no user check, used by nodes)
    async getJobByIdMinimal(jobId: string): Promise<IJob | null> {
        try {
            const job = await Job.findOne({ jobId })
                .select('jobId status userId createdAt updatedAt')
                .lean();
            return job as IJob;
        } catch (error) {
            console.error(`Error in getJobByIdMinimal for ${jobId}:`, error);
            return null;
        }
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

        try {
            const { page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;

            const query: any = {};

            // Apply user filtering
            const adminView = filters.adminView;
            if (userId) {
                if (mongoose.isValidObjectId(userId)) {
                    query.userId = new Types.ObjectId(userId);
                } else {
                    // If userId is invalid for an ObjectId field, searching for it will always fail anyway.
                    // To avoid CastError, we can either return empty or use a query that won't match.
                    query.userId = new Types.ObjectId(); // Guarantee no match
                }
            } else if (requestingUserId && (requestingUserRole !== 'admin' || !adminView)) {
                // Non-admin users (or admins outside of adminView mode) can only see their own jobs
                if (mongoose.isValidObjectId(requestingUserId)) {
                    query.userId = new Types.ObjectId(requestingUserId);
                } else {
                    query.userId = new Types.ObjectId(); // Guarantee no match
                }
            }

            // Apply other filters
            if (projectId) query.projectId = projectId;
            if (status) {
                // Treat pending_payment as "pending" in the same UI bucket
                // so existing client filters (status=pending) still work.
                if (status === 'pending') {
                    query.status = { $in: ['pending', 'pending_payment'] };
                } else {
                    query.status = status;
                }
            }
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

            // Text search - REMOVED regex search on virtual fields user.username and user.name
            // MongoDB cannot filter on fields that are not in the document (populated/virtuals)
            if (search) {
                query.$or = [
                    { jobId: { $regex: search, $options: 'i' } },
                    { blendFileName: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ];
            }

            const skip = (page - 1) * limit;
            const sort: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

            // Field projection to exclude heavy arrays
            const projection = {
                frameAssignments: 0,
                assignedNodes: 0,
                'frames.rendered': 0,
                'frames.failed': 0,
                'frames.assigned': 0,
                'frames.selected': 0,
                'frames.pending': 0,
                // Keep outputUrls only if specifically needed, but usually list views don't need all 1000 URLs
                // outputUrls: 0 
            };

            const [jobs, total] = await Promise.all([
                Job.find(query, projection)
                    .populate('user', 'username email role') // optimized population
                    .populate('approvedBy', 'username') // optimized population
                    .sort(sort)
                    .skip(skip)
                    .limit(limit)
                    .lean()
                    .catch(err => {
                        console.error('Population error in listJobs:', err);
                        // Fallback to unpopulated jobs if population fails due to bad data
                        return Job.find(query, projection)
                            .sort(sort)
                            .skip(skip)
                            .limit(limit)
                            .lean();
                    }),
                Job.countDocuments(query).catch(() => 0)
            ]);

            // Generate fresh URLs for blend files (with fallback if S3 fails)
            const jobsWithUrls = await Promise.all(
                jobs.map(async (job) => {
                    let blendFileUrl = job.blendFileUrl;
                    let previewUrl = undefined;
                    try {
                        if (job.blendFileKey) {
                            blendFileUrl = await this.s3Service.generateBlendFileDownloadUrl(job.blendFileKey);
                        }
                        
                        // If job has rendered frames, refresh the URL for the first one to show as a thumbnail
                        if (job.outputUrls && job.outputUrls.length > 0) {
                            const firstOutput = job.outputUrls[0];
                            if (firstOutput && firstOutput.s3Key) {
                                previewUrl = await this.s3Service.generateFrameDownloadUrl(firstOutput.s3Key);
                            } else if (firstOutput) {
                                previewUrl = firstOutput.url;
                            }
                        }
                    } catch (err) {
                        console.warn(`Failed to generate URL for job ${job.jobId}:`, err);
                    }
                    return {
                        ...job,
                        blendFileUrl,
                        previewUrl,
                        outputCount: job.outputUrls?.length || 0
                    };
                })
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
        } catch (error) {
            console.error('Error in listJobs:', error);
            throw error;
        }
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

        const oldStatus = job.status;
        const wasProcessing = oldStatus === 'processing';

        if (wasProcessing) {
            job.status = 'cancelling';
        } else {
            job.status = 'cancelled';
        }
        job.cancelledAt = new Date();

        // 1. Full Immediate Refund for Non-Processing Jobs
        if (!wasProcessing) {
            if ((job as any).escrow?.txSignature && (job as any).escrow.status === 'locked') {
                try {
                    const user = await User.findById(job.userId);
                    if (user && user.solanaSeed) {
                        console.log(`[JobService] Attempting on-chain unlock for job ${jobId}`);
                        const unlockTx = await solanaService.cancelPayment(
                            user.solanaSeed,
                            (job as any).escrow.onchainJobId,
                            (job as any).escrow.lockedAmount || job.estimatedCost
                        );
                        console.log(`[JobService] ✅ On-chain Unlock Successful: ${unlockTx}`);
                        (job as any).escrow.status = 'refunded';
                        (job as any).escrow.unlockTxSignature = unlockTx;
                    }
                } catch (err) {
                    console.error('[JobService] ❌ On-chain Unlock Failed (Non-fatal for DB):', err);
                }
            }

            const usesOnchainEscrow = !!(job as any).escrow?.txSignature;
            if (usesOnchainEscrow || oldStatus === 'pending') {
                const user = await User.findById(userId);
                if (user && user.role !== 'admin') {
                    const refundAmount = usesOnchainEscrow
                        ? (job as any).escrow?.lockedAmount || job.estimatedCost
                        : job.estimatedCost!;
                    if (refundAmount > 0) {
                        await User.findByIdAndUpdate(userId, { $inc: { tokenBalance: Number(refundAmount) } });
                        console.log(`Refunded ${refundAmount} to User ${userId} DB balance for cancelled job ${jobId}`);
                        this.wsService?.emitToUser(userId.toString(), 'credit_balance_updated', {});
                    }
                }
            }
        }
        
        await job.save();

        // 2. Remove unassigned queued frames from BullMQ immediately
        try {
            const framesToRemove = job.frames.selected?.length > 0
                ? job.frames.selected
                : Array.from({ length: job.frames.end - job.frames.start + 1 }, (_, i) => job.frames.start + i);
            const unrenderedFrames = framesToRemove.filter(
                // Do not remove frames that are currently assigned so they can finish gracefully
                (f: number) => !job.frames.rendered.includes(f) && !job.frames.assigned.includes(f)
            );
            if (unrenderedFrames.length > 0) {
                await removeJobFrames(jobId, unrenderedFrames, job.settings.engine, job.settings.device);
            }
        } catch (queueErr) {
            console.warn(`⚠️  Failed to remove unassigned BullMQ frames for cancelled job ${jobId}:`, queueErr);
        }

        // 3. Node Management
        let nodeIds: string[] = [];
        if (job.assignedNodes instanceof Map) {
            nodeIds = Array.from(job.assignedNodes.keys());
        } else if (typeof job.assignedNodes === 'object' && job.assignedNodes !== null) {
            nodeIds = Object.keys(job.assignedNodes);
        }

        if (!wasProcessing) {
            // For non-processing jobs, disconnect immediately
            if (nodeIds.length > 0) {
                await Node.updateMany(
                    { nodeId: { $in: nodeIds } },
                    { $set: { status: 'online', currentJob: undefined, currentProgress: undefined } }
                );
            }
            nodeIds.forEach(nodeId => {
                this.wsService?.broadcastNodeUpdate(nodeId, { status: 'online', currentJob: undefined });
            });
        } else {
            // If processing, nodes keep working on assigned frames.
            // But we notify them the job status changed (optional, but good for UI).
            // Do not reset currentJob here!
            nodeIds.forEach(nodeId => {
                // Just an informational ping
                this.wsService?.broadcastNodeUpdate(nodeId, { status: 'busy' });
            });
        }

        // Cleanup S3 files if explicitly requested
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

        if (wasProcessing && job.frames.assigned.length === 0) {
            console.log(`[JobService] Job ${jobId} cancelled while processing but 0 assigned frames. Forcing sync.`);
            await this.syncJobStatus(jobId);
        } else {
            // Broadcast updates
            this.wsService?.broadcastJobUpdate(jobId);
        }

        return true;
    }

    // Approve job (Dual Context: Admin start render vs User finalize completed job)
    async approveJob(jobId: string, requestingUserId: string, role: string): Promise<boolean> {
        const job = await Job.findOne({ jobId });
        if (!job) return false;

        if (job.status === 'completed') {
            // Context 1: Client finalizing their own completed job
            if (role !== 'admin' && job.userId.toString() !== requestingUserId) {
                throw new AppError('Only the job owner or an admin can finalize this job', 403);
            }

            job.approved = true;
            // job.status remains 'completed'

            await job.save();
            this.wsService?.broadcastJobUpdate(jobId);
            return true;
        } else {
            // Context 2: Admin approving a pending job to start rendering
            if (role !== 'admin') {
                throw new AppError('Admin access required to approve pending scripts', 403);
            }

            if (job.approved) {
                throw new AppError('Job is already approved', 400);
            }

            if (!job.requireApproval) {
                throw new AppError('Job does not require approval', 400);
            }

            job.approved = true;
            job.approvedBy = new Types.ObjectId(requestingUserId);
            job.approvedAt = new Date();
            job.status = 'pending'; // Ready for processing

            await job.save();
            this.wsService?.broadcastJobUpdate(jobId);
            return true;
        }
    }

    // Get job statistics
    async getJobStats(userId?: string, role?: string, adminView?: boolean): Promise<JobStats> {
        const matchStage: any = {};

        // Non-admin users (OR admins without adminView specified) can only see their own stats
        if (userId && (role !== 'admin' || !adminView)) {
            matchStage.userId = new Types.ObjectId(userId);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const [statsResult, userData] = await Promise.all([
            Job.aggregate([
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
            ]),
            userId ? User.findById(userId).select('stats').lean() : null
        ]);

        const stats = statsResult[0];
        const userStats = (userData as any)?.stats;

        const statusCounts = stats.statusCounts.reduce((acc: any, curr: any) => {
            acc[curr._id] = curr.count;
            return acc;
        }, {});

        const totals = stats.totals[0] || {
            totalJobs: 0,
            totalRenderTime: 0,
            totalCreditsUsed: 0,
            estimatedTotalCost: 0,
            actualTotalCost: 0,
            totalFramesRendered: 0
        };

        const todayStats = stats.todayStats[0] || {
            completedToday: 0,
            framesRenderedToday: 0
        };

        const totalRenderTimeSec = (totals.totalRenderTime || 0) / 1000;

        return {
            // Prioritize real-time database counts over cached User table stats
            totalJobs: totals.totalJobs,
            activeJobs:
                (statusCounts.pending || 0) +
                (statusCounts.pending_payment || 0) +
                (statusCounts.processing || 0) +
                (statusCounts.paused || 0),
            processingJobs: statusCounts.processing || 0,
            pendingJobs: (statusCounts.pending || 0) + (statusCounts.pending_payment || 0),
            completedJobs: statusCounts.completed || 0,
            failedJobs: statusCounts.failed || 0,
            cancelledJobs: (statusCounts.cancelled || 0) + (statusCounts.cancelling || 0),
            pausedJobs: statusCounts.paused || 0,
            completedToday: todayStats.completedToday,
            totalRenderTime: totalRenderTimeSec,
            totalCreditsUsed: totals.totalCreditsUsed,
            totalFramesRendered: totals.totalFramesRendered, // Use real-time count
            avgRenderTimePerFrame: totals.totalFramesRendered > 0
                ? totalRenderTimeSec / totals.totalFramesRendered
                : 0,
            framesRenderedToday: todayStats.framesRenderedToday,
            estimatedTotalCost: totals.estimatedTotalCost,
            actualTotalCost: totals.actualTotalCost
        };
    }

    // Get user-specific job statistics
    async getUserJobStats(userId: string): Promise<UserJobStats> {
        const [jobStats, user] = await Promise.all([
            (Job as any).getUserStats(userId),
            User.findById(userId).select('credits stats')
        ]);

        const stats = jobStats;
        const userStats = (user as any)?.stats;

        const successRate = stats.totalJobs > 0
            ? (stats.completedJobs / stats.totalJobs) * 100
            : 0;

        const totalRenderTimeSec = (stats.totalRenderTime || 0) / 1000;

        const avgJobCompletionTime = stats.completedJobs > 0
            ? totalRenderTimeSec / stats.completedJobs
            : 0;

        return {
            totalJobs: userStats?.jobsCreated ?? stats.totalJobs,
            activeJobs: stats.activeJobs,
            completedJobs: stats.completedJobs,
            totalSpent: userStats?.totalSpent ?? stats.totalSpent,
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

        // Granular Factors (Matching Frontend CreateJob.tsx)
        const complexityFactor = (settings.samples || 128) / 128;
        const resolutionFactor = ((settings.resolutionX || 1920) * (settings.resolutionY || 1080)) / (1920 * 1080);
        
        let baseCost = frames * creditsPerFrame;
        baseCost *= complexityFactor;
        baseCost *= resolutionFactor;

        // Engine & Device Factors
        if (settings.engine === 'CYCLES') baseCost *= 1.2;
        if (settings.device === 'GPU') baseCost *= 0.8;

        return Math.ceil(baseCost);
    }

    private calculateEstimatedCost(type: 'image' | 'animation', settings: any, startFrame: number, endFrame: number): number {
        // Unify with Credits (since we are a token-based system)
        return this.calculateEstimatedCredits(type, settings, startFrame, endFrame);
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