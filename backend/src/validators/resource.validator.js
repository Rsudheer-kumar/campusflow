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

const CODE_REGEX = /^[A-Z0-9_-]+$/;

function validateLocationObject(loc, isUpdate = false) {
  const errors = [];
  if (!loc || typeof loc !== 'object' || Array.isArray(loc)) {
    if (!isUpdate) {
      errors.push({ field: 'location', message: 'location is required and must be an object' });
    }
    return { errors, data: undefined };
  }

  const locationData = {};

  if (!loc.building || typeof loc.building !== 'string' || loc.building.trim().length === 0) {
    if (!isUpdate) {
      errors.push({ field: 'location.building', message: 'location.building is required' });
    }
  } else {
    const bTrimmed = loc.building.trim();
    if (bTrimmed.length > 100) {
      errors.push({ field: 'location.building', message: 'location.building cannot exceed 100 characters' });
    } else {
      locationData.building = bTrimmed;
    }
  }

  if (loc.floor !== undefined && loc.floor !== null) {
    if (typeof loc.floor !== 'string') {
      errors.push({ field: 'location.floor', message: 'location.floor must be a string' });
    } else if (loc.floor.trim().length > 50) {
      errors.push({ field: 'location.floor', message: 'location.floor cannot exceed 50 characters' });
    } else {
      locationData.floor = loc.floor.trim();
    }
  }

  if (loc.roomNumber !== undefined && loc.roomNumber !== null) {
    if (typeof loc.roomNumber !== 'string') {
      errors.push({ field: 'location.roomNumber', message: 'location.roomNumber must be a string' });
    } else if (loc.roomNumber.trim().length > 50) {
      errors.push({ field: 'location.roomNumber', message: 'location.roomNumber cannot exceed 50 characters' });
    } else {
      locationData.roomNumber = loc.roomNumber.trim();
    }
  }

  if (loc.campus !== undefined && loc.campus !== null) {
    if (typeof loc.campus !== 'string') {
      errors.push({ field: 'location.campus', message: 'location.campus must be a string' });
    } else if (loc.campus.trim().length > 100) {
      errors.push({ field: 'location.campus', message: 'location.campus cannot exceed 100 characters' });
    } else {
      locationData.campus = loc.campus.trim();
    }
  }

  return { errors, data: locationData };
}

export function validateCreateResourceBody(data) {
  const record = data || {};
  const errors = [];

  // name
  let name;
  if (!record.name || typeof record.name !== 'string') {
    errors.push({ field: 'name', message: 'Resource name is required and must be a string' });
  } else {
    name = record.name.trim();
    if (name.length < 2 || name.length > 100) {
      errors.push({ field: 'name', message: 'Resource name must be between 2 and 100 characters' });
    }
  }

  // code
  let code;
  if (!record.code || typeof record.code !== 'string') {
    errors.push({ field: 'code', message: 'Resource code is required and must be a string' });
  } else {
    code = record.code.trim().toUpperCase();
    if (!CODE_REGEX.test(code)) {
      errors.push({
        field: 'code',
        message: 'Resource code must contain only uppercase letters, numbers, underscores, and dashes',
      });
    }
  }

  // resourceType
  let resourceType;
  if (!record.resourceType || typeof record.resourceType !== 'string' || !hex24Regex.test(record.resourceType)) {
    errors.push({ field: 'resourceType', message: 'resourceType must be a valid 24-character hexadecimal ObjectId' });
  } else {
    resourceType = record.resourceType;
  }

  // capacity
  let capacity;
  if (record.capacity === undefined || record.capacity === null) {
    errors.push({ field: 'capacity', message: 'Resource capacity is required' });
  } else {
    const parsedCapacity = Number(record.capacity);
    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1) {
      errors.push({ field: 'capacity', message: 'capacity must be an integer greater than or equal to 1' });
    } else {
      capacity = parsedCapacity;
    }
  }

  // location
  const locResult = validateLocationObject(record.location, false);
  if (locResult.errors.length > 0) {
    errors.push(...locResult.errors);
  }

  // description (optional)
  let description;
  if (record.description !== undefined && record.description !== null) {
    if (typeof record.description !== 'string') {
      errors.push({ field: 'description', message: 'description must be a string' });
    } else {
      description = record.description.trim();
      if (description.length > 1000) {
        errors.push({ field: 'description', message: 'description cannot exceed 1000 characters' });
      }
    }
  }

  // status (optional, defaults to ACTIVE)
  let status = ResourceStatus.ACTIVE;
  if (record.status !== undefined && record.status !== null) {
    const validStatuses = Object.values(ResourceStatus);
    if (typeof record.status !== 'string' || !validStatuses.includes(record.status)) {
      errors.push({ field: 'status', message: `status must be one of: ${validStatuses.join(', ')}` });
    } else {
      status = record.status;
    }
  }

  // isActive (optional, defaults to true)
  const isActive = record.isActive !== undefined ? Boolean(record.isActive) : true;

  // attributes (optional)
  let attributes = [];
  if (record.attributes !== undefined && record.attributes !== null) {
    if (!Array.isArray(record.attributes)) {
      errors.push({ field: 'attributes', message: 'attributes must be an array' });
    } else {
      attributes = record.attributes;
    }
  }

  // photos (optional)
  let photos = [];
  if (record.photos !== undefined && record.photos !== null) {
    const photoRes = validatePhotosArray(record.photos);
    if (photoRes.errors.length > 0) {
      errors.push(...photoRes.errors);
    } else {
      photos = photoRes.data;
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      name,
      code,
      resourceType,
      capacity,
      location: locResult.data,
      description,
      status,
      isActive,
      attributes,
      photos,
    },
  };
}

export function validateUpdateResourceBody(data) {
  const record = data || {};
  const errors = [];
  const validated = {};

  if (record.name !== undefined) {
    if (typeof record.name !== 'string') {
      errors.push({ field: 'name', message: 'Resource name must be a string' });
    } else {
      const name = record.name.trim();
      if (name.length < 2 || name.length > 100) {
        errors.push({ field: 'name', message: 'Resource name must be between 2 and 100 characters' });
      } else {
        validated.name = name;
      }
    }
  }

  if (record.code !== undefined) {
    if (typeof record.code !== 'string') {
      errors.push({ field: 'code', message: 'Resource code must be a string' });
    } else {
      const code = record.code.trim().toUpperCase();
      if (!CODE_REGEX.test(code)) {
        errors.push({
          field: 'code',
          message: 'Resource code must contain only uppercase letters, numbers, underscores, and dashes',
        });
      } else {
        validated.code = code;
      }
    }
  }

  if (record.resourceType !== undefined) {
    if (typeof record.resourceType !== 'string' || !hex24Regex.test(record.resourceType)) {
      errors.push({ field: 'resourceType', message: 'resourceType must be a valid 24-character hexadecimal ObjectId' });
    } else {
      validated.resourceType = record.resourceType;
    }
  }

  if (record.capacity !== undefined) {
    const parsedCapacity = Number(record.capacity);
    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1) {
      errors.push({ field: 'capacity', message: 'capacity must be an integer greater than or equal to 1' });
    } else {
      validated.capacity = parsedCapacity;
    }
  }

  if (record.location !== undefined) {
    const locResult = validateLocationObject(record.location, true);
    if (locResult.errors.length > 0) {
      errors.push(...locResult.errors);
    } else if (locResult.data) {
      validated.location = locResult.data;
    }
  }

  if (record.description !== undefined) {
    if (record.description === null) {
      validated.description = '';
    } else if (typeof record.description !== 'string') {
      errors.push({ field: 'description', message: 'description must be a string' });
    } else {
      const description = record.description.trim();
      if (description.length > 1000) {
        errors.push({ field: 'description', message: 'description cannot exceed 1000 characters' });
      } else {
        validated.description = description;
      }
    }
  }

  if (record.status !== undefined) {
    const validStatuses = Object.values(ResourceStatus);
    if (typeof record.status !== 'string' || !validStatuses.includes(record.status)) {
      errors.push({ field: 'status', message: `status must be one of: ${validStatuses.join(', ')}` });
    } else {
      validated.status = record.status;
    }
  }

  if (record.isActive !== undefined) {
    validated.isActive = Boolean(record.isActive);
  }

  if (record.attributes !== undefined) {
    if (!Array.isArray(record.attributes)) {
      errors.push({ field: 'attributes', message: 'attributes must be an array' });
    } else {
      validated.attributes = record.attributes;
    }
  }

  if (record.photos !== undefined) {
    const photoRes = validatePhotosArray(record.photos);
    if (photoRes.errors.length > 0) {
      errors.push(...photoRes.errors);
    } else {
      validated.photos = photoRes.data;
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: validated };
}

export function validateToggleResourceStatusBody(data) {
  const record = data || {};
  const errors = [];
  const validated = {};

  if (record.status === undefined && record.isActive === undefined) {
    errors.push({ field: 'status', message: 'Either status or isActive must be provided' });
  }

  if (record.status !== undefined) {
    const validStatuses = Object.values(ResourceStatus);
    if (typeof record.status !== 'string' || !validStatuses.includes(record.status)) {
      errors.push({ field: 'status', message: `status must be one of: ${validStatuses.join(', ')}` });
    } else {
      validated.status = record.status;
    }
  }

  if (record.isActive !== undefined) {
    validated.isActive = Boolean(record.isActive);
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: validated };
}

export function validatePhotoObject(item, index = 0) {
  const errors = [];
  if (!item || typeof item !== 'object') {
    return { errors: [{ field: `photos[${index}]`, message: 'Photo must be an object' }] };
  }
  const prefix = `photos[${index}]`;
  let url;
  if (!item.url || typeof item.url !== 'string' || item.url.trim().length === 0) {
    errors.push({ field: `${prefix}.url`, message: 'Photo URL is required' });
  } else {
    url = item.url.trim();
    const isHttp = /^https?:\/\/[^\s$.?#].[^\s]*$/i.test(url);
    const isDataUri = /^data:image\/(?:png|jpeg|jpg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(url);
    if (!isHttp && !isDataUri) {
      errors.push({ field: `${prefix}.url`, message: 'Photo must be a valid HTTP/HTTPS URL or base64 image data URI' });
    }
    if (url.length > 7 * 1024 * 1024) {
      errors.push({ field: `${prefix}.url`, message: 'Photo size exceeds maximum allowed limit (5MB)' });
    }
  }

  let caption = '';
  if (item.caption !== undefined && item.caption !== null) {
    if (typeof item.caption !== 'string') {
      errors.push({ field: `${prefix}.caption`, message: 'Caption must be a string' });
    } else if (item.caption.trim().length > 200) {
      errors.push({ field: `${prefix}.caption`, message: 'Caption cannot exceed 200 characters' });
    } else {
      caption = item.caption.trim();
    }
  }

  const isPrimary = Boolean(item.isPrimary);

  return { errors, data: { url, caption, isPrimary } };
}

export function validatePhotosArray(photos) {
  const errors = [];
  if (!Array.isArray(photos)) {
    return { errors: [{ field: 'photos', message: 'photos must be an array' }] };
  }
  if (photos.length > 10) {
    return { errors: [{ field: 'photos', message: 'Cannot upload more than 10 photos per resource' }] };
  }
  const validatedPhotos = [];
  photos.forEach((photo, idx) => {
    const res = validatePhotoObject(photo, idx);
    if (res.errors.length > 0) {
      errors.push(...res.errors);
    } else if (res.data) {
      validatedPhotos.push(res.data);
    }
  });
  return { errors, data: validatedPhotos };
}

export function validateAddPhotoBody(data) {
  const record = data || {};
  const res = validatePhotoObject(record, 0);
  if (res.errors.length > 0) {
    return { success: false, errors: res.errors };
  }
  return { success: true, data: res.data };
}

export function validateBulkImportBody(data) {
  const record = data || {};
  const errors = [];
  let csv = '';

  if (typeof record === 'string') {
    csv = record;
  } else if (typeof record.csv === 'string') {
    csv = record.csv;
  } else {
    errors.push({ field: 'csv', message: 'CSV data is required as a string in the "csv" field' });
  }

  if (csv.trim().length === 0) {
    errors.push({ field: 'csv', message: 'CSV content cannot be empty' });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: { csv: csv.trim() } };
}
