"""
CampusFlow Architectural Digital Twin - Blender Building Generation & glTF Export
Author: Antigravity Agent
Engine: Blender 5.2.1 LTS (bpy)

Generates premium architectural 3D models for the 4 verified campus buildings:
1. TSC - Turing Science Center (Flagship Computing & Research Tower with Observatory)
2. HEC - Hopper Engineering Complex (Dual-Wing Laboratory with Central Atrium & Skylights)
3. IC  - Innovation Center (Cantilevered Contemporary Conference & Collaboration Hub)
4. CCC - Central Campus Center (Aerodynamic Curved Barrel-Vault Hall matching Reference Target)

Exports optimized glTF/GLB models to web/public/models/ and archives source .blend files.
"""

import bpy
import bmesh
import math
import os
import sys
import time

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # Ensure all existing objects/meshes/materials are purged
    for collection in bpy.data.collections:
        bpy.data.collections.remove(collection)
    for obj in bpy.data.objects:
        bpy.data.objects.remove(obj)
    for mesh in bpy.data.meshes:
        bpy.data.meshes.remove(mesh)
    for mat in bpy.data.materials:
        bpy.data.materials.remove(mat)

def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def hex_to_linear_rgb(hex_code, alpha=1.0):
    hex_code = hex_code.lstrip('#')
    r = int(hex_code[0:2], 16) / 255.0
    g = int(hex_code[2:4], 16) / 255.0
    b = int(hex_code[4:6], 16) / 255.0
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), alpha)

def create_pbr_material(name, hex_color, roughness=0.5, metallic=0.0, alpha=1.0,
                        emission_hex=None, emission_strength=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if not bsdf:
        bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
        output = nodes.get("Material Output")
        mat.node_tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])

    base_col = hex_to_linear_rgb(hex_color, alpha)
    if "Base Color" in bsdf.inputs:
        bsdf.inputs["Base Color"].default_value = base_col
    if "Roughness" in bsdf.inputs:
        bsdf.inputs["Roughness"].default_value = roughness
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = metallic
    if "Alpha" in bsdf.inputs:
        bsdf.inputs["Alpha"].default_value = alpha

    if emission_hex and emission_strength > 0:
        em_col = hex_to_linear_rgb(emission_hex, 1.0)
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = em_col
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emission_strength

    if alpha < 1.0:
        # Transparent blend in Blender
        if hasattr(mat, "blend_method"):
            mat.blend_method = "BLEND"
        if hasattr(mat, "shadow_method"):
            mat.shadow_method = "HASHED"

    return mat

def add_box(name, size, location, material=None):
    """
    Creates a box centered at location with dimensions size (w, d, h) in Blender coords (X, Y, Z).
    """
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0], size[1], size[2])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material:
        obj.data.materials.append(material)
    return obj

def add_cylinder(name, radius, height, location, rotation=(0,0,0), vertices=32, material=None):
    """
    Creates a cylinder along Z, centered at location.
    """
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=height,
        location=location,
        rotation=rotation
    )
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material:
        obj.data.materials.append(material)
    return obj

def add_sphere(name, radius, location, segments=24, ring_count=16, material=None):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=ring_count,
        radius=radius,
        location=location
    )
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material:
        obj.data.materials.append(material)
    return obj

# ════════════════════════════════════════════════════════════════════════════
# 1. BUILD TURING SCIENCE CENTER (TSC)
# ════════════════════════════════════════════════════════════════════════════
def build_tsc():
    clear_scene()
    col = bpy.data.collections.new("TSC_TuringScienceCenter")
    bpy.context.scene.collection.children.link(col)

    # Materials
    m_body = create_pbr_material("TSC_Mat_Body", "#1B2A4A", roughness=0.52, metallic=0.22)
    m_trim = create_pbr_material("TSC_Mat_Trim", "#1E293B", roughness=0.65, metallic=0.32)
    m_glass = create_pbr_material("TSC_Mat_Glass", "#60A5FA", roughness=0.08, metallic=0.85, alpha=0.82,
                                  emission_hex="#1E3A8A", emission_strength=0.3)
    m_glow = create_pbr_material("TSC_Mat_InteriorGlow", "#BFDBFE", roughness=0.3, metallic=0.1,
                                 emission_hex="#3B82F6", emission_strength=0.55)
    m_accent = create_pbr_material("TSC_Mat_Accent", "#38BDF8", roughness=0.32, metallic=0.68,
                                   emission_hex="#38BDF8", emission_strength=0.35)
    m_mullion = create_pbr_material("TSC_Mat_Mullion", "#0F172A", roughness=0.38, metallic=0.82)
    m_roof = create_pbr_material("TSC_Mat_Roof", "#0F172A", roughness=0.48, metallic=0.45)
    m_dome = create_pbr_material("TSC_Mat_Observatory", "#E2E8F0", roughness=0.26, metallic=0.72)

    # A. Ground Entrance Podium & Sub-Base
    add_box("TSC_EntrancePodium", (8.2, 9.2, 0.25), (0, 0, 0.125), m_trim)
    add_box("TSC_PodiumStairs", (6.0, 3.2, 0.12), (0, -3.8, 0.06), m_trim)

    # B. Main Research Tower (Center-North mass)
    # Footprint: 4.4 wide x 4.2 deep, height from Z=0.25 to Z=5.0
    tower_h = 4.75
    tower_z = 0.25 + tower_h / 2
    add_box("TSC_MainTower_Core", (4.2, 4.0, tower_h), (0, 0.6, tower_z), m_body)
    add_box("TSC_MainTower_GlassFacets", (4.3, 4.1, tower_h - 0.4), (0, 0.6, tower_z), m_glass)

    # Visible Floor Levels & Continuous Floor Bands (5 floors)
    for i in range(1, 6):
        fz = 0.25 + i * (tower_h / 5.0)
        add_box(f"TSC_FloorBand_{i}", (4.5, 4.3, 0.12), (0, 0.6, fz), m_trim)

    # Vertical Mullions on North and South faces
    for x_offset in [-1.8, -0.9, 0, 0.9, 1.8]:
        add_box(f"TSC_Mullion_S_{x_offset}", (0.08, 0.12, tower_h), (x_offset, -1.45, tower_z), m_mullion)
        add_box(f"TSC_Mullion_N_{x_offset}", (0.08, 0.12, tower_h), (x_offset, 2.65, tower_z), m_mullion)

    # Projecting Cantilever Research Bay on Level 4
    add_box("TSC_ProjectingBay_L4", (2.8, 0.6, 0.9), (0, -1.6, 0.25 + 3.2), m_accent)
    add_box("TSC_ProjectingBay_Glass", (2.7, 0.55, 0.8), (0, -1.6, 0.25 + 3.2), m_glass)

    # C. Glazed Ground-Floor Lobby & Structural Entrance Frame
    lobby_h = 1.6
    add_box("TSC_GlassLobby", (4.6, 2.4, lobby_h), (0, -1.8, 0.25 + lobby_h / 2), m_glass)
    add_box("TSC_LobbyInteriorGlow", (4.2, 2.0, lobby_h - 0.2), (0, -1.8, 0.25 + lobby_h / 2), m_glow)
    # Lobby structural columns
    for cx in [-2.1, -0.7, 0.7, 2.1]:
        add_box(f"TSC_LobbyCol_{cx}", (0.16, 0.16, lobby_h), (cx, -2.9, 0.25 + lobby_h / 2), m_trim)
    # Entrance Canopy
    add_box("TSC_EntranceCanopy", (4.8, 1.4, 0.14), (0, -3.2, 0.25 + lobby_h), m_accent)

    # D. Connected Lower Research Wing (West side)
    wing_w, wing_d, wing_h = 2.6, 5.2, 3.0
    wing_z = 0.25 + wing_h / 2
    add_box("TSC_ResearchWing", (wing_w, wing_d, wing_h), (-2.8, 0.2, wing_z), m_body)
    add_box("TSC_ResearchWing_RibbonGlass", (wing_w + 0.1, wing_d * 0.85, 0.6), (-2.8, 0.2, 0.25 + 1.2), m_glass)
    add_box("TSC_ResearchWing_RibbonGlass2", (wing_w + 0.1, wing_d * 0.85, 0.6), (-2.8, 0.2, 0.25 + 2.2), m_glass)
    add_box("TSC_ResearchWing_Roof", (wing_w + 0.2, wing_d + 0.2, 0.14), (-2.8, 0.2, 0.25 + wing_h), m_roof)
    # Sunshade louvers on wing
    for lz in [0.25 + 1.0, 0.25 + 1.5, 0.25 + 2.0, 0.25 + 2.5]:
        add_box(f"TSC_WingLouver_{lz}", (wing_w + 0.25, 0.08, 0.04), (-2.8, -2.45, lz), m_accent)

    # E. Rooftop Research Crown & Observatory Dome
    roof_z = 0.25 + tower_h
    add_box("TSC_RooftopCrown", (3.8, 3.6, 0.65), (0, 0.6, roof_z + 0.325), m_roof)
    add_box("TSC_CrownLouverGrid", (3.6, 3.4, 0.4), (0, 0.6, roof_z + 0.35), m_mullion)

    # Astronomical Observatory Dome
    dome_drum_z = roof_z + 0.65 + 0.2
    add_cylinder("TSC_Observatory_Drum", 0.75, 0.4, (0.8, 0.6, dome_drum_z), vertices=24, material=m_trim)
    add_sphere("TSC_Observatory_Dome", 0.74, (0.8, 0.6, dome_drum_z + 0.2), segments=24, ring_count=16, material=m_dome)
    # Slit aperture & antenna
    add_box("TSC_Observatory_Slit", (0.14, 0.9, 0.4), (0.8, 0.6, dome_drum_z + 0.4), m_mullion)
    add_cylinder("TSC_CommunicationsSpire", 0.03, 1.2, (-0.8, 0.6, roof_z + 1.25), vertices=12, material=m_accent)

    return "TSC"

# ════════════════════════════════════════════════════════════════════════════
# 2. BUILD HOPPER ENGINEERING COMPLEX (HEC)
# ════════════════════════════════════════════════════════════════════════════
def build_hec():
    clear_scene()
    col = bpy.data.collections.new("HEC_HopperEngineeringComplex")
    bpy.context.scene.collection.children.link(col)

    # Materials
    m_body = create_pbr_material("HEC_Mat_Body", "#132E35", roughness=0.55, metallic=0.25)
    m_trim = create_pbr_material("HEC_Mat_Trim", "#1A2E35", roughness=0.65, metallic=0.35)
    m_glass = create_pbr_material("HEC_Mat_Glass", "#2DD4BF", roughness=0.08, metallic=0.82, alpha=0.82,
                                  emission_hex="#115E59", emission_strength=0.32)
    m_glow = create_pbr_material("HEC_Mat_InteriorGlow", "#CCFBF1", roughness=0.32, metallic=0.1,
                                 emission_hex="#14B8A6", emission_strength=0.52)
    m_accent = create_pbr_material("HEC_Mat_Accent", "#14B8A6", roughness=0.3, metallic=0.65,
                                   emission_hex="#14B8A6", emission_strength=0.35)
    m_mullion = create_pbr_material("HEC_Mat_Mullion", "#0B1D22", roughness=0.4, metallic=0.8)
    m_roof = create_pbr_material("HEC_Mat_Roof", "#0B1D22", roughness=0.5, metallic=0.42)

    # A. Foundation Plinth
    add_box("HEC_Plinth", (8.2, 8.6, 0.25), (0, 0, 0.125), m_trim)

    # B. West Wing (Heavy Engineering & Computing Labs)
    # 3 floors, height 4.2m
    ww_w, ww_d, ww_h = 2.8, 6.8, 4.2
    ww_z = 0.25 + ww_h / 2
    add_box("HEC_WestWing", (ww_w, ww_d, ww_h), (-2.2, 0, ww_z), m_body)
    # Repeated Ribbon Windows
    for floor_i in [1, 2, 3]:
        fz = 0.25 + (floor_i - 0.5) * (ww_h / 3.0)
        add_box(f"HEC_WW_RibbonGlass_{floor_i}", (ww_w + 0.08, ww_d * 0.88, 0.65), (-2.2, 0, fz), m_glass)
        add_box(f"HEC_WW_RibbonTrim_{floor_i}", (ww_w + 0.12, ww_d * 0.9, 0.1), (-2.2, 0, fz + 0.35), m_trim)
    add_box("HEC_WW_RoofSlab", (ww_w + 0.2, ww_d + 0.2, 0.15), (-2.2, 0, 0.25 + ww_h), m_roof)

    # Rooftop MEP Ventilation Plant & Industrial Louvers
    add_box("HEC_RooftopVentPlant_Unit1", (1.4, 2.2, 0.85), (-2.2, -1.2, 0.25 + ww_h + 0.45), m_trim)
    add_box("HEC_RooftopVentPlant_Unit2", (1.2, 1.8, 0.7), (-2.2, 1.4, 0.25 + ww_h + 0.38), m_mullion)
    add_box("HEC_VentPlant_LouverScreen", (1.6, 4.4, 0.9), (-2.2, 0.1, 0.25 + ww_h + 0.48), m_accent)

    # C. East Wing (Advanced Robotics & Prototyping)
    # 4 floors, height 5.2m
    ew_w, ew_d, ew_h = 2.8, 6.2, 5.0
    ew_z = 0.25 + ew_h / 2
    add_box("HEC_EastWing", (ew_w, ew_d, ew_h), (2.2, 0, ew_z), m_body)
    for floor_i in [1, 2, 3, 4]:
        fz = 0.25 + (floor_i - 0.5) * (ew_h / 4.0)
        add_box(f"HEC_EW_RibbonGlass_{floor_i}", (ew_w + 0.08, ew_d * 0.85, 0.55), (2.2, 0, fz), m_glass)
    add_box("HEC_EW_RoofSlab", (ew_w + 0.2, ew_d + 0.2, 0.15), (2.2, 0, 0.25 + ew_h), m_roof)

    # Industrial Sawtooth Roof Skylights on East Wing
    for s_idx, sy in enumerate([-1.8, -0.6, 0.6, 1.8]):
        # Angled sawtooth wedge: box rotated
        skylight = add_box(f"HEC_SawtoothSkylight_{s_idx}", (2.2, 0.8, 0.4), (2.2, sy, 0.25 + ew_h + 0.25), m_trim)
        add_box(f"HEC_SawtoothGlass_{s_idx}", (2.0, 0.7, 0.3), (2.2, sy, 0.25 + ew_h + 0.25), m_glass)

    # D. Central Multi-Story Glazed Atrium
    atrium_w, atrium_d, atrium_h = 1.8, 5.4, 4.6
    atrium_z = 0.25 + atrium_h / 2
    add_box("HEC_CentralAtrium_Glass", (atrium_w, atrium_d, atrium_h), (0, 0, atrium_z), m_glass)
    add_box("HEC_CentralAtrium_Glow", (atrium_w - 0.3, atrium_d - 0.4, atrium_h - 0.4), (0, 0, atrium_z), m_glow)

    # Interior Skybridges connecting West & East wings at Level 2 and Level 3
    add_box("HEC_Skybridge_L2", (3.6, 1.2, 0.6), (0, -0.8, 0.25 + 1.8), m_trim)
    add_box("HEC_Skybridge_L3", (3.6, 1.2, 0.6), (0, 0.8, 0.25 + 3.2), m_trim)

    # Visible Structural Exoskeleton Columns on front facade
    for col_x in [-0.8, 0.8]:
        add_box(f"HEC_ExoskeletonCol_{col_x}", (0.14, 0.14, atrium_h), (col_x, -atrium_d / 2 - 0.05, atrium_z), m_accent)
    add_box("HEC_ExoskeletonBeam_Top", (atrium_w + 0.4, 0.14, 0.18), (0, -atrium_d / 2 - 0.05, 0.25 + atrium_h), m_accent)

    # E. Ground Concourse & Recessed Entrance Canopy
    add_box("HEC_GroundConcourse", (atrium_w + 1.0, 2.0, 1.4), (0, -atrium_d / 2 - 0.6, 0.25 + 0.7), m_body)
    add_box("HEC_EntrancePortalGlass", (atrium_w, 0.1, 1.1), (0, -atrium_d / 2 - 1.55, 0.25 + 0.6), m_glass)
    add_box("HEC_EntranceCanopy", (atrium_w + 1.2, 1.6, 0.14), (0, -atrium_d / 2 - 1.2, 0.25 + 1.45), m_accent)

    return "HEC"

# ════════════════════════════════════════════════════════════════════════════
# 3. BUILD INNOVATION CENTER (IC)
# ════════════════════════════════════════════════════════════════════════════
def build_ic():
    clear_scene()
    col = bpy.data.collections.new("IC_InnovationCenter")
    bpy.context.scene.collection.children.link(col)

    # Materials
    m_body = create_pbr_material("IC_Mat_Body", "#261E3E", roughness=0.52, metallic=0.22)
    m_trim = create_pbr_material("IC_Mat_Trim", "#2E244A", roughness=0.62, metallic=0.32)
    m_glass = create_pbr_material("IC_Mat_Glass", "#C084FC", roughness=0.08, metallic=0.85, alpha=0.82,
                                  emission_hex="#581C87", emission_strength=0.35)
    m_glow = create_pbr_material("IC_Mat_InteriorGlow", "#E9D5FF", roughness=0.3, metallic=0.1,
                                 emission_hex="#A855F7", emission_strength=0.5)
    m_accent = create_pbr_material("IC_Mat_Accent", "#A855F7", roughness=0.28, metallic=0.7,
                                   emission_hex="#A855F7", emission_strength=0.38)
    m_roof = create_pbr_material("IC_Mat_Roof", "#171226", roughness=0.48, metallic=0.45)
    m_mullion = create_pbr_material("IC_Mat_Mullion", "#1E1830", roughness=0.35, metallic=0.8)

    # A. Foundation Base & Lower Gallery
    add_box("IC_BasePlinth", (7.2, 8.4, 0.25), (0, 0, 0.125), m_trim)

    # Ground-level Incubator Gallery (recessed mass, X = -0.5, Y = -0.4)
    low_w, low_d, low_h = 4.8, 5.8, 1.8
    low_z = 0.25 + low_h / 2
    add_box("IC_LowerGallery", (low_w, low_d, low_h), (-0.5, -0.4, low_z), m_body)
    add_box("IC_LowerGallery_Glass", (low_w + 0.08, 1.8, low_h - 0.4), (-0.5, -2.2, low_z), m_glass)
    add_box("IC_LowerGallery_Glow", (low_w - 0.4, 1.6, low_h - 0.6), (-0.5, -2.2, low_z), m_glow)

    # B. DRAMATIC CANTILEVERED UPPER FLOOR (Executive Tier)
    # Upper floor projects 1.4m forward and 1.2m to the east over the lower gallery!
    cant_w, cant_d, cant_h = 5.6, 6.4, 1.9
    cant_x, cant_y = 0.5, 0.4
    cant_z = 0.25 + low_h + cant_h / 2
    add_box("IC_CantileverVolume", (cant_w, cant_d, cant_h), (cant_x, cant_y, cant_z), m_body)

    # Large Glazed Corners on the projecting South-East corner
    # Wraparound curtain glass
    add_box("IC_GlazedCorner_South", (3.2, 0.12, cant_h - 0.3), (cant_x + 1.1, cant_y - cant_d / 2 + 0.05, cant_z), m_glass)
    add_box("IC_GlazedCorner_East", (0.12, 3.4, cant_h - 0.3), (cant_x + cant_w / 2 - 0.05, cant_y - 1.2, cant_z), m_glass)
    add_box("IC_Cantilever_InteriorGlow", (2.8, 2.8, cant_h - 0.5), (cant_x + 1.0, cant_y - 1.2, cant_z), m_glow)

    # Visible Structural Supporting V-Columns Anchoring Cantilever
    for v_col_x in [1.8, 2.8]:
        add_cylinder(f"IC_CantileverColumn_{v_col_x}", 0.12, low_h, (v_col_x, -2.2, 0.25 + low_h / 2), vertices=16, material=m_accent)

    # Architectural Sunshade Fins along Southern Glazing
    for fx in [-0.8, -0.2, 0.4, 1.0, 1.6, 2.2]:
        add_box(f"IC_SunshadeFin_{fx}", (0.05, 0.35, cant_h), (fx, cant_y - cant_d / 2 - 0.12, cant_z), m_accent)

    # C. Layered Floating Thin Roof Slabs & Terrace Collaboration Pavilion
    roof_slab_z = 0.25 + low_h + cant_h
    add_box("IC_LayeredRoofSlab_1", (cant_w + 0.5, cant_d + 0.5, 0.16), (cant_x, cant_y, roof_slab_z + 0.08), m_roof)
    add_box("IC_LayeredRoofSlab_2", (cant_w + 0.7, cant_d + 0.7, 0.08), (cant_x, cant_y, roof_slab_z + 0.18), m_accent)

    # Rooftop Pavilion Pod
    add_box("IC_RooftopPavilion", (2.8, 3.2, 0.85), (cant_x - 0.6, cant_y + 0.8, roof_slab_z + 0.6), m_body)
    add_box("IC_RooftopPavilion_Clerestory", (2.9, 3.3, 0.25), (cant_x - 0.6, cant_y + 0.8, roof_slab_z + 0.85), m_glass)
    add_box("IC_PavilionRoofSlab", (3.2, 3.6, 0.1), (cant_x - 0.6, cant_y + 0.8, roof_slab_z + 1.05), m_roof)

    return "IC"

# ════════════════════════════════════════════════════════════════════════════
# 4. BUILD CENTRAL CAMPUS CENTER (CCC) - Match Architectural Target Image
# ════════════════════════════════════════════════════════════════════════════
def build_ccc():
    clear_scene()
    col = bpy.data.collections.new("CCC_CentralCampusCenter")
    bpy.context.scene.collection.children.link(col)

    # Materials
    m_body = create_pbr_material("CCC_Mat_Body", "#806044", roughness=0.64, metallic=0.12)
    m_trim = create_pbr_material("CCC_Mat_Trim", "#B18A62", roughness=0.58, metallic=0.2)
    m_glass = create_pbr_material("CCC_Mat_Glass", "#B79A71", roughness=0.16, metallic=0.35, alpha=0.88,
                                  emission_hex="#8A5A2B", emission_strength=0.16)
    m_glow = create_pbr_material("CCC_Mat_InteriorGlow", "#FEF08A", roughness=0.25, metallic=0.1,
                                 emission_hex="#F59E0B", emission_strength=0.62)
    m_canopy = create_pbr_material("CCC_Mat_CanopyShell", "#8C6A48", roughness=0.35, metallic=0.6)
    m_accent = create_pbr_material("CCC_Mat_Accent", "#B38A58", roughness=0.34, metallic=0.58)
    m_roof = create_pbr_material("CCC_Mat_Roof", "#4A3B2C", roughness=0.48, metallic=0.38)
    m_skylight = create_pbr_material("CCC_Mat_SkylightGlow", "#FEF08A", roughness=0.2, metallic=0.1,
                                     emission_hex="#F59E0B", emission_strength=0.85)

    # A. Layered Stepped Sandstone Plinth
    add_box("CCC_SteppedPlinth_L1", (9.2, 8.2, 0.2), (0, 0, 0.1), m_body)
    add_box("CCC_SteppedPlinth_L2", (8.8, 7.8, 0.15), (0, 0, 0.275), m_trim)

    # B. Assembly Hall Internal Volume & Glowing Interior Core
    hall_w, hall_d, hall_h = 7.6, 6.2, 2.5
    hall_z = 0.35 + hall_h / 2
    add_box("CCC_AssemblyHall_Walls", (hall_w, hall_d, hall_h), (0, 0, hall_z), m_body)
    add_box("CCC_InteriorGlow_Core", (hall_w - 0.6, hall_d - 0.8, hall_h - 0.4), (0, 0, hall_z), m_glow)

    # C. Double-Height Front Curved Glass Curtain Wall
    add_box("CCC_CurvedFacadeGlass", (hall_w + 0.2, 0.15, hall_h), (0, -hall_d / 2 - 0.05, hall_z), m_glass)

    # Repeated Angled Diagrid Support Columns across Front Facade (7 columns)
    for col_i, col_x in enumerate([-3.2, -2.1, -1.0, 0, 1.0, 2.1, 3.2]):
        angle = (col_i - 3) * 0.04
        # Add column with slight rotation for diagrid aesthetic
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=16,
            radius=0.08,
            depth=hall_h + 0.2,
            location=(col_x, -hall_d / 2 - 0.12, hall_z),
            rotation=(0, angle, 0)
        )
        col_obj = bpy.context.active_object
        col_obj.name = f"CCC_DiagridCol_{col_i}"
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        col_obj.data.materials.append(m_accent)

    # D. SIGNATURE AERODYNAMIC BARREL-VAULT CURVED CANOPY ROOF
    # Sweep concentric arch profiles along X so the shell, ends, and ribs share
    # one continuous curvature instead of reading as disconnected roof fins.
    vault_radius = (hall_d / 2) * 1.04
    vault_length = hall_w * 1.15
    vault_center_y = 0.2
    vault_center_z = 0.35 + hall_h

    def add_arch_strip(name, x_start, x_end, outer_radius, inner_radius, material, segments=32):
        verts = []
        faces = []
        for x in (x_start, x_end):
            for radius in (outer_radius, inner_radius):
                for idx in range(segments + 1):
                    theta = -math.pi / 2 + math.pi * idx / segments
                    verts.append((
                        x,
                        vault_center_y + radius * math.sin(theta),
                        vault_center_z + radius * math.cos(theta),
                    ))
        ring = segments + 1
        for idx in range(segments):
            # Outer and inner curved surfaces
            faces.append((idx, idx + 1, 2 * ring + idx + 1, 2 * ring + idx))
            faces.append((ring + idx, 3 * ring + idx, 3 * ring + idx + 1, ring + idx + 1))
            # End caps
            faces.append((idx, ring + idx, ring + idx + 1, idx + 1))
            faces.append((2 * ring + idx, 2 * ring + idx + 1, 3 * ring + idx + 1, 3 * ring + idx))
        mesh = bpy.data.meshes.new(name + "_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.materials.append(material)
        obj = bpy.data.objects.new(name, mesh)
        col.objects.link(obj)
        for poly in mesh.polygons:
            poly.use_smooth = True
        return obj

    add_arch_strip(
        "CCC_BarrelVault_Shell",
        -vault_length / 2,
        vault_length / 2,
        vault_radius + 0.12,
        vault_radius - 0.12,
        m_canopy,
    )

    # Close both barrel ends with glazed gable walls so the vault reads as a
    # complete building envelope from every camera angle.
    def add_arch_gable(name, x, radius, thickness, material):
        outline = [
            (vault_center_y - radius, vault_center_z),
        ]
        for idx in range(25):
            theta = -math.pi / 2 + math.pi * idx / 24
            outline.append((
                vault_center_y + radius * math.sin(theta),
                vault_center_z + radius * math.cos(theta),
            ))
        outline.append((vault_center_y + radius, vault_center_z))

        verts = []
        for x_offset in (-thickness / 2, thickness / 2):
            verts.extend((x + x_offset, y, z) for y, z in outline)
        count = len(outline)
        faces = [
            tuple(range(count)),
            tuple(range(count, count * 2)),
        ]
        for idx in range(count):
            next_idx = (idx + 1) % count
            faces.append((idx, next_idx, count + next_idx, count + idx))

        mesh = bpy.data.meshes.new(name + "_Mesh")
        mesh.from_pydata(verts, [], faces)
        mesh.materials.append(material)
        obj = bpy.data.objects.new(name, mesh)
        col.objects.link(obj)
        for poly in mesh.polygons:
            poly.use_smooth = False
        return obj

    for end_idx, end_x in enumerate((-vault_length / 2 + 0.08, vault_length / 2 - 0.08)):
        add_arch_gable(
            f"CCC_GlazedEndGable_{end_idx}",
            end_x,
            vault_radius - 0.18,
            0.1,
            m_glass,
        )
        add_arch_strip(
            f"CCC_EndGableFrame_{end_idx}",
            end_x - 0.09,
            end_x + 0.09,
            vault_radius + 0.02,
            vault_radius - 0.1,
            m_accent,
            segments=24,
        )

    # Solid Ceiling Soffit Slab (Encloses underside so roof has authentic 3D thickness)
    add_box("CCC_CeilingSoffitSlab", (vault_length, hall_d * 1.12, 0.2), (0, 0.2, vault_center_z + 0.1), m_roof)

    # Radiant Skylight Spine along Apex Ridge (Glowing spine in reference photo)
    add_box("CCC_SkylightSpine", (vault_length * 0.78, 0.24, 0.1), (0, vault_center_y, vault_center_z + vault_radius + 0.08), m_skylight)

    # Cantilevered Aerodynamic Visor Brow Overhang
    add_box("CCC_CanopyVisor", (vault_length * 1.02, 0.32, 0.14), (0, -hall_d / 2 - 0.22, vault_center_z + 0.18), m_accent)

    # Restrained structural ribs follow the same arch as the shell.
    for r_idx, rx in enumerate([-3.2, -1.6, 0, 1.6, 3.2]):
        add_arch_strip(
            f"CCC_RoofRib_{r_idx}",
            rx - 0.055,
            rx + 0.055,
            vault_radius + 0.2,
            vault_radius + 0.07,
            m_accent,
            segments=24,
        )

    # E. Grand Entrance Portal & Cathedral Doors
    add_box("CCC_MainEntrancePortal", (3.6, 0.5, 1.5), (0, -hall_d / 2 - 0.35, 0.35 + 0.75), m_body)
    add_box("CCC_CathedralDoors", (2.8, 0.1, 1.2), (0, -hall_d / 2 - 0.55, 0.35 + 0.6), m_glass)
    add_box("CCC_EntranceCornice", (4.0, 0.65, 0.16), (0, -hall_d / 2 - 0.35, 0.35 + 1.58), m_accent)

    return "CCC"

# ════════════════════════════════════════════════════════════════════════════
# EXPORT PIPELINE
# ════════════════════════════════════════════════════════════════════════════
def export_building(code, output_dir, blend_dir):
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(blend_dir, exist_ok=True)

    glb_filename = f"{code.lower()}.glb"
    blend_filename = f"{code.lower()}.blend"
    glb_path = os.path.join(output_dir, glb_filename)
    blend_path = os.path.join(blend_dir, blend_filename)

    # Calculate statistics
    mesh_objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    total_verts = sum(len(o.data.vertices) for o in mesh_objects)
    total_polys = sum(len(o.data.polygons) for o in mesh_objects)
    total_tris = sum(len(o.data.loop_triangles) if hasattr(o.data, "loop_triangles") and len(o.data.loop_triangles) > 0 else len(o.data.polygons) * 2 for o in mesh_objects)

    # Save .blend file
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)

    # Export glTF 2.0 (GLB)
    t0 = time.time()
    bpy.ops.export_scene.gltf(
        filepath=glb_path,
        export_format='GLB',
        export_apply=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_materials='EXPORT',
        export_normals=True
    )
    duration = time.time() - t0
    file_size_kb = os.path.getsize(glb_path) / 1024.0

    print(f"[{code}] EXPORT COMPLETE:")
    print(f"  - GLB File: {glb_path} ({file_size_kb:.1f} KB)")
    print(f"  - Blend File: {blend_path}")
    print(f"  - Meshes: {len(mesh_objects)} objects")
    print(f"  - Vertices: {total_verts}")
    print(f"  - Polygons: {total_polys} (~{total_tris} triangles)")
    print(f"  - Export Time: {duration:.2f}s")
    return {
        "code": code,
        "glb": glb_path,
        "blend": blend_path,
        "size_kb": file_size_kb,
        "objects": len(mesh_objects),
        "vertices": total_verts,
        "polygons": total_polys,
        "triangles": total_tris,
        "duration": duration
    }

def main():
    # File is in <project_root>/scripts/blender/generate_campus_buildings.py
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(os.path.dirname(script_dir))
    output_dir = os.path.join(root_dir, "web", "public", "models")
    blend_dir = os.path.join(root_dir, "models", "blend")

    print(f"Starting Blender Architectural Asset Generation...")
    print(f"Blender Version: {bpy.app.version_string}")
    print(f"Target Output: {output_dir}")

    results = []

    # 1. TSC
    build_tsc()
    results.append(export_building("TSC", output_dir, blend_dir))

    # 2. HEC
    build_hec()
    results.append(export_building("HEC", output_dir, blend_dir))

    # 3. IC
    build_ic()
    results.append(export_building("IC", output_dir, blend_dir))

    # 4. CCC
    build_ccc()
    results.append(export_building("CCC", output_dir, blend_dir))

    print("\n═══════════════════════════════════════════════════════════")
    print("ALL 4 CAMPUS BUILDINGS GENERATED & EXPORTED SUCCESSFULLY")
    print("═══════════════════════════════════════════════════════════")
    for r in results:
        print(f"{r['code']}: {r['triangles']} tris, {r['objects']} objs, {r['size_kb']:.1f} KB -> {r['glb']}")

if __name__ == "__main__":
    main()
