/**
 * CampusFlow API - Holiday Model
 * Represents predefined official public holidays and administrator-declared
 * campus holidays with facility scoping and audit trail.
 */

import mongoose, { Schema } from 'mongoose';

export const HolidaySource = Object.freeze({
  PREDEFINED_PUBLIC: 'PREDEFINED_PUBLIC',
  ADMIN_DECLARED: 'ADMIN_DECLARED',
});

export const HolidayCategory = Object.freeze({
  NATIONAL: 'NATIONAL',
  REGIONAL: 'REGIONAL',
  INSTITUTIONAL: 'INSTITUTIONAL',
  EMERGENCY_CLOSURE: 'EMERGENCY_CLOSURE',
});

export const HolidayScope = Object.freeze({
  CAMPUS_WIDE: 'CAMPUS_WIDE',
  SPECIFIC_BLOCKS: 'SPECIFIC_BLOCKS',
  SPECIFIC_RESOURCES: 'SPECIFIC_RESOURCES',
});

export const HolidayStatus = Object.freeze({
  PUBLISHED: 'PUBLISHED',
  REVOKED: 'REVOKED',
});

const HolidayAuditEntrySchema = new Schema(
  {
    action: {
      type: String,
      required: true,
      enum: ['CREATED', 'EDITED', 'REVOKED', 'SYNCED'],
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    performedAt: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
  },
  { _id: true }
);

export const HolidaySchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Holiday name is required'],
      trim: true,
      minlength: [2, 'Holiday name must be at least 2 characters'],
      maxlength: [150, 'Holiday name cannot exceed 150 characters'],
    },
    date: {
      type: String, // 'YYYY-MM-DD'
      required: [true, 'Date string (YYYY-MM-DD) is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'],
      index: true,
    },
    startAt: {
      type: Date,
      required: [true, 'startAt UTC timestamp is required'],
      index: true,
    },
    endAt: {
      type: Date,
      required: [true, 'endAt UTC timestamp is required'],
      index: true,
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
      index: true,
    },
    source: {
      type: String,
      enum: {
        values: Object.values(HolidaySource),
        message: 'Invalid holiday source: {VALUE}',
      },
      default: HolidaySource.ADMIN_DECLARED,
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: {
        values: Object.values(HolidayCategory),
        message: 'Invalid holiday category: {VALUE}',
      },
      default: HolidayCategory.INSTITUTIONAL,
      required: true,
      index: true,
    },
    scope: {
      type: String,
      enum: {
        values: Object.values(HolidayScope),
        message: 'Invalid holiday scope: {VALUE}',
      },
      default: HolidayScope.CAMPUS_WIDE,
      required: true,
      index: true,
    },
    affectedBlocks: {
      type: [
        {
          type: String,
          trim: true,
          uppercase: true,
        },
      ],
      default: [],
    },
    affectedResources: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Resource',
      },
    ],
    isUniversityClosed: {
      type: Boolean,
      default: true,
      index: true,
    },
    reason: {
      type: String,
      required: [true, 'Holiday reason or administrative justification is required'],
      trim: true,
      maxlength: [1000, 'Reason cannot exceed 1000 characters'],
    },
    status: {
      type: String,
      enum: {
        values: Object.values(HolidayStatus),
        message: 'Invalid holiday status: {VALUE}',
      },
      default: HolidayStatus.PUBLISHED,
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    auditTrail: {
      type: [HolidayAuditEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: '__v',
  }
);

// Compound unique index to avoid duplicate holiday entries for the same date, name, and scope
HolidaySchema.index(
  { date: 1, name: 1, scope: 1, status: 1 },
  { name: 'idx_holiday_date_name_scope' }
);

// Fast range lookup for calendar views and booking conflict checks
HolidaySchema.index(
  { status: 1, startAt: 1, endAt: 1 },
  { name: 'idx_holiday_status_start_end' }
);
HolidaySchema.index(
  { status: 1, isUniversityClosed: 1, startAt: 1, endAt: 1 },
  { name: 'idx_holiday_closed_start_end' }
);

export const Holiday =
  mongoose.models.Holiday || mongoose.model('Holiday', HolidaySchema);
