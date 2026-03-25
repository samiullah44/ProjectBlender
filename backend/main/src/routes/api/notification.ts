import { Router } from 'express'
import { authenticate } from '../../middleware/auth'
import NotificationController from '../../controllers/notificationController'

const router = Router()

// All routes require authentication
router.get('/', authenticate, NotificationController.getNotifications)
router.get('/unread-count', authenticate, NotificationController.getUnreadCount)
router.put('/:id/read', authenticate, NotificationController.markAsRead)
router.put('/read-all', authenticate, NotificationController.markAllAsRead)
router.delete('/:id', authenticate, NotificationController.deleteNotification)

export default router
