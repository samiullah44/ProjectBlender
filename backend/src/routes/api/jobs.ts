import express from 'express';
import { JobController, upload } from '../../controllers/jobs';

const router = express.Router();

// Job management routes
router.post('/upload', upload.single('blendFile'), JobController.createJob);
router.get('/', JobController.listJobs);
router.get('/:jobId', JobController.getJob);
router.post('/:jobId/cancel', JobController.cancelJob);

// Frame upload and reporting routes (S3-based)
router.get('/:jobId/upload-url/:frame', JobController.generateFrameUploadUrl); // Get S3 upload URL
router.post('/:jobId/complete-frame', JobController.completeFrame); // Report completion with S3 key
router.post('/:jobId/fail-frame', JobController.failFrame); // Report failure

// Health check
router.get('/health', JobController.healthCheck);

export default router;