// backend/src/middleware/jobAuth.ts
import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Job } from '../models/Job';
import { AppError } from './error';

// Middleware to check if user owns the job or is admin
export const checkJobOwnership = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { jobId } = req.params;
        const user = (req as any).user;

        if (!user) {
            throw new AppError('Authentication required', 401);
        }

        const job = await Job.findOne({ jobId });

        if (!job) {
            throw new AppError('Job not found', 404);
        }

        // Check if user owns the job or is admin
        if (user.role !== 'admin' && !job.userId.equals(new mongoose.Types.ObjectId(user.userId))) {
            throw new AppError('Access denied', 403);
        }

        // Attach job to request for later use
        (req as any).job = job;
        next();
    } catch (error) {
        next(error);
    }
};

// Middleware to check if job is in a modifiable state
export const checkJobModifiable = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const job = (req as any).job;

        if (!job) {
            throw new AppError('Job not found', 404);
        }

        // Jobs that are completed, failed, or cancelled cannot be modified
        if (['completed', 'failed', 'cancelled'].includes(job.status)) {
            throw new AppError(`Cannot modify a ${job.status} job`, 400);
        }

        next();
    } catch (error) {
        next(error);
    }
};

// Middleware to check if job requires approval
export const checkJobApproval = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const job = (req as any).job;

        if (!job) {
            throw new AppError('Job not found', 404);
        }

        if (job.requireApproval && !job.approved) {
            throw new AppError('Job requires approval before processing', 400);
        }

        next();
    } catch (error) {
        next(error);
    }
};