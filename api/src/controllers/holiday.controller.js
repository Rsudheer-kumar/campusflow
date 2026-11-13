/**
 * CampusFlow API - Holiday Controller
 * HTTP request handlers for official public holidays and administrative campus closures.
 */

import { HolidayService } from '../services/holiday.service.js';
import { sendSuccess } from '../utils/response.js';
import { memoryCache } from '../utils/memoryCache.js';

export async function listHolidays(req, res, next) {
  try {
    const { year, startDate, endDate, date, category } = req.query;
    const cacheKey = `holidays_${JSON.stringify(req.query || {})}`;
    const cached = memoryCache.get(cacheKey);
    if (cached) {
      return sendSuccess(res, cached, 200);
    }

    const holidays = await HolidayService.listHolidays({
      year,
      startDate,
      endDate,
      date,
      category,
    });

    memoryCache.set(cacheKey, holidays, 60000);
    return sendSuccess(res, holidays, 200);
  } catch (err) {
    return next(err);
  }
}

export async function declareCampusHoliday(req, res, next) {
  try {
    const result = await HolidayService.declareCampusHoliday(req.body, req.user);
    memoryCache.invalidatePrefix('holidays_');
    return sendSuccess(res, result, 201);
  } catch (err) {
    return next(err);
  }
}

export async function revokeHoliday(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const holiday = await HolidayService.revokeHoliday(id, req.user, reason);
    memoryCache.invalidatePrefix('holidays_');
    return sendSuccess(res, holiday, 200);
  } catch (err) {
    return next(err);
  }
}

export async function syncPublicHolidays(req, res, next) {
  try {
    const year = req.body.year ? Number(req.body.year) : new Date().getUTCFullYear();
    const result = await HolidayService.syncPredefinedHolidays(year, req.user?._id);
    memoryCache.invalidatePrefix('holidays_');
    return sendSuccess(res, result, 200);
  } catch (err) {
    return next(err);
  }
}
