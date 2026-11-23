import * as THREE from 'three';

function createMachinedMetalMaps() {
  const size = 256;
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d');

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rctx = roughCanvas.getContext('2d');

  // Base anodized grain
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);
  rctx.fillStyle = '#585858';
  rctx.fillRect(0, 0, size, size);

  // Fine horizontal CNC machining lines
  for (let y = 0; y < size; y++) {
    const bv = 120 + Math.floor(Math.random() * 18);
    bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
    bctx.fillRect(0, y, size, 1);

    const rv = 72 + Math.floor(Math.random() * 34);
    rctx.fillStyle = `rgb(${rv},${rv},${rv})`;
    rctx.fillRect(0, y, size, 1);
  }

  // Subtle realistic handling micro-scratches & oil sheen patches
  for (let i = 0; i < 420; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = 12 + Math.random() * 48;
    bctx.fillStyle = Math.random() > 0.5 ? 'rgba(175,175,175,0.22)' : 'rgba(80,80,80,0.22)';
    bctx.fillRect(x, y, w, 1);

    rctx.fillStyle = Math.random() > 0.5 ? 'rgba(42,42,42,0.28)' : 'rgba(128,128,128,0.2)';
    rctx.fillRect(x, y, w, 1.5);
  }

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(3, 3);

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(3, 3);

  return { bumpMap, roughnessMap };
}

function createDiamondStippleTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#484848';
  ctx.fillRect(0, 0, size, size);

  // Tactical diamond-checkering stipple pattern
  for (let y = 0; y < size; y += 6) {
    for (let x = 0; x < size; x += 6) {
      const ox = (y / 6) % 2 === 0 ? 0 : 3;
      const cx = (x + ox) % size;
      const v = 165 + Math.floor(Math.random() * 65);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.beginPath();
      ctx.moveTo(cx, y - 2);
      ctx.lineTo(cx + 2.2, y);
      ctx.lineTo(cx, y + 2);
      ctx.lineTo(cx - 2.2, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  return tex;
}

export function createMaterialLibrary() {
  const { bumpMap: metalBump, roughnessMap: metalRough } = createMachinedMetalMaps();
  const stippleBump = createDiamondStippleTexture();

  return {
    gunmetal: new THREE.MeshStandardMaterial({
      color: 0x3c434f,
      metalness: 0.86,
      roughness: 0.36,
      roughnessMap: metalRough,
      bumpMap: metalBump,
      bumpScale: 0.0022,
    }),
    darkSteel: new THREE.MeshStandardMaterial({
      color: 0x252a32,
      metalness: 0.90,
      roughness: 0.32,
      roughnessMap: metalRough,
      bumpMap: metalBump,
      bumpScale: 0.0020,
    }),
    anodizedBlack: new THREE.MeshStandardMaterial({
      color: 0x1b1f26,
      metalness: 0.82,
      roughness: 0.38,
      roughnessMap: metalRough,
      bumpMap: metalBump,
      bumpScale: 0.0018,
    }),
    tungsten: new THREE.MeshStandardMaterial({
      color: 0x525b68,
      metalness: 0.82,
      roughness: 0.34,
      roughnessMap: metalRough,
      bumpMap: metalBump,
      bumpScale: 0.0018,
    }),
    fdeTan: new THREE.MeshStandardMaterial({
      color: 0xa68e68,
      metalness: 0.28,
      roughness: 0.50,
      roughnessMap: metalRough,
      bumpMap: metalBump,
      bumpScale: 0.0014,
    }),
    fdeDark: new THREE.MeshStandardMaterial({
      color: 0x7c6848,
      metalness: 0.25,
      roughness: 0.58,
      bumpMap: metalBump,
      bumpScale: 0.0012,
    }),
    oliveDrab: new THREE.MeshStandardMaterial({
      color: 0x4b5740,
      metalness: 0.24,
      roughness: 0.56,
      bumpMap: metalBump,
      bumpScale: 0.0014,
    }),
    polymer: new THREE.MeshStandardMaterial({
      color: 0x202329,
      metalness: 0.12,
      roughness: 0.68,
    }),
    polymerGrip: new THREE.MeshStandardMaterial({
      color: 0x191c21,
      metalness: 0.08,
      roughness: 0.86,
      bumpMap: stippleBump,
      bumpScale: 0.0075,
    }),
    chrome: new THREE.MeshStandardMaterial({
      color: 0xdce3ec,
      metalness: 0.96,
      roughness: 0.14,
      bumpMap: metalBump,
      bumpScale: 0.0008,
    }),
    titanium: new THREE.MeshStandardMaterial({
      color: 0x9aa3b0,
      metalness: 0.92,
      roughness: 0.24,
      bumpMap: metalBump,
      bumpScale: 0.0012,
    }),
    brass: new THREE.MeshStandardMaterial({
      color: 0xdfb045,
      metalness: 0.94,
      roughness: 0.20,
    }),
    copper: new THREE.MeshStandardMaterial({
      color: 0xc26e3c,
      metalness: 0.90,
      roughness: 0.24,
    }),
    boreBlack: new THREE.MeshStandardMaterial({
      color: 0x050608,
      metalness: 0.0,
      roughness: 1.0,
    }),
    opticGlass: new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      metalness: 0.12,
      roughness: 0.04,
      transmission: 0.82,
      transparent: true,
      opacity: 0.34,
      ior: 1.52,
    }),
    scopeLens: new THREE.MeshStandardMaterial({
      color: 0x106a5e,
      metalness: 0.92,
      roughness: 0.06,
      emissive: 0x062c2b,
      emissiveIntensity: 0.65,
    }),
    redGlow: new THREE.MeshBasicMaterial({ color: 0xff2233 }),
    greenGlow: new THREE.MeshBasicMaterial({ color: 0x22ff66 }),
    amberGlow: new THREE.MeshBasicMaterial({ color: 0xffb833 }),
    safetyRed: new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4, metalness: 0.2 }),
  };
}
