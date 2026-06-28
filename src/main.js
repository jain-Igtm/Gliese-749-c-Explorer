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

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 520);
camera.position.copy(world.position);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const hemi = new THREE.HemisphereLight(0xaec7d0, 0x4b362b, 1.35);
scene.add(hemi);

const star = new THREE.DirectionalLight(0xffb18a, 2.4);
star.position.set(-40, 60, 26);
scene.add(star);

const cabinLight = new THREE.PointLight(0x8eeaff, 1.3, 16);
cabinLight.position.set(0, 2.2, 4.6);
scene.add(cabinLight);

const materials = {
  ground: new THREE.MeshStandardMaterial({ color: 0x7b6250, roughness: 0.94, metalness: 0.02, map: makeDustTexture() }),
  darkGround: new THREE.MeshStandardMaterial({ color: 0x4e463d, roughness: 1, metalness: 0.02 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x9bdfff, transparent: true, opacity: 0.15, roughness: 0.25, metalness: 0.05, side: THREE.DoubleSide }),
  frame: new THREE.MeshStandardMaterial({ color: 0x071217, roughness: 0.72, metalness: 0.34, map: makePanelTexture() }),
  glow: new THREE.MeshBasicMaterial({ color: 0x7eeaff, transparent: true, opacity: 0.78 }),
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

  const dash = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.9, 1.6), materials.frame);
  dash.position.set(0, -1.05, -2.6);
  dash.rotation.x = -0.09;
  cockpit.add(dash);

  const lowerPanel = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.55, 0.18), materials.frame);
  lowerPanel.position.set(0, -0.62, -2.95);
  cockpit.add(lowerPanel);

  const glass = new THREE.Mesh(new THREE.PlaneGeometry(5.7, 3.7), materials.glass);
  glass.position.set(0, 0.26, -3.25);
  cockpit.add(glass);

  const top = new THREE.Mesh(new THREE.BoxGeometry(6.25, 0.24, 0.22), materials.frame);
  top.position.set(0, 2.12, -3.18);
  cockpit.add(top);

  const left = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.7, 0.24), materials.frame);
  left.position.set(-3.05, 0.25, -3.12);
  left.rotation.z = -0.08;
  cockpit.add(left);

  const right = left.clone();
  right.position.x = 3.05;
  right.rotation.z = 0.08;
  cockpit.add(right);

  const bottom = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.26, 0.24), materials.frame);
  bottom.position.set(0, -1.58, -3.14);
  cockpit.add(bottom);

  const centerConsole = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.42, 0.55), materials.frame);
  centerConsole.position.set(0, -0.96, -2.0);
  centerConsole.rotation.x = -0.2;
  cockpit.add(centerConsole);

  const labels = [ [-0.72, 'ATM'], [0, 'WND'], [0.72, 'MAP'] ];
  for (const [x] of labels) {
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.28, 0.04), materials.glow);
    screen.position.set(x, -0.92, -1.69);
    cockpit.add(screen);
  }

  for (let i = 0; i < 18; i++) {
    const scratch = new THREE.Mesh(new THREE.PlaneGeometry(seededRange(i, 0.35, 1.4), 0.012), new THREE.MeshBasicMaterial({ color: 0xdaf7ff, transparent: true, opacity: seededRange(i * 9, 0.05, 0.14), side: THREE.DoubleSide }));
    scratch.position.set(seededRange(i * 4, -2.4, 2.4), seededRange(i * 12, -0.9, 1.65), -3.235);
    scratch.rotation.z = seededRange(i * 5, -0.16, 0.08);
    cockpit.add(scratch);
  }
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
  const forward = touch.move.y;
  const strafe = touch.move.x;
  world.yaw -= touch.look.x * dt * 2.25;

  const dir = new THREE.Vector3(Math.sin(world.yaw), 0, Math.cos(world.yaw));
  const side = new THREE.Vector3(Math.cos(world.yaw), 0, -Math.sin(world.yaw));
  world.velocity.copy(dir.multiplyScalar(-forward)).add(side.multiplyScalar(strafe)).multiplyScalar(16 * dt);
  world.position.add(world.velocity);
  world.position.x = THREE.MathUtils.clamp(world.position.x, -92, 92);
  world.position.z = THREE.MathUtils.clamp(world.position.z, -210, 18);

  const bob = Math.sin(t * 4.2) * Math.min(0.045, world.velocity.length() * 0.09);
  camera.position.set(world.position.x, 1.55 + bob, world.position.z);
  camera.rotation.set(-0.03 + bob * 0.2, world.yaw, 0);

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

  cabinLight.intensity = 1.1 + Math.sin(t * 7) * 0.08;
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
  };

  element.addEventListener('pointerdown', event => {
    state.id = event.pointerId;
    element.setPointerCapture(event.pointerId);
  });

  element.addEventListener('pointermove', event => {
    if (state.id !== event.pointerId) return;
    const rect = element.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = event.clientX - cx;
    const dy = event.clientY - cy;
    const max = Math.min(38, rect.width * 0.34);
    const len = Math.hypot(dx, dy);
    const scale = len > max ? max / len : 1;
    const nx = dx * scale;
    const ny = dy * scale;
    nub.style.transform = `translate(${nx}px, ${ny}px)`;
    state.x = nx / max;
    state.y = movementStick ? -ny / max : 0;
  });

  element.addEventListener('pointerup', reset);
  element.addEventListener('pointercancel', reset);
  element.addEventListener('lostpointercapture', reset);
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
  log.textContent = '3D BUILD ONLINE: hold the reticle over glowing survey returns to scan.';
});

window.addEventListener('resize', resize);
setupStick(moveStick, touch.move, true);
setupStick(lookStick, touch.look, false);
updateHud();
requestAnimationFrame(render);
