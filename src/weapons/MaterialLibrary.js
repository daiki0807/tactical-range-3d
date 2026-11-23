import * as THREE from 'three';

function createBrushedMetalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  for (let y = 0; y < 256; y++) {
    const v = 115 + Math.floor(Math.random() * 28);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(0, y, 256, 1);
  }
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const w = 15 + Math.random() * 60;
    const v = Math.random() > 0.5 ? 165 : 90;
    ctx.fillStyle = `rgba(${v},${v},${v},0.25)`;
    ctx.fillRect(x, y, w, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function createStippleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#606060';
  ctx.fillRect(0, 0, 128, 128);

  for (let y = 0; y < 128; y += 4) {
    for (let x = 0; x < 128; x += 4) {
      const ox = (y % 8 === 0) ? 0 : 2;
      const v = 150 + Math.floor(Math.random() * 75);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect((x + ox) % 128, y, 2, 2);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

export function createMaterialLibrary() {
  const brushedBump = createBrushedMetalTexture();
  const stippleBump = createStippleTexture();

  return {
    gunmetal: new THREE.MeshStandardMaterial({
      color: 0x3b424e,
      metalness: 0.84,
      roughness: 0.30,
      bumpMap: brushedBump,
      bumpScale: 0.0022,
    }),
    darkSteel: new THREE.MeshStandardMaterial({
      color: 0x262b34,
      metalness: 0.88,
      roughness: 0.25,
      bumpMap: brushedBump,
      bumpScale: 0.002,
    }),
    tungsten: new THREE.MeshStandardMaterial({
      color: 0x3b424c,
      metalness: 0.78,
      roughness: 0.36,
      bumpMap: brushedBump,
      bumpScale: 0.0015,
    }),
    fdeTan: new THREE.MeshStandardMaterial({
      color: 0x9c8663,
      metalness: 0.32,
      roughness: 0.52,
      bumpMap: brushedBump,
      bumpScale: 0.001,
    }),
    fdeDark: new THREE.MeshStandardMaterial({
      color: 0x766346,
      metalness: 0.28,
      roughness: 0.62,
    }),
    oliveDrab: new THREE.MeshStandardMaterial({
      color: 0x454f3c,
      metalness: 0.25,
      roughness: 0.58,
    }),
    polymer: new THREE.MeshStandardMaterial({
      color: 0x1c1e22,
      metalness: 0.12,
      roughness: 0.72,
    }),
    polymerGrip: new THREE.MeshStandardMaterial({
      color: 0x17191d,
      metalness: 0.08,
      roughness: 0.85,
      bumpMap: stippleBump,
      bumpScale: 0.006,
    }),
    chrome: new THREE.MeshStandardMaterial({
      color: 0xd8dee6,
      metalness: 0.96,
      roughness: 0.14,
    }),
    brass: new THREE.MeshStandardMaterial({
      color: 0xd8a63c,
      metalness: 0.92,
      roughness: 0.22,
    }),
    copper: new THREE.MeshStandardMaterial({
      color: 0xb8683a,
      metalness: 0.88,
      roughness: 0.26,
    }),
    opticGlass: new THREE.MeshPhysicalMaterial({
      color: 0x4fa3ff,
      metalness: 0.1,
      roughness: 0.05,
      transmission: 0.78,
      transparent: true,
      opacity: 0.35,
      ior: 1.5,
    }),
    scopeLens: new THREE.MeshStandardMaterial({
      color: 0x1a5ea8,
      metalness: 0.9,
      roughness: 0.08,
      emissive: 0x091c38,
      emissiveIntensity: 0.6,
    }),
    redGlow: new THREE.MeshBasicMaterial({
      color: 0xff2233,
    }),
    greenGlow: new THREE.MeshBasicMaterial({
      color: 0x33ff66,
    }),
    amberGlow: new THREE.MeshBasicMaterial({
      color: 0xffaa22,
    }),
  };
}
