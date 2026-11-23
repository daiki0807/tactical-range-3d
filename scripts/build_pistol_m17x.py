import bpy
import bmesh
import math
import os
from mathutils import Vector, Matrix

# ==============================================================================
# High-Detail SIG P320 M17-X Tactical Pistol — Blender Procedural CAD/Boolean Script
# Exports to glTF/GLB with Y-up (+Y up, -Z forward toward muzzle) for Three.js
# Named sub-hierarchies: Frame, Slide, Trigger, Magazine, Suppressor
# ==============================================================================

OUT_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "public", "models", "pistol_m17x.glb")
)
os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def make_mat(name, base_color, metallic=0.0, roughness=0.5, emission=None, emission_strength=0.0, alpha=1.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        if "Transmission Weight" in bsdf.inputs:
            bsdf.inputs["Transmission Weight"].default_value = 0.75
        mat.blend_method = "BLEND" if hasattr(mat, "blend_method") else "OPAQUE"
    if emission is not None:
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
            bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def create_materials():
    return {
        "slide_dlc": make_mat("Slide_DLC_Steel", (0.12, 0.135, 0.16), metallic=0.88, roughness=0.28),
        "dark_steel": make_mat("Dark_Steel", (0.07, 0.08, 0.095), metallic=0.90, roughness=0.26),
        "stainless": make_mat("Stainless_Barrel", (0.76, 0.79, 0.84), metallic=0.97, roughness=0.14),
        "titanium": make_mat("Titanium_Controls", (0.45, 0.48, 0.54), metallic=0.92, roughness=0.24),
        "fde_frame": make_mat("FDE_Polymer_Frame", (0.56, 0.45, 0.30), metallic=0.08, roughness=0.56),
        "fde_dark": make_mat("FDE_Dark_Basepad", (0.38, 0.30, 0.19), metallic=0.10, roughness=0.62),
        "grip_stipple": make_mat("Grip_Stipple_Black", (0.07, 0.075, 0.085), metallic=0.04, roughness=0.88),
        "bore_black": make_mat("Bore_Interior", (0.01, 0.01, 0.012), metallic=0.0, roughness=1.0),
        "optic_glass": make_mat("Optic_Glass", (0.18, 0.62, 0.95), metallic=0.08, roughness=0.04, alpha=0.32),
        "red_dot": make_mat("Red_Dot_Reticle", (1.0, 0.08, 0.12), metallic=0.0, roughness=0.1, emission=(1.0, 0.08, 0.12), emission_strength=8.0),
        "tritium_green": make_mat("Tritium_Green", (0.12, 1.0, 0.32), metallic=0.0, roughness=0.1, emission=(0.12, 1.0, 0.32), emission_strength=6.0),
        "light_lens": make_mat("TacLight_Lens", (1.0, 0.85, 0.55), metallic=0.1, roughness=0.08, emission=(1.0, 0.82, 0.45), emission_strength=3.5),
    }


def link_obj(obj, parent=None):
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def set_smooth_weighted(obj):
    if obj.type != "MESH":
        return
    mesh = obj.data
    for poly in mesh.polygons:
        poly.use_smooth = True
    # Auto-bevel edges visually crisp via WeightedNormal or sharp split
    mod = obj.modifiers.new("EdgeSplit", "EDGE_SPLIT")
    mod.split_angle = math.radians(38)


def apply_bevel(obj, width=0.0014, segments=3):
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(28)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def boolean_cut(target, cutter):
    mod = target.modifiers.new("BoolCut", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.solver = "EXACT"
    mod.object = cutter
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def make_box(name, size, loc, mat, parent=None, rot=(0, 0, 0), bevel=0.0):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = Vector(loc)
    obj.rotation_euler = rot
    if mat:
        obj.data.materials.append(mat)
    link_obj(obj, parent)
    if bevel > 0:
        apply_bevel(obj, width=bevel, segments=2)
    set_smooth_weighted(obj)
    return obj


def make_cyl_y(name, radius, depth, loc, mat, parent=None, segs=32, bevel=0.0):
    """Cylinder aligned along Blender Y axis (barrel axis -> exported to Three.js -Z)."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=segs,
        radius1=radius,
        radius2=radius,
        depth=depth,
    )
    bmesh.ops.rotate(bm, matrix=Matrix.Rotation(math.radians(90), 3, "X"), verts=bm.verts)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = Vector(loc)
    if mat:
        obj.data.materials.append(mat)
    link_obj(obj, parent)
    if bevel > 0:
        apply_bevel(obj, width=bevel, segments=2)
    set_smooth_weighted(obj)
    return obj


def make_side_extrude(name, yz_points, width_x, mat, parent=None, x_offset=0.0, bevel=0.0018):
    """
    Create a sculpted side-profile mesh in Blender coordinates:
      Y = forward (toward muzzle)
      Z = up
      X = left/right thickness
    Note: glTF exporter automatically converts Blender (+Y forward, +Z up) -> glTF (-Z forward, +Y up)!
    """
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    half_x = width_x / 2.0

    verts_l = [bm.verts.new((-half_x + x_offset, y, z)) for (y, z) in yz_points]
    verts_r = [bm.verts.new((half_x + x_offset, y, z)) for (y, z) in yz_points]
    bm.verts.ensure_lookup_table()

    # Left & right cap faces
    bm.faces.new(verts_l)
    bm.faces.new(list(reversed(verts_r)))

    # Side walls
    n = len(yz_points)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([verts_l[i], verts_r[i], verts_r[j], verts_l[j]])

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    if mat:
        obj.data.materials.append(mat)
    link_obj(obj, parent)
    if bevel > 0:
        apply_bevel(obj, width=bevel, segments=3)
    set_smooth_weighted(obj)
    return obj


def build_pistol():
    clear_scene()
    mats = create_materials()

    # Root empty
    root = bpy.data.objects.new("PistolRoot", None)
    link_obj(root)

    # Sub-groups for Three.js animations
    frame_grp = bpy.data.objects.new("Frame", None)
    link_obj(frame_grp, root)

    slide_grp = bpy.data.objects.new("Slide", None)
    link_obj(slide_grp, root)

    trigger_grp = bpy.data.objects.new("Trigger", None)
    trigger_grp.location = Vector((0.0, 0.012, -0.004))
    link_obj(trigger_grp, root)

    mag_grp = bpy.data.objects.new("Magazine", None)
    link_obj(mag_grp, root)

    sup_grp = bpy.data.objects.new("Suppressor", None)
    sup_grp.location = Vector((0.0, 0.184, 0.036))
    link_obj(sup_grp, root)

    # ==========================================================================
    # 1. LOWER FDE POLYMER FRAME (Ergonomic M17X Grip, Beavertail, Undercut, Rail)
    # In Blender coords: +Y = forward (muzzle), +Z = up
    # ==========================================================================
    frame_profile = [
        (0.145, 0.022),   # Front dust cover top
        (-0.048, 0.022),  # Rear rail
        (-0.068, 0.017),  # Sculpted beavertail tip
        (-0.064, 0.007),  # Beavertail underside
        (-0.052, -0.002), # Tang web curve
        (-0.059, -0.028), # Upper backstrap swell
        (-0.072, -0.072), # Mid palm swell
        (-0.084, -0.114), # Grip heel
        (-0.030, -0.122), # Magwell front lip
        (-0.022, -0.078), # Grip frontstrap mid
        (-0.015, -0.038), # High trigger-guard undercut
        (-0.008, -0.018), # Under trigger guard rear
        (0.010, -0.005),  # Frame step
        (0.145, -0.005),  # Underbarrel dust cover bottom
    ]
    frame_body = make_side_extrude("FrameBody", frame_profile, 0.0295, mats["fde_frame"], frame_grp, bevel=0.0032)

    # Cut Picatinny cross-slots into the underbarrel dust cover!
    for i in range(4):
        cutter = make_box(f"RailCut_{i}", (0.036, 0.0045, 0.0045), (0.0, 0.088 + i * 0.012, -0.004), None)
        boolean_cut(frame_body, cutter)

    # Side stippled ergonomic grip panels (slightly proud, recessed texture feel)
    stipple_profile = [
        (-0.046, -0.012),
        (-0.066, -0.068),
        (-0.074, -0.106),
        (-0.036, -0.111),
        (-0.028, -0.068),
        (-0.022, -0.022),
    ]
    make_side_extrude("GripStipple", stipple_profile, 0.0322, mats["grip_stipple"], frame_grp, bevel=0.0014)

    # Sculpted Trigger Guard with squared front tactical rest
    tg_profile = [
        (0.056, -0.003),
        (0.054, -0.038),
        (0.046, -0.042),
        (-0.016, -0.042),
        (-0.018, -0.034),
        (0.043, -0.034),
        (0.046, -0.003),
    ]
    make_side_extrude("TriggerGuard", tg_profile, 0.0125, mats["fde_frame"], frame_grp, bevel=0.0018)

    # Controls: Takedown lever, ambidextrous slide catch, mag release, manual safety
    make_box("TakedownLever", (0.035, 0.018, 0.0065), (0.0, 0.048, 0.011), mats["dark_steel"], frame_grp, bevel=0.0012)
    make_box("SlideCatchL", (0.004, 0.028, 0.0075), (-0.0165, 0.008, 0.016), mats["dark_steel"], frame_grp, bevel=0.001)
    make_box("MagRelease", (0.033, 0.009, 0.009), (0.0, -0.022, -0.024), mats["dark_steel"], frame_grp, bevel=0.0012)
    make_box("ThumbSafetyL", (0.005, 0.016, 0.006), (-0.0168, -0.042, 0.015), mats["titanium"], frame_grp, rot=(0.2, 0, 0), bevel=0.001)

    # Underbarrel Tactical Weapon Light (SureFire X300U-B style)
    make_box("TacLightBody", (0.027, 0.058, 0.020), (0.0, 0.106, -0.017), mats["dark_steel"], frame_grp, bevel=0.0022)
    make_cyl_y("TacLightBezel", 0.0122, 0.036, (0.0, 0.146, -0.017), mats["slide_dlc"], frame_grp, segs=28, bevel=0.0012)
    make_cyl_y("TacLightLens", 0.0096, 0.003, (0.0, 0.164, -0.017), mats["light_lens"], frame_grp, segs=24)
    # Rocker switch paddles behind light
    make_box("TacSwitchL", (0.004, 0.014, 0.010), (-0.014, 0.072, -0.016), mats["grip_stipple"], frame_grp, bevel=0.0008)
    make_box("TacSwitchR", (0.004, 0.014, 0.010), (0.014, 0.072, -0.016), mats["grip_stipple"], frame_grp, bevel=0.0008)

    # ==========================================================================
    # 2. MATCH STAINLESS BARREL + RECESSED BORE + DUAL-PORT COMPENSATOR
    # ==========================================================================
    barrel = make_cyl_y("MatchBarrel", 0.0086, 0.175, (0.0, 0.082, 0.037), mats["stainless"], frame_grp, segs=32)
    # Recessed real hollow bore via Boolean!
    bore_cutter = make_cyl_y("BoreCutter", 0.0048, 0.045, (0.0, 0.158, 0.037), None, segs=24)
    boolean_cut(barrel, bore_cutter)
    # Dark interior plug deep inside bore
    make_cyl_y("BorePlug", 0.0047, 0.004, (0.0, 0.140, 0.037), mats["bore_black"], frame_grp, segs=16)
    # Chamber hood block (visible in ejection port)
    make_box("BarrelHood", (0.019, 0.038, 0.016), (0.0, 0.044, 0.042), mats["stainless"], frame_grp, bevel=0.0018)

    # CNC-Machined Compensator on threaded muzzle
    comp = make_box("Compensator", (0.029, 0.034, 0.032), (0.0, 0.168, 0.037), mats["dark_steel"], frame_grp, bevel=0.0032)
    # Cut bullet exit bore + top gas expansion port + side ports
    boolean_cut(comp, make_cyl_y("CompBore", 0.0056, 0.042, (0.0, 0.168, 0.037), None, segs=20))
    boolean_cut(comp, make_box("CompTopPort", (0.014, 0.015, 0.018), (0.0, 0.168, 0.052), None))
    boolean_cut(comp, make_box("CompSidePort", (0.036, 0.012, 0.010), (0.0, 0.168, 0.037), None))

    # ==========================================================================
    # 3. RECIPROCATING CNC-MACHINED SLIDE (Boolean Serrations + Ejection Port!)
    # ==========================================================================
    # Octagonal/chamfered cross-section slide extruded along Y
    slide_profile_xz = [
        (-0.0158, 0.021),
        (0.0158, 0.021),
        (0.0158, 0.048),
        (0.0112, 0.055),
        (-0.0112, 0.055),
        (-0.0158, 0.048),
    ]
    mesh = bpy.data.meshes.new("SlideBody")
    bm = bmesh.new()
    y0, y1 = -0.048, 0.148
    v_back = [bm.verts.new((x, y0, z)) for (x, z) in slide_profile_xz]
    v_front = [bm.verts.new((x, y1, z)) for (x, z) in slide_profile_xz]
    bm.faces.new(list(reversed(v_back)))
    bm.faces.new(v_front)
    n = len(slide_profile_xz)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([v_back[i], v_back[j], v_front[j], v_front[i]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    slide_body = bpy.data.objects.new("SlideBody", mesh)
    slide_body.data.materials.append(mats["slide_dlc"])
    link_obj(slide_body, slide_grp)
    apply_bevel(slide_body, width=0.0014, segments=2)

    # Boolean Cut 1: Recessed Ejection Port on right-top of slide!
    ej_cut = make_box("EjectionPortCut", (0.022, 0.040, 0.022), (0.009, 0.044, 0.047), None)
    boolean_cut(slide_body, ej_cut)

    # Boolean Cut 2: Angled Rear & Front Slide Serrations (true physical grooves!)
    for i in range(6):
        y_rear = -0.036 + i * 0.0058
        c_l = make_box(f"SerRL_{i}", (0.0032, 0.0024, 0.026), (-0.0158, y_rear, 0.037), None, rot=(0.14, 0, 0))
        c_r = make_box(f"SerRR_{i}", (0.0032, 0.0024, 0.026), (0.0158, y_rear, 0.037), None, rot=(0.14, 0, 0))
        boolean_cut(slide_body, c_l)
        boolean_cut(slide_body, c_r)

    for i in range(5):
        y_front = 0.106 + i * 0.0058
        c_l = make_box(f"SerFL_{i}", (0.0032, 0.0024, 0.022), (-0.0158, y_front, 0.037), None, rot=(0.14, 0, 0))
        c_r = make_box(f"SerFR_{i}", (0.0032, 0.0024, 0.022), (0.0158, y_front, 0.037), None, rot=(0.14, 0, 0))
        boolean_cut(slide_body, c_l)
        boolean_cut(slide_body, c_r)

    # Boolean Cut 3: Front muzzle barrel opening in slide
    boolean_cut(slide_body, make_cyl_y("SlideMuzzleCut", 0.0092, 0.022, (0.0, 0.146, 0.037), None, segs=20))
    set_smooth_weighted(slide_body)

    # Trijicon RMR Micro Red-Dot Reflex Sight mounted on Slide
    make_box("RMR_Base", (0.028, 0.045, 0.0065), (0.0, 0.002, 0.058), mats["dark_steel"], slide_grp, bevel=0.0012)
    make_box("RMR_WallL", (0.0038, 0.024, 0.023), (-0.0124, -0.004, 0.071), mats["slide_dlc"], slide_grp, bevel=0.0009)
    make_box("RMR_WallR", (0.0038, 0.024, 0.023), (0.0124, -0.004, 0.071), mats["slide_dlc"], slide_grp, bevel=0.0009)
    make_box("RMR_EarL", (0.010, 0.024, 0.0038), (-0.0092, -0.004, 0.082), mats["slide_dlc"], slide_grp, rot=(0, -0.18, 0), bevel=0.0008)
    make_box("RMR_EarR", (0.010, 0.024, 0.0038), (0.0092, -0.004, 0.082), mats["slide_dlc"], slide_grp, rot=(0, 0.18, 0), bevel=0.0008)
    make_box("RMR_Bridge", (0.011, 0.024, 0.0030), (0.0, -0.004, 0.0805), mats["slide_dlc"], slide_grp, bevel=0.0006)
    make_box("RMR_Glass", (0.021, 0.0014, 0.018), (0.0, -0.004, 0.071), mats["optic_glass"], slide_grp)
    make_cyl_y("RMR_Dot", 0.0013, 0.0016, (0.0, -0.0045, 0.071), mats["red_dot"], slide_grp, segs=12)

    # Suppressor-Height Tritium Iron Sights (Front + Rear)
    make_box("FrontSight", (0.0040, 0.009, 0.010), (0.0, 0.138, 0.060), mats["dark_steel"], slide_grp, bevel=0.0007)
    make_box("FrontTritium", (0.0024, 0.0015, 0.0028), (0.0, 0.133, 0.062), mats["tritium_green"], slide_grp)
    make_box("RearSightL", (0.0055, 0.008, 0.009), (-0.0055, -0.036, 0.059), mats["dark_steel"], slide_grp, bevel=0.0007)
    make_box("RearSightR", (0.0055, 0.008, 0.009), (0.0055, -0.036, 0.059), mats["dark_steel"], slide_grp, bevel=0.0007)
    make_box("RearTritL", (0.0018, 0.0012, 0.0020), (-0.0055, -0.0405, 0.060), mats["tritium_green"], slide_grp)
    make_box("RearTritR", (0.0018, 0.0012, 0.0020), (0.0055, -0.0405, 0.060), mats["tritium_green"], slide_grp)

    # ==========================================================================
    # 4. SKELETONIZED MATCH TRIGGER (Animated around Trigger pivot)
    # ==========================================================================
    make_box("MatchTrigger", (0.0062, 0.007, 0.028), (0.0, 0.0, -0.014), mats["titanium"], trigger_grp, rot=(0.24, 0, 0), bevel=0.001)

    # ==========================================================================
    # 5. EXTENDED 17+2 MAGAZINE WITH FDE BASEPAD (Animated on reload)
    # ==========================================================================
    make_box("MagTube", (0.022, 0.035, 0.112), (0.0, -0.050, -0.074), mats["dark_steel"], mag_grp, rot=(-0.22, 0, 0), bevel=0.0015)
    make_box("MagBasepad", (0.032, 0.048, 0.019), (0.0, -0.062, -0.128), mats["fde_dark"], mag_grp, rot=(-0.22, 0, 0), bevel=0.0026)

    # ==========================================================================
    # 6. DETACHABLE KNURLED TACTICAL SUPPRESSOR (Toggled via S key)
    # ==========================================================================
    make_cyl_y("SupCollar", 0.019, 0.022, (0.0, 0.011, 0.0), mats["slide_dlc"], sup_grp, segs=28, bevel=0.001)
    sup_body = make_cyl_y("SupBody", 0.017, 0.175, (0.0, 0.088, 0.0), mats["dark_steel"], sup_grp, segs=32, bevel=0.0012)
    boolean_cut(sup_body, make_cyl_y("SupBoreCut", 0.0065, 0.028, (0.0, 0.170, 0.0), None, segs=18))
    make_cyl_y("SupBorePlug", 0.0064, 0.003, (0.0, 0.158, 0.0), mats["bore_black"], sup_grp, segs=16)
    for i in range(1, 7):
        make_cyl_y(f"SupRing_{i}", 0.0178, 0.0065, (0.0, 0.175 * (i / 7.0), 0.0), mats["slide_dlc"], sup_grp, segs=28)

    # ==========================================================================
    # EXPORT TO GLB (Standard glTF Y-up)
    # ==========================================================================
    bpy.ops.export_scene.gltf(
        filepath=OUT_PATH,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_materials="EXPORT",
    )
    print(f"EXPORTED_OK: {OUT_PATH}")


if __name__ == "__main__":
    build_pistol()
