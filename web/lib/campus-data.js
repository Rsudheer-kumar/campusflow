/**
 * CampusFlow - Campus Digital Twin Data & Architectural Identity Palettes
 *
 * Authoritative campus building catalogue aligned with verified database entities.
 *
 * DISCLAIMER:
 * 3D positions, dimensions, and visual meshes are illustrative procedural representations
 * for spatial exploration. Real-world indoor navigation, CAD floorplans, and walking distances
 * require verified geospatial survey data.
 */

export const CAMPUS_GEOMETRY_DISCLAIMER =
  "Campus map 3D geometry and coordinates are illustrative procedural representations for digital twin navigation. Physical layouts, room positions, and walking distances must be verified on-site.";

/**
 * Coordinated architectural color palettes for each verified building.
 *
 * Palette Assignments:
 * - Turing Science Center (TSC): Sapphire blue with cool glass accents
 * - Hopper Engineering Complex (HEC): Teal with graphite accents
 * - Innovation Center (IC): Violet with silver accents
 * - Central Campus Center (CCC): Warm amber with sandstone accents
 *
 * IMPORTANT DESIGN INVARIANT:
 * Architectural identity colors identify the physical structure and are strictly
 * decoupled from live operational availability states (represented by resource markers,
 * edge highlights, and status badges).
 */
export const BUILDING_ARCHITECTURAL_PALETTES = Object.freeze({
  TSC: Object.freeze({
    code: "TSC",
    id: "bld-turing",
    name: "Turing Science Center",
    theme: "Sapphire Blue",
    architecturalStyle: "Flagship Research Tower & Computing Lab",
    // 3D Three.js Material Colors
    bodyColor: "#1B2A4A",         // Deep sapphire slate for structural walls
    selectedBodyColor: "#243B6B", // Lifted sapphire upon selection
    glassColor: "#60A5FA",        // Cool sapphire reflective glass
    glassEmissive: "#1E3A8A",     // Subtle interior luminescence
    glassOpacity: 0.8,
    roofColor: "#0F172A",         // Dark obsidian-slate tech crown
    accentColor: "#38BDF8",       // Bright sapphire/cyan canopy and louvers
    trimColor: "#1E293B",         // Graphite framing
    // 2D Accessible UI tokens
    primaryHex: "#3B82F6",
    badgeClass: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
    borderClass: "border-blue-500/40",
    textClass: "text-blue-400",
    chipBg: "bg-blue-500/10",
  }),
  HEC: Object.freeze({
    code: "HEC",
    id: "bld-hopper",
    name: "Hopper Engineering Complex",
    theme: "Teal with Graphite",
    architecturalStyle: "Multi-tier Engineering & Technical Atrium",
    // 3D Three.js Material Colors
    bodyColor: "#132E35",         // Deep teal-graphite walls
    selectedBodyColor: "#1B434D", // Lifted teal upon selection
    glassColor: "#2DD4BF",        // Cool cyan/teal glass ribbons
    glassEmissive: "#115E59",     // Subtle teal interior luminescence
    glassOpacity: 0.8,
    roofColor: "#0B1D22",         // Dark graphite-teal industrial roof
    accentColor: "#14B8A6",       // Crisp teal entrance canopy & ventilation fins
    trimColor: "#1A2E35",         // Graphite framing
    // 2D Accessible UI tokens
    primaryHex: "#14B8A6",
    badgeClass: "bg-teal-500/15 text-teal-300 border border-teal-500/30",
    borderClass: "border-teal-500/40",
    textClass: "text-teal-400",
    chipBg: "bg-teal-500/10",
  }),
  IC: Object.freeze({
    code: "IC",
    id: "bld-innovation",
    name: "Innovation Center",
    theme: "Violet with Silver",
    architecturalStyle: "Contemporary Conference Center & Atrium",
    // 3D Three.js Material Colors
    bodyColor: "#261E3E",         // Rich violet-slate walls
    selectedBodyColor: "#392D5E", // Lifted violet upon selection
    glassColor: "#C084FC",        // Violet/silver crystalline glass
    glassEmissive: "#581C87",     // Subtle violet interior glow
    glassOpacity: 0.8,
    roofColor: "#171226",         // Dark violet-carbon sloped roof
    accentColor: "#A855F7",       // Silver-violet canopy & architectural mullions
    trimColor: "#2E244A",         // Silver-graphite framing
    // 2D Accessible UI tokens
    primaryHex: "#A855F7",
    badgeClass: "bg-purple-500/15 text-purple-300 border border-purple-500/30",
    borderClass: "border-purple-500/40",
    textClass: "text-purple-400",
    chipBg: "bg-purple-500/10",
  }),
  CCC: Object.freeze({
    code: "CCC",
    id: "bld-central",
    name: "Central Campus Center",
    theme: "Warm Amber with Sandstone",
    architecturalStyle: "Civic University Assembly Hall & Barrel Vault",
    // 3D Three.js Material Colors
    bodyColor: "#362719",         // Warm sandstone-amber masonry
    selectedBodyColor: "#4D3723", // Lifted warm sandstone upon selection
    glassColor: "#FBBF24",        // Warm amber cathedral glass
    glassEmissive: "#78350F",     // Warm lantern luminescence
    glassOpacity: 0.8,
    roofColor: "#1F160E",         // Dark roasted sandstone barrel roof
    accentColor: "#F59E0B",       // Sandstone trim & grand arch cap
    trimColor: "#3B2A1C",         // Warm sandstone framing
    // 2D Accessible UI tokens
    primaryHex: "#F59E0B",
    badgeClass: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    borderClass: "border-amber-500/40",
    textClass: "text-amber-400",
    chipBg: "bg-amber-500/10",
  }),
});

/**
 * Returns the architectural color palette for a building by its code or ID.
 *
 * @param {string} codeOrId - Building code (e.g. "TSC") or ID (e.g. "bld-turing").
 * @returns {typeof BUILDING_ARCHITECTURAL_PALETTES.TSC} Architectural palette definition.
 */
export function getBuildingArchitecturalPalette(codeOrId) {
  if (!codeOrId) return BUILDING_ARCHITECTURAL_PALETTES.TSC;
  if (BUILDING_ARCHITECTURAL_PALETTES[codeOrId]) {
    return BUILDING_ARCHITECTURAL_PALETTES[codeOrId];
  }
  const byId = Object.values(BUILDING_ARCHITECTURAL_PALETTES).find(
    (p) => p.id === codeOrId
  );
  return byId || BUILDING_ARCHITECTURAL_PALETTES.TSC;
}

export const VERIFIED_CAMPUS_BUILDINGS = [
  {
    id: "bld-turing",
    name: "Turing Science Center",
    code: "TSC",
    campus: "North Campus",
    floors: 3,
    architecturalType: "research",
    description:
      "Flagship computing and advanced computer science research facility with high-capacity lecture theaters and specialized GPU laboratories.",
    // Procedural 3D scene placement (illustrative)
    position: [-9, 2.5, -4],
    size: [7.5, 5, 8.5],
    accentColor: "#3B82F6",
    resources: [
      { code: "LH-101", name: "Turing Lecture Hall", floor: "1", roomNumber: "101", capacity: 120, type: "Lecture Hall" },
      { code: "LAB-301", name: "AI & Robotics Laboratory", floor: "3", roomNumber: "301", capacity: 45, type: "Computer Laboratory" },
      { code: "LAB-302", name: "Systems & Networks Laboratory", floor: "3", roomNumber: "302", capacity: 40, type: "Computer Laboratory" },
    ],
  },
  {
    id: "bld-hopper",
    name: "Hopper Engineering Complex",
    code: "HEC",
    campus: "North Campus",
    floors: 4,
    architecturalType: "lab",
    description:
      "Multi-disciplinary engineering center housing advanced lecture auditoriums and technical experimentation spaces.",
    // Procedural 3D scene placement (illustrative)
    position: [8, 3, -4.5],
    size: [7.5, 6, 8],
    accentColor: "#14B8A6",
    resources: [
      { code: "LH-102", name: "Hopper Lecture Hall", floor: "1", roomNumber: "102", capacity: 80, type: "Lecture Hall" },
    ],
  },
  {
    id: "bld-innovation",
    name: "Innovation Center",
    code: "IC",
    campus: "Central Campus",
    floors: 2,
    architecturalType: "seminar",
    description:
      "Collaborative hub for departmental symposia, executive presentations, and hybrid videoconferencing.",
    // Procedural 3D scene placement (illustrative)
    position: [7, 2, 6.5],
    size: [6.5, 4, 8],
    accentColor: "#A855F7",
    resources: [
      { code: "SEM-204", name: "Executive Seminar Room", floor: "2", roomNumber: "204", capacity: 25, type: "Seminar Room" },
    ],
  },
  {
    id: "bld-central",
    name: "Central Campus Center",
    code: "CCC",
    campus: "Central Campus",
    floors: 2,
    architecturalType: "sports",
    description:
      "Grand university hall designed for institutional assemblies, academic convocations, and guest lectures.",
    // Procedural 3D scene placement (illustrative)
    position: [-7.5, 2.2, 6],
    size: [8.5, 4.4, 7.5],
    accentColor: "#F59E0B",
    resources: [
      { code: "AUD-MAIN", name: "Main Campus Auditorium", floor: "1", roomNumber: "1", capacity: 500, type: "Auditorium" },
    ],
  },
];
