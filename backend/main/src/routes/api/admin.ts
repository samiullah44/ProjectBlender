import express from 'express';
import { AdminController } from '../../controllers/AdminController';
import { authenticate, authorize } from '../../middleware/auth';

const router = express.Router();

router.get('/platform-fees', authenticate, authorize('admin'), AdminController.getPlatformFees);
router.post('/update-config', authenticate, authorize('admin'), AdminController.updateConfig);

// Analytics
router.get('/analytics', authenticate, authorize('admin'), AdminController.getAnalytics);

// User Management
router.get('/users', authenticate, authorize('admin'), AdminController.getAllUsers);
router.post('/users/:userId/ban', authenticate, authorize('admin'), AdminController.banUser);
router.post('/users/:userId/unban', authenticate, authorize('admin'), AdminController.unbanUser);

// Audit Logs
router.get('/audit-logs', authenticate, authorize('admin'), AdminController.getAuditLogs);

export default router;
