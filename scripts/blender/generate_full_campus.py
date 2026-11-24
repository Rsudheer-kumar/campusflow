"""
CampusFlow Architectural Digital Twin - Full Unified Campus Scene Generator
Author: Antigravity Agent
Engine: Blender 5.2.1 LTS (bpy)

Generates the complete 3D digital twin of CampusFlow in ONE unified file:
- Master Plinth Terrain & Sub-base Foundation
- Campus Road & Pedestrian Promenade Network with Central Plaza & Cross Paths
- Landscaped Campus Lawn Grass Islands
- Stylized Low-Poly Campus Evergreen Trees & Planters
- Pathway Illumination Light Bollards with Warm Emissive Glow Caps
- Architectural Studio & Sun Lighting Setup (Key Sun, Sky Fill, Ambient)
- Isometric Bird's-Eye View Camera
- All 4 Verified Campus Buildings positioned in their real spatial coordinates:
    1. TSC - Turing Science Center (North-West Computing Tower & Observatory)
    2. HEC - Hopper Engineering Complex (North-East Dual-Wing Lab & Atrium)
    3. IC  - Innovation Center (South-East Contemporary Cantilever Hub)
    4. CCC - Central Campus Center (South-West Aerodynamic Barrel-Vault Hall)

Outputs:
- models/blend/campus_full.blend (Complete editable Blender 3D scene)
- web/public/models/campus_full.glb (Optimized unified glTF asset for WebGL)
"""

import bpy
import bmesh
import math
import os
import sys
import time

# ════════════════════════════════════════════════════════════════════════════
# SCENE MANAGEMENT & UTILITIES
# ════════════════════════════════════════════════════════════════════════════

def clear_scene():
    """Safely purges all objects, collections, meshes, and materials without destroying GUI context."""
    if hasattr(bpy.context, "mode") and bpy.context.mode != "OBJECT":
        try:
            bpy.ops.object.mode_set(mode="OBJECT")
        except Exception:
            pass

    scene = bpy.context.scene if hasattr(bpy.context, "scene") and bpy.context.scene else (bpy.data.scenes[0] if bpy.data.scenes else bpy.data.scenes.new("Scene"))

    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

    for collection in list(bpy.data.collections):
        bpy.data.collections.remove(collection, do_unlink=True)

    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh, do_unlink=True)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat, do_unlink=True)
    for curve in list(bpy.data.curves):
        bpy.data.curves.remove(curve, do_unlink=True)
    for light in list(bpy.data.lights):
        bpy.data.lights.remove(light, do_unlink=True)
    for cam in list(bpy.data.cameras):
        bpy.data.cameras.remove(cam, do_unlink=True)

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
    if name in bpy.data.materials:
        return bpy.data.materials[name]

    mat = bpy.data.materials.new(name=name)
    if hasattr(mat, "use_nodes"):
        try:
            mat.use_nodes = True
        except Exception:
            pass
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
        if hasattr(mat, "blend_method"):
            mat.blend_method = "BLEND"
        if hasattr(mat, "shadow_method"):
            mat.shadow_method = "HASHED"

    return mat

def get_active_object():
    """Safely retrieves the active object across all Blender versions and GUI/headless contexts."""
    try:
        if hasattr(bpy.context, "view_layer") and hasattr(bpy.context.view_layer.objects, "active"):
            if bpy.context.view_layer.objects.active:
                return bpy.context.view_layer.objects.active
    except Exception:
        pass
    try:
        if hasattr(bpy.context, "active_object") and bpy.context.active_object:
            return bpy.context.active_object
    except Exception:
        pass
    try:
        if hasattr(bpy.context, "selected_objects") and bpy.context.selected_objects:
            return bpy.context.selected_objects[0]
    except Exception:
        pass
    return None

def link_to_collection(obj, col):
    """Ensures object is linked to the specified collection and unlinked from scene root."""
    if not obj or not col:
        return
    if obj.name not in col.objects:
        col.objects.link(obj)
    # Unlink from scene root collection if present
    scene_col = bpy.context.scene.collection
    if col != scene_col and obj.name in scene_col.objects:
        try:
            scene_col.objects.unlink(obj)
        except Exception:
            pass

def add_box(name, size, location, material=None, offset=(0,0,0), col=None):
    """Creates a box centered at location+offset with dimensions size (w, d, h) in Blender coords."""
    actual_loc = (location[0] + offset[0], location[1] + offset[1], location[2] + offset[2])
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=actual_loc)
    obj = get_active_object()
    if obj:
        obj.name = name
        obj.scale = (size[0], size[1], size[2])
        if hasattr(bpy.context, "view_layer"):
            bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        try:
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        except Exception:
            pass
        if material:
            obj.data.materials.append(material)
        if col:
            link_to_collection(obj, col)
    return obj

def add_cylinder(name, radius, height, location, rotation=(0,0,0), vertices=32, material=None, offset=(0,0,0), col=None):
    """Creates a cylinder along Z, centered at location+offset."""
    actual_loc = (location[0] + offset[0], location[1] + offset[1], location[2] + offset[2])
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=height,
        location=actual_loc,
        rotation=rotation
    )
    obj = get_active_object()
    if obj:
        obj.name = name
        if hasattr(bpy.context, "view_layer"):
            bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        try:
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        except Exception:
            pass
        if material:
            obj.data.materials.append(material)
        if col:
            link_to_collection(obj, col)
    return obj

def add_cone(name, radius1, radius2, height, location, rotation=(0,0,0), vertices=16, material=None, offset=(0,0,0), col=None):
    """Creates a cone/truncated cone centered at location+offset."""
    actual_loc = (location[0] + offset[0], location[1] + offset[1], location[2] + offset[2])
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius1,
        radius2=radius2,
        depth=height,
        location=actual_loc,
        rotation=rotation
    )
    obj = get_active_object()
    if obj:
        obj.name = name
        if hasattr(bpy.context, "view_layer"):
            bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        try:
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        except Exception:
            pass
        if material:
            obj.data.materials.append(material)
        if col:
            link_to_collection(obj, col)
    return obj

def add_sphere(name, radius, location, segments=24, ring_count=16, material=None, offset=(0,0,0), col=None):
    actual_loc = (location[0] + offset[0], location[1] + offset[1], location[2] + offset[2])
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=ring_count,
        radius=radius,
        location=actual_loc
    )
    obj = get_active_object()
    if obj:
        obj.name = name
        if hasattr(bpy.context, "view_layer"):
            bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        try:
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        except Exception:
            pass
        if material:
            obj.data.materials.append(material)
        if col:
            link_to_collection(obj, col)
    return obj

# ════════════════════════════════════════════════════════════════════════════
# 1. LIGHTING & CAMERA SETUP
# ════════════════════════════════════════════════════════════════════════════

def setup_lighting_and_camera(parent_col):
    col = bpy.data.collections.new("00_Lighting_And_Cameras")
    parent_col.children.link(col)

    # 1. Primary Sunlight (Warm Key Light)
    sun_data = bpy.data.lights.new(name="Sun_KeyLight", type='SUN')
    sun_data.energy = 3.5
    sun_data.color = (1.0, 0.96, 0.90)
    sun_obj = bpy.data.objects.new(name="Sun_KeyLight", object_data=sun_data)
    sun_obj.location = (20.0, -25.0, 30.0)
    sun_obj.rotation_euler = (math.radians(52), math.radians(18), math.radians(-38))
    col.objects.link(sun_obj)

    # 2. Cool Sky Fill Light (Secondary Sun for soft fill shadows)
    fill_data = bpy.data.lights.new(name="Sun_FillLight", type='SUN')
    fill_data.energy = 1.2
    fill_data.color = (0.72, 0.82, 1.0)
    fill_obj = bpy.data.objects.new(name="Sun_FillLight", object_data=fill_data)
    fill_obj.location = (-20.0, 25.0, 25.0)
    fill_obj.rotation_euler = (math.radians(35), math.radians(-30), math.radians(135))
    col.objects.link(fill_obj)

    # 3. Isometric Campus Overview Camera
    cam_data = bpy.data.cameras.new(name="Campus_Camera")
    cam_data.lens = 45.0
    cam_data.clip_start = 0.5
    cam_data.clip_end = 200.0
    cam_obj = bpy.data.objects.new(name="Campus_Camera", object_data=cam_data)
    # Position angled isometric view looking toward campus center (0, 0, 1.5)
    cam_obj.location = (26.0, -28.0, 24.0)
    cam_obj.rotation_euler = (math.radians(58), 0.0, math.radians(43))
    col.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj

    return col

# ════════════════════════════════════════════════════════════════════════════
# 2. GROUND TERRAIN, ROADS & LANDSCAPING
# ════════════════════════════════════════════════════════════════════════════

def build_environment(parent_col):
    col_ground = bpy.data.collections.new("01_Ground_And_Roads")
    col_veg = bpy.data.collections.new("02_Campus_Vegetation")
    col_lights = bpy.data.collections.new("03_Lighting_Bollards")
    parent_col.children.link(col_ground)
    parent_col.children.link(col_veg)
    parent_col.children.link(col_lights)

    # Materials
    m_terrain = create_pbr_material("Env_Mat_TerrainSubBase", "#080D1A", roughness=0.92, metallic=0.08)
    m_plinth = create_pbr_material("Env_Mat_FoundationPlinth", "#0F172A", roughness=0.88, metallic=0.15)
    m_road = create_pbr_material("Env_Mat_PromenadePaving", "#162036", roughness=0.82, metallic=0.2)
    m_crossroad = create_pbr_material("Env_Mat_CrossWalkway", "#1E293B", roughness=0.84, metallic=0.18)
    m_plaza = create_pbr_material("Env_Mat_CentralPlaza", "#1A253D", roughness=0.78, metallic=0.25)
    m_plaza_inner = create_pbr_material("Env_Mat_PlazaInlay", "#223354", roughness=0.72, metallic=0.32,
                                        emission_hex="#38BDF8", emission_strength=0.15)
    m_lawn = create_pbr_material("Env_Mat_LawnGrass", "#0B2B1E", roughness=0.96, metallic=0.02)
    m_curb = create_pbr_material("Env_Mat_CurbBorder", "#2A3854", roughness=0.75, metallic=0.35)

    # A. Foundation Base & Ground Slabs
    # Outer deep sub-base plinth (X: -26 to 26, Y: -26 to 26, thickness 0.4)
    add_box("Terrain_SubBase_Outer", (52.0, 52.0, 0.4), (0, 0, -0.22), m_terrain, col=col_ground)
    # Inner campus foundation plinth
    add_box("Terrain_CampusPlinth", (44.0, 44.0, 0.15), (0, 0, -0.075), m_plinth, col=col_ground)

    # B. Landscaped Campus Lawn Grass Islands (4 major quadrants)
    lawns = [
        ("Lawn_NorthWest", (7.5, 9.0, 0.05), (-7.5, 9.5, 0.025)),
        ("Lawn_NorthEast", (7.5, 9.0, 0.05), (7.5, 9.5, 0.025)),
        ("Lawn_SouthWest", (7.5, 9.0, 0.05), (-7.5, -11.5, 0.025)),
        ("Lawn_SouthEast", (7.5, 9.0, 0.05), (7.5, -11.5, 0.025)),
    ]
    for lname, lsize, lloc in lawns:
        add_box(lname, lsize, lloc, m_lawn, col=col_ground)
        # Decorative border curb
        add_box(f"{lname}_Curb", (lsize[0] + 0.2, lsize[1] + 0.2, 0.03), (lloc[0], lloc[1], 0.015), m_curb, col=col_ground)

    # C. Main Promenade Road Network
    # 1. Main North-South Central Spine Promenade (connects North Campus to South Campus)
    add_box("Road_NorthSouth_Promenade", (3.4, 38.0, 0.06), (0, 0, 0.03), m_road, col=col_ground)
    add_box("Road_NS_Curbs", (3.7, 38.0, 0.04), (0, 0, 0.02), m_curb, col=col_ground)

    # 2. North Cross Walkway (connects Turing Science Center on West to Hopper Engineering on East)
    add_box("Road_North_CrossWalkway", (28.0, 3.4, 0.06), (0, 4.5, 0.03), m_crossroad, col=col_ground)
    add_box("Road_North_Curbs", (28.0, 3.7, 0.04), (0, 4.5, 0.02), m_curb, col=col_ground)

    # 3. South Cross Walkway (connects Central Campus Center on West to Innovation Center on East)
    add_box("Road_South_CrossWalkway", (26.0, 3.4, 0.06), (0, -6.2, 0.03), m_crossroad, col=col_ground)
    add_box("Road_South_Curbs", (26.0, 3.7, 0.04), (0, -6.2, 0.02), m_curb, col=col_ground)

    # 4. Diagonal Connecting Approach Paths
    diag_w = 2.4
    diag_len = 16.0
    # West diagonal: rotated 45 degrees
    add_box("Road_Diagonal_West", (diag_len, diag_w, 0.055), (-5.5, -1.2, 0.028), m_crossroad, col=col_ground)
    obj_dw = get_active_object()
    if obj_dw:
        obj_dw.rotation_euler = (0, 0, math.radians(-45))

    # East diagonal
    add_box("Road_Diagonal_East", (diag_len, diag_w, 0.055), (5.5, -1.2, 0.028), m_crossroad, col=col_ground)
    obj_de = get_active_object()
    if obj_de:
        obj_de.rotation_euler = (0, 0, math.radians(45))

    # 5. Grand Central Campus Plaza
    add_box("Plaza_Outer", (9.6, 9.6, 0.07), (0, 0, 0.035), m_plaza, col=col_ground)
    add_box("Plaza_InnerMedallion", (4.8, 4.8, 0.08), (0, 0, 0.04), m_plaza_inner, col=col_ground)
    add_cylinder("Plaza_CentralCompassRing", 1.8, 0.09, (0, 0, 0.045), vertices=32, material=m_curb, col=col_ground)

    # D. Stylized Low-Poly Campus Evergreen Trees
    m_trunk = create_pbr_material("Veg_Mat_TreeTrunk", "#1E293B", roughness=0.92, metallic=0.08)
    m_foliage_lower = create_pbr_material("Veg_Mat_FoliageDeep", "#0B3627", roughness=0.88, metallic=0.05)
    m_foliage_upper = create_pbr_material("Veg_Mat_FoliageAccent", "#114B37", roughness=0.84, metallic=0.08)

    tree_coords = [
        # Flanking North Promenade
        (-4.2, 2.4), (4.2, 2.4),
        (-4.2, -2.4), (4.2, -2.4),
        # Flanking Outer Spine
        (-2.4, 9.2), (2.4, 9.2),
        (-2.4, -9.2), (2.4, -9.2),
        # Flanking West & East Outer Perimeters
        (-12.2, -2.8), (12.2, -2.8),
        (-12.2, 8.2), (12.2, 8.2),
    ]

    for idx, (tx, ty) in enumerate(tree_coords):
        tname = f"Tree_{idx+1:02d}"
        # Tree Planter Curb
        add_cylinder(f"{tname}_Planter", 0.9, 0.14, (tx, ty, 0.07), vertices=12, material=m_curb, col=col_veg)
        # Tree Trunk
        add_cylinder(f"{tname}_Trunk", 0.12, 1.0, (tx, ty, 0.5), vertices=8, material=m_trunk, col=col_veg)
        # Lower Foliage Cone
        add_cone(f"{tname}_FoliageLower", 0.85, 0.0, 1.3, (tx, ty, 1.3), vertices=8, material=m_foliage_lower, col=col_veg)
        # Upper Foliage Cone
        add_cone(f"{tname}_FoliageUpper", 0.60, 0.0, 1.1, (tx, ty, 1.9), vertices=8, material=m_foliage_upper, col=col_veg)

    # E. Glowing Pathway Light Bollards (20 Architectural Lamp Posts)
    m_post = create_pbr_material("Light_Mat_BollardPost", "#1E293B", roughness=0.6, metallic=0.82)
    m_lamp_glow = create_pbr_material("Light_Mat_BollardGlow", "#FEF08A", roughness=0.18, metallic=0.1,
                                      emission_hex="#F59E0B", emission_strength=2.2)

    bollard_coords = [
        # North-South Spine Promenade
        (-1.9, 7.0), (1.9, 7.0),
        (-1.9, 3.2), (1.9, 3.2),
        (-1.9, -3.2), (1.9, -3.2),
        (-1.9, -7.0), (1.9, -7.0),
        # North Walkway towards TSC and HEC
        (-6.5, 3.0), (-6.5, 6.0),
        (6.5, 3.0), (6.5, 6.0),
        # South Walkway towards CCC and IC
        (-5.8, -4.8), (-5.8, -7.6),
        (5.8, -4.8), (5.8, -7.6),
        # Plaza Corners
        (-4.8, 4.8), (4.8, 4.8),
        (-4.8, -4.8), (4.8, -4.8),
    ]

    for b_idx, (bx, by) in enumerate(bollard_coords):
        bname = f"BollardLight_{b_idx+1:02d}"
        # Sleek dark graphite pole
        add_cylinder(f"{bname}_Pole", 0.05, 0.9, (bx, by, 0.45), vertices=8, material=m_post, col=col_lights)
        # Glowing warm lantern head cap
        add_cylinder(f"{bname}_GlowHead", 0.075, 0.18, (bx, by, 0.95), vertices=8, material=m_lamp_glow, col=col_lights)
        # Protective top cap
        add_cylinder(f"{bname}_TopCap", 0.085, 0.04, (bx, by, 1.05), vertices=8, material=m_post, col=col_lights)

    return col_ground

# ════════════════════════════════════════════════════════════════════════════
# 3. BUILDINGS BUILDERS WITH REAL COORDINATE OFFSETS
# ════════════════════════════════════════════════════════════════════════════

def build_tsc(offset=(-9.0, 4.0, 0), parent_col=None):
    """
    TSC - Turing Science Center
    Position: North-West quadrant (-9.0, 4.0, 0)
    Flagship Computing Tower, 5 Floor Bands, Research Wing, and Observatory Dome
    """
    col = bpy.data.collections.new("04_Building_TSC")
    if parent_col:
        parent_col.children.link(col)
    else:
        bpy.context.scene.collection.children.link(col)

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
    add_box("TSC_EntrancePodium", (8.2, 9.2, 0.25), (0, 0, 0.125), m_trim, offset=offset, col=col)
    add_box("TSC_PodiumStairs", (6.0, 3.2, 0.12), (0, -3.8, 0.06), m_trim, offset=offset, col=col)

    # B. Main Research Tower (Center-North mass)
    tower_h = 4.75
    tower_z = 0.25 + tower_h / 2
    add_box("TSC_MainTower_Core", (4.2, 4.0, tower_h), (0, 0.6, tower_z), m_body, offset=offset, col=col)
    add_box("TSC_MainTower_GlassFacets", (4.3, 4.1, tower_h - 0.4), (0, 0.6, tower_z), m_glass, offset=offset, col=col)

    # 5 Floor Bands
    for i in range(1, 6):
        fz = 0.25 + i * (tower_h / 5.0)
        add_box(f"TSC_FloorBand_{i}", (4.5, 4.3, 0.12), (0, 0.6, fz), m_trim, offset=offset, col=col)

    # Vertical Mullions
    for x_offset in [-1.8, -0.9, 0, 0.9, 1.8]:
        add_box(f"TSC_Mullion_S_{x_offset}", (0.08, 0.12, tower_h), (x_offset, -1.45, tower_z), m_mullion, offset=offset, col=col)
        add_box(f"TSC_Mullion_N_{x_offset}", (0.08, 0.12, tower_h), (x_offset, 2.65, tower_z), m_mullion, offset=offset, col=col)

    # Cantilever Research Bay Level 4
    add_box("TSC_ProjectingBay_L4", (2.8, 0.6, 0.9), (0, -1.6, 0.25 + 3.2), m_accent, offset=offset, col=col)
    add_box("TSC_ProjectingBay_Glass", (2.7, 0.55, 0.8), (0, -1.6, 0.25 + 3.2), m_glass, offset=offset, col=col)

    # C. Glazed Ground-Floor Lobby
    lobby_h = 1.6
    add_box("TSC_GlassLobby", (4.6, 2.4, lobby_h), (0, -1.8, 0.25 + lobby_h / 2), m_glass, offset=offset, col=col)
    add_box("TSC_LobbyInteriorGlow", (4.2, 2.0, lobby_h - 0.2), (0, -1.8, 0.25 + lobby_h / 2), m_glow, offset=offset, col=col)
    for cx in [-2.1, -0.7, 0.7, 2.1]:
        add_box(f"TSC_LobbyCol_{cx}", (0.16, 0.16, lobby_h), (cx, -2.9, 0.25 + lobby_h / 2), m_trim, offset=offset, col=col)
    add_box("TSC_EntranceCanopy", (4.8, 1.4, 0.14), (0, -3.2, 0.25 + lobby_h), m_accent, offset=offset, col=col)

    # D. Connected Lower Research Wing (West side)
    wing_w, wing_d, wing_h = 2.6, 5.2, 3.0
    wing_z = 0.25 + wing_h / 2
    add_box("TSC_ResearchWing", (wing_w, wing_d, wing_h), (-2.8, 0.2, wing_z), m_body, offset=offset, col=col)
    add_box("TSC_ResearchWing_RibbonGlass", (wing_w + 0.1, wing_d * 0.85, 0.6), (-2.8, 0.2, 0.25 + 1.2), m_glass, offset=offset, col=col)
    add_box("TSC_ResearchWing_RibbonGlass2", (wing_w + 0.1, wing_d * 0.85, 0.6), (-2.8, 0.2, 0.25 + 2.2), m_glass, offset=offset, col=col)
    add_box("TSC_ResearchWing_Roof", (wing_w + 0.2, wing_d + 0.2, 0.14), (-2.8, 0.2, 0.25 + wing_h), m_roof, offset=offset, col=col)
    for lz in [0.25 + 1.0, 0.25 + 1.5, 0.25 + 2.0, 0.25 + 2.5]:
        add_box(f"TSC_WingLouver_{lz}", (wing_w + 0.25, 0.08, 0.04), (-2.8, -2.45, lz), m_accent, offset=offset, col=col)

    # E. Rooftop Research Crown & Observatory Dome
    roof_z = 0.25 + tower_h
    add_box("TSC_RooftopCrown", (3.8, 3.6, 0.65), (0, 0.6, roof_z + 0.325), m_roof, offset=offset, col=col)
    add_box("TSC_CrownLouverGrid", (3.6, 3.4, 0.4), (0, 0.6, roof_z + 0.35), m_mullion, offset=offset, col=col)

    dome_drum_z = roof_z + 0.65 + 0.2
    add_cylinder("TSC_Observatory_Drum", 0.75, 0.4, (0.8, 0.6, dome_drum_z), vertices=24, material=m_trim, offset=offset, col=col)
    add_sphere("TSC_Observatory_Dome", 0.74, (0.8, 0.6, dome_drum_z + 0.2), segments=24, ring_count=16, material=m_dome, offset=offset, col=col)
    add_box("TSC_Observatory_Slit", (0.14, 0.9, 0.4), (0.8, 0.6, dome_drum_z + 0.4), m_mullion, offset=offset, col=col)
    add_cylinder("TSC_CommunicationsSpire", 0.03, 1.2, (-0.8, 0.6, roof_z + 1.25), vertices=12, material=m_accent, offset=offset, col=col)

    return col

def build_hec(offset=(8.0, 4.5, 0), parent_col=None):
    """
    HEC - Hopper Engineering Complex
    Position: North-East quadrant (8.0, 4.5, 0)
    Dual-Wing Engineering Lab with Central Atrium, Skybridges, and Sawtooth Skylights
    """
    col = bpy.data.collections.new("05_Building_HEC")
    if parent_col:
        parent_col.children.link(col)
    else:
        bpy.context.scene.collection.children.link(col)

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
    add_box("HEC_Plinth", (8.2, 8.6, 0.25), (0, 0, 0.125), m_trim, offset=offset, col=col)

    # B. West Wing (3 floors)
    ww_w, ww_d, ww_h = 2.8, 6.8, 4.2
    ww_z = 0.25 + ww_h / 2
    add_box("HEC_WestWing", (ww_w, ww_d, ww_h), (-2.2, 0, ww_z), m_body, offset=offset, col=col)
    for floor_i in [1, 2, 3]:
        fz = 0.25 + (floor_i - 0.5) * (ww_h / 3.0)
        add_box(f"HEC_WW_RibbonGlass_{floor_i}", (ww_w + 0.08, ww_d * 0.88, 0.65), (-2.2, 0, fz), m_glass, offset=offset, col=col)
        add_box(f"HEC_WW_RibbonTrim_{floor_i}", (ww_w + 0.12, ww_d * 0.9, 0.1), (-2.2, 0, fz + 0.35), m_trim, offset=offset, col=col)
    add_box("HEC_WW_RoofSlab", (ww_w + 0.2, ww_d + 0.2, 0.15), (-2.2, 0, 0.25 + ww_h), m_roof, offset=offset, col=col)

    # Rooftop MEP Ventilation Units
    add_box("HEC_RooftopVentPlant_Unit1", (1.4, 2.2, 0.85), (-2.2, -1.2, 0.25 + ww_h + 0.45), m_trim, offset=offset, col=col)
    add_box("HEC_RooftopVentPlant_Unit2", (1.2, 1.8, 0.7), (-2.2, 1.4, 0.25 + ww_h + 0.38), m_mullion, offset=offset, col=col)
    add_box("HEC_VentPlant_LouverScreen", (1.6, 4.4, 0.9), (-2.2, 0.1, 0.25 + ww_h + 0.48), m_accent, offset=offset, col=col)

    # C. East Wing (4 floors)
    ew_w, ew_d, ew_h = 2.8, 6.2, 5.0
    ew_z = 0.25 + ew_h / 2
    add_box("HEC_EastWing", (ew_w, ew_d, ew_h), (2.2, 0, ew_z), m_body, offset=offset, col=col)
    for floor_i in [1, 2, 3, 4]:
        fz = 0.25 + (floor_i - 0.5) * (ew_h / 4.0)
        add_box(f"HEC_EW_RibbonGlass_{floor_i}", (ew_w + 0.08, ew_d * 0.85, 0.55), (2.2, 0, fz), m_glass, offset=offset, col=col)
    add_box("HEC_EW_RoofSlab", (ew_w + 0.2, ew_d + 0.2, 0.15), (2.2, 0, 0.25 + ew_h), m_roof, offset=offset, col=col)

    # Sawtooth Skylights
    for s_idx, sy in enumerate([-1.8, -0.6, 0.6, 1.8]):
        add_box(f"HEC_SawtoothSkylight_{s_idx}", (2.2, 0.8, 0.4), (2.2, sy, 0.25 + ew_h + 0.25), m_trim, offset=offset, col=col)
        add_box(f"HEC_SawtoothGlass_{s_idx}", (2.0, 0.7, 0.3), (2.2, sy, 0.25 + ew_h + 0.25), m_glass, offset=offset, col=col)

    # D. Central Multi-Story Glazed Atrium
    atrium_w, atrium_d, atrium_h = 1.8, 5.4, 4.6
    atrium_z = 0.25 + atrium_h / 2
    add_box("HEC_CentralAtrium_Glass", (atrium_w, atrium_d, atrium_h), (0, 0, atrium_z), m_glass, offset=offset, col=col)
    add_box("HEC_CentralAtrium_Glow", (atrium_w - 0.3, atrium_d - 0.4, atrium_h - 0.4), (0, 0, atrium_z), m_glow, offset=offset, col=col)

    # Skybridges
    add_box("HEC_Skybridge_L2", (3.6, 1.2, 0.6), (0, -0.8, 0.25 + 1.8), m_trim, offset=offset, col=col)
    add_box("HEC_Skybridge_L3", (3.6, 1.2, 0.6), (0, 0.8, 0.25 + 3.2), m_trim, offset=offset, col=col)

    # Exoskeleton columns
    for col_x in [-0.8, 0.8]:
        add_box(f"HEC_ExoskeletonCol_{col_x}", (0.14, 0.14, atrium_h), (col_x, -atrium_d / 2 - 0.05, atrium_z), m_accent, offset=offset, col=col)
    add_box("HEC_ExoskeletonBeam_Top", (atrium_w + 0.4, 0.14, 0.18), (0, -atrium_d / 2 - 0.05, 0.25 + atrium_h), m_accent, offset=offset, col=col)

    # Ground concourse and entrance
    add_box("HEC_GroundConcourse", (atrium_w + 1.0, 2.0, 1.4), (0, -atrium_d / 2 - 0.6, 0.25 + 0.7), m_body, offset=offset, col=col)
    add_box("HEC_EntrancePortalGlass", (atrium_w, 0.1, 1.1), (0, -atrium_d / 2 - 1.55, 0.25 + 0.6), m_glass, offset=offset, col=col)
    add_box("HEC_EntranceCanopy", (atrium_w + 1.2, 1.6, 0.14), (0, -atrium_d / 2 - 1.2, 0.25 + 1.45), m_accent, offset=offset, col=col)

    return col

def build_ic(offset=(7.0, -6.5, 0), parent_col=None):
    """
    IC - Innovation Center
    Position: South-East quadrant (7.0, -6.5, 0)
    Contemporary Cantilevered Hub with V-Columns, Layered Slabs, and Collaboration Pavilion
    """
    col = bpy.data.collections.new("06_Building_IC")
    if parent_col:
        parent_col.children.link(col)
    else:
        bpy.context.scene.collection.children.link(col)

    m_body = create_pbr_material("IC_Mat_Body", "#261E3E", roughness=0.52, metallic=0.22)
    m_trim = create_pbr_material("IC_Mat_Trim", "#2E244A", roughness=0.62, metallic=0.32)
    m_glass = create_pbr_material("IC_Mat_Glass", "#C084FC", roughness=0.08, metallic=0.85, alpha=0.82,
                                  emission_hex="#581C87", emission_strength=0.35)
    m_glow = create_pbr_material("IC_Mat_InteriorGlow", "#E9D5FF", roughness=0.3, metallic=0.1,
                                 emission_hex="#A855F7", emission_strength=0.5)
    m_accent = create_pbr_material("IC_Mat_Accent", "#A855F7", roughness=0.28, metallic=0.7,
                                   emission_hex="#A855F7", emission_strength=0.38)
    m_roof = create_pbr_material("IC_Mat_Roof", "#171226", roughness=0.48, metallic=0.45)

    # A. Foundation Base
    add_box("IC_BasePlinth", (7.2, 8.4, 0.25), (0, 0, 0.125), m_trim, offset=offset, col=col)

    # Lower Incubator Gallery
    low_w, low_d, low_h = 4.8, 5.8, 1.8
    low_z = 0.25 + low_h / 2
    add_box("IC_LowerGallery", (low_w, low_d, low_h), (-0.5, -0.4, low_z), m_body, offset=offset, col=col)
    add_box("IC_LowerGallery_Glass", (low_w + 0.08, 1.8, low_h - 0.4), (-0.5, -2.2, low_z), m_glass, offset=offset, col=col)
    add_box("IC_LowerGallery_Glow", (low_w - 0.4, 1.6, low_h - 0.6), (-0.5, -2.2, low_z), m_glow, offset=offset, col=col)

    # B. DRAMATIC CANTILEVER UPPER FLOOR
    cant_w, cant_d, cant_h = 5.6, 6.4, 1.9
    cant_x, cant_y = 0.5, 0.4
    cant_z = 0.25 + low_h + cant_h / 2
    add_box("IC_CantileverVolume", (cant_w, cant_d, cant_h), (cant_x, cant_y, cant_z), m_body, offset=offset, col=col)

    # Glazed corners
    add_box("IC_GlazedCorner_South", (3.2, 0.12, cant_h - 0.3), (cant_x + 1.1, cant_y - cant_d / 2 + 0.05, cant_z), m_glass, offset=offset, col=col)
    add_box("IC_GlazedCorner_East", (0.12, 3.4, cant_h - 0.3), (cant_x + cant_w / 2 - 0.05, cant_y - 1.2, cant_z), m_glass, offset=offset, col=col)
    add_box("IC_Cantilever_InteriorGlow", (2.8, 2.8, cant_h - 0.5), (cant_x + 1.0, cant_y - 1.2, cant_z), m_glow, offset=offset, col=col)

    # Supporting V-Columns
    for v_col_x in [1.8, 2.8]:
        add_cylinder(f"IC_CantileverColumn_{v_col_x}", 0.12, low_h, (v_col_x, -2.2, 0.25 + low_h / 2), vertices=16, material=m_accent, offset=offset, col=col)

    # Sunshade fins
    for fx in [-0.8, -0.2, 0.4, 1.0, 1.6, 2.2]:
        add_box(f"IC_SunshadeFin_{fx}", (0.05, 0.35, cant_h), (fx, cant_y - cant_d / 2 - 0.12, cant_z), m_accent, offset=offset, col=col)

    # C. Layered Thin Roof Slabs
    roof_slab_z = 0.25 + low_h + cant_h
    add_box("IC_LayeredRoofSlab_1", (cant_w + 0.5, cant_d + 0.5, 0.16), (cant_x, cant_y, roof_slab_z + 0.08), m_roof, offset=offset, col=col)
    add_box("IC_LayeredRoofSlab_2", (cant_w + 0.7, cant_d + 0.7, 0.08), (cant_x, cant_y, roof_slab_z + 0.18), m_accent, offset=offset, col=col)

    # Rooftop Pavilion Pod
    add_box("IC_RooftopPavilion", (2.8, 3.2, 0.85), (cant_x - 0.6, cant_y + 0.8, roof_slab_z + 0.6), m_body, offset=offset, col=col)
    add_box("IC_RooftopPavilion_Clerestory", (2.9, 3.3, 0.25), (cant_x - 0.6, cant_y + 0.8, roof_slab_z + 0.85), m_glass, offset=offset, col=col)
    add_box("IC_PavilionRoofSlab", (3.2, 3.6, 0.1), (cant_x - 0.6, cant_y + 0.8, roof_slab_z + 1.05), m_roof, offset=offset, col=col)

    return col

def build_ccc(offset=(-7.5, -6.0, 0), parent_col=None):
    """
    CCC - Central Campus Center (Civic Auditorium)
    Position: South-West quadrant (-7.5, -6.0, 0)
    Curved Barrel-Vault Canopy Roof, Diagrid Columns, and Glazed End Gables
    """
    col = bpy.data.collections.new("07_Building_CCC")
    if parent_col:
        parent_col.children.link(col)
    else:
        bpy.context.scene.collection.children.link(col)

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

    # A. Layered Sandstone Plinth
    add_box("CCC_SteppedPlinth_L1", (9.2, 8.2, 0.2), (0, 0, 0.1), m_body, offset=offset, col=col)
    add_box("CCC_SteppedPlinth_L2", (8.8, 7.8, 0.15), (0, 0, 0.275), m_trim, offset=offset, col=col)

    # B. Assembly Hall Internal Volume
    hall_w, hall_d, hall_h = 7.6, 6.2, 2.5
    hall_z = 0.35 + hall_h / 2
    add_box("CCC_AssemblyHall_Walls", (hall_w, hall_d, hall_h), (0, 0, hall_z), m_body, offset=offset, col=col)
    add_box("CCC_InteriorGlow_Core", (hall_w - 0.6, hall_d - 0.8, hall_h - 0.4), (0, 0, hall_z), m_glow, offset=offset, col=col)

    # C. Curved Glass Curtain Wall
    add_box("CCC_CurvedFacadeGlass", (hall_w + 0.2, 0.15, hall_h), (0, -hall_d / 2 - 0.05, hall_z), m_glass, offset=offset, col=col)

    # Diagrid Columns (7 columns)
    for col_i, col_x in enumerate([-3.2, -2.1, -1.0, 0, 1.0, 2.1, 3.2]):
        angle = (col_i - 3) * 0.04
        actual_loc = (col_x + offset[0], -hall_d / 2 - 0.12 + offset[1], hall_z + offset[2])
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=16,
            radius=0.08,
            depth=hall_h + 0.2,
            location=actual_loc,
            rotation=(0, angle, 0)
        )
        col_obj = get_active_object()
        if col_obj:
            col_obj.name = f"CCC_DiagridCol_{col_i}"
            if hasattr(bpy.context, "view_layer"):
                bpy.context.view_layer.objects.active = col_obj
            col_obj.select_set(True)
            try:
                bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            except Exception:
                pass
            col_obj.data.materials.append(m_accent)
            link_to_collection(col_obj, col)

    # D. SIGNATURE AERODYNAMIC BARREL-VAULT CURVED CANOPY ROOF
    vault_radius = (hall_d / 2) * 1.04
    vault_length = hall_w * 1.15
    vault_center_x = offset[0]
    vault_center_y = offset[1] + 0.2
    vault_center_z = offset[2] + 0.35 + hall_h

    def add_arch_strip(name, x_start, x_end, outer_radius, inner_radius, material, segments=32):
        verts = []
        faces = []
        for x in (x_start + vault_center_x, x_end + vault_center_x):
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
            faces.append((idx, idx + 1, 2 * ring + idx + 1, 2 * ring + idx))
            faces.append((ring + idx, 3 * ring + idx, 3 * ring + idx + 1, ring + idx + 1))
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
            verts.extend((x + vault_center_x + x_offset, y, z) for y, z in outline)
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
        add_arch_gable(f"CCC_GlazedEndGable_{end_idx}", end_x, vault_radius - 0.18, 0.1, m_glass)
        add_arch_strip(f"CCC_EndGableFrame_{end_idx}", end_x - 0.09, end_x + 0.09, vault_radius + 0.02, vault_radius - 0.1, m_accent, segments=24)

    # Ceiling soffit slab
    add_box("CCC_CeilingSoffitSlab", (vault_length, hall_d * 1.12, 0.2), (0, 0.2, hall_z + hall_h / 2 + 0.1), m_roof, offset=offset, col=col)

    # Radiant Skylight Spine along Apex Ridge
    add_box("CCC_SkylightSpine", (vault_length * 0.78, 0.24, 0.1), (0, 0.2, hall_z + hall_h / 2 + vault_radius + 0.08), m_skylight, offset=offset, col=col)

    # Cantilevered Visor
    add_box("CCC_CanopyVisor", (vault_length * 1.02, 0.32, 0.14), (0, -hall_d / 2 - 0.22, hall_z + hall_h / 2 + 0.18), m_accent, offset=offset, col=col)

    # Structural Ribs
    for r_idx, rx in enumerate([-3.2, -1.6, 0, 1.6, 3.2]):
        add_arch_strip(f"CCC_RoofRib_{r_idx}", rx - 0.055, rx + 0.055, vault_radius + 0.2, vault_radius + 0.07, m_accent, segments=24)

    # Grand Entrance Portal
    add_box("CCC_MainEntrancePortal", (3.6, 0.5, 1.5), (0, -hall_d / 2 - 0.35, 0.35 + 0.75), m_body, offset=offset, col=col)
    add_box("CCC_CathedralDoors", (2.8, 0.1, 1.2), (0, -hall_d / 2 - 0.55, 0.35 + 0.6), m_glass, offset=offset, col=col)
    add_box("CCC_EntranceCornice", (4.0, 0.65, 0.16), (0, -hall_d / 2 - 0.35, 0.35 + 1.58), m_accent, offset=offset, col=col)

    return col

# ════════════════════════════════════════════════════════════════════════════
# 4. FULL CAMPUS GENERATOR & EXPORT PIPELINE
# ════════════════════════════════════════════════════════════════════════════

def build_full_campus(output_dir, blend_dir):
    """
    Constructs the complete digital twin scene containing:
    - 4 Campus Buildings (TSC, HEC, IC, CCC)
    - Full Ground terrain, lawn islands, and paved roads/paths
    - Stylized campus trees and glowing lighting bollards
    - Architectural studio lighting setup & camera
    And exports models/blend/campus_full.blend and web/public/models/campus_full.glb.
    """
    clear_scene()

    scene = bpy.context.scene if hasattr(bpy.context, "scene") and bpy.context.scene else bpy.data.scenes[0]
    master_col = bpy.data.collections.new("CampusFlow_DigitalTwin")
    scene.collection.children.link(master_col)

    print("→ Building Lighting & Camera...")
    setup_lighting_and_camera(master_col)

    print("→ Building Ground Terrain, Roads & Vegetation...")
    build_environment(master_col)

    print("→ Placing Turing Science Center (TSC) at North-West...")
    build_tsc(offset=(-9.0, 4.0, 0), parent_col=master_col)

    print("→ Placing Hopper Engineering Complex (HEC) at North-East...")
    build_hec(offset=(8.0, 4.5, 0), parent_col=master_col)

    print("→ Placing Innovation Center (IC) at South-East...")
    build_ic(offset=(7.0, -6.5, 0), parent_col=master_col)

    print("→ Placing Central Campus Center (CCC) at South-West...")
    build_ccc(offset=(-7.5, -6.0, 0), parent_col=master_col)

    # Ensure output directories exist
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(blend_dir, exist_ok=True)

    blend_path = os.path.join(blend_dir, "campus_full.blend")
    glb_path = os.path.join(output_dir, "campus_full.glb")

    # Statistics
    mesh_objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    total_verts = sum(len(o.data.vertices) for o in mesh_objects)
    total_polys = sum(len(o.data.polygons) for o in mesh_objects)
    total_tris = sum(len(o.data.loop_triangles) if hasattr(o.data, "loop_triangles") and len(o.data.loop_triangles) > 0 else len(o.data.polygons) * 2 for o in mesh_objects)

    print("\n→ Saving unified .blend file...")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)

    print("→ Exporting unified glTF/GLB file...")
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
    blend_size_kb = os.path.getsize(blend_path) / 1024.0

    print("\n═══════════════════════════════════════════════════════════")
    print("CAMPUSFLOW COMPLETE DIGITAL TWIN EXPORTED SUCCESSFULLY!")
    print("═══════════════════════════════════════════════════════════")
    print(f"  - Unified Blend File: {blend_path} ({blend_size_kb:.1f} KB)")
    print(f"  - Unified GLB File:   {glb_path} ({file_size_kb:.1f} KB)")
    print(f"  - Total Mesh Objects: {len(mesh_objects)}")
    print(f"  - Total Vertices:     {total_verts}")
    print(f"  - Total Polygons:     {total_polys} (~{total_tris} triangles)")
    print(f"  - Export Duration:    {duration:.2f}s")

    return {
        "blend": blend_path,
        "glb": glb_path,
        "blend_size_kb": blend_size_kb,
        "glb_size_kb": file_size_kb,
        "objects": len(mesh_objects),
        "vertices": total_verts,
        "polygons": total_polys,
        "triangles": total_tris,
        "duration": duration,
    }

def main():
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        root_dir = os.path.dirname(os.path.dirname(script_dir))
    except (NameError, TypeError):
        root_dir = r"C:\Users\subba\OneDrive\Desktop\campusflow-main"

    if not os.path.exists(root_dir) or not os.path.exists(os.path.join(root_dir, "web")):
        root_dir = r"C:\Users\subba\OneDrive\Desktop\campusflow-main"

    output_dir = os.path.join(root_dir, "web", "public", "models")
    blend_dir = os.path.join(root_dir, "models", "blend")

    print(f"Executing CampusFlow Unified Campus Generation...")
    print(f"Blender Version: {bpy.app.version_string}")
    print(f"Target Blend: {blend_dir}")
    print(f"Target GLB:   {output_dir}")

    build_full_campus(output_dir, blend_dir)

if __name__ == "__main__":
    main()
