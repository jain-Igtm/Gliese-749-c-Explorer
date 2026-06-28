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
  speed: 0,
  turnRate: 0,
  suspension: 0,
  comfortGlow: 0
};

const world = {
  yaw: 0,
  position: new THREE.Vector3(0, 1.4, 10),
  velocity: new THREE.Vector3(),
  windPhase: 0,
  gust: 0.5
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071018);
scene.fog = new THREE.FogExp2(0x8b6b59, 0.012);

const camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.1, 520);
camera.position.copy(world.position);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const hemi = new THREE.HemisphereLight(0xaec7d0, 0x4b362b, 1.25);
scene.add(hemi);

const star = new THREE.DirectionalLight(0xffb18a, 2.2);
star.position.set(-40, 60, 26);
scene.add(star);

const cabinLight = new THREE.PointLight(0x8eeaff, 1.8, 18);
cabinLight.position.set(0, 1.0, 1.2);
scene.add(cabinLight);

const warmTrimLight = new THREE.PointLight(0xffb36c, 0.85, 9);
warmTrimLight.position.set(0, -0.6, 0.3);
scene.add(warmTrimLight);

const materials = {
  ground: new THREE.MeshStandardMaterial({ color: 0x7b6250, roughness: 0.94, metalness: 0.02, map: makeDustTexture() }),
  darkGround: new THREE.MeshStandardMaterial({ color: 0x4e463d, roughness: 1, metalness: 0.02 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x9bdfff, transparent: true, opacity: 0.18, roughness: 0.18, metalness: 0.05, side: THREE.DoubleSide }),
  frame: new THREE.MeshStandardMaterial({ color: 0x071217, roughness: 0.68, metalness: 0.42, map: makePanelTexture() }),
  armor: new THREE.MeshStandardMaterial({ color: 0x111a1f, roughness: 0.62, metalness: 0.55, map: makePanelTexture() }),
  leather: new THREE.MeshStandardMaterial({ color: 0x16120f, roughness: 0.78, metalness: 0.06, map: makeLeatherTexture() }),
  suede: new THREE.MeshStandardMaterial({ color: 0x24201c, roughness: 0.92, metalness: 0.01, map: makeLeatherTexture() }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb8864a, roughness: 0.34, metalness: 0.78 }),
  glow: new THREE.MeshBasicMaterial({ color: 0x7eeaff, transparent: true, opacity: 0.84 }),
  amberGlow: new THREE.MeshBasicMaterial({ color: 0xffb36c, transparent: true, opacity: 0.68 }),
  redGlow: new THREE.MeshBasicMaterial({ color: 0xff5f4f, transparent: true, opacity: 0.62 }),
  rockA: new THREE.MeshStandardMaterial({ color: 0x65584d, roughness: 0.9, metalness: 0.02 }),
  rockB: new THREE.MeshStandardMaterial({ color: 0x3e3b36, roughness: 0.95, metalness: 0.01 })
};

buildPlanetSurface();
buildCockpit();
buildWind();
const scanTargets = buildScanTargets();

function buildPlanetSurface() {
  const groundGeo = new THREE.PlaneGeometry(420, 420, 90, 90);
  groundGeo.rotateX(-Math.PI / 2);
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = Math.sin(x * 0.055) * 0.7 + Math.cos(z * 0.042) * 0.9 + Math.sin((x + z) * 0.027) * 0.55;
    pos.setY(i, y);
  }
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, materials.ground);
  ground.position.z = -115;
  scene.add(ground);

  for (let i = 0; i < 64; i++) {
    const group = new THREE.Group();
    const x = seededRange(i, -110, 110);
    const z = seededRange(i * 17, -230, -18);
    const height = seededRange(i * 41, 1.1, 5.6);
    const radius = seededRange(i * 19, 1.2, 4.6);
    const geo = new THREE.CylinderGeometry(radius * 0.55, radius, height, 7 + (i % 3), 1);
    const rock = new THREE.Mesh(geo, i % 2 ? materials.rockA : materials.rockB);
    rock.position.set(x, height / 2 - 0.2, z);
    rock.rotation.y = seededRange(i * 13, 0, Math.PI);
    rock.scale.x = seededRange(i * 7, 0.7, 1.45);
    rock.scale.z = seededRange(i * 23, 0.65, 1.35);
    group.add(rock);

    if (i % 6 === 0) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.55, 8, 5), materials.darkGround);
      cap.position.set(x + radius * 0.08, height + 0.1, z);
      cap.scale.y = 0.22;
      group.add(cap);
    }
    scene.add(group);
  }

  for (let i = 0; i < 9; i++) {
    const ridgeGeo = new THREE.BoxGeometry(52, 6 + i * 0.4, 6);
    const ridge = new THREE.Mesh(ridgeGeo, i % 2 ? materials.rockA : materials.rockB);
    ridge.position.set(-145 + i * 38, 1.8, -245 - (i % 3) * 15);
    ridge.rotation.y = 0.22 + i * 0.08;
    ridge.rotation.z = seededRange(i, -0.08, 0.08);
    scene.add(ridge);
  }

  const starDisk = new THREE.Mesh(new THREE.SphereGeometry(11, 32, 16), new THREE.MeshBasicMaterial({ color: 0xff9b76, transparent: true, opacity: 0.86 }));
  starDisk.position.set(-80, 54, -180);
  scene.add(starDisk);

  const starGlow = new THREE.Mesh(new THREE.SphereGeometry(28, 32, 16), new THREE.MeshBasicMaterial({ color: 0xff825f, transparent: true, opacity: 0.12 }));
  starGlow.position.copy(starDisk.position);
  scene.add(starGlow);
}

function buildCockpit() {
  const cockpit = new THREE.Group();
  cockpit.name = 'cockpit';
  camera.add(cockpit);
  scene.add(camera);

  addLuxurySeat(cockpit, -1.72, -0.92, -0.55, 0.18);
  addLuxurySeat(cockpit, 1.72, -0.92, -0.55, -0.18);
  addArmoredWindshield(cockpit);
  addDashboard(cockpit);
  addYoke(cockpit);
  addCenterConsole(cockpit);
  addDoorAndBolsters(cockpit);
  addCabinDetails(cockpit);
}

function addArmoredWindshield(cockpit) {
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(5.85, 3.62), materials.glass);
  glass.position.set(0, 0.30, -3.28);
  cockpit.add(glass);

  const framePieces = [
    [0, 2.14, -3.16, 6.35, 0.28, 0.28, 0, 0, 0],
    [0, -1.55, -3.13, 6.05, 0.32, 0.28, 0, 0, 0],
    [-3.02, 0.28, -3.12, 0.30, 3.74, 0.30, 0, 0, -0.08],
    [3.02, 0.28, -3.12, 0.30, 3.74, 0.30, 0, 0, 0.08],
    [0, 0.27, -3.10, 0.18, 3.55, 0.24, 0, 0, 0]
  ];

  for (const p of framePieces) addBox(cockpit, p, materials.armor, 0.06);

  for (let i = 0; i < 4; i++) {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.025, 12), materials.brass);
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(-2.45 + i * 1.63, -1.35, -2.965);
    cockpit.add(bolt);
  }

  for (let i = 0; i < 20; i++) {
    const scratch = new THREE.Mesh(new THREE.PlaneGeometry(seededRange(i, 0.35, 1.25), 0.012), new THREE.MeshBasicMaterial({ color: 0xdaf7ff, transparent: true, opacity: seededRange(i * 9, 0.04, 0.12), side: THREE.DoubleSide }));
    scratch.position.set(seededRange(i * 4, -2.45, 2.45), seededRange(i * 12, -0.92, 1.70), -3.245);
    scratch.rotation.z = seededRange(i * 5, -0.17, 0.09);
    cockpit.add(scratch);
  }
}

function addDashboard(cockpit) {
  const upperDash = new THREE.Mesh(new THREE.BoxGeometry(6.65, 0.72, 1.25), materials.leather);
  upperDash.position.set(0, -0.96, -2.46);
  upperDash.rotation.x = -0.11;
  cockpit.add(upperDash);

  const armoredBrow = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.30, 0.45), materials.armor);
  armoredBrow.position.set(0, -0.48, -2.76);
  cockpit.add(armoredBrow);

  const panoScreen = new THREE.Mesh(new THREE.BoxGeometry(3.65, 0.48, 0.055), materials.glow);
  panoScreen.position.set(0, -0.56, -2.50);
  panoScreen.rotation.x = -0.08;
  cockpit.add(panoScreen);

  const screenBack = new THREE.Mesh(new THREE.BoxGeometry(3.82, 0.60, 0.07), materials.frame);
  screenBack.position.set(0, -0.56, -2.54);
  screenBack.rotation.x = -0.08;
  cockpit.add(screenBack);

  const sideScreens = [ [-2.18, -0.60, -2.36], [2.18, -0.60, -2.36] ];
  for (const [x, y, z] of sideScreens) {
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.42, 0.06), materials.amberGlow);
    screen.position.set(x, y, z);
    screen.rotation.y = x < 0 ? 0.14 : -0.14;
    cockpit.add(screen);
  }

  const ventMat = new THREE.MeshStandardMaterial({ color: 0x03070a, roughness: 0.5, metalness: 0.7 });
  for (let i = 0; i < 7; i++) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.08), ventMat);
    vent.position.set(-0.42 + i * 0.14, -0.90, -1.87);
    cockpit.add(vent);
  }

  for (let i = 0; i < 9; i++) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.018, 0.018), i % 3 === 0 ? materials.amberGlow : materials.glow);
    light.position.set(-2.15 + i * 0.54, -1.21, -1.78);
    cockpit.add(light);
  }
}

function addYoke(cockpit) {
  const yoke = new THREE.Group();
  yoke.name = 'steeringYoke';
  yoke.position.set(0, -0.98, -1.45);
  yoke.rotation.x = -0.18;
  cockpit.add(yoke);

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.13, 0.72, 16), materials.armor);
  column.rotation.x = Math.PI / 2;
  column.position.set(0, -0.05, 0.28);
  yoke.add(column);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 20), materials.frame);
  hub.rotation.z = Math.PI / 2;
  hub.position.set(0, 0, -0.12);
  yoke.add(hub);

  const leftGrip = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.18, 0.16), materials.leather);
  leftGrip.position.set(-0.50, 0, -0.13);
  leftGrip.rotation.z = -0.18;
  yoke.add(leftGrip);

  const rightGrip = leftGrip.clone();
  rightGrip.position.x = 0.50;
  rightGrip.rotation.z = 0.18;
  yoke.add(rightGrip);

  const topArc = new THREE.Mesh(new THREE.TorusGeometry(0.60, 0.035, 8, 28, Math.PI), materials.armor);
  topArc.position.set(0, 0.03, -0.13);
  topArc.rotation.z = Math.PI;
  yoke.add(topArc);

  const thumbLights = [ [-0.72, 0.04, -0.03], [0.72, 0.04, -0.03] ];
  for (const [x, y, z] of thumbLights) {
    const button = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.035), materials.redGlow);
    button.position.set(x, y, z);
    yoke.add(button);
  }
}

function addCenterConsole(cockpit) {
  const console = new THREE.Group();
  console.name = 'centerConsole';
  console.position.set(0, -1.18, -0.84);
  console.rotation.x = -0.15;
  cockpit.add(console);

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.42, 1.72), materials.leather);
  base.position.set(0, 0, 0);
  console.add(base);

  const topPlate = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.06, 1.42), materials.armor);
  topPlate.position.set(0, 0.25, -0.02);
  console.add(topPlate);

  const mainPad = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.035, 0.78), materials.glow);
  mainPad.position.set(0, 0.30, -0.24);
  console.add(mainPad);

  const shifter = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.44, 14), materials.brass);
  shifter.position.set(0.44, 0.50, 0.38);
  shifter.rotation.z = -0.22;
  console.add(shifter);

  const shifterTop = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 10), materials.leather);
  shifterTop.position.set(0.50, 0.72, 0.34);
  console.add(shifterTop);

  for (let i = 0; i < 6; i++) {
    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.025, 12), i % 2 ? materials.glow : materials.amberGlow);
    button.position.set(-0.46 + (i % 3) * 0.18, 0.32, 0.36 + Math.floor(i / 3) * 0.18);
    console.add(button);
  }

  const armRest = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.28, 0.76), materials.suede);
  armRest.position.set(0, -0.02, 1.02);
  console.add(armRest);
}

function addLuxurySeat(cockpit, x, y, z, rot) {
  const seat = new THREE.Group();
  seat.position.set(x, y, z);
  seat.rotation.y = rot;
  cockpit.add(seat);

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.38, 1.05), materials.leather);
  base.position.set(0, -0.18, 0.08);
  seat.add(base);

  const cushion = new THREE.Mesh(new THREE.BoxGeometry(1.03, 0.16, 0.86), materials.suede);
  cushion.position.set(0, 0.03, 0.02);
  seat.add(cushion);

  const back = new THREE.Mesh(new THREE.BoxGeometry(1.14, 1.34, 0.22), materials.leather);
  back.position.set(0, 0.62, 0.48);
  back.rotation.x = -0.18;
  seat.add(back);

  const centerInsert = new THREE.Mesh(new THREE.BoxGeometry(0.70, 1.05, 0.04), materials.suede);
  centerInsert.position.set(0, 0.64, 0.345);
  centerInsert.rotation.x = -0.18;
  seat.add(centerInsert);

  const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.34, 0.24), materials.leather);
  headrest.position.set(0, 1.43, 0.30);
  headrest.rotation.x = -0.12;
  seat.add(headrest);

  const leftBolster = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.18, 0.28), materials.leather);
  leftBolster.position.set(-0.58, 0.58, 0.33);
  leftBolster.rotation.x = -0.18;
  seat.add(leftBolster);

  const rightBolster = leftBolster.clone();
  rightBolster.position.x = 0.58;
  seat.add(rightBolster);

  for (let i = 0; i < 4; i++) {
    const stitch = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.02, 0.012), materials.brass);
    stitch.position.set(-0.27 + i * 0.18, 0.60, 0.315);
    stitch.rotation.x = -0.18;
    seat.add(stitch);
  }
}

function addDoorAndBolsters(cockpit) {
  const leftDoor = new THREE.Mesh(new THREE.BoxGeometry(0.58, 1.1, 2.2), materials.leather);
  leftDoor.position.set(-3.02, -0.78, -0.92);
  leftDoor.rotation.y = -0.10;
  cockpit.add(leftDoor);

  const rightDoor = leftDoor.clone();
  rightDoor.position.x = 3.02;
  rightDoor.rotation.y = 0.10;
  cockpit.add(rightDoor);

  const railMat = materials.brass;
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.92), railMat);
    rail.position.set(side * 2.82, -0.42, -0.95);
    cockpit.add(rail);

    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 8, 24), materials.armor);
    handle.position.set(side * 2.66, -0.54, -1.38);
    handle.rotation.y = Math.PI / 2;
    cockpit.add(handle);
  }
}

function addCabinDetails(cockpit) {
  const roof = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.30, 2.4), materials.suede);
  roof.position.set(0, 2.05, -1.15);
  cockpit.add(roof);

  const roofConsole = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.18, 0.75), materials.armor);
  roofConsole.position.set(0, 1.78, -1.40);
  cockpit.add(roofConsole);

  for (let i = 0; i < 5; i++) {
    const toggle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.22), i === 2 ? materials.redGlow : materials.amberGlow);
    toggle.position.set(-0.42 + i * 0.21, 1.66, -1.38);
    cockpit.add(toggle);
  }

  const floor = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.12, 3.2), materials.frame);
  floor.position.set(0, -1.55, -0.35);
  cockpit.add(floor);

  for (let i = 0; i < 9; i++) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.018, 2.7), materials.amberGlow);
    strip.position.set(-2.0 + i * 0.50, -1.47, -0.28);
    cockpit.add(strip);
  }
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
  const count = 900;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = seededRange(i * 3, -80, 80);
    positions[i * 3 + 1] = seededRange(i * 5, 0.4, 22);
    positions[i * 3 + 2] = seededRange(i * 7, -180, 22);
  }
  windGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const windMat = new THREE.PointsMaterial({ color: 0xd8eef3, size: 0.045, transparent: true, opacity: 0.45, depthWrite: false });
  const windPoints = new THREE.Points(windGeo, windMat);
  windPoints.name = 'wind';
  scene.add(windPoints);
}

function buildScanTargets() {
  const data = [
    [-14, -36, 'blue-white mineral bloom'],
    [18, -58, 'pressure mast wreckage'],
    [-32, -82, 'ice-salt seep'],
    [44, -112, 'basalt rib formation'],
    [4, -146, 'navigation pylon'],
    [68, -184, 'wind-polished ridge']
  ];

  return data.map(([x, z, label], index) => {
    const group = new THREE.Group();
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 10), new THREE.MeshBasicMaterial({ color: 0x78eaff, transparent: true, opacity: 0.82 }));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.25, 16, 10), new THREE.MeshBasicMaterial({ color: 0x78eaff, transparent: true, opacity: 0.11 }));
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0x8cefff, roughness: 0.45, metalness: 0.3 }));
    stem.position.y = -0.65;
    group.add(halo, orb, stem);
    group.position.set(x, 1.4, z);
    group.userData = { label, scanned: false, index };
    scene.add(group);
    return group;
  });
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
  const desiredVelocity = dir.multiplyScalar(-vehicle.throttle * 15.5).add(side.multiplyScalar(vehicle.strafe * 8.5));
  world.velocity.lerp(desiredVelocity, Math.min(1, dt * 2.9));
  world.position.addScaledVector(world.velocity, dt);
  world.position.x = THREE.MathUtils.clamp(world.position.x, -92, 92);
  world.position.z = THREE.MathUtils.clamp(world.position.z, -210, 18);
  vehicle.speed = world.velocity.length();

  vehicle.suspension = Math.sin(t * 3.8) * Math.min(0.045, vehicle.speed * 0.005) + Math.sin(world.position.x * 0.35 + world.position.z * 0.18) * 0.012;
  vehicle.comfortGlow = 0.5 + Math.sin(t * 1.3) * 0.5;

  camera.position.set(world.position.x, 1.55 + vehicle.suspension, world.position.z);
  camera.rotation.set(-0.035 + vehicle.suspension * 0.35, world.yaw, -vehicle.steering * 0.018);

  const yoke = camera.getObjectByName('steeringYoke');
  if (yoke) yoke.rotation.z = -vehicle.steering * 0.18;

  world.gust = 0.45 + Math.sin(t * 0.7) * 0.25 + Math.sin(t * 2.1) * 0.08;
  world.windPhase += dt * (7 + world.gust * 10);
  const wind = scene.getObjectByName('wind');
  const positions = wind.geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    let x = positions.getX(i) + dt * (12 + world.gust * 18);
    let z = positions.getZ(i) + dt * (2 + world.gust * 4);
    if (x > 90) x = -90;
    if (z > 28) z = -190;
    positions.setX(i, x);
    positions.setZ(i, z);
  }
  positions.needsUpdate = true;

  cabinLight.intensity = 1.55 + Math.sin(t * 7) * 0.08 + vehicle.comfortGlow * 0.18;
  warmTrimLight.intensity = 0.65 + vehicle.comfortGlow * 0.22;
  updateScans(dt, t);
  updateHud();
}

function updateScans(dt, t) {
  const center = new THREE.Vector2(0, 0);
  const projected = new THREE.Vector3();
  let best = null;
  let bestScore = 999;

  for (const target of scanTargets) {
    const scanned = target.userData.scanned;
    target.children[0].material.opacity = scanned ? 0.025 : 0.11 + Math.sin(t * 3 + target.userData.index) * 0.03;
    target.children[1].material.opacity = scanned ? 0.13 : 0.75 + Math.sin(t * 4 + target.userData.index) * 0.07;
    target.rotation.y += dt * 0.45;

    projected.copy(target.position).project(camera);
    const score = projected.distanceTo(new THREE.Vector3(center.x, center.y, projected.z));
    const distance = target.position.distanceTo(camera.position);
    if (!scanned && projected.z < 1 && distance < 95 && score < 0.13 && score < bestScore) {
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
      log.textContent = `SCAN COMPLETE: ${best.userData.label}. Local map confidence improved.`;
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
  const scanned = scanTargets.filter(target => target.userData.scanned).length;
  const seal = Math.round(89 + Math.sin(performance.now() * 0.0017) * 2 - world.gust * 2);
  const signal = Math.max(18, Math.round(48 - Math.abs(world.position.z) * 0.12 + Math.sin(world.position.x * 0.05) * 8));
  sealText.textContent = `${seal}%`;
  signalText.textContent = `${signal}%`;
  scanText.textContent = `${scanned} / ${scanTargets.length}`;
  sealFill.style.width = `${seal}%`;
  signalFill.style.width = `${signal}%`;
  scanFill.style.width = `${(scanned / scanTargets.length) * 100}%`;
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
    const dead = 0.13;
    let sx = nx / max;
    let sy = ny / max;
    if (Math.abs(sx) < dead) sx = 0;
    if (Math.abs(sy) < dead) sy = 0;
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
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 256;
  textureCanvas.height = 256;
  const c = textureCanvas.getContext('2d');
  c.fillStyle = '#806653';
  c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6000; i++) {
    const v = 80 + Math.random() * 70;
    c.fillStyle = `rgba(${v + 30}, ${v + 12}, ${v}, ${0.08 + Math.random() * 0.12})`;
    c.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1);
  }
  for (let i = 0; i < 60; i++) {
    c.strokeStyle = `rgba(255,230,205,${0.03 + Math.random() * 0.04})`;
    c.beginPath();
    const y = Math.random() * 256;
    c.moveTo(0, y);
    c.lineTo(256, y + Math.random() * 18 - 9);
    c.stroke();
  }
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(16, 16);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makePanelTexture() {
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 256;
  textureCanvas.height = 128;
  const c = textureCanvas.getContext('2d');
  const g = c.createLinearGradient(0, 0, 256, 128);
  g.addColorStop(0, '#17252c');
  g.addColorStop(1, '#03090d');
  c.fillStyle = g;
  c.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 220; i++) {
    c.fillStyle = `rgba(180,230,255,${0.025 + Math.random() * 0.05})`;
    c.fillRect(Math.random() * 256, Math.random() * 128, Math.random() * 5, 1);
  }
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeLeatherTexture() {
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 256;
  textureCanvas.height = 256;
  const c = textureCanvas.getContext('2d');
  c.fillStyle = '#1b1714';
  c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5200; i++) {
    const v = 18 + Math.random() * 48;
    c.fillStyle = `rgba(${v + 16}, ${v + 10}, ${v + 5}, ${0.045 + Math.random() * 0.08})`;
    c.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1);
  }
  for (let i = 0; i < 34; i++) {
    c.strokeStyle = `rgba(190,135,82,${0.035 + Math.random() * 0.045})`;
    c.beginPath();
    const x = Math.random() * 256;
    c.moveTo(x, 0);
    c.lineTo(x + Math.random() * 16 - 8, 256);
    c.stroke();
  }
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
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
  log.textContent = 'VEHICLE ONLINE: adaptive drive controls, armored cabin, luxury trim active.';
});

window.addEventListener('resize', resize);
setupStick(moveStick, touch.move, true);
setupStick(lookStick, touch.look, false);
updateHud();
requestAnimationFrame(render);
