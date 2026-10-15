/**
 * CampusFlow API - Resource Query Validator
 * Validates search, filtering, and pagination for resource discovery.
 */

import { ResourceStatus } from '../models/resource.model.js';
import { validatePaginationQuery } from './index.js';

const hex24Regex = /^[0-9a-fA-F]{24}$/;

export function validateResourceQuery(data) {
  const record = (data || {});
  const errors = [];

  const paginationResult = validatePaginationQuery(data);
  if (!paginationResult.success || !paginationResult.data) {
    return paginationResult;
  }

  const { page, limit } = paginationResult.data;
  let search;
  let building;
  let status;
  let resourceType;

  if (record.search !== undefined) {
    if (typeof record.search !== 'string' || record.search.trim().length === 0) {
      errors.push({ field: 'search', message: 'search parameter must be a non-empty string if provided' });
    } else {
      search = record.search.trim();
    }
  }

  if (record.building !== undefined) {
    if (typeof record.building !== 'string' || record.building.trim().length === 0) {
      errors.push({ field: 'building', message: 'building parameter must be a non-empty string if provided' });
    } else {
      building = record.building.trim();
    }
  }

  if (record.status !== undefined) {
    const validStatuses = Object.values(ResourceStatus);
    if (typeof record.status !== 'string' || !validStatuses.includes(record.status)) {
      errors.push({
        field: 'status',
        message: `status must be one of: ${validStatuses.join(', ')}`,
      });
    } else {
      status = record.status;
    }
  }

  if (record.resourceType !== undefined) {
    if (typeof record.resourceType !== 'string' || !hex24Regex.test(record.resourceType)) {
      errors.push({
        field: 'resourceType',
        message: 'resourceType must be a valid 24-character hexadecimal ObjectId',
      });
    } else {
      resourceType = record.resourceType;
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      search,
      building,
      status,
      resourceType,
      page,
      limit,
    },
  };
}
