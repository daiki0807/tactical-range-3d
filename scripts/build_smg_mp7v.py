import bpy
import sys
import os
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
from blender_utils import (
    clear_scene, create_materials, link_obj, boolean_cut,
    make_box, make_cyl_y, make_cyl_x, make_side_extrude,
    add_picatinny_rail, add_hollow_barrel, add_eotech_holo,
    add_suppressor_group, export_glb
)

def build_mp7():
    clear_scene()
    mats = create_materials()

    root = bpy.data.objects.new("SMGRoot", None)
    link_obj(root)

    frame_grp = bpy.data.objects.new("Frame", None)
    link_obj(frame_grp, root)

    bolt_grp = bpy.data.objects.new("Bolt", None)
    bolt_grp.location = Vector((0.020, 0.025, 0.044))
    link_obj(bolt_grp, root)

    trigger_grp = bpy.data.objects.new("Trigger", None)
    trigger_grp.location = Vector((0.0, 0.030, -0.016))
    link_obj(trigger_grp, root)

    mag_grp = bpy.data.objects.new("Magazine", None)
    link_obj(mag_grp, root)

    # 1. Sculpted Angular MP7-V PDW Polymer/Tungsten Chassis (Blender +Y = forward)
    body_profile = [
        (0.256, 0.068),
        (-0.105, 0.068),
        (-0.108, -0.010),
        (-0.052, -0.018),
        (-0.065, -0.118),
        (-0.018, -0.122),
        (-0.004, -0.022),
        (0.088, -0.022),
        (0.106, -0.010),
        (0.256, -0.006),
    ]
    body = make_side_extrude("MP7_Chassis", body_profile, 0.044, mats["tungsten"], frame_grp, bevel=0.0034)

    # Boolean-cut realistic side cooling vents & recessed ejection port!
    for i in range(4):
        boolean_cut(body, make_box(f"VentCut_{i}", (0.052, 0.024, 0.009), (0.0, 0.135 + i * 0.032, 0.032), None))
    boolean_cut(body, make_box("EjectCut", (0.018, 0.064, 0.022), (0.018, 0.025, 0.044), None))

    # Upper anodized steel rail shroud + continuous top Picatinny rail
    make_box("UpperShroud", (0.040, 0.352, 0.024), (0.0, 0.074, 0.062), mats["anodized"], frame_grp, bevel=0.0024)
    add_picatinny_rail("TopRail", 0.34, 0.024, 0.074, 0.076, mats["dark_steel"], frame_grp)

    # Stippled center pistol grip panels
    stipple_profile = [
        (-0.048, -0.024),
        (-0.059, -0.112),
        (-0.022, -0.115),
        (-0.012, -0.024),
    ]
    make_side_extrude("GripStipple", stipple_profile, 0.047, mats["grip_stipple"], frame_grp, bevel=0.0014)

    # Takedown pins & ambidextrous fire selector with red mark
    make_cyl_x("PinRear", 0.004, 0.048, (0.0, -0.082, 0.006), mats["titanium"], frame_grp)
    make_cyl_x("PinMid", 0.0036, 0.048, (0.0, 0.008, 0.002), mats["titanium"], frame_grp)
    make_box("Selector", (0.006, 0.020, 0.008), (-0.024, -0.022, 0.004), mats["anodized"], frame_grp, bevel=0.001)
    make_box("SafetyDot", (0.002, 0.004, 0.004), (-0.025, -0.018, 0.012), mats["safety_red"], frame_grp)

    # Side-mounted PEQ-15 IR/Green Laser Box
    make_box("PEQ15_Body", (0.022, 0.084, 0.026), (0.032, 0.165, 0.042), mats["fde_dark"], frame_grp, bevel=0.0022)
    make_cyl_y("PEQ15_Emitter", 0.0042, 0.004, (0.034, 0.208, 0.044), mats["green_glow"], frame_grp, segs=14)

    # Sculpted Trigger Guard & Match Trigger
    tg_profile = [
        (0.082, -0.018),
        (0.075, -0.052),
        (-0.008, -0.052),
        (-0.010, -0.044),
        (0.068, -0.044),
        (0.074, -0.018),
    ]
    make_side_extrude("TriggerGuard", tg_profile, 0.014, mats["polymer"], frame_grp, bevel=0.0015)
    make_box("TriggerBlade", (0.0065, 0.008, 0.026), (0.0, 0.0, -0.013), mats["titanium"], trigger_grp, rot=(0.2, 0, 0), bevel=0.001)

    # Folding Tactical Foregrip
    make_box("Foregrip", (0.024, 0.028, 0.096), (0.0, 0.195, -0.062), mats["grip_stipple"], frame_grp, rot=(0.08, 0, 0), bevel=0.003)

    # Dual-rod Retractable Steel Wire Stock + Rubber Buttpad
    make_cyl_y("StockRodL", 0.0052, 0.22, (-0.022, -0.20, 0.036), mats["titanium"], frame_grp, segs=14)
    make_cyl_y("StockRodR", 0.0052, 0.22, (0.022, -0.20, 0.036), mats["titanium"], frame_grp, segs=14)
    make_box("Buttpad", (0.050, 0.026, 0.114), (0.0, -0.308, 0.008), mats["grip_stipple"], frame_grp, bevel=0.004)

    # Hollow Barrel + Pronged Flash Hider
    add_hollow_barrel("MP7_Barrel", 0.010, 0.12, 0.305, 0.034, mats["dark_steel"], mats["bore_black"], frame_grp)
    fh = make_cyl_y("FlashHider", 0.0138, 0.038, (0.0, 0.348, 0.034), mats["gunmetal"], frame_grp, segs=18, bevel=0.001)
    boolean_cut(fh, make_cyl_y("FHBore", 0.0075, 0.044, (0.0, 0.348, 0.034), None, segs=16))
    boolean_cut(fh, make_box("FHSlot1", (0.032, 0.018, 0.005), (0.0, 0.354, 0.034), None))
    boolean_cut(fh, make_box("FHSlot2", (0.005, 0.018, 0.032), (0.0, 0.354, 0.034), None))

    # Extended 40-Round Magazine
    make_box("MagBody", (0.025, 0.036, 0.188), (0.0, -0.044, -0.122), mats["dark_steel"], mag_grp, rot=(-0.14, 0, 0), bevel=0.0018)
    make_box("MagBase", (0.032, 0.044, 0.016), (0.0, -0.057, -0.212), mats["polymer"], mag_grp, rot=(-0.14, 0, 0), bevel=0.002)

    # Reciprocating Chrome Bolt Carrier
    make_box("BoltCarrier", (0.011, 0.058, 0.020), (0.0, 0.0, 0.0), mats["stainless"], bolt_grp, bevel=0.0012)

    # EOTech Holographic Sight
    add_eotech_holo(0.045, 0.081, mats, frame_grp)

    # Detachable Suppressor
    add_suppressor_group("Suppressor", 0.020, 0.20, 0.366, 0.034, mats, root)

    export_glb("smg_mp7v.glb")

if __name__ == "__main__":
    build_mp7()
