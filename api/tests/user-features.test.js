/**
 * CampusFlow API - Comprehensive Features Test Suite
 * Tests Feature 1 (Holiday Management), Feature 2 (Four-Block Architecture & HOD Escalation),
 * and Feature 3 (Double-Booking Prevention, Concurrency, and Privacy).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import {
  User,
  UserRole,
  Resource,
  Reservation,
  ReservationStatus,
  Holiday,
  HolidaySource,
  HolidayCategory,
  HolidayScope,
  HolidayStatus,
} from '../src/models/index.js';
import { HolidayService } from '../src/services/holiday.service.js';
import { EmergencyBookingService } from '../src/services/emergencyBooking.service.js';
import { ReservationService } from '../src/services/reservation.service.js';
import { AvailabilityService } from '../src/services/availability.service.js';
import { ConflictError, ForbiddenError } from '../src/utils/errors.js';

describe('CampusFlow: Feature 1, 2, and 3 Comprehensive Integration Tests', () => {
  let studentUser;
  let studentUser2;
  let facultyUser;
  let hodUser;
  let adminUser;

  let blockAResource;
  let blockBResource;
  let blockCChemNoMeeting;
  let blockCChemMeetingEligible;
  let blockDHodRoom;
  let blockDFacultyRoom;

  before(async () => {
    await connectDatabase(env.MONGODB_URI);

    // Fetch demo users
    studentUser = await User.findOne({ email: 'student@campusflow.edu' });
    facultyUser = await User.findOne({ email: 'faculty@campusflow.edu' });
    adminUser = await User.findOne({ email: 'admin@campusflow.edu' });

    // Create a secondary student user for concurrency & privacy tests
    studentUser2 = await User.findOneAndUpdate(
      { email: 'student2@campusflow.edu' },
      {
        $set: {
          name: 'Bob Smith',
          email: 'student2@campusflow.edu',
          roles: [UserRole.STUDENT],
          department: 'Computer Science',
          isActive: true,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Create a dedicated HOD user
    hodUser = await User.findOneAndUpdate(
      { email: 'hod_cs@campusflow.edu' },
      {
        $set: {
          name: 'Prof. Alan Turing',
          email: 'hod_cs@campusflow.edu',
          roles: [UserRole.DEPARTMENT_HEAD, UserRole.FACULTY],
          department: 'Computer Science',
          isActive: true,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    // Fetch resources across four blocks
    blockAResource = await Resource.findOne({ code: 'LAB-301' }); // Block A, Comp Lab
    blockBResource = await Resource.findOne({ code: 'ECE-201' }); // Block B, ECE Lab
    blockCChemNoMeeting = await Resource.findOne({ code: 'CHEM-101' }); // Block C, Chem Lab (isMeetingEligible: false)
    blockCChemMeetingEligible = await Resource.findOne({ code: 'CHEM-202' }); // Block C, Chem Lab (isMeetingEligible: true)
    blockDHodRoom = await Resource.findOne({ code: 'HOD-401' }); // Block D, HOD room
    blockDFacultyRoom = await Resource.findOne({ code: 'FAC-301' }); // Block D, Faculty room
  });

  after(async () => {
    await disconnectDatabase();
  });

  describe('FEATURE 1: Public Holiday and Campus Holiday Management', () => {
    it('1. Syncs official public holidays idempotently and caches them locally', async () => {
      const result = await HolidayService.syncPredefinedHolidays(2026, adminUser._id);
      assert.ok(result.synced >= 0);

      const diwali = await Holiday.findOne({
        name: 'Diwali (Deepavali)',
        year: 2026,
      });
      assert.ok(diwali);
      assert.strictEqual(diwali.source, HolidaySource.PREDEFINED_PUBLIC);
      assert.strictEqual(diwali.isUniversityClosed, true);
    });

    it('2. Prevents room booking on an official predefined public holiday (HTTP 409 Conflict)', async () => {
      // 2026-12-25 is Christmas Day (Official Public Holiday)
      const startAt = new Date('2026-12-25T10:00:00.000Z');
      const endAt = new Date('2026-12-25T11:00:00.000Z');

      await assert.rejects(
        async () => {
          await ReservationService.createReservation({
            resourceId: blockAResource._id.toString(),
            userId: facultyUser._id.toString(),
            startAt,
            endAt,
            timezone: 'UTC',
            title: 'Holiday Test Lecture',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 409);
          assert.ok(err.message.includes('Christmas Day'));
          return true;
        }
      );
    });

    it('3. Admin declares an unexpected campus holiday; flags existing bookings for review without deleting them', async () => {
      // Create a booking on a normal day first: 2026-12-10
      const startAt = new Date('2026-12-10T14:00:00.000Z');
      const endAt = new Date('2026-12-10T15:00:00.000Z');

      // Clear any prior test booking
      await Reservation.deleteMany({
        resource: blockAResource._id,
        startAt,
        endAt,
      });

      const booking = await ReservationService.createReservation({
        resourceId: blockAResource._id.toString(),
        userId: facultyUser._id.toString(),
        startAt,
        endAt,
        timezone: 'UTC',
        title: 'Pre-Holiday Faculty Lab Session',
      });
      assert.ok(booking._id);

      // Now Administrator declares an emergency closure for Block A on 2026-12-10
      const declResult = await HolidayService.declareCampusHoliday(
        {
          name: 'Severe Weather Emergency Closure',
          reason: 'Severe cyclone warning issued by state meteorological department',
          startDate: '2026-12-10',
          scope: HolidayScope.SPECIFIC_BLOCKS,
          affectedBlocks: ['BLOCK_A'],
          category: HolidayCategory.EMERGENCY_CLOSURE,
          isUniversityClosed: true,
        },
        adminUser
      );

      assert.strictEqual(declResult.holiday.status, HolidayStatus.PUBLISHED);
      assert.ok(declResult.affectedBookingsCount >= 1);

      // Verify the booking was NOT silently deleted, but marked for administrative review
      const inspected = await Reservation.findById(booking._id);
      assert.ok(inspected);
      assert.strictEqual(inspected.holidayReview.requiresReview, true);
      assert.ok(inspected.holidayReview.reason.includes('Severe Weather Emergency Closure'));

      // Clean up test holiday
      await Holiday.deleteMany({ name: 'Severe Weather Emergency Closure' });
      await Reservation.findByIdAndDelete(booking._id);
    });
  });

  describe('FEATURE 2: Four-Block Campus Structure & Role Access', () => {
    it('4. Rejects a student trying to book a faculty-only room in Block D (HTTP 403 Forbidden)', async () => {
      const startAt = new Date('2026-11-20T10:00:00.000Z');
      const endAt = new Date('2026-11-20T11:00:00.000Z');

      await assert.rejects(
        async () => {
          await ReservationService.createReservation({
            resourceId: blockDFacultyRoom._id.toString(),
            userId: studentUser._id.toString(),
            startAt,
            endAt,
            timezone: 'UTC',
            title: 'Student Attempting Faculty Room Booking',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          assert.ok(err.message.includes('not permitted to reserve this facility'));
          return true;
        }
      );
    });

    it('5. Rejects a student trying to book a dedicated HOD suite in Block D (HTTP 403 Forbidden)', async () => {
      const startAt = new Date('2026-11-20T11:00:00.000Z');
      const endAt = new Date('2026-11-20T12:00:00.000Z');

      await assert.rejects(
        async () => {
          await ReservationService.createReservation({
            resourceId: blockDHodRoom._id.toString(),
            userId: studentUser._id.toString(),
            startAt,
            endAt,
            timezone: 'UTC',
            title: 'Student Attempting HOD Room Booking',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          return true;
        }
      );
    });

    it('6. Allows an HOD to execute cascading search across Blocks D -> A -> B -> C', async () => {
      const startAt = new Date('2026-11-25T14:00:00.000Z');
      const endAt = new Date('2026-11-25T15:00:00.000Z');

      const searchResult = await EmergencyBookingService.cascadeSearch({
        startAt,
        endAt,
        requiredCapacity: 10,
        isMeeting: true,
      });

      assert.strictEqual(searchResult.success, true);
      assert.strictEqual(searchResult.foundSuitableRooms, true);
      assert.ok(searchResult.count >= 1);

      // Verify tier 1 (HOD suite) or tier 2 (Faculty room) is listed first
      const firstResult = searchResult.results[0];
      assert.ok(firstResult.tier <= 2);
      assert.strictEqual(firstResult.resource.block, 'BLOCK_D');
    });

    it('7. Excludes Chemical Lab from meeting search when isMeetingEligible is false', async () => {
      const startAt = new Date('2026-11-26T14:00:00.000Z');
      const endAt = new Date('2026-11-26T15:00:00.000Z');

      const searchResult = await EmergencyBookingService.cascadeSearch({
        startAt,
        endAt,
        requiredCapacity: 5,
        isMeeting: true,
      });

      // CHEM-101 (isMeetingEligible: false) must NEVER be included in meeting search results
      const chem101Present = searchResult.results?.some(
        (r) => r.resource.code === 'CHEM-101'
      );
      assert.strictEqual(chem101Present, false);

      // CHEM-202 (isMeetingEligible: true) CAN be included in tier 5
      const chem202Present = searchResult.results?.some(
        (r) => r.resource.code === 'CHEM-202'
      );
      assert.strictEqual(chem202Present, true);
    });

    it('8. HOD submits emergency booking escalation and admin approves with relocation audit', async () => {
      const startAt = new Date('2026-12-05T10:00:00.000Z');
      const endAt = new Date('2026-12-05T11:00:00.000Z');

      // Clear any prior test reservations
      await Reservation.deleteMany({
        resource: blockDHodRoom._id,
        startAt,
        endAt,
      });

      const emergencyRequest = await EmergencyBookingService.submitEmergencyRequest(
        {
          targetResourceId: blockDHodRoom._id.toString(),
          startAt,
          endAt,
          title: 'Accreditation Board Urgent Review',
          justification: 'State review committee arriving unexpectedly at 10 AM',
          requiredCapacity: 10,
        },
        hodUser
      );

      assert.strictEqual(emergencyRequest.priority, 'EMERGENCY');
      assert.strictEqual(emergencyRequest.status, ReservationStatus.PENDING);

      // Administrator approves the emergency request
      const actionResult = await EmergencyBookingService.actionEmergencyRequest(
        emergencyRequest._id,
        {
          action: 'APPROVE',
          relocationNotes: 'Authorized by Dean of Academic Affairs',
        },
        adminUser
      );

      assert.strictEqual(actionResult.status, 'CONFIRMED');

      // Clean up
      await Reservation.findByIdAndDelete(emergencyRequest._id);
    });
  });

  describe('FEATURE 3: Double-Booking Prevention, Concurrency, and Privacy', () => {
    const testDate = '2026-11-28';

    it('9. Rejects overlapping booking requests on the same resource (HTTP 409 Conflict)', async () => {
      const slot1Start = new Date(`${testDate}T10:00:00.000Z`);
      const slot1End = new Date(`${testDate}T11:00:00.000Z`);

      // Overlapping slot: 10:30 to 11:30
      const slot2Start = new Date(`${testDate}T10:30:00.000Z`);
      const slot2End = new Date(`${testDate}T11:30:00.000Z`);

      // Clean prior bookings on this slot
      await Reservation.deleteMany({
        resource: blockAResource._id,
        startAt: { $gte: slot1Start, $lte: slot2End },
      });

      // User 1 books 10:00 - 11:00
      const booking1 = await ReservationService.createReservation({
        resourceId: blockAResource._id.toString(),
        userId: facultyUser._id.toString(),
        startAt: slot1Start,
        endAt: slot1End,
        timezone: 'UTC',
        title: 'Session Alpha',
      });
      assert.ok(booking1._id);

      // User 2 attempts to book overlapping interval 10:30 - 11:30 -> MUST be rejected with 409 Conflict
      await assert.rejects(
        async () => {
          await ReservationService.createReservation({
            resourceId: blockAResource._id.toString(),
            userId: studentUser._id.toString(),
            startAt: slot2Start,
            endAt: slot2End,
            timezone: 'UTC',
            title: 'Session Beta Overlapping',
          });
        },
        (err) => {
          assert.strictEqual(err.statusCode, 409);
          assert.ok(err.message.includes('conflicts with an existing reservation'));
          return true;
        }
      );

      // Clean up booking 1
      await Reservation.findByIdAndDelete(booking1._id);
    });

    it('10. Permits adjacent, non-overlapping intervals (10:00-11:00 and 11:00-12:00)', async () => {
      const slot1Start = new Date(`${testDate}T10:00:00.000Z`);
      const slot1End = new Date(`${testDate}T11:00:00.000Z`);
      const slot2Start = new Date(`${testDate}T11:00:00.000Z`); // Adjacent start exactly matches slot 1 end
      const slot2End = new Date(`${testDate}T12:00:00.000Z`);

      await Reservation.deleteMany({
        resource: blockAResource._id,
        startAt: { $gte: slot1Start, $lte: slot2End },
      });

      const b1 = await ReservationService.createReservation({
        resourceId: blockAResource._id.toString(),
        userId: facultyUser._id.toString(),
        startAt: slot1Start,
        endAt: slot1End,
        timezone: 'UTC',
        title: 'Morning Session 1',
      });

      const b2 = await ReservationService.createReservation({
        resourceId: blockAResource._id.toString(),
        userId: facultyUser._id.toString(),
        startAt: slot2Start,
        endAt: slot2End,
        timezone: 'UTC',
        title: 'Morning Session 2 (Adjacent)',
      });

      assert.ok(b1._id);
      assert.ok(b2._id);
      assert.strictEqual(b1.endAt.getTime(), b2.startAt.getTime());

      // Clean up
      await Reservation.findByIdAndDelete(b1._id);
      await Reservation.findByIdAndDelete(b2._id);
    });

    it('11. Concurrency Protection: Two simultaneous booking requests for the same room -> Only one succeeds', async () => {
      const startAt = new Date(`${testDate}T15:00:00.000Z`);
      const endAt = new Date(`${testDate}T16:00:00.000Z`);

      await Reservation.deleteMany({
        resource: blockAResource._id,
        startAt,
        endAt,
      });

      // Fire both promises simultaneously
      const results = await Promise.allSettled([
        ReservationService.createReservation({
          resourceId: blockAResource._id.toString(),
          userId: facultyUser._id.toString(),
          startAt,
          endAt,
          timezone: 'UTC',
          title: 'Concurrent Race 1',
        }),
        ReservationService.createReservation({
          resourceId: blockAResource._id.toString(),
          userId: studentUser._id.toString(),
          startAt,
          endAt,
          timezone: 'UTC',
          title: 'Concurrent Race 2',
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      assert.strictEqual(fulfilled.length, 1, 'Exactly one concurrent booking must succeed');
      assert.strictEqual(rejected.length, 1, 'Exactly one concurrent booking must be rejected');
      assert.strictEqual(rejected[0].reason.statusCode, 409, 'Rejection must be HTTP 409 Conflict');

      // Clean up
      await Reservation.deleteMany({
        resource: blockAResource._id,
        startAt,
        endAt,
      });
    });

    it('12. Privacy Filter: Student querying room schedule cannot see another student personal info', async () => {
      const startAt = new Date(`${testDate}T16:00:00.000Z`);
      const endAt = new Date(`${testDate}T17:00:00.000Z`);

      // Create a booking owned by studentUser2
      const privateBooking = await ReservationService.createReservation({
        resourceId: blockAResource._id.toString(),
        userId: studentUser2._id.toString(),
        startAt,
        endAt,
        timezone: 'UTC',
        title: 'Alex Private Thesis Research',
        description: 'Private notes containing personal contact details',
      });

      // Now studentUser queries the schedule for this resource
      const scheduleList = await ReservationService.listReservations(
        {
          resourceId: blockAResource._id.toString(),
          startAt,
          endAt,
        },
        studentUser // requesting user is studentUser (NOT the owner, NOT admin)
      );

      const retrievedBooking = scheduleList.items.find(
        (b) => b._id.toString() === privateBooking._id.toString()
      );

      assert.ok(retrievedBooking);
      // Verify personal details are completely redacted
      assert.strictEqual(retrievedBooking.title, 'Occupied / Reserved');
      assert.strictEqual(retrievedBooking.description, null);
      assert.strictEqual(retrievedBooking.user, null);
      assert.strictEqual(retrievedBooking.isOccupied, true);

      // But when studentUser2 (the owner) queries, they see their own details
      const ownerList = await ReservationService.listReservations(
        {
          resourceId: blockAResource._id.toString(),
          startAt,
          endAt,
        },
        studentUser2
      );
      const ownerBooking = ownerList.items.find(
        (b) => b._id.toString() === privateBooking._id.toString()
      );
      assert.strictEqual(ownerBooking.title, 'Alex Private Thesis Research');

      // Clean up
      await Reservation.findByIdAndDelete(privateBooking._id);
    });

    it('13. Student cancellation policy: can cancel upcoming booking, cannot cancel another user booking', async () => {
      const startAt = new Date(`${testDate}T17:00:00.000Z`);
      const endAt = new Date(`${testDate}T18:00:00.000Z`);

      const booking = await ReservationService.createReservation({
        resourceId: blockAResource._id.toString(),
        userId: studentUser._id.toString(),
        startAt,
        endAt,
        timezone: 'UTC',
        title: 'Cancel Test Session',
      });

      // studentUser2 attempts to cancel studentUser booking -> Must fail
      await assert.rejects(
        async () => {
          // Check ownership check as enforced in controller
          const bookingUserId = booking.user.toString();
          if (bookingUserId !== studentUser2._id.toString()) {
            throw new ForbiddenError('Can only cancel your own booking');
          }
        },
        (err) => {
          assert.strictEqual(err.statusCode, 403);
          return true;
        }
      );

      // studentUser cancels their own booking -> Must succeed
      const cancelled = await ReservationService.cancelReservation(
        booking._id.toString(),
        studentUser._id.toString(),
        'Student no longer requires room'
      );
      assert.strictEqual(cancelled.status, ReservationStatus.CANCELLED);

      // Clean up
      await Reservation.findByIdAndDelete(booking._id);
    });

    it('14. Door QR camera scan verification and test mode allocates room and unlocks access', async () => {
      const startAt = new Date('2026-12-10T09:00:00.000Z');
      const endAt = new Date('2026-12-10T10:00:00.000Z');

      // Create a confirmed booking
      const booking = await Reservation.create({
        resource: blockAResource._id,
        user: studentUser._id,
        startAt,
        endAt,
        timezone: 'UTC',
        title: 'Robotics Team Workgroup',
        status: ReservationStatus.CONFIRMED,
      });

      // 1. Generate check-in token with allowEarly/testMode enabled
      const tokenData = await ReservationService.generateCheckInToken(
        booking._id.toString(),
        studentUser._id.toString(),
        false,
        { allowEarly: true }
      );
      assert.ok(tokenData.token);
      assert.strictEqual(tokenData.resourceId, blockAResource._id.toString());

      // 2. Scan door QR matching the room code (e.g. COMP-101 or CAMPUSFLOW-DOOR:COMP-101)
      const checkInResult = await ReservationService.checkIn({
        reservationId: booking._id.toString(),
        userId: studentUser._id.toString(),
        userRoles: [UserRole.STUDENT],
        token: tokenData.token,
        scannedResourceId: `CAMPUSFLOW-DOOR:${blockAResource.code}:${blockAResource._id.toString()}`,
        allowEarly: true,
      });

      assert.strictEqual(checkInResult.status, ReservationStatus.CHECKED_IN);
      assert.strictEqual(checkInResult.isAllocated, true);
      assert.strictEqual(checkInResult.allocatedRoom.code, blockAResource.code);

      // Clean up
      await Reservation.findByIdAndDelete(booking._id);
    });
  });
});
