import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { WEAPON_SPECS } from './weapons/weaponSpecs.js';
import { createMaterialLibrary } from './weapons/MaterialLibrary.js';
import { buildWeaponModel } from './weapons/WeaponBuilder.js';
import { RangeEnvironment } from './range/RangeEnvironment.js';
import { EffectsManager } from './effects/EffectsManager.js';
import { SoundEngine } from './audio/SoundEngine.js';

class TacticalRangeApp {
  constructor() {
    this.canvas = document.getElementById('webgl-canvas');
    this.sound = new SoundEngine();

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;

    // Scene & Studio-grade Metal Reflections (PMREM)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c0f15);
    this.scene.fog = new THREE.FogExp2(0x0c0f15, 0.014);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 1.25;
    pmremGenerator.dispose();

    // Camera
    this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.05, 120);
    this.baseCamPos = new THREE.Vector3(0, 1.62, 0.25);
    this.camera.position.copy(this.baseCamPos);
    this.scene.add(this.camera);

    // Lighting
    this._setupLights();

    // Range & Effects
    this.range = new RangeEnvironment(this.scene);
    this.effects = new EffectsManager(this.scene);
    this.mats = createMaterialLibrary();

    // Weapon Holder attached to camera (for Shooting Mode)
    this.weaponRig = new THREE.Group();
    this.camera.add(this.weaponRig);

    // Inspect Showcase Group (for 360° Inspect Mode)
    this.inspectPivot = new THREE.Group();
    this.inspectPivot.position.set(0, 1.58, -0.55);
    this.inspectPivot.visible = false;
    this.scene.add(this.inspectPivot);

    // Pre-build all 5 weapons
    this.weaponModels = {};
    this.ammoState = {};
    this.fireModeState = {};
    WEAPON_SPECS.forEach((spec) => {
      this.weaponModels[spec.id] = buildWeaponModel(spec.id, this.mats);
      this.ammoState[spec.id] = spec.magSize;
      this.fireModeState[spec.id] = spec.defaultMode;
    });

    // State
    this.started = false;
    this.inspectMode = false;
    this.suppressed = false;
    this.isAds = false;
    this.isMouseDown = false;
    this.isReloading = false;
    this.reloadElapsed = 0;
    this.boltTimer = 0;
    this.fireCooldown = 0;
    this.burstRemaining = 0;
    this.score = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;

    // Aim & Recoil Dynamics
    this.targetYaw = 0;
    this.targetPitch = 0;
    this.currentYaw = 0;
    this.currentPitch = 0;
    this.recoilZ = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.slideKick = 0;
    this.triggerPull = 0;
    this.swayTime = 0;
    this.crosshairSpread = 0;

    // Inspect Orbit State
    this.inspectDragging = false;
    this.inspectLastX = 0;
    this.inspectLastY = 0;
    this.inspectRotY = -0.65;
    this.inspectRotX = 0.14;
    this.inspectZoom = 0.92;

    this.raycaster = new THREE.Raycaster();
    this.clock = new THREE.Clock();

    this._initUI();
    this.selectWeapon('rifle'); // Start with HK416-A8 Carbine
    this._bindEvents();
    this._animate();
  }

  _setupLights() {
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x1e242c, 0.75);
    this.scene.add(hemi);

    // Overhead range bay spotlights
    const bayPositions = [-1.5, -10, -22, -36];
    bayPositions.forEach((z, idx) => {
      const light = new THREE.PointLight(0xeef6ff, idx === 0 ? 18 : 26, 22, 1.4);
      light.position.set(0, 5.2, z);
      if (idx === 0) {
        light.castShadow = true;
        light.shadow.mapSize.set(1024, 1024);
      }
      this.scene.add(light);
    });

    // Warm rim light on camera to make gun metal edges gleam!
    const gunKey = new THREE.DirectionalLight(0xfff4e6, 1.35);
    gunKey.position.set(1.8, 2.2, 1.5);
    this.camera.add(gunKey);

    const gunRim = new THREE.DirectionalLight(0x60a5fa, 0.75);
    gunRim.position.set(-2.0, 1.2, -1.0);
    this.camera.add(gunRim);
  }

  _initUI() {
    const dock = document.getElementById('weapon-dock');
    dock.innerHTML = '';
    WEAPON_SPECS.forEach((spec, idx) => {
      const btn = document.createElement('button');
      btn.className = 'weapon-card';
      btn.dataset.id = spec.id;
      btn.innerHTML = `
        <span class="wc-num">${idx + 1}</span>
        <span class="wc-cat">${spec.category.split(' / ')[0]}</span>
        <span class="wc-name">${spec.name}</span>
        <span class="wc-cal">${spec.caliber.split(' ')[0]}</span>
      `;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectWeapon(spec.id);
      });
      dock.appendChild(btn);
    });

    document.getElementById('btn-start').addEventListener('click', () => {
      this.sound.init();
      this.started = true;
      document.getElementById('start-overlay').classList.add('hidden');
    });

    document.getElementById('btn-inspect').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleInspectMode();
    });
    document.getElementById('btn-suppressor').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSuppressor();
    });
    document.getElementById('btn-firemode').addEventListener('click', (e) => {
      e.stopPropagation();
      this.cycleFireMode();
    });
    document.getElementById('btn-moving').addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMovingTarget();
    });
    document.getElementById('btn-reset').addEventListener('click', (e) => {
      e.stopPropagation();
      this.range.resetTargets();
      this.sound.playDryFire();
    });
    document.getElementById('btn-reload').addEventListener('click', (e) => {
      e.stopPropagation();
      this.startReload();
    });
    document.getElementById('btn-mute').addEventListener('click', (e) => {
      e.stopPropagation();
      const next = !this.sound.muted;
      this.sound.setMuted(next);
      e.currentTarget.textContent = next ? '🔇' : '🔊';
    });
  }

  selectWeapon(id) {
    const spec = WEAPON_SPECS.find((w) => w.id === id);
    if (!spec) return;

    this.currentSpec = spec;
    this.isReloading = false;
    this.boltTimer = 0;
    this.burstRemaining = 0;
    this.fireCooldown = 0;
    document.getElementById('reload-bar-wrap').classList.add('hidden');

    // Clear previous weapon from both parents
    this.weaponRig.clear();
    this.inspectPivot.clear();

    const modelObj = this.weaponModels[id];
    this.currentModel = modelObj;
    modelObj.root.position.set(0, 0, 0);
    modelObj.root.rotation.set(0, 0, 0);
    modelObj.root.scale.setScalar(1);

    // Sync suppressor mesh
    if (modelObj.parts.suppressor) {
      modelObj.parts.suppressor.visible = this.suppressed;
    }

    if (this.inspectMode) {
      this._mountForInspect();
    } else {
      this.weaponRig.add(modelObj.root);
      this.weaponRig.position.set(...spec.hipPos);
    }

    // Update HUD
    document.getElementById('hud-category').textContent = spec.category;
    document.getElementById('hud-weapon-name').textContent = spec.name;
    document.getElementById('hud-weapon-meta').textContent = `${spec.caliber} • ${spec.rpm} RPM`;
    document.getElementById('hud-weapon-desc').textContent = spec.description;

    document.querySelectorAll('.weapon-card').forEach((card) => {
      card.classList.toggle('active', card.dataset.id === id);
    });

    this._updateAmmoHUD();
    this._updateFireModeHUD();
    if (this.started) this.sound.playDryFire();
  }

  _mountForInspect() {
    this.weaponRig.clear();
    this.inspectPivot.clear();
    this.inspectPivot.visible = true;

    const root = this.currentModel.root;
    // Center bounding box so rotation orbits around the center of the firearm
    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);
    this.inspectPivot.add(root);
    this.inspectPivot.rotation.set(this.inspectRotX, this.inspectRotY, 0);
  }

  toggleInspectMode() {
    this.inspectMode = !this.inspectMode;
    this.isAds = false;
    this.isMouseDown = false;

    document.body.classList.toggle('inspect-mode', this.inspectMode);
    document.getElementById('btn-inspect').classList.toggle('active', this.inspectMode);
    document.getElementById('inspect-banner').classList.toggle('hidden', !this.inspectMode);
    document.getElementById('crosshair').classList.toggle('hidden', this.inspectMode);
    document.getElementById('scope-overlay').classList.add('hidden');

    if (this.inspectMode) {
      this.inspectRotY = -0.75;
      this.inspectRotX = 0.12;
      this.inspectZoom = this.currentSpec.id === 'pistol' ? 0.55 : this.currentSpec.id === 'sniper' ? 1.25 : 0.92;
      this._mountForInspect();
    } else {
      this.inspectPivot.visible = false;
      this.inspectPivot.clear();
      this.currentModel.root.position.set(0, 0, 0);
      this.weaponRig.add(this.currentModel.root);
      this.weaponRig.position.set(...this.currentSpec.hipPos);
      this.camera.position.copy(this.baseCamPos);
      this.camera.fov = 58;
      this.camera.updateProjectionMatrix();
    }
  }

  toggleSuppressor() {
    this.suppressed = !this.suppressed;
    if (this.currentModel?.parts?.suppressor) {
      this.currentModel.parts.suppressor.visible = this.suppressed;
    }
    document.getElementById('lbl-suppressor').textContent = this.suppressed ? 'ON' : 'OFF';
    document.getElementById('btn-suppressor').classList.toggle('active', this.suppressed);
    if (this.started) this.sound.playDryFire();
  }

  cycleFireMode() {
    const modes = this.currentSpec.fireModes;
    const cur = this.fireModeState[this.currentSpec.id];
    const next = modes[(modes.indexOf(cur) + 1) % modes.length];
    this.fireModeState[this.currentSpec.id] = next;
    this._updateFireModeHUD();
    if (this.started) this.sound.playDryFire();
  }

  toggleMovingTarget() {
    this.range.movingEnabled = !this.range.movingEnabled;
    document.getElementById('lbl-moving').textContent = this.range.movingEnabled ? 'ON' : 'OFF';
    document.getElementById('btn-moving').classList.toggle('active', this.range.movingEnabled);
  }

  _updateFireModeHUD() {
    document.getElementById('lbl-firemode').textContent = this.fireModeState[this.currentSpec.id];
  }

  _updateAmmoHUD() {
    const cur = this.ammoState[this.currentSpec.id];
    const max = this.currentSpec.magSize;
    const el = document.getElementById('hud-ammo');
    el.textContent = cur;
    el.classList.toggle('low', cur <= Math.ceil(max * 0.2));
    document.getElementById('hud-mag').textContent = max;
  }

  startReload() {
    if (this.isReloading || this.inspectMode) return;
    if (this.ammoState[this.currentSpec.id] >= this.currentSpec.magSize) return;

    this.isReloading = true;
    this.reloadElapsed = 0;
    this.burstRemaining = 0;
    this.isAds = false;
    document.getElementById('reload-bar-wrap').classList.remove('hidden');
    this.sound.playReload(this.currentSpec.reloadTime);
  }

  _fireOneRound() {
    const spec = this.currentSpec;
    const ammo = this.ammoState[spec.id];
    if (ammo <= 0) {
      this.sound.playDryFire();
      this.burstRemaining = 0;
      return;
    }

    this.ammoState[spec.id] = ammo - 1;
    this.shotsFired++;
    this._updateAmmoHUD();
    this._updateScoreHUD();

    // Fire rate cooldown
    this.fireCooldown = 60 / spec.rpm;

    // Audio
    this.sound.playGunshot(spec.soundProfile, this.suppressed);
    if (!spec.boltAction) {
      this.sound.playShellCasing(spec.soundProfile.casingPitch);
    } else {
      // Sniper bolt cycle
      this.boltTimer = spec.boltCycleTime;
      this.sound.playBoltCycle();
      setTimeout(() => {
        if (!this.inspectMode) this.sound.playShellCasing(spec.soundProfile.casingPitch);
      }, 360);
    }

    // Recoil & mechanical animation
    const adsFactor = this.isAds ? 0.58 : 1.0;
    const supFactor = this.suppressed ? 0.85 : 1.0;
    this.recoilZ = Math.min(0.16, this.recoilZ + spec.recoilKick * adsFactor * supFactor);
    this.recoilPitch = Math.min(0.24, this.recoilPitch + spec.recoilPitch * adsFactor * supFactor);
    this.recoilYaw += (Math.random() - 0.5) * spec.recoilYaw * 2 * adsFactor;
    this.slideKick = 1.0;
    this.triggerPull = 1.0;
    this.crosshairSpread = Math.min(28, this.crosshairSpread + (this.isAds ? 4 : 11));

    // World muzzle & ejection positions
    const parts = this.currentModel.parts;
    const muzzleWorld = new THREE.Vector3();
    parts.muzzlePoint.getWorldPosition(muzzleWorld);
    if (this.suppressed) {
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      muzzleWorld.addScaledVector(forward, Math.abs(parts.suppressedMuzzleOffset));
    }

    const flashScale = spec.id === 'sniper' ? 1.55 : spec.id === 'lmg' ? 1.3 : spec.id === 'pistol' ? 0.72 : 1.0;
    this.effects.spawnMuzzleFlash(muzzleWorld, this.suppressed, flashScale);

    if (!spec.boltAction) {
      const ejectWorld = new THREE.Vector3();
      parts.ejectionPoint.getWorldPosition(ejectWorld);
      const casingScale = spec.id === 'lmg' ? 1.25 : spec.id === 'pistol' ? 0.8 : 1.0;
      this.effects.spawnShellCasing(ejectWorld, this.camera.quaternion, casingScale);
    } else {
      // Eject big .338 casing mid-bolt-cycle
      setTimeout(() => {
        if (this.currentSpec.id === 'sniper' && !this.inspectMode) {
          const ejectWorld = new THREE.Vector3();
          parts.ejectionPoint.getWorldPosition(ejectWorld);
          this.effects.spawnShellCasing(ejectWorld, this.camera.quaternion, 1.55);
        }
      }, 330);
    }

    // Raycast Hit Detection (with realistic spread)
    const spread = this.isAds ? spec.spreadAds : spec.spreadBase;
    const dir = new THREE.Vector3(
      (Math.random() - 0.5) * spread * 2,
      (Math.random() - 0.5) * spread * 2,
      -1
    )
      .normalize()
      .applyQuaternion(this.camera.quaternion);

    this.raycaster.set(this.camera.position, dir);
    const hits = this.raycaster.intersectObjects(this.range.shootableMeshes, false);

    let tracerEnd = this.camera.position.clone().addScaledVector(dir, 52);

    if (hits.length > 0) {
      const hit = hits[0];
      tracerEnd = hit.point;
      const u = hit.object.userData;

      if (u.type === 'paper') {
        const res = this.range.registerPaperHit(u.targetObj, hit.uv);
        this.sound.playPaperHit(u.targetObj.distance);
        this._onTargetHit(res.score, res.label, res.score >= 100);
      } else if (u.type === 'steel') {
        const power = spec.id === 'sniper' ? 1.5 : spec.id === 'lmg' ? 1.25 : 0.9;
        const res = this.range.registerSteelHit(u.steelObj, power);
        this.sound.playSteelHit(u.steelObj.distance);
        const normal = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 0, 1);
        this.effects.spawnSparks(hit.point, normal, 12);
        this._onTargetHit(res.score, res.label, false);
      } else if (u.type === 'backstop') {
        this.effects.spawnSparks(hit.point, new THREE.Vector3(0, 0, 1), 6);
      }
    }

    this.effects.spawnTracer(muzzleWorld, tracerEnd);

    // Auto-reload hint if empty
    if (this.ammoState[spec.id] === 0) {
      this.burstRemaining = 0;
    }
  }

  _onTargetHit(points, label, isHeadshot) {
    this.shotsHit++;
    this.score += points;
    this._updateScoreHUD();

    // Flash hitmarker
    const hm = document.getElementById('hitmarker');
    hm.classList.add('active');
    clearTimeout(this._hmTimeout);
    this._hmTimeout = setTimeout(() => hm.classList.remove('active'), 110);

    // Floating toast
    const feed = document.getElementById('hit-feed');
    const toast = document.createElement('div');
    toast.className = `hit-toast${isHeadshot ? ' headshot' : ''}`;
    toast.textContent = label;
    feed.appendChild(toast);
    setTimeout(() => toast.remove(), 880);
  }

  _updateScoreHUD() {
    document.getElementById('hud-score').textContent = this.score.toLocaleString();
    document.getElementById('hud-accuracy').textContent = `${this.shotsHit} / ${this.shotsFired}`;
  }

  _bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.started) return;
      this.sound.init();

      if (this.inspectMode) {
        if (e.button === 0) {
          this.inspectDragging = true;
          this.inspectLastX = e.clientX;
          this.inspectLastY = e.clientY;
        }
        return;
      }

      if (e.button === 0) {
        this.isMouseDown = true;
        if (!this.isReloading && this.fireCooldown <= 0 && this.boltTimer <= 0) {
          const mode = this.fireModeState[this.currentSpec.id];
          if (mode === 'BURST') {
            this.burstRemaining = 3;
          } else {
            this._fireOneRound();
          }
        }
      } else if (e.button === 2) {
        if (!this.isReloading) this.isAds = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isMouseDown = false;
        this.inspectDragging = false;
      } else if (e.button === 2) {
        this.isAds = false;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.started) return;

      if (this.inspectMode) {
        if (this.inspectDragging) {
          const dx = e.clientX - this.inspectLastX;
          const dy = e.clientY - this.inspectLastY;
          this.inspectLastX = e.clientX;
          this.inspectLastY = e.clientY;
          this.inspectRotY += dx * 0.0085;
          this.inspectRotX = Math.max(-1.05, Math.min(1.05, this.inspectRotX + dy * 0.0075));
        }
        return;
      }

      // Smooth range aiming mapped from cursor position on viewport
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      const yawRange = this.isAds && this.currentSpec.isScoped ? 0.34 : 0.44;
      const pitchRange = this.isAds && this.currentSpec.isScoped ? 0.16 : 0.24;
      this.targetYaw = -nx * yawRange;
      this.targetPitch = -ny * pitchRange;
    });

    window.addEventListener('wheel', (e) => {
      if (!this.inspectMode) return;
      this.inspectZoom = Math.max(0.42, Math.min(1.85, this.inspectZoom + e.deltaY * 0.0012));
    });

    window.addEventListener('keydown', (e) => {
      if (!this.started) return;
      const key = e.key.toLowerCase();
      if (key === '1') this.selectWeapon('pistol');
      else if (key === '2') this.selectWeapon('smg');
      else if (key === '3') this.selectWeapon('rifle');
      else if (key === '4') this.selectWeapon('lmg');
      else if (key === '5') this.selectWeapon('sniper');
      else if (key === 'r') this.startReload();
      else if (key === 'b') this.cycleFireMode();
      else if (key === 's') this.toggleSuppressor();
      else if (key === 'i') this.toggleInspectMode();
      else if (key === 'm') this.toggleMovingTarget();
      else if (key === 't') this.range.resetTargets();
      else if (e.key === 'Shift' && !this.inspectMode && !this.isReloading) this.isAds = true;
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'Shift') this.isAds = false;
    });
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.swayTime += dt;

    // Update range targets & particle effects
    this.range.update(dt);
    this.effects.update(dt);

    if (this.inspectMode) {
      // Smooth showcase orbit
      if (!this.inspectDragging) {
        this.inspectRotY += dt * 0.28; // gentle showcase turntable rotation
      }
      this.inspectPivot.rotation.y += (this.inspectRotY - this.inspectPivot.rotation.y) * Math.min(1, dt * 10);
      this.inspectPivot.rotation.x += (this.inspectRotX - this.inspectPivot.rotation.x) * Math.min(1, dt * 10);

      const targetCam = new THREE.Vector3(0, 1.60, -0.55 + this.inspectZoom);
      this.camera.position.lerp(targetCam, Math.min(1, dt * 8));
      this.camera.lookAt(this.inspectPivot.position);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // === SHOOTING MODE UPDATE ===
    const spec = this.currentSpec;
    const parts = this.currentModel.parts;

    // Cooldowns & Continuous Auto / Burst Firing
    if (this.fireCooldown > 0) this.fireCooldown -= dt;

    if (this.boltTimer > 0) {
      this.boltTimer = Math.max(0, this.boltTimer - dt);
      // Animate sniper bolt handle lift -> pull -> push -> lock
      if (parts.boltHandle) {
        const p = 1 - this.boltTimer / spec.boltCycleTime;
        if (p < 0.2) {
          parts.boltHandle.rotation.z = (p / 0.2) * 1.1;
          parts.boltHandle.position.z = parts.boltRestZ;
        } else if (p < 0.5) {
          parts.boltHandle.rotation.z = 1.1;
          parts.boltHandle.position.z = parts.boltRestZ + ((p - 0.2) / 0.3) * 0.095;
        } else if (p < 0.8) {
          parts.boltHandle.rotation.z = 1.1;
          parts.boltHandle.position.z = parts.boltRestZ + (1 - (p - 0.5) / 0.3) * 0.095;
        } else {
          parts.boltHandle.rotation.z = (1 - (p - 0.8) / 0.2) * 1.1;
          parts.boltHandle.position.z = parts.boltRestZ;
        }
      }
    } else if (parts.boltHandle) {
      parts.boltHandle.rotation.z = 0;
      parts.boltHandle.position.z = parts.boltRestZ;
    }

    // Burst / Full-Auto firing
    if (!this.isReloading && this.fireCooldown <= 0 && this.boltTimer <= 0) {
      const mode = this.fireModeState[spec.id];
      if (this.burstRemaining > 0) {
        this._fireOneRound();
        this.burstRemaining--;
      } else if (this.isMouseDown && mode === 'AUTO') {
        this._fireOneRound();
      }
    }

    // Reload Animation
    let reloadTiltX = 0;
    let reloadTiltZ = 0;
    if (this.isReloading) {
      this.reloadElapsed += dt;
      const p = Math.min(1, this.reloadElapsed / spec.reloadTime);
      document.getElementById('reload-fill').style.width = `${p * 100}%`;

      reloadTiltX = Math.sin(p * Math.PI) * 0.35;
      reloadTiltZ = Math.sin(p * Math.PI) * 0.42;

      if (parts.magazine) {
        if (p < 0.35) {
          parts.magazine.position.y = -(p / 0.35) * 0.22;
        } else if (p < 0.65) {
          parts.magazine.position.y = -0.22 + ((p - 0.35) / 0.30) * 0.22;
        } else {
          parts.magazine.position.y = 0;
        }
      }

      if (p >= 1) {
        this.isReloading = false;
        this.ammoState[spec.id] = spec.magSize;
        if (parts.magazine) parts.magazine.position.y = 0;
        document.getElementById('reload-bar-wrap').classList.add('hidden');
        this._updateAmmoHUD();
      }
    }

    // Recoil recovery
    const rec = Math.min(1, dt * spec.recoilRecovery);
    this.recoilZ += (0 - this.recoilZ) * rec;
    this.recoilPitch += (0 - this.recoilPitch) * rec;
    this.recoilYaw += (0 - this.recoilYaw) * rec;
    this.slideKick = Math.max(0, this.slideKick - dt * 16);
    this.triggerPull = Math.max(0, this.triggerPull - dt * 14);
    this.crosshairSpread = Math.max(0, this.crosshairSpread - dt * 55);

    // Mechanical Slide / Bolt / Trigger animations
    if (parts.slide) {
      const emptyLock = this.ammoState[spec.id] === 0 && !this.isReloading ? 0.85 : 0;
      const kick = Math.max(this.slideKick, emptyLock);
      parts.slide.position.z = parts.slideRestZ + kick * parts.slideTravel;
    }
    if (parts.bolt) {
      parts.bolt.position.z = parts.boltRestZ + this.slideKick * parts.boltTravel;
    }
    if (parts.ammoBelt) {
      parts.ammoBelt.position.y = Math.sin(this.slideKick * Math.PI) * 0.008;
    }
    if (parts.trigger) {
      parts.trigger.rotation.x = this.triggerPull * 0.35;
    }

    // Smooth camera aim + recoil pitch/yaw
    this.currentYaw += (this.targetYaw - this.currentYaw) * Math.min(1, dt * 16);
    this.currentPitch += (this.targetPitch - this.currentPitch) * Math.min(1, dt * 16);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.currentYaw + this.recoilYaw;
    this.camera.rotation.x = this.currentPitch + this.recoilPitch;

    // ADS FOV & Weapon Position Interpolation
    const targetFov = this.isAds ? spec.adsFov : 58;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 12);
    this.camera.updateProjectionMatrix();

    // Sniper Scope Overlay toggle
    const showScope = this.isAds && spec.isScoped && this.camera.fov < 28;
    document.getElementById('scope-overlay').classList.toggle('hidden', !showScope);
    this.weaponRig.visible = !showScope;

    // Crosshair opacity & dynamic bloom
    const ch = document.getElementById('crosshair');
    ch.style.opacity = this.isAds ? '0' : '1';
    const spreadPx = Math.round(this.crosshairSpread);
    ch.querySelector('.ch-top').style.transform = `translateY(${-spreadPx}px)`;
    ch.querySelector('.ch-bottom').style.transform = `translateY(${spreadPx}px)`;
    ch.querySelector('.ch-left').style.transform = `translateX(${-spreadPx}px)`;
    ch.querySelector('.ch-right').style.transform = `translateX(${spreadPx}px)`;

    // Weapon Rig position (hip <-> ADS + breathing sway + recoil kick)
    const targetPos = this.isAds ? spec.adsPos : spec.hipPos;
    const swayAmp = this.isAds ? 0.0012 : 0.0045;
    const swayX = Math.sin(this.swayTime * 1.4) * swayAmp;
    const swayY = Math.cos(this.swayTime * 2.8) * swayAmp * 0.7;

    this.weaponRig.position.x += (targetPos[0] + swayX - this.weaponRig.position.x) * Math.min(1, dt * 14);
    this.weaponRig.position.y += (targetPos[1] + swayY - this.weaponRig.position.y) * Math.min(1, dt * 14);
    this.weaponRig.position.z += (targetPos[2] + this.recoilZ - this.weaponRig.position.z) * Math.min(1, dt * 18);

    this.weaponRig.rotation.x = this.recoilPitch * 1.35 + reloadTiltX;
    this.weaponRig.rotation.z = -this.recoilYaw * 2.0 + reloadTiltZ;

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new TacticalRangeApp();
});
