/**
 * CampusFlow API - High-Concurrency & Double-Booking Prevention Tests (Phase 2.5)
 * Verifies that concurrent simultaneous booking requests for identical or overlapping
 * half-open intervals are serialized safely via MongoDB multi-document transactions
 * and partial unique indexes, guaranteeing zero double-bookings under race conditions.
 *
 * TEST ISOLATION:
 * Operates strictly on the dedicated, isolated test database (`campusflow_test`).
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase, isDatabaseConnected } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { app } from '../src/app.js';
import { User, UserRole, ResourceType, ResourceCategory, Resource, ResourceStatus, AvailabilityRule, DayOfWeek, Reservation, ACTIVE_RESERVATION_STATES, } from '../src/models/index.js';
import { zonedTimeToUtc } from '../src/utils/timezone.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { ReservationService } from '../src/services/reservation.service.js';
describe('CampusFlow Concurrency & Double-Booking Prevention Tests', () => {
    let server;
    let baseUrl;
    const TEST_PREFIX = 'TEST_CONC_';
    let sharedResourceType;
    let sharedResource;
    const users = [];
    const tokens = [];
    const defaultTz = 'America/New_York';
    before(async () => {
        await connectDatabase(env.MONGODB_TEST_URI);
        assert.strictEqual(isDatabaseConnected(), true);
        assert.strictEqual(mongoose.connection.db?.databaseName, 'campusflow_test');
        await Reservation.syncIndexes();
        await Promise.all([
            Reservation.deleteMany({ title: new RegExp(`^${TEST_PREFIX}`, 'i') }),
            AvailabilityRule.deleteMany({ name: new RegExp(`^${TEST_PREFIX}`, 'i') }),
            Resource.deleteMany({ code: new RegExp(`^${TEST_PREFIX}`, 'i') }),
            ResourceType.deleteMany({ code: new RegExp(`^${TEST_PREFIX}`, 'i') }),
            User.deleteMany({ email: new RegExp(`^${TEST_PREFIX}`, 'i') }),
        ]);
        sharedResourceType = await ResourceType.create({
            name: `${TEST_PREFIX}Seminar Room`,
            code: `${TEST_PREFIX}SEM-ROOM`,
            category: ResourceCategory.ROOM,
            isActive: true,
        });
        sharedResource = await Resource.create({
            name: `${TEST_PREFIX}Conference Hall Alpha`,
            code: `${TEST_PREFIX}CONF-ALPHA`,
            resourceType: sharedResourceType._id,
            capacity: 50,
            status: ResourceStatus.ACTIVE,
            isActive: true,
            location: { building: 'Science Complex', room: 'Hall 101' },
        });
        // Mon - Fri: 08:00 - 20:00
        await AvailabilityRule.create({
            resource: sharedResource._id,
            timezone: defaultTz,
            name: `${TEST_PREFIX}Standard Operating Hours`,
            windows: [
                { dayOfWeek: DayOfWeek.MONDAY, startTime: '08:00', endTime: '20:00' },
                { dayOfWeek: DayOfWeek.TUESDAY, startTime: '08:00', endTime: '20:00' },
                { dayOfWeek: DayOfWeek.WEDNESDAY, startTime: '08:00', endTime: '20:00' },
                { dayOfWeek: DayOfWeek.THURSDAY, startTime: '08:00', endTime: '20:00' },
                { dayOfWeek: DayOfWeek.FRIDAY, startTime: '08:00', endTime: '20:00' },
            ],
            bookingPolicy: {
                minDurationMinutes: 30,
                maxDurationMinutes: 300,
                minLeadTimeMinutes: 0,
                maxAdvanceBookingDays: 60,
            },
            isActive: true,
        });
        // Create 10 distinct users to simulate distinct simultaneous booking clients
        for (let i = 1; i <= 10; i++) {
            const user = await User.create({
                name: `${TEST_PREFIX}Concurrent User ${i}`,
                email: `${TEST_PREFIX}user${i}@university.edu`,
                roles: [UserRole.STUDENT],
                department: 'Computer Science',
                isActive: true,
            });
            users.push(user);
            tokens.push(signAccessToken({
                sub: user._id.toString(),
                email: user.email,
                roles: user.roles,
                isActive: true,
                tokenVersion: user.tokenVersion ?? 0,
            }));
        }
        // Start ephemeral server
        await new Promise((resolve) => {
            server = app.listen(0, () => {
                const address = server.address();
                baseUrl = `http://127.0.0.1:${address.port}`;
                resolve();
            });
        });
    });
    after(async () => {
        if (server) {
            await new Promise((resolve) => server.close(() => resolve()));
        }
        await Promise.all([
            Reservation.deleteMany({ title: new RegExp(`^${TEST_PREFIX}`, 'i') }),
            AvailabilityRule.deleteMany({ name: new RegExp(`^${TEST_PREFIX}`, 'i') }),
            Resource.deleteMany({ code: new RegExp(`^${TEST_PREFIX}`, 'i') }),
            ResourceType.deleteMany({ code: new RegExp(`^${TEST_PREFIX}`, 'i') }),
            User.deleteMany({ email: new RegExp(`^${TEST_PREFIX}`, 'i') }),
        ]);
        await disconnectDatabase();
    });
    it('Scenario A: 10 concurrent requests for the EXACT SAME slot -> exactly 1 succeeds, 9 fail with 409', async () => {
        const slotDate = '2026-10-26'; // Monday
        const startAt = zonedTimeToUtc(slotDate, '10:00', defaultTz).toISOString();
        const endAt = zonedTimeToUtc(slotDate, '11:00', defaultTz).toISOString();
        // Fire 10 simultaneous HTTP requests
        const promises = users.map((user, idx) => fetch(`${baseUrl}/api/bookings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tokens[idx]}`,
            },
            body: JSON.stringify({
                resourceId: sharedResource._id.toString(),
                startAt,
                endAt,
                timezone: defaultTz,
                title: `${TEST_PREFIX}Simultaneous Exact Race ${idx + 1}`,
            }),
        }).then(async (res) => {
            const json = await res.json();
            return { status: res.status, json };
        }));
        const results = await Promise.allSettled(promises);
        const fulfilled = results.map((r) => (r.status === 'fulfilled' ? r.value : null)).filter(Boolean);
        const successCount = fulfilled.filter((f) => f?.status === 201).length;
        const conflictCount = fulfilled.filter((f) => f?.status === 409).length;
        assert.strictEqual(successCount, 1, `Expected exactly 1 booking to succeed, but got ${successCount}`);
        assert.strictEqual(conflictCount, 9, `Expected exactly 9 bookings to be rejected with 409 Conflict, but got ${conflictCount}`);
        // Verify database integrity
        const savedReservations = await Reservation.find({
            resource: sharedResource._id,
            status: { $in: ACTIVE_RESERVATION_STATES },
            startAt: new Date(startAt),
            endAt: new Date(endAt),
        });
        assert.strictEqual(savedReservations.length, 1, `Database must contain exactly 1 active reservation, found: ${savedReservations.length}`);
    });
    it('Scenario B: 8 concurrent requests for OVERLAPPING non-identical intervals -> zero double-bookings', async () => {
        const slotDate = '2026-10-27'; // Tuesday
        // 8 staggered intervals that all overlap each other in the [14:00, 17:00) range
        const intervals = [
            { start: '14:00', end: '15:30' },
            { start: '14:15', end: '15:45' },
            { start: '14:30', end: '16:00' },
            { start: '14:45', end: '16:15' },
            { start: '15:00', end: '16:30' },
            { start: '15:15', end: '16:45' },
            { start: '15:30', end: '17:00' },
            { start: '14:00', end: '17:00' },
        ];
        const promises = intervals.map((interval, idx) => {
            const startAt = zonedTimeToUtc(slotDate, interval.start, defaultTz).toISOString();
            const endAt = zonedTimeToUtc(slotDate, interval.end, defaultTz).toISOString();
            return fetch(`${baseUrl}/api/bookings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${tokens[idx]}`,
                },
                body: JSON.stringify({
                    resourceId: sharedResource._id.toString(),
                    startAt,
                    endAt,
                    timezone: defaultTz,
                    title: `${TEST_PREFIX}Simultaneous Overlapping Race ${idx + 1}`,
                }),
            }).then(async (res) => {
                const json = await res.json();
                return { status: res.status, json, interval };
            });
        });
        const results = await Promise.allSettled(promises);
        const fulfilled = results.map((r) => (r.status === 'fulfilled' ? r.value : null)).filter(Boolean);
        const successfulBookings = fulfilled.filter((f) => f?.status === 201);
        const rejectedBookings = fulfilled.filter((f) => f?.status === 409);
        assert.ok(successfulBookings.length >= 1, 'At least 1 booking must succeed');
        assert.ok(rejectedBookings.length > 0, 'Conflicting overlapping bookings must be rejected with 409');
        // Retrieve all saved reservations on this date
        const dayStart = zonedTimeToUtc(slotDate, '00:00', defaultTz);
        const dayEnd = zonedTimeToUtc(slotDate, '24:00', defaultTz);
        const saved = await Reservation.find({
            resource: sharedResource._id,
            status: { $in: ACTIVE_RESERVATION_STATES },
            startAt: { $lt: dayEnd },
            endAt: { $gt: dayStart },
        }).sort({ startAt: 1 });
        // Assert that NO TWO SAVED RESERVATIONS OVERLAP IN THE DATABASE
        for (let i = 0; i < saved.length; i++) {
            for (let j = i + 1; j < saved.length; j++) {
                const r1 = saved[i];
                const r2 = saved[j];
                const overlaps = r1.startAt < r2.endAt && r1.endAt > r2.startAt;
                assert.strictEqual(overlaps, false, `DOUBLE-BOOKING DETECTED IN MONGODB between ${r1._id} [${r1.startAt.toISOString()} - ${r1.endAt.toISOString()}) and ${r2._id} [${r2.startAt.toISOString()} - ${r2.endAt.toISOString()})`);
            }
        }
    });
    it('Scenario C: 3 concurrent requests for ADJACENT non-overlapping intervals -> ALL 3 succeed', async () => {
        const slotDate = '2026-10-28'; // Wednesday
        // Touching intervals: [09:00, 10:00), [10:00, 11:00), [11:00, 12:00)
        const adjacentIntervals = [
            { start: '09:00', end: '10:00' },
            { start: '10:00', end: '11:00' },
            { start: '11:00', end: '12:00' },
        ];
        const promises = adjacentIntervals.map((interval, idx) => {
            const startAt = zonedTimeToUtc(slotDate, interval.start, defaultTz).toISOString();
            const endAt = zonedTimeToUtc(slotDate, interval.end, defaultTz).toISOString();
            return fetch(`${baseUrl}/api/bookings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${tokens[idx]}`,
                },
                body: JSON.stringify({
                    resourceId: sharedResource._id.toString(),
                    startAt,
                    endAt,
                    timezone: defaultTz,
                    title: `${TEST_PREFIX}Adjacent Non-Conflicting ${idx + 1}`,
                }),
            }).then(async (res) => {
                const json = await res.json();
                return { status: res.status, json };
            });
        });
        const results = await Promise.allSettled(promises);
        const fulfilled = results.map((r) => (r.status === 'fulfilled' ? r.value : null)).filter(Boolean);
        const successCount = fulfilled.filter((f) => f?.status === 201).length;
        assert.strictEqual(successCount, 3, `Expected all 3 adjacent non-overlapping bookings to succeed, got ${successCount}`);
    });
    it('Scenario D: 500 concurrent competing requests for the exact same slot -> exactly 1 succeeds, 499 fail with 409', { timeout: 120000 }, async () => {
        const slotDate = '2026-11-04'; // Wednesday
        const startAt = zonedTimeToUtc(slotDate, '14:00', defaultTz).toISOString();
        const endAt = zonedTimeToUtc(slotDate, '15:00', defaultTz).toISOString();

        // 1. Prepare 500 distinct users and tokens to simulate 500 distinct simultaneous students
        const users500Data = [];
        const timestamp = Date.now();
        for (let i = 1; i <= 500; i++) {
            users500Data.push({
                name: `${TEST_PREFIX}Competitor ${i}`,
                email: `${TEST_PREFIX}comp_${i}_${timestamp}@university.edu`,
                roles: [UserRole.STUDENT],
                department: 'Computer Science',
                isActive: true,
            });
        }
        const createdUsers = await User.insertMany(users500Data);
        const tokens500 = createdUsers.map((u) => signAccessToken({
            sub: u._id.toString(),
            email: u.email,
            roles: u.roles,
            isActive: true,
            tokenVersion: u.tokenVersion ?? 0,
        }));

        // 2. Launch 500 simultaneous competing requests through the core booking pipeline
        const t0 = performance.now();
        const promises = createdUsers.map((user, idx) =>
            ReservationService.createReservation({
                resourceId: sharedResource._id.toString(),
                userId: user._id.toString(),
                startAt,
                endAt,
                timezone: defaultTz,
                title: `${TEST_PREFIX}Contested 500 Attempt ${idx + 1}`,
            }).then((res) => {
                return { success: true, res, idx };
            }).catch((err) => {
                return { success: false, error: err, statusCode: err.statusCode || 500, code: err.code || err.name, idx };
            })
        );

        const results = await Promise.allSettled(promises);
        const durationMs = performance.now() - t0;

        const fulfilled = results.map((r) => (r.status === 'fulfilled' ? r.value : null)).filter(Boolean);
        const rejected = results.filter((r) => r.status === 'rejected');

        const successBookings = fulfilled.filter((f) => f?.success === true);
        const conflictBookings = fulfilled.filter((f) => f?.success === false && f?.statusCode === 409);
        const serverErrors = fulfilled.filter((f) => f?.success === false && (f?.statusCode >= 500 || f?.statusCode === undefined));

        console.log(`[500-Concurrency Acceptance] Attempted: 500 | Success: ${successBookings.length} | Conflicts (409): ${conflictBookings.length} | 5xx/Other Errors: ${serverErrors.length} | Rejected Promises: ${rejected.length} | Duration: ${durationMs.toFixed(1)}ms`);
        if (serverErrors.length > 0) {
            console.log(`[Error Sample]: ${serverErrors[0]?.error?.message} (code: ${serverErrors[0]?.code})`);
        }

        // Acceptance criteria: exactly 1 booking succeeds
        assert.strictEqual(successBookings.length, 1, `Expected exactly 1 booking to succeed among 500 competing attempts, got ${successBookings.length}`);
        assert.strictEqual(conflictBookings.length, 499, `Expected exactly 499 bookings to be rejected with 409 Conflict, got ${conflictBookings.length}`);
        assert.strictEqual(serverErrors.length, 0, `Expected 0 server errors (5xx), got ${serverErrors.length}`);
        assert.strictEqual(rejected.length, 0, `Expected 0 network or uncaught connection errors, got ${rejected.length}`);

        // Verify database state: exactly 1 active persisted reservation for the contested interval
        const persisted = await Reservation.find({
            resource: sharedResource._id,
            status: { $in: ACTIVE_RESERVATION_STATES },
            startAt: new Date(startAt),
            endAt: new Date(endAt),
        });
        assert.strictEqual(persisted.length, 1, `Database must contain exactly 1 active reservation, found: ${persisted.length}`);

        // Check for any duplicate or overlapping active reservations on the entire resource for that day
        const dayStart = zonedTimeToUtc(slotDate, '00:00', defaultTz);
        const dayEnd = zonedTimeToUtc(slotDate, '24:00', defaultTz);
        const allDayReservations = await Reservation.find({
            resource: sharedResource._id,
            status: { $in: ACTIVE_RESERVATION_STATES },
            startAt: { $lt: dayEnd },
            endAt: { $gt: dayStart },
        }).sort({ startAt: 1 });

        for (let i = 0; i < allDayReservations.length; i++) {
            for (let j = i + 1; j < allDayReservations.length; j++) {
                const r1 = allDayReservations[i];
                const r2 = allDayReservations[j];
                const overlaps = r1.startAt < r2.endAt && r1.endAt > r2.startAt;
                assert.strictEqual(overlaps, false, `Overlapping active reservations detected: ${r1._id} and ${r2._id}`);
            }
        }
    });
});
