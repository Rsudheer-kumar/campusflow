/**
 * CampusFlow API - Resource Controller
 * Provides facility and equipment catalogue endpoints, category discovery,
 * and administrative resource lifecycle operations.
 */

import { Resource } from '../models/index.js';
import { ResourceService } from '../services/resource.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export class ResourceController {
  /**
   * GET /api/resources
   * List resources with optional search, building, category, and status filters.
   */
  static async listResources(req, res) {
    try {
      const filters = req.query || {};
      const { search, building, status, resourceType, page = 1, limit = 20 } = filters;

      const query = {};

      if (status) {
        query.status = status;
      }

      if (building) {
        query['location.building'] = { $regex: building, $options: 'i' };
      }

      if (resourceType) {
        query.resourceType = resourceType;
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { code: { $regex: search, $options: 'i' } },
          { 'location.building': { $regex: search, $options: 'i' } },
        ];
      }

      const skip = (page - 1) * limit;

      const [resources, total] = await Promise.all([
        Resource.find(query)
          .populate('resourceType', 'name code category')
          .sort({ name: 1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Resource.countDocuments(query),
      ]);

      sendSuccess(res, {
        resources,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      });
    } catch (error) {
      logger.error('Failed to list resources', error instanceof Error ? error.message : error);
      sendError(res, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred while fetching resources', 500);
    }
  }

  /**
   * GET /api/resources/types
   * Returns all active ResourceType category definitions.
   */
  static async listResourceTypes(req, res, next) {
    try {
      const resourceTypes = await ResourceService.listResourceTypes();
      sendSuccess(res, { resourceTypes });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/resources/:id
   * Retrieve resource by ID with populated resourceType.
   */
  static async getResourceById(req, res) {
    try {
      const { id } = req.params;

      const resource = await Resource.findById(id)
        .populate('resourceType', 'name code category')
        .lean();

      if (!resource) {
        sendError(res, 'NOT_FOUND', `Resource with identifier "${id}" not found`, 404);
        return;
      }

      sendSuccess(res, resource);
    } catch (error) {
      logger.error('Failed to get resource by ID', error instanceof Error ? error.message : error);
      sendError(res, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred while retrieving resource', 500);
    }
  }

  /**
   * POST /api/resources
   * Creates a new resource facility.
   * Authorized: ADMIN, FACILITY_MANAGER
   */
  static async createResource(req, res, next) {
    try {
      const resource = await ResourceService.createResource(req.body);
      sendSuccess(res, { resource }, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/resources/:id
   * Updates an existing resource facility.
   * Authorized: ADMIN, FACILITY_MANAGER
   */
  static async updateResource(req, res, next) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const resource = await ResourceService.updateResource(id, req.body);
      sendSuccess(res, { resource }, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/resources/:id
   * Safely deactivates/archives a resource facility.
   * Authorized: ADMIN, FACILITY_MANAGER
   */
  static async archiveResource(req, res, next) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const resource = await ResourceService.archiveResource(id);
      sendSuccess(res, { message: 'Resource archived successfully', resource }, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/resources/:id/status
   * Toggles operational status or active state of a resource facility.
   * Authorized: ADMIN, FACILITY_MANAGER
   */
  static async toggleResourceStatus(req, res, next) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const resource = await ResourceService.toggleResourceStatus(id, req.body);
      sendSuccess(res, { resource }, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/resources/bulk-import
   * Imports multiple resources from CSV content with row-level validation.
   * Authorized: ADMIN, FACILITY_MANAGER
   */
  static async bulkImport(req, res, next) {
    try {
      const csv = typeof req.body === 'string' ? req.body : req.body.csv;
      const result = await ResourceService.bulkImportResources(csv);
      sendSuccess(res, result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/resources/:id/photos
   * Adds a photo to a resource facility.
   * Authorized: ADMIN, FACILITY_MANAGER
   */
  static async addPhoto(req, res, next) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const resource = await ResourceService.addPhoto(id, req.body);
      sendSuccess(res, { resource }, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/resources/:id/photos/:photoId
   * Removes a photo from a resource.
   * Authorized: ADMIN, FACILITY_MANAGER
   */
  static async deletePhoto(req, res, next) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const photoId = Array.isArray(req.params.photoId) ? req.params.photoId[0] : req.params.photoId;
      const resource = await ResourceService.deletePhoto(id, photoId);
      sendSuccess(res, { resource }, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/resources/:id/photos/:photoId/primary
   * Sets a specific photo as primary for the resource.
   * Authorized: ADMIN, FACILITY_MANAGER
   */
  static async setPrimaryPhoto(req, res, next) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const photoId = Array.isArray(req.params.photoId) ? req.params.photoId[0] : req.params.photoId;
      const resource = await ResourceService.setPrimaryPhoto(id, photoId);
      sendSuccess(res, { resource }, 200);
    } catch (error) {
      next(error);
    }
  }
}
