// routes/jobRoutes.ts
import express from 'express';
import { JobController, upload } from '../../controllers/jobs';
import { UploadController } from '../../controllers/uploadController';

const router = express.Router();

// Traditional single file upload (keep for backward compatibility)
// router.post('/upload', upload.single('blendFile'), JobController.createJob);

// NEW: Multipart upload routes
router.post('/upload/initiate', UploadController.initiateUpload);
router.post('/upload/complete', UploadController.completeUpload);
router.delete('/upload/abort', UploadController.abortUpload); // ADD THIS

// Existing routes remain the same...
router.get('/dashboard/stats', JobController.getDashboardStats);
router.get('/', JobController.listJobs);
router.get('/:jobId', JobController.getJob);
router.post('/:jobId/cancel', JobController.cancelJob);
router.get('/:jobId/upload-url/:frame', JobController.generateFrameUploadUrl);
router.post('/:jobId/complete-frame', JobController.completeFrame);
router.post('/:jobId/fail-frame', JobController.failFrame);
router.post('/:jobId/select-frames', JobController.selectFrames);
router.get('/health', JobController.healthCheck);

export default router;