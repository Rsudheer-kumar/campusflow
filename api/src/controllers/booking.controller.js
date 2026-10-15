/**
 * CampusFlow API - Booking & Reservation Controller
 * Handles HTTP transport, input mapping, error propagation, and response serialization
 * for all booking engine capabilities.
 *
 * PHASE 2.6D: Integrated with authentication and authorization enforcement.
 * - Uses req.user for authenticated identity (never trusts request body for identity)
 * - Enforces ownership checks for GET/cancel operations
 * - Handles DEPARTMENT_HEAD on-behalf booking with same-department verification
 * - Restricts list access based on role
 */

import { ReservationService } from '../services/reservation.service.js';
import { AvailabilityService } from '../services/availability.service.js';
import { sendSuccess } from '../utils/response.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';
import { User, UserRole } from '../models/index.js';
import { Types } from 'mongoose';

/**
 * Safely extracts the user ID as a string regardless of whether the user
 * field is an ObjectId, a populated document, or a plain object.
 */
function extractUserId(user) {
  if (!user) return '';
  if (user instanceof Types.ObjectId) {
    return user.toString();
  }
  if (typeof user === 'object' && user !== null) {
    if ('_id' in user && user._id) {
      return user._id.toString();
    }
    if ('id' in user && user.id) {
      return String(user.id);
    }
  }
  return String(user);
}

export async function createBooking(req, res, next) {
  try {
    // PHASE 2.6D: req.user is guaranteed to be set by authenticate middleware
    if (!req.user) {
      return next(new ForbiddenError('Unauthorized'));
    }

    // Determine the booking user (self-booking or on-behalf)
    let bookingUserId = req.user.id;

    // If body contains userId, validate DEPARTMENT_HEAD on-behalf booking
    if (req.body.userId && req.body.userId !== req.user.id) {
      // Only DEPARTMENT_HEAD can book on behalf of another user
      if (!req.user.roles.includes(UserRole.DEPARTMENT_HEAD)) {
        return next(new ForbiddenError('Only DEPARTMENT_HEAD can book on behalf of another user'));
      }

      // DEPARTMENT_HEAD can only target users in the same department
      const targetUser = await User.findById(req.body.userId).select('department _id').lean();
      if (!targetUser) {
        return next(new NotFoundError('Target user not found'));
      }

      // Verify same-department restriction (never trust client-supplied department)
      if (targetUser.department !== req.user.department) {
        return next(
          new ForbiddenError(
            'DEPARTMENT_HEAD can only book on behalf of users in the same department'
          )
        );
      }

      bookingUserId = req.body.userId;
    }

    const reservation = await ReservationService.createReservation({
      resourceId: req.body.resourceId,
      userId: bookingUserId,
      startAt: req.body.startAt,
      endAt: req.body.endAt,
      timezone: req.body.timezone,
      title: req.body.title,
      description: req.body.description,
      metadata: req.body.metadata,
    });

    sendSuccess(res, reservation, 201);
  } catch (error) {
    next(error);
  }
}

export async function getBookingById(req, res, next) {
  try {
    if (!req.user) {
      return next(new ForbiddenError('Unauthorized'));
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const reservation = await ReservationService.getReservationById(id);

    // PHASE 2.6D: Ownership check for non-privileged users
    const isPrivileged =
      req.user.roles.includes(UserRole.ADMIN) ||
      req.user.roles.includes(UserRole.FACILITY_MANAGER);

    if (!isPrivileged) {
      // Normal user can only view their own bookings
      const bookingUserId = extractUserId(reservation.user);

      if (bookingUserId !== req.user.id) {
        return next(new ForbiddenError('Cannot access another user\'s booking'));
      }
    }

    sendSuccess(res, reservation, 200);
  } catch (error) {
    next(error);
  }
}

export async function listBookings(req, res, next) {
  try {
    if (!req.user) {
      return next(new ForbiddenError('Unauthorized'));
    }

    const { resourceId, userId, status, startAt, endAt, page, limit } = req.query;

    // PHASE 2.6D: Authorization-aware filtering
    // Determine which userId to filter on based on role and request
    let filterUserId;

    const isPrivileged =
      req.user.roles.includes(UserRole.ADMIN) ||
      req.user.roles.includes(UserRole.FACILITY_MANAGER);

    if (isPrivileged) {
      // Privileged users can list any userId (or all if not specified)
      filterUserId = userId;
    } else {
      // Normal users can only list their own bookings, ignore query.userId
      filterUserId = req.user.id;
    }

    const result = await ReservationService.listReservations({
      resourceId: resourceId,
      userId: filterUserId,
      status: status,
      startAt: startAt,
      endAt: endAt,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
}

export async function cancelBooking(req, res, next) {
  try {
    if (!req.user) {
      return next(new ForbiddenError('Unauthorized'));
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const reservation = await ReservationService.getReservationById(id);

    // PHASE 2.6D: Ownership & role authorization check
    const isPrivileged =
      req.user.roles.includes(UserRole.ADMIN) ||
      req.user.roles.includes(UserRole.FACILITY_MANAGER) ||
      req.user.roles.includes(UserRole.CUSTODIAN);

    if (!isPrivileged) {
      // Normal users can only cancel their own bookings
      const bookingUserId = extractUserId(reservation.user);

      if (bookingUserId !== req.user.id) {
        return next(new ForbiddenError('Can only cancel your own booking'));
      }
    }

    // Use req.user.id as the cancellation actor (never trust body.userId for identity)
    const updated = await ReservationService.cancelReservation(
      id,
      req.user.id,
      req.body.reason
    );

    sendSuccess(res, updated, 200);
  } catch (error) {
    next(error);
  }
}

export async function transitionBookingStatus(req, res, next) {
  try {
    if (!req.user) {
      return next(new ForbiddenError('Unauthorized'));
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    // PHASE 2.6D: Role-based authorization for specific transitions
    // The route already requires FACILITY_MANAGER/CUSTODIAN/ADMIN via requireRoles middleware
    // Use req.user.id as the actor (never trust body.userId for identity)
    const reservation = await ReservationService.transitionStatus({
      reservationId: id,
      targetStatus: req.body.status,
      actorId: req.user.id,
      reason: req.body.reason,
    });

    sendSuccess(res, reservation, 200);
  } catch (error) {
    next(error);
  }
}

export async function checkAvailability(req, res, next) {
  try {
    const { resourceId, startAt, endAt, excludeReservationId } = req.query;
    const result = await AvailabilityService.checkAvailability({
      resourceId: resourceId,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      excludeReservationId: excludeReservationId,
    });
    sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
}

export async function calculateSlots(req, res, next) {
  try {
    const { resourceId, date, slotDurationMinutes } = req.query;
    const slots = await AvailabilityService.calculateSlots({
      resourceId: resourceId,
      date: date,
      slotDurationMinutes: slotDurationMinutes ? Number(slotDurationMinutes) : undefined,
    });
    sendSuccess(res, { slots }, 200);
  } catch (error) {
    next(error);
  }
}

export async function approveBooking(req, res, next) {
  try {
    if (!req.user) {
      return next(new ForbiddenError('Unauthorized'));
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { comment } = req.body;

    const result = await ReservationService.approveReservationStep({
      reservationId: id,
      user: {
        id: req.user.id,
        roles: req.user.roles,
        department: req.user.department,
      },
      comment,
    });

    sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
}

export async function rejectBooking(req, res, next) {
  try {
    if (!req.user) {
      return next(new ForbiddenError('Unauthorized'));
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { reason } = req.body;

    const result = await ReservationService.rejectReservationStep({
      reservationId: id,
      user: {
        id: req.user.id,
        roles: req.user.roles,
        department: req.user.department,
      },
      reason,
    });

    sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
}

export async function generateCheckInToken(req, res, next) {
  try {
    if (!req.user) {
      return next(new ForbiddenError('Unauthorized'));
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const isAdmin = req.user.roles.includes(UserRole.ADMIN);

    const tokenData = await ReservationService.generateCheckInToken(
      id,
      req.user.id,
      isAdmin
    );

    sendSuccess(res, tokenData, 200);
  } catch (error) {
    next(error);
  }
}

export async function checkInBooking(req, res, next) {
  try {
    if (!req.user) {
      return next(new ForbiddenError('Unauthorized'));
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { token, resourceId } = req.body;

    const result = await ReservationService.checkIn({
      reservationId: id,
      userId: req.user.id,
      userRoles: req.user.roles,
      token,
      scannedResourceId: resourceId,
    });

    sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
}

export async function manualCheckInBooking(req, res, next) {
  try {
    if (!req.user) {
      return next(new ForbiddenError('Unauthorized'));
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { justification } = req.body;

    const result = await ReservationService.manualCheckIn({
      reservationId: id,
      adminUserId: req.user.id,
      justification,
    });

    sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
}

export async function checkoutBooking(req, res, next) {
  try {
    if (!req.user) {
      return next(new ForbiddenError('Unauthorized'));
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const result = await ReservationService.checkout({
      reservationId: id,
      userId: req.user.id,
      userRoles: req.user.roles,
    });

    sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
}

export async function pardonNoShowBooking(req, res, next) {
  try {
    if (!req.user) {
      return next(new ForbiddenError('Unauthorized'));
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { reason } = req.body;

    const result = await ReservationService.pardonNoShow({
      reservationId: id,
      adminUserId: req.user.id,
      reason,
    });

    sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
}
