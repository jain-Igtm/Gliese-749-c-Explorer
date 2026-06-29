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

const CELL = 96;
const ROAD_CLEARANCE = 22;
let running = false;
let lastTime = performance.now();
let scannedCount = 0;
let currentTarget = null;
let scanHold = 0;
let logTimer = 0;
let activeCellKey = '';

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
  pos: new THREE.Vector3(0, 1.7, 0),
  vel: new THREE.Vector3(),
  speed: 0,
  gust: 0.4,
  bob: 0,
  groundY: terrainHeight(0, 0)
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071018);
scene.fog = new THREE.FogExp2(0x735848, 0.0105);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.16, 950);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.55));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

scene.add(new THREE.HemisphereLight(0xbfd8e0, 0x503929, 1.3));
const sunLight = new THREE.DirectionalLight(0xffb18a, 2.5);
sunLight.position.set(-55, 75, 32);
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
  ground: new THREE.MeshStandardMaterial({ color: 0x806653, roughness: 0.98, metalness: 0.01, map: textures.dust, side: THREE.DoubleSide }),
  road: new THREE.MeshStandardMaterial({ color: 0x39332e, roughness: 0.94, metalness: 0.02, map: textures.road, side: THREE.DoubleSide }),
  roadLine: new THREE.MeshBasicMaterial({ color: 0xc8bea0, transparent: true, opacity: 0.56, side: THREE.DoubleSide }),
  rockA: new THREE.MeshStandardMaterial({ color: 0x685348, roughness: 0.94, metalness: 0.01, map: textures.rock }),
  rockB: new THREE.MeshStandardMaterial({ color: 0x3b342f, roughness: 0.98, metalness: 0.01, map: textures.rock }),
  metal: new THREE.MeshStandardMaterial({ color: 0x777069, roughness: 0.58, metalness: 0.60, map: textures.metal }),
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x151c20, roughness: 0.70, metalness: 0.46, map: textures.metal }),
  panel: new THREE.MeshStandardMaterial({ color: 0x25313a, roughness: 0.62, metalness: 0.38, map: textures.panel }),
  amber: new THREE.MeshBasicMaterial({ color: 0xffb36c, transparent: true, opacity: 0.76 }),
  cyan: new THREE.MeshBasicMaterial({ color: 0x78eaff, transparent: true, opacity: 0.84 }),
  halo: new THREE.MeshBasicMaterial({ color: 0x78eaff, transparent: true, opacity: 0.11, depthWrite: false })
};

const terrainCells = createTerrainCells();
const roadCells = createRoadCells();
const sceneryCells = createSceneryCells();
const targets = createTargets();
const wind = createWind();
createSun();
resize();
setupStick(moveStick, input.move, true);
setupStick(lookStick, input.look, false);
setupButton(scanButton, 'scanning');
setupButton(brakeButton, 'braking');
updateWorldCells(true);
updateHud();
requestAnimationFrame(render);

function createSun() {
  const sun = new THREE.Mesh(new THREE.SphereGeometry(12, 32, 16), new THREE.MeshBasicMaterial({ color: 0xff9b76, transparent: true, opacity: 0.88 }));
  sun.position.set(-100, 62, -210);
  scene.add(sun);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.MeshBasicMaterial({ color: 0xff825f, transparent: true, opacity: 0.13, depthWrite: false }));
  glow.position.copy(sun.position);
  scene.add(glow);
}

function createTerrainCells() {
  const cells = [];
  for (let ox = -2; ox <= 2; ox++) {
    for (let oz = -3; oz <= 2; oz++) {
      const geo = new THREE.PlaneGeometry(CELL, CELL, 42, 42);
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, mat.ground);
      mesh.userData = { ox, oz, cx: null, cz: null };
      scene.add(mesh);
      cells.push(mesh);
    }
  }
  return cells;
}

function createRoadCells() {
  const cells = [];
  for (let oz = -4; oz <= 3; oz++) {
    const group = new THREE.Group();
    group.userData = { oz, cz: null };
    scene.add(group);
    cells.push(group);
  }
  return cells;
}

function createSceneryCells() {
  const cells = [];
  for (let ox = -2; ox <= 2; ox++) {
    for (let oz = -3; oz <= 2; oz++) {
      const group = new THREE.Group();
      group.userData = { ox, oz, cx: null, cz: null };
      scene.add(group);
      cells.push(group);
    }
  }
  return cells;
}

function createTargets() {
  const list = [];
  for (let i = 0; i < 12; i++) {
    const group = new THREE.Group();
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.44, 16, 10), mat.cyan.clone());
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.28, 16, 10), mat.halo.clone());
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 1.15, 8), mat.metal);
    mast.position.y = -0.63;
    group.add(orb, halo, mast);
    group.userData = { index: i, key: '', scanned: false, label: label(i) };
    scene.add(group);
    list.push(group);
  }
  return list;
}

function updateWorldCells(force = false) {
  const cx = Math.floor(rover.pos.x / CELL);
  const cz = Math.floor(rover.pos.z / CELL);
  const key = `${cx}:${cz}`;
  if (!force && key === activeCellKey) return;
  activeCellKey = key;

  for (const cell of terrainCells) {
    const ncx = cx + cell.userData.ox;
    const ncz = cz + cell.userData.oz;
    if (force || cell.userData.cx !== ncx || cell.userData.cz !== ncz) {
      cell.userData.cx = ncx;
      cell.userData.cz = ncz;
      cell.position.set(ncx * CELL + CELL / 2, 0, ncz * CELL + CELL / 2);
      shapeTerrainCell(cell);
    }
  }

  for (const road of roadCells) {
    const ncz = cz + road.userData.oz;
    if (force || road.userData.cz !== ncz) {
      road.userData.cz = ncz;
      buildRoadCell(road, ncz);
    }
  }

  for (const group of sceneryCells) {
    const ncx = cx + group.userData.ox;
    const ncz = cz + group.userData.oz;
    if (force || group.userData.cx !== ncx || group.userData.cz !== ncz) {
      group.userData.cx = ncx;
      group.userData.cz = ncz;
      buildSceneryCell(group, ncx, ncz);
    }
  }

  placeTargets(cx, cz);
}

function shapeTerrainCell(mesh) {
  const pos = mesh.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i) + mesh.position.x;
    const wz = pos.getZ(i) + mesh.position.z;
    pos.setY(i, terrainHeight(wx, wz));
  }
  pos.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}

function terrainHeight(x, z) {
  const roadCut = Math.max(0, 1 - Math.abs(x - roadCenter(z)) / 14) * 0.82;
  const broad = Math.sin(x * 0.018) * 1.18 + Math.cos(z * 0.016) * 1.05;
  const fine = Math.sin(x * 0.061) * 0.58 + Math.cos(z * 0.047) * 0.68 + Math.sin((x + z) * 0.024) * 0.42;
  return (broad + fine) * (1 - roadCut) - roadCut * 0.08;
}

function roadCenter(z) {
  return Math.sin(z * 0.010) * 24 + Math.sin(z * 0.0035) * 38;
}

function roadAngle(z) {
  return Math.atan2(roadCenter(z + 12) - roadCenter(z - 12), 24);
}

function distanceToRoad(x, z) {
  return Math.abs(x - roadCenter(z));
}

function roverEyeHeight() {
  const ground = terrainHeight(rover.pos.x, rover.pos.z);
  rover.groundY += (ground - rover.groundY) * 0.24;
  return rover.groundY + 1.68 + rover.bob;
}

function buildRoadCell(group, cz) {
  group.clear();
  const z = cz * CELL + CELL / 2;
  const x = roadCenter(z);
  group.position.set(x, terrainHeight(x, z) + 0.06, z);
  group.rotation.y = roadAngle(z);

  const road = new THREE.Mesh(new THREE.PlaneGeometry(12.2, CELL * 1.28, 1, 10), mat.road);
  road.rotation.x = -Math.PI / 2;
  group.add(road);

  for (let j = -4; j <= 4; j++) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 6.4), mat.roadLine);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, 0.012, j * 12.5);
    group.add(dash);
  }

  for (const sx of [-6.45, 6.45]) {
    const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(0.22, CELL * 1.2), mat.roadLine);
    shoulder.rotation.x = -Math.PI / 2;
    shoulder.position.set(sx, 0.014, 0);
    group.add(shoulder);
  }
}

function buildSceneryCell(group, cx, cz) {
  group.clear();
  group.position.set(cx * CELL, 0, cz * CELL);

  const rockCount = 7 + Math.floor(stableRange(10, cx, cz, 0, 8));
  for (let i = 0; i < rockCount; i++) {
    const wx = cx * CELL + stableRange(20 + i, cx, cz, 4, CELL - 4);
    const wz = cz * CELL + stableRange(40 + i, cx, cz, 4, CELL - 4);
    if (distanceToRoad(wx, wz) < ROAD_CLEARANCE) continue;
    addRock(group, wx, wz, cx, cz, i);
  }

  if (stableChance(90, cx, cz) > 0.44) addInfrastructure(group, cx, cz);
  if (stableChance(91, cx, cz) > 0.60) addRidge(group, cx, cz);
}

function addRock(group, wx, wz, cx, cz, i) {
  const h = stableRange(100 + i, cx, cz, 0.7, 5.3);
  const r = stableRange(120 + i, cx, cz, 0.7, 4.1);
  const rock = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r, h, 7 + (i % 3), 1), i % 2 ? mat.rockA : mat.rockB);
  rock.position.set(wx - cx * CELL, terrainHeight(wx, wz) + h / 2 - 0.35, wz - cz * CELL);
  rock.rotation.y = stableRange(140 + i, cx, cz, 0, Math.PI);
  rock.scale.set(stableRange(150 + i, cx, cz, 0.8, 1.5), 1, stableRange(160 + i, cx, cz, 0.7, 1.4));
  group.add(rock);
}

function addInfrastructure(group, cx, cz) {
  let wx = cx * CELL + stableRange(200, cx, cz, 10, CELL - 10);
  const wz = cz * CELL + stableRange(201, cx, cz, 10, CELL - 10);
  if (distanceToRoad(wx, wz) < ROAD_CLEARANCE + 8) {
    wx = roadCenter(wz) + (stableChance(202, cx, cz) > 0.5 ? 1 : -1) * stableRange(203, cx, cz, 32, 54);
  }
  const node = new THREE.Group();
  node.position.set(wx - cx * CELL, terrainHeight(wx, wz), wz - cz * CELL);
  node.rotation.y = stableRange(204, cx, cz, -0.6, 0.6);
  group.add(node);

  const kind = Math.floor(stableRange(205, cx, cz, 0, 6));
  if (kind === 0) markerPylon(node);
  else if (kind === 1) antennaCluster(node, cx, cz);
  else if (kind === 2) pipeRun(node);
  else if (kind === 3) landingPad(node);
  else if (kind === 4) buriedModule(node);
  else utilityMast(node);
}

function markerPylon(node) {
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.23, 5.5, 10), mat.darkMetal);
  mast.position.y = 2.75;
  node.add(mast);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.55, 0.42), mat.panel);
  cap.position.y = 5.55;
  node.add(cap);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), mat.amber);
  light.position.y = 6.0;
  node.add(light);
}

function antennaCluster(node, cx, cz) {
  for (let i = 0; i < 5; i++) {
    const height = stableRange(220 + i, cx, cz, 4.2, 9.5);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, height, 8), mat.metal);
    mast.position.set((i - 2) * 0.75, height / 2, stableRange(230 + i, cx, cz, -0.8, 0.8));
    node.add(mast);
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.18, 0.12, 18), mat.panel);
    dish.position.set(mast.position.x, height * 0.84, mast.position.z);
    dish.rotation.x = Math.PI / 2 + stableRange(240 + i, cx, cz, -0.25, 0.25);
    node.add(dish);
  }
}

function pipeRun(node) {
  for (let i = 0; i < 3; i++) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 13.5, 12), mat.darkMetal);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, 0.55 + i * 0.22, (i - 1) * 0.42);
    node.add(pipe);
  }
  for (let i = -2; i <= 2; i++) {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.95, 0.22), mat.metal);
    brace.position.set(i * 2.7, 0.35, 0);
    node.add(brace);
  }
}

function landingPad(node) {
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.5, 0.18, 28), mat.road);
  pad.position.y = 0.12;
  node.add(pad);
  for (let i = 0; i < 4; i++) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.08, 0.22), mat.amber);
    light.position.set(Math.cos(i * Math.PI / 2) * 4.8, 0.28, Math.sin(i * Math.PI / 2) * 4.8);
    light.rotation.y = i * Math.PI / 2;
    node.add(light);
  }
}

function buriedModule(node) {
  const shell = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.9, 3.5), mat.panel);
  shell.position.y = 0.95;
  node.add(shell);
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 1.1), mat.metal);
  hatch.position.set(0, 1.96, 0);
  node.add(hatch);
}

function utilityMast(node) {
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 8.4, 8), mat.darkMetal);
  tower.position.y = 4.2;
  node.add(tower);
  for (let i = 0; i < 3; i++) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.6 - i * 0.4, 0.08, 0.08), mat.metal);
    arm.position.set(0, 4.8 + i * 0.9, 0);
    arm.rotation.y = i * 0.7;
    node.add(arm);
  }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), mat.cyan);
  lamp.position.y = 8.55;
  node.add(lamp);
}

function addRidge(group, cx, cz) {
  const rx = stableRange(300, cx, cz, 5, CELL - 5);
  const rz = stableRange(301, cx, cz, 5, CELL - 5);
  const wx = cx * CELL + rx;
  const wz = cz * CELL + rz;
  if (distanceToRoad(wx, wz) < ROAD_CLEARANCE + 10) return;
  const ridge = new THREE.Group();
  ridge.position.set(rx, terrainHeight(wx, wz), rz);
  ridge.rotation.y = stableRange(302, cx, cz, -0.9, 0.9);
  group.add(ridge);
  for (let i = 0; i < 5; i++) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(stableRange(310 + i, cx, cz, 7, 22), stableRange(320 + i, cx, cz, 1.8, 6.5), stableRange(330 + i, cx, cz, 4, 11)), i % 2 ? mat.rockA : mat.rockB);
    block.position.set(i * stableRange(340 + i, cx, cz, 4, 10), 1.5, stableRange(350 + i, cx, cz, -5, 5));
    block.rotation.y = stableRange(360 + i, cx, cz, -0.6, 0.6);
    block.rotation.z = stableRange(370 + i, cx, cz, -0.12, 0.12);
    ridge.add(block);
  }
}

function placeTargets(cx, cz) {
  for (const target of targets) {
    const i = target.userData.index;
    const tcx = cx + Math.floor(stableRange(500 + i, cx, cz, -2, 3));
    const tcz = cz + Math.floor(stableRange(520 + i, cx, cz, -4, 1));
    const key = `${tcx}:${tcz}:${i}`;
    if (target.userData.key !== key) {
      let wx = tcx * CELL + stableRange(540 + i, tcx, tcz, 8, CELL - 8);
      const wz = tcz * CELL + stableRange(560 + i, tcx, tcz, 8, CELL - 8);
      if (distanceToRoad(wx, wz) < ROAD_CLEARANCE) wx = roadCenter(wz) + (stableChance(570 + i, tcx, tcz) > 0.5 ? 28 : -28);
      target.position.set(wx, terrainHeight(wx, wz) + 1.35, wz);
      target.userData.key = key;
      target.userData.scanned = false;
      target.userData.label = label(Math.floor(stableRange(580 + i, tcx, tcz, 0, 6)));
    }
  }
}

function createWind() {
  const geo = new THREE.BufferGeometry();
  const count = 1250;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = seeded(i * 3, -115, 115);
    positions[i * 3 + 1] = seeded(i * 5, 0.4, 28);
    positions[i * 3 + 2] = seeded(i * 7, -250, 75);
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
  const desired = forward.multiplyScalar(-input.throttle * 17.2).add(side.multiplyScalar(input.strafe * 7.2));
  rover.vel.lerp(desired, Math.min(1, dt * 2.6));
  if (input.braking) rover.vel.multiplyScalar(Math.max(0.08, 1 - dt * 5.6));
  rover.pos.addScaledVector(rover.vel, dt);
  rover.speed = rover.vel.length();

  updateWorldCells(false);
  updateWind(dt, t);
  updateScans(dt, t);

  rover.bob = Math.sin(t * 3.6) * Math.min(0.04, rover.speed * 0.0045) + Math.sin(rover.pos.x * 0.28 + rover.pos.z * 0.16) * 0.010;
  camera.position.set(rover.pos.x, roverEyeHeight(), rover.pos.z);
  camera.rotation.set(-0.055 + rover.bob * 0.32, rover.yaw, -input.steer * 0.015);

  cabinGlow.intensity = 0.45 + Math.sin(t * 7) * 0.05 + (input.scanning ? 0.35 : 0);
  updateHud();
}

function updateWind(dt, t) {
  rover.gust = 0.48 + Math.sin(t * 0.7) * 0.24 + Math.sin(t * 2.1) * 0.08;
  const pos = wind.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i) + dt * (14 + rover.gust * 20);
    let z = pos.getZ(i) + dt * (2 + rover.gust * 4);
    if (x > rover.pos.x + 120) x = rover.pos.x - 120;
    if (z > rover.pos.z + 80) z = rover.pos.z - 255;
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
    target.children[0].material.opacity = target.userData.scanned ? 0.12 : 0.72 + Math.sin(t * 4 + target.userData.index) * 0.08;
    target.children[1].material.opacity = target.userData.scanned ? 0.02 : 0.10 + Math.sin(t * 3 + target.userData.index) * 0.03;
    projected.copy(target.position).project(camera);
    const score = Math.hypot(projected.x, projected.y);
    const distance = target.position.distanceTo(camera.position);
    if (!target.userData.scanned && projected.z < 1 && distance < 125 && score < 0.16 && score < bestScore) {
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
  const signal = Math.max(17, Math.round(52 + Math.sin(rover.pos.x * 0.05) * 8 - rover.gust * 5));
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
  if (running) update(dt, now / 1000);
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
  for (let i = 0; i < 7000; i++) {
    const v = 80 + Math.random() * 70;
    x.fillStyle = `rgba(${v + 30}, ${v + 12}, ${v}, ${0.06 + Math.random() * 0.12})`;
    x.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1);
  }
  for (let i = 0; i < 95; i++) {
    x.strokeStyle = `rgba(255,230,205,${0.02 + Math.random() * 0.04})`;
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
  for (let i = 0; i < 3600; i++) {
    const v = 60 + Math.random() * 90;
    x.fillStyle = `rgba(${v}, ${v * 0.85}, ${v * 0.72}, ${0.06 + Math.random() * 0.10})`;
    x.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1);
  }
  return textureFrom(c, 3, 3);
}

function makeRoadTexture() {
  const c = baseCanvas(256, 256, '#3b3530');
  const x = c.getContext('2d');
  for (let i = 0; i < 3000; i++) {
    const v = 45 + Math.random() * 70;
    x.fillStyle = `rgba(${v}, ${v * 0.92}, ${v * 0.82}, ${0.055 + Math.random() * 0.11})`;
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
  for (let i = 0; i < 300; i++) {
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

function stableHash(seed, cx, cz) {
  return Math.sin(seed * 92821.17 + cx * 374.13 + cz * 918.77) * 43758.5453123;
}

function stableChance(seed, cx, cz) {
  const x = stableHash(seed, cx, cz);
  return x - Math.floor(x);
}

function stableRange(seed, cx, cz, min, max) {
  return min + stableChance(seed, cx, cz) * (max - min);
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
  rover.groundY = terrainHeight(rover.pos.x, rover.pos.z);
  log.textContent = 'CONTINUOUS WORLD ONLINE: infinite cells stable, road corridor clear.';
});

window.addEventListener('resize', resize);
