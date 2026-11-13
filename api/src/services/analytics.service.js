/**
 * CampusFlow API - Analytics Service
 * Computes institutional facility utilization, booking volume, status distributions,
 * and campus resource metrics from live database state.
 */

import { Reservation, ReservationStatus } from '../models/reservation.model.js';
import { Resource, ResourceStatus } from '../models/resource.model.js';

export class AnalyticsService {
  /**
   * Generates a comprehensive analytical overview of campus facility reservations.
   * Scopes metrics based on user role (department heads see department metrics if applicable).
   *
   * @param {Object} user - The authenticated user context.
   * @returns {Promise<Object>} Analytical summary, breakdowns, and recent activity.
   */
  static async getOverview(user) {
    const matchQuery = {};

    // Department heads are scoped to reservations within their department
    const isSuperAdmin = user.roles?.includes('ADMIN') || user.roles?.includes('FACILITY_MANAGER');
    if (!isSuperAdmin && user.roles?.includes('DEPARTMENT_HEAD') && user.department) {
      matchQuery['department'] = user.department;
    }

    // Execute overview metrics in parallel
    const [
      totalBookings,
      activeBookings,
      pendingApprovals,
      completedBookings,
      cancelledBookings,
      noShowBookings,
      totalResources,
      activeResources,
      byStatusRaw,
      byBuildingRaw,
      byTypeRaw,
      recentActivityRaw,
    ] = await Promise.all([
      Reservation.countDocuments(matchQuery),
      Reservation.countDocuments({
        ...matchQuery,
        status: { $in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN] },
      }),
      Reservation.countDocuments({
        ...matchQuery,
        status: ReservationStatus.PENDING,
      }),
      Reservation.countDocuments({
        ...matchQuery,
        status: ReservationStatus.COMPLETED,
      }),
      Reservation.countDocuments({
        ...matchQuery,
        status: { $in: [ReservationStatus.CANCELLED, ReservationStatus.REJECTED] },
      }),
      Reservation.countDocuments({
        ...matchQuery,
        status: ReservationStatus.NO_SHOW,
      }),
      Resource.countDocuments(),
      Resource.countDocuments({ status: ResourceStatus.ACTIVE }),
      Reservation.aggregate([
        { $match: matchQuery },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Reservation.aggregate([
        { $match: matchQuery },
        {
          $lookup: {
            from: 'resources',
            localField: 'resource',
            foreignField: '_id',
            as: 'resourceDoc',
          },
        },
        { $unwind: '$resourceDoc' },
        {
          $group: {
            _id: '$resourceDoc.location.building',
            count: { $sum: 1 },
            activeCount: {
              $sum: {
                $cond: [
                  { $in: ['$status', [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN]] },
                  1,
                  0,
                ],
              },
            },
          },
        },
        { $sort: { count: -1 } },
      ]),
      Reservation.aggregate([
        { $match: matchQuery },
        {
          $lookup: {
            from: 'resources',
            localField: 'resource',
            foreignField: '_id',
            as: 'resourceDoc',
          },
        },
        { $unwind: '$resourceDoc' },
        {
          $lookup: {
            from: 'resourcetypes',
            localField: 'resourceDoc.resourceType',
            foreignField: '_id',
            as: 'typeDoc',
          },
        },
        { $unwind: { path: '$typeDoc', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ['$typeDoc.name', 'Other'] },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      Reservation.find(matchQuery)
        .sort({ createdAt: -1 })
        .limit(8)
        .populate('resource', 'name code location.building')
        .populate('user', 'name email department')
        .lean(),
    ]);

    // Format distributions
    const byStatus = byStatusRaw.map((item) => ({
      status: item._id,
      count: item.count,
    }));

    const byBuilding = byBuildingRaw.map((item) => ({
      building: item._id || 'Unassigned',
      totalBookings: item.count,
      activeBookings: item.activeCount,
    }));

    const byType = byTypeRaw.map((item) => ({
      type: item._id,
      count: item.count,
    }));

    const recentActivity = recentActivityRaw.map((r) => ({
      id: r._id.toString(),
      title: r.title,
      status: r.status,
      startAt: r.startAt,
      endAt: r.endAt,
      resourceName: r.resource?.name || 'Unknown Facility',
      resourceCode: r.resource?.code || 'N/A',
      building: r.resource?.location?.building || 'Main Campus',
      userName: r.user?.name || 'Campus Member',
      userEmail: r.user?.email || '',
      createdAt: r.createdAt,
    }));

    // Calculate campus utilization rate: (activeBookings / totalResources) percentage capped at 100
    const utilizationRate =
      totalResources > 0 ? Math.min(100, Math.round((activeBookings / totalResources) * 100)) : 0;

    return {
      summary: {
        totalBookings,
        activeBookings,
        pendingApprovals,
        completedBookings,
        cancelledBookings,
        noShowBookings,
        totalResources,
        activeResources,
        utilizationRate,
      },
      byStatus,
      byBuilding,
      byType,
      recentActivity,
    };
  }
}
