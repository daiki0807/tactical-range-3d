import * as THREE from 'three';

/**
 * Helper to add a box mesh concisely
 */
function addBox(parent, w, h, d, x, y, z, mat, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/**
 * Helper to add a cylinder aligned along Z (barrel axis)
 */
function addCylZ(parent, rTop, rBot, len, x, y, z, mat, segs = 20) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, len, segs), mat);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/**
 * Adds realistic repeating Picatinny rail teeth along Z
 */
function addPicatinnyRail(parent, length, width, y, zCenter, mat) {
  const group = new THREE.Group();
  // Base strip
  addBox(group, width * 0.85, 0.005, length, 0, y, zCenter, mat);
  const slotStep = 0.014;
  const count = Math.floor(length / slotStep);
  const startZ = zCenter - length / 2 + slotStep * 0.5;
  for (let i = 0; i < count; i++) {
    addBox(group, width, 0.0045, 0.007, 0, y + 0.004, startZ + i * slotStep, mat);
  }
  parent.add(group);
  return group;
}

/**
 * EOTech-style Holographic Tactical Sight with glowing red reticle
 */
function addHoloSight(parent, x, y, z, mats) {
  const g = new THREE.Group();
  g.position.set(x, y, z);

  // Mount base
  addBox(g, 0.036, 0.014, 0.088, 0, 0.007, 0, mats.darkSteel);
  // Side thumb screw
  addBox(g, 0.008, 0.012, 0.016, -0.022, 0.008, 0.01, mats.gunmetal);
  // Protective armored hood (left, right, top)
  addBox(g, 0.005, 0.044, 0.068, -0.020, 0.034, -0.004, mats.gunmetal);
  addBox(g, 0.005, 0.044, 0.068, 0.020, 0.034, -0.004, mats.gunmetal);
  addBox(g, 0.045, 0.005, 0.068, 0, 0.056, -0.004, mats.gunmetal);
  // Rear battery housing
  addBox(g, 0.036, 0.026, 0.028, 0, 0.024, -0.044, mats.darkSteel);

  // Translucent optic glass
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.034, 0.036), mats.opticGlass);
  glass.position.set(0, 0.035, 0.005);
  g.add(glass);

  // Glowing holographic red reticle (ring + center dot)
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.0065, 0.0078, 24), mats.redGlow);
  ring.position.set(0, 0.035, 0.006);
  g.add(ring);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0014, 12), mats.redGlow);
  dot.position.set(0, 0.035, 0.0062);
  g.add(dot);

  parent.add(g);
  return g;
}

/**
 * Compact Trijicon RMR-style Micro Reflex Sight for Pistol
 */
function addMicroReflexSight(parent, x, y, z, mats) {
  const g = new THREE.Group();
  g.position.set(x, y, z);

  addBox(g, 0.028, 0.007, 0.046, 0, 0.0035, 0, mats.darkSteel);
  addBox(g, 0.0035, 0.022, 0.026, -0.0125, 0.016, 0.004, mats.gunmetal);
  addBox(g, 0.0035, 0.022, 0.026, 0.0125, 0.016, 0.004, mats.gunmetal);
  addBox(g, 0.0285, 0.0035, 0.026, 0, 0.027, 0.004, mats.gunmetal);

  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.021, 0.018), mats.opticGlass);
  glass.position.set(0, 0.016, 0.005);
  g.add(glass);

  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0014, 12), mats.redGlow);
  dot.position.set(0, 0.016, 0.0055);
  g.add(dot);

  parent.add(g);
  return g;
}

/**
 * High-Power Sniper Tactical Scope
 */
function addTacticalScope(parent, x, y, z, mats) {
  const g = new THREE.Group();
  g.position.set(x, y, z);

  // Dual mounting rings
  [-0.06, 0.055].forEach((rz) => {
    addBox(g, 0.028, 0.026, 0.022, 0, 0.013, rz, mats.darkSteel);
    addCylZ(g, 0.022, 0.022, 0.024, 0, 0.036, rz, mats.darkSteel, 18);
  });

  // Main tube
  addCylZ(g, 0.018, 0.018, 0.25, 0, 0.036, 0, mats.gunmetal, 20);
  // Front objective bell (flared)
  addCylZ(g, 0.030, 0.018, 0.06, 0, 0.036, -0.14, mats.gunmetal, 24);
  addCylZ(g, 0.031, 0.031, 0.075, 0, 0.036, -0.205, mats.darkSteel, 24);
  // Front blue-coated lens
  const frontLens = new THREE.Mesh(new THREE.CircleGeometry(0.027, 24), mats.scopeLens);
  frontLens.rotation.y = Math.PI;
  frontLens.position.set(0, 0.036, -0.241);
  g.add(frontLens);

  // Rear eyepiece bell
  addCylZ(g, 0.018, 0.024, 0.05, 0, 0.036, 0.14, mats.gunmetal, 20);
  addCylZ(g, 0.025, 0.025, 0.038, 0, 0.036, 0.18, mats.polymerGrip, 20);
  const rearLens = new THREE.Mesh(new THREE.CircleGeometry(0.020, 20), mats.scopeLens);
  rearLens.position.set(0, 0.036, 0.199);
  g.add(rearLens);

  // Elevation & Windage tactical turrets
  const elev = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.024, 16), mats.darkSteel);
  elev.position.set(0, 0.062, -0.005);
  g.add(elev);

  const wind = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.022, 16), mats.darkSteel);
  wind.rotation.z = Math.PI / 2;
  wind.position.set(0.028, 0.036, -0.005);
  g.add(wind);

  const parallax = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.020, 16), mats.darkSteel);
  parallax.rotation.z = Math.PI / 2;
  parallax.position.set(-0.027, 0.036, -0.005);
  g.add(parallax);

  parent.add(g);
  return g;
}

/**
 * Detachable ribbed Tactical Suppressor
 */
function createSuppressor(radius, length, mats) {
  const g = new THREE.Group();
  addCylZ(g, radius, radius, length, 0, 0, -length / 2, mats.darkSteel, 24);
  // Subtle cooling/grip rings
  for (let i = 1; i <= 5; i++) {
    addCylZ(g, radius * 1.045, radius * 1.045, 0.008, 0, 0, -length * (i / 6), mats.gunmetal, 24);
  }
  // Bore cap
  addCylZ(g, radius * 0.48, radius * 0.48, 0.005, 0, 0, -length - 0.001, mats.polymer, 16);
  g.visible = false;
  return g;
}

/**
 * Build a specific firearm by ID and return { root, parts }
 */
export function buildWeaponModel(id, mats) {
  switch (id) {
    case 'pistol':
      return buildPistol(mats);
    case 'smg':
      return buildSMG(mats);
    case 'rifle':
      return buildRifle(mats);
    case 'lmg':
      return buildLMG(mats);
    case 'sniper':
      return buildSniper(mats);
    default:
      return buildRifle(mats);
  }
}

/* ============================================================
   1. M17-X TACTICAL PISTOL (9x19mm)
   ============================================================ */
function buildPistol(mats) {
  const root = new THREE.Group();

  // Lower FDE polymer frame
  addBox(root, 0.031, 0.026, 0.195, 0, 0.008, -0.045, mats.fdeTan);
  // Underbarrel rail & tactical light
  addBox(root, 0.026, 0.018, 0.055, 0, -0.014, -0.105, mats.darkSteel);
  addCylZ(root, 0.010, 0.010, 0.032, 0, -0.014, -0.145, mats.gunmetal, 16);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.008, 16), mats.amberGlow);
  lens.rotation.y = Math.PI;
  lens.position.set(0, -0.014, -0.162);
  root.add(lens);

  // Ergonomic angled pistol grip
  const grip = addBox(root, 0.030, 0.118, 0.046, 0, -0.062, 0.036, mats.fdeTan, 0.24);
  addBox(grip, 0.032, 0.088, 0.036, 0, -0.002, 0.0, mats.polymerGrip);

  // Trigger guard
  addBox(root, 0.012, 0.006, 0.056, 0, -0.036, -0.012, mats.fdeTan);
  addBox(root, 0.012, 0.036, 0.007, 0, -0.018, -0.038, mats.fdeTan);

  // Trigger (animated)
  const trigger = new THREE.Group();
  trigger.position.set(0, -0.004, -0.008);
  addBox(trigger, 0.007, 0.026, 0.008, 0, -0.013, 0, mats.darkSteel, -0.25);
  root.add(trigger);

  // Magazine (animated on reload)
  const magazine = new THREE.Group();
  addBox(magazine, 0.024, 0.118, 0.036, 0, -0.072, 0.039, mats.darkSteel, 0.24);
  addBox(magazine, 0.031, 0.016, 0.046, 0, -0.128, 0.052, mats.fdeDark, 0.24);
  root.add(magazine);

  // Stationary Chrome Barrel inside slide
  addCylZ(root, 0.0082, 0.0082, 0.175, 0, 0.034, -0.075, mats.chrome, 18);
  // Tactical threaded compensator
  addBox(root, 0.028, 0.032, 0.032, 0, 0.033, -0.165, mats.darkSteel);
  addBox(root, 0.016, 0.010, 0.014, 0, 0.049, -0.165, mats.polymer); // top port

  // Reciprocating Slide Group!
  const slide = new THREE.Group();
  addBox(slide, 0.033, 0.034, 0.195, 0, 0.036, -0.050, mats.gunmetal);
  // Top bevel chamfer strip
  addBox(slide, 0.024, 0.006, 0.193, 0, 0.054, -0.050, mats.darkSteel);
  // Slide serrations (rear & front)
  for (let i = 0; i < 6; i++) {
    addBox(slide, 0.035, 0.024, 0.003, 0, 0.036, 0.012 + i * 0.0055, mats.darkSteel);
    addBox(slide, 0.035, 0.022, 0.003, 0, 0.036, -0.115 - i * 0.005, mats.darkSteel);
  }
  // Ejection port cutout accent
  addBox(slide, 0.012, 0.016, 0.040, 0.012, 0.042, -0.042, mats.chrome);

  // Micro Red-Dot Reflex Sight mounted on slide
  addMicroReflexSight(slide, 0, 0.056, -0.004, mats);

  // Front tritium night sight
  addBox(slide, 0.004, 0.009, 0.009, 0, 0.060, -0.138, mats.darkSteel);
  addBox(slide, 0.0025, 0.003, 0.002, 0, 0.062, -0.133, mats.greenGlow);
  root.add(slide);

  // Suppressor
  const suppressor = createSuppressor(0.017, 0.175, mats);
  suppressor.position.set(0, 0.034, -0.180);
  root.add(suppressor);

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0, 0.034, -0.185);
  root.add(muzzlePoint);

  const ejectionPoint = new THREE.Object3D();
  ejectionPoint.position.set(0.022, 0.044, -0.042);
  root.add(ejectionPoint);

  return {
    root,
    parts: {
      slide,
      slideRestZ: 0,
      slideTravel: 0.052,
      trigger,
      magazine,
      suppressor,
      muzzlePoint,
      ejectionPoint,
      suppressedMuzzleOffset: -0.175,
    },
  };
}

/* ============================================================
   2. H&K MP7-V PDW (4.6x30mm SMG)
   ============================================================ */
function buildSMG(mats) {
  const root = new THREE.Group();

  // Main sleek angular PDW body
  addBox(root, 0.046, 0.088, 0.36, 0, 0.022, -0.07, mats.tungsten);
  // Upper dark steel shroud
  addBox(root, 0.042, 0.034, 0.355, 0, 0.056, -0.072, mats.darkSteel);
  // Full-length top Picatinny rail
  addPicatinnyRail(root, 0.34, 0.024, 0.075, -0.072, mats.darkSteel);
  // Side tactical rail & PEQ laser module
  addBox(root, 0.018, 0.024, 0.072, 0.030, 0.042, -0.16, mats.fdeDark);
  const laserDot = new THREE.Mesh(new THREE.CircleGeometry(0.004, 12), mats.greenGlow);
  laserDot.rotation.y = Math.PI;
  laserDot.position.set(0.032, 0.044, -0.197);
  root.add(laserDot);

  // Pistol grip (center-mounted like MP7)
  const grip = addBox(root, 0.034, 0.118, 0.048, 0, -0.068, 0.015, mats.polymer, 0.15);
  addBox(grip, 0.036, 0.082, 0.038, 0, -0.005, 0, mats.polymerGrip);

  // Extended 40-round Magazine inside grip
  const magazine = new THREE.Group();
  addBox(magazine, 0.026, 0.19, 0.036, 0, -0.115, 0.022, mats.darkSteel, 0.15);
  addBox(magazine, 0.032, 0.015, 0.042, 0, -0.208, 0.036, mats.polymer, 0.15);
  root.add(magazine);

  // Trigger guard & trigger
  addBox(root, 0.014, 0.007, 0.065, 0, -0.046, -0.040, mats.polymer);
  addBox(root, 0.014, 0.042, 0.008, 0, -0.026, -0.072, mats.polymer);
  const trigger = new THREE.Group();
  trigger.position.set(0, -0.012, -0.034);
  addBox(trigger, 0.007, 0.026, 0.008, 0, -0.013, 0, mats.darkSteel, -0.2);
  root.add(trigger);

  // Folding vertical foregrip
  addBox(root, 0.024, 0.095, 0.028, 0, -0.065, -0.195, mats.polymerGrip, -0.1);

  // Dual-rod retractable wire buttstock
  addCylZ(root, 0.005, 0.005, 0.22, -0.022, 0.036, 0.20, mats.gunmetal, 10);
  addCylZ(root, 0.005, 0.005, 0.22, 0.022, 0.036, 0.20, mats.gunmetal, 10);
  addBox(root, 0.048, 0.105, 0.022, 0, 0.010, 0.305, mats.polymerGrip);

  // Barrel & Flash Hider
  addCylZ(root, 0.010, 0.010, 0.095, 0, 0.034, -0.285, mats.darkSteel, 18);
  addCylZ(root, 0.013, 0.012, 0.035, 0, 0.034, -0.340, mats.gunmetal, 12);

  // Reciprocating Bolt carrier visible in ejection port
  const bolt = addBox(root, 0.012, 0.020, 0.056, 0.021, 0.044, -0.025, mats.chrome);

  // Holographic Sight
  addHoloSight(root, 0, 0.080, -0.045, mats);

  // Suppressor
  const suppressor = createSuppressor(0.020, 0.20, mats);
  suppressor.position.set(0, 0.034, -0.355);
  root.add(suppressor);

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0, 0.034, -0.360);
  root.add(muzzlePoint);

  const ejectionPoint = new THREE.Object3D();
  ejectionPoint.position.set(0.028, 0.044, -0.025);
  root.add(ejectionPoint);

  return {
    root,
    parts: {
      bolt,
      boltRestZ: -0.025,
      boltTravel: 0.045,
      trigger,
      magazine,
      suppressor,
      muzzlePoint,
      ejectionPoint,
      suppressedMuzzleOffset: -0.20,
    },
  };
}

/* ============================================================
   3. HK416-A8 CARBINE (5.56x45mm Assault Rifle)
   ============================================================ */
function buildRifle(mats) {
  const root = new THREE.Group();

  // Upper & Lower Receivers
  addBox(root, 0.044, 0.054, 0.22, 0, 0.034, -0.01, mats.gunmetal); // upper
  addBox(root, 0.042, 0.052, 0.18, 0, -0.012, 0.005, mats.darkSteel); // lower
  // Magwell flare
  addBox(root, 0.046, 0.054, 0.072, 0, -0.022, -0.058, mats.darkSteel);
  // Brass deflector & forward assist
  addBox(root, 0.014, 0.018, 0.018, 0.026, 0.036, 0.032, mats.gunmetal);

  // Slim M-LOK Tactical Handguard (FDE accent)
  addBox(root, 0.044, 0.052, 0.29, 0, 0.032, -0.265, mats.fdeTan);
  // M-LOK vent slots along both sides
  for (let i = 0; i < 5; i++) {
    addBox(root, 0.047, 0.010, 0.032, 0, 0.032, -0.155 - i * 0.052, mats.polymer);
  }
  // Full-length continuous Top Picatinny Rail
  addPicatinnyRail(root, 0.50, 0.024, 0.062, -0.15, mats.darkSteel);

  // Angled Foregrip
  addBox(root, 0.030, 0.028, 0.11, 0, -0.008, -0.27, mats.polymerGrip, 0.18);

  // Heavy Barrel + Gas Block + Multi-port Flash Hider
  addCylZ(root, 0.011, 0.012, 0.20, 0, 0.034, -0.47, mats.darkSteel, 20);
  addBox(root, 0.024, 0.036, 0.028, 0, 0.032, -0.42, mats.gunmetal); // gas block
  addCylZ(root, 0.014, 0.013, 0.055, 0, 0.034, -0.585, mats.gunmetal, 12); // flash hider

  // Pistol Grip
  const grip = addBox(root, 0.032, 0.115, 0.046, 0, -0.075, 0.062, mats.polymer, 0.28);
  addBox(grip, 0.034, 0.082, 0.036, 0, -0.005, 0, mats.polymerGrip);

  // Trigger guard & trigger
  addBox(root, 0.012, 0.006, 0.058, 0, -0.052, 0.010, mats.darkSteel);
  const trigger = new THREE.Group();
  trigger.position.set(0, -0.024, 0.020);
  addBox(trigger, 0.007, 0.026, 0.008, 0, -0.012, 0, mats.chrome, -0.25);
  root.add(trigger);

  // Curved 30-round PMAG Magazine
  const magazine = new THREE.Group();
  addBox(magazine, 0.028, 0.10, 0.062, 0, -0.088, -0.060, mats.polymer, 0.06);
  addBox(magazine, 0.028, 0.095, 0.062, 0, -0.172, -0.072, mats.polymerGrip, 0.22);
  addBox(magazine, 0.032, 0.014, 0.068, 0, -0.218, -0.083, mats.fdeDark, 0.22);
  root.add(magazine);

  // Buffer Tube & SOPMOD Tactical Buttstock
  addCylZ(root, 0.018, 0.018, 0.22, 0, 0.034, 0.20, mats.darkSteel, 16);
  addBox(root, 0.048, 0.118, 0.165, 0, 0.008, 0.265, mats.fdeTan);
  addBox(root, 0.052, 0.125, 0.020, 0, 0.006, 0.352, mats.polymerGrip); // rubber buttpad

  // Reciprocating Chrome Bolt Carrier
  const bolt = addBox(root, 0.010, 0.020, 0.068, 0.020, 0.034, -0.025, mats.chrome);

  // EOTech Holographic Sight
  addHoloSight(root, 0, 0.068, -0.015, mats);
  // Flip-up Front Iron Sight
  addBox(root, 0.018, 0.024, 0.020, 0, 0.076, -0.385, mats.darkSteel);

  // Suppressor
  const suppressor = createSuppressor(0.021, 0.21, mats);
  suppressor.position.set(0, 0.034, -0.610);
  root.add(suppressor);

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0, 0.034, -0.615);
  root.add(muzzlePoint);

  const ejectionPoint = new THREE.Object3D();
  ejectionPoint.position.set(0.030, 0.036, -0.025);
  root.add(ejectionPoint);

  return {
    root,
    parts: {
      bolt,
      boltRestZ: -0.025,
      boltTravel: 0.058,
      trigger,
      magazine,
      suppressor,
      muzzlePoint,
      ejectionPoint,
      suppressedMuzzleOffset: -0.21,
    },
  };
}

/* ============================================================
   4. MK48 MOD-1 LMG (7.62x51mm Belt-Fed Machine Gun)
   ============================================================ */
function buildLMG(mats) {
  const root = new THREE.Group();

  // Heavy Box Receiver + Hinged Feed Tray Cover
  addBox(root, 0.068, 0.092, 0.34, 0, 0.022, -0.04, mats.gunmetal);
  addBox(root, 0.064, 0.024, 0.24, 0, 0.074, -0.05, mats.darkSteel); // feed cover
  addPicatinnyRail(root, 0.22, 0.026, 0.088, -0.05, mats.darkSteel);

  // Perforated Barrel Heat Shield & Handguard
  addBox(root, 0.060, 0.052, 0.30, 0, -0.002, -0.34, mats.darkSteel);
  addCylZ(root, 0.028, 0.028, 0.28, 0, 0.044, -0.34, mats.gunmetal, 16);
  for (let i = 0; i < 6; i++) {
    addBox(root, 0.064, 0.012, 0.024, 0, 0.042, -0.225 - i * 0.044, mats.polymer);
  }

  // Heavy Quick-Change Barrel + Gas Cylinder + Ported Muzzle Brake
  addCylZ(root, 0.015, 0.016, 0.28, 0, 0.044, -0.56, mats.darkSteel, 20);
  addCylZ(root, 0.011, 0.011, 0.22, 0, 0.004, -0.52, mats.gunmetal, 16); // gas tube
  // Heavy ported muzzle brake
  addBox(root, 0.032, 0.028, 0.072, 0, 0.044, -0.725, mats.darkSteel);
  addBox(root, 0.036, 0.012, 0.014, 0, 0.044, -0.715, mats.polymer);
  addBox(root, 0.036, 0.012, 0.014, 0, 0.044, -0.742, mats.polymer);

  // Folded Heavy Bipod under handguard
  addCylZ(root, 0.009, 0.009, 0.24, -0.028, -0.038, -0.38, mats.darkSteel, 12);
  addCylZ(root, 0.009, 0.009, 0.24, 0.028, -0.038, -0.38, mats.darkSteel, 12);
  addBox(root, 0.024, 0.018, 0.028, -0.028, -0.038, -0.26, mats.polymerGrip);
  addBox(root, 0.024, 0.018, 0.028, 0.028, -0.038, -0.26, mats.polymerGrip);

  // 100-Round Olive Drab Ammo Box Magazine + Exposed 3D Brass Ammo Belt!
  const magazine = new THREE.Group();
  addBox(magazine, 0.115, 0.145, 0.105, -0.012, -0.105, -0.095, mats.oliveDrab);
  addBox(magazine, 0.120, 0.016, 0.110, -0.012, -0.038, -0.095, mats.darkSteel);

  // Exposed curved brass cartridge belt feeding from box into left side of receiver
  const ammoBelt = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const bx = -0.056 + Math.sin(t * Math.PI * 0.6) * 0.018;
    const by = -0.032 + t * 0.072;
    const cart = new THREE.Group();
    cart.position.set(bx, by, -0.095);
    cart.rotation.z = -0.35 + t * 0.4;
    // Brass casing
    addCylZ(cart, 0.0055, 0.0058, 0.046, 0, 0, 0.006, mats.brass, 10);
    // Copper bullet tip
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.0052, 0.022, 10), mats.copper);
    tip.rotation.x = -Math.PI / 2;
    tip.position.set(0, 0, -0.028);
    cart.add(tip);
    // Dark disintegrating link
    addBox(cart, 0.014, 0.009, 0.016, 0, 0, 0.005, mats.darkSteel);
    ammoBelt.add(cart);
  }
  magazine.add(ammoBelt);
  root.add(magazine);

  // Pistol Grip & Trigger
  const grip = addBox(root, 0.034, 0.115, 0.048, 0, -0.072, 0.088, mats.polymer, 0.25);
  addBox(grip, 0.036, 0.082, 0.038, 0, -0.004, 0, mats.polymerGrip);
  addBox(root, 0.014, 0.007, 0.060, 0, -0.050, 0.035, mats.darkSteel);
  const trigger = new THREE.Group();
  trigger.position.set(0, -0.022, 0.045);
  addBox(trigger, 0.008, 0.028, 0.009, 0, -0.013, 0, mats.chrome, -0.2);
  root.add(trigger);

  // Heavy Collapsible Para Stock
  addBox(root, 0.054, 0.068, 0.24, 0, 0.018, 0.24, mats.darkSteel);
  addBox(root, 0.058, 0.135, 0.032, 0, -0.005, 0.365, mats.polymerGrip);

  // Reciprocating Charging Handle / Bolt
  const bolt = addBox(root, 0.024, 0.018, 0.045, 0.042, 0.038, -0.045, mats.chrome);

  // Holographic Sight
  addHoloSight(root, 0, 0.094, -0.035, mats);

  // Suppressor
  const suppressor = createSuppressor(0.024, 0.23, mats);
  suppressor.position.set(0, 0.044, -0.760);
  root.add(suppressor);

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0, 0.044, -0.765);
  root.add(muzzlePoint);

  const ejectionPoint = new THREE.Object3D();
  ejectionPoint.position.set(0.044, 0.024, -0.075);
  root.add(ejectionPoint);

  return {
    root,
    parts: {
      bolt,
      boltRestZ: -0.045,
      boltTravel: 0.065,
      ammoBelt,
      trigger,
      magazine,
      suppressor,
      muzzlePoint,
      ejectionPoint,
      suppressedMuzzleOffset: -0.23,
    },
  };
}

/* ============================================================
   5. BARRETT MRAD .338 (Bolt-Action Precision Sniper Rifle)
   ============================================================ */
function buildSniper(mats) {
  const root = new THREE.Group();

  // Monolithic FDE Tactical Chassis & Upper
  addBox(root, 0.048, 0.062, 0.30, 0, 0.030, -0.03, mats.fdeTan);
  addBox(root, 0.044, 0.048, 0.24, 0, -0.012, -0.01, mats.fdeDark);

  // Long Precision Octagonal M-LOK Handguard
  addBox(root, 0.046, 0.056, 0.38, 0, 0.032, -0.37, mats.fdeTan);
  for (let i = 0; i < 6; i++) {
    addBox(root, 0.050, 0.012, 0.036, 0, 0.032, -0.22 - i * 0.054, mats.polymer);
  }
  // Full-length monolithic top rail
  addPicatinnyRail(root, 0.66, 0.026, 0.064, -0.22, mats.darkSteel);

  // Long Heavy Fluted Barrel
  addCylZ(root, 0.014, 0.017, 0.44, 0, 0.034, -0.74, mats.darkSteel, 20);
  // Massive Twin-Baffle Barrett Rectangular Muzzle Brake
  addBox(root, 0.052, 0.034, 0.105, 0, 0.034, -1.00, mats.darkSteel);
  addBox(root, 0.056, 0.018, 0.022, 0, 0.034, -0.975, mats.polymer);
  addBox(root, 0.056, 0.018, 0.022, 0, 0.034, -1.022, mats.polymer);

  // Tactical Bipod mounted near front of handguard
  addBox(root, 0.042, 0.020, 0.036, 0, -0.008, -0.52, mats.darkSteel);
  addCylZ(root, 0.008, 0.008, 0.22, -0.032, -0.028, -0.41, mats.gunmetal, 12);
  addCylZ(root, 0.008, 0.008, 0.22, 0.032, -0.028, -0.41, mats.gunmetal, 12);

  // Animated Bolt & Oversized Tactical Bolt Handle!
  const boltHandle = new THREE.Group();
  boltHandle.position.set(0, 0.034, 0.045);
  addCylZ(boltHandle, 0.012, 0.012, 0.10, 0, 0, -0.03, mats.chrome, 16);
  // Bolt arm & knurled knob
  const arm = addBox(boltHandle, 0.048, 0.009, 0.010, 0.028, -0.006, 0.012, mats.darkSteel, 0, 0, -0.35);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.013, 14, 14), mats.polymerGrip);
  knob.position.set(0.052, -0.016, 0.012);
  boltHandle.add(knob);
  root.add(boltHandle);

  // Precision Pistol Grip
  const grip = addBox(root, 0.032, 0.115, 0.046, 0, -0.078, 0.075, mats.polymer, 0.22);
  addBox(grip, 0.034, 0.084, 0.036, 0, -0.004, 0, mats.polymerGrip);

  // Trigger guard & match trigger
  addBox(root, 0.012, 0.006, 0.062, 0, -0.052, 0.018, mats.darkSteel);
  const trigger = new THREE.Group();
  trigger.position.set(0, -0.022, 0.028);
  addBox(trigger, 0.006, 0.026, 0.007, 0, -0.013, 0, mats.chrome, -0.15);
  root.add(trigger);

  // 10-Round .338 Box Magazine
  const magazine = new THREE.Group();
  addBox(magazine, 0.034, 0.125, 0.095, 0, -0.085, -0.075, mats.darkSteel);
  addBox(magazine, 0.038, 0.014, 0.100, 0, -0.150, -0.075, mats.polymerGrip);
  root.add(magazine);

  // Skeletonized Precision Sniper Stock with Adjustable Cheek Riser
  addBox(root, 0.038, 0.030, 0.26, 0, 0.034, 0.25, mats.fdeTan); // top rail
  addBox(root, 0.034, 0.020, 0.22, 0, -0.032, 0.25, mats.fdeDark, 0.12); // lower strut
  addBox(root, 0.044, 0.024, 0.13, 0, 0.062, 0.23, mats.polymerGrip); // cheek riser
  addBox(root, 0.046, 0.128, 0.026, 0, 0.002, 0.38, mats.polymerGrip); // buttpad

  // High-Power Tactical Scope
  addTacticalScope(root, 0, 0.072, -0.06, mats);

  // Large Caliber Suppressor
  const suppressor = createSuppressor(0.026, 0.26, mats);
  suppressor.position.set(0, 0.034, -1.045);
  root.add(suppressor);

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0, 0.034, -1.055);
  root.add(muzzlePoint);

  const ejectionPoint = new THREE.Object3D();
  ejectionPoint.position.set(0.032, 0.038, -0.015);
  root.add(ejectionPoint);

  return {
    root,
    parts: {
      boltHandle,
      boltRestZ: 0.045,
      trigger,
      magazine,
      suppressor,
      muzzlePoint,
      ejectionPoint,
      suppressedMuzzleOffset: -0.26,
    },
  };
}
