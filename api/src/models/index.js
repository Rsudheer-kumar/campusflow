/**
 * CampusFlow API - Data Model Layer Foundation
 * Central export point for Mongoose domain schemas and models.
 * Exports foundational models:
 * - Identity & Resource: User, ResourceType, Resource, ResourceAttributeSchema, Custodian
 * - Availability, Blackout & Quota: AvailabilityRule, Blackout, Quota
 */

// User
export {
  User,
  UserSchema,
  UserRole,
} from './user.model.js';

// ResourceType
export {
  ResourceType,
  ResourceTypeSchema,
  ResourceCategory,
} from './resourceType.model.js';

// ResourceAttribute (authoritatively embedded in Resource.attributes)
export {
  ResourceAttributeSchema,
  AttributeDataType,
} from './resourceAttribute.model.js';

// Custodian
export {
  Custodian,
  CustodianSchema,
} from './custodian.model.js';

// Resource
export {
  Resource,
  ResourceSchema,
  ResourceStatus,
} from './resource.model.js';

// AvailabilityRule
export {
  AvailabilityRule,
  AvailabilityRuleSchema,
  AvailabilityWindowSchema,
  BookingPolicySchema,
  DayOfWeek,
  isValidIanaTimezone,
  isValidCalendarDate,
  timeStringToMinutes,
} from './availabilityRule.model.js';

// Utility functions
export { normalizeDepartmentName } from '../utils/dateValidation.js';

// Blackout
export {
  Blackout,
  BlackoutSchema,
  BlackoutCategory,
} from './blackout.model.js';

// Quota
export {
  Quota,
  QuotaSchema,
  QuotaScopeType,
  QuotaSubjectType,
  QuotaMetric,
  QuotaPeriod,
} from './quota.model.js';

// Reservation / Booking (Phase 2.5)
export {
  Reservation,
  ReservationSchema,
  ReservationStatus,
  ACTIVE_RESERVATION_STATES,
  TERMINAL_RESERVATION_STATES,
  VALID_STATUS_TRANSITIONS,
  isValidReservationTransition,
} from './reservation.model.js';

// Approval Policy (Phase 3.2)
export {
  ApprovalPolicy,
  ApprovalPolicySchema,
  ApprovalScopeType,
  ApproverRole,
  VALID_APPROVER_ROLES,
} from './approvalPolicy.model.js';

// Timetable Entry (Phase 3.1)
export {
  TimetableEntry,
  TimetableEntrySchema,
} from './timetableEntry.model.js';
