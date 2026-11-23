import bpy
import sys
import os
import math
from mathutils import Vector

sys.path.insert(0, os.path.dirname(__file__))
from blender_utils import (
    clear_scene, create_materials, link_obj, boolean_cut,
    make_box, make_cyl_y, make_cyl_x, make_side_extrude,
    add_picatinny_rail, add_hollow_barrel, add_eotech_holo,
    add_suppressor_group, export_glb
)

def build_mk48():
    clear_scene()
    mats = create_materials()

    root = bpy.data.objects.new("LMGRoot", None)
    link_obj(root)

    frame_grp = bpy.data.objects.new("Frame", None)
    link_obj(frame_grp, root)

    bolt_grp = bpy.data.objects.new("Bolt", None)
    bolt_grp.location = Vector((0.042, 0.045, 0.038))
    link_obj(bolt_grp, root)

    trigger_grp = bpy.data.objects.new("Trigger", None)
    trigger_grp.location = Vector((0.0, -0.045, -0.022))
    link_obj(trigger_grp, root)

    mag_grp = bpy.data.objects.new("Magazine", None)
    link_obj(mag_grp, root)

    belt_grp = bpy.data.objects.new("AmmoBelt", None)
    link_obj(belt_grp, mag_grp)

    # 1. Heavy CNC Steel Receiver + Hinged Feed Tray Cover + Top Rail
    recv = make_box("LMG_Receiver", (0.068, 0.346, 0.092), (0.0, 0.040, 0.022), mats["gunmetal"], frame_grp, bevel=0.004)
    # Recessed feed slot on left & ejection port on right
    boolean_cut(recv, make_box("FeedSlotCut", (0.024, 0.075, 0.026), (-0.028, 0.095, 0.044), None))
    boolean_cut(recv, make_box("EjectSlotCut", (0.024, 0.072, 0.028), (0.028, 0.075, 0.024), None))

    make_box("FeedTrayCover", (0.062, 0.246, 0.024), (0.0, 0.050, 0.074), mats["dark_steel"], frame_grp, bevel=0.003)
    add_picatinny_rail("TopRail", 0.225, 0.026, 0.050, 0.088, mats["anodized"], frame_grp)

    # Receiver rivets & structural pins
    for y_pin in [0.16, 0.06, -0.06, -0.11]:
        make_cyl_x(f"Rivet_{y_pin}", 0.004, 0.074, (0.0, y_pin, 0.015), mats["titanium"], frame_grp)

    # 2. Perforated Barrel Heat Shield & Handguard (with REAL Boolean Ventilation Holes!)
    make_box("LowerHandguard", (0.060, 0.305, 0.050), (0.0, 0.340, -0.002), mats["dark_steel"], frame_grp, bevel=0.004)
    shield = make_cyl_y("HeatShield", 0.029, 0.285, (0.0, 0.340, 0.044), mats["gunmetal"], frame_grp, segs=22)
    boolean_cut(shield, make_cyl_y("ShieldHollow", 0.023, 0.295, (0.0, 0.340, 0.044), None, segs=20))
    for i in range(6):
        y_h = 0.225 + i * 0.044
        boolean_cut(shield, make_box(f"ShieldVent_{i}", (0.066, 0.022, 0.011), (0.0, y_h, 0.048), None))

    # 3. Heavy Fluted Quick-Change Barrel + Hollow Bore + Gas Tube + Ported Muzzle Brake
    add_hollow_barrel("MK48_Barrel", 0.0155, 0.44, 0.50, 0.044, mats["dark_steel"], mats["bore_black"], frame_grp, fluted=True)
    make_cyl_y("GasCylinder", 0.011, 0.23, (0.0, 0.52, 0.004), mats["gunmetal"], frame_grp, segs=18)

    brake = make_box("MuzzleBrake", (0.034, 0.074, 0.028), (0.0, 0.730, 0.044), mats["anodized"], frame_grp, bevel=0.0025)
    boolean_cut(brake, make_cyl_y("BrakeBore", 0.0095, 0.082, (0.0, 0.730, 0.044), None, segs=18))
    boolean_cut(brake, make_box("BrakePort1", (0.042, 0.015, 0.014), (0.0, 0.718, 0.044), None))
    boolean_cut(brake, make_box("BrakePort2", (0.042, 0.015, 0.014), (0.0, 0.745, 0.044), None))

    # Folded Heavy Steel Bipod
    make_cyl_y("BipodLegL", 0.009, 0.24, (-0.028, 0.38, -0.038), mats["titanium"], frame_grp, segs=14)
    make_cyl_y("BipodLegR", 0.009, 0.24, (0.028, 0.38, -0.038), mats["titanium"], frame_grp, segs=14)
    make_box("BipodFootL", (0.024, 0.030, 0.018), (-0.028, 0.26, -0.038), mats["grip_stipple"], frame_grp, bevel=0.002)
    make_box("BipodFootR", (0.024, 0.030, 0.018), (0.028, 0.26, -0.038), mats["grip_stipple"], frame_grp, bevel=0.002)

    # 4. 100-Round Olive Drab Ammo Box + Exposed 3D Brass 7.62mm Cartridge Belt!
    make_box("AmmoBox", (0.116, 0.106, 0.145), (-0.012, 0.095, -0.105), mats["olive_drab"], mag_grp, bevel=0.005)
    make_box("AmmoBoxLid", (0.120, 0.110, 0.016), (-0.012, 0.095, -0.038), mats["anodized"], mag_grp, bevel=0.002)

    for i in range(7):
        t = i / 6.0
        bx = -0.056 + math.sin(t * math.pi * 0.6) * 0.018
        bz = -0.032 + t * 0.072
        cart_grp = bpy.data.objects.new(f"Cart_{i}", None)
        cart_grp.location = Vector((bx, 0.095, bz))
        cart_grp.rotation_euler = (0.0, -0.35 + t * 0.4, 0.0)
        link_obj(cart_grp, belt_grp)
        # Brass casing + copper pointed Spitzer bullet + black steel link
        make_cyl_y(f"Brass_{i}", 0.0056, 0.046, (0.0, -0.006, 0.0), mats["brass"], cart_grp, segs=14, r2=0.0060)
        make_cyl_y(f"Bullet_{i}", 0.0008, 0.022, (0.0, 0.028, 0.0), mats["copper"], cart_grp, segs=14, r2=0.0053)
        make_box(f"Link_{i}", (0.014, 0.016, 0.009), (0.0, -0.005, 0.0), mats["anodized"], cart_grp, bevel=0.001)

    # 5. Sculpted Pistol Grip, Trigger & Heavy Para Stock
    grip_profile = [
        (-0.062, -0.024),
        (-0.112, -0.024),
        (-0.128, -0.124),
        (-0.084, -0.130),
        (-0.064, -0.042),
    ]
    make_side_extrude("PistolGrip", grip_profile, 0.034, mats["polymer"], frame_grp, bevel=0.0032)
    make_box("TriggerGuard", (0.014, 0.060, 0.007), (0.0, -0.035, -0.050), mats["anodized"], frame_grp, bevel=0.001)
    make_box("MatchTrigger", (0.008, 0.009, 0.028), (0.0, 0.0, -0.013), mats["stainless"], trigger_grp, rot=(0.2, 0, 0), bevel=0.001)

    stock_profile = [
        (-0.130, 0.052),
        (-0.360, 0.052),
        (-0.360, -0.068),
        (-0.295, -0.052),
        (-0.240, -0.014),
        (-0.130, -0.014),
    ]
    make_side_extrude("ParaStock", stock_profile, 0.054, mats["dark_steel"], frame_grp, bevel=0.0042)
    make_box("StockButtpad", (0.058, 0.024, 0.132), (0.0, -0.368, -0.008), mats["grip_stipple"], frame_grp, bevel=0.0035)

    # 6. Reciprocating Chrome Charging Handle
    make_box("ChargingHandle", (0.024, 0.046, 0.018), (0.0, 0.0, 0.0), mats["stainless"], bolt_grp, bevel=0.002)

    # 7. EOTech EXPS3 Holographic Sight
    add_eotech_holo(0.035, 0.095, mats, frame_grp)

    # 8. Detachable Heavy Suppressor
    add_suppressor_group("Suppressor", 0.024, 0.23, 0.768, 0.044, mats, root)

    export_glb("lmg_mk48.glb")

if __name__ == "__main__":
    build_mk48()
