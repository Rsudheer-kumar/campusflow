/**
 * CampusFlow API - Approval Queue Controller
 * HTTP handler for retrieving the pending approval queue with role, department, and Four-Eyes filtering.
 */

import { ApprovalQueueService } from '../services/approvalQueue.service.js';
import { sendSuccess } from '../utils/response.js';
import { ForbiddenError } from '../utils/errors.js';

export async function getPendingApprovals(req, res, next) {
  try {
    if (!req.user) {
      return next(new ForbiddenError('Unauthorized'));
    }

    const result = await ApprovalQueueService.getPendingQueue(
      {
        id: req.user.id,
        roles: req.user.roles,
        department: req.user.department,
      },
      req.query
    );

    sendSuccess(res, result, 200);
  } catch (error) {
    next(error);
  }
}
