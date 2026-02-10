// backend/src/services/JobService.ts
import { Types } from 'mongoose';
import { Job, IJob } from '../models/Job';
import { Node } from '../models/Node';
import { User } from '../models/User';
import { S3Service } from './S3Service';
import { WebSocketService } from './WebSocketService';
import { AppError } from '../middleware/error';
import {
    ICreateJobRequest,
    IJobFilterOptions,
    IJobStatistics,
    INodeContribution,
    IJobOutput
} from '../types/jobs/jobs.types';

export class JobService {
    private s3Service: S3Service;

    constructor() {
        this.s3Service = new S3Service();
    }

    /**
     * Create a new job with user-specific validation
     */
    async createJob(
        userId: Types.ObjectId | string,
        request: ICreateJobRequest,
        file?: Express.Multer.File
    ): Promise<{ job: IJob; blendFileUrl: string; fileStructure: any }> {
        try {
            // Validate user exists and has sufficient credits
            const user = await User.findById(userId);
            if (!user) {
                throw new AppError('User not found', 404);
            }

            // For clients, check if they have sufficient credits
            if (user.role === 'client' && user.credits < 10) { // Minimum credit check
                throw new AppError('Insufficient credits to create job', 400);
            }

            const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const projectId = request.projectId || user.preferences?.defaultProjectId || 'default-project';

            // Calculate total frames
            let totalFrames = 1;
            let selectedFrames: number[] = [];

            if (request.type === 'animation') {
                const startFrame = request.startFrame || 1;
                const endFrame = request.endFrame || 10;
                totalFrames = endFrame - startFrame + 1;
                selectedFrames = Array.from({ length: totalFrames }, (_, i) => startFrame + i);
            } else if (request.type === 'image') {
                const frame = request.selectedFrame || 1;
                totalFrames = 1;
                selectedFrames = [frame];
            }

            // Calculate credits required
            const creditsPerFrame = request.settings.creditsPerFrame || 1;
            const totalCreditsRequired = totalFrames * creditsPerFrame;

            // For clients, deduct credits
            if (user.role === 'client') {
                if (user.credits < totalCreditsRequired) {
                    throw new AppError(`Insufficient credits. Required: ${totalCreditsRequired}, Available: ${user.credits}`, 400);
                }
                await user.deductCredits(totalCreditsRequired);
            }

            let blendFileKey = '';
            let blendFileUrl = '';

            if (file) {
                // Upload blend file to S3
                blendFileKey = await this.s3Service.uploadBlendFile(file, jobId);
                blendFileUrl = await this.s3Service.generateBlendFileDownloadUrl(blendFileKey);
            }

            // Create job
            const job = new Job({
                jobId,
                projectId,
                userId,
                blendFileKey,
                blendFileUrl,
                blendFileName: file?.originalname || 'unknown.blend',
                type: request.type,
                settings: {
                    engine: request.settings.engine || 'CYCLES',
                    device: request.settings.device || 'GPU',
                    samples: request.settings.samples || 128,
                    resolutionX: request.settings.resolutionX || 1920,
                    resolutionY: request.settings.resolutionY || 1080,
                    tileSize: request.settings.tileSize || 256,
                    denoiser: request.type === 'image' ? request.settings.denoiser : undefined,
                    outputFormat: request.settings.outputFormat || 'PNG',
                    creditsPerFrame,
                    selectedFrame: request.type === 'image' ? request.selectedFrame : undefined
                },
                frames: {
                    start: request.type === 'animation' ? (request.startFrame || 1) : (request.selectedFrame || 1),
                    end: request.type === 'animation' ? (request.endFrame || 10) : (request.selectedFrame || 1),
                    total: totalFrames,
                    selected: selectedFrames,
                    rendered: [],
                    failed: [],
                    assigned: []
                },
                assignedNodes: new Map(),
                frameAssignments: [],
                status: 'pending',
                progress: 0,
                outputUrls: [],
                createdAt: new Date(),
                updatedAt: new Date()
            });

            await job.save();

            // Update user stats
            user.stats!.jobsCreated += 1;
            await user.save();

            console.log(`🎬 New ${request.type} job created by user ${userId}: ${jobId} with ${totalFrames} frame(s)`);

            return {
                job,
                blendFileUrl,
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

    /**
     * Get job with user-specific access control
     */
    async getJob(
        jobId: string,
        userId: Types.ObjectId | string,
        userRole: string
    ): Promise<{ job: IJob; blendFileUrl: string; outputUrls: IJobOutput[] }> {
        const job = await Job.findOne({ jobId });
        if (!job) {
            throw new AppError('Job not found', 404);
        }

        // Check access permissions
        this.checkJobAccess(job, userId, userRole);

        // Generate fresh URLs
        const blendFileUrl = await this.s3Service.generateBlendFileDownloadUrl(job.blendFileKey);

        const outputUrls = await Promise.all(
            job.outputUrls.map(async (output) => ({
                ...output,
                freshUrl: await this.s3Service.generateFrameDownloadUrl(output.s3Key)
            }))
        );

        return {
            job,
            blendFileUrl,
            outputUrls
        };
    }

    /**
     * List jobs with user-specific filtering
     */
    async listJobs(
        filterOptions: IJobFilterOptions
    ): Promise<{ jobs: IJob[]; total: number }> {
        const {
            userId,
            projectId,
            status,
            type,
            startDate,
            endDate,
            page = 1,
            limit = 50,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = filterOptions;

        const query: any = {};

        // Apply user-specific filtering
        if (userId) {
            query.userId = userId;
        }

        if (projectId) {
            query.projectId = projectId;
        }

        if (status) {
            query.status = status;
        }

        if (type) {
            query.type = type;
        }

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = startDate;
            if (endDate) query.createdAt.$lte = endDate;
        }

        const skip = (page - 1) * limit;
        const sort: any = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

        const [jobs, total] = await Promise.all([
            Job.find(query)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            Job.countDocuments(query)
        ]);

        return { jobs, total };
    }

    /**
     * Cancel job with user-specific permissions
     */
    async cancelJob(
        jobId: string,
        userId: Types.ObjectId | string,
        userRole: string,
        cleanupS3: boolean = false
    ): Promise<{ success: boolean; message: string }> {
        const job = await Job.findOne({ jobId });
        if (!job) {
            throw new AppError('Job not found', 404);
        }

        // Check permissions (admin can cancel any job, users can only cancel their own)
        if (userRole !== 'admin' && job.userId.toString() !== userId.toString()) {
            throw new AppError('Unauthorized to cancel this job', 403);
        }

        // Only allow cancelling if job is pending or processing
        if (job.status === 'completed' || job.status === 'failed') {
            throw new AppError('Cannot cancel a completed or failed job', 400);
        }

        job.status = 'cancelled';
        job.cancelledAt = new Date();
        await job.save();

        // If cleanup requested, delete S3 files
        if (cleanupS3) {
            try {
                await this.s3Service.deleteFile(job.blendFileKey);
                for (const output of job.outputUrls) {
                    await this.s3Service.deleteFile(output.s3Key);
                }
            } catch (s3Error) {
                console.error('Failed to cleanup S3 files:', s3Error);
                // Don't fail the cancellation if S3 cleanup fails
            }
        }

        return {
            success: true,
            message: 'Job cancelled successfully'
        };
    }

    /**
     * Select frames for rendering (user-specific)
     */
    async selectFrames(
        jobId: string,
        userId: Types.ObjectId | string,
        frames: number[]
    ): Promise<{ success: boolean; message: string }> {
        const job = await Job.findOne({ jobId });
        if (!job) {
            throw new AppError('Job not found', 404);
        }

        // Check if user owns the job
        if (job.userId.toString() !== userId.toString()) {
            throw new AppError('Unauthorized to modify this job', 403);
        }

        // Validate frames
        if (!Array.isArray(frames) || frames.length === 0) {
            throw new AppError('Frames must be a non-empty array', 400);
        }

        const minFrame = job.frames.start;
        const maxFrame = job.frames.end;

        for (const frame of frames) {
            if (frame < minFrame || frame > maxFrame) {
                throw new AppError(`Frame ${frame} is out of range (${minFrame}-${maxFrame})`, 400);
            }
        }

        // Update selected frames
        job.frames.selected = frames;
        job.frames.total = frames.length;

        // Remove any rendered/failed frames that are no longer selected
        job.frames.rendered = job.frames.rendered.filter(f => frames.includes(f));
        job.frames.failed = job.frames.failed.filter(f => frames.includes(f));
        job.frames.assigned = job.frames.assigned.filter(f => frames.includes(f));

        // Clear assigned nodes for frames that are no longer selected
        const assignedNodesMap = job.assignedNodes as unknown as Map<string, number[]>;
        for (const [nodeId, nodeFrames] of assignedNodesMap.entries()) {
            const updatedFrames = nodeFrames.filter(f => frames.includes(f));
            if (updatedFrames.length === 0) {
                assignedNodesMap.delete(nodeId);
            } else {
                assignedNodesMap.set(nodeId, updatedFrames);
            }
        }

        // Recalculate progress
        job.progress = Math.round((job.frames.rendered.length / job.frames.total) * 100);
        await job.save();

        return {
            success: true,
            message: 'Frames updated successfully'
        };
    }

    /**
     * Get dashboard statistics (user-specific)
     */
    async getDashboardStats(
        userId?: Types.ObjectId | string,
        startDate?: Date,
        endDate?: Date
    ): Promise<IJobStatistics> {
        const start = startDate || new Date();
        start.setHours(0, 0, 0, 0);

        const end = endDate || new Date();
        end.setHours(23, 59, 59, 999);

        const query: any = {
            createdAt: { $gte: start, $lte: end }
        };

        if (userId) {
            query.userId = userId;
        }

        const jobs = await Job.find(query);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);

        const stats: IJobStatistics = {
            totalJobs: jobs.length,
            activeJobs: jobs.filter(j => ['pending', 'processing'].includes(j.status)).length,
            completedJobs: jobs.filter(j => j.status === 'completed').length,
            failedJobs: jobs.filter(j => j.status === 'failed').length,
            totalFrames: jobs.reduce((sum, job) => sum + job.frames.total, 0),
            renderedFrames: jobs.reduce((sum, job) => sum + job.frames.rendered.length, 0),
            totalRenderTime: jobs.reduce((sum, job) => sum + (job.renderTime || 0), 0),
            totalCreditsUsed: jobs.reduce((sum, job) => sum + (job.totalCreditsDistributed || 0), 0),
            avgRenderTimePerFrame: 0,
            framesRenderedToday: 0,
            completedToday: 0
        };

        // Calculate completed today
        const completedToday = jobs.filter(j =>
            j.status === 'completed' &&
            j.completedAt &&
            j.completedAt >= today &&
            j.completedAt <= todayEnd
        );
        stats.completedToday = completedToday.length;

        // Calculate frames rendered today
        stats.framesRenderedToday = jobs.reduce((sum, job) => {
            if (job.completedAt && job.completedAt >= today && job.completedAt <= todayEnd) {
                return sum + job.frames.rendered.length;
            }
            return sum;
        }, 0);

        // Calculate average render time per frame
        if (stats.renderedFrames > 0) {
            stats.avgRenderTimePerFrame = stats.totalRenderTime / stats.renderedFrames;
        }

        return stats;
    }

    /**
     * Generate frame upload URL (for nodes)
     */
    async generateFrameUploadUrl(jobId: string, frame: number): Promise<{ uploadUrl: string; s3Key: string }> {
        const job = await Job.findOne({ jobId });
        if (!job) {
            throw new AppError('Job not found', 404);
        }

        // Check if frame is valid for this job
        if (frame < job.frames.start || frame > job.frames.end) {
            throw new AppError(`Frame ${frame} is out of range for this job`, 400);
        }

        // Check if frame is already rendered
        if (job.frames.rendered.includes(frame)) {
            throw new AppError(`Frame ${frame} is already rendered`, 400);
        }

        return await this.s3Service.generateFrameUploadUrl(jobId, frame);
    }

    /**
     * Complete frame rendering (for nodes)
     */
    async completeFrame(
        jobId: string,
        frame: number,
        nodeId: string,
        renderTime: number,
        fileSize: number,
        s3Key: string
    ): Promise<{
        success: boolean;
        progress: number;
        status: string;
        isNodeDone: boolean;
    }> {
        const job = await Job.findOne({ jobId });
        if (!job) {
            throw new AppError('Job not found', 404);
        }

        // Check if frame is already rendered
        if (job.frames.rendered.includes(frame)) {
            return {
                success: true,
                progress: job.progress,
                status: job.status,
                isNodeDone: false
            };
        }

        // Generate download URL
        const downloadUrl = await this.s3Service.generateFrameDownloadUrl(s3Key);

        // Update frame status
        const updatedJob = await Job.findOneAndUpdate(
            {
                jobId,
                'frames.rendered': { $ne: frame }
            },
            {
                $addToSet: {
                    'frames.rendered': frame,
                    'outputUrls': {
                        frame,
                        url: downloadUrl,
                        s3Key,
                        fileSize,
                        uploadedAt: new Date()
                    }
                },
                $pull: {
                    'frames.failed': frame,
                    'frames.assigned': frame
                }
            },
            { new: true }
        );

        if (!updatedJob) {
            throw new AppError('Failed to update frame status', 500);
        }

        // Update frame assignment
        const assignment = updatedJob.frameAssignments.find(
            (a) => a.frame === frame && a.nodeId === nodeId
        );

        if (assignment) {
            assignment.status = 'rendered';
            assignment.completedAt = new Date();
            assignment.renderTime = renderTime;
            assignment.s3Key = s3Key;
        }

        // Remove frame from assigned nodes
        const assignedNodesMap = updatedJob.assignedNodes as unknown as Map<string, number[]>;
        const nodeFrames = assignedNodesMap?.get(nodeId) || [];
        const updatedNodeFrames = nodeFrames.filter(f => f !== frame);

        let isNodeDone = false;
        if (updatedNodeFrames.length === 0) {
            assignedNodesMap?.delete(nodeId);
            isNodeDone = true;
        } else {
            assignedNodesMap?.set(nodeId, updatedNodeFrames);
        }

        // Calculate progress and update status
        const totalFrames = updatedJob.frames.total;
        const renderedFrames = updatedJob.frames.rendered.length;
        const failedFrames = updatedJob.frames.failed.length;
        const progress = Math.round((renderedFrames / totalFrames) * 100);

        let status = updatedJob.status;
        if (renderedFrames === totalFrames) {
            status = 'completed';
            updatedJob.completedAt = new Date();

            // Mark all nodes as online
            const allNodeIds = Array.from(assignedNodesMap.keys());
            if (allNodeIds.length > 0) {
                await Node.updateMany(
                    { nodeId: { $in: allNodeIds } },
                    {
                        status: 'online',
                        currentJob: undefined,
                        currentProgress: undefined
                    }
                );
            }
        } else if (renderedFrames + failedFrames === totalFrames) {
            status = 'failed';
        } else {
            status = 'processing';
        }

        updatedJob.status = status;
        updatedJob.progress = progress;
        updatedJob.assignedNodes = assignedNodesMap as any;
        await updatedJob.save();

        // Update node if done
        if (isNodeDone) {
            await Node.updateOne(
                { nodeId },
                {
                    status: 'online',
                    currentJob: undefined,
                    currentProgress: undefined,
                    $inc: { jobsCompleted: 1 }
                }
            );
        }

        // Distribute credits to node provider
        if (updatedJob.settings.creditsPerFrame && assignment) {
            const credits = updatedJob.settings.creditsPerFrame;
            assignment.creditsEarned = credits;

            // Find node's user and add earnings
            const node = await Node.findOne({ nodeId });
            if (node && node.userId) {
                const nodeUser = await User.findById(node.userId);
                if (nodeUser && nodeUser.role === 'node_provider') {
                    await nodeUser.addEarnings(credits);
                }
            }
        }

        return {
            success: true,
            progress,
            status,
            isNodeDone
        };
    }

    /**
     * Mark frame as failed
     */
    async failFrame(
        jobId: string,
        frame: number,
        nodeId: string,
        error: string,
        s3Key: string
    ): Promise<{ success: boolean; progress: number; status: string }> {
        const job = await Job.findOne({ jobId });
        if (!job) {
            throw new AppError('Job not found', 404);
        }

        // Don't mark as failed if already rendered
        if (job.frames.rendered.includes(frame)) {
            return {
                success: true,
                progress: job.progress,
                status: job.status
            };
        }

        const updatedJob = await Job.findOneAndUpdate(
            {
                jobId,
                'frames.rendered': { $ne: frame },
                'frames.failed': { $ne: frame }
            },
            {
                $addToSet: {
                    'frames.failed': frame
                },
                $pull: {
                    'frames.assigned': frame
                }
            },
            { new: true }
        );

        if (!updatedJob) {
            return {
                success: true,
                progress: job.progress,
                status: job.status
            };
        }

        // Remove frame from assigned nodes
        const assignedNodesMap = updatedJob.assignedNodes as unknown as Map<string, number[]>;
        const nodeFrames = assignedNodesMap?.get(nodeId) || [];
        const updatedNodeFrames = nodeFrames.filter(f => f !== frame);

        if (updatedNodeFrames.length === 0) {
            assignedNodesMap?.delete(nodeId);
        } else {
            assignedNodesMap?.set(nodeId, updatedNodeFrames);
        }

        // Update progress
        const totalFrames = updatedJob.frames.total;
        const renderedFrames = updatedJob.frames.rendered.length;
        const failedFrames = updatedJob.frames.failed.length;
        const progress = Math.round((renderedFrames / totalFrames) * 100);

        let status = updatedJob.status;
        if (failedFrames === totalFrames) {
            status = 'failed';
        } else if (renderedFrames + failedFrames === totalFrames) {
            status = 'failed';
        } else {
            status = 'processing';
        }

        updatedJob.status = status;
        updatedJob.progress = progress;
        updatedJob.assignedNodes = assignedNodesMap as any;
        await updatedJob.save();

        // Update frame assignment
        const assignment = updatedJob.frameAssignments.find(
            (a) => a.frame === frame && a.nodeId === nodeId
        );

        if (assignment) {
            assignment.status = 'failed';
        }

        return {
            success: true,
            progress,
            status
        };
    }

    /**
     * Get node contributions (for node providers and admins)
     */
    async getNodeContributions(
        userId?: Types.ObjectId | string,
        nodeId?: string
    ): Promise<INodeContribution[]> {
        const match: any = { 'frameAssignments.status': 'rendered' };

        if (nodeId) {
            match['frameAssignments.nodeId'] = nodeId;
        }

        // If user is not admin, they can only see contributions from their own nodes
        if (userId) {
            const user = await User.findById(userId);
            if (user && user.role !== 'admin') {
                const userNodes = await Node.find({ userId }).select('nodeId');
                const nodeIds = userNodes.map(n => n.nodeId);
                match['frameAssignments.nodeId'] = { $in: nodeIds };
            }
        }

        const result = await Job.aggregate([
            { $unwind: '$frameAssignments' },
            { $match: match },
            {
                $group: {
                    _id: '$frameAssignments.nodeId',
                    totalFramesRendered: { $sum: 1 },
                    totalRenderTime: { $sum: '$frameAssignments.renderTime' },
                    totalCreditsEarned: { $sum: '$frameAssignments.creditsEarned' },
                    avgFrameTime: { $avg: '$frameAssignments.renderTime' }
                }
            },
            {
                $project: {
                    nodeId: '$_id',
                    totalFramesRendered: 1,
                    totalRenderTime: { $round: ['$totalRenderTime', 2] },
                    totalCreditsEarned: 1,
                    avgFrameTime: { $round: ['$avgFrameTime', 2] },
                    _id: 0
                }
            },
            { $sort: { totalCreditsEarned: -1 } }
        ]);

        return result;
    }

    /**
     * Check job access permissions
     */
    private checkJobAccess(job: IJob, userId: Types.ObjectId | string, userRole: string): void {
        const jobUserId = job.userId instanceof Types.ObjectId
            ? job.userId.toString()
            : job.userId;

        const requestUserId = userId instanceof Types.ObjectId
            ? userId.toString()
            : userId;

        // Admins can access any job
        if (userRole === 'admin') {
            return;
        }

        // Users can only access their own jobs
        if (jobUserId !== requestUserId) {
            throw new AppError('Unauthorized to access this job', 403);
        }
    }

    /**
     * Get job statistics by status
     */
    async getJobStatistics(): Promise<Array<{
        status: string;
        count: number;
        totalFrames: number;
        renderedFrames: number;
        avgProgress: number;
        totalCredits: number;
    }>> {
        const stats = await Job.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalFrames: { $sum: '$frames.total' },
                    renderedFrames: { $sum: { $size: '$frames.rendered' } },
                    avgProgress: { $avg: '$progress' },
                    totalCredits: { $sum: '$totalCreditsDistributed' }
                }
            },
            {
                $project: {
                    status: '$_id',
                    count: 1,
                    totalFrames: 1,
                    renderedFrames: 1,
                    avgProgress: { $round: ['$avgProgress', 2] },
                    totalCredits: 1,
                    _id: 0
                }
            }
        ]);

        return stats;
    }
}

export const jobService = new JobService();