/**
 * CampusFlow API - Notification Controller
 * Handles user notification feed retrieval and read acknowledgements.
 */

import { NotificationService } from '../services/notification.service.js';
import { sendSuccess } from '../utils/response.js';
import { ForbiddenError } from '../utils/errors.js';

export async function getUserNotifications(req, res, next) {
  try {
    if (!req.user) {
      return next(new ForbiddenError('Unauthorized'));
    }

    const result = await NotificationService.getUserNotifications(req.user.id, req.query);
    sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
}

export async function markNotificationAsRead(req, res, next) {
  try {
    if (!req.user) {
      return next(new ForbiddenError('Unauthorized'));
    }

    const { id } = req.params;
    const updated = await NotificationService.markAsRead(id, req.user.id);
    sendSuccess(res, updated, 200);
  } catch (error) {
    next(error);
  }
}

export async function markAllNotificationsAsRead(req, res, next) {
  try {
    if (!req.user) {
      return next(new ForbiddenError('Unauthorized'));
    }

    const result = await NotificationService.markAllAsRead(req.user.id);
    sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
}

