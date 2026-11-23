import bpy
import sys
import os
import bmesh
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
from blender_utils import (
    clear_scene, create_materials, link_obj, boolean_cut,
    make_box, make_cyl_y, make_cyl_x, make_cyl_z, make_side_extrude,
    add_picatinny_rail, add_hollow_barrel, add_suppressor_group,
    set_smooth_weighted, export_glb
)

def make_sphere(name, radius, loc, mat, parent):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=14, radius=radius)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = Vector(loc)
    obj.data.materials.append(mat)
    link_obj(obj, parent)
    set_smooth_weighted(obj)
    return obj

def build_mrad():
    clear_scene()
    mats = create_materials()

    root = bpy.data.objects.new("SniperRoot", None)
    link_obj(root)

    frame_grp = bpy.data.objects.new("Frame", None)
    link_obj(frame_grp, root)

    bolt_grp = bpy.data.objects.new("BoltHandle", None)
    bolt_grp.location = Vector((0.0, -0.045, 0.034))
    link_obj(bolt_grp, root)

    trigger_grp = bpy.data.objects.new("Trigger", None)
    trigger_grp.location = Vector((0.0, -0.028, -0.022))
    link_obj(trigger_grp, root)

    mag_grp = bpy.data.objects.new("Magazine", None)
    link_obj(mag_grp, root)

    # 1. Monolithic CNC FDE Chassis Upper & Lower
    upper = make_box("MRAD_Upper", (0.048, 0.306, 0.062), (0.0, 0.030, 0.030), mats["fde_tan"], frame_grp, bevel=0.0042)
    boolean_cut(upper, make_box("EjectCut", (0.022, 0.095, 0.026), (0.018, 0.015, 0.036), None))
    make_box("MRAD_Lower", (0.044, 0.246, 0.048), (0.0, 0.010, -0.012), mats["fde_dark"], frame_grp, bevel=0.0034)
    for y_pin in [0.14, 0.04, -0.08]:
        make_cyl_x(f"ChassisPin_{y_pin}", 0.004, 0.052, (0.0, y_pin, 0.008), mats["titanium"], frame_grp)

    # 2. Hollow Octagonal M-LOK Handguard with REAL Boolean M-LOK Slots!
    hg = make_box("MRAD_Handguard", (0.046, 0.386, 0.056), (0.0, 0.370, 0.032), mats["fde_tan"], frame_grp, bevel=0.0068)
    boolean_cut(hg, make_cyl_y("HG_Hollow", 0.0185, 0.396, (0.0, 0.370, 0.034), None, segs=22))
    for i in range(6):
        y_s = 0.22 + i * 0.054
        boolean_cut(hg, make_box(f"MLOK_S_{i}", (0.054, 0.034, 0.011), (0.0, y_s, 0.032), None))
        boolean_cut(hg, make_box(f"MLOK_B_{i}", (0.011, 0.032, 0.022), (0.0, y_s, 0.010), None))

    # Full-length Monolithic Top Picatinny Rail
    add_picatinny_rail("TopRail", 0.67, 0.026, 0.22, 0.064, mats["anodized"], frame_grp)

    # 3. Long Heavy 6-Flute Precision Barrel + Hollow Bore + Barrett Twin-Baffle Muzzle Brake
    add_hollow_barrel("MRAD_Barrel", 0.0155, 0.68, 0.63, 0.034, mats["dark_steel"], mats["bore_black"], frame_grp, fluted=True)

    brake = make_box("BarrettBrake", (0.054, 0.108, 0.034), (0.0, 1.005, 0.034), mats["anodized"], frame_grp, bevel=0.003)
    boolean_cut(brake, make_cyl_y("BrakeBore", 0.0095, 0.118, (0.0, 1.005, 0.034), None, segs=20))
    boolean_cut(brake, make_box("Baffle1", (0.062, 0.024, 0.020), (0.0, 0.978, 0.034), None))
    boolean_cut(brake, make_box("Baffle2", (0.062, 0.024, 0.020), (0.0, 1.026, 0.034), None))

    # Heavy Tactical Bipod mounted forward
    make_box("BipodMount", (0.042, 0.036, 0.020), (0.0, 0.52, -0.008), mats["anodized"], frame_grp, bevel=0.002)
    make_cyl_y("BipodLegL", 0.0082, 0.22, (-0.032, 0.41, -0.028), mats["titanium"], frame_grp, segs=14)
    make_cyl_y("BipodLegR", 0.0082, 0.22, (0.032, 0.41, -0.028), mats["titanium"], frame_grp, segs=14)

    # 4. Animated Fluted Bolt Body & Oversized Knurled Bolt Handle
    make_cyl_y("BoltBody", 0.012, 0.106, (0.0, 0.030, 0.0), mats["stainless"], bolt_grp, segs=20)
    make_box("BoltArm", (0.048, 0.010, 0.009), (0.028, -0.012, -0.006), mats["dark_steel"], bolt_grp, rot=(0, 0.35, 0), bevel=0.0014)
    make_sphere("BoltKnob", 0.0138, (0.052, -0.012, -0.016), mats["grip_stipple"], bolt_grp)

    # 5. Precision Pistol Grip, Trigger Guard & Match Trigger
    grip_profile = [
        (-0.048, -0.028),
        (-0.098, -0.028),
        (-0.112, -0.130),
        (-0.068, -0.136),
        (-0.050, -0.042),
    ]
    make_side_extrude("PistolGrip", grip_profile, 0.032, mats["polymer"], frame_grp, bevel=0.0032)
    make_box("TriggerGuard", (0.012, 0.062, 0.006), (0.0, -0.018, -0.052), mats["anodized"], frame_grp, bevel=0.001)
    make_box("MatchTrigger", (0.006, 0.007, 0.026), (0.0, 0.0, -0.013), mats["stainless"], trigger_grp, rot=(0.15, 0, 0), bevel=0.001)

    # 6. 10-Round .338 Lapua Box Magazine
    make_box("MagBody", (0.034, 0.095, 0.125), (0.0, 0.075, -0.085), mats["anodized"], mag_grp, bevel=0.0024)
    make_box("MagBase", (0.038, 0.100, 0.015), (0.0, 0.075, -0.150), mats["grip_stipple"], mag_grp, bevel=0.002)

    # 7. Skeletonized Precision Folding Stock with Adjustable Cheek Riser
    make_box("StockTopRail", (0.038, 0.266, 0.030), (0.0, -0.252, 0.034), mats["fde_tan"], frame_grp, bevel=0.003)
    make_box("StockStrut", (0.034, 0.226, 0.020), (0.0, -0.252, -0.032), mats["fde_dark"], frame_grp, rot=(-0.12, 0, 0), bevel=0.0025)
    make_box("CheekRiser", (0.044, 0.136, 0.024), (0.0, -0.232, 0.062), mats["grip_stipple"], frame_grp, bevel=0.004)
    make_box("Buttpad", (0.046, 0.026, 0.128), (0.0, -0.382, 0.002), mats["grip_stipple"], frame_grp, bevel=0.004)

    # 8. High-Power Nightforce 34mm Tactical Scope + Cantilevered Spuhr Mount
    sy, sz = 0.06, 0.072
    make_box("ScopeMountBase", (0.030, 0.152, 0.016), (0.0, sy + 0.005, sz + 0.008), mats["anodized"], frame_grp, bevel=0.0018)
    for dy in [0.06, -0.052]:
        make_box(f"RingBase_{dy}", (0.032, 0.024, 0.026), (0.0, sy + dy, sz + 0.022), mats["dark_steel"], frame_grp, bevel=0.0016)
        make_cyl_y(f"Ring_{dy}", 0.0225, 0.025, (0.0, sy + dy, sz + 0.038), mats["dark_steel"], frame_grp, segs=22)
        make_cyl_x(f"RingBolt_{dy}", 0.0025, 0.044, (0.0, sy + dy, sz + 0.038), mats["titanium"], frame_grp)
    # Main tube + flared objective bell + sunshade
    make_cyl_y("ScopeTube", 0.018, 0.25, (0.0, sy, sz + 0.038), mats["gunmetal"], frame_grp, segs=26)
    make_cyl_y("ScopeBellF", 0.018, 0.062, (0.0, sy + 0.142, sz + 0.038), mats["gunmetal"], frame_grp, segs=28, r2=0.031)
    shade = make_cyl_y("ScopeSunshade", 0.032, 0.088, (0.0, sy + 0.215, sz + 0.038), mats["dark_steel"], frame_grp, segs=28, bevel=0.001)
    boolean_cut(shade, make_cyl_y("ShadeHollow", 0.0285, 0.055, (0.0, sy + 0.238, sz + 0.038), None, segs=24))
    make_cyl_y("FrontLens", 0.028, 0.003, (0.0, sy + 0.212, sz + 0.038), mats["scope_lens"], frame_grp, segs=24)
    # Rear magnification ring, throw lever & eyepiece
    make_cyl_y("MagRing", 0.023, 0.022, (0.0, sy - 0.115, sz + 0.038), mats["grip_stipple"], frame_grp, segs=24)
    make_box("ThrowLever", (0.006, 0.008, 0.026), (0.018, sy - 0.115, sz + 0.056), mats["titanium"], frame_grp, rot=(0, 0.5, 0), bevel=0.001)
    make_cyl_y("EyepieceBell", 0.025, 0.048, (0.0, sy - 0.145, sz + 0.038), mats["gunmetal"], frame_grp, segs=24, r2=0.018)
    make_cyl_y("Eyepiece", 0.026, 0.036, (0.0, sy - 0.184, sz + 0.038), mats["grip_stipple"], frame_grp, segs=24)
    make_cyl_y("RearLens", 0.021, 0.003, (0.0, sy - 0.201, sz + 0.038), mats["scope_lens"], frame_grp, segs=22)
    # Precision Turrets
    make_cyl_z("ElevTurret", 0.014, 0.026, (0.0, sy + 0.005, sz + 0.064), mats["anodized"], frame_grp, segs=22)
    make_cyl_z("ElevCap", 0.015, 0.005, (0.0, sy + 0.005, sz + 0.076), mats["titanium"], frame_grp, segs=22)
    make_cyl_x("WindTurret", 0.012, 0.024, (0.029, sy + 0.005, sz + 0.038), mats["anodized"], frame_grp, segs=20)
    make_cyl_x("ParaTurret", 0.012, 0.022, (-0.028, sy + 0.005, sz + 0.038), mats["anodized"], frame_grp, segs=20)

    # 9. Large-Caliber .338 Suppressor
    add_suppressor_group("Suppressor", 0.026, 0.26, 1.055, 0.034, mats, root)

    export_glb("sniper_mrad.glb")

if __name__ == "__main__":
    build_mrad()
