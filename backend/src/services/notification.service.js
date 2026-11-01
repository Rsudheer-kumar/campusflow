/**
 * CampusFlow API - Notification Service
 * Manages notification delivery, faculty alerting for pending student reservations,
 * decision notifications, and reliable auditing without impacting reservation lifecycle.
 */

import { Types } from 'mongoose';
import {
  Notification,
  NotificationType,
  NotificationStatus,
  NotificationChannel,
} from '../models/notification.model.js';
import { User, UserRole } from '../models/user.model.js';
import { logger } from '../utils/logger.js';

export class NotificationService {
  /**
   * Dispatches notifications to appropriate faculty reviewers when a student submits a reservation.
   *
   * @param {Object} params
   * @param {Object} params.reservation - Created reservation document
   * @param {Object} params.studentUser - Requester user object
   * @param {Object} params.resource - Reserved physical resource object
   * @returns {Promise<Array<Object>>} List of created notification records
   */
  static async notifyFacultyOfPendingReservation(params) {
    const { reservation, studentUser, resource } = params;

    try {
      if (!reservation || !studentUser || !resource) {
        logger.warn('NotificationService: Missing parameters for pending reservation notification');
        return [];
      }

      // 1. Identify appropriate faculty recipients:
      // Priority A: Active faculty in student's academic department
      let recipients = [];
      if (studentUser.department) {
        recipients = await User.find({
          roles: UserRole.FACULTY,
          department: studentUser.department,
          isActive: true,
        }).select('_id name email department preferences').lean();
      }

      // Priority B: If no department-specific faculty found, find all active faculty
      if (recipients.length === 0) {
        recipients = await User.find({
          roles: UserRole.FACULTY,
          isActive: true,
        }).select('_id name email department preferences').lean();
      }

      // Priority C: Fallback to Department Head or Admin if no faculty exists
      if (recipients.length === 0) {
        recipients = await User.find({
          roles: { $in: [UserRole.DEPARTMENT_HEAD, UserRole.ADMIN] },
          isActive: true,
        }).select('_id name email department preferences').lean();
      }

      if (recipients.length === 0) {
        logger.warn(
          `NotificationService: No faculty recipients found for student booking ${reservation._id}`
        );
        return [];
      }

      // 2. Format details
      const startAt = new Date(reservation.startAt);
      const endAt = new Date(reservation.endAt);
      const durationMinutes = Math.round((endAt.getTime() - startAt.getTime()) / 60000);
      const dateStr = startAt.toISOString().slice(0, 10);
      const startStr = startAt.toISOString().slice(11, 16) + ' UTC';
      const endStr = endAt.toISOString().slice(11, 16) + ' UTC';

      const payload = {
        studentName: studentUser.name,
        studentEmail: studentUser.email,
        resourceName: resource.name,
        resourceCode: resource.code,
        date: dateStr,
        startTime: startStr,
        endTime: endStr,
        durationMinutes,
        purpose: reservation.title || 'Student Academic Reservation',
        reservationId: reservation._id.toString(),
        reviewUrl: '/dashboard/approvals',
      };

      const title = `Pending Student Reservation: ${resource.name}`;
      const message =
        `Student ${studentUser.name} (${studentUser.email}) requested a reservation for ` +
        `${resource.name} (${resource.code}) on ${dateStr} from ${startStr} to ${endStr} ` +
        `(${durationMinutes}m). Purpose: "${payload.purpose}". Please review and approve or reject.`;

      // 3. Create a separate notification document for each recipient
      const notifications = [];
      for (const recipient of recipients) {
        // Enforce Four-Eyes: Do not notify student if they somehow held faculty role
        if (recipient._id.toString() === studentUser._id.toString()) continue;

        try {
          const doc = new Notification({
            recipient: recipient._id,
            sender: studentUser._id,
            reservation: reservation._id,
            type: NotificationType.PENDING_RESERVATION_APPROVAL,
            channel: NotificationChannel.IN_APP,
            deliveryStatus: NotificationStatus.DELIVERED,
            title,
            message,
            payload,
            sentAt: new Date(),
          });
          await doc.save();
          notifications.push(doc);
        } catch (deliveryErr) {
          logger.error(
            `NotificationService: Failed to deliver notification to faculty ${recipient._id}: ${deliveryErr.message}`
          );
        }
      }

      logger.info(
        `NotificationService: Sent ${notifications.length} notifications to faculty for reservation ${reservation._id}`
      );
      return notifications;
    } catch (err) {
      // Safe boundary: Never disrupt or crash reservation workflow due to notification failures
      logger.error(`NotificationService: Error in notifyFacultyOfPendingReservation: ${err.message}`);
      return [];
    }
  }

  /**
   * Notifies the student requester of the approval or rejection decision.
   */
  static async notifyStudentOfDecision(params) {
    const { reservation, decision, actorUser, comment } = params;

    try {
      if (!reservation || !decision) return null;

      const isApproved = decision === 'APPROVED';
      const type = isApproved
        ? NotificationType.RESERVATION_APPROVED
        : NotificationType.RESERVATION_REJECTED;

      const title = isApproved
        ? `Reservation Request Approved: ${reservation.title}`
        : `Reservation Request Rejected: ${reservation.title}`;

      let message = isApproved
        ? `Your reservation request for "${reservation.title}" has been approved by ${actorUser?.name || 'Faculty'}.`
        : `Your reservation request for "${reservation.title}" was rejected by ${actorUser?.name || 'Faculty'}.`;

      if (comment) {
        message += ` Reason: "${comment}".`;
      }

      const notif = new Notification({
        recipient: reservation.user,
        sender: actorUser?._id || null,
        reservation: reservation._id,
        type,
        channel: NotificationChannel.IN_APP,
        deliveryStatus: NotificationStatus.DELIVERED,
        title,
        message,
        payload: {
          reservationId: reservation._id.toString(),
          purpose: reservation.title,
          decision,
          comment: comment || null,
        },
        sentAt: new Date(),
      });

      await notif.save();
      return notif;
    } catch (err) {
      logger.error(`NotificationService: Error in notifyStudentOfDecision: ${err.message}`);
      return null;
    }
  }

  /**
   * Lists notifications for a given user.
   */
  static async getUserNotifications(userId, query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = { recipient: new Types.ObjectId(userId) };
    if (query.unreadOnly === 'true' || query.unreadOnly === true) {
      filter.isRead = false;
    }

    const [items, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient: new Types.ObjectId(userId), isRead: false }),
    ]);

    return {
      items,
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Marks a single notification as read.
   */
  static async markAsRead(notificationId, userId) {
    return await Notification.findOneAndUpdate(
      {
        _id: new Types.ObjectId(notificationId),
        recipient: new Types.ObjectId(userId),
      },
      {
        $set: { isRead: true, readAt: new Date() },
      },
      { new: true }
    );
  }

  /**
   * Marks all notifications for a user as read.
   */
  static async markAllAsRead(userId) {
    const res = await Notification.updateMany(
      { recipient: new Types.ObjectId(userId), isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    return { modifiedCount: res.modifiedCount };
  }
}

