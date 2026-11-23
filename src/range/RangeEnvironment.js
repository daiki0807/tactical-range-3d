import * as THREE from 'three';

function createPaperTargetCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 768;
  const ctx = canvas.getContext('2d');
  drawCleanPaperTarget(ctx, 512, 768);
  return { canvas, ctx };
}

function drawCleanPaperTarget(ctx, w, h) {
  // Off-white tactical target paper
  ctx.fillStyle = '#e7e2d3';
  ctx.fillRect(0, 0, w, h);

  // Subtle grid
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 32) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y < h; y += 32) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  // Border
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, w - 20, h - 20);

  // Dark silhouette body
  ctx.fillStyle = '#1e242b';
  // Head
  ctx.beginPath();
  ctx.roundRect(w * 0.38, h * 0.08, w * 0.24, h * 0.16, 28);
  ctx.fill();
  // Shoulders & Torso
  ctx.beginPath();
  ctx.roundRect(w * 0.16, h * 0.26, w * 0.68, h * 0.64, [70, 70, 12, 12]);
  ctx.fill();

  // Head A-Zone box
  ctx.strokeStyle = '#ff5533';
  ctx.lineWidth = 4;
  ctx.strokeRect(w * 0.42, h * 0.11, w * 0.16, h * 0.10);

  // Torso scoring rings
  const cx = w * 0.5;
  const cy = h * 0.50;
  const rings = [
    { r: 155, color: '#4d5866', label: '6' },
    { r: 112, color: '#7b8794', label: '8' },
    { r: 68, color: '#d4dbe3', label: '9' },
    { r: 34, color: '#ff4433', label: '10' },
  ];
  rings.forEach((ring) => {
    ctx.beginPath();
    ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = 4;
    ctx.stroke();
  });

  // Bullseye cross
  ctx.fillStyle = '#ff4433';
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fill();

  // Ring numbers
  ctx.fillStyle = '#d4dbe3';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('10', cx, cy - 40);
  ctx.fillText('8', cx, cy - 82);
  ctx.fillText('6', cx, cy - 125);
  ctx.fillStyle = '#ff5533';
  ctx.fillText('HEAD', cx, h * 0.10);
}

function createDistanceSignTexture(label) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#11151b';
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 248, 88);
  ctx.fillStyle = '#f59e0b';
  ctx.font = 'bold 52px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 50);
  return new THREE.CanvasTexture(canvas);
}

export class RangeEnvironment {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.shootableMeshes = [];
    this.paperTargets = [];
    this.steelTargets = [];
    this.movingEnabled = false;
    this.elapsed = 0;

    this._buildRoom();
    this._buildBench();
    this._buildTargets();
  }

  _buildRoom() {
    const width = 18;
    const height = 6.2;
    const length = 54;

    // Concrete Floor
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const fctx = floorCanvas.getContext('2d');
    fctx.fillStyle = '#25282e';
    fctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4000; i++) {
      const v = 30 + Math.floor(Math.random() * 24);
      fctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
      fctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
    }
    // Subtle tile lines
    fctx.strokeStyle = 'rgba(0,0,0,0.28)';
    fctx.lineWidth = 2;
    fctx.strokeRect(0, 0, 512, 512);

    const floorTex = new THREE.CanvasTexture(floorCanvas);
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(6, 18);

    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.72,
      metalness: 0.15,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, length), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -length / 2 + 4);
    floor.receiveShadow = true;
    this.group.add(floor);

    // Tactical lane yellow guide lines on floor
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xd9941e });
    [-2.4, 2.4].forEach((x) => {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.08, length - 6), lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.005, -length / 2 + 3);
      this.group.add(line);
    });

    // Side Walls with Acoustic Baffles
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x1e2229,
      roughness: 0.88,
      metalness: 0.1,
    });
    const baffleMat = new THREE.MeshStandardMaterial({
      color: 0x15181e,
      roughness: 0.92,
      metalness: 0.12,
    });

    [-width / 2, width / 2].forEach((x) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, height, length), wallMat);
      wall.position.set(x, height / 2, -length / 2 + 4);
      wall.receiveShadow = true;
      this.group.add(wall);

      // Vertical acoustic pillars + amber accent strip
      for (let z = 0; z >= -46; z -= 6) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.55, height, 0.5), baffleMat);
        pillar.position.set(x + (x < 0 ? 0.2 : -0.2), height / 2, z);
        this.group.add(pillar);
      }
    });

    // Ceiling & Overhead Acoustic Baffles + Glowing LED Bars
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(width, length), baffleMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, height, -length / 2 + 4);
    this.group.add(ceil);

    const ledMat = new THREE.MeshBasicMaterial({ color: 0xe6f2ff });
    for (let z = -2; z >= -44; z -= 7) {
      // Baffle beam
      const beam = new THREE.Mesh(new THREE.BoxGeometry(width, 0.5, 0.35), baffleMat);
      beam.position.set(0, height - 0.25, z);
      this.group.add(beam);

      // LED light bar
      const led = new THREE.Mesh(new THREE.BoxGeometry(8.0, 0.07, 0.18), ledMat);
      led.position.set(0, height - 0.52, z);
      this.group.add(led);
    }

    // Backstop Bullet Trap (angled steel plates at Z = -49)
    const backstopMat = new THREE.MeshStandardMaterial({
      color: 0x12151a,
      roughness: 0.65,
      metalness: 0.6,
    });
    const backstop = new THREE.Mesh(new THREE.BoxGeometry(width, height, 1.5), backstopMat);
    backstop.position.set(0, height / 2, -49.5);
    backstop.userData = { type: 'backstop' };
    this.group.add(backstop);
    this.shootableMeshes.push(backstop);

    // Distance Marker Signs on left wall (10M, 25M, 40M)
    [
      { z: -10, label: '10M' },
      { z: -22, label: '25M' },
      { z: -40, label: '50M' },
    ].forEach((m) => {
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(1.1, 0.42),
        new THREE.MeshBasicMaterial({ map: createDistanceSignTexture(m.label) })
      );
      sign.position.set(-width / 2 + 0.55, 2.8, m.z);
      sign.rotation.y = Math.PI / 2;
      this.group.add(sign);
    });
  }

  _buildBench() {
    // Tactical shooting bench in front of shooter
    const benchMat = new THREE.MeshStandardMaterial({
      color: 0x20252d,
      roughness: 0.65,
      metalness: 0.35,
    });
    const matRubber = new THREE.MeshStandardMaterial({
      color: 0x14171c,
      roughness: 0.9,
      metalness: 0.05,
    });

    const tableTop = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 0.85), benchMat);
    tableTop.position.set(0, 0.96, -1.05);
    tableTop.receiveShadow = true;
    this.group.add(tableTop);

    const pad = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.015, 0.58), matRubber);
    pad.position.set(0, 1.008, -1.05);
    this.group.add(pad);

    // Side booth dividers
    const dividerMat = new THREE.MeshStandardMaterial({
      color: 0x1a1e24,
      roughness: 0.75,
      metalness: 0.3,
    });
    [-1.7, 1.7].forEach((x) => {
      const div = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.3, 1.5), dividerMat);
      div.position.set(x, 1.15, -0.8);
      this.group.add(div);
    });

    // Ammo Crate prop on left of bench
    const crateMat = new THREE.MeshStandardMaterial({
      color: 0x3b4834,
      roughness: 0.55,
      metalness: 0.45,
    });
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.19, 0.16), crateMat);
    crate.position.set(-1.12, 1.095, -1.05);
    crate.rotation.y = 0.25;
    this.group.add(crate);
  }

  _buildTargets() {
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x2a2f38,
      roughness: 0.5,
      metalness: 0.7,
    });

    // 3 Paper Silhouette Targets at 10m (left), 22m (center - movable), 40m (right)
    const paperConfigs = [
      { x: -1.65, z: -10, scale: 1.0, movable: false, distLabel: 10 },
      { x: 0.0, z: -22, scale: 1.12, movable: true, distLabel: 25 },
      { x: 2.1, z: -40, scale: 1.35, movable: false, distLabel: 50 },
    ];

    paperConfigs.forEach((cfg) => {
      const holder = new THREE.Group();
      holder.position.set(cfg.x, 1.65, cfg.z);

      // Overhead hanger rod
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 4.2, 8), frameMat);
      rod.position.set(0, 2.4, 0);
      holder.add(rod);

      // Target clip bar
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.86 * cfg.scale, 0.05, 0.04), frameMat);
      bar.position.set(0, 0.62 * cfg.scale, 0);
      holder.add(bar);

      const { canvas, ctx } = createPaperTargetCanvas();
      const tex = new THREE.CanvasTexture(canvas);
      const targetMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.82 * cfg.scale, 1.22 * cfg.scale, 0.02),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0.05 })
      );
      targetMesh.castShadow = true;
      targetMesh.receiveShadow = true;

      const targetObj = {
        holder,
        mesh: targetMesh,
        canvas,
        ctx,
        tex,
        baseX: cfg.x,
        movable: cfg.movable,
        distance: cfg.distLabel,
        swayVel: 0,
        swayAngle: 0,
      };
      targetMesh.userData = { type: 'paper', targetObj };
      holder.add(targetMesh);
      this.group.add(holder);
      this.paperTargets.push(targetObj);
      this.shootableMeshes.push(targetMesh);
    });

    // 4 Reactive Steel Gongs / Plates at 15m and 30m
    const steelConfigs = [
      { x: 1.55, y: 1.45, z: -15, radius: 0.24, color: 0xf97316, dist: 15 },
      { x: 2.35, y: 1.45, z: -15, radius: 0.19, color: 0xef4444, dist: 15 },
      { x: -1.95, y: 1.55, z: -30, radius: 0.30, color: 0xf97316, dist: 30 },
      { x: -0.95, y: 1.55, z: -30, radius: 0.25, color: 0xeab308, dist: 30 },
    ];

    steelConfigs.forEach((cfg) => {
      const stand = new THREE.Group();
      stand.position.set(cfg.x, 0, cfg.z);

      // Steel post
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, cfg.y, 12), frameMat);
      post.position.set(0, cfg.y / 2, 0);
      stand.add(post);

      // Hinged pivot for plate recoil
      const pivot = new THREE.Group();
      pivot.position.set(0, cfg.y, 0);

      const plateMat = new THREE.MeshStandardMaterial({
        color: cfg.color,
        roughness: 0.38,
        metalness: 0.72,
      });
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(cfg.radius, cfg.radius, 0.035, 24), plateMat);
      plate.rotation.x = Math.PI / 2;
      plate.position.set(0, cfg.radius * 0.2, 0);
      plate.castShadow = true;

      const steelObj = {
        pivot,
        plate,
        angle: 0,
        vel: 0,
        distance: cfg.dist,
      };
      plate.userData = { type: 'steel', steelObj };

      pivot.add(plate);
      stand.add(pivot);
      this.group.add(stand);
      this.steelTargets.push(steelObj);
      this.shootableMeshes.push(plate);
    });
  }

  /**
   * Paint a realistic bullet hole onto a paper target & compute score
   */
  registerPaperHit(targetObj, uv) {
    const x = uv.x * targetObj.canvas.width;
    const y = (1 - uv.y) * targetObj.canvas.height;
    const ctx = targetObj.ctx;

    // Outer scorched ring
    ctx.beginPath();
    ctx.arc(x, y, 8.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20, 18, 16, 0.55)';
    ctx.fill();

    // Inner bullet hole
    ctx.beginPath();
    ctx.arc(x, y, 4.8, 0, Math.PI * 2);
    ctx.fillStyle = '#09090b';
    ctx.fill();

    targetObj.tex.needsUpdate = true;

    // Slight sway impulse
    targetObj.swayVel += 0.55;

    // Determine score zone
    const w = targetObj.canvas.width;
    const h = targetObj.canvas.height;
    // Head zone
    if (x >= w * 0.38 && x <= w * 0.62 && y >= h * 0.08 && y <= h * 0.24) {
      return { score: 100, label: 'HEADSHOT +100' };
    }
    const dx = x - w * 0.5;
    const dy = y - h * 0.5;
    const dist = Math.hypot(dx, dy);
    if (dist <= 36) return { score: 50, label: 'BULLSEYE +50' };
    if (dist <= 70) return { score: 30, label: 'INNER +30' };
    if (dist <= 115) return { score: 20, label: 'TARGET +20' };
    if (dist <= 165) return { score: 10, label: 'HIT +10' };
    return { score: 5, label: 'PAPER +5' };
  }

  registerSteelHit(steelObj, power = 1.0) {
    steelObj.vel = -7.5 * power;
    return { score: 40, label: 'STEEL PING +40' };
  }

  resetTargets() {
    this.paperTargets.forEach((t) => {
      drawCleanPaperTarget(t.ctx, t.canvas.width, t.canvas.height);
      t.tex.needsUpdate = true;
      t.swayAngle = 0;
      t.swayVel = 0;
    });
    this.steelTargets.forEach((s) => {
      s.angle = 0;
      s.vel = 0;
      s.pivot.rotation.x = 0;
    });
  }

  update(dt) {
    this.elapsed += dt;

    // Paper target swing & optional moving trolley
    this.paperTargets.forEach((t) => {
      if (t.movable && this.movingEnabled) {
        t.holder.position.x = t.baseX + Math.sin(this.elapsed * 1.15) * 2.6;
      } else if (t.movable) {
        t.holder.position.x += (t.baseX - t.holder.position.x) * Math.min(1, dt * 4);
      }
      // Spring-damper swing
      const spring = -t.swayAngle * 24 - t.swayVel * 5.2;
      t.swayVel += spring * dt;
      t.swayAngle += t.swayVel * dt;
      t.mesh.rotation.x = t.swayAngle;
    });

    // Steel target spring-damper recoil
    this.steelTargets.forEach((s) => {
      const spring = -s.angle * 38 - s.vel * 4.5;
      s.vel += spring * dt;
      s.angle += s.vel * dt;
      s.angle = Math.max(-1.25, Math.min(0.45, s.angle));
      s.pivot.rotation.x = s.angle;
    });
  }
}
