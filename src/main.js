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

let running = false;
let lastTime = performance.now();
let scannedCount = 0;
let reticleTarget = null;
let scanHold = 0;

const touch = {
  move: { id: null, x: 0, y: 0 },
  look: { id: null, x: 0, y: 0 }
};

const vehicle = {
  throttle: 0,
  strafe: 0,
  steering: 0,
  turnRate: 0,
  speed: 0,
  suspension: 0
};

const world = {
  yaw: 0,
  position: new THREE.Vector3(0, 1.55, 0),
  velocity: new THREE.Vector3(),
  gust: 0.5
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071018);
scene.fog = new THREE.FogExp2(0x806452, 0.012);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 620);
camera.position.copy(world.position);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

scene.add(new THREE.HemisphereLight(0xbfd8e0, 0x4b362b, 1.25));

const star = new THREE.DirectionalLight(0xffb18a, 2.15);
star.position.set(-40, 60, 26);
scene.add(star);

const cabinLight = new THREE.PointLight(0x8eeaff, 2.2, 18);
cabinLight.position.set(0, 0.2, 0.2);
scene.add(cabinLight);

const trimLight = new THREE.PointLight(0xffb36c, 1.05, 10);
trimLight.position.set(0, -0.9, -0.4);
scene.add(trimLight);

const tex = {
  dust: makeDustTexture(),
  armor: makePanelTexture('#111a1f', '#03090d', '#85ddff'),
  leather: makeLeatherTexture('#1b130f', '#5a3b25'),
  suede: makeLeatherTexture('#29231d', '#77543a'),
  brushed: makeBrushedMetalTexture(),
  glass: makeGlassTexture(),
  screen: makeScreenTexture()
};

const materials = {
  ground: new THREE.MeshStandardMaterial({ color: 0x806653, roughness: 0.96, metalness: 0.02, map: tex.dust }),
  armor: new THREE.MeshStandardMaterial({ color: 0x10191f, roughness: 0.58, metalness: 0.55, map: tex.armor }),
  leather: new THREE.MeshStandardMaterial({ color: 0x18120f, roughness: 0.78, metalness: 0.05, map: tex.leather }),
  suede: new THREE.MeshStandardMaterial({ color: 0x29231d, roughness: 0.94, metalness: 0.02, map: tex.suede }),
  brushed: new THREE.MeshStandardMaterial({ color: 0x9a7a51, roughness: 0.38, metalness: 0.82, map: tex.brushed }),
  glass: new THREE.MeshStandardMaterial({ color: 0x9bdfff, transparent: true, opacity: 0.18, roughness: 0.12, metalness: 0.06, map: tex.glass, side: THREE.DoubleSide }),
  screen: new THREE.MeshBasicMaterial({ color: 0x95f2ff, map: tex.screen, transparent: true, opacity: 0.86 }),
  amber: new THREE.MeshBasicMaterial({ color: 0xffb36c, transparent: true, opacity: 0.70 }),
  red: new THREE.MeshBasicMaterial({ color: 0xff5f4f, transparent: true, opacity: 0.66 }),
  rockA: new THREE.MeshStandardMaterial({ color: 0x65584d, roughness: 0.92, metalness: 0.02, map: tex.dust }),
  rockB: new THREE.MeshStandardMaterial({ color: 0x403a34, roughness: 0.96, metalness: 0.01, map: tex.dust })
};

const terrainChunks = buildInfiniteTerrain();
const rockField = buildRecyclingRocks();
buildCockpit();
buildWind();
const scanTargets = buildRecyclingScanTargets();

function buildInfiniteTerrain() {
  const chunks = [];
  const size = 90;
  const geo = new THREE.PlaneGeometry(size, size, 48, 48);
  geo.rotateX(-Math.PI / 2);
  for (let gx = -1; gx <= 1; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
      const mesh = new THREE.Mesh(geo.clone(), materials.ground);
      mesh.userData = { gx, gz, size };
      mesh.position.set(gx * size, 0, gz * size);
      reshapeChunk(mesh);
      scene.add(mesh);
      chunks.push(mesh);
    }
  }
  return chunks;
}

function reshapeChunk(mesh) {
  const pos = mesh.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i) + mesh.position.x;
    const wz = pos.getZ(i) + mesh.position.z;
    const h = terrainHeight(wx, wz);
    pos.setY(i, h);
  }
  pos.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}

function updateInfiniteTerrain() {
  const size = 90;
  const centerX = Math.round(world.position.x / size);
  const centerZ = Math.round(world.position.z / size);
  let changed = false;
  for (const chunk of terrainChunks) {
    const desiredX = centerX + chunk.userData.gx;
    const desiredZ = centerZ + chunk.userData.gz;
    const nx = desiredX * size;
    const nz = desiredZ * size;
    if (chunk.position.x !== nx || chunk.position.z !== nz) {
      chunk.position.set(nx, 0, nz);
      reshapeChunk(chunk);
      changed = true;
    }
  }
  if (changed) recycleRocksAndTargets();
}

function terrainHeight(x, z) {
  return Math.sin(x * 0.055) * 0.7 + Math.cos(z * 0.042) * 0.9 + Math.sin((x + z) * 0.027) * 0.55;
}

function buildRecyclingRocks() {
  const rocks = [];
  for (let i = 0; i < 72; i++) {
    const height = seededRange(i * 41, 0.9, 4.6);
    const radius = seededRange(i * 19, 0.8, 3.6);
    const geo = new THREE.CylinderGeometry(radius * 0.55, radius, height, 7 + (i % 3), 1);
    const rock = new THREE.Mesh(geo, i % 2 ? materials.rockA : materials.rockB);
    rock.userData = { seed: i, radius, height };
    scene.add(rock);
    rocks.push(rock);
  }
  recycleRocks(rocks);
  return rocks;
}

function recycleRocks(rocks) {
  for (const rock of rocks) {
    const s = rock.userData.seed;
    const x = world.position.x + seededRange(s * 11 + Math.floor(world.position.z / 90), -105, 105);
    const z = world.position.z + seededRange(s * 17 + Math.floor(world.position.x / 90), -170, 95);
    rock.position.set(x, terrainHeight(x, z) + rock.userData.height / 2 - 0.35, z);
    rock.rotation.y = seededRange(s * 13 + Math.floor(z), 0, Math.PI);
    rock.scale.set(seededRange(s * 7, 0.75, 1.45), 1, seededRange(s * 23, 0.65, 1.35));
  }
}

function buildCockpit() {
  const cockpit = new THREE.Group();
  cockpit.name = 'cockpit';
  camera.add(cockpit);
  scene.add(camera);

  addWindshield(cockpit);
  addDash(cockpit);
  addSeats(cockpit);
  addYoke(cockpit);
  addConsole(cockpit);
  addCabinShell(cockpit);
}

function addWindshield(cockpit) {
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(5.9, 3.35), materials.glass);
  glass.position.set(0, 0.45, -3.45);
  cockpit.add(glass);

  const frame = [
    [0, 2.18, -3.30, 6.35, 0.22, 0.30, 0, 0, 0],
    [0, -1.25, -3.28, 6.15, 0.25, 0.34, 0, 0, 0],
    [-3.05, 0.45, -3.26, 0.26, 3.45, 0.32, 0, 0, -0.07],
    [3.05, 0.45, -3.26, 0.26, 3.45, 0.32, 0, 0, 0.07]
  ];
  for (const p of frame) addBox(cockpit, p, materials.armor);

  const centerRail = new THREE.Mesh(new THREE.BoxGeometry(0.055, 3.05, 0.08), materials.brushed);
  centerRail.position.set(0, 0.45, -3.18);
  centerRail.material = materials.brushed;
  cockpit.add(centerRail);
}

function addDash(cockpit) {
  const dash = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.72, 1.22), materials.leather);
  dash.position.set(0, -0.93, -2.35);
  dash.rotation.x = -0.12;
  cockpit.add(dash);

  const brow = new THREE.Mesh(new THREE.BoxGeometry(5.55, 0.28, 0.38), materials.armor);
  brow.position.set(0, -0.43, -2.66);
  cockpit.add(brow);

  const pano = new THREE.Mesh(new THREE.BoxGeometry(3.85, 0.50, 0.045), materials.screen);
  pano.position.set(0, -0.55, -2.35);
  pano.rotation.x = -0.08;
  cockpit.add(pano);

  for (const x of [-2.2, 2.2]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.44, 0.05), materials.amber);
    side.position.set(x, -0.62, -2.25);
    side.rotation.y = x < 0 ? 0.18 : -0.18;
    cockpit.add(side);
  }

  for (let i = 0; i < 10; i++) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.15, 0.07), materials.armor);
    vent.position.set(-0.45 + i * 0.10, -0.93, -1.78);
    cockpit.add(vent);
  }
}

function addSeats(cockpit) {
  addSeat(cockpit, -1.95, -1.02, -0.58, 0.22);
  addSeat(cockpit, 1.95, -1.02, -0.58, -0.22);
}

function addSeat(cockpit, x, y, z, rot) {
  const seat = new THREE.Group();
  seat.position.set(x, y, z);
  seat.rotation.y = rot;
  cockpit.add(seat);

  addBox(seat, [0, -0.18, 0.05, 1.15, 0.34, 1.0, 0, 0, 0], materials.leather);
  addBox(seat, [0, 0.02, -0.02, 0.93, 0.13, 0.76, 0, 0, 0], materials.suede);
  addBox(seat, [0, 0.62, 0.48, 1.08, 1.22, 0.22, -0.18, 0, 0], materials.leather);
  addBox(seat, [0, 0.62, 0.34, 0.66, 0.96, 0.04, -0.18, 0, 0], materials.suede);
  addBox(seat, [0, 1.33, 0.30, 0.72, 0.30, 0.22, -0.12, 0, 0], materials.leather);
  addBox(seat, [-0.56, 0.55, 0.34, 0.16, 1.02, 0.24, -0.18, 0, 0], materials.leather);
  addBox(seat, [0.56, 0.55, 0.34, 0.16, 1.02, 0.24, -0.18, 0, 0], materials.leather);
  for (let i = 0; i < 4; i++) addBox(seat, [-0.27 + i * 0.18, 0.60, 0.31, 0.025, 0.90, 0.014, -0.18, 0, 0], materials.brushed);
}

function addYoke(cockpit) {
  const yoke = new THREE.Group();
  yoke.name = 'steeringYoke';
  yoke.position.set(0, -0.90, -1.24);
  yoke.rotation.x = -0.16;
  cockpit.add(yoke);

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.72, 16), materials.armor);
  column.rotation.x = Math.PI / 2;
  column.position.set(0, -0.06, 0.28);
  yoke.add(column);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.08, 22), materials.brushed);
  hub.rotation.x = Math.PI / 2;
  hub.position.set(0, 0, -0.12);
  yoke.add(hub);

  addBox(yoke, [-0.50, 0, -0.13, 0.82, 0.16, 0.15, 0, 0, -0.18], materials.leather);
  addBox(yoke, [0.50, 0, -0.13, 0.82, 0.16, 0.15, 0, 0, 0.18], materials.leather);
  addBox(yoke, [0, 0.20, -0.13, 1.05, 0.10, 0.12, 0, 0, 0], materials.armor);
  addBox(yoke, [-0.70, 0.05, -0.02, 0.11, 0.06, 0.035, 0, 0, 0], materials.red);
  addBox(yoke, [0.70, 0.05, -0.02, 0.11, 0.06, 0.035, 0, 0, 0], materials.red);
}

function addConsole(cockpit) {
  const con = new THREE.Group();
  con.name = 'centerConsole';
  con.position.set(0, -1.14, -0.58);
  con.rotation.x = -0.14;
  cockpit.add(con);

  addBox(con, [0, 0, 0, 1.28, 0.38, 1.65, 0, 0, 0], materials.leather);
  addBox(con, [0, 0.24, -0.07, 1.10, 0.055, 1.20, 0, 0, 0], materials.armor);
  addBox(con, [0, 0.30, -0.25, 0.74, 0.035, 0.68, 0, 0, 0], materials.screen);
  addBox(con, [0, -0.02, 0.88, 1.28, 0.26, 0.70, 0, 0, 0], materials.suede);

  const shifter = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, 0.44, 16), materials.brushed);
  shifter.position.set(0.44, 0.50, 0.32);
  shifter.rotation.z = -0.22;
  con.add(shifter);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10), materials.leather);
  knob.position.set(0.50, 0.72, 0.28);
  con.add(knob);

  for (let i = 0; i < 8; i++) {
    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.025, 12), i % 2 ? materials.screen : materials.amber);
    button.position.set(-0.46 + (i % 4) * 0.15, 0.31, 0.34 + Math.floor(i / 4) * 0.16);
    con.add(button);
  }
}

function addCabinShell(cockpit) {
  addBox(cockpit, [0, 2.05, -1.05, 6.2, 0.28, 2.4, 0, 0, 0], materials.suede);
  addBox(cockpit, [0, 1.74, -1.35, 1.35, 0.16, 0.70, 0, 0, 0], materials.armor);
  addBox(cockpit, [-3.0, -0.72, -0.88, 0.48, 0.95, 2.0, 0, -0.10, 0], materials.leather);
  addBox(cockpit, [3.0, -0.72, -0.88, 0.48, 0.95, 2.0, 0, 0.10, 0], materials.leather);
  addBox(cockpit, [0, -1.52, -0.35, 5.8, 0.11, 3.15, 0, 0, 0], materials.armor);
  for (let i = 0; i < 8; i++) addBox(cockpit, [-1.75 + i * 0.50, -1.45, -0.28, 0.025, 0.016, 2.7, 0, 0, 0], materials.amber);
}

function addBox(group, p, material) {
  const [x, y, z, sx, sy, sz, rx, ry, rz] = p;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  group.add(mesh);
  return mesh;
}

function buildWind() {
  const windGeo = new THREE.BufferGeometry();
  const count = 950;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = seededRange(i * 3, -90, 90);
    positions[i * 3 + 1] = seededRange(i * 5, 0.4, 22);
    positions[i * 3 + 2] = seededRange(i * 7, -190, 45);
  }
  windGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const windMat = new THREE.PointsMaterial({ color: 0xd8eef3, size: 0.045, transparent: true, opacity: 0.45, depthWrite: false });
  const windPoints = new THREE.Points(windGeo, windMat);
  windPoints.name = 'wind';
  scene.add(windPoints);
}

function buildRecyclingScanTargets() {
  const targets = [];
  for (let i = 0; i < 8; i++) {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 10), new THREE.MeshBasicMaterial({ color: 0x78eaff, transparent: true, opacity: 0.82 })));
    group.add(new THREE.Mesh(new THREE.SphereGeometry(1.25, 16, 10), new THREE.MeshBasicMaterial({ color: 0x78eaff, transparent: true, opacity: 0.11 })));
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 1.2, 8), materials.brushed);
    stem.position.y = -0.65;
    group.add(stem);
    group.userData = { seed: i, label: scanLabel(i), scanned: false };
    scene.add(group);
    targets.push(group);
  }
  recycleTargets(targets);
  return targets;
}

function recycleTargets(targets) {
  for (const target of targets) {
    const s = target.userData.seed;
    const x = world.position.x + seededRange(s * 31 + Math.floor(world.position.z / 120), -80, 80);
    const z = world.position.z + seededRange(s * 53 + Math.floor(world.position.x / 120), -175, -35);
    target.position.set(x, terrainHeight(x, z) + 1.35, z);
    target.userData.scanned = false;
    target.userData.label = scanLabel(Math.abs(Math.floor(x + z + s)));
  }
}

function recycleRocksAndTargets() {
  recycleRocks(rockField);
  recycleTargets(scanTargets);
}

function scanLabel(i) {
  return ['blue-white mineral bloom', 'pressure mast wreckage', 'ice-salt seep', 'basalt rib formation', 'navigation pylon', 'wind-polished ridge'][i % 6];
}

function update(dt, t) {
  const moveX = curveInput(touch.move.x);
  const moveY = curveInput(touch.move.y);
  const lookX = curveInput(touch.look.x);

  vehicle.throttle += (moveY - vehicle.throttle) * Math.min(1, dt * 4.4);
  vehicle.strafe += (moveX - vehicle.strafe) * Math.min(1, dt * 4.2);
  vehicle.steering += (lookX - vehicle.steering) * Math.min(1, dt * 5.8);
  vehicle.turnRate += (vehicle.steering * 2.05 - vehicle.turnRate) * Math.min(1, dt * 4.8);
  world.yaw -= vehicle.turnRate * dt;

  const dir = new THREE.Vector3(Math.sin(world.yaw), 0, Math.cos(world.yaw));
  const side = new THREE.Vector3(Math.cos(world.yaw), 0, -Math.sin(world.yaw));
  const desired = dir.multiplyScalar(-vehicle.throttle * 15.5).add(side.multiplyScalar(vehicle.strafe * 8.5));
  world.velocity.lerp(desired, Math.min(1, dt * 2.9));
  world.position.addScaledVector(world.velocity, dt);
  vehicle.speed = world.velocity.length();

  updateInfiniteTerrain();

  vehicle.suspension = Math.sin(t * 3.8) * Math.min(0.045, vehicle.speed * 0.005) + Math.sin(world.position.x * 0.35 + world.position.z * 0.18) * 0.012;
  camera.position.set(world.position.x, 1.55 + vehicle.suspension, world.position.z);
  camera.rotation.set(-0.045 + vehicle.suspension * 0.35, world.yaw, -vehicle.steering * 0.018);

  const yoke = camera.getObjectByName('steeringYoke');
  if (yoke) yoke.rotation.z = -vehicle.steering * 0.18;

  updateWind(dt, t);
  cabinLight.intensity = 1.75 + Math.sin(t * 7) * 0.08;
  trimLight.intensity = 0.72 + Math.sin(t * 1.3) * 0.12;
  updateScans(dt, t);
  updateHud();
}

function updateWind(dt, t) {
  world.gust = 0.45 + Math.sin(t * 0.7) * 0.25 + Math.sin(t * 2.1) * 0.08;
  const wind = scene.getObjectByName('wind');
  const positions = wind.geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    let x = positions.getX(i) + dt * (12 + world.gust * 18);
    let z = positions.getZ(i) + dt * (2 + world.gust * 4);
    if (x > world.position.x + 95) x = world.position.x - 95;
    if (z > world.position.z + 55) z = world.position.z - 195;
    positions.setX(i, x);
    positions.setZ(i, z);
  }
  positions.needsUpdate = true;
}

function updateScans(dt, t) {
  const projected = new THREE.Vector3();
  let best = null;
  let bestScore = 999;

  for (const target of scanTargets) {
    target.children[0].material.opacity = target.userData.scanned ? 0.12 : 0.75 + Math.sin(t * 4 + target.userData.seed) * 0.07;
    target.children[1].material.opacity = target.userData.scanned ? 0.03 : 0.11 + Math.sin(t * 3 + target.userData.seed) * 0.03;
    target.rotation.y += dt * 0.45;
    projected.copy(target.position).project(camera);
    const score = Math.hypot(projected.x, projected.y);
    const distance = target.position.distanceTo(camera.position);
    if (!target.userData.scanned && projected.z < 1 && distance < 105 && score < 0.13 && score < bestScore) {
      best = target;
      bestScore = score;
    }
  }

  if (best) {
    if (reticleTarget !== best) {
      reticleTarget = best;
      scanHold = 0;
    }
    scanHold += dt;
    if (scanHold >= 1.05) {
      best.userData.scanned = true;
      scannedCount++;
      log.textContent = `SCAN COMPLETE: ${best.userData.label}. Infinite grid sample archived.`;
      scanHold = 0;
      reticleTarget = null;
    } else {
      log.textContent = `SCANNING: ${best.userData.label}`;
    }
  } else {
    reticleTarget = null;
    scanHold = Math.max(0, scanHold - dt * 2);
  }
}

function updateHud() {
  const seal = Math.round(89 + Math.sin(performance.now() * 0.0017) * 2 - world.gust * 2);
  const signal = Math.max(18, Math.round(48 + Math.sin(world.position.x * 0.05) * 8 - world.gust * 5));
  sealText.textContent = `${seal}%`;
  signalText.textContent = `${signal}%`;
  scanText.textContent = `${scannedCount} / ∞`;
  sealFill.style.width = `${seal}%`;
  signalFill.style.width = `${signal}%`;
  scanFill.style.width = `${Math.min(100, (scannedCount % 10) * 10)}%`;
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
    const rawLen = Math.hypot(dx, dy);
    const scale = rawLen > max ? max / rawLen : 1;
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

function curveInput(value) {
  const sign = Math.sign(value);
  const abs = Math.abs(value);
  if (abs < 0.03) return 0;
  return sign * Math.pow(abs, 1.35);
}

function makeDustTexture() {
  const c = makeCanvas(256, 256, '#806653');
  const ctx = c.getContext('2d');
  for (let i = 0; i < 6500; i++) {
    const v = 80 + Math.random() * 70;
    ctx.fillStyle = `rgba(${v + 30}, ${v + 12}, ${v}, ${0.08 + Math.random() * 0.12})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1);
  }
  for (let i = 0; i < 70; i++) {
    ctx.strokeStyle = `rgba(255,230,205,${0.03 + Math.random() * 0.04})`;
    ctx.beginPath();
    const y = Math.random() * 256;
    ctx.moveTo(0, y);
    ctx.lineTo(256, y + Math.random() * 18 - 9);
    ctx.stroke();
  }
  return textureFromCanvas(c, 16, 16);
}

function makePanelTexture(a = '#17252c', b = '#03090d', line = '#b4e6ff') {
  const c = makeCanvas(256, 128, a);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 256, 128);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 128);
  for (let y = 12; y < 128; y += 18) {
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y + Math.sin(y) * 3);
    ctx.stroke();
  }
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(${hexToRgb(line)},${0.025 + Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 128, Math.random() * 5, 1);
  }
  return textureFromCanvas(c, 2, 2);
}

function makeLeatherTexture(base, stitch) {
  const c = makeCanvas(256, 256, base);
  const ctx = c.getContext('2d');
  for (let i = 0; i < 6000; i++) {
    const v = 18 + Math.random() * 48;
    ctx.fillStyle = `rgba(${v + 16}, ${v + 10}, ${v + 5}, ${0.045 + Math.random() * 0.08})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1);
  }
  for (let i = 0; i < 34; i++) {
    ctx.strokeStyle = `${stitch}55`;
    ctx.beginPath();
    const x = Math.random() * 256;
    ctx.moveTo(x, 0);
    ctx.lineTo(x + Math.random() * 16 - 8, 256);
    ctx.stroke();
  }
  return textureFromCanvas(c, 2, 2);
}

function makeBrushedMetalTexture() {
  const c = makeCanvas(256, 128, '#8d714e');
  const ctx = c.getContext('2d');
  for (let y = 0; y < 128; y++) {
    const v = 120 + Math.random() * 60;
    ctx.strokeStyle = `rgba(${v + 20},${v},${v - 40},0.18)`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y + Math.random() * 2 - 1);
    ctx.stroke();
  }
  return textureFromCanvas(c, 3, 2);
}

function makeGlassTexture() {
  const c = makeCanvas(256, 256, 'rgba(0,0,0,0)');
  const ctx = c.getContext('2d');
  for (let i = 0; i < 55; i++) {
    ctx.strokeStyle = `rgba(220,245,255,${0.04 + Math.random() * 0.08})`;
    ctx.beginPath();
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.random() * 90 - 30, y + Math.random() * 14 - 7);
    ctx.stroke();
  }
  return textureFromCanvas(c, 2, 2);
}

function makeScreenTexture() {
  const c = makeCanvas(256, 128, '#03242b');
  const ctx = c.getContext('2d');
  for (let y = 0; y < 128; y += 6) {
    ctx.fillStyle = 'rgba(140,245,255,0.14)';
    ctx.fillRect(0, y, 256, 1);
  }
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = i % 3 ? 'rgba(140,245,255,0.45)' : 'rgba(255,180,100,0.45)';
    ctx.fillRect(Math.random() * 230, Math.random() * 100, 8 + Math.random() * 28, 2 + Math.random() * 5);
  }
  return textureFromCanvas(c, 1, 1);
}

function makeCanvas(w, h, fill) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, w, h);
  return c;
}

function textureFromCanvas(c, rx, ry) {
  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(rx, ry);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function hexToRgb(hex) {
  const value = parseInt(hex.replace('#', ''), 16);
  return `${(value >> 16) & 255},${(value >> 8) & 255},${value & 255}`;
}

function seededRange(seed, min, max) {
  const x = Math.sin(seed * 999.17) * 43758.5453123;
  return min + (x - Math.floor(x)) * (max - min);
}

function resize() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

wakeButton.addEventListener('click', () => {
  running = true;
  wakePanel.style.display = 'none';
  log.textContent = 'TEXTURED COCKPIT ONLINE: infinite survey terrain streaming.';
});

window.addEventListener('resize', resize);
setupStick(moveStick, touch.move, true);
setupStick(lookStick, touch.look, false);
updateHud();
requestAnimationFrame(render);
