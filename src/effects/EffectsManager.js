import * as THREE from 'three';

function createFlashTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255, 255, 240, 1)');
  grad.addColorStop(0.25, 'rgba(255, 210, 90, 0.95)');
  grad.addColorStop(0.55, 'rgba(255, 110, 20, 0.55)');
  grad.addColorStop(1, 'rgba(255, 60, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function createSmokeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
  grad.addColorStop(0, 'rgba(215, 220, 230, 0.45)');
  grad.addColorStop(0.6, 'rgba(180, 185, 195, 0.18)');
  grad.addColorStop(1, 'rgba(150, 155, 165, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export class EffectsManager {
  constructor(scene) {
    this.scene = scene;
    this.casings = [];
    this.tracers = [];
    this.sparks = [];
    this.smokes = [];

    // Shared geometries/materials
    this.casingGeo = new THREE.CylinderGeometry(0.0048, 0.0052, 0.024, 8);
    this.casingMat = new THREE.MeshStandardMaterial({
      color: 0xe2b144,
      metalness: 0.92,
      roughness: 0.22,
    });

    this.sparkGeo = new THREE.BoxGeometry(0.015, 0.015, 0.06);
    this.sparkMat = new THREE.MeshBasicMaterial({ color: 0xffcc44 });

    this.smokeMatBase = new THREE.SpriteMaterial({
      map: createSmokeTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.35,
    });

    // Muzzle flash group (crossed planes + point light)
    const flashTex = createFlashTexture();
    const flashMat = new THREE.MeshBasicMaterial({
      map: flashTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.flashGroup = new THREE.Group();
    const p1 = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), flashMat);
    const p2 = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), flashMat);
    p2.rotation.y = Math.PI / 2;
    const p3 = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), flashMat);
    p3.rotation.x = Math.PI / 2;
    this.flashGroup.add(p1, p2, p3);
    this.flashGroup.visible = false;
    this.scene.add(this.flashGroup);

    this.flashLight = new THREE.PointLight(0xffaa44, 0, 8);
    this.scene.add(this.flashLight);
    this.flashTimer = 0;
  }

  spawnMuzzleFlash(worldPos, suppressed = false, scale = 1.0) {
    this.flashGroup.position.copy(worldPos);
    const s = suppressed ? 0.22 * scale : (0.85 + Math.random() * 0.45) * scale;
    this.flashGroup.scale.set(s, s, s);
    this.flashGroup.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    this.flashGroup.visible = true;

    this.flashLight.position.copy(worldPos);
    this.flashLight.intensity = suppressed ? 1.2 : 11.0 * scale;
    this.flashTimer = 0.042;

    // Spawn 1-2 gunsmoke puffs
    this.spawnSmoke(worldPos, suppressed ? 0.5 : 1.0);
  }

  spawnSmoke(worldPos, scale = 1.0) {
    const mat = this.smokeMatBase.clone();
    mat.opacity = 0.28;
    const sprite = new THREE.Sprite(mat);
    sprite.position.copy(worldPos);
    sprite.scale.set(0.08 * scale, 0.08 * scale, 1);
    this.scene.add(sprite);

    this.smokes.push({
      sprite,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 0.18,
        0.32 + Math.random() * 0.22,
        -0.35 - Math.random() * 0.2
      ),
      life: 0,
      maxLife: 0.75 + Math.random() * 0.35,
      scale,
    });
  }

  spawnShellCasing(worldPos, cameraQuat, scale = 1.0) {
    const mesh = new THREE.Mesh(this.casingGeo, this.casingMat);
    mesh.position.copy(worldPos);
    mesh.scale.setScalar(scale);
    mesh.quaternion.copy(cameraQuat);
    this.scene.add(mesh);

    // Eject to the right and slightly up/back relative to camera
    const ejectDir = new THREE.Vector3(
      1.35 + Math.random() * 0.65,
      0.85 + Math.random() * 0.55,
      0.15 + Math.random() * 0.35
    ).applyQuaternion(cameraQuat);

    this.casings.push({
      mesh,
      vel: ejectDir,
      angVel: new THREE.Vector3(
        (Math.random() - 0.5) * 28,
        (Math.random() - 0.5) * 28,
        (Math.random() - 0.5) * 28
      ),
      life: 0,
      maxLife: 2.6,
    });

    // Cap max active casings
    if (this.casings.length > 45) {
      const old = this.casings.shift();
      this.scene.remove(old.mesh);
    }
  }

  spawnTracer(startPos, endPos) {
    const geo = new THREE.BufferGeometry().setFromPoints([startPos, endPos]);
    const mat = new THREE.LineBasicMaterial({
      color: 0xffd166,
      transparent: true,
      opacity: 0.85,
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0, maxLife: 0.065 });
  }

  spawnSparks(hitPos, normal, count = 10) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.sparkGeo, this.sparkMat);
      mesh.position.copy(hitPos);
      const vel = normal
        .clone()
        .multiplyScalar(2.5 + Math.random() * 4.5)
        .add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 5.0,
            (Math.random() - 0.2) * 4.5,
            (Math.random() - 0.5) * 5.0
          )
        );
      mesh.lookAt(hitPos.clone().add(vel));
      this.scene.add(mesh);
      this.sparks.push({ mesh, vel, life: 0, maxLife: 0.24 + Math.random() * 0.16 });
    }
  }

  update(dt) {
    // Muzzle flash fade
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.flashGroup.visible = false;
        this.flashLight.intensity = 0;
      }
    }

    // Shell casings physics
    for (let i = this.casings.length - 1; i >= 0; i--) {
      const c = this.casings[i];
      c.life += dt;
      c.vel.y -= 9.8 * dt;
      c.mesh.position.addScaledVector(c.vel, dt);
      c.mesh.rotation.x += c.angVel.x * dt;
      c.mesh.rotation.y += c.angVel.y * dt;
      c.mesh.rotation.z += c.angVel.z * dt;

      // Floor / bench bounce
      if (c.mesh.position.y < 0.02) {
        c.mesh.position.y = 0.02;
        c.vel.y *= -0.42;
        c.vel.x *= 0.65;
        c.vel.z *= 0.65;
        c.angVel.multiplyScalar(0.5);
      }

      if (c.life >= c.maxLife) {
        this.scene.remove(c.mesh);
        this.casings.splice(i, 1);
      }
    }

    // Bullet tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life += dt;
      t.line.material.opacity = Math.max(0, 1 - t.life / t.maxLife);
      if (t.life >= t.maxLife) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        this.tracers.splice(i, 1);
      }
    }

    // Sparks
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life += dt;
      s.vel.y -= 11.0 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      const scale = Math.max(0.01, 1 - s.life / s.maxLife);
      s.mesh.scale.setScalar(scale);
      if (s.life >= s.maxLife) {
        this.scene.remove(s.mesh);
        this.sparks.splice(i, 1);
      }
    }

    // Gunsmoke puffs
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const sm = this.smokes[i];
      sm.life += dt;
      sm.sprite.position.addScaledVector(sm.vel, dt);
      const p = sm.life / sm.maxLife;
      const sz = (0.08 + p * 0.35) * sm.scale;
      sm.sprite.scale.set(sz, sz, 1);
      sm.sprite.material.opacity = Math.max(0, 0.28 * (1 - p));
      if (sm.life >= sm.maxLife) {
        this.scene.remove(sm.sprite);
        sm.sprite.material.dispose();
        this.smokes.splice(i, 1);
      }
    }
  }
}
