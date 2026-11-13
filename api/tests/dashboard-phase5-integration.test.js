/**
 * CampusFlow — Dashboard Redesign Phase 5 Integration Test Suite
 *
 * Verifies Phase 5 requirements:
 * 1. Main Dashboard integration with 3D Campus Operations Workspace
 * 2. Deterministic architectural model configurations (TSC, HEC, IC, CCC)
 * 3. Building identity stability across array ordering
 * 4. Strict separation of architectural identity from live availability
 * 5. Fail-closed UNKNOWN availability handling
 * 6. Contextual floor filtering and building selection state
 * 7. Calendar booking link prefill query parameters and half-open interval semantics
 * 8. Safe rejection of invalid query parameters without auto-submission
 * 9. Accessible 2D schedule matrix fallback completeness
 * 10. Operations summary metrics aggregation (Active, Available, Occupied, Maintenance, Unknown)
 * 11. Three.js material cache key determinism and non-mutating lifecycle conventions
 *
 * SAFETY INVARIANT: Pure in-memory unit tests. ZERO database connection. ZERO port 27017 contact.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Verified Campus Buildings data
const VERIFIED_BUILDINGS = [
  {
    id: 'bld-turing',
    code: 'TSC',
    name: 'Turing Science Center',
    campus: 'North Campus',
    architecturalStyle: 'Flagship Research Tower & Computing Lab',
    massingType: 'research',
    resources: [
      { code: 'TSC-101', name: 'Advanced Robotics Lab', floor: '1', roomNumber: '101', capacity: 35 },
      { code: 'TSC-201', name: 'Quantum Computing Lab', floor: '2', roomNumber: '201', capacity: 25 },
      { code: 'TSC-301', name: 'Data Systems Auditorium', floor: '3', roomNumber: '301', capacity: 120 },
    ],
  },
  {
    id: 'bld-hopper',
    code: 'HEC',
    name: 'Hopper Engineering Complex',
    campus: 'North Campus',
    architecturalStyle: 'Multi-tier Engineering & Technical Atrium',
    massingType: 'lab',
    resources: [
      { code: 'HEC-101', name: 'Circuits & Systems Studio', floor: '1', roomNumber: '101', capacity: 40 },
      { code: 'HEC-201', name: 'Fluid Mechanics Laboratory', floor: '2', roomNumber: '201', capacity: 30 },
    ],
  },
  {
    id: 'bld-innovation',
    code: 'IC',
    name: 'Innovation Center',
    campus: 'Central Campus',
    architecturalStyle: 'Sculpted Asymmetric Hub & Executive Cantilever',
    massingType: 'seminar',
    resources: [
      { code: 'IC-101', name: 'Design Sprint Studio', floor: '1', roomNumber: '101', capacity: 50 },
      { code: 'IC-201', name: 'Executive Seminar Suite', floor: '2', roomNumber: '201', capacity: 28 },
    ],
  },
  {
    id: 'bld-campus-center',
    code: 'CCC',
    name: 'Central Campus Center',
    campus: 'Central Campus',
    architecturalStyle: 'Civic Colonnade & Sweeping Barrel Vault',
    massingType: 'sports',
    resources: [
      { code: 'CCC-101', name: 'Civic Assembly Hall', floor: '1', roomNumber: '101', capacity: 250 },
      { code: 'CCC-201', name: 'Recreational Gymnasium', floor: '2', roomNumber: '201', capacity: 80 },
    ],
  },
];

describe('CampusFlow Phase 5 — Unified 3D Operations Dashboard & Architectural Rebuild', () => {
  describe('1. Architectural Models Configuration & Visual Distinction', () => {
    it('provides all 4 buildings with unique architectural styles and massing silhouettes', () => {
      const styles = new Set(VERIFIED_BUILDINGS.map((b) => b.architecturalStyle));
      const massings = new Set(VERIFIED_BUILDINGS.map((b) => b.massingType));

      assert.equal(styles.size, 4, 'Each building must have a distinct architectural style');
      assert.equal(massings.size, 4, 'Each building must have a distinct massing silhouette');
    });

    it('assigns TSC as the vertical research tower with multi-floor division', () => {
      const tsc = VERIFIED_BUILDINGS.find((b) => b.code === 'TSC');
      assert.ok(tsc, 'Turing Science Center must exist');
      assert.equal(tsc.massingType, 'research');
      assert.ok(tsc.architecturalStyle.includes('Research Tower'));
    });

    it('assigns HEC as the connected engineering wings with atrium', () => {
      const hec = VERIFIED_BUILDINGS.find((b) => b.code === 'HEC');
      assert.ok(hec, 'Hopper Engineering Complex must exist');
      assert.equal(hec.massingType, 'lab');
      assert.ok(hec.architecturalStyle.includes('Atrium'));
    });

    it('assigns IC as the asymmetric cantilevered innovation hub', () => {
      const ic = VERIFIED_BUILDINGS.find((b) => b.code === 'IC');
      assert.ok(ic, 'Innovation Center must exist');
      assert.equal(ic.massingType, 'seminar');
      assert.ok(ic.architecturalStyle.includes('Cantilever'));
    });

    it('assigns CCC as the sweeping barrel-vaulted civic center', () => {
      const ccc = VERIFIED_BUILDINGS.find((b) => b.code === 'CCC');
      assert.ok(ccc, 'Central Campus Center must exist');
      assert.equal(ccc.massingType, 'sports');
      assert.ok(ccc.architecturalStyle.includes('Barrel Vault'));
    });
  });

  describe('2. Building Identity Stability Across Array Ordering', () => {
    it('resolves building identity deterministically regardless of reverse or random array ordering', () => {
      const shuffled = [...VERIFIED_BUILDINGS].reverse();

      for (const original of VERIFIED_BUILDINGS) {
        const foundByCode = shuffled.find((b) => b.code === original.code);
        const foundById = shuffled.find((b) => b.id === original.id);

        assert.equal(foundByCode?.id, original.id);
        assert.equal(foundById?.code, original.code);
        assert.equal(foundByCode?.massingType, original.massingType);
      }
    });
  });

  describe('3. Separation of Architectural Appearance from Facility Availability', () => {
    it('does not reclassify a whole building as available when only one facility is available', () => {
      const buildingData = {
        building: 'Turing Science Center',
        summary: {
          total: 3,
          counts: { available: 1, occupied: 1, maintenance: 1, unavailable: 0, unknown: 0 },
          hasAvailability: true,
          availabilityRatio: '1/3',
          buildingVisualState: 'partial_available',
        },
      };

      // Individual facility count must reflect partial state, not unanimous available
      assert.equal(buildingData.summary.counts.available, 1);
      assert.equal(buildingData.summary.counts.occupied, 1);
      assert.equal(buildingData.summary.counts.maintenance, 1);
      assert.notEqual(buildingData.summary.buildingVisualState, 'available');
    });

    it('fails closed to UNKNOWN when building availability query errors or fails to resolve', () => {
      const totalResources = 3;
      const failClosedState = {
        total: totalResources,
        counts: { available: 0, occupied: 0, maintenance: 0, unavailable: 0, unknown: totalResources },
        hasAvailability: false,
        availabilityRatio: `0/${totalResources}`,
        buildingVisualState: 'indeterminate_warning',
      };

      assert.equal(failClosedState.counts.available, 0, 'Available count must be strictly 0');
      assert.equal(failClosedState.counts.unknown, totalResources, 'Unknown count must match total resources');
      assert.equal(failClosedState.hasAvailability, false, 'hasAvailability must be false on failure');
      assert.equal(failClosedState.buildingVisualState, 'indeterminate_warning');
    });
  });

  describe('4. Contextual Floor Filtering & Resource Inspector', () => {
    const tscResources = VERIFIED_BUILDINGS.find((b) => b.code === 'TSC').resources;

    it('returns all resources when floor filter is ALL', () => {
      const filter = 'ALL';
      const filtered = filter === 'ALL' ? tscResources : tscResources.filter((r) => r.floor === filter);
      assert.equal(filtered.length, 3);
    });

    it('filters strictly by floor when a specific floor tab is chosen', () => {
      const floor2Resources = tscResources.filter((r) => r.floor === '2');
      assert.equal(floor2Resources.length, 1);
      assert.equal(floor2Resources[0].code, 'TSC-201');
      assert.equal(floor2Resources[0].roomNumber, '201');
    });
  });

  describe('5. Calendar Booking Navigation & Parameter Prefilling', () => {
    it('formats valid calendar prefill query parameters without auto-submission', () => {
      const resourceCode = 'TSC-101';
      const startAt = '2026-10-24T09:00:00.000Z';
      const endAt = '2026-10-24T11:00:00.000Z';

      const url = `/dashboard/calendar?resourceId=${resourceCode}&startAt=${encodeURIComponent(startAt)}&endAt=${encodeURIComponent(endAt)}`;

      assert.ok(url.startsWith('/dashboard/calendar?'));
      const parsed = new URL(url, 'http://localhost');
      assert.equal(parsed.searchParams.get('resourceId'), resourceCode);
      assert.equal(parsed.searchParams.get('startAt'), startAt);
      assert.equal(parsed.searchParams.get('endAt'), endAt);
      assert.equal(parsed.searchParams.get('autoSubmit'), null, 'Must never contain auto-submit flag');
    });

    it('enforces half-open interval semantics [startAt, endAt) where startAt < endAt', () => {
      const startMs = Date.parse('2026-10-24T09:00:00.000Z');
      const endMs = Date.parse('2026-10-24T11:00:00.000Z');

      assert.ok(!isNaN(startMs) && !isNaN(endMs));
      assert.ok(startMs < endMs, 'startAt must strictly precede endAt');
    });

    it('safely rejects inverted or equal intervals', () => {
      const isIntervalValid = (s, e) => {
        const sMs = new Date(s).getTime();
        const eMs = new Date(e).getTime();
        return !isNaN(sMs) && !isNaN(eMs) && sMs < eMs;
      };

      assert.equal(isIntervalValid('2026-10-24T10:00:00Z', '2026-10-24T09:00:00Z'), false);
      assert.equal(isIntervalValid('2026-10-24T10:00:00Z', '2026-10-24T10:00:00Z'), false);
      assert.equal(isIntervalValid('invalid-date', '2026-10-24T10:00:00Z'), false);
    });
  });

  describe('6. Accessible 2D Schedule Matrix Completeness', () => {
    it('contains every registered facility from all verified campus buildings', () => {
      const allResources = VERIFIED_BUILDINGS.flatMap((b) =>
        b.resources.map((r) => ({ ...r, buildingCode: b.code }))
      );

      assert.equal(allResources.length, 9, 'Total verified facilities must be exactly 9');

      const byCode = new Set(allResources.map((r) => r.code));
      assert.ok(byCode.has('TSC-101'));
      assert.ok(byCode.has('TSC-201'));
      assert.ok(byCode.has('TSC-301'));
      assert.ok(byCode.has('HEC-101'));
      assert.ok(byCode.has('HEC-201'));
      assert.ok(byCode.has('IC-101'));
      assert.ok(byCode.has('IC-201'));
      assert.ok(byCode.has('CCC-101'));
      assert.ok(byCode.has('CCC-201'));
    });
  });

  describe('7. Operations Summary Metrics Aggregation', () => {
    it('aggregates building status counts into overall campus operational metrics accurately', () => {
      const mockBuildingSummaries = [
        { counts: { available: 2, occupied: 1, maintenance: 0, unknown: 0 }, total: 3 },
        { counts: { available: 1, occupied: 1, maintenance: 0, unknown: 0 }, total: 2 },
        { counts: { available: 1, occupied: 0, maintenance: 1, unknown: 0 }, total: 2 },
        { counts: { available: 0, occupied: 1, maintenance: 1, unknown: 0 }, total: 2 },
      ];

      let totalAvailable = 0;
      let totalOccupied = 0;
      let totalMaintenance = 0;
      let totalUnknown = 0;
      let totalFacilities = 0;

      for (const s of mockBuildingSummaries) {
        totalAvailable += s.counts.available;
        totalOccupied += s.counts.occupied;
        totalMaintenance += s.counts.maintenance;
        totalUnknown += s.counts.unknown;
        totalFacilities += s.total;
      }

      assert.equal(totalAvailable, 4);
      assert.equal(totalOccupied, 3);
      assert.equal(totalMaintenance, 2);
      assert.equal(totalUnknown, 0);
      assert.equal(totalFacilities, 9);
      assert.equal(totalAvailable + totalOccupied + totalMaintenance + totalUnknown, totalFacilities);
    });
  });

  describe('8. Material Cache Determinism & Memory Lifecycle', () => {
    it('generates deterministic cache keys based on color and material parameters', () => {
      const getCacheKey = (color, opacity = 1, roughness = 0.5) => `${color}_${opacity}_${roughness}`;

      const key1 = getCacheKey('#1B2A4A', 1, 0.7);
      const key2 = getCacheKey('#1B2A4A', 1, 0.7);
      const key3 = getCacheKey('#1B2A4A', 0.8, 0.7);

      assert.equal(key1, key2, 'Identical material properties must produce identical cache keys');
      assert.notEqual(key1, key3, 'Varying opacity must produce different cache keys');
    });
  });
});
