// backend/src/routes/api/jobs.ts
import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { JobController } from '../../controllers/jobs';
import { JobService } from '../../services/JobService';
import { S3Service } from '../../services/S3Service';
import { authenticate, authorize } from '../../middleware/auth';
import { UploadController } from '../../controllers/uploadController';
import { WebSocketService } from '../../services/WebSocketService';

const router = express.Router();

// ── Use the shared services from app.ts instead of creating new isolated ones.
// Services are attached to the Express app in app.ts and retrieved per-request.
// We create one controller instance but always give it the app-level jobService
// (which has wsService properly wired) before each request.
const s3Service = new S3Service();
// Fallback controller used only if app-level jobService is somehow unavailable
const fallbackJobService = new JobService(s3Service);
const jobController = new JobController(fallbackJobService, s3Service);

// Middleware: inject the app-level jobService + wsService into the controller
// so `notifyNodesToCheckJobs` is called on job creation.
const injectServices = (req: Request, _res: Response, next: NextFunction) => {
    const appJobService: JobService | undefined = req.app.get('jobService');
    const appWsService: WebSocketService | undefined = req.app.get('wsService');
    if (appJobService) {
        // Swap to the shared service that has wsService wired
        (jobController as any).jobService = appJobService;
        // Ensure wsService is set (defensive)
        if (appWsService && !appJobService['wsService']) {
            appJobService.setWebSocketService(appWsService);
        }
    }
    next();
};

// Configure multer
const storage = multer.memoryStorage();
export const upload = multer({
    storage,
    limits: {
        fileSize: 1024 * 1024 * 1024, // 1GB
        files: 1
    }
});

// Upload routes (multipart) - all require authentication
router.post('/upload/initiate', authenticate, UploadController.initiateUpload);
router.post('/upload/complete', authenticate, UploadController.completeUpload);
router.delete('/upload/abort', authenticate, UploadController.abortUpload);

// Public job routes (authenticated)
router.post('/upload',
    authenticate,
    injectServices,
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