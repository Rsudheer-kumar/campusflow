/**
 * CampusFlow API - Emergency HOD Booking Service
 * Implements the hierarchical four-block room search cascade and administrative
 * emergency booking escalation workflow for Department Heads.
 */

import {
  Resource,
  Reservation,
  ReservationStatus,
  ACTIVE_RESERVATION_STATES,
  UserRole,
} from '../models/index.js';
import { AvailabilityService } from './availability.service.js';
import { ReservationService } from './reservation.service.js';
import { BadRequestError, NotFoundError, ForbiddenError, ConflictError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export class EmergencyBookingService {
  /**
   * Cascading search across the four campus blocks for an available room meeting
   * the HOD's criteria.
   *
   * Search Priority:
   * 1. Block D - Dedicated HOD rooms (HOD_ROOM)
   * 2. Block D - Faculty rooms (FACULTY_ROOM)
   * 3. Block A - Computer laboratories (COMPUTER_LAB)
   * 4. Block B - ECE & EE laboratories (ECE_EE_LAB)
   * 5. Block C - Chemical laboratories (CHEMICAL_LAB) - ONLY if isMeetingEligible === true
   */
  static async cascadeSearch(params) {
    const {
      startAt: rawStart,
      endAt: rawEnd,
      requiredCapacity = 1,
      requiredEquipment = [],
      isMeeting = true,
      timezone = 'UTC',
    } = params;

    const startAt = new Date(rawStart);
    const endAt = new Date(rawEnd);

    if (isNaN(startAt.getTime()) || isNaN(endAt.getTime()) || startAt >= endAt) {
      throw new BadRequestError('startAt and endAt must be valid timestamps with startAt < endAt');
    }

    // Define the tier priorities
    const searchTiers = [
      {
        tier: 1,
        tierName: 'Block D: Dedicated HOD Rooms',
        block: 'BLOCK_D',
        roomCategory: 'HOD_ROOM',
        requiresMeetingEligibility: false,
      },
      {
        tier: 2,
        tierName: 'Block D: Faculty Meeting Rooms',
        block: 'BLOCK_D',
        roomCategory: 'FACULTY_ROOM',
        requiresMeetingEligibility: false,
      },
      {
        tier: 3,
        tierName: 'Block A: Computer Laboratories',
        block: 'BLOCK_A',
        roomCategory: 'COMPUTER_LAB',
        requiresMeetingEligibility: false,
      },
      {
        tier: 4,
        tierName: 'Block B: ECE & EE Laboratories',
        block: 'BLOCK_B',
        roomCategory: 'ECE_EE_LAB',
        requiresMeetingEligibility: false,
      },
      {
        tier: 5,
        tierName: 'Block C: Chemical Laboratories (Meeting Eligible Only)',
        block: 'BLOCK_C',
        roomCategory: 'CHEMICAL_LAB',
        requiresMeetingEligibility: true, // Chemical labs must explicitly permit meetings
      },
    ];

    const availableResults = [];

    for (const tierDef of searchTiers) {
      // Find candidate resources matching block, category, capacity, and active status
      const candidateQuery = {
        isActive: true,
        $or: [
          { block: tierDef.block },
          { 'location.building': { $regex: tierDef.block.replace('_', ' '), $options: 'i' } },
        ],
        capacity: { $gte: Number(requiredCapacity) },
      };

      if (tierDef.roomCategory) {
        candidateQuery.roomCategory = tierDef.roomCategory;
      }

      if (isMeeting && tierDef.requiresMeetingEligibility) {
        candidateQuery.isMeetingEligible = true;
      }

      if (Array.isArray(requiredEquipment) && requiredEquipment.length > 0) {
        candidateQuery.equipment = { $all: requiredEquipment };
      }

      const candidates = await Resource.find(candidateQuery).lean();

      for (const res of candidates) {
        // Evaluate authoritative availability (checks holidays, blackouts, timetables, active bookings)
        const check = await AvailabilityService.checkAvailability({
          resourceId: res._id,
          startAt,
          endAt,
        });

        if (check.available) {
          availableResults.push({
            tier: tierDef.tier,
            tierName: tierDef.tierName,
            resource: {
              _id: res._id,
              name: res.name,
              code: res.code,
              block: res.block || tierDef.block,
              roomCategory: res.roomCategory,
              capacity: res.capacity,
              isMeetingEligible: res.isMeetingEligible,
              equipment: res.equipment,
              location: res.location,
            },
          });
        }
      }
    }

    if (availableResults.length > 0) {
      return {
        success: true,
        foundSuitableRooms: true,
        count: availableResults.length,
        results: availableResults,
      };
    }

    // No direct rooms available in the requested interval.
    // Calculate nearest alternative time slots (1 hour earlier and 1 hour later)
    const slotDurationMs = endAt.getTime() - startAt.getTime();
    const earlierStart = new Date(startAt.getTime() - 3600000);
    const earlierEnd = new Date(earlierStart.getTime() + slotDurationMs);
    const laterStart = new Date(startAt.getTime() + 3600000);
    const laterEnd = new Date(laterStart.getTime() + slotDurationMs);

    const alternativeSlots = [
      {
        slotLabel: '1 Hour Earlier',
        startAt: earlierStart.toISOString(),
        endAt: earlierEnd.toISOString(),
      },
      {
        slotLabel: '1 Hour Later',
        startAt: laterStart.toISOString(),
        endAt: laterEnd.toISOString(),
      },
    ];

    // Identify occupied lower-priority bookings that administrators could optionally relocate
    const occupiedInRequestedWindow = await Reservation.find({
      status: { $in: ACTIVE_RESERVATION_STATES },
      startAt: { $lt: endAt },
      endAt: { $gt: startAt },
      priority: { $ne: 'EMERGENCY' },
    })
      .populate('resource', 'name code block roomCategory capacity location')
      .populate('user', 'name roles department')
      .select('_id resource user startAt endAt title status priority')
      .lean();

    return {
      success: true,
      foundSuitableRooms: false,
      message: 'All dedicated and suitable alternative rooms across Blocks D, A, B, and C are currently occupied or closed.',
      alternativeSlots,
      canSubmitEmergencyEscalation: true,
      occupiedPotentialCandidates: occupiedInRequestedWindow.map((b) => ({
        reservationId: b._id,
        roomName: b.resource?.name,
        block: b.resource?.block,
        roomCategory: b.resource?.roomCategory,
        bookedByRole: b.user?.roles?.[0],
        timeWindow: `${new Date(b.startAt).toISOString()} - ${new Date(b.endAt).toISOString()}`,
      })),
    };
  }

  /**
   * Submit an Emergency Booking Request by a Department Head.
   * Escalates to the campus administrative approval queue.
   */
  static async submitEmergencyRequest(payload, hodUser) {
    const isHod =
      Array.isArray(hodUser?.roles) &&
      (hodUser.roles.includes(UserRole.DEPARTMENT_HEAD) || hodUser.roles.includes(UserRole.ADMIN));

    if (!isHod) {
      throw new ForbiddenError('Only Department Heads (HOD) or Administrators can initiate emergency room booking escalations.');
    }

    const {
      targetResourceId,
      startAt: rawStart,
      endAt: rawEnd,
      title,
      justification,
      requiredCapacity,
      timezone = 'UTC',
    } = payload;

    if (!targetResourceId) {
      throw new BadRequestError('targetResourceId is required');
    }

    if (!title || title.trim().length < 3) {
      throw new BadRequestError('A descriptive meeting title (at least 3 characters) is required');
    }

    if (!justification || justification.trim().length < 10) {
      throw new BadRequestError('Detailed emergency justification (at least 10 characters) is required for escalation');
    }

    const startAt = new Date(rawStart);
    const endAt = new Date(rawEnd);

    if (isNaN(startAt.getTime()) || isNaN(endAt.getTime()) || startAt >= endAt) {
      throw new BadRequestError('Valid startAt and endAt timestamps are required');
    }

    const resource = await Resource.findById(targetResourceId);
    if (!resource) {
      throw new NotFoundError('Target resource not found');
    }

    // Create an emergency reservation record in PENDING status tagged with EMERGENCY priority
    const emergencyReservation = new Reservation({
      resource: resource._id,
      user: hodUser._id,
      startAt,
      endAt,
      timezone,
      status: ReservationStatus.PENDING,
      priority: 'EMERGENCY',
      title: `[EMERGENCY HOD] ${title.trim()}`,
      description: `Emergency Faculty Meeting: ${justification.trim()}`,
      currentApproverRole: 'ADMIN',
      currentStepOrder: 1,
      approvalChain: [
        {
          stepOrder: 1,
          approverRole: 'ADMIN',
          timeoutHours: 24,
          status: 'PENDING',
          stepStartedAt: new Date(),
        },
      ],
      metadata: {
        isEmergency: true,
        hodDepartment: hodUser.department,
        requiredCapacity: Number(requiredCapacity) || resource.capacity,
        justification: justification.trim(),
      },
    });

    await emergencyReservation.save();

    logger.info(
      `[EmergencyBookingService] Created Emergency HOD Reservation ${emergencyReservation._id} for ${resource.name} (${startAt.toISOString()})`
    );

    return emergencyReservation;
  }

  /**
   * Administrator actions (Approve or Reject) an Emergency Booking Request.
   * If approving and relocation of an existing booking is authorized:
   * - Never silently cancels.
   * - Records relocation reason and audit entry.
   * - Keeps full history of displaced reservation.
   */
  static async actionEmergencyRequest(reservationId, payload, adminUser) {
    const { action, relocationNotes, alternativeRoomId } = payload; // action: 'APPROVE' | 'REJECT'

    const emergencyBooking = await Reservation.findById(reservationId).populate('resource');
    if (!emergencyBooking) {
      throw new NotFoundError('Emergency reservation request not found');
    }

    if (emergencyBooking.priority !== 'EMERGENCY' || emergencyBooking.status !== ReservationStatus.PENDING) {
      throw new BadRequestError('Reservation is not a pending emergency booking');
    }

    if (action === 'REJECT') {
      emergencyBooking.status = ReservationStatus.REJECTED;
      emergencyBooking.rejectedBy = adminUser._id;
      emergencyBooking.rejectedAt = new Date();
      emergencyBooking.rejectionReason = relocationNotes || 'Emergency booking escalation rejected by administration';
      await emergencyBooking.save();
      return { success: true, status: 'REJECTED', reservation: emergencyBooking };
    }

    if (action === 'APPROVE') {
      // Find conflicting active booking on this resource
      const conflictingBooking = await Reservation.findOne({
        resource: emergencyBooking.resource._id,
        _id: { $ne: emergencyBooking._id },
        status: { $in: ACTIVE_RESERVATION_STATES },
        startAt: { $lt: emergencyBooking.endAt },
        endAt: { $gt: emergencyBooking.startAt },
      });

      if (conflictingBooking) {
        // Relocate or notify the conflicting booking with explicit audit record
        conflictingBooking.relocationAudit = {
          displacedByReservationId: emergencyBooking._id,
          displacedAt: new Date(),
          reason: `Relocated for Authorized Emergency HOD Meeting: ${emergencyBooking.title}`,
          alternativeOffered: alternativeRoomId
            ? `Alternative Room ID: ${alternativeRoomId}`
            : 'Pending rescheduling coordination with administrative staff',
        };

        // Transition conflicting booking to PENDING for rescheduling review rather than silent cancellation
        conflictingBooking.status = ReservationStatus.PENDING;
        await conflictingBooking.save();

        logger.info(
          `[EmergencyBookingService] Flagged reservation ${conflictingBooking._id} for relocation due to emergency approval`
        );
      }

      emergencyBooking.status = ReservationStatus.CONFIRMED;
      emergencyBooking.approvedBy = adminUser._id;
      emergencyBooking.approvedAt = new Date();
      await emergencyBooking.save();

      return {
        success: true,
        status: 'CONFIRMED',
        reservation: emergencyBooking,
        displacedBooking: conflictingBooking
          ? {
              id: conflictingBooking._id,
              relocationAudit: conflictingBooking.relocationAudit,
            }
          : null,
      };
    }

    throw new BadRequestError('Invalid action. Must be APPROVE or REJECT.');
  }
}
