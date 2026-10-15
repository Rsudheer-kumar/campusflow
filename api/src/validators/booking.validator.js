/**
 * CampusFlow API - Booking Request Validators
 * Request payload and query parameter validators for reservation operations.
 */

import { isValidIanaTimezone, isValidCalendarDate } from '../models/index.js';
import { ReservationStatus } from '../models/reservation.model.js';

const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export function validateCreateBookingBody(data) {
  const record = (data || {});
  const errors = [];

  // resourceId
  if (!record.resourceId || typeof record.resourceId !== 'string' || !MONGO_ID_REGEX.test(record.resourceId)) {
    errors.push({ field: 'resourceId', message: 'resourceId must be a valid 24-character hex ObjectId' });
  }

  // userId (optional - for on-behalf booking by DEPARTMENT_HEAD, otherwise uses req.user)
  if (record.userId !== undefined) {
    if (typeof record.userId !== 'string' || !MONGO_ID_REGEX.test(record.userId)) {
      errors.push({ field: 'userId', message: 'userId must be a valid 24-character hex ObjectId' });
    }
  }

  // startAt
  let startAtDate = null;
  if (!record.startAt || typeof record.startAt !== 'string') {
    errors.push({ field: 'startAt', message: 'startAt is required and must be an ISO date string' });
  } else {
    startAtDate = new Date(record.startAt);
    if (isNaN(startAtDate.getTime())) {
      errors.push({ field: 'startAt', message: 'startAt is not a valid date string' });
    }
  }

  // endAt
  let endAtDate = null;
  if (!record.endAt || typeof record.endAt !== 'string') {
    errors.push({ field: 'endAt', message: 'endAt is required and must be an ISO date string' });
  } else {
    endAtDate = new Date(record.endAt);
    if (isNaN(endAtDate.getTime())) {
      errors.push({ field: 'endAt', message: 'endAt is not a valid date string' });
    }
  }

  if (startAtDate && endAtDate && !isNaN(startAtDate.getTime()) && !isNaN(endAtDate.getTime())) {
    if (startAtDate.getTime() >= endAtDate.getTime()) {
      errors.push({ field: 'startAt', message: 'startAt must be earlier than endAt for a half-open interval' });
    }
  }

  // timezone
  if (!record.timezone || typeof record.timezone !== 'string') {
    errors.push({ field: 'timezone', message: 'timezone is required' });
  } else if (!isValidIanaTimezone(record.timezone)) {
    errors.push({ field: 'timezone', message: `Invalid IANA timezone identifier: "${record.timezone}"` });
  }

  // title
  if (!record.title || typeof record.title !== 'string') {
    errors.push({ field: 'title', message: 'title is required' });
  } else if (record.title.trim().length < 2 || record.title.trim().length > 200) {
    errors.push({ field: 'title', message: 'title must be between 2 and 200 characters' });
  }

  // description
  if (record.description !== undefined && typeof record.description !== 'string') {
    errors.push({ field: 'description', message: 'description must be a string' });
  } else if (typeof record.description === 'string' && record.description.length > 1000) {
    errors.push({ field: 'description', message: 'description cannot exceed 1000 characters' });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      resourceId: record.resourceId,
      userId: typeof record.userId === 'string' ? record.userId : undefined,
      startAt: record.startAt,
      endAt: record.endAt,
      timezone: record.timezone,
      title: record.title.trim(),
      description: typeof record.description === 'string' ? record.description.trim() : undefined,
      metadata: typeof record.metadata === 'object' && record.metadata !== null ? record.metadata : undefined,
    },
  };
}

export function validateCancelBookingBody(data) {
  const record = (data || {});
  const errors = [];

  if (record.userId !== undefined) {
    if (typeof record.userId !== 'string' || !MONGO_ID_REGEX.test(record.userId)) {
      errors.push({ field: 'userId', message: 'userId must be a valid 24-character hex ObjectId' });
    }
  }

  if (record.reason !== undefined) {
    if (typeof record.reason !== 'string' || record.reason.length > 500) {
      errors.push({ field: 'reason', message: 'reason must be a string not exceeding 500 characters' });
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      userId: record.userId,
      reason: typeof record.reason === 'string' ? record.reason.trim() : undefined,
    },
  };
}

export function validateTransitionBookingStatusBody(data) {
  const record = (data || {});
  const errors = [];

  const validStatuses = Object.values(ReservationStatus);
  if (!record.status || !validStatuses.includes(record.status)) {
    errors.push({ field: 'status', message: `status must be one of: ${validStatuses.join(', ')}` });
  }

  if (record.userId !== undefined) {
    if (typeof record.userId !== 'string' || !MONGO_ID_REGEX.test(record.userId)) {
      errors.push({ field: 'userId', message: 'userId must be a valid 24-character hex ObjectId' });
    }
  }

  if (record.reason !== undefined) {
    if (typeof record.reason !== 'string' || record.reason.length > 500) {
      errors.push({ field: 'reason', message: 'reason must be a string not exceeding 500 characters' });
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      status: record.status,
      userId: record.userId,
      reason: typeof record.reason === 'string' ? record.reason.trim() : undefined,
    },
  };
}

export function validateCheckAvailabilityQuery(data) {
  const record = (data || {});
  const errors = [];

  if (!record.resourceId || typeof record.resourceId !== 'string' || !MONGO_ID_REGEX.test(record.resourceId)) {
    errors.push({ field: 'resourceId', message: 'resourceId is required and must be a 24-character hex ObjectId' });
  }

  let startAtDate = null;
  if (!record.startAt || typeof record.startAt !== 'string') {
    errors.push({ field: 'startAt', message: 'startAt is required and must be an ISO date string' });
  } else {
    startAtDate = new Date(record.startAt);
    if (isNaN(startAtDate.getTime())) {
      errors.push({ field: 'startAt', message: 'startAt is not a valid date string' });
    }
  }

  let endAtDate = null;
  if (!record.endAt || typeof record.endAt !== 'string') {
    errors.push({ field: 'endAt', message: 'endAt is required and must be an ISO date string' });
  } else {
    endAtDate = new Date(record.endAt);
    if (isNaN(endAtDate.getTime())) {
      errors.push({ field: 'endAt', message: 'endAt is not a valid date string' });
    }
  }

  if (startAtDate && endAtDate && !isNaN(startAtDate.getTime()) && !isNaN(endAtDate.getTime())) {
    if (startAtDate.getTime() >= endAtDate.getTime()) {
      errors.push({ field: 'startAt', message: 'startAt must be earlier than endAt for a half-open interval' });
    }
  }

  if (record.excludeReservationId !== undefined) {
    if (typeof record.excludeReservationId !== 'string' || !MONGO_ID_REGEX.test(record.excludeReservationId)) {
      errors.push({ field: 'excludeReservationId', message: 'excludeReservationId must be a 24-character hex ObjectId' });
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      resourceId: record.resourceId,
      startAt: record.startAt,
      endAt: record.endAt,
      excludeReservationId: record.excludeReservationId,
    },
  };
}

export function validateCalculateSlotsQuery(data) {
  const record = (data || {});
  const errors = [];

  if (!record.resourceId || typeof record.resourceId !== 'string' || !MONGO_ID_REGEX.test(record.resourceId)) {
    errors.push({ field: 'resourceId', message: 'resourceId is required and must be a 24-character hex ObjectId' });
  }

  if (!record.date || typeof record.date !== 'string' || !isValidCalendarDate(record.date)) {
    errors.push({ field: 'date', message: 'date is required and must be in YYYY-MM-DD calendar format' });
  }

  let slotDuration;
  if (record.slotDurationMinutes !== undefined) {
    const parsed = Number(record.slotDurationMinutes);
    if (!Number.isInteger(parsed) || parsed < 5 || parsed > 1440) {
      errors.push({ field: 'slotDurationMinutes', message: 'slotDurationMinutes must be an integer between 5 and 1440' });
    } else {
      slotDuration = parsed;
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      resourceId: record.resourceId,
      date: record.date,
      slotDurationMinutes: slotDuration,
    },
  };
}

// ─── Phase 3.2 Approval Workflow Validators ─────────────────────────────────

export function validateApproveBookingBody(data) {
  const record = (data || {});
  const errors = [];

  let comment = undefined;
  if (record.comment !== undefined && record.comment !== null) {
    if (typeof record.comment !== 'string') {
      errors.push({ field: 'comment', message: 'comment must be a string' });
    } else {
      comment = record.comment.trim();
      if (comment.length > 500) {
        errors.push({ field: 'comment', message: 'comment cannot exceed 500 characters' });
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: { comment },
  };
}

export function validateRejectBookingBody(data) {
  const record = (data || {});
  const errors = [];

  if (!record.reason || typeof record.reason !== 'string') {
    errors.push({ field: 'reason', message: 'Rejection reason is required and must be a string' });
  } else {
    const trimmed = record.reason.trim();
    if (trimmed.length < 5 || trimmed.length > 500) {
      errors.push({ field: 'reason', message: 'Rejection reason must be between 5 and 500 characters' });
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: { reason: record.reason.trim() },
  };
}

export function validatePendingApprovalsQuery(data) {
  const record = (data || {});
  const errors = [];
  const result = {};

  if (record.page !== undefined) {
    const p = Number(record.page);
    if (!Number.isInteger(p) || p < 1) {
      errors.push({ field: 'page', message: 'page must be an integer >= 1' });
    } else {
      result.page = p;
    }
  }

  if (record.limit !== undefined) {
    const l = Number(record.limit);
    if (!Number.isInteger(l) || l < 1 || l > 100) {
      errors.push({ field: 'limit', message: 'limit must be an integer between 1 and 100' });
    } else {
      result.limit = l;
    }
  }

  if (record.sortBy !== undefined) {
    const allowed = ['deadline_asc', 'created_asc', 'created_desc'];
    if (!allowed.includes(record.sortBy)) {
      errors.push({ field: 'sortBy', message: `sortBy must be one of: ${allowed.join(', ')}` });
    } else {
      result.sortBy = record.sortBy;
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: result };
}

// ─── Phase 3.3 Check-In & Auto-Release Validators ───────────────────────────

export function validateCheckInBody(data) {
  const record = (data || {});
  const errors = [];

  if (!record.token || typeof record.token !== 'string') {
    errors.push({ field: 'token', message: 'token is required and must be a string' });
  } else if (record.token.trim().length < 32) {
    errors.push({ field: 'token', message: 'token must be at least 32 characters' });
  }

  if (!record.resourceId || typeof record.resourceId !== 'string' || !MONGO_ID_REGEX.test(record.resourceId)) {
    errors.push({ field: 'resourceId', message: 'resourceId is required and must be a valid 24-character hex ObjectId' });
  }

  if (record.method !== undefined && record.method !== 'QR_SCAN') {
    errors.push({ field: 'method', message: 'method must be QR_SCAN' });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      token: record.token.trim(),
      resourceId: record.resourceId,
      method: 'QR_SCAN',
    },
  };
}

export function validateManualCheckInBody(data) {
  const record = (data || {});
  const errors = [];

  if (!record.justification || typeof record.justification !== 'string') {
    errors.push({ field: 'justification', message: 'justification is required and must be a string' });
  } else {
    const trimmed = record.justification.trim();
    if (trimmed.length < 10 || trimmed.length > 500) {
      errors.push({ field: 'justification', message: 'justification must be between 10 and 500 characters' });
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: { justification: record.justification.trim() },
  };
}

export function validatePardonNoShowBody(data) {
  const record = (data || {});
  const errors = [];

  if (!record.reason || typeof record.reason !== 'string') {
    errors.push({ field: 'reason', message: 'reason is required and must be a string' });
  } else {
    const trimmed = record.reason.trim();
    if (trimmed.length < 10 || trimmed.length > 500) {
      errors.push({ field: 'reason', message: 'reason must be between 10 and 500 characters' });
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: { reason: record.reason.trim() },
  };
}
