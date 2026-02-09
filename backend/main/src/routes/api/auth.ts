// backend/src/routes/api/auth.ts
import express from 'express';
import { AuthController } from '../../controllers/authController';
import { authenticate, authorize } from '../../middleware/auth';

const router = express.Router();

// Public routes
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);

// Protected routes
router.get('/profile', authenticate, AuthController.getProfile);
router.put('/profile', authenticate, AuthController.updateProfile);

// Admin only routes
router.post('/add-credits', authenticate, authorize('admin'), AuthController.addCredits);

export default router;