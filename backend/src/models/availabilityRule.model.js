/**
 * CampusFlow API - AvailabilityRule Model
 * Defines recurring weekly time windows during which a specific resource is normally available.
 *
 * TIME SEMANTICS:
 * Availability windows represent half-open recurring weekly intervals [startTime, endTime)
 * in strict 24-hour local time (HH:mm) interpreted against an authoritative IANA timezone.
 * A single window must not cross midnight (startTime < endTime).
 */

import mongoose, { Schema } from 'mongoose';
import { isValidCalendarDate, timeStringToMinutes } from '../utils/dateValidation.js';

export { isValidCalendarDate, timeStringToMinutes };

export const DayOfWeek = Object.freeze({
  MONDAY: 'MONDAY',
  TUESDAY: 'TUESDAY',
  WEDNESDAY: 'WEDNESDAY',
  THURSDAY: 'THURSDAY',
  FRIDAY: 'FRIDAY',
  SATURDAY: 'SATURDAY',
  SUNDAY: 'SUNDAY',
});

// Regex patterns:
// startTime accepts 00:00 through 23:59 (24:00 is strictly forbidden as a start boundary)
const startTimeRegex = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
// endTime accepts 00:00 through 24:00 (24:00 is valid strictly as an end-of-day boundary)
const endTimeRegex = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/;

/**
 * Validates whether a given string is a valid IANA timezone name.
 * Accepts standard IANA identifiers (e.g., "Asia/Kolkata", "America/New_York", "UTC", "GMT").
 * Rejects informal abbreviations like "IST", "EST", "PST".
 */
export function isValidIanaTimezone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  // Reject informal abbreviations that lack an area/location prefix unless canonical UTC/GMT
  if (tz !== 'UTC' && tz !== 'GMT' && !tz.includes('/')) {
    return false;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const BookingPolicySchema = new Schema(
  {
    minDurationMinutes: {
      type: Number,
      required: [true, 'minDurationMinutes is required for booking policy'],
      validate: {
        validator(val) {
          return typeof val === 'number' && Number.isInteger(val) && val > 0;
        },
        message: 'minDurationMinutes must be a positive integer',
      },
    },
    maxDurationMinutes: {
      type: Number,
      required: [true, 'maxDurationMinutes is required for booking policy'],
      validate: {
        validator(val) {
          return typeof val === 'number' && Number.isInteger(val) && val > 0;
        },
        message: 'maxDurationMinutes must be a positive integer',
      },
    },
    minLeadTimeMinutes: {
      type: Number,
      default: 0,
      validate: {
        validator(val) {
          return typeof val === 'number' && Number.isInteger(val) && val >= 0;
        },
        message: 'minLeadTimeMinutes must be a non-negative integer',
      },
    },
    maxAdvanceBookingDays: {
      type: Number,
      default: 30,
      validate: {
        validator(val) {
          return typeof val === 'number' && Number.isInteger(val) && val >= 0;
        },
        message: 'maxAdvanceBookingDays must be a non-negative integer',
      },
    },
  },
  {
    _id: false,
  }
);

BookingPolicySchema.pre('validate', function () {
  if (
    typeof this.minDurationMinutes === 'number' &&
    typeof this.maxDurationMinutes === 'number' &&
    this.minDurationMinutes > 0 &&
    this.maxDurationMinutes > 0 &&
    this.minDurationMinutes > this.maxDurationMinutes
  ) {
    throw new Error(
      `minDurationMinutes (${this.minDurationMinutes}) cannot exceed maxDurationMinutes (${this.maxDurationMinutes})`
    );
  }
});

export const AvailabilityWindowSchema = new Schema(
  {
    dayOfWeek: {
      type: String,
      enum: {
        values: Object.values(DayOfWeek),
        message: 'Invalid day of week: {VALUE}',
      },
      required: [true, 'dayOfWeek is required for availability window'],
    },
    startTime: {
      type: String,
      required: [true, 'startTime is required for availability window'],
      match: [
        startTimeRegex,
        'startTime must be in strict 24-hour HH:mm format between 00:00 and 23:59',
      ],
      trim: true,
    },
    endTime: {
      type: String,
      required: [true, 'endTime is required for availability window'],
      match: [
        endTimeRegex,
        'endTime must be in strict 24-hour HH:mm format between 00:00 and 24:00',
      ],
      trim: true,
    },
  },
  {
    _id: false,
  }
);

// Individual window validation: half-open interval [start, end) where start < end
AvailabilityWindowSchema.pre('validate', function () {
  if (this.startTime && this.endTime) {
    // Only perform interval comparison if both strings match valid formats,
    // allowing path-level format validator to report invalid format directly.
    if (startTimeRegex.test(this.startTime) && endTimeRegex.test(this.endTime)) {
      const startMinutes = timeStringToMinutes(this.startTime);
      const endMinutes = timeStringToMinutes(this.endTime);
      if (startMinutes >= endMinutes) {
        throw new Error(
          `Availability window startTime (${this.startTime}) must be earlier than endTime (${this.endTime})`
        );
      }
    }
  }
});

export const AvailabilityRuleSchema = new Schema(
  {
    resource: {
      type: Schema.Types.ObjectId,
      ref: 'Resource',
      required: [true, 'Resource reference is required for availability rule'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Availability rule name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    timezone: {
      type: String,
      required: [true, 'Timezone is required for availability rule'],
      trim: true,
      validate: {
        validator: isValidIanaTimezone,
        message: 'Invalid IANA timezone identifier: {VALUE}',
      },
    },
    windows: {
      type: [AvailabilityWindowSchema],
      default: [],
    },
    bookingPolicy: {
      type: BookingPolicySchema,
      required: [true, 'bookingPolicy is required for availability rule'],
    },
    effectiveFrom: {
      type: String,
      trim: true,
      validate: {
        validator: (val) => !val || isValidCalendarDate(val),
        message: 'effectiveFrom must be a valid real calendar date in YYYY-MM-DD format',
      },
    },
    effectiveTo: {
      type: String,
      trim: true,
      validate: {
        validator: (val) => !val || isValidCalendarDate(val),
        message: 'effectiveTo must be a valid real calendar date in YYYY-MM-DD format',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Enforce:
// 1. Effective date range validity: effectiveFrom <= effectiveTo
// 2. No exact duplicate windows within the same rule
AvailabilityRuleSchema.pre('validate', function () {
  if (this.effectiveFrom && this.effectiveTo && this.effectiveFrom > this.effectiveTo) {
    throw new Error(
      `effectiveFrom (${this.effectiveFrom}) cannot be later than effectiveTo (${this.effectiveTo})`
    );
  }

  if (this.windows && this.windows.length > 1) {
    const seen = new Set();
    for (const win of this.windows) {
      const key = `${win.dayOfWeek}_${win.startTime}_${win.endTime}`;
      if (seen.has(key)) {
        throw new Error(
          `Duplicate availability window detected: ${win.dayOfWeek} ${win.startTime}-${win.endTime}`
        );
      }
      seen.add(key);
    }
  }
});

// Indexes for query patterns:
// 1. Querying active rules for a specific resource
AvailabilityRuleSchema.index({ resource: 1, isActive: 1 });
// 2. Multikey index for querying rules covering a specific day of week
AvailabilityRuleSchema.index({ 'windows.dayOfWeek': 1 });
// 3. Date range lookup for effective dates
AvailabilityRuleSchema.index({ resource: 1, effectiveFrom: 1, effectiveTo: 1 });

export const AvailabilityRule =
  mongoose.models.AvailabilityRule ||
  mongoose.model('AvailabilityRule', AvailabilityRuleSchema);
