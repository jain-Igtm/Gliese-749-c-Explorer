import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const canvas = document.getElementById('gameCanvas');
const wakePanel = document.getElementById('wakePanel');
const wakeButton = document.getElementById('wakeButton');
const sealText = document.getElementById('sealText');
const signalText = document.getElementById('signalText');
const scanText = document.getElementById('scanText');
const sealFill = document.getElementById('sealFill');
const signalFill = document.getElementById('signalFill');
const scanFill = document.getElementById('scanFill');
const log = document.getElementById('log');
const moveStick = document.getElementById('moveStick');
const lookStick = document.getElementById('lookStick');
const scanButton = document.getElementById('scanButton');
const brakeButton = document.getElementById('brakeButton');

let running = false;
let lastTime = performance.now();
let scannedCount = 0;
let currentTarget = null;
let scanHold = 0;
let logTimer = 0;

const input = {
  move: { id: null, x: 0, y: 0 },
  look: { id: null, x: 0, y: 0 },
  throttle: 0,
  strafe: 0,
  steer: 0,
  turnRate: 0,
  scanning: false,
  braking: false
};

const rover = {
  yaw: 0,
  pos: new THREE.Vector3(0, 1.62, 0),
  vel: new THREE.Vector3(),
  speed: 0,
  gust: 0.4,
  bob: 0,
  distance: 0
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071018);
scene.fog = new THREE.FogExp2(0x735848, 0.0125);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 720);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.55));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

scene.add(new THREE.HemisphereLight(0xbfd8e0, 0x503929, 1.22));
const sunLight = new THREE.DirectionalLight(0xffb18a, 2.35);
sunLight.position.set(-50, 70, 28);
scene.add(sunLight);

const cabinGlow = new THREE.PointLight(0x8eeaff, 0.55, 20);
cabinGlow.position.set(0, 0.4, 0.2);
scene.add(cabinGlow);

const textures = {
  dust: makeDustTexture(),
  rock: makeRockTexture()
};

const mat = {
  ground: new THREE.MeshStandardMaterial({ color: 0x806653, roughness: 0.98, metalness: 0.01, map: textures.dust }),
  groundDark: new THREE.MeshStandardMaterial({ color: 0x4b3a31, roughness: 1, metalness: 0.01, map: textures.dust }),
  rockA: new THREE.MeshStandardMaterial({ color: 0x675247, roughness: 0.92, metalness: 0.02, map: textures.rock }),
  rockB: new THREE.MeshStandardMaterial({ color: 0x3d352f, roughness: 0.96, metalness: 0.01, map: textures.rock }),
  cyan: new THREE.MeshBasicMaterial({ color: 0x78eaff, transparent: true, opacity: 0.82 }),
  halo: new THREE.MeshBasicMaterial({ color: 0x78eaff, transparent: true, opacity: 0.10, depthWrite: false }),
  mast: new THREE.MeshStandardMaterial({ color: 0x9adfed, roughness: 0.42, metalness: 0.35 })
};

const terrainChunks = createTerrainChunks();
const rocks = createRocks();
const targets = createTargets();
const wind = createWind();
createSun();
resize();
setupStick(moveStick, input.move, true);
setupStick(lookStick, input.look, false);
setupButton(scanButton, 'scanning');
setupButton(brakeButton, 'braking');
updateHud();
requestAnimationFrame(render);

function createSun() {
  const sun = new THREE.Mesh(new THREE.SphereGeometry(12, 32, 16), new THREE.MeshBasicMaterial({ color: 0xff9b76, transparent: true, opacity: 0.88 }));
  sun.position.set(-90, 58, -190);
  scene.add(sun);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(36, 32, 16), new THREE.MeshBasicMaterial({ color: 0xff825f, transparent: true, opacity: 0.13, depthWrite: false }));
  glow.position.copy(sun.position);
  scene.add(glow);
}

function createTerrainChunks() {
  const chunks = [];
  const size = 100;
  for (let gx = -1; gx <= 1; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
      const geo = new THREE.PlaneGeometry(size, size, 44, 44);
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, mat.ground);
      mesh.userData = { gx, gz, size };
      mesh.position.set(gx * size, 0, gz * size);
      shapeTerrain(mesh);
      scene.add(mesh);
      chunks.push(mesh);
    }
  }
  return chunks;
}

function shapeTerrain(mesh) {
  const pos = mesh.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + mesh.position.x;
    const z = pos.getZ(i) + mesh.position.z;
    pos.setY(i, terrainHeight(x, z));
  }
  pos.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}

function terrainHeight(x, z) {
  return Math.sin(x * 0.052) * 0.75 + Math.cos(z * 0.041) * 0.85 + Math.sin((x + z) * 0.022) * 0.55;
}

function createRocks() {
  const list = [];
  for (let i = 0; i < 82; i++) {
    const h = seeded(i * 41, 0.65, 4.8);
    const r = seeded(i * 19, 0.75, 3.8);
    const sides = 7 + (i % 3);
    const geo = new THREE.CylinderGeometry(r * 0.55, r, h, sides, 1);
    const rock = new THREE.Mesh(geo, i % 2 ? mat.rockA : mat.rockB);
    rock.userData = { seed: i, h };
    scene.add(rock);
    list.push(rock);
  }
  recycleRocks(list);
  return list;
}

function recycleRocks(list) {
  for (const rock of list) {
    const s = rock.userData.seed;
    const cellX = Math.floor(rover.pos.x / 100);
    const cellZ = Math.floor(rover.pos.z / 100);
    const x = rover.pos.x + seeded(s * 11 + cellZ * 13, -120, 120);
    const z = rover.pos.z + seeded(s * 17 + cellX * 17, -200, 100);
    rock.position.set(x, terrainHeight(x, z) + rock.userData.h / 2 - 0.35, z);
    rock.rotation.y = seeded(s * 13 + Math.floor(z), 0, Math.PI);
    rock.scale.set(seeded(s * 7, 0.75, 1.55), 1, seeded(s * 23, 0.65, 1.45));
  }
}

function createTargets() {
  const list = [];
  for (let i = 0; i < 10; i++) {
    const group = new THREE.Group();
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.44, 16, 10), mat.cyan.clone());
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.24, 16, 10), mat.halo.clone());
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 1.15, 8), mat.mast);
    mast.position.y = -0.63;
    group.add(orb, halo, mast);
    group.userData = { seed: i, label: label(i), scanned: false, visibleScore: 99 };
    scene.add(group);
    list.push(group);
  }
  recycleTargets(list);
  return list;
}

function recycleTargets(list) {
  for (const target of list) {
    const s = target.userData.seed;
    const cellX = Math.floor(rover.pos.x / 120);
    const cellZ = Math.floor(rover.pos.z / 120);
    const x = rover.pos.x + seeded(s * 31 + cellZ * 19, -85, 85);
    const z = rover.pos.z + seeded(s * 53 + cellX * 23, -190, -38);
    target.position.set(x, terrainHeight(x, z) + 1.35, z);
    target.userData.scanned = false;
    target.userData.label = label(Math.abs(Math.floor(x + z + s)));
  }
}

function createWind() {
  const geo = new THREE.BufferGeometry();
  const count = 1050;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = seeded(i * 3, -95, 95);
    positions[i * 3 + 1] = seeded(i * 5, 0.4, 24);
    positions[i * 3 + 2] = seeded(i * 7, -210, 55);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xd8eef3, size: 0.045, transparent: true, opacity: 0.42, depthWrite: false }));
  scene.add(points);
  return points;
}

function update(dt, t) {
  input.throttle += (curve(input.move.y) - input.throttle) * Math.min(1, dt * 4.2);
  input.strafe += (curve(input.move.x) - input.strafe) * Math.min(1, dt * 4.0);
  input.steer += (curve(input.look.x) - input.steer) * Math.min(1, dt * 5.8);
  input.turnRate += (input.steer * 2.0 - input.turnRate) * Math.min(1, dt * 4.6);
  rover.yaw -= input.turnRate * dt;

  const forward = new THREE.Vector3(Math.sin(rover.yaw), 0, Math.cos(rover.yaw));
  const side = new THREE.Vector3(Math.cos(rover.yaw), 0, -Math.sin(rover.yaw));
  const desired = forward.multiplyScalar(-input.throttle * 16.2).add(side.multiplyScalar(input.strafe * 7.2));
  rover.vel.lerp(desired, Math.min(1, dt * 2.6));
  if (input.braking) rover.vel.multiplyScalar(Math.max(0.08, 1 - dt * 5.6));
  rover.pos.addScaledVector(rover.vel, dt);
  rover.speed = rover.vel.length();
  rover.distance += rover.speed * dt;

  updateInfiniteWorld();
  updateWind(dt, t);
  updateScans(dt, t);

  rover.bob = Math.sin(t * 3.6) * Math.min(0.04, rover.speed * 0.0045) + Math.sin(rover.pos.x * 0.28 + rover.pos.z * 0.16) * 0.010;
  camera.position.set(rover.pos.x, 1.62 + rover.bob, rover.pos.z);
  camera.rotation.set(-0.055 + rover.bob * 0.32, rover.yaw, -input.steer * 0.015);

  cabinGlow.intensity = 0.45 + Math.sin(t * 7) * 0.05 + (input.scanning ? 0.35 : 0);
  updateHud();
}

function updateInfiniteWorld() {
  const size = 100;
  const cx = Math.round(rover.pos.x / size);
  const cz = Math.round(rover.pos.z / size);
  let moved = false;
  for (const chunk of terrainChunks) {
    const nx = (cx + chunk.userData.gx) * size;
    const nz = (cz + chunk.userData.gz) * size;
    if (chunk.position.x !== nx || chunk.position.z !== nz) {
      chunk.position.set(nx, 0, nz);
      shapeTerrain(chunk);
      moved = true;
    }
  }
  if (moved) {
    recycleRocks(rocks);
    recycleTargets(targets);
  }
}

function updateWind(dt, t) {
  rover.gust = 0.48 + Math.sin(t * 0.7) * 0.24 + Math.sin(t * 2.1) * 0.08;
  const pos = wind.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i) + dt * (14 + rover.gust * 20);
    let z = pos.getZ(i) + dt * (2 + rover.gust * 4);
    if (x > rover.pos.x + 100) x = rover.pos.x - 100;
    if (z > rover.pos.z + 60) z = rover.pos.z - 215;
    pos.setX(i, x);
    pos.setZ(i, z);
  }
  pos.needsUpdate = true;
}

function updateScans(dt, t) {
  const projected = new THREE.Vector3();
  let best = null;
  let bestScore = 999;

  for (const target of targets) {
    target.rotation.y += dt * 0.42;
    target.children[0].material.opacity = target.userData.scanned ? 0.12 : 0.72 + Math.sin(t * 4 + target.userData.seed) * 0.08;
    target.children[1].material.opacity = target.userData.scanned ? 0.02 : 0.10 + Math.sin(t * 3 + target.userData.seed) * 0.03;
    projected.copy(target.position).project(camera);
    const score = Math.hypot(projected.x, projected.y);
    const distance = target.position.distanceTo(camera.position);
    target.userData.visibleScore = score;
    if (!target.userData.scanned && projected.z < 1 && distance < 110 && score < 0.16 && score < bestScore) {
      best = target;
      bestScore = score;
    }
  }

  if (!best) {
    currentTarget = null;
    scanHold = Math.max(0, scanHold - dt * 2);
    if (input.scanning) log.textContent = 'SCAN: no survey return centered.';
    return;
  }

  currentTarget = best;
  if (!input.scanning) {
    scanHold = Math.max(0, scanHold - dt * 1.4);
    logTimer += dt;
    if (logTimer > 1.5) {
      logTimer = 0;
      log.textContent = `TARGET: ${best.userData.label}. Hold SCAN.`;
    }
    return;
  }

  scanHold += dt;
  log.textContent = `SCANNING: ${best.userData.label}`;
  if (scanHold >= 1.0) {
    best.userData.scanned = true;
    scannedCount++;
    scanHold = 0;
    currentTarget = null;
    log.textContent = `SCAN COMPLETE: ${best.userData.label}. Sample archived.`;
  }
}

function updateHud() {
  const seal = Math.round(90 + Math.sin(performance.now() * 0.0017) * 2 - rover.gust * 2);
  const signal = Math.max(17, Math.round(48 + Math.sin(rover.pos.x * 0.05) * 8 - rover.gust * 5));
  sealText.textContent = `${seal}%`;
  signalText.textContent = `${signal}%`;
  scanText.textContent = `${scannedCount} / ∞`;
  sealFill.style.width = `${seal}%`;
  signalFill.style.width = `${signal}%`;
  scanFill.style.width = `${currentTarget ? Math.min(100, scanHold * 100) : Math.min(100, (scannedCount % 10) * 10)}%`;
}

function render(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  const t = now / 1000;
  if (running) update(dt, t);
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}

function setupStick(element, state, movementStick) {
  const nub = element.querySelector('.nub');
  const reset = () => {
    state.id = null;
    state.x = 0;
    state.y = 0;
    nub.style.transform = 'translate(0px, 0px)';
    element.classList.remove('active');
  };
  element.addEventListener('pointerdown', event => {
    state.id = event.pointerId;
    element.classList.add('active');
    element.setPointerCapture(event.pointerId);
  });
  element.addEventListener('pointermove', event => {
    if (state.id !== event.pointerId) return;
    const rect = element.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = event.clientX - cx;
    const dy = event.clientY - cy;
    const max = Math.min(40, rect.width * 0.35);
    const raw = Math.hypot(dx, dy);
    const scale = raw > max ? max / raw : 1;
    const nx = dx * scale;
    const ny = dy * scale;
    let sx = nx / max;
    let sy = ny / max;
    if (Math.abs(sx) < 0.13) sx = 0;
    if (Math.abs(sy) < 0.13) sy = 0;
    nub.style.transform = `translate(${nx}px, ${ny}px)`;
    state.x = sx;
    state.y = movementStick ? -sy : 0;
  });
  element.addEventListener('pointerup', reset);
  element.addEventListener('pointercancel', reset);
  element.addEventListener('lostpointercapture', reset);
}

function setupButton(button, key) {
  const on = event => {
    event.preventDefault();
    input[key] = true;
    button.classList.add('active');
  };
  const off = event => {
    event.preventDefault();
    input[key] = false;
    button.classList.remove('active');
  };
  button.addEventListener('pointerdown', on);
  button.addEventListener('pointerup', off);
  button.addEventListener('pointercancel', off);
  button.addEventListener('lostpointercapture', off);
}

function curve(v) {
  const sign = Math.sign(v);
  const abs = Math.abs(v);
  if (abs < 0.03) return 0;
  return sign * Math.pow(abs, 1.35);
}

function makeDustTexture() {
  const c = baseCanvas(256, 256, '#806653');
  const x = c.getContext('2d');
  for (let i = 0; i < 6500; i++) {
    const v = 80 + Math.random() * 70;
    x.fillStyle = `rgba(${v + 30}, ${v + 12}, ${v}, ${0.08 + Math.random() * 0.12})`;
    x.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1);
  }
  for (let i = 0; i < 70; i++) {
    x.strokeStyle = `rgba(255,230,205,${0.03 + Math.random() * 0.04})`;
    x.beginPath();
    const y = Math.random() * 256;
    x.moveTo(0, y);
    x.lineTo(256, y + Math.random() * 18 - 9);
    x.stroke();
  }
  return textureFrom(c, 16, 16);
}

function makeRockTexture() {
  const c = baseCanvas(256, 256, '#5b4d42');
  const x = c.getContext('2d');
  for (let i = 0; i < 3200; i++) {
    const v = 60 + Math.random() * 90;
    x.fillStyle = `rgba(${v}, ${v * 0.85}, ${v * 0.72}, ${0.06 + Math.random() * 0.10})`;
    x.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1);
  }
  return textureFrom(c, 3, 3);
}

function baseCanvas(w, h, fill) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = fill;
  x.fillRect(0, 0, w, h);
  return c;
}

function textureFrom(c, rx, ry) {
  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(rx, ry);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function seeded(seed, min, max) {
  const x = Math.sin(seed * 999.17) * 43758.5453123;
  return min + (x - Math.floor(x)) * (max - min);
}

function label(i) {
  return ['blue-white mineral bloom', 'pressure mast wreckage', 'ice-salt seep', 'basalt rib formation', 'navigation pylon', 'wind-polished ridge'][i % 6];
}

function resize() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.55));
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

wakeButton.addEventListener('click', () => {
  running = true;
  wakePanel.style.display = 'none';
  log.textContent = 'ROVER ONLINE: hold SCAN when a survey return is centered.';
});

window.addEventListener('resize', resize);
