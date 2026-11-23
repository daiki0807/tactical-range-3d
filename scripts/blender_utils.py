import bpy
import bmesh
import math
import os
from mathutils import Vector, Matrix

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def make_mat(name, base_color, metallic=0.0, roughness=0.5, emission=None, emission_strength=0.0, alpha=1.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        if "Transmission Weight" in bsdf.inputs:
            bsdf.inputs["Transmission Weight"].default_value = 0.78
    if emission is not None and "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat

def create_materials():
    return {
        "gunmetal": make_mat("Gunmetal_CNC", (0.14, 0.16, 0.19), metallic=0.88, roughness=0.28),
        "dark_steel": make_mat("Dark_Steel", (0.07, 0.08, 0.095), metallic=0.90, roughness=0.25),
        "anodized": make_mat("Anodized_Black", (0.045, 0.052, 0.064), metallic=0.84, roughness=0.32),
        "tungsten": make_mat("Tungsten_Gray", (0.22, 0.25, 0.29), metallic=0.82, roughness=0.30),
        "stainless": make_mat("Stainless_Chrome", (0.78, 0.81, 0.86), metallic=0.97, roughness=0.14),
        "titanium": make_mat("Titanium_Satin", (0.48, 0.52, 0.58), metallic=0.92, roughness=0.24),
        "fde_tan": make_mat("FDE_Cerakote", (0.56, 0.45, 0.30), metallic=0.16, roughness=0.48),
        "fde_dark": make_mat("FDE_Dark", (0.37, 0.29, 0.19), metallic=0.14, roughness=0.56),
        "olive_drab": make_mat("Olive_Drab", (0.20, 0.25, 0.16), metallic=0.16, roughness=0.54),
        "polymer": make_mat("Polymer_Matte", (0.085, 0.092, 0.105), metallic=0.06, roughness=0.72),
        "grip_stipple": make_mat("Grip_Stipple", (0.06, 0.065, 0.075), metallic=0.04, roughness=0.88),
        "brass": make_mat("Brass_Casing", (0.82, 0.60, 0.18), metallic=0.95, roughness=0.18),
        "copper": make_mat("Copper_Jacket", (0.72, 0.34, 0.16), metallic=0.92, roughness=0.22),
        "bore_black": make_mat("Bore_Black", (0.01, 0.01, 0.012), metallic=0.0, roughness=1.0),
        "safety_red": make_mat("Safety_Red", (0.82, 0.08, 0.08), metallic=0.1, roughness=0.35),
        "optic_glass": make_mat("Optic_Glass", (0.18, 0.62, 0.95), metallic=0.08, roughness=0.04, alpha=0.32),
        "scope_lens": make_mat("Scope_Emerald_Lens", (0.04, 0.32, 0.26), metallic=0.92, roughness=0.06, emission=(0.02, 0.14, 0.12), emission_strength=0.8),
        "red_dot": make_mat("Red_Reticle", (1.0, 0.08, 0.12), metallic=0.0, roughness=0.1, emission=(1.0, 0.08, 0.12), emission_strength=8.0),
        "green_glow": make_mat("Green_Laser", (0.12, 1.0, 0.32), metallic=0.0, roughness=0.1, emission=(0.12, 1.0, 0.32), emission_strength=6.0),
    }

def link_obj(obj, parent=None):
    bpy.context.scene.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj

def set_smooth_weighted(obj):
    if obj.type != "MESH":
        return
    for poly in obj.data.polygons:
        poly.use_smooth = True
    mod = obj.modifiers.new("EdgeSplit", "EDGE_SPLIT")
    mod.split_angle = math.radians(38)

def apply_bevel(obj, width=0.0014, segments=2):
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

def make_cyl_y(name, r1, depth, loc, mat, parent=None, segs=28, r2=None, bevel=0.0):
    if r2 is None:
        r2 = r1
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r1, radius2=r2, depth=depth)
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

def make_cyl_x(name, radius, depth, loc, mat, parent=None, segs=16):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=radius, radius2=radius, depth=depth)
    bmesh.ops.rotate(bm, matrix=Matrix.Rotation(math.radians(90), 3, "Y"), verts=bm.verts)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = Vector(loc)
    if mat:
        obj.data.materials.append(mat)
    link_obj(obj, parent)
    set_smooth_weighted(obj)
    return obj

def make_cyl_z(name, radius, depth, loc, mat, parent=None, segs=20):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=radius, radius2=radius, depth=depth)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = Vector(loc)
    if mat:
        obj.data.materials.append(mat)
    link_obj(obj, parent)
    set_smooth_weighted(obj)
    return obj

def make_side_extrude(name, yz_points, width_x, mat, parent=None, x_offset=0.0, bevel=0.0018):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    hx = width_x / 2.0
    vl = [bm.verts.new((-hx + x_offset, y, z)) for (y, z) in yz_points]
    vr = [bm.verts.new((hx + x_offset, y, z)) for (y, z) in yz_points]
    bm.faces.new(vl)
    bm.faces.new(list(reversed(vr)))
    n = len(yz_points)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([vl[i], vr[i], vr[j], vl[j]])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    if mat:
        obj.data.materials.append(mat)
    link_obj(obj, parent)
    if bevel > 0:
        apply_bevel(obj, width=bevel, segments=2)
    set_smooth_weighted(obj)
    return obj

def add_picatinny_rail(name, length, width, y_center, z_base, mat, parent):
    """Single-piece Picatinny rail with repeating teeth."""
    make_box(f"{name}_Base", (width * 0.82, length, 0.005), (0.0, y_center, z_base), mat, parent, bevel=0.0008)
    step = 0.013
    count = int(length / step)
    start_y = y_center - length / 2.0 + step * 0.5
    for i in range(count):
        make_box(f"{name}_T{i}", (width, 0.0068, 0.0046), (0.0, start_y + i * step, z_base + 0.0042), mat, parent)

def add_hollow_barrel(name, radius, length, y_center, z_height, mat, bore_mat, parent, fluted=False):
    barrel = make_cyl_y(name, radius, length, (0.0, y_center, z_height), mat, parent, segs=32)
    # Hollow muzzle bore cut
    boolean_cut(barrel, make_cyl_y(f"{name}_BoreCut", radius * 0.56, 0.05, (0.0, y_center + length / 2.0 - 0.018, z_height), None, segs=20))
    make_cyl_y(f"{name}_BorePlug", radius * 0.55, 0.004, (0.0, y_center + length / 2.0 - 0.042, z_height), bore_mat, parent, segs=16)
    if fluted:
        for i in range(6):
            a = (i / 6.0) * math.pi * 2.0
            fx = math.cos(a) * (radius * 0.96)
            fz = z_height + math.sin(a) * (radius * 0.96)
            boolean_cut(barrel, make_cyl_y(f"{name}_Flute{i}", radius * 0.19, length * 0.72, (fx, y_center, fz), None, segs=12))
    return barrel

def add_eotech_holo(y_pos, z_base, mats, parent):
    """Detailed EOTech EXPS3 Holographic Sight with glowing circle-dot reticle."""
    make_box("Holo_Mount", (0.036, 0.088, 0.014), (0.0, y_pos, z_base + 0.007), mats["anodized"], parent, bevel=0.0016)
    make_box("Holo_QD", (0.008, 0.028, 0.010), (-0.021, y_pos - 0.008, z_base + 0.008), mats["gunmetal"], parent, bevel=0.0012)
    make_cyl_x("Holo_Windage", 0.0045, 0.006, (0.020, y_pos + 0.006, z_base + 0.018), mats["titanium"], parent)
    # Armored hood
    make_box("Holo_WallL", (0.0055, 0.066, 0.044), (-0.020, y_pos + 0.004, z_base + 0.034), mats["gunmetal"], parent, bevel=0.0014)
    make_box("Holo_WallR", (0.0055, 0.066, 0.044), (0.020, y_pos + 0.004, z_base + 0.034), mats["gunmetal"], parent, bevel=0.0014)
    make_box("Holo_Top", (0.046, 0.066, 0.0055), (0.0, y_pos + 0.004, z_base + 0.056), mats["gunmetal"], parent, bevel=0.0014)
    # Front battery compartment
    make_cyl_y("Holo_Batt", 0.011, 0.034, (0.0, y_pos + 0.048, z_base + 0.022), mats["dark_steel"], parent, segs=18)
    make_cyl_x("Holo_BattCap", 0.009, 0.042, (0.0, y_pos + 0.048, z_base + 0.022), mats["anodized"], parent, segs=18)
    # Glass & glowing reticle
    make_box("Holo_Glass", (0.034, 0.0015, 0.036), (0.0, y_pos - 0.004, z_base + 0.035), mats["optic_glass"], parent)
    # Reticle ring (hollow cylinder) + center dot
    ring = make_cyl_y("Holo_Ring", 0.0078, 0.0012, (0.0, y_pos - 0.005, z_base + 0.035), mats["red_dot"], parent, segs=24)
    boolean_cut(ring, make_cyl_y("Holo_RingCut", 0.0064, 0.004, (0.0, y_pos - 0.005, z_base + 0.035), None, segs=24))
    make_cyl_y("Holo_Dot", 0.0013, 0.0015, (0.0, y_pos - 0.0052, z_base + 0.035), mats["red_dot"], parent, segs=12)

def add_suppressor_group(name, radius, length, loc_y, loc_z, mats, root):
    sup_grp = bpy.data.objects.new(name, None)
    sup_grp.location = Vector((0.0, loc_y, loc_z))
    link_obj(sup_grp, root)
    make_cyl_y("SupCollar", radius * 1.12, 0.024, (0.0, 0.012, 0.0), mats["gunmetal"], sup_grp, segs=28, bevel=0.001)
    body = make_cyl_y("SupBody", radius, length, (0.0, length / 2.0, 0.0), mats["anodized"], sup_grp, segs=32, bevel=0.0012)
    boolean_cut(body, make_cyl_y("SupBoreCut", radius * 0.42, 0.032, (0.0, length - 0.012, 0.0), None, segs=18))
    make_cyl_y("SupBorePlug", radius * 0.41, 0.003, (0.0, length - 0.026, 0.0), mats["bore_black"], sup_grp, segs=16)
    for i in range(1, 7):
        make_cyl_y(f"SupRing_{i}", radius * 1.04, 0.007, (0.0, length * (i / 7.0), 0.0), mats["dark_steel"], sup_grp, segs=28)
    return sup_grp

def export_glb(rel_filename):
    out_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public", "models", rel_filename))
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_materials="EXPORT",
    )
    print(f"EXPORTED_OK: {out_path}")
