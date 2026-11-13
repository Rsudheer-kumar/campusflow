/**
 * CampusFlow API - Emergency Booking Controller
 * HTTP request handlers for HOD four-block cascading search and emergency escalation.
 */

import { EmergencyBookingService } from '../services/emergencyBooking.service.js';
import { sendSuccess } from '../utils/response.js';

export async function searchCascade(req, res, next) {
  try {
    const { startAt, endAt, requiredCapacity, requiredEquipment, isMeeting, timezone } = req.query;
    const result = await EmergencyBookingService.cascadeSearch({
      startAt,
      endAt,
      requiredCapacity,
      requiredEquipment: requiredEquipment ? requiredEquipment.split(',') : [],
      isMeeting: isMeeting !== 'false',
      timezone,
    });
    return sendSuccess(res, result, 'Cascade search completed across campus blocks');
  } catch (err) {
    return next(err);
  }
}

export async function submitEmergencyRequest(req, res, next) {
  try {
    const reservation = await EmergencyBookingService.submitEmergencyRequest(req.body, req.user);
    return sendSuccess(
      res,
      reservation,
      'Emergency room booking request successfully escalated to Campus Administration',
      201
    );
  } catch (err) {
    return next(err);
  }
}

export async function actionEmergencyRequest(req, res, next) {
  try {
    const { id } = req.params;
    const result = await EmergencyBookingService.actionEmergencyRequest(id, req.body, req.user);
    return sendSuccess(
      res,
      result,
      `Emergency booking request ${req.body.action === 'APPROVE' ? 'APPROVED' : 'REJECTED'}`
    );
  } catch (err) {
    return next(err);
  }
}
