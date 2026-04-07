import express from 'express';
import { AdminController } from '../../controllers/AdminController';
import { authenticate, authorize } from '../../middleware/auth';

const router = express.Router();

/**
 * Platform Fee Statistics
 * Only accessible by users with the 'admin' role.
 */
router.get(
  '/platform-fees',
  authenticate,
  authorize('admin'),
  AdminController.getPlatformFees
);

router.post(
  '/update-config',
  authenticate,
  authorize('admin'),
  AdminController.updateConfig
);

export default router;
