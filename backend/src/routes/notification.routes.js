/**
 * CampusFlow API - Notification Routes
 * Endpoints for notification delivery queries and read receipts.
 */

import { Router } from 'express';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../controllers/notification.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { validateMongoId } from '../validators/index.js';

const router = Router();

router.get('/', authenticate, getUserNotifications);

router.patch('/:id/read', authenticate, validateRequest({ params: validateMongoId('id') }), markNotificationAsRead);

router.post('/read-all', authenticate, markAllNotificationsAsRead);

export default router;

