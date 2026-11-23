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

def build_hk416():
    clear_scene()
    mats = create_materials()

    root = bpy.data.objects.new("RifleRoot", None)
    link_obj(root)

    frame_grp = bpy.data.objects.new("Frame", None)
    link_obj(frame_grp, root)

    bolt_grp = bpy.data.objects.new("Bolt", None)
    bolt_grp.location = Vector((0.019, 0.025, 0.036))
    link_obj(bolt_grp, root)

    trigger_grp = bpy.data.objects.new("Trigger", None)
    trigger_grp.location = Vector((0.0, -0.020, -0.024))
    link_obj(trigger_grp, root)

    mag_grp = bpy.data.objects.new("Magazine", None)
    link_obj(mag_grp, root)

    # 1. CNC Upper Receiver with Boolean-cut Ejection Port
    upper = make_box("UpperReceiver", (0.044, 0.226, 0.050), (0.0, 0.010, 0.036), mats["gunmetal"], frame_grp, bevel=0.0038)
    boolean_cut(upper, make_box("EjectCut", (0.018, 0.074, 0.022), (0.018, 0.025, 0.036), None))
    # Brass deflector & forward assist plunger
    make_box("BrassDeflector", (0.014, 0.020, 0.018), (0.025, -0.032, 0.036), mats["gunmetal"], frame_grp, bevel=0.002)
    make_cyl_y("ForwardAssist", 0.006, 0.026, (0.025, -0.058, 0.024), mats["anodized"], frame_grp, segs=14)
    # Charging handle latch at rear
    make_box("ChargingHandle", (0.036, 0.016, 0.012), (0.0, -0.108, 0.048), mats["anodized"], frame_grp, bevel=0.0015)

    # 2. Sculpted Billet Lower Receiver with Flared Magwell
    lower_profile = [
        (0.106, 0.012),
        (-0.096, 0.012),
        (-0.096, -0.034),
        (-0.035, -0.034),
        (0.016, -0.034),
        (0.028, -0.058),
        (0.099, -0.048),
    ]
    make_side_extrude("LowerReceiver", lower_profile, 0.042, mats["dark_steel"], frame_grp, bevel=0.0028)

    # Takedown pins, bolt catch paddle, fire selector with red mark
    make_cyl_x("FrontPin", 0.0042, 0.048, (0.0, 0.092, 0.002), mats["titanium"], frame_grp)
    make_cyl_x("RearPin", 0.0042, 0.048, (0.0, -0.076, 0.002), mats["titanium"], frame_grp)
    make_box("BoltCatch", (0.004, 0.024, 0.014), (-0.023, 0.028, -0.002), mats["anodized"], frame_grp, bevel=0.001)
    make_box("FireSelector", (0.006, 0.022, 0.008), (-0.024, -0.044, -0.014), mats["anodized"], frame_grp, bevel=0.001)
    make_box("SafetyDot", (0.002, 0.004, 0.004), (-0.025, -0.040, -0.005), mats["safety_red"], frame_grp)

    # 3. Free-Float Octagonal M-LOK Handguard (FDE Cerakote) with REAL Boolean M-LOK Slots!
    handguard = make_box("MLOK_Handguard", (0.044, 0.296, 0.052), (0.0, 0.268, 0.034), mats["fde_tan"], frame_grp, bevel=0.0062)
    # Hollow interior channel so you see the barrel & stainless gas rod through M-LOK slots!
    boolean_cut(handguard, make_cyl_y("HG_InnerCut", 0.0175, 0.304, (0.0, 0.268, 0.034), None, segs=20))
    for i in range(5):
        y_slot = 0.155 + i * 0.052
        boolean_cut(handguard, make_box(f"MLOK_Side_{i}", (0.052, 0.032, 0.010), (0.0, y_slot, 0.034), None))
        boolean_cut(handguard, make_box(f"MLOK_Bot_{i}", (0.010, 0.030, 0.024), (0.0, y_slot, 0.012), None))

    # Monolithic Top Picatinny Rail
    add_picatinny_rail("TopRail", 0.51, 0.024, 0.152, 0.062, mats["anodized"], frame_grp)

    # Ergonomic Angled Foregrip (AFG)
    afg_profile = [
        (0.326, 0.008),
        (0.214, 0.008),
        (0.228, -0.032),
        (0.258, -0.028),
        (0.316, -0.014),
    ]
    make_side_extrude("AngledForegrip", afg_profile, 0.030, mats["grip_stipple"], frame_grp, bevel=0.0024)

    # 4. Heavy Barrel + Hollow Bore + Stainless Short-Stroke Gas Piston + 3-Prong Flash Hider
    add_hollow_barrel("HK_Barrel", 0.0115, 0.44, 0.39, 0.034, mats["dark_steel"], mats["bore_black"], frame_grp)
    make_cyl_y("GasPistonRod", 0.0034, 0.29, (0.0, 0.285, 0.050), mats["stainless"], frame_grp, segs=12)
    make_box("GasBlock", (0.024, 0.030, 0.036), (0.0, 0.425, 0.032), mats["gunmetal"], frame_grp, bevel=0.002)
    fh = make_cyl_y("FlashHider", 0.0142, 0.058, (0.0, 0.594, 0.034), mats["anodized"], frame_grp, segs=20, bevel=0.001)
    boolean_cut(fh, make_cyl_y("FHBore", 0.0082, 0.064, (0.0, 0.594, 0.034), None, segs=16))
    boolean_cut(fh, make_box("FHSlot1", (0.034, 0.034, 0.0055), (0.0, 0.606, 0.034), None))
    boolean_cut(fh, make_box("FHSlot2", (0.0055, 0.034, 0.034), (0.0, 0.606, 0.034), None))

    # 5. Sculpted Pistol Grip + Trigger Guard + Match Trigger
    grip_profile = [
        (-0.034, -0.028),
        (-0.088, -0.028),
        (-0.106, -0.126),
        (-0.062, -0.132),
        (-0.038, -0.044),
    ]
    make_side_extrude("PistolGrip", grip_profile, 0.032, mats["polymer"], frame_grp, bevel=0.003)
    stipple_profile = [
        (-0.044, -0.038),
        (-0.084, -0.038),
        (-0.098, -0.118),
        (-0.066, -0.123),
    ]
    make_side_extrude("GripStipple", stipple_profile, 0.035, mats["grip_stipple"], frame_grp, bevel=0.0014)
    make_box("TriggerGuard", (0.012, 0.060, 0.006), (0.0, -0.010, -0.054), mats["anodized"], frame_grp, bevel=0.001)
    make_box("MatchTrigger", (0.0065, 0.007, 0.026), (0.0, 0.0, -0.013), mats["stainless"], trigger_grp, rot=(0.24, 0, 0), bevel=0.001)

    # 6. Sculpted Curved 30-Round PMAG Magazine with Horizontal Ribbing
    pmag_profile = [
        (0.092, -0.042),
        (0.032, -0.042),
        (0.036, -0.135),
        (0.058, -0.215),
        (0.116, -0.200),
        (0.095, -0.128),
    ]
    pmag = make_side_extrude("PMAG_Body", pmag_profile, 0.027, mats["polymer"], mag_grp, bevel=0.0022)
    for i in range(4):
        boolean_cut(pmag, make_box(f"PMAG_Rib_{i}", (0.032, 0.046, 0.004), (0.0, 0.066 + i * 0.004, -0.085 - i * 0.026), None, rot=(-0.18, 0, 0)))
    make_box("PMAG_Floorplate", (0.032, 0.066, 0.014), (0.0, 0.088, -0.214), mats["fde_dark"], mag_grp, rot=(-0.24, 0, 0), bevel=0.002)

    # 7. Buffer Tube & Sculpted SOPMOD Tactical Buttstock
    make_cyl_y("BufferTube", 0.018, 0.23, (0.0, -0.205, 0.034), mats["anodized"], frame_grp, segs=22)
    stock_profile = [
        (-0.168, 0.054),
        (-0.346, 0.054),
        (-0.346, -0.058),
        (-0.248, -0.032),
        (-0.182, 0.012),
    ]
    stock = make_side_extrude("SOPMOD_Stock", stock_profile, 0.046, mats["fde_tan"], frame_grp, bevel=0.0042)
    # Cut sling slot into stock
    boolean_cut(stock, make_box("SlingSlot", (0.055, 0.036, 0.012), (0.0, -0.295, -0.022), None))
    make_box("RubberButtpad", (0.050, 0.018, 0.122), (0.0, -0.355, -0.002), mats["grip_stipple"], frame_grp, bevel=0.003)

    # 8. Reciprocating Chrome Bolt Carrier
    make_box("BoltCarrier", (0.011, 0.070, 0.020), (0.0, 0.0, 0.0), mats["stainless"], bolt_grp, bevel=0.0014)

    # 9. EOTech EXPS3 Holographic Sight + Flip-up Front BUIS
    add_eotech_holo(0.015, 0.069, mats, frame_grp)
    make_box("FrontBUIS", (0.018, 0.022, 0.022), (0.0, 0.392, 0.076), mats["anodized"], frame_grp, bevel=0.0018)

    # 10. Detachable Suppressor
    add_suppressor_group("Suppressor", 0.021, 0.21, 0.620, 0.034, mats, root)

    export_glb("rifle_hk416.glb")

if __name__ == "__main__":
    build_hk416()
