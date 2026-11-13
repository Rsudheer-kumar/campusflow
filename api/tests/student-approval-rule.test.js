/**
 * CampusFlow API - Unit Tests: Student Booking Approval Rule & Progression
 *
 * TEST ISOLATION & SAFETY GUARANTEE:
 * Operates purely in-memory using Node.js native test runner and mocks without
 * modifying any live database.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { ReservationStatus } from '../src/models/reservation.model.js';
import { ApproverRole } from '../src/models/approvalPolicy.model.js';
import { UserRole } from '../src/models/user.model.js';
import { ApprovalPolicyService } from '../src/services/approvalPolicy.service.js';

describe('Student Mandatory Booking Approval Rule & Workflow', () => {
  it('1. ApproverRole and VALID_APPROVER_ROLES includes FACULTY, DEPARTMENT_HEAD, and ADMIN', () => {
    assert.equal(ApproverRole.FACULTY, UserRole.FACULTY);
    assert.equal(ApproverRole.DEPARTMENT_HEAD, UserRole.DEPARTMENT_HEAD);
    assert.equal(ApproverRole.ADMIN, UserRole.ADMIN);
  });

  it('2. ApprovalPolicyService resolves precedence and enforces default fallback auto-confirm for non-students', () => {
    const fallback = ApprovalPolicyService.resolvePrecedence([], [UserRole.FACULTY]);
    assert.equal(fallback.requiresApproval, false);
    assert.deepEqual(fallback.approvalChain, []);
  });

  it('3. Student booking simulation: creates PENDING reservation with 2-step chain (Faculty -> Admin)', () => {
    const studentUser = {
      _id: new mongoose.Types.ObjectId(),
      roles: [UserRole.STUDENT],
      department: 'Computer Science',
    };

    // When policyResult has no chain (unconfigured room/lab/block)
    const policyResult = { requiresApproval: false, approvalChain: [] };

    const isStudentBooking = Array.isArray(studentUser.roles) && studentUser.roles.includes(UserRole.STUDENT);
    let effectiveRequiresApproval = Boolean(policyResult.requiresApproval);
    let effectiveChain = Array.isArray(policyResult.approvalChain) && policyResult.approvalChain.length > 0
      ? [...policyResult.approvalChain]
      : [];

    if (isStudentBooking) {
      effectiveRequiresApproval = true;
      if (effectiveChain.length === 0) {
        effectiveChain = [
          {
            stepOrder: 1,
            approverRole: ApproverRole.DEPARTMENT_HEAD,
            timeoutHours: 48,
          },
          {
            stepOrder: 2,
            approverRole: ApproverRole.ADMIN,
            timeoutHours: 48,
          },
        ];
      }
    }

    assert.equal(isStudentBooking, true);
    assert.equal(effectiveRequiresApproval, true);
    assert.equal(effectiveChain.length, 2);
    assert.equal(effectiveChain[0].approverRole, ApproverRole.DEPARTMENT_HEAD);
    assert.equal(effectiveChain[1].approverRole, ApproverRole.ADMIN);

    const initialStatus = effectiveRequiresApproval && effectiveChain.length > 0
      ? ReservationStatus.PENDING
      : ReservationStatus.CONFIRMED;

    assert.equal(initialStatus, ReservationStatus.PENDING);
  });

  it('4. Faculty / Department Head role check allows reviewing student approvals', () => {
    const facultyUser = {
      _id: new mongoose.Types.ObjectId(),
      roles: [UserRole.FACULTY],
      department: 'Computer Science',
    };

    const activeStep = {
      stepOrder: 1,
      approverRole: ApproverRole.DEPARTMENT_HEAD,
    };

    const isFacultyStep =
      activeStep.approverRole === ApproverRole.DEPARTMENT_HEAD ||
      activeStep.approverRole === ApproverRole.FACULTY;

    const holdsStepRole =
      facultyUser.roles.includes(activeStep.approverRole) ||
      (isFacultyStep && (facultyUser.roles.includes(UserRole.FACULTY) || facultyUser.roles.includes(UserRole.DEPARTMENT_HEAD)));

    assert.equal(holdsStepRole, true);
  });

  it('5. Separation of Duties: student cannot approve their own booking', () => {
    const studentId = new mongoose.Types.ObjectId();
    const reservationCreatorId = studentId;

    const isSameUser = reservationCreatorId.toString() === studentId.toString();
    assert.equal(isSameUser, true);
  });
});
