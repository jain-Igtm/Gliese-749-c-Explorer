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
scene.fog = new THREE.FogExp2(0x735848, 0.0118);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 820);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.55));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

scene.add(new THREE.HemisphereLight(0xbfd8e0, 0x503929, 1.26));
const sunLight = new THREE.DirectionalLight(0xffb18a, 2.45);
sunLight.position.set(-50, 70, 28);
scene.add(sunLight);

const cabinGlow = new THREE.PointLight(0x8eeaff, 0.55, 20);
cabinGlow.position.set(0, 0.4, 0.2);
scene.add(cabinGlow);

const textures = {
  dust: makeDustTexture(),
  rock: makeRockTexture(),
  road: makeRoadTexture(),
  metal: makeMetalTexture(),
  panel: makePanelTexture()
};

const mat = {
  ground: new THREE.MeshStandardMaterial({ color: 0x806653, roughness: 0.98, metalness: 0.01, map: textures.dust }),
  groundDark: new THREE.MeshStandardMaterial({ color: 0x4b3a31, roughness: 1, metalness: 0.01, map: textures.dust }),
  road: new THREE.MeshStandardMaterial({ color: 0x3c3530, roughness: 0.92, metalness: 0.02, map: textures.road }),
  roadLine: new THREE.MeshBasicMaterial({ color: 0xbfc3aa, transparent: true, opacity: 0.58 }),
  rockA: new THREE.MeshStandardMaterial({ color: 0x675247, roughness: 0.92, metalness: 0.02, map: textures.rock }),
  rockB: new THREE.MeshStandardMaterial({ color: 0x3d352f, roughness: 0.96, metalness: 0.01, map: textures.rock }),
  metal: new THREE.MeshStandardMaterial({ color: 0x786d62, roughness: 0.58, metalness: 0.58, map: textures.metal }),
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x161d20, roughness: 0.68, metalness: 0.45, map: textures.metal }),
  panel: new THREE.MeshStandardMaterial({ color: 0x25313a, roughness: 0.62, metalness: 0.38, map: textures.panel }),
  amber: new THREE.MeshBasicMaterial({ color: 0xffb36c, transparent: true, opacity: 0.78 }),
  cyan: new THREE.MeshBasicMaterial({ color: 0x78eaff, transparent: true, opacity: 0.82 }),
  halo: new THREE.MeshBasicMaterial({ color: 0x78eaff, transparent: true, opacity: 0.10, depthWrite: false }),
  mast: new THREE.MeshStandardMaterial({ color: 0x9adfed, roughness: 0.42, metalness: 0.35 })
};

const terrainChunks = createTerrainChunks();
const roadChunks = createRoadChunks();
const rocks = createRocks();
const ridgeGroups = createRidges();
const infraGroups = createInfrastructure();
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
      const geo = new THREE.PlaneGeometry(size, size, 48, 48);
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

function createRoadChunks() {
  const chunks = [];
  const size = 100;
  for (let i = -2; i <= 2; i++) {
    const group = new THREE.Group();
    group.userData = { offset: i, size };
    const road = new THREE.Mesh(new THREE.PlaneGeometry(10, size * 1.16, 1, 8), mat.road);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.075;
    group.add(road);

    for (let j = -4; j <= 4; j++) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 6.4), mat.roadLine);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.082, j * 12.5);
      group.add(dash);
    }

    const shoulderL = new THREE.Mesh(new THREE.PlaneGeometry(0.22, size * 1.12), mat.roadLine);
    shoulderL.rotation.x = -Math.PI / 2;
    shoulderL.position.set(-5.6, 0.083, 0);
    group.add(shoulderL);
    const shoulderR = shoulderL.clone();
    shoulderR.position.x = 5.6;
    group.add(shoulderR);

    scene.add(group);
    chunks.push(group);
  }
  recycleRoads(chunks);
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
  const road = Math.abs(x - roadCenter(z));
  const roadCut = Math.max(0, 1 - road / 11) * 0.65;
  const natural = Math.sin(x * 0.052) * 0.78 + Math.cos(z * 0.041) * 0.88 + Math.sin((x + z) * 0.022) * 0.58;
  return natural * (1 - roadCut) - roadCut * 0.06;
}

function roadCenter(z) {
  return Math.sin(z * 0.012) * 22 + Math.sin(z * 0.004) * 34;
}

function createRocks() {
  const list = [];
  for (let i = 0; i < 92; i++) {
    const h = seeded(i * 41, 0.65, 5.6);
    const r = seeded(i * 19, 0.75, 4.8);
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

function createRidges() {
  const groups = [];
  for (let i = 0; i < 34; i++) {
    const ridge = new THREE.Group();
    ridge.userData = { seed: i };
    for (let j = 0; j < 4; j++) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(seeded(i * 9 + j, 8, 24), seeded(i * 17 + j, 2.2, 7), seeded(i * 23 + j, 4, 10)), j % 2 ? mat.rockA : mat.rockB);
      block.position.set(j * seeded(i + j, 5, 12), 0, seeded(i * 5 + j, -5, 5));
      block.rotation.y = seeded(i * 13 + j, -0.55, 0.55);
      block.rotation.z = seeded(i * 11 + j, -0.12, 0.12);
      ridge.add(block);
    }
    scene.add(ridge);
    groups.push(ridge);
  }
  recycleRidges(groups);
  return groups;
}

function createInfrastructure() {
  const groups = [];
  for (let i = 0; i < 36; i++) {
    const group = new THREE.Group();
    group.userData = { seed: i, kind: i % 6 };
    buildInfraGroup(group, i % 6, i);
    scene.add(group);
    groups.push(group);
  }
  recycleInfrastructure(groups);
  return groups;
}

function buildInfraGroup(group, kind, seed) {
  if (kind === 0) buildMarkerPylon(group, seed);
  if (kind === 1) buildAntennaCluster(group, seed);
  if (kind === 2) buildPipeRun(group, seed);
  if (kind === 3) buildLandingPad(group, seed);
  if (kind === 4) buildBuriedModule(group, seed);
  if (kind === 5) buildUtilityMast(group, seed);
}

function buildMarkerPylon(group, seed) {
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 5.2, 10), mat.darkMetal);
  mast.position.y = 2.6;
  group.add(mast);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.55, 0.38), mat.panel);
  cap.position.y = 5.3;
  group.add(cap);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), mat.amber);
  light.position.y = 5.75;
  group.add(light);
}

function buildAntennaCluster(group, seed) {
  for (let i = 0; i < 4; i++) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, seeded(seed + i, 4.2, 8.0), 8), mat.metal);
    mast.position.set((i - 1.5) * 0.8, mast.geometry.parameters.height / 2, seeded(seed * 4 + i, -0.6, 0.6));
    group.add(mast);
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.18, 0.12, 18), mat.panel);
    dish.position.set(mast.position.x, mast.position.y * 1.85, mast.position.z);
    dish.rotation.x = Math.PI / 2 + seeded(seed + i, -0.22, 0.22);
    group.add(dish);
  }
}

function buildPipeRun(group, seed) {
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 12, 12), mat.darkMetal);
  pipe.rotation.z = Math.PI / 2;
  pipe.position.y = 0.55;
  group.add(pipe);
  for (let i = -2; i <= 2; i++) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.22), mat.metal);
    brace.position.set(i * 2.6, 0.3, 0);
    group.add(brace);
  }
}

function buildLandingPad(group, seed) {
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.8, 0.18, 24), mat.road);
  pad.position.y = 0.12;
  group.add(pad);
  for (let i = 0; i < 4; i++) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.22), mat.amber);
    light.position.set(Math.cos(i * Math.PI / 2) * 4.2, 0.28, Math.sin(i * Math.PI / 2) * 4.2);
    light.rotation.y = i * Math.PI / 2;
    group.add(light);
  }
}

function buildBuriedModule(group, seed) {
  const shell = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.8, 3.2), mat.panel);
  shell.position.y = 0.9;
  shell.rotation.z = seeded(seed, -0.04, 0.04);
  group.add(shell);
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 1.0), mat.metal);
  hatch.position.set(0, 1.86, 0);
  group.add(hatch);
}

function buildUtilityMast(group, seed) {
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 7.5, 8), mat.darkMetal);
  tower.position.y = 3.75;
  group.add(tower);
  for (let i = 0; i < 3; i++) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4 - i * 0.4, 0.08, 0.08), mat.metal);
    arm.position.set(0, 4.5 + i * 0.8, 0);
    arm.rotation.y = i * 0.7;
    group.add(arm);
  }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), mat.cyan);
  lamp.position.y = 7.9;
  group.add(lamp);
}

function recycleRocks(list) {
  for (const rock of list) {
    const s = rock.userData.seed;
    const cellX = Math.floor(rover.pos.x / 100);
    const cellZ = Math.floor(rover.pos.z / 100);
    let x = rover.pos.x + seeded(s * 11 + cellZ * 13, -130, 130);
    let z = rover.pos.z + seeded(s * 17 + cellX * 17, -220, 115);
    if (Math.abs(x - roadCenter(z)) < 12) x += x < roadCenter(z) ? -18 : 18;
    rock.position.set(x, terrainHeight(x, z) + rock.userData.h / 2 - 0.35, z);
    rock.rotation.y = seeded(s * 13 + Math.floor(z), 0, Math.PI);
    rock.scale.set(seeded(s * 7, 0.75, 1.55), 1, seeded(s * 23, 0.65, 1.45));
  }
}

function recycleRidges(groups) {
  for (const ridge of groups) {
    const s = ridge.userData.seed;
    const cellX = Math.floor(rover.pos.x / 120);
    const cellZ = Math.floor(rover.pos.z / 120);
    let x = rover.pos.x + seeded(s * 31 + cellZ * 7, -160, 160);
    let z = rover.pos.z + seeded(s * 37 + cellX * 11, -260, 150);
    if (Math.abs(x - roadCenter(z)) < 25) x += x < roadCenter(z) ? -35 : 35;
    ridge.position.set(x, terrainHeight(x, z), z);
    ridge.rotation.y = seeded(s * 23 + cellX, -0.7, 0.7);
  }
}

function recycleInfrastructure(groups) {
  for (const group of groups) {
    const s = group.userData.seed;
    const cellX = Math.floor(rover.pos.x / 130);
    const cellZ = Math.floor(rover.pos.z / 130);
    const z = rover.pos.z + seeded(s * 47 + cellX * 19, -260, 120);
    const side = seeded(s * 17 + cellZ, 0, 1) > 0.5 ? 1 : -1;
    const offset = seeded(s * 21 + cellZ, 18, 56) * side;
    const x = roadCenter(z) + offset;
    group.position.set(x, terrainHeight(x, z), z);
    group.rotation.y = seeded(s * 9 + cellX, -0.5, 0.5);
  }
}

function recycleRoads(chunks) {
  const size = 100;
  const centerZ = Math.round(rover.pos.z / size);
  for (const group of chunks) {
    const z = (centerZ + group.userData.offset) * size;
    const x = roadCenter(z);
    group.position.set(x, terrainHeight(x, z) + 0.035, z);
    group.rotation.y = roadAngle(z);
  }
}

function roadAngle(z) {
  const a = roadCenter(z - 8);
  const b = roadCenter(z + 8);
  return Math.atan2(b - a, 16);
}

function createTargets() {
  const list = [];
  for (let i = 0; i < 12; i++) {
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
    const z = rover.pos.z + seeded(s * 53 + cellX * 23, -210, -38);
    const x = roadCenter(z) + seeded(s * 31 + cellZ * 19, -70, 70);
    target.position.set(x, terrainHeight(x, z) + 1.35, z);
    target.userData.scanned = false;
    target.userData.label = label(Math.abs(Math.floor(x + z + s)));
  }
}

function createWind() {
  const geo = new THREE.BufferGeometry();
  const count = 1150;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = seeded(i * 3, -105, 105);
    positions[i * 3 + 1] = seeded(i * 5, 0.4, 26);
    positions[i * 3 + 2] = seeded(i * 7, -230, 65);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xd8eef3, size: 0.046, transparent: true, opacity: 0.42, depthWrite: false }));
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
  const desired = forward.multiplyScalar(-input.throttle * 16.8).add(side.multiplyScalar(input.strafe * 7.2));
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
  recycleRoads(roadChunks);
  if (moved) {
    recycleRocks(rocks);
    recycleRidges(ridgeGroups);
    recycleInfrastructure(infraGroups);
    recycleTargets(targets);
  }
}

function updateWind(dt, t) {
  rover.gust = 0.48 + Math.sin(t * 0.7) * 0.24 + Math.sin(t * 2.1) * 0.08;
  const pos = wind.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i) + dt * (14 + rover.gust * 20);
    let z = pos.getZ(i) + dt * (2 + rover.gust * 4);
    if (x > rover.pos.x + 110) x = rover.pos.x - 110;
    if (z > rover.pos.z + 70) z = rover.pos.z - 235;
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
    if (!target.userData.scanned && projected.z < 1 && distance < 115 && score < 0.16 && score < bestScore) {
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
    log.textContent = `SCAN COMPLETE: ${best.userData.label}. Grid sample archived.`;
  }
}

function updateHud() {
  const seal = Math.round(90 + Math.sin(performance.now() * 0.0017) * 2 - rover.gust * 2);
  const signal = Math.max(17, Math.round(50 + Math.sin(rover.pos.x * 0.05) * 8 - rover.gust * 5));
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
  for (let i = 0; i < 80; i++) {
    x.strokeStyle = `rgba(255,230,205,${0.025 + Math.random() * 0.04})`;
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

function makeRoadTexture() {
  const c = baseCanvas(256, 256, '#3b3530');
  const x = c.getContext('2d');
  for (let i = 0; i < 2800; i++) {
    const v = 45 + Math.random() * 70;
    x.fillStyle = `rgba(${v}, ${v * 0.92}, ${v * 0.82}, ${0.06 + Math.random() * 0.11})`;
    x.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1);
  }
  for (let y = 0; y < 256; y += 18) {
    x.strokeStyle = 'rgba(210,190,160,0.045)';
    x.beginPath();
    x.moveTo(0, y);
    x.lineTo(256, y + Math.sin(y) * 2);
    x.stroke();
  }
  return textureFrom(c, 4, 12);
}

function makeMetalTexture() {
  const c = baseCanvas(256, 128, '#6c655e');
  const x = c.getContext('2d');
  for (let y = 0; y < 128; y++) {
    const v = 70 + Math.random() * 70;
    x.strokeStyle = `rgba(${v},${v + 4},${v + 8},0.15)`;
    x.beginPath();
    x.moveTo(0, y);
    x.lineTo(256, y + Math.random() * 2 - 1);
    x.stroke();
  }
  return textureFrom(c, 2, 2);
}

function makePanelTexture() {
  const c = baseCanvas(256, 128, '#1a2730');
  const x = c.getContext('2d');
  for (let i = 0; i < 260; i++) {
    x.fillStyle = `rgba(130,210,230,${0.02 + Math.random() * 0.04})`;
    x.fillRect(Math.random() * 256, Math.random() * 128, Math.random() * 5, 1);
  }
  return textureFrom(c, 2, 2);
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
  return ['road beacon', 'survey mast', 'pipe junction', 'landing pad residue', 'buried module', 'ridge instrument'][i % 6];
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
  log.textContent = 'WORLD OVERHAUL ONLINE: road grid and expedition infrastructure detected.';
});

window.addEventListener('resize', resize);
