import * as THREE from 'three';

/**
 * Helper: Beveled/Chamfered Box using ExtrudeGeometry for realistic CNC-machined edges
 */
function addChamferBox(parent, w, h, d, x, y, z, mat, bevel = 0.0022, rx = 0, ry = 0, rz = 0) {
  const b = Math.min(bevel, w * 0.22, h * 0.22, d * 0.22);
  const hw = w / 2 - b;
  const hh = h / 2 - b;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, -hh);
  shape.lineTo(hw, -hh);
  shape.lineTo(hw, hh);
  shape.lineTo(-hw, hh);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, d - b * 2),
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 2,
  });
  geo.center();

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/**
 * Helper: Sculpted 2D side-profile extruded symmetrically along X with smooth CNC bevels!
 * points2D: array of [z, y] coordinates in weapon space (negative Z = forward toward muzzle)
 */
function addSideProfile(parent, points2D, thicknessX, xOffset, mat, bevel = 0.0024) {
  const b = Math.min(bevel, thicknessX * 0.28);
  const shape = new THREE.Shape();
  shape.moveTo(points2D[0][0], points2D[0][1]);
  for (let i = 1; i < points2D.length; i++) {
    shape.lineTo(points2D[i][0], points2D[i][1]);
  }
  shape.closePath();

  const depth = Math.max(0.001, thicknessX - b * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 2,
  });
  // ExtrudeGeometry extrudes along +Z, with shape in XY.
  // Rotate +90 deg around Y so shape X maps to -Z? Wait:
  // If we rotate Y by -Math.PI/2: local (x, y, z) -> world (-z, y, x).
  // Even simpler: center depth on Z, then rotateY(+Math.PI/2): local (sx, sy, sz) -> world (sz, sy, -sx).
  // So if we pass [ -z, y ] into shape, world Z becomes +z!
  geo.translate(0, 0, -depth / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.y = Math.PI / 2;
  mesh.position.set(xOffset, 0, 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/**
 * Convenience wrapper for addSideProfile taking natural [z, y] weapon coords
 */
function addSculptedPart(parent, zyPoints, widthX, xOffset, mat, bevel = 0.0024) {
  const mapped = zyPoints.map(([z, y]) => [-z, y]);
  return addSideProfile(parent, mapped, widthX, xOffset, mat, bevel);
}

function addBox(parent, w, h, d, x, y, z, mat, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCylZ(parent, rTop, rBot, len, x, y, z, mat, segs = 22) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, len, segs), mat);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addPinX(parent, radius, len, x, y, z, mat) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 12), mat);
  mesh.rotation.z = Math.PI / 2;
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function addBarrelWithBore(parent, radius, len, x, y, zCenter, mat, boreMat, fluted = false) {
  const segs = fluted ? 12 : 24;
  addCylZ(parent, radius, radius * 1.04, len, x, y, zCenter, mat, segs);
  // Dark recessed bore hole at muzzle end
  const bore = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.56, 16), boreMat);
  bore.rotation.y = Math.PI;
  bore.position.set(x, y, zCenter - len / 2 - 0.0008);
  parent.add(bore);

  if (fluted) {
    // 6 machined fluting grooves along the barrel
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const fx = x + Math.cos(a) * (radius * 0.92);
      const fy = y + Math.sin(a) * (radius * 0.92);
      addCylZ(parent, radius * 0.14, radius * 0.14, len * 0.78, fx, fy, zCenter, boreMat, 8);
    }
  }
}

/**
 * Repeating CNC Picatinny Rail with T-slot bevel
 */
function addPicatinnyRail(parent, length, width, y, zCenter, mat) {
  const group = new THREE.Group();
  addChamferBox(group, width * 0.84, 0.005, length, 0, y, zCenter, mat, 0.001);
  const slotStep = 0.013;
  const count = Math.floor(length / slotStep);
  const startZ = zCenter - length / 2 + slotStep * 0.5;
  for (let i = 0; i < count; i++) {
    addBox(group, width, 0.0046, 0.0068, 0, y + 0.0042, startZ + i * slotStep, mat);
  }
  parent.add(group);
  return group;
}

/**
 * Detailed EOTech EXPS3 Holographic Sight with armored hood, battery cap, and glowing reticle
 */
function addHoloSight(parent, x, y, z, mats) {
  const g = new THREE.Group();
  g.position.set(x, y, z);

  // Quick-detach base clamp
  addChamferBox(g, 0.036, 0.014, 0.088, 0, 0.007, 0, mats.anodizedBlack, 0.0018);
  // Side QD lever & windage dial
  addChamferBox(g, 0.008, 0.010, 0.028, -0.021, 0.008, 0.008, mats.gunmetal, 0.0015);
  addPinX(g, 0.0045, 0.006, 0.020, 0.018, -0.006, mats.titanium);

  // Armored aluminum hood (sloped tactical profile)
  addChamferBox(g, 0.0055, 0.044, 0.066, -0.020, 0.034, -0.004, mats.gunmetal, 0.0014);
  addChamferBox(g, 0.0055, 0.044, 0.066, 0.020, 0.034, -0.004, mats.gunmetal, 0.0014);
  addChamferBox(g, 0.046, 0.0055, 0.066, 0, 0.056, -0.004, mats.gunmetal, 0.0014);

  // Front transverse CR123 battery compartment
  addCylZ(g, 0.011, 0.011, 0.034, 0, 0.022, -0.048, mats.darkSteel, 16);
  addPinX(g, 0.009, 0.042, 0, 0.022, -0.048, mats.anodizedBlack);

  // Anti-reflective optic window
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.034, 0.036), mats.opticGlass);
  glass.position.set(0, 0.035, 0.004);
  g.add(glass);

  // Crisp glowing holographic reticle (65-MOA ring + 4 ticks + 1-MOA center dot)
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.0068, 0.0080, 28), mats.redGlow);
  ring.position.set(0, 0.035, 0.005);
  g.add(ring);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0013, 12), mats.redGlow);
  dot.position.set(0, 0.035, 0.0052);
  g.add(dot);
  // 4 reticle hash ticks
  [[0, 0.009, 0.0012, 0.0032], [0, -0.009, 0.0012, 0.0032], [0.009, 0, 0.0032, 0.0012], [-0.009, 0, 0.0032, 0.0012]].forEach(([tx, ty, tw, th]) => {
    const tick = new THREE.Mesh(new THREE.PlaneGeometry(tw, th), mats.redGlow);
    tick.position.set(tx, 0.035 + ty, 0.0052);
    g.add(tick);
  });

  parent.add(g);
  return g;
}

/**
 * Trijicon RMR-style Micro Reflex Sight with concave owl-ear armored top
 */
function addMicroReflexSight(parent, x, y, z, mats) {
  const g = new THREE.Group();
  g.position.set(x, y, z);

  addChamferBox(g, 0.028, 0.007, 0.046, 0, 0.0035, 0, mats.anodizedBlack, 0.0012);
  addChamferBox(g, 0.004, 0.023, 0.025, -0.0125, 0.016, 0.004, mats.gunmetal, 0.001);
  addChamferBox(g, 0.004, 0.023, 0.025, 0.0125, 0.016, 0.004, mats.gunmetal, 0.001);
  // Dual top ears
  addChamferBox(g, 0.010, 0.004, 0.025, -0.0095, 0.027, 0.004, mats.gunmetal, 0.0008, 0, 0, 0.16);
  addChamferBox(g, 0.010, 0.004, 0.025, 0.0095, 0.027, 0.004, mats.gunmetal, 0.0008, 0, 0, -0.16);
  addChamferBox(g, 0.012, 0.003, 0.025, 0, 0.0255, 0.004, mats.gunmetal, 0.0006);

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
 * High-Power Nightforce-style Sniper Tactical Scope with cantilever mount & throw lever
 */
function addTacticalScope(parent, x, y, z, mats) {
  const g = new THREE.Group();
  g.position.set(x, y, z);

  // One-piece Spuhr-style cantilevered mount base
  addChamferBox(g, 0.030, 0.016, 0.15, 0, 0.008, -0.005, mats.anodizedBlack, 0.0018);
  [-0.06, 0.052].forEach((rz) => {
    addChamferBox(g, 0.032, 0.026, 0.024, 0, 0.022, rz, mats.darkSteel, 0.0018);
    addCylZ(g, 0.0225, 0.0225, 0.025, 0, 0.038, rz, mats.darkSteel, 20);
    // Ring clamp bolts
    addPinX(g, 0.0025, 0.044, 0, 0.038, rz, mats.titanium);
  });

  // Main 34mm tube
  addCylZ(g, 0.018, 0.018, 0.25, 0, 0.038, 0, mats.gunmetal, 24);
  // Flared front objective bell + sunshade
  addCylZ(g, 0.031, 0.018, 0.062, 0, 0.038, -0.142, mats.gunmetal, 26);
  addCylZ(g, 0.032, 0.032, 0.088, 0, 0.038, -0.215, mats.darkSteel, 26);
  // Emerald anti-reflective objective lens
  const frontLens = new THREE.Mesh(new THREE.CircleGeometry(0.028, 24), mats.scopeLens);
  frontLens.rotation.y = Math.PI;
  frontLens.position.set(0, 0.038, -0.258);
  g.add(frontLens);

  // Rear magnification ring + throw lever + eyepiece
  addCylZ(g, 0.023, 0.023, 0.022, 0, 0.038, 0.115, mats.polymerGrip, 22);
  addBox(g, 0.006, 0.026, 0.008, 0.018, 0.056, 0.115, mats.titanium, 0, 0, -0.5); // throw lever
  addCylZ(g, 0.018, 0.025, 0.048, 0, 0.038, 0.145, mats.gunmetal, 22);
  addCylZ(g, 0.026, 0.026, 0.036, 0, 0.038, 0.184, mats.polymerGrip, 22);
  const rearLens = new THREE.Mesh(new THREE.CircleGeometry(0.021, 20), mats.scopeLens);
  rearLens.position.set(0, 0.038, 0.203);
  g.add(rearLens);

  // Precision knurled tactical turrets (Elevation, Windage, Parallax)
  const elev = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.026, 20), mats.anodizedBlack);
  elev.position.set(0, 0.064, -0.005);
  g.add(elev);
  const elevCap = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.005, 20), mats.titanium);
  elevCap.position.set(0, 0.076, -0.005);
  g.add(elevCap);

  const wind = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.024, 18), mats.anodizedBlack);
  wind.rotation.z = Math.PI / 2;
  wind.position.set(0.029, 0.038, -0.005);
  g.add(wind);

  const para = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.022, 18), mats.anodizedBlack);
  para.rotation.z = Math.PI / 2;
  para.position.set(-0.028, 0.038, -0.005);
  g.add(para);

  parent.add(g);
  return g;
}

/**
 * Detachable Tactical Suppressor with QD collar, knurling rings, and recessed bore
 */
function createSuppressor(radius, length, mats) {
  const g = new THREE.Group();
  // Quick-detach locking collar
  addCylZ(g, radius * 1.12, radius * 1.12, 0.024, 0, 0, -0.012, mats.gunmetal, 24);
  // Main suppressor tube
  addCylZ(g, radius, radius, length, 0, 0, -length / 2, mats.anodizedBlack, 26);
  // Heat-dissipation flutes/rings
  for (let i = 1; i <= 6; i++) {
    addCylZ(g, radius * 1.038, radius * 1.038, 0.007, 0, 0, -length * (i / 7), mats.darkSteel, 26);
  }
  // Recessed bore exit
  const bore = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.42, 16), mats.boreBlack);
  bore.rotation.y = Math.PI;
  bore.position.set(0, 0, -length - 0.001);
  g.add(bore);

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
   1. M17-X TACTICAL PISTOL (9x19mm) - Sculpted Beveled Profile
   ============================================================ */
function buildPistol(mats) {
  const root = new THREE.Group();

  // Sculpted FDE Lower Frame + Beavertail + Ergonomic Pistol Grip
  addSculptedPart(
    root,
    [
      [-0.142, 0.022], // front dust cover top
      [0.048, 0.022],  // rear slide rail
      [0.068, 0.016],  // beavertail tip
      [0.056, 0.000],  // web curve
      [0.082, -0.112], // backstrap bottom
      [0.032, -0.120], // magwell front
      [0.014, -0.018], // grip front under trigger guard
      [-0.002, -0.004],
      [-0.142, -0.004], // underbarrel dust cover
    ],
    0.030,
    0,
    mats.fdeTan,
    0.0032
  );

  // Stippled side grip panels (left & right)
  addSculptedPart(
    root,
    [
      [0.048, -0.008],
      [0.074, -0.104],
      [0.036, -0.110],
      [0.020, -0.018],
    ],
    0.033,
    0,
    mats.polymerGrip,
    0.0018
  );

  // Sculpted Trigger Guard
  addSculptedPart(
    root,
    [
      [-0.052, -0.003],
      [-0.048, -0.040],
      [0.016, -0.040],
      [0.018, -0.032],
      [-0.039, -0.032],
      [-0.042, -0.003],
    ],
    0.012,
    0,
    mats.fdeTan,
    0.0016
  );

  // Underbarrel Picatinny Light (SureFire X300 style)
  addChamferBox(root, 0.028, 0.020, 0.058, 0, -0.016, -0.105, mats.anodizedBlack, 0.002);
  addCylZ(root, 0.0115, 0.0115, 0.036, 0, -0.016, -0.146, mats.darkSteel, 18);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.009, 16), mats.amberGlow);
  lens.rotation.y = Math.PI;
  lens.position.set(0, -0.016, -0.165);
  root.add(lens);

  // Takedown lever, slide catch & magazine release details
  addPinX(root, 0.0035, 0.035, 0, 0.010, -0.046, mats.darkSteel);
  addBox(root, 0.004, 0.008, 0.026, -0.017, 0.014, -0.008, mats.darkSteel);
  addPinX(root, 0.004, 0.034, 0, -0.022, 0.022, mats.darkSteel);

  // Match Flat-Faced Trigger (animated)
  const trigger = new THREE.Group();
  trigger.position.set(0, -0.004, -0.012);
  addChamferBox(trigger, 0.006, 0.027, 0.007, 0, -0.014, 0, mats.titanium, 0.001, -0.22);
  root.add(trigger);

  // Magazine (animated on reload)
  const magazine = new THREE.Group();
  addBox(magazine, 0.023, 0.115, 0.036, 0, -0.072, 0.050, mats.darkSteel, 0.23);
  addChamferBox(magazine, 0.032, 0.018, 0.048, 0, -0.126, 0.062, mats.fdeDark, 0.0025, 0.23);
  root.add(magazine);

  // Stainless Match Barrel + Recessed Bore + Ported Compensator
  addBarrelWithBore(root, 0.0084, 0.175, 0, 0.036, -0.080, mats.chrome, mats.boreBlack, false);
  addChamferBox(root, 0.029, 0.033, 0.034, 0, 0.036, -0.168, mats.anodizedBlack, 0.0025);
  addBox(root, 0.016, 0.008, 0.014, 0, 0.052, -0.168, mats.boreBlack); // top compensator vent
  addBox(root, 0.031, 0.010, 0.012, 0, 0.036, -0.168, mats.boreBlack); // side vents

  // Reciprocating CNC-Beveled Slide Group
  const slide = new THREE.Group();
  addChamferBox(slide, 0.033, 0.034, 0.196, 0, 0.038, -0.050, mats.gunmetal, 0.0042);
  // Slide serrations (angled rear & front)
  for (let i = 0; i < 6; i++) {
    addBox(slide, 0.0345, 0.022, 0.0028, 0, 0.037, 0.010 + i * 0.0055, mats.anodizedBlack, 0.12);
    addBox(slide, 0.0345, 0.020, 0.0028, 0, 0.037, -0.112 - i * 0.0052, mats.anodizedBlack, 0.12);
  }
  // Exposed stainless steel barrel hood in ejection port
  addChamferBox(slide, 0.014, 0.018, 0.042, 0.011, 0.044, -0.044, mats.chrome, 0.0015);

  // Trijicon RMR Micro Red-Dot Reflex Sight
  addMicroReflexSight(slide, 0, 0.055, -0.002, mats);

  // Suppressor-height Tritium Front Sight
  addChamferBox(slide, 0.0042, 0.010, 0.009, 0, 0.060, -0.138, mats.anodizedBlack, 0.0008);
  addBox(slide, 0.0026, 0.0032, 0.002, 0, 0.062, -0.133, mats.greenGlow);
  root.add(slide);

  // Suppressor
  const suppressor = createSuppressor(0.017, 0.18, mats);
  suppressor.position.set(0, 0.036, -0.185);
  root.add(suppressor);

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0, 0.036, -0.190);
  root.add(muzzlePoint);

  const ejectionPoint = new THREE.Object3D();
  ejectionPoint.position.set(0.022, 0.046, -0.044);
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
      suppressedMuzzleOffset: -0.18,
    },
  };
}

/* ============================================================
   2. H&K MP7-V PDW (4.6x30mm SMG) - Sculpted Tactical Chassis
   ============================================================ */
function buildSMG(mats) {
  const root = new THREE.Group();

  // Sculpted angular MP7 body silhouette
  addSculptedPart(
    root,
    [
      [-0.252, 0.068], // front nose top
      [0.105, 0.068],  // rear top
      [0.105, -0.012], // rear lower
      [0.052, -0.018], // behind grip
      [0.064, -0.118], // grip rear bottom
      [0.018, -0.122], // grip front bottom
      [0.004, -0.022], // behind trigger guard
      [-0.088, -0.022],// front of trigger guard
      [-0.105, -0.012],
      [-0.252, -0.008],// front nose bottom
    ],
    0.044,
    0,
    mats.tungsten,
    0.0036
  );

  // Upper dark steel shroud & continuous Picatinny rail
  addChamferBox(root, 0.040, 0.026, 0.352, 0, 0.062, -0.072, mats.anodizedBlack, 0.0028);
  addPicatinnyRail(root, 0.34, 0.024, 0.076, -0.072, mats.darkSteel);

  // Side ventilation slots & pins
  for (let i = 0; i < 4; i++) {
    addBox(root, 0.046, 0.009, 0.026, 0, 0.032, -0.135 - i * 0.034, mats.boreBlack);
  }
  addPinX(root, 0.004, 0.048, 0, 0.006, 0.082, mats.darkSteel);
  addPinX(root, 0.0035, 0.048, 0, 0.002, -0.008, mats.darkSteel);
  // Fire selector switch (red accent)
  addChamferBox(root, 0.006, 0.008, 0.020, -0.024, 0.004, 0.022, mats.anodizedBlack, 0.001);
  addBox(root, 0.002, 0.004, 0.004, -0.025, 0.012, 0.018, mats.safetyRed);

  // Stippled grip overlay
  addSculptedPart(
    root,
    [
      [0.048, -0.024],
      [0.058, -0.112],
      [0.022, -0.115],
      [0.012, -0.024],
    ],
    0.047,
    0,
    mats.polymerGrip,
    0.0018
  );

  // PEQ-15 Tactical Laser Module on right side rail
  addChamferBox(root, 0.022, 0.026, 0.082, 0.032, 0.042, -0.165, mats.fdeDark, 0.0022);
  const laserEmit = new THREE.Mesh(new THREE.CircleGeometry(0.004, 12), mats.greenGlow);
  laserEmit.rotation.y = Math.PI;
  laserEmit.position.set(0.034, 0.044, -0.207);
  root.add(laserEmit);

  // Extended 40-round Magazine inside grip
  const magazine = new THREE.Group();
  addChamferBox(magazine, 0.025, 0.185, 0.036, 0, -0.120, 0.044, mats.darkSteel, 0.002, 0.14);
  addChamferBox(magazine, 0.032, 0.016, 0.044, 0, -0.210, 0.057, mats.polymer, 0.002, 0.14);
  root.add(magazine);

  // Trigger guard & trigger
  addSculptedPart(
    root,
    [
      [-0.082, -0.018],
      [-0.075, -0.052],
      [0.008, -0.052],
      [0.010, -0.044],
      [-0.068, -0.044],
      [-0.074, -0.018],
    ],
    0.014,
    0,
    mats.polymer,
    0.0015
  );
  const trigger = new THREE.Group();
  trigger.position.set(0, -0.016, -0.030);
  addChamferBox(trigger, 0.007, 0.026, 0.008, 0, -0.013, 0, mats.titanium, 0.001, -0.2);
  root.add(trigger);

  // Folding vertical foregrip
  addChamferBox(root, 0.024, 0.095, 0.028, 0, -0.062, -0.195, mats.polymerGrip, 0.003, -0.08);

  // Retractable dual-rod steel wire stock + rubber buttpad
  addCylZ(root, 0.0052, 0.0052, 0.22, -0.022, 0.036, 0.20, mats.titanium, 12);
  addCylZ(root, 0.0052, 0.0052, 0.22, 0.022, 0.036, 0.20, mats.titanium, 12);
  addChamferBox(root, 0.050, 0.112, 0.026, 0, 0.008, 0.308, mats.polymerGrip, 0.004);

  // Barrel + Recessed Bore + Pronged Flash Hider
  addBarrelWithBore(root, 0.010, 0.12, 0, 0.034, -0.305, mats.darkSteel, mats.boreBlack, false);
  addCylZ(root, 0.0135, 0.012, 0.038, 0, 0.034, -0.348, mats.gunmetal, 14);

  // Reciprocating Chrome Bolt visible in ejection port
  const bolt = addChamferBox(root, 0.012, 0.020, 0.058, 0.020, 0.044, -0.025, mats.chrome, 0.0015);

  // EOTech Holographic Sight
  addHoloSight(root, 0, 0.081, -0.045, mats);

  // Suppressor
  const suppressor = createSuppressor(0.020, 0.20, mats);
  suppressor.position.set(0, 0.034, -0.365);
  root.add(suppressor);

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0, 0.034, -0.370);
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
   3. HK416-A8 CARBINE (5.56x45mm AR) - CNC Billet Sculpting
   ============================================================ */
function buildRifle(mats) {
  const root = new THREE.Group();

  // Upper Receiver (beveled CNC billet)
  addChamferBox(root, 0.044, 0.050, 0.225, 0, 0.036, -0.01, mats.gunmetal, 0.004);
  // Sculpted Lower Receiver + Angled Magwell Flare
  addSculptedPart(
    root,
    [
      [-0.105, 0.012], // front pivot pin lug
      [0.095, 0.012],  // rear buffer tower
      [0.095, -0.034], // above grip
      [0.035, -0.034], // behind trigger
      [-0.015, -0.034],
      [-0.028, -0.058], // magwell rear lip
      [-0.098, -0.048], // angled magwell front
    ],
    0.042,
    0,
    mats.darkSteel,
    0.003
  );

  // Brass deflector, forward assist, takedown pins, fire selector
  addChamferBox(root, 0.014, 0.018, 0.020, 0.025, 0.036, 0.032, mats.gunmetal, 0.002);
  addCylZ(root, 0.006, 0.006, 0.024, 0.025, 0.024, 0.058, mats.anodizedBlack, 12);
  addPinX(root, 0.0042, 0.048, 0, 0.002, -0.092, mats.titanium);
  addPinX(root, 0.0042, 0.048, 0, 0.002, 0.076, mats.titanium);
  addChamferBox(root, 0.006, 0.008, 0.022, -0.024, -0.014, 0.044, mats.anodizedBlack, 0.001);
  addBox(root, 0.002, 0.004, 0.004, -0.025, -0.005, 0.040, mats.safetyRed);

  // Slim Octagonal M-LOK Tactical Handguard (FDE Cerakote)
  addChamferBox(root, 0.044, 0.052, 0.295, 0, 0.034, -0.268, mats.fdeTan, 0.0065);
  // Recessed M-LOK slots showing barrel & stainless gas tube inside
  for (let i = 0; i < 5; i++) {
    addBox(root, 0.046, 0.011, 0.032, 0, 0.034, -0.155 - i * 0.052, mats.boreBlack);
  }
  // Full-length monolithic Top Picatinny Rail
  addPicatinnyRail(root, 0.51, 0.024, 0.062, -0.152, mats.anodizedBlack);

  // Ergonomic Angled Foregrip (AFG)
  addSculptedPart(
    root,
    [
      [-0.325, 0.008],
      [-0.215, 0.008],
      [-0.228, -0.032],
      [-0.258, -0.028],
      [-0.315, -0.014],
    ],
    0.030,
    0,
    mats.polymerGrip,
    0.0025
  );

  // Free-Float Heavy Barrel + Recessed Bore + Gas Block + 3-Prong Flash Hider
  addBarrelWithBore(root, 0.0115, 0.24, 0, 0.034, -0.49, mats.darkSteel, mats.boreBlack, false);
  addCylZ(root, 0.0032, 0.0032, 0.28, 0, 0.050, -0.29, mats.chrome, 10); // stainless gas piston rod
  addChamferBox(root, 0.024, 0.036, 0.028, 0, 0.032, -0.425, mats.gunmetal, 0.002);
  addCylZ(root, 0.014, 0.013, 0.056, 0, 0.034, -0.592, mats.anodizedBlack, 14);

  // Sculpted Ergonomic Pistol Grip with Finger Grooves
  addSculptedPart(
    root,
    [
      [0.034, -0.028],
      [0.088, -0.028],
      [0.106, -0.125],
      [0.062, -0.132],
      [0.038, -0.044],
    ],
    0.032,
    0,
    mats.polymer,
    0.0032
  );
  addSculptedPart(
    root,
    [
      [0.044, -0.038],
      [0.084, -0.038],
      [0.098, -0.118],
      [0.066, -0.123],
    ],
    0.035,
    0,
    mats.polymerGrip,
    0.0018
  );

  // Trigger guard & match trigger
  addChamferBox(root, 0.012, 0.006, 0.060, 0, -0.054, 0.010, mats.anodizedBlack, 0.001);
  const trigger = new THREE.Group();
  trigger.position.set(0, -0.024, 0.020);
  addChamferBox(trigger, 0.0065, 0.026, 0.007, 0, -0.013, 0, mats.chrome, 0.001, -0.24);
  root.add(trigger);

  // Sculpted Curved 30-round PMAG Magazine with Grip Ribs
  const magazine = new THREE.Group();
  addSculptedPart(
    magazine,
    [
      [-0.092, -0.042],
      [-0.032, -0.042],
      [-0.036, -0.135],
      [-0.058, -0.215],
      [-0.116, -0.200],
      [-0.095, -0.128],
    ],
    0.027,
    0,
    mats.polymer,
    0.0024
  );
  // Ranger floorplate
  addChamferBox(magazine, 0.032, 0.014, 0.066, 0, -0.214, -0.088, mats.fdeDark, 0.002, 0.24);
  root.add(magazine);

  // Buffer Tube & Sculpted SOPMOD Tactical Buttstock
  addCylZ(root, 0.018, 0.018, 0.23, 0, 0.034, 0.205, mats.anodizedBlack, 18);
  addSculptedPart(
    root,
    [
      [0.168, 0.054], // cheek weld front
      [0.345, 0.054], // top rear
      [0.345, -0.058],// toe of stock
      [0.248, -0.032],// angled lower contour
      [0.182, 0.012],
    ],
    0.046,
    0,
    mats.fdeTan,
    0.0045
  );
  // Rubber buttpad
  addChamferBox(root, 0.050, 0.122, 0.018, 0, -0.002, 0.354, mats.polymerGrip, 0.003);

  // Reciprocating Chrome Bolt Carrier
  const bolt = addChamferBox(root, 0.011, 0.020, 0.070, 0.020, 0.036, -0.025, mats.chrome, 0.0014);

  // EOTech Holographic Sight + Flip-up Front BUIS
  addHoloSight(root, 0, 0.069, -0.015, mats);
  addChamferBox(root, 0.018, 0.022, 0.022, 0, 0.076, -0.392, mats.anodizedBlack, 0.002);

  // Suppressor
  const suppressor = createSuppressor(0.021, 0.21, mats);
  suppressor.position.set(0, 0.034, -0.618);
  root.add(suppressor);

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0, 0.034, -0.622);
  root.add(muzzlePoint);

  const ejectionPoint = new THREE.Object3D();
  ejectionPoint.position.set(0.030, 0.038, -0.025);
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

  // Heavy CNC-Beveled Box Receiver + Hinged Feed Tray Cover
  addChamferBox(root, 0.068, 0.092, 0.345, 0, 0.022, -0.04, mats.gunmetal, 0.0042);
  addChamferBox(root, 0.062, 0.024, 0.245, 0, 0.074, -0.05, mats.darkSteel, 0.003);
  addPicatinnyRail(root, 0.225, 0.026, 0.088, -0.05, mats.anodizedBlack);
  // Receiver rivets & pins
  [-0.16, -0.06, 0.06, 0.11].forEach((z) => {
    addPinX(root, 0.004, 0.074, 0, 0.015, z, mats.titanium);
  });

  // Perforated Barrel Heat Shield & Tactical Handguard
  addChamferBox(root, 0.060, 0.050, 0.305, 0, -0.002, -0.34, mats.darkSteel, 0.004);
  addCylZ(root, 0.028, 0.028, 0.285, 0, 0.044, -0.34, mats.gunmetal, 18);
  for (let i = 0; i < 6; i++) {
    addBox(root, 0.064, 0.012, 0.024, 0, 0.042, -0.225 - i * 0.044, mats.boreBlack);
  }

  // Heavy Fluted Quick-Change Barrel + Bore + Gas Cylinder + Ported Muzzle Brake
  addBarrelWithBore(root, 0.0155, 0.29, 0, 0.044, -0.565, mats.darkSteel, mats.boreBlack, true);
  addCylZ(root, 0.011, 0.011, 0.22, 0, 0.004, -0.52, mats.gunmetal, 16);
  // Heavy ported muzzle brake
  addChamferBox(root, 0.034, 0.028, 0.074, 0, 0.044, -0.730, mats.anodizedBlack, 0.0025);
  addBox(root, 0.038, 0.013, 0.014, 0, 0.044, -0.718, mats.boreBlack);
  addBox(root, 0.038, 0.013, 0.014, 0, 0.044, -0.745, mats.boreBlack);

  // Folded Heavy Bipod under handguard
  addCylZ(root, 0.009, 0.009, 0.24, -0.028, -0.038, -0.38, mats.titanium, 12);
  addCylZ(root, 0.009, 0.009, 0.24, 0.028, -0.038, -0.38, mats.titanium, 12);
  addChamferBox(root, 0.024, 0.018, 0.030, -0.028, -0.038, -0.26, mats.polymerGrip, 0.002);
  addChamferBox(root, 0.024, 0.018, 0.030, 0.028, -0.038, -0.26, mats.polymerGrip, 0.002);

  // 100-Round Olive Drab Soft-Pack Ammo Box + Exposed 3D Brass Cartridge Belt
  const magazine = new THREE.Group();
  addChamferBox(magazine, 0.116, 0.145, 0.106, -0.012, -0.105, -0.095, mats.oliveDrab, 0.005);
  addChamferBox(magazine, 0.120, 0.016, 0.110, -0.012, -0.038, -0.095, mats.anodizedBlack, 0.002);

  const ammoBelt = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const bx = -0.056 + Math.sin(t * Math.PI * 0.6) * 0.018;
    const by = -0.032 + t * 0.072;
    const cart = new THREE.Group();
    cart.position.set(bx, by, -0.095);
    cart.rotation.z = -0.35 + t * 0.4;
    addCylZ(cart, 0.0056, 0.0060, 0.046, 0, 0, 0.006, mats.brass, 12);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.0053, 0.022, 12), mats.copper);
    tip.rotation.x = -Math.PI / 2;
    tip.position.set(0, 0, -0.028);
    cart.add(tip);
    addBox(cart, 0.014, 0.009, 0.016, 0, 0, 0.005, mats.anodizedBlack);
    ammoBelt.add(cart);
  }
  magazine.add(ammoBelt);
  root.add(magazine);

  // Sculpted Pistol Grip & Trigger
  addSculptedPart(
    root,
    [
      [0.062, -0.024],
      [0.112, -0.024],
      [0.128, -0.124],
      [0.084, -0.130],
      [0.064, -0.042],
    ],
    0.034,
    0,
    mats.polymer,
    0.0032
  );
  addBox(root, 0.014, 0.007, 0.060, 0, -0.050, 0.035, mats.anodizedBlack);
  const trigger = new THREE.Group();
  trigger.position.set(0, -0.022, 0.045);
  addChamferBox(trigger, 0.008, 0.028, 0.009, 0, -0.013, 0, mats.chrome, 0.001, -0.2);
  root.add(trigger);

  // Sculpted Heavy Para Stock
  addSculptedPart(
    root,
    [
      [0.130, 0.052],
      [0.360, 0.052],
      [0.360, -0.068],
      [0.295, -0.052],
      [0.240, -0.014],
      [0.130, -0.014],
    ],
    0.054,
    0,
    mats.darkSteel,
    0.0045
  );
  addChamferBox(root, 0.058, 0.132, 0.024, 0, -0.008, 0.368, mats.polymerGrip, 0.0035);

  // Reciprocating Chrome Charging Handle
  const bolt = addChamferBox(root, 0.024, 0.018, 0.046, 0.042, 0.038, -0.045, mats.chrome, 0.002);

  // EOTech Holographic Sight
  addHoloSight(root, 0, 0.095, -0.035, mats);

  // Suppressor
  const suppressor = createSuppressor(0.024, 0.23, mats);
  suppressor.position.set(0, 0.044, -0.768);
  root.add(suppressor);

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0, 0.044, -0.772);
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

  // Monolithic CNC FDE Chassis & Upper
  addChamferBox(root, 0.048, 0.062, 0.305, 0, 0.030, -0.03, mats.fdeTan, 0.0045);
  addChamferBox(root, 0.044, 0.048, 0.245, 0, -0.012, -0.01, mats.fdeDark, 0.0035);
  // Chassis takedown screws & bolt release
  [-0.14, -0.04, 0.08].forEach((z) => {
    addPinX(root, 0.004, 0.052, 0, 0.008, z, mats.titanium);
  });

  // Long Octagonal M-LOK Handguard with Ventilation Slots
  addChamferBox(root, 0.046, 0.056, 0.385, 0, 0.032, -0.37, mats.fdeTan, 0.007);
  for (let i = 0; i < 6; i++) {
    addBox(root, 0.050, 0.012, 0.036, 0, 0.032, -0.22 - i * 0.054, mats.boreBlack);
  }
  addPicatinnyRail(root, 0.67, 0.026, 0.064, -0.22, mats.anodizedBlack);

  // Long Heavy Fluted Barrel + Recessed Bore
  addBarrelWithBore(root, 0.0155, 0.45, 0, 0.034, -0.745, mats.darkSteel, mats.boreBlack, true);

  // Massive Barrett Twin-Baffle Rectangular Muzzle Brake (chamfered)
  addChamferBox(root, 0.054, 0.034, 0.108, 0, 0.034, -1.005, mats.anodizedBlack, 0.003);
  addBox(root, 0.058, 0.019, 0.022, 0, 0.034, -0.978, mats.boreBlack);
  addBox(root, 0.058, 0.019, 0.022, 0, 0.034, -1.026, mats.boreBlack);

  // Heavy Tactical Bipod
  addChamferBox(root, 0.042, 0.020, 0.036, 0, -0.008, -0.52, mats.anodizedBlack, 0.002);
  addCylZ(root, 0.008, 0.008, 0.22, -0.032, -0.028, -0.41, mats.titanium, 12);
  addCylZ(root, 0.008, 0.008, 0.22, 0.032, -0.028, -0.41, mats.titanium, 12);

  // Animated Precision Fluted Bolt & Oversized Knurled Bolt Handle
  const boltHandle = new THREE.Group();
  boltHandle.position.set(0, 0.034, 0.045);
  addCylZ(boltHandle, 0.012, 0.012, 0.105, 0, 0, -0.03, mats.chrome, 16);
  addChamferBox(boltHandle, 0.048, 0.009, 0.010, 0.028, -0.006, 0.012, mats.darkSteel, 0.0015, 0, 0, -0.35);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.0135, 16, 16), mats.polymerGrip);
  knob.position.set(0.052, -0.016, 0.012);
  boltHandle.add(knob);
  root.add(boltHandle);

  // Sculpted Precision Pistol Grip
  addSculptedPart(
    root,
    [
      [0.048, -0.028],
      [0.098, -0.028],
      [0.112, -0.130],
      [0.068, -0.136],
      [0.050, -0.042],
    ],
    0.032,
    0,
    mats.polymer,
    0.0032
  );
  addBox(root, 0.012, 0.006, 0.062, 0, -0.052, 0.018, mats.anodizedBlack);
  const trigger = new THREE.Group();
  trigger.position.set(0, -0.022, 0.028);
  addChamferBox(trigger, 0.006, 0.026, 0.007, 0, -0.013, 0, mats.chrome, 0.001, -0.15);
  root.add(trigger);

  // 10-Round .338 Box Magazine
  const magazine = new THREE.Group();
  addChamferBox(magazine, 0.034, 0.125, 0.095, 0, -0.085, -0.075, mats.anodizedBlack, 0.0025);
  addChamferBox(magazine, 0.038, 0.015, 0.100, 0, -0.150, -0.075, mats.polymerGrip, 0.002);
  root.add(magazine);

  // Skeletonized Precision Folding Stock with Adjustable Cheek Riser & Bag Rider
  addChamferBox(root, 0.038, 0.030, 0.265, 0, 0.034, 0.252, mats.fdeTan, 0.003);
  addChamferBox(root, 0.034, 0.020, 0.225, 0, -0.032, 0.252, mats.fdeDark, 0.0025, 0.12);
  addChamferBox(root, 0.044, 0.024, 0.135, 0, 0.062, 0.232, mats.polymerGrip, 0.004);
  addChamferBox(root, 0.046, 0.128, 0.026, 0, 0.002, 0.382, mats.polymerGrip, 0.004);

  // High-Power Nightforce-style Tactical Scope
  addTacticalScope(root, 0, 0.072, -0.06, mats);

  // Large Caliber Suppressor
  const suppressor = createSuppressor(0.026, 0.26, mats);
  suppressor.position.set(0, 0.034, -1.055);
  root.add(suppressor);

  const muzzlePoint = new THREE.Object3D();
  muzzlePoint.position.set(0, 0.034, -1.062);
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
