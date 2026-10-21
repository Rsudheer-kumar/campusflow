/**
 * CampusFlow API - Resource Service
 * Business logic for facility and equipment catalogue management,
 * administrative creation, updates, bulk CSV import, photo asset management,
 * and safe archiving/deactivation.
 */

import { Types } from 'mongoose';
import { Resource, ResourceStatus } from '../models/resource.model.js';
import { ResourceType } from '../models/resourceType.model.js';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  BadRequestError,
} from '../utils/errors.js';

export class ResourceService {
  /**
   * Retrieves all active ResourceType categories.
   */
  static async listResourceTypes() {
    const types = await ResourceType.find({ isActive: true })
      .sort({ name: 1 })
      .lean();
    return types;
  }

  /**
   * Creates a new campus resource with verified active resourceType reference and unique code.
   */
  static async createResource(input) {
    // 1. Verify existence and active state of referenced ResourceType
    const typeExists = await ResourceType.findById(input.resourceType).lean();
    if (!typeExists) {
      throw new NotFoundError(`ResourceType with ID "${input.resourceType}" not found`);
    }
    if (typeExists.isActive === false) {
      throw new ValidationError(
        `ResourceType "${typeExists.name || input.resourceType}" is inactive and cannot be assigned to new resources`
      );
    }

    // 2. Normalize and check unique code
    const normalizedCode = input.code.trim().toUpperCase();
    const existingWithCode = await Resource.findOne({ code: normalizedCode }).lean();
    if (existingWithCode) {
      throw new ConflictError(`Resource with code "${normalizedCode}" already exists`);
    }

    const status = input.status || ResourceStatus.ACTIVE;
    let isActive = input.isActive !== undefined ? input.isActive : true;
    if (status === ResourceStatus.RETIRED) {
      isActive = false;
    }

    // 3. Create resource document
    const resource = new Resource({
      name: input.name.trim(),
      code: normalizedCode,
      resourceType: new Types.ObjectId(input.resourceType),
      capacity: input.capacity,
      location: input.location,
      description: input.description,
      status,
      isActive,
      attributes: input.attributes || [],
      photos: input.photos || [],
    });

    try {
      await resource.save();
      return await Resource.findById(resource._id)
        .populate('resourceType', 'name code category')
        .lean();
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        throw new ConflictError(`Resource with code "${normalizedCode}" already exists`);
      }
      throw error;
    }
  }

  /**
   * Updates an existing resource facility with validation and conflict checks.
   * Enforces RETIRED => isActive: false invariant.
   */
  static async updateResource(id, input) {
    const resource = await Resource.findById(id);
    if (!resource) {
      throw new NotFoundError(`Resource with identifier "${id}" not found`);
    }

    // If resourceType is being updated, verify it exists and is active
    if (input.resourceType) {
      const typeExists = await ResourceType.findById(input.resourceType).lean();
      if (!typeExists) {
        throw new NotFoundError(`ResourceType with ID "${input.resourceType}" not found`);
      }
      if (typeExists.isActive === false) {
        throw new ValidationError(
          `ResourceType "${typeExists.name || input.resourceType}" is inactive and cannot be assigned`
        );
      }
      resource.resourceType = new Types.ObjectId(input.resourceType);
    }

    // If code is being updated, check uniqueness
    if (input.code) {
      const normalizedCode = input.code.trim().toUpperCase();
      if (normalizedCode !== resource.code) {
        const existing = await Resource.findOne({ code: normalizedCode, _id: { $ne: resource._id } }).lean();
        if (existing) {
          throw new ConflictError(`Resource with code "${normalizedCode}" already exists`);
        }
        resource.code = normalizedCode;
      }
    }

    if (input.name !== undefined) resource.name = input.name.trim();
    if (input.capacity !== undefined) resource.capacity = input.capacity;
    if (input.location !== undefined) resource.location = input.location;
    if (input.description !== undefined) resource.description = input.description;

    // Enforce RETIRED & isActive consistency
    if (input.status !== undefined) {
      resource.status = input.status;
      if (input.status === ResourceStatus.RETIRED) {
        resource.isActive = false;
      }
    }

    if (input.isActive !== undefined) {
      if (input.isActive && resource.status === ResourceStatus.RETIRED) {
        throw new ValidationError('A retired resource cannot be active. Update the status first.');
      }
      resource.isActive = input.isActive;
    }

    if (input.attributes !== undefined) resource.attributes = input.attributes;
    if (input.photos !== undefined) resource.photos = input.photos;

    try {
      await resource.save();
      return await Resource.findById(resource._id)
        .populate('resourceType', 'name code category')
        .lean();
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        throw new ConflictError('A resource with this unique code already exists');
      }
      throw error;
    }
  }

  /**
   * Safely deactivates/archives a resource without breaking historical booking records.
   */
  static async archiveResource(id) {
    const resource = await Resource.findById(id);
    if (!resource) {
      throw new NotFoundError(`Resource with identifier "${id}" not found`);
    }

    resource.status = ResourceStatus.RETIRED;
    resource.isActive = false;

    await resource.save();
    return await Resource.findById(resource._id)
      .populate('resourceType', 'name code category')
      .lean();
  }

  /**
   * Toggles resource operational status or active flag while enforcing invariants.
   */
  static async toggleResourceStatus(id, { status, isActive }) {
    const resource = await Resource.findById(id);
    if (!resource) {
      throw new NotFoundError(`Resource with identifier "${id}" not found`);
    }

    if (status !== undefined) {
      resource.status = status;
      if (status === ResourceStatus.RETIRED) {
        resource.isActive = false;
      }
    }

    if (isActive !== undefined) {
      if (isActive && resource.status === ResourceStatus.RETIRED) {
        throw new ValidationError('A retired resource cannot be active. Update the status first.');
      }
      resource.isActive = isActive;
    }

    await resource.save();
    return await Resource.findById(resource._id)
      .populate('resourceType', 'name code category')
      .lean();
  }

  /**
   * Adds a photo to a resource facility.
   */
  static async addPhoto(resourceId, { url, caption, isPrimary }) {
    const resource = await Resource.findById(resourceId);
    if (!resource) {
      throw new NotFoundError(`Resource with identifier "${resourceId}" not found`);
    }

    if (isPrimary && resource.photos?.length > 0) {
      for (const p of resource.photos) {
        p.isPrimary = false;
      }
    }

    const newPhoto = {
      url,
      caption: caption || '',
      isPrimary: isPrimary || (resource.photos?.length === 0),
    };

    resource.photos.push(newPhoto);
    await resource.save();

    return await Resource.findById(resource._id)
      .populate('resourceType', 'name code category')
      .lean();
  }

  /**
   * Removes a photo from a resource.
   */
  static async deletePhoto(resourceId, photoId) {
    const resource = await Resource.findById(resourceId);
    if (!resource) {
      throw new NotFoundError(`Resource with identifier "${resourceId}" not found`);
    }

    const initialCount = resource.photos.length;
    resource.photos = resource.photos.filter(
      (p) => p._id.toString() !== photoId.toString()
    );

    if (resource.photos.length === initialCount) {
      throw new NotFoundError(`Photo with identifier "${photoId}" not found on resource`);
    }

    // Ensure a primary photo exists if any photos remain
    const hasPrimary = resource.photos.some((p) => p.isPrimary);
    if (!hasPrimary && resource.photos.length > 0) {
      resource.photos[0].isPrimary = true;
    }

    await resource.save();
    return await Resource.findById(resource._id)
      .populate('resourceType', 'name code category')
      .lean();
  }

  /**
   * Sets a specific photo as primary for a resource.
   */
  static async setPrimaryPhoto(resourceId, photoId) {
    const resource = await Resource.findById(resourceId);
    if (!resource) {
      throw new NotFoundError(`Resource with identifier "${resourceId}" not found`);
    }

    let found = false;
    for (const p of resource.photos) {
      if (p._id.toString() === photoId.toString()) {
        p.isPrimary = true;
        found = true;
      } else {
        p.isPrimary = false;
      }
    }

    if (!found) {
      throw new NotFoundError(`Photo with identifier "${photoId}" not found on resource`);
    }

    await resource.save();
    return await Resource.findById(resource._id)
      .populate('resourceType', 'name code category')
      .lean();
  }

  /**
   * Performs bulk CSV resource import with validation, duplicate detection,
   * active category verification, and row-level actionable error reporting.
   */
  static async bulkImportResources(csvContent) {
    if (!csvContent || typeof csvContent !== 'string') {
      throw new BadRequestError('CSV content must be a non-empty string');
    }

    const lines = csvContent
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter((line) => line.trim().length > 0);

    if (lines.length < 2) {
      throw new BadRequestError('CSV must contain a header row and at least one data row');
    }

    const parseLine = (line) => {
      const values = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          values.push(cur.trim());
          cur = '';
        } else {
          cur += char;
        }
      }
      values.push(cur.trim());
      return values;
    };

    const rawHeaders = parseLine(lines[0]);
    const headers = rawHeaders.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

    // Check required header columns
    const hasName = headers.includes('name');
    const hasCode = headers.includes('code');
    const hasType = headers.some((h) => ['resourcetype', 'type', 'category'].includes(h));
    const hasBuilding = headers.some((h) => ['building', 'locationbuilding'].includes(h));
    const hasCapacity = headers.includes('capacity');

    if (!hasName || !hasCode || !hasType || !hasBuilding || !hasCapacity) {
      throw new BadRequestError(
        'CSV is missing required columns. Required headers: name, code, resourceType (or category), capacity, building'
      );
    }

    // Load all active and inactive resource types for category lookup
    const allTypes = await ResourceType.find({}).lean();
    const activeTypeMap = new Map();
    const inactiveTypeSet = new Set();

    for (const t of allTypes) {
      const idStr = t._id.toString();
      const codeStr = (t.code || '').toUpperCase();
      const nameStr = (t.name || '').toLowerCase();

      if (t.isActive) {
        activeTypeMap.set(idStr, t._id);
        if (codeStr) activeTypeMap.set(codeStr, t._id);
        if (nameStr) activeTypeMap.set(nameStr, t._id);
      } else {
        inactiveTypeSet.add(idStr);
        if (codeStr) inactiveTypeSet.add(codeStr);
        if (nameStr) inactiveTypeSet.add(nameStr);
      }
    }

    // Load existing resource codes from database
    const existingResources = await Resource.find({}, { code: 1 }).lean();
    const dbCodeSet = new Set(existingResources.map((r) => r.code.toUpperCase()));

    const seenBatchCodes = new Map(); // code -> rowNumber
    const validRowsToInsert = [];
    const errors = [];

    const codeRegex = /^[A-Z0-9_-]+$/;

    for (let i = 1; i < lines.length; i++) {
      const rowNum = i + 1;
      const values = parseLine(lines[i]);
      if (values.every((v) => v.length === 0)) continue; // skip blank row

      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });

      const name = (row.name || '').trim();
      const code = (row.code || '').trim().toUpperCase();
      const typeKey = (row.resourcetype || row.type || row.category || '').trim();
      const building = (row.building || row.locationbuilding || '').trim();
      const floor = (row.floor || row.locationfloor || '').trim();
      const roomNumber = (row.roomnumber || row.room || row.locationroomnumber || '').trim();
      const campus = (row.campus || row.locationcampus || '').trim();
      const description = (row.description || '').trim();
      const capacityVal = Number(row.capacity);

      // Row validations
      if (!name || name.length < 2) {
        errors.push({ row: rowNum, code, message: 'Resource name must be at least 2 characters' });
        continue;
      }

      if (!code || !codeRegex.test(code)) {
        errors.push({
          row: rowNum,
          code,
          message: 'Code is required and must contain only uppercase letters, numbers, hyphens, or underscores',
        });
        continue;
      }

      if (seenBatchCodes.has(code)) {
        errors.push({
          row: rowNum,
          code,
          message: `Duplicate resource code "${code}" already present in this CSV at row ${seenBatchCodes.get(code)}`,
        });
        continue;
      }

      if (dbCodeSet.has(code)) {
        errors.push({
          row: rowNum,
          code,
          message: `Resource with code "${code}" already exists in the system`,
        });
        continue;
      }

      if (!building) {
        errors.push({ row: rowNum, code, message: 'Building name is required' });
        continue;
      }

      if (!Number.isInteger(capacityVal) || capacityVal < 1) {
        errors.push({ row: rowNum, code, message: 'Capacity must be an integer >= 1' });
        continue;
      }

      // Check category/resourceType
      const resolvedTypeId =
        activeTypeMap.get(typeKey) ||
        activeTypeMap.get(typeKey.toUpperCase()) ||
        activeTypeMap.get(typeKey.toLowerCase());

      if (!resolvedTypeId) {
        const isInactive =
          inactiveTypeSet.has(typeKey) ||
          inactiveTypeSet.has(typeKey.toUpperCase()) ||
          inactiveTypeSet.has(typeKey.toLowerCase());

        if (isInactive) {
          errors.push({
            row: rowNum,
            code,
            message: `ResourceType "${typeKey}" is inactive and cannot be assigned`,
          });
        } else {
          errors.push({
            row: rowNum,
            code,
            message: `ResourceType "${typeKey}" not found`,
          });
        }
        continue;
      }

      seenBatchCodes.set(code, rowNum);

      validRowsToInsert.push({
        name,
        code,
        resourceType: resolvedTypeId,
        capacity: capacityVal,
        location: {
          building,
          floor: floor || undefined,
          roomNumber: roomNumber || undefined,
          campus: campus || undefined,
        },
        description: description || undefined,
        status: ResourceStatus.ACTIVE,
        isActive: true,
      });
    }

    const imported = [];
    if (validRowsToInsert.length > 0) {
      for (const item of validRowsToInsert) {
        const resource = new Resource(item);
        await resource.save();
        imported.push(resource);
        dbCodeSet.add(item.code);
      }
    }

    return {
      totalRows: lines.length - 1,
      importedCount: imported.length,
      failedCount: errors.length,
      imported: await Resource.find({ _id: { $in: imported.map((r) => r._id) } })
        .populate('resourceType', 'name code category')
        .lean(),
      errors,
    };
  }
}
