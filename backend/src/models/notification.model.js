/**
 * CampusFlow API - Notification Model
 * Persists transactional and in-app notifications for reservation lifecycle events
 * (e.g. pending student approval requests, decisions, system alerts).
 */

import mongoose, { Schema } from 'mongoose';

export const NotificationType = Object.freeze({
  PENDING_RESERVATION_APPROVAL: 'PENDING_RESERVATION_APPROVAL',
  RESERVATION_APPROVED: 'RESERVATION_APPROVED',
  RESERVATION_REJECTED: 'RESERVATION_REJECTED',
});

export const NotificationStatus = Object.freeze({
  PENDING: 'PENDING',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
});

export const NotificationChannel = Object.freeze({
  IN_APP: 'IN_APP',
  EMAIL: 'EMAIL',
});

const NotificationSchema = new Schema(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Notification recipient is required'],
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reservation: {
      type: Schema.Types.ObjectId,
      ref: 'Reservation',
      required: false,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: Object.values(NotificationChannel),
      default: NotificationChannel.IN_APP,
    },
    deliveryStatus: {
      type: String,
      enum: Object.values(NotificationStatus),
      default: NotificationStatus.DELIVERED,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    payload: {
      studentName: { type: String, default: null },
      studentEmail: { type: String, default: null },
      resourceName: { type: String, default: null },
      resourceCode: { type: String, default: null },
      date: { type: String, default: null },
      startTime: { type: String, default: null },
      endTime: { type: String, default: null },
      durationMinutes: { type: Number, default: null },
      purpose: { type: String, default: null },
      reservationId: { type: String, default: null },
      reviewUrl: { type: String, default: '/dashboard/approvals' },
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    deliveryError: {
      type: String,
      default: null,
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast user notification feed
NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', NotificationSchema);

