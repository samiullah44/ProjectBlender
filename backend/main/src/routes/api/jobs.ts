// backend/src/routes/api/jobs.ts
import express from 'express';
import multer from 'multer';
import { JobController } from '../../controllers/jobs';
import { JobService } from '../../services/JobService';
import { S3Service } from '../../services/S3Service';
import { authenticate, authorize } from '../../middleware/auth';
import { UploadController } from '../../controllers/uploadController';

const router = express.Router();

// Initialize services
const s3Service = new S3Service();
const jobService = new JobService(s3Service);
const jobController = new JobController(jobService, s3Service);

// Configure multer
const storage = multer.memoryStorage();
export const upload = multer({
    storage,
    limits: {
        fileSize: 1024 * 1024 * 1024, // 1GB
        files: 1
    }
});

// Upload routes (multipart)
router.post('/upload/initiate', UploadController.initiateUpload);
router.post('/upload/complete', UploadController.completeUpload);
router.delete('/upload/abort', UploadController.abortUpload);

// Public job routes (authenticated)
router.post('/upload',
    authenticate,
    upload.single('blendFile'),
    jobController.createJob.bind(jobController)
);

router.get('/health', jobController.healthCheck.bind(jobController));

// Protected job routes
router.get('/',
    authenticate,
    jobController.listJobs.bind(jobController)
);

router.get('/stats',
    authenticate,
    jobController.getJobStats.bind(jobController)
);

router.get('/user-stats',
    authenticate,
    jobController.getUserJobStats.bind(jobController)
);

router.get('/:jobId',
    authenticate,
    jobController.getJob.bind(jobController)
);

router.put('/:jobId',
    authenticate,
    jobController.updateJob.bind(jobController)
);

router.delete('/:jobId',
    authenticate,
    jobController.cancelJob.bind(jobController)
);

// Admin-only routes
router.post('/:jobId/approve',
    authenticate,
    authorize('admin'),
    jobController.approveJob.bind(jobController)
);

// Node-specific routes (for rendering nodes)
router.get('/:jobId/upload-url/:frame',
    jobController.generateFrameUploadUrl.bind(jobController)
);

router.post('/:jobId/complete-frame',
    jobController.completeFrame.bind(jobController)
);

// Legacy routes (for backward compatibility)
router.get('/dashboard/stats',
    authenticate,
    jobController.getJobStats.bind(jobController)
);

router.get('/:jobId/upload-url/:frame',
    jobController.generateFrameUploadUrl.bind(jobController)
);

router.post('/:jobId/complete-frame',
    jobController.completeFrame.bind(jobController)
);

router.post('/:jobId/fail-frame', (req, res) => {
    // Implement fail frame logic
    res.json({ success: true, message: 'Frame failure recorded' });
});

router.post('/:jobId/select-frames',
    authenticate,
    (req, res) => {
        // Implement select frames logic
        res.json({ success: true, message: 'Frames selected' });
    }
);

export default router;