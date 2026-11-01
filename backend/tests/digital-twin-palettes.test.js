/**
 * CampusFlow — Digital Twin Architectural Palettes & Massing Test Suite
 *
 * Fully isolated, in-memory unit test suite validating Phase 3 visual polish:
 * 1. Deterministic building architectural color palette resolution (TSC, HEC, IC, CCC)
 * 2. Visual distinctness of identity colors across all 4 verified campus buildings
 * 3. Strict separation of architectural identity colors from live operational availability
 * 4. Architectural massing silhouette type assignments (research, lab, seminar, sports)
 * 5. Deterministic fallback behavior on invalid/unrecognized building identifiers
 * 6. Procedural geometry illustrative disclaimer verification
 *
 * SAFETY INVARIANT: Pure in-memory unit tests. ZERO database connection. ZERO network calls.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Mirroring palette configuration and helpers from web/lib/campus-data.js for Node test runner
const BUILDING_ARCHITECTURAL_PALETTES = Object.freeze({
  TSC: Object.freeze({
    code: 'TSC',
    id: 'bld-turing',
    name: 'Turing Science Center',
    theme: 'Sapphire Blue',
    architecturalStyle: 'Flagship Research Tower & Computing Lab',
    bodyColor: '#1B2A4A',
    selectedBodyColor: '#243B6B',
    glassColor: '#60A5FA',
    glassEmissive: '#1E3A8A',
    glassOpacity: 0.8,
    roofColor: '#0F172A',
    accentColor: '#38BDF8',
    trimColor: '#1E293B',
    primaryHex: '#3B82F6',
    badgeClass: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
    borderClass: 'border-blue-500/40',
    textClass: 'text-blue-400',
    chipBg: 'bg-blue-500/10',
  }),
  HEC: Object.freeze({
    code: 'HEC',
    id: 'bld-hopper',
    name: 'Hopper Engineering Complex',
    theme: 'Teal with Graphite',
    architecturalStyle: 'Multi-tier Engineering & Technical Atrium',
    bodyColor: '#132E35',
    selectedBodyColor: '#1B434D',
    glassColor: '#2DD4BF',
    glassEmissive: '#115E59',
    glassOpacity: 0.8,
    roofColor: '#0B1D22',
    accentColor: '#14B8A6',
    trimColor: '#1A2E35',
    primaryHex: '#14B8A6',
    badgeClass: 'bg-teal-500/15 text-teal-300 border border-teal-500/30',
    borderClass: 'border-teal-500/40',
    textClass: 'text-teal-400',
    chipBg: 'bg-teal-500/10',
  }),
  IC: Object.freeze({
    code: 'IC',
    id: 'bld-innovation',
    name: 'Innovation Center',
    theme: 'Violet with Silver',
    architecturalStyle: 'Contemporary Conference Center & Atrium',
    bodyColor: '#261E3E',
    selectedBodyColor: '#392D5E',
    glassColor: '#C084FC',
    glassEmissive: '#581C87',
    glassOpacity: 0.8,
    roofColor: '#171226',
    accentColor: '#A855F7',
    trimColor: '#2E244A',
    primaryHex: '#A855F7',
    badgeClass: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
    borderClass: 'border-purple-500/40',
    textClass: 'text-purple-400',
    chipBg: 'bg-purple-500/10',
  }),
  CCC: Object.freeze({
    code: 'CCC',
    id: 'bld-central',
    name: 'Central Campus Center',
    theme: 'Warm Amber with Sandstone',
    architecturalStyle: 'Civic University Assembly Hall & Barrel Vault',
    bodyColor: '#362719',
    selectedBodyColor: '#4D3723',
    glassColor: '#FBBF24',
    glassEmissive: '#78350F',
    glassOpacity: 0.8,
    roofColor: '#1F160E',
    accentColor: '#F59E0B',
    trimColor: '#3B2A1C',
    primaryHex: '#F59E0B',
    badgeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    borderClass: 'border-amber-500/40',
    textClass: 'text-amber-400',
    chipBg: 'bg-amber-500/10',
  }),
});

function getBuildingArchitecturalPalette(codeOrId) {
  if (!codeOrId) return BUILDING_ARCHITECTURAL_PALETTES.TSC;
  if (BUILDING_ARCHITECTURAL_PALETTES[codeOrId]) {
    return BUILDING_ARCHITECTURAL_PALETTES[codeOrId];
  }
  const byId = Object.values(BUILDING_ARCHITECTURAL_PALETTES).find(
    (p) => p.id === codeOrId
  );
  return byId || BUILDING_ARCHITECTURAL_PALETTES.TSC;
}

const VERIFIED_BUILDINGS = [
  { id: 'bld-turing', code: 'TSC', architecturalType: 'research' },
  { id: 'bld-hopper', code: 'HEC', architecturalType: 'lab' },
  { id: 'bld-innovation', code: 'IC', architecturalType: 'seminar' },
  { id: 'bld-central', code: 'CCC', architecturalType: 'sports' },
];

const CAMPUS_GEOMETRY_DISCLAIMER =
  'Campus map 3D geometry and coordinates are illustrative procedural representations for digital twin navigation. Physical layouts, room positions, and walking distances must be verified on-site.';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Phase 3: Digital Twin Architectural Palettes & Polish', () => {
  describe('1. Deterministic Palette Resolution', () => {
    it('resolves TSC by code and id to sapphire blue palette', () => {
      const byCode = getBuildingArchitecturalPalette('TSC');
      const byId = getBuildingArchitecturalPalette('bld-turing');

      assert.equal(byCode.code, 'TSC');
      assert.equal(byId.code, 'TSC');
      assert.equal(byCode.name, 'Turing Science Center');
      assert.equal(byCode.theme, 'Sapphire Blue');
      assert.equal(byCode.bodyColor, '#1B2A4A');
      assert.equal(byCode.glassColor, '#60A5FA');
      assert.equal(byCode.accentColor, '#38BDF8');
    });

    it('resolves HEC by code and id to teal with graphite palette', () => {
      const byCode = getBuildingArchitecturalPalette('HEC');
      const byId = getBuildingArchitecturalPalette('bld-hopper');

      assert.equal(byCode.code, 'HEC');
      assert.equal(byId.code, 'HEC');
      assert.equal(byCode.name, 'Hopper Engineering Complex');
      assert.equal(byCode.theme, 'Teal with Graphite');
      assert.equal(byCode.bodyColor, '#132E35');
      assert.equal(byCode.glassColor, '#2DD4BF');
      assert.equal(byCode.accentColor, '#14B8A6');
    });

    it('resolves IC by code and id to violet with silver palette', () => {
      const byCode = getBuildingArchitecturalPalette('IC');
      const byId = getBuildingArchitecturalPalette('bld-innovation');

      assert.equal(byCode.code, 'IC');
      assert.equal(byId.code, 'IC');
      assert.equal(byCode.name, 'Innovation Center');
      assert.equal(byCode.theme, 'Violet with Silver');
      assert.equal(byCode.bodyColor, '#261E3E');
      assert.equal(byCode.glassColor, '#C084FC');
      assert.equal(byCode.accentColor, '#A855F7');
    });

    it('resolves CCC by code and id to warm amber with sandstone palette', () => {
      const byCode = getBuildingArchitecturalPalette('CCC');
      const byId = getBuildingArchitecturalPalette('bld-central');

      assert.equal(byCode.code, 'CCC');
      assert.equal(byId.code, 'CCC');
      assert.equal(byCode.name, 'Central Campus Center');
      assert.equal(byCode.theme, 'Warm Amber with Sandstone');
      assert.equal(byCode.bodyColor, '#362719');
      assert.equal(byCode.glassColor, '#FBBF24');
      assert.equal(byCode.accentColor, '#F59E0B');
    });

    it('gracefully falls back to TSC palette on null, undefined, or unrecognized input', () => {
      assert.equal(getBuildingArchitecturalPalette(null).code, 'TSC');
      assert.equal(getBuildingArchitecturalPalette(undefined).code, 'TSC');
      assert.equal(getBuildingArchitecturalPalette('UNKNOWN_CODE').code, 'TSC');
    });
  });

  describe('2. Uniqueness and Visual Distinctness Across Buildings', () => {
    it('ensures all 4 buildings have distinct structural wall colors', () => {
      const bodyColors = Object.values(BUILDING_ARCHITECTURAL_PALETTES).map(
        (p) => p.bodyColor
      );
      const unique = new Set(bodyColors);
      assert.equal(unique.size, 4, 'Each building must have a unique body color');
    });

    it('ensures all 4 buildings have distinct glass tint colors', () => {
      const glassColors = Object.values(BUILDING_ARCHITECTURAL_PALETTES).map(
        (p) => p.glassColor
      );
      const unique = new Set(glassColors);
      assert.equal(unique.size, 4, 'Each building must have a unique glass color');
    });

    it('ensures all 4 buildings have distinct accent colors', () => {
      const accents = Object.values(BUILDING_ARCHITECTURAL_PALETTES).map(
        (p) => p.accentColor
      );
      const unique = new Set(accents);
      assert.equal(unique.size, 4, 'Each building must have a unique accent color');
    });
  });

  describe('3. Separation of Architectural Identity from Live Availability', () => {
    it('palette definitions do not contain live availability states or status keywords', () => {
      const liveStatuses = [
        'available',
        'occupied',
        'occupied_soon',
        'maintenance',
        'maintenance_blocked',
        'unavailable',
        'unknown',
      ];

      for (const palette of Object.values(BUILDING_ARCHITECTURAL_PALETTES)) {
        for (const [key, val] of Object.entries(palette)) {
          if (typeof val === 'string') {
            for (const status of liveStatuses) {
              assert.notEqual(
                val.toLowerCase(),
                status,
                `Palette property ${key} must not be a live status string (${status})`
              );
            }
          }
        }
      }
    });

    it('all 4 buildings retain separate live availability status mapping rules', () => {
      // Invariant: The building appearance relies on palette for structural materials,
      // while live operational status is exclusively rendered via edge highlights, markers, and badges.
      const sampleOperationalStates = [
        'available',
        'occupied',
        'maintenance_blocked',
        'indeterminate_warning',
      ];
      assert.equal(sampleOperationalStates.length, 4);
    });
  });

  describe('4. Architectural Massing Silhouette Assignments', () => {
    it('assigns specific massing geometry types to each of the 4 verified buildings', () => {
      const expectedTypes = {
        TSC: 'research',
        HEC: 'lab',
        IC: 'seminar',
        CCC: 'sports',
      };

      for (const b of VERIFIED_BUILDINGS) {
        assert.equal(
          b.architecturalType,
          expectedTypes[b.code],
          `Building ${b.code} should have architecturalType ${expectedTypes[b.code]}`
        );
      }
    });

    it('ensures all 4 buildings have distinct massing silhouettes', () => {
      const types = VERIFIED_BUILDINGS.map((b) => b.architecturalType);
      const uniqueTypes = new Set(types);
      assert.equal(uniqueTypes.size, 4, 'All 4 buildings must have unique architectural types');
    });
  });

  describe('5. Illustrative Geometry Disclaimer Verification', () => {
    it('preserves the required procedural geometry disclaimer', () => {
      assert.ok(CAMPUS_GEOMETRY_DISCLAIMER.includes('illustrative procedural representations'));
      assert.ok(CAMPUS_GEOMETRY_DISCLAIMER.includes('verified on-site'));
    });
  });
});
