/**
 * CampusFlow API - Phase 2A Integration Test Suite
 * Mandatory Student Reservation Approval Workflow
 *
 * Verifies:
 * 1. Student creates reservation -> PENDING (never automatically approved)
 * 2. Response message: "Your reservation request has been submitted successfully and is awaiting faculty approval."
 * 3. Faculty notification created with all required fields (student name, email, resource, time, purpose)
 * 4. Faculty receives and can access pending requests in /api/approvals/pending
 * 5. Authorized faculty member approves -> CONFIRMED (APPROVED)
 * 6. Authorized faculty member rejects with reason -> REJECTED, rejection reason & approver recorded
 * 7. Student cannot approve their own reservation (Four-Eyes / permission check)
 * 8. Unauthorized faculty outside department cannot approve request (403)
 * 9. Admin universal override follows existing permissions (valid with comment >= 5 chars)
 * 10. Concurrency race protection on approval / rejection
 * 11. Final approval rechecks resource availability and timetable conflicts
 * 12. Existing faculty / admin booking workflows remain functional (auto-confirmed)
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose, { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase, isDatabaseConnected } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { app } from '../src/app.js';
import {
  User,
  UserRole,
  ResourceType,
  ResourceCategory,
  Resource,
  ResourceStatus,
  AvailabilityRule,
  DayOfWeek,
  Reservation,
  ReservationStatus,
  ApproverRole,
  Notification,
  NotificationType,
  TimetableEntry,
} from '../src/models/index.js';
import { signAccessToken } from '../src/utils/jwt.js';

describe('Phase 2A — Mandatory Student Reservation Approval Workflow', () => {
  let server;
  let baseUrl;
  const TEST_PREFIX = 'TEST_P2A_';

  let testResourceType;
  let testResourceCS;
  let testResourceEE;

  let studentCS;
  let studentCSToken;
  let facultyCS;
  let facultyCSToken;
  let facultyEE;
  let facultyEEToken;
  let adminUser;
  let adminToken;

  const defaultTz = 'UTC';

  // Helper to generate dynamic future dates in UTC
  function makeFutureSlot(daysAhead = 2, startHour = 10, durationHours = 2) {
    const base = new Date();
    base.setUTCDate(base.getUTCDate() + daysAhead);
    base.setUTCHours(startHour, 0, 0, 0);
    const startAt = new Date(base);
    const endAt = new Date(base.getTime() + durationHours * 3600000);
    return {
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    };
  }

  before(async () => {
    await connectDatabase(env.MONGODB_TEST_URI);
    assert.strictEqual(isDatabaseConnected(), true);

    await Promise.all([
      Reservation.syncIndexes(),
      Resource.syncIndexes(),
      Notification.syncIndexes(),
    ]);

    // Clean up any existing test fixtures
    await Promise.all([
      User.deleteMany({ email: new RegExp(`^${TEST_PREFIX}`, 'i') }),
      Resource.deleteMany({ code: new RegExp(`^${TEST_PREFIX}`, 'i') }),
      ResourceType.deleteMany({ code: new RegExp(`^${TEST_PREFIX}`, 'i') }),
      AvailabilityRule.deleteMany({ name: new RegExp(`^${TEST_PREFIX}`, 'i') }),
      Reservation.deleteMany({ title: new RegExp(`^${TEST_PREFIX}`, 'i') }),
      Notification.deleteMany({ title: new RegExp(`^Pending Student Reservation`, 'i') }),
    ]);

    // Create shared resource type
    testResourceType = await ResourceType.create({
      name: `${TEST_PREFIX}Hall Type`,
      code: `${TEST_PREFIX}HALL_TYPE`,
      category: ResourceCategory.CLASSROOM,
      isActive: true,
    });

    // Create CS Department resource
    testResourceCS = await Resource.create({
      name: `${TEST_PREFIX}Turing Lecture Hall CS`,
      code: `${TEST_PREFIX}LH_CS`,
      resourceType: testResourceType._id,
      capacity: 50,
      status: ResourceStatus.ACTIVE,
      isActive: true,
      location: { building: 'Turing Hall', roomNumber: '101', campus: 'Central' },
    });

    // Create EE Department resource
    testResourceEE = await Resource.create({
      name: `${TEST_PREFIX}Maxwell Lab EE`,
      code: `${TEST_PREFIX}LAB_EE`,
      resourceType: testResourceType._id,
      capacity: 30,
      status: ResourceStatus.ACTIVE,
      isActive: true,
      location: { building: 'Maxwell Building', roomNumber: '202', campus: 'North' },
    });

    // 24/7 Availability Rule for both resources
    for (const res of [testResourceCS, testResourceEE]) {
      await AvailabilityRule.create({
        resource: res._id,
        timezone: defaultTz,
        name: `${TEST_PREFIX}Standard Operating Rule`,
        windows: [
          DayOfWeek.MONDAY,
          DayOfWeek.TUESDAY,
          DayOfWeek.WEDNESDAY,
          DayOfWeek.THURSDAY,
          DayOfWeek.FRIDAY,
          DayOfWeek.SATURDAY,
          DayOfWeek.SUNDAY,
        ].map((d) => ({ dayOfWeek: d, startTime: '00:00', endTime: '24:00' })),
        bookingPolicy: {
          minDurationMinutes: 15,
          maxDurationMinutes: 720,
          minLeadTimeMinutes: 0,
          maxAdvanceBookingDays: 60,
        },
        isActive: true,
      });
    }

    function makeToken(u) {
      return signAccessToken({
        sub: u._id.toString(),
        email: u.email,
        roles: u.roles,
        department: u.department,
        isActive: u.isActive ?? true,
        tokenVersion: u.tokenVersion ?? 0,
      });
    }

    // Create Test Users
    studentCS = await User.create({
      name: `${TEST_PREFIX}Student Alex`,
      email: `${TEST_PREFIX.toLowerCase()}student.cs@campusflow.edu`,
      roles: [UserRole.STUDENT],
      department: 'Computer Science',
      isActive: true,
      identifier: `${TEST_PREFIX}STU_001`,
    });
    studentCSToken = makeToken(studentCS);

    facultyCS = await User.create({
      name: `${TEST_PREFIX}Prof Alan Turing`,
      email: `${TEST_PREFIX.toLowerCase()}faculty.cs@campusflow.edu`,
      roles: [UserRole.FACULTY],
      department: 'Computer Science',
      isActive: true,
      identifier: `${TEST_PREFIX}FAC_001`,
    });
    facultyCSToken = makeToken(facultyCS);

    facultyEE = await User.create({
      name: `${TEST_PREFIX}Prof James Maxwell`,
      email: `${TEST_PREFIX.toLowerCase()}faculty.ee@campusflow.edu`,
      roles: [UserRole.FACULTY],
      department: 'Electrical Engineering',
      isActive: true,
      identifier: `${TEST_PREFIX}FAC_002`,
    });
    facultyEEToken = makeToken(facultyEE);

    adminUser = await User.create({
      name: `${TEST_PREFIX}Admin User`,
      email: `${TEST_PREFIX.toLowerCase()}admin@campusflow.edu`,
      roles: [UserRole.ADMIN],
      department: 'Administration',
      isActive: true,
      identifier: `${TEST_PREFIX}ADM_001`,
    });
    adminToken = makeToken(adminUser);

    // Bind server on random free port
    server = app.listen(0);
    const addr = server.address();
    const port = typeof addr === 'object' && addr !== null ? addr.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await Promise.all([
      User.deleteMany({ email: new RegExp(`^${TEST_PREFIX}`, 'i') }),
      Resource.deleteMany({ code: new RegExp(`^${TEST_PREFIX}`, 'i') }),
      ResourceType.deleteMany({ code: new RegExp(`^${TEST_PREFIX}`, 'i') }),
      AvailabilityRule.deleteMany({ name: new RegExp(`^${TEST_PREFIX}`, 'i') }),
      Reservation.deleteMany({ title: new RegExp(`^${TEST_PREFIX}`, 'i') }),
      Notification.deleteMany({ title: new RegExp(`^Pending Student Reservation`, 'i') }),
    ]);
    await disconnectDatabase();
  });

  it('1. Student creates reservation -> Status is PENDING and never automatically approved', async () => {
    const slot = makeFutureSlot(3, 10, 2);
    const res = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentCSToken}`,
      },
      body: JSON.stringify({
        resourceId: testResourceCS._id.toString(),
        title: `${TEST_PREFIX}Student Algorithm Study`,
        description: 'Exam preparation group',
        startAt: slot.startAt,
        endAt: slot.endAt,
        timezone: defaultTz,
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.status, ReservationStatus.PENDING);
    assert.strictEqual(body.data.currentStepOrder, 1);
    assert.strictEqual(body.data.currentApproverRole, ApproverRole.FACULTY);
    assert.strictEqual(body.data.approvalChain.length, 1);
    assert.strictEqual(body.data.approvalChain[0].approverRole, ApproverRole.FACULTY);
  });

  it('2. Clear message indicates request is submitted and awaiting faculty approval', async () => {
    const slot = makeFutureSlot(4, 14, 2);
    const res = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentCSToken}`,
      },
      body: JSON.stringify({
        resourceId: testResourceCS._id.toString(),
        title: `${TEST_PREFIX}Robotics Club Workshop`,
        startAt: slot.startAt,
        endAt: slot.endAt,
        timezone: defaultTz,
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(
      body.data.message,
      'Your reservation request has been submitted successfully and is awaiting faculty approval.'
    );
  });

  it('3. Faculty notification is recorded with student details and booking purpose', async () => {
    const slot = makeFutureSlot(5, 9, 3);
    const bookRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentCSToken}`,
      },
      body: JSON.stringify({
        resourceId: testResourceCS._id.toString(),
        title: `${TEST_PREFIX}AI Paper Discussion`,
        startAt: slot.startAt,
        endAt: slot.endAt,
        timezone: defaultTz,
      }),
    });

    assert.strictEqual(bookRes.status, 201);
    const bookBody = await bookRes.json();
    const reservationId = bookBody.data._id;

    // Check Notification document (with brief wait for asynchronous delivery)
    let notification = null;
    for (let i = 0; i < 20; i += 1) {
      notification = await Notification.findOne({
        reservation: new Types.ObjectId(reservationId),
        recipient: facultyCS._id,
      }).lean();
      if (notification) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    assert.ok(notification, 'Notification should be created for Faculty CS');
    assert.strictEqual(notification.type, NotificationType.PENDING_RESERVATION_APPROVAL);
    assert.strictEqual(notification.payload.studentName, studentCS.name);
    assert.strictEqual(notification.payload.studentEmail, studentCS.email);
    assert.strictEqual(notification.payload.resourceName, testResourceCS.name);
    assert.strictEqual(notification.payload.purpose, `${TEST_PREFIX}AI Paper Discussion`);
    assert.strictEqual(notification.payload.durationMinutes, 180);
    assert.strictEqual(notification.payload.reviewUrl, '/dashboard/approvals');
  });

  it('4. Faculty member can view pending student request in /api/approvals/pending queue', async () => {
    const queueRes = await fetch(`${baseUrl}/api/approvals/pending`, {
      headers: {
        Authorization: `Bearer ${facultyCSToken}`,
      },
    });

    assert.strictEqual(queueRes.status, 200);
    const queueBody = await queueRes.json();
    assert.strictEqual(queueBody.success, true);
    assert.ok(queueBody.data.items.length > 0, 'Faculty CS should see pending approvals in queue');

    const item = queueBody.data.items.find(
      (it) => it.requester?.email === studentCS.email
    );
    assert.ok(item, 'Queue should include student reservation');
    assert.strictEqual(item.currentApproverRole, ApproverRole.FACULTY);
  });

  it('5. Authorized faculty member approves -> reservation status transitions to CONFIRMED', async () => {
    const slot = makeFutureSlot(6, 11, 2);
    const bookRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentCSToken}`,
      },
      body: JSON.stringify({
        resourceId: testResourceCS._id.toString(),
        title: `${TEST_PREFIX}To Be Approved by Faculty`,
        startAt: slot.startAt,
        endAt: slot.endAt,
        timezone: defaultTz,
      }),
    });
    const { data: booking } = await bookRes.json();

    const approveRes = await fetch(`${baseUrl}/api/bookings/${booking._id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facultyCSToken}`,
      },
      body: JSON.stringify({
        comment: 'Approved for senior project research',
      }),
    });

    assert.strictEqual(approveRes.status, 200);
    const approveBody = await approveRes.json();
    assert.strictEqual(approveBody.success, true);
    assert.strictEqual(approveBody.data.status, ReservationStatus.CONFIRMED);
    assert.strictEqual(approveBody.data.approvalChain[0].status, 'APPROVED');
    assert.strictEqual(
      approveBody.data.approvalChain[0].actionedBy.toString(),
      facultyCS._id.toString()
    );
  });

  it('6. Authorized faculty member rejects with reason -> reservation transitions to REJECTED', async () => {
    const slot = makeFutureSlot(7, 10, 2);
    const bookRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentCSToken}`,
      },
      body: JSON.stringify({
        resourceId: testResourceCS._id.toString(),
        title: `${TEST_PREFIX}To Be Rejected by Faculty`,
        startAt: slot.startAt,
        endAt: slot.endAt,
        timezone: defaultTz,
      }),
    });
    const { data: booking } = await bookRes.json();

    const rejectRes = await fetch(`${baseUrl}/api/bookings/${booking._id}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facultyCSToken}`,
      },
      body: JSON.stringify({
        reason: 'Room required for faculty curriculum review',
      }),
    });

    assert.strictEqual(rejectRes.status, 200);
    const rejectBody = await rejectRes.json();
    assert.strictEqual(rejectBody.success, true);
    assert.strictEqual(rejectBody.data.status, ReservationStatus.REJECTED);
    assert.strictEqual(
      rejectBody.data.rejectionReason,
      'Room required for faculty curriculum review'
    );
    assert.strictEqual(
      rejectBody.data.rejectedBy.toString(),
      facultyCS._id.toString()
    );
  });

  it('7. Student CANNOT approve their own request (Separation of duties / 403 Forbidden)', async () => {
    const slot = makeFutureSlot(8, 13, 2);
    const bookRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentCSToken}`,
      },
      body: JSON.stringify({
        resourceId: testResourceCS._id.toString(),
        title: `${TEST_PREFIX}Student Self Approval Attempt`,
        startAt: slot.startAt,
        endAt: slot.endAt,
        timezone: defaultTz,
      }),
    });
    const { data: booking } = await bookRes.json();

    const selfApproveRes = await fetch(`${baseUrl}/api/bookings/${booking._id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentCSToken}`,
      },
      body: JSON.stringify({ comment: 'Approving my own request' }),
    });

    assert.strictEqual(selfApproveRes.status, 403);
  });

  it('8. Unauthorized faculty outside department cannot approve request outside permission (403)', async () => {
    const slot = makeFutureSlot(9, 15, 2);
    // Student in CS department makes a booking
    const bookRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentCSToken}`,
      },
      body: JSON.stringify({
        resourceId: testResourceCS._id.toString(),
        title: `${TEST_PREFIX}CS Student Booking Cross Dept Test`,
        startAt: slot.startAt,
        endAt: slot.endAt,
        timezone: defaultTz,
      }),
    });
    const { data: booking } = await bookRes.json();

    // Faculty in EE department tries to approve it
    const crossApproveRes = await fetch(`${baseUrl}/api/bookings/${booking._id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facultyEEToken}`,
      },
      body: JSON.stringify({ comment: 'EE Faculty trying to approve CS booking' }),
    });

    assert.strictEqual(crossApproveRes.status, 403);
    const errBody = await crossApproveRes.json();
    assert.strictEqual(errBody.success, false);
  });

  it('9. Admin universal override works when justification comment is >= 5 characters', async () => {
    const slot = makeFutureSlot(10, 10, 2);
    const bookRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentCSToken}`,
      },
      body: JSON.stringify({
        resourceId: testResourceCS._id.toString(),
        title: `${TEST_PREFIX}Admin Override Test`,
        startAt: slot.startAt,
        endAt: slot.endAt,
        timezone: defaultTz,
      }),
    });
    const { data: booking } = await bookRes.json();

    const overrideRes = await fetch(`${baseUrl}/api/bookings/${booking._id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ comment: 'Administrative expedited approval granted' }),
    });

    assert.strictEqual(overrideRes.status, 200);
    const body = await overrideRes.json();
    assert.strictEqual(body.data.status, ReservationStatus.CONFIRMED);
    assert.strictEqual(body.data.approvalChain[0].isOverride, true);
  });

  it('10. Concurrent approvals race condition: exactly one succeeds', async () => {
    const slot = makeFutureSlot(11, 10, 2);
    const bookRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentCSToken}`,
      },
      body: JSON.stringify({
        resourceId: testResourceCS._id.toString(),
        title: `${TEST_PREFIX}Race Condition Test`,
        startAt: slot.startAt,
        endAt: slot.endAt,
        timezone: defaultTz,
      }),
    });
    const { data: booking } = await bookRes.json();

    const [res1, res2] = await Promise.all([
      fetch(`${baseUrl}/api/bookings/${booking._id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${facultyCSToken}`,
        },
        body: JSON.stringify({ comment: 'Concurrent approval attempt 1' }),
      }),
      fetch(`${baseUrl}/api/bookings/${booking._id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${facultyCSToken}`,
        },
        body: JSON.stringify({ comment: 'Concurrent approval attempt 2' }),
      }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    assert.deepStrictEqual(
      statuses,
      [200, 409],
      'Exactly one approval should succeed with 200, and the other must fail with 409 Conflict'
    );
  });

  it('11. Approval rechecks availability: if slot becomes unavailable, approval fails with 409', async () => {
    const slot = makeFutureSlot(12, 14, 2);
    const bookRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentCSToken}`,
      },
      body: JSON.stringify({
        resourceId: testResourceCS._id.toString(),
        title: `${TEST_PREFIX}Availability Recheck Test`,
        startAt: slot.startAt,
        endAt: slot.endAt,
        timezone: defaultTz,
      }),
    });
    const { data: booking } = await bookRes.json();

    // Now, simulate an authoritative institutional timetable entry published on that slot
    const timetable = await TimetableEntry.create({
      resource: testResourceCS._id,
      academicTerm: 'FALL 2026',
      courseCode: `${TEST_PREFIX}CS999`,
      courseTitle: 'Authoritative Curriculum Session',
      instructorName: 'Senior Faculty',
      startAt: new Date(slot.startAt),
      endAt: new Date(slot.endAt),
      timezone: defaultTz,
      isPublished: true,
      version: 1,
      publicationBatchId: new Types.ObjectId().toString(),
    });

    try {
      const approveRes = await fetch(`${baseUrl}/api/bookings/${booking._id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${facultyCSToken}`,
        },
        body: JSON.stringify({ comment: 'Attempting approval on contested timetable slot' }),
      });

      assert.strictEqual(
        approveRes.status,
        409,
        'Approval must be rejected with 409 Conflict because slot was taken by academic timetable'
      );
    } finally {
      await TimetableEntry.deleteOne({ _id: timetable._id });
    }
  });

  it('12. Existing faculty booking workflow remains functional (Auto-confirmed)', async () => {
    const slot = makeFutureSlot(13, 9, 2);
    const bookRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${facultyCSToken}`,
      },
      body: JSON.stringify({
        resourceId: testResourceCS._id.toString(),
        title: `${TEST_PREFIX}Faculty Research Seminar`,
        startAt: slot.startAt,
        endAt: slot.endAt,
        timezone: defaultTz,
      }),
    });

    assert.strictEqual(bookRes.status, 201);
    const body = await bookRes.json();
    assert.strictEqual(
      body.data.status,
      ReservationStatus.CONFIRMED,
      'Faculty booking should auto-confirm as before'
    );
  });
});
