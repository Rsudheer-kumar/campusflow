/**
 * Ensures the local development demo accounts are available.
 * This script intentionally changes no production data because it exits in production.
 */

import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { User, UserRole } from '../models/index.js';
import { hashPassword } from '../utils/password.js';
import { logger } from '../utils/logger.js';
import { fileURLToPath } from 'url';

const DEMO_PASSWORD = 'CampusFlow@2026!';

export async function ensureDemoUsers() {
  if (!env.isDevelopment) {
    logger.info('Skipping demo user ensure step outside development mode.');
    return;
  }

  await connectDatabase(env.MONGODB_URI);

  try {
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    const users = [
      {
        email: 'student@campusflow.edu',
        name: 'Alex Chen',
        roles: [UserRole.STUDENT],
        department: 'Computer Science',
        identifier: 'STU-2026-081',
      },
      {
        email: 'faculty@campusflow.edu',
        name: 'Dr. Sarah Connor',
        roles: [UserRole.FACULTY, UserRole.DEPARTMENT_HEAD],
        department: 'Computer Science',
        identifier: 'FAC-2024-019',
      },
      {
        email: 'admin@campusflow.edu',
        name: 'System Administrator',
        roles: [UserRole.ADMIN, UserRole.FACILITY_MANAGER],
        department: 'Campus Facilities IT',
        identifier: 'ADM-001',
      },
    ];

    for (const user of users) {
      await User.findOneAndUpdate(
        { email: user.email },
        {
          $set: {
            ...user,
            isActive: true,
            passwordHash,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    logger.info('Local demo users are ready.');
  } finally {
    await disconnectDatabase();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  ensureDemoUsers()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('Failed to ensure local demo users', error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
