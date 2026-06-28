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
let scanTarget = null;
let scanHold = 0;

const input = {
  move: { id: null, x: 0, y: 0 },
  look: { id: null, x: 0, y: 0 },
  throttle: 0,
  strafe: 0,
  steer: 0,
  turnRate: 0
};

const rover = {
  yaw: 0,
  pos: new THREE.Vector3(0, 1.62, 0),
  vel: new THREE.Vector3(),
  speed: 0,
  gust: 0.4,
  bob: 0
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071018);
scene.fog = new THREE.FogExp2(0x7b604f, 0.0115);

const camera = new THREE.PerspectiveCamera(73, window.innerWidth / window.innerHeight, 0.1, 650);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

scene.add(new THREE.HemisphereLight(0xbfd8e0, 0x503929, 1.26));
const sunLight = new THREE.DirectionalLight(0xffb18a, 2.2);
sunLight.position.set(-40, 60, 28);
scene.add(sunLight);

const cabinBlue = new THREE.PointLight(0x8eeaff, 2.3, 18);
cabinBlue.position.set(0, 0.25, 0.2);
scene.add(cabinBlue);

const cabinWarm = new THREE.PointLight(0xffb36c, 1.1, 12);
cabinWarm.position.set(0, -0.75, -0.4);
scene.add(cabinWarm);

const textures = {
  dust: makeDustTexture(),
  armor: makePanelTexture('#101820', '#03090d', '#8bdfff'),
  leather: makeLeatherTexture('#1b120e', '#6f4a2e'),
  suede: makeLeatherTexture('#29231d', '#8a6547'),
  metal: makeMetalTexture(),
  glass: makeGlassTexture(),
  screen: makeScreenTexture(),
  quilt: makeQuiltTexture()
};

const mat = {
  ground: new THREE.MeshStandardMaterial({ color: 0x806653, roughness: 0.96, metalness: 0.02, map: textures.dust }),
  armor: new THREE.MeshStandardMaterial({ color: 0x10191f, roughness: 0.58, metalness: 0.55, map: textures.armor }),
  black: new THREE.MeshStandardMaterial({ color: 0x060a0d, roughness: 0.5, metalness: 0.45, map: textures.armor }),
  leather: new THREE.MeshStandardMaterial({ color: 0x17110e, roughness: 0.78, metalness: 0.05, map: textures.leather }),
  suede: new THREE.MeshStandardMaterial({ color: 0x29231d, roughness: 0.94, metalness: 0.02, map: textures.suede }),
  quilt: new THREE.MeshStandardMaterial({ color: 0x18120f, roughness: 0.86, metalness: 0.04, map: textures.quilt }),
  metal: new THREE.MeshStandardMaterial({ color: 0x9a7a51, roughness: 0.36, metalness: 0.84, map: textures.metal }),
  glass: new THREE.MeshStandardMaterial({ color: 0x9bdfff, transparent: true, opacity: 0.16, roughness: 0.12, metalness: 0.06, map: textures.glass, side: THREE.DoubleSide }),
  screen: new THREE.MeshBasicMaterial({ color: 0x95f2ff, map: textures.screen, transparent: true, opacity: 0.9 }),
  amber: new THREE.MeshBasicMaterial({ color: 0xffb36c, transparent: true, opacity: 0.78 }),
  red: new THREE.MeshBasicMaterial({ color: 0xff5f4f, transparent: true, opacity: 0.7 }),
  cyan: new THREE.MeshBasicMaterial({ color: 0x78eaff, transparent: true, opacity: 0.82 }),
  rockA: new THREE.MeshStandardMaterial({ color: 0x65584d, roughness: 0.92, metalness: 0.02, map: textures.dust }),
  rockB: new THREE.MeshStandardMaterial({ color: 0x403a34, roughness: 0.96, metalness: 0.01, map: textures.dust })
};

const terrainChunks = createTerrainChunks();
const rocks = createRocks();
const wind = createWind();
const targets = createTargets();
createSun();
createCockpit();

function createSun() {
  const sun = new THREE.Mesh(new THREE.SphereGeometry(12, 32, 16), new THREE.MeshBasicMaterial({ color: 0xff9b76, transparent: true, opacity: 0.85 }));
  sun.position.set(-80, 54, -180);
  scene.add(sun);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(32, 32, 16), new THREE.MeshBasicMaterial({ color: 0xff825f, transparent: true, opacity: 0.12 }));
  glow.position.copy(sun.position);
  scene.add(glow);
}

function createTerrainChunks() {
  const chunks = [];
  const size = 90;
  for (let gx = -1; gx <= 1; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
      const geo = new THREE.PlaneGeometry(size, size, 46, 46);
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
  return Math.sin(x * 0.055) * 0.7 + Math.cos(z * 0.042) * 0.9 + Math.sin((x + z) * 0.027) * 0.55;
}

function createRocks() {
  const list = [];
  for (let i = 0; i < 70; i++) {
    const h = seeded(i * 41, 0.8, 4.4);
    const r = seeded(i * 19, 0.8, 3.4);
    const geo = new THREE.CylinderGeometry(r * 0.55, r, h, 7 + (i % 3), 1);
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
    const x = rover.pos.x + seeded(s * 11 + Math.floor(rover.pos.z / 90), -110, 110);
    const z = rover.pos.z + seeded(s * 17 + Math.floor(rover.pos.x / 90), -175, 105);
    rock.position.set(x, terrainHeight(x, z) + rock.userData.h / 2 - 0.35, z);
    rock.rotation.y = seeded(s * 13 + Math.floor(z), 0, Math.PI);
    rock.scale.set(seeded(s * 7, 0.75, 1.45), 1, seeded(s * 23, 0.65, 1.35));
  }
}

function createCockpit() {
  const cockpit = new THREE.Group();
  cockpit.name = 'cockpit';
  camera.add(cockpit);
  scene.add(camera);

  panoramicGlass(cockpit);
  roofAndLights(cockpit);
  dashboard(cockpit);
  commandYoke(cockpit);
  centralConsole(cockpit);
  seatsAndTrim(cockpit);
  sideSystemPanels(cockpit);
}

function panoramicGlass(c) {
  box(c, [0, 0.64, -3.64, 6.2, 3.2, 0.025, 0, 0, 0], mat.glass);

  box(c, [0, 2.25, -3.38, 6.85, 0.24, 0.38, 0, 0, 0], mat.black);
  box(c, [0, -0.92, -3.25, 6.55, 0.26, 0.42, 0, 0, 0], mat.black);
  box(c, [-3.25, 0.60, -3.22, 0.30, 3.35, 0.38, 0, 0, -0.10], mat.black);
  box(c, [3.25, 0.60, -3.22, 0.30, 3.35, 0.38, 0, 0, 0.10], mat.black);

  box(c, [-1.55, 0.62, -3.18, 0.18, 3.0, 0.24, 0, 0, -0.08], mat.black);
  box(c, [1.55, 0.62, -3.18, 0.18, 3.0, 0.24, 0, 0, 0.08], mat.black);

  for (let i = 0; i < 10; i++) {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.026, 12), mat.metal);
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(-3.0 + i * 0.66, -0.78, -3.0);
    c.add(bolt);
  }
}

function roofAndLights(c) {
  box(c, [0, 2.05, -1.05, 6.4, 0.30, 2.55, 0, 0, 0], mat.suede);
  box(c, [0, 1.74, -1.34, 1.42, 0.16, 0.76, 0, 0, 0], mat.black);

  for (const side of [-1, 1]) {
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 4; i++) {
        box(c, [side * (1.9 + i * 0.14), 1.72 - row * 0.07, -1.74, 0.09, 0.025, 0.06, 0, 0, 0], mat.amber);
      }
    }
  }

  for (let i = 0; i < 5; i++) box(c, [-0.42 + i * 0.21, 1.61, -1.34, 0.08, 0.04, 0.20, 0, 0, 0], i === 2 ? mat.red : mat.amber);
}

function dashboard(c) {
  box(c, [0, -0.70, -2.18, 6.65, 0.58, 1.12, -0.10, 0, 0], mat.leather);
  box(c, [0, -0.28, -2.47, 5.75, 0.24, 0.38, 0, 0, 0], mat.black);

  box(c, [0, -0.40, -2.09, 2.55, 0.78, 0.055, -0.07, 0, 0], mat.screen);
  box(c, [-2.28, -0.50, -2.01, 0.95, 0.72, 0.055, -0.07, 0.14, 0], mat.screen);
  box(c, [2.28, -0.50, -2.01, 0.95, 0.72, 0.055, -0.07, -0.14, 0], mat.screen);

  for (let i = 0; i < 12; i++) box(c, [-0.55 + i * 0.10, -0.85, -1.50, 0.06, 0.13, 0.07, 0, 0, 0], mat.black);
  for (let i = 0; i < 9; i++) box(c, [-2.12 + i * 0.53, -1.03, -1.55, 0.15, 0.018, 0.018, 0, 0, 0], i % 3 === 0 ? mat.amber : mat.screen);
}

function commandYoke(c) {
  const y = new THREE.Group();
  y.name = 'steeringYoke';
  y.position.set(-1.18, -0.78, -1.03);
  y.rotation.x = -0.18;
  c.add(y);

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.14, 0.70, 16), mat.black);
  column.rotation.x = Math.PI / 2;
  column.position.set(0, -0.06, 0.30);
  y.add(column);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 22), mat.metal);
  hub.rotation.x = Math.PI / 2;
  hub.position.set(0, 0, -0.13);
  y.add(hub);

  box(y, [-0.52, 0, -0.13, 0.86, 0.16, 0.15, 0, 0, -0.20], mat.leather);
  box(y, [0.52, 0, -0.13, 0.86, 0.16, 0.15, 0, 0, 0.20], mat.leather);
  box(y, [0, 0.20, -0.13, 1.08, 0.10, 0.12, 0, 0, 0], mat.black);
  box(y, [-0.72, 0.05, -0.02, 0.11, 0.06, 0.035, 0, 0, 0], mat.red);
  box(y, [0.72, 0.05, -0.02, 0.11, 0.06, 0.035, 0, 0, 0], mat.red);

  for (let i = 0; i < 5; i++) {
    box(y, [-0.40 + i * 0.20, -0.19, -0.02, 0.07, 0.035, 0.025, 0, 0, 0], i % 2 ? mat.screen : mat.amber);
  }
}

function centralConsole(c) {
  const con = new THREE.Group();
  con.position.set(0, -1.07, -0.38);
  con.rotation.x = -0.15;
  c.add(con);

  box(con, [0, 0.0, 0, 1.34, 0.40, 1.85, 0, 0, 0], mat.leather);
  box(con, [0, 0.27, -0.36, 1.05, 0.055, 0.82, 0, 0, 0], mat.screen);
  box(con, [0, 0.23, 0.24, 1.18, 0.06, 0.80, 0, 0, 0], mat.black);
  box(con, [0, -0.02, 0.96, 1.22, 0.27, 0.75, 0, 0, 0], mat.suede);

  const shifter = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, 0.46, 16), mat.metal);
  shifter.position.set(0.34, 0.50, 0.24);
  shifter.rotation.z = -0.20;
  con.add(shifter);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10), mat.leather);
  knob.position.set(0.39, 0.72, 0.20);
  con.add(knob);

  for (let i = 0; i < 8; i++) {
    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.025, 12), i % 2 ? mat.screen : mat.amber);
    button.position.set(-0.46 + (i % 4) * 0.15, 0.31, 0.40 + Math.floor(i / 4) * 0.16);
    con.add(button);
  }

  const dialA = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 24), mat.metal);
  dialA.position.set(0.48, 0.32, 0.62);
  con.add(dialA);
  const dialB = dialA.clone();
  dialB.position.set(0.18, 0.32, 0.62);
  con.add(dialB);
}

function seatsAndTrim(c) {
  seat(c, -2.05, -1.02, -0.22, 0.28);
  seat(c, 2.05, -1.02, -0.22, -0.28);
  box(c, [0, -1.48, -0.10, 5.9, 0.11, 3.05, 0, 0, 0], mat.black);
  for (let i = 0; i < 8; i++) box(c, [-1.75 + i * 0.50, -1.39, -0.08, 0.025, 0.016, 2.5, 0, 0, 0], mat.amber);
}

function seat(c, x, y, z, rot) {
  const s = new THREE.Group();
  s.position.set(x, y, z);
  s.rotation.y = rot;
  c.add(s);
  box(s, [0, -0.18, 0.05, 1.15, 0.34, 1.0, 0, 0, 0], mat.leather);
  box(s, [0, 0.02, -0.02, 0.93, 0.13, 0.76, 0, 0, 0], mat.quilt);
  box(s, [0, 0.62, 0.48, 1.08, 1.22, 0.22, -0.18, 0, 0], mat.leather);
  box(s, [0, 0.62, 0.34, 0.66, 0.96, 0.04, -0.18, 0, 0], mat.quilt);
  box(s, [0, 1.33, 0.30, 0.72, 0.30, 0.22, -0.12, 0, 0], mat.leather);
  box(s, [-0.56, 0.55, 0.34, 0.16, 1.02, 0.24, -0.18, 0, 0], mat.leather);
  box(s, [0.56, 0.55, 0.34, 0.16, 1.02, 0.24, -0.18, 0, 0], mat.leather);
  for (let i = 0; i < 4; i++) box(s, [-0.27 + i * 0.18, 0.60, 0.31, 0.025, 0.90, 0.014, -0.18, 0, 0], mat.metal);
}

function sideSystemPanels(c) {
  box(c, [-3.08, -0.58, -0.78, 0.48, 0.92, 2.1, 0, -0.10, 0], mat.leather);
  box(c, [3.08, -0.58, -0.78, 0.48, 0.92, 2.1, 0, 0.10, 0], mat.leather);
  box(c, [-2.95, -0.44, -1.25, 0.04, 0.52, 0.78, 0, 0.23, 0], mat.screen);
  box(c, [2.95, -0.44, -1.25, 0.04, 0.52, 0.78, 0, -0.23, 0], mat.screen);
  box(c, [-2.78, -0.32, -1.30, 0.08, 0.08, 1.72, 0, 0, 0], mat.metal);
  box(c, [2.78, -0.32, -1.30, 0.08, 0.08, 1.72, 0, 0, 0], mat.metal);
}

function box(group, p, material) {
  const [x, y, z, sx, sy, sz, rx, ry, rz] = p;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  group.add(mesh);
  return mesh;
}

function createWind() {
  const geo = new THREE.BufferGeometry();
  const count = 980;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = seeded(i * 3, -90, 90);
    positions[i * 3 + 1] = seeded(i * 5, 0.4, 22);
    positions[i * 3 + 2] = seeded(i * 7, -190, 45);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xd8eef3, size: 0.045, transparent: true, opacity: 0.45, depthWrite: false }));
  scene.add(points);
  return points;
}

function createTargets() {
  const list = [];
  for (let i = 0; i < 8; i++) {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 10), mat.cyan));
    group.add(new THREE.Mesh(new THREE.SphereGeometry(1.25, 16, 10), new THREE.MeshBasicMaterial({ color: 0x78eaff, transparent: true, opacity: 0.11 })));
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 1.2, 8), mat.metal);
    stem.position.y = -0.65;
    group.add(stem);
    group.userData = { seed: i, label: label(i), scanned: false };
    scene.add(group);
    list.push(group);
  }
  recycleTargets(list);
  return list;
}

function recycleTargets(list) {
  for (const target of list) {
    const s = target.userData.seed;
    const x = rover.pos.x + seeded(s * 31 + Math.floor(rover.pos.z / 120), -80, 80);
    const z = rover.pos.z + seeded(s * 53 + Math.floor(rover.pos.x / 120), -175, -35);
    target.position.set(x, terrainHeight(x, z) + 1.35, z);
    target.userData.scanned = false;
    target.userData.label = label(Math.abs(Math.floor(x + z + s)));
  }
}

function update(dt, t) {
  input.throttle += (curve(input.move.y) - input.throttle) * Math.min(1, dt * 4.4);
  input.strafe += (curve(input.move.x) - input.strafe) * Math.min(1, dt * 4.2);
  input.steer += (curve(input.look.x) - input.steer) * Math.min(1, dt * 5.8);
  input.turnRate += (input.steer * 2.05 - input.turnRate) * Math.min(1, dt * 4.8);
  rover.yaw -= input.turnRate * dt;

  const forward = new THREE.Vector3(Math.sin(rover.yaw), 0, Math.cos(rover.yaw));
  const side = new THREE.Vector3(Math.cos(rover.yaw), 0, -Math.sin(rover.yaw));
  const desired = forward.multiplyScalar(-input.throttle * 15.5).add(side.multiplyScalar(input.strafe * 8.5));
  rover.vel.lerp(desired, Math.min(1, dt * 2.9));
  rover.pos.addScaledVector(rover.vel, dt);
  rover.speed = rover.vel.length();

  updateInfiniteWorld();
  rover.bob = Math.sin(t * 3.8) * Math.min(0.045, rover.speed * 0.005) + Math.sin(rover.pos.x * 0.35 + rover.pos.z * 0.18) * 0.012;
  camera.position.set(rover.pos.x, 1.62 + rover.bob, rover.pos.z);
  camera.rotation.set(-0.07 + rover.bob * 0.35, rover.yaw, -input.steer * 0.018);

  const yoke = camera.getObjectByName('steeringYoke');
  if (yoke) yoke.rotation.z = -input.steer * 0.18;

  updateWind(dt, t);
  cabinBlue.intensity = 1.85 + Math.sin(t * 7) * 0.08;
  cabinWarm.intensity = 0.82 + Math.sin(t * 1.3) * 0.12;
  updateScans(dt, t);
  updateHud();
}

function updateInfiniteWorld() {
  const size = 90;
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
  rover.gust = 0.45 + Math.sin(t * 0.7) * 0.25 + Math.sin(t * 2.1) * 0.08;
  const pos = wind.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i) + dt * (12 + rover.gust * 18);
    let z = pos.getZ(i) + dt * (2 + rover.gust * 4);
    if (x > rover.pos.x + 95) x = rover.pos.x - 95;
    if (z > rover.pos.z + 55) z = rover.pos.z - 195;
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
    if (scanTarget !== best) {
      scanTarget = best;
      scanHold = 0;
    }
    scanHold += dt;
    if (scanHold >= 1.05) {
      best.userData.scanned = true;
      scannedCount++;
      log.textContent = `SCAN COMPLETE: ${best.userData.label}. Infinite grid sample archived.`;
      scanHold = 0;
      scanTarget = null;
    } else {
      log.textContent = `SCANNING: ${best.userData.label}`;
    }
  } else {
    scanTarget = null;
    scanHold = Math.max(0, scanHold - dt * 2);
  }
}

function updateHud() {
  const seal = Math.round(89 + Math.sin(performance.now() * 0.0017) * 2 - rover.gust * 2);
  const signal = Math.max(18, Math.round(48 + Math.sin(rover.pos.x * 0.05) * 8 - rover.gust * 5));
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

function curve(v) {
  const s = Math.sign(v);
  const a = Math.abs(v);
  if (a < 0.03) return 0;
  return s * Math.pow(a, 1.35);
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

function makePanelTexture(a, b, line) {
  const c = baseCanvas(256, 128, a);
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 256, 128);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 128);
  for (let y = 12; y < 128; y += 18) {
    x.strokeStyle = 'rgba(255,255,255,0.045)';
    x.beginPath();
    x.moveTo(0, y);
    x.lineTo(256, y + Math.sin(y) * 3);
    x.stroke();
  }
  const rgb = hexToRgb(line);
  for (let i = 0; i < 260; i++) {
    x.fillStyle = `rgba(${rgb},${0.025 + Math.random() * 0.05})`;
    x.fillRect(Math.random() * 256, Math.random() * 128, Math.random() * 5, 1);
  }
  return textureFrom(c, 2, 2);
}

function makeLeatherTexture(base, stitch) {
  const c = baseCanvas(256, 256, base);
  const x = c.getContext('2d');
  for (let i = 0; i < 6000; i++) {
    const v = 18 + Math.random() * 48;
    x.fillStyle = `rgba(${v + 16}, ${v + 10}, ${v + 5}, ${0.045 + Math.random() * 0.08})`;
    x.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1);
  }
  for (let i = 0; i < 34; i++) {
    x.strokeStyle = `${stitch}55`;
    x.beginPath();
    const px = Math.random() * 256;
    x.moveTo(px, 0);
    x.lineTo(px + Math.random() * 16 - 8, 256);
    x.stroke();
  }
  return textureFrom(c, 2, 2);
}

function makeQuiltTexture() {
  const c = baseCanvas(256, 256, '#18120f');
  const x = c.getContext('2d');
  for (let i = -256; i < 512; i += 32) {
    x.strokeStyle = 'rgba(185,135,86,0.26)';
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i + 256, 256);
    x.stroke();
    x.beginPath();
    x.moveTo(i + 256, 0);
    x.lineTo(i, 256);
    x.stroke();
  }
  for (let i = 0; i < 4500; i++) {
    const v = 18 + Math.random() * 45;
    x.fillStyle = `rgba(${v + 14}, ${v + 9}, ${v + 5}, ${0.04 + Math.random() * 0.08})`;
    x.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1);
  }
  return textureFrom(c, 2, 2);
}

function makeMetalTexture() {
  const c = baseCanvas(256, 128, '#8d714e');
  const x = c.getContext('2d');
  for (let y = 0; y < 128; y++) {
    const v = 120 + Math.random() * 60;
    x.strokeStyle = `rgba(${v + 20},${v},${v - 40},0.18)`;
    x.beginPath();
    x.moveTo(0, y);
    x.lineTo(256, y + Math.random() * 2 - 1);
    x.stroke();
  }
  return textureFrom(c, 3, 2);
}

function makeGlassTexture() {
  const c = baseCanvas(256, 256, 'rgba(0,0,0,0)');
  const x = c.getContext('2d');
  for (let i = 0; i < 55; i++) {
    x.strokeStyle = `rgba(220,245,255,${0.04 + Math.random() * 0.08})`;
    x.beginPath();
    const px = Math.random() * 256;
    const py = Math.random() * 256;
    x.moveTo(px, py);
    x.lineTo(px + Math.random() * 90 - 30, py + Math.random() * 14 - 7);
    x.stroke();
  }
  return textureFrom(c, 2, 2);
}

function makeScreenTexture() {
  const c = baseCanvas(256, 128, '#03242b');
  const x = c.getContext('2d');
  for (let y = 0; y < 128; y += 6) {
    x.fillStyle = 'rgba(140,245,255,0.14)';
    x.fillRect(0, y, 256, 1);
  }
  for (let i = 0; i < 30; i++) {
    x.fillStyle = i % 3 ? 'rgba(140,245,255,0.45)' : 'rgba(255,180,100,0.45)';
    x.fillRect(Math.random() * 230, Math.random() * 100, 8 + Math.random() * 28, 2 + Math.random() * 5);
  }
  return textureFrom(c, 1, 1);
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

function hexToRgb(hex) {
  const value = parseInt(hex.replace('#', ''), 16);
  return `${(value >> 16) & 255},${(value >> 8) & 255},${value & 255}`;
}

function seeded(seed, min, max) {
  const x = Math.sin(seed * 999.17) * 43758.5453123;
  return min + (x - Math.floor(x)) * (max - min);
}

function label(i) {
  return ['blue-white mineral bloom', 'pressure mast wreckage', 'ice-salt seep', 'basalt rib formation', 'navigation pylon', 'wind-polished ridge'][i % 6];
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
  log.textContent = 'REFERENCE COCKPIT ONLINE: panoramic cabin, console, yoke, and seats active.';
});

window.addEventListener('resize', resize);
setupStick(moveStick, input.move, true);
setupStick(lookStick, input.look, false);
updateHud();
requestAnimationFrame(render);
