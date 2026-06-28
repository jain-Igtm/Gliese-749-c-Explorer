import {
  makeNoiseTexture,
  makeCockpitTexture,
  makeGlassTexture,
  makeMineralTexture,
  patternFrom
} from './textures.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

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

let w = 0;
let h = 0;
let dpr = 1;
let running = false;
let lastTime = performance.now();

const textures = {
  ground: makeNoiseTexture(256, 256, [74, 62, 51], 42, 1),
  darkerGround: makeNoiseTexture(256, 256, [44, 42, 39], 34, 1),
  cockpit: makeCockpitTexture(),
  glass: makeGlassTexture(),
  mineral: makeMineralTexture()
};

let patterns = {};

const player = {
  x: 0,
  z: 0,
  yaw: 0,
  speed: 0,
  bob: 0
};

const keys = new Set();
const pointer = {
  dragging: false,
  lastX: 0,
  lastY: 0
};

const touch = {
  move: { id: null, x: 0, y: 0, active: false },
  look: { id: null, x: 0, y: 0, active: false }
};

const wind = {
  phase: 0,
  load: 0.76,
  gust: 0
};

const scanTargets = [
  { x: -44, z: -90, label: 'blue-white mineral bloom', scanned: false },
  { x: 34, z: -115, label: 'pressure mast wreckage', scanned: false },
  { x: 92, z: -170, label: 'basalt rib formation', scanned: false },
  { x: -120, z: -210, label: 'ice-salt seep', scanned: false },
  { x: 12, z: -260, label: 'navigation pylon', scanned: false },
  { x: 165, z: -320, label: 'wind-polished ridge', scanned: false }
];

const messages = [
  'COCKPIT LOG: Exterior conditions are survivable under mission definition HZ-3. Comfort was not included in the definition.',
  'Cabin microphones detect sustained grit impact across the forward glass.',
  'Atmospheric mix remains within tolerance. Filtration system disputes the optimism of that phrase.',
  'The vehicle frame flexes under lateral wind load. No breach detected.',
  'Mapping software reports shallow terrain confidence beyond visual range.'
];
let messageIndex = 0;
let messageTimer = 0;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  w = Math.floor(window.innerWidth);
  h = Math.floor(window.innerHeight);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  patterns = {
    ground: patternFrom(ctx, textures.ground),
    darkerGround: patternFrom(ctx, textures.darkerGround),
    cockpit: patternFrom(ctx, textures.cockpit),
    glass: patternFrom(ctx, textures.glass)
  };
}

function terrainHeight(x, z) {
  return Math.sin(x * 0.035) * 8 + Math.cos(z * 0.028) * 10 + Math.sin((x + z) * 0.017) * 7;
}

function drawSky(t) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.68);
  sky.addColorStop(0, '#07111b');
  sky.addColorStop(0.48, '#192a31');
  sky.addColorStop(1, '#785c4d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const starX = w * (0.66 + Math.sin(player.yaw) * 0.05);
  const starY = h * 0.24;
  const glow = ctx.createRadialGradient(starX, starY, 4, starX, starY, h * 0.34);
  glow.addColorStop(0, 'rgba(255, 198, 168, 0.52)');
  glow.addColorStop(0.2, 'rgba(255, 138, 96, 0.18)');
  glow.addColorStop(1, 'rgba(255, 138, 96, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h * 0.62);

  ctx.globalAlpha = 0.15;
  for (let i = 0; i < 34; i++) {
    const y = ((i * 47 + t * 18) % (h * 0.62));
    ctx.fillStyle = 'rgba(210, 230, 235, 0.10)';
    ctx.fillRect(0, y, w, 1);
  }
  ctx.globalAlpha = 1;
}

function drawTerrain() {
  const horizon = h * 0.51 + Math.sin(player.bob) * 3;

  for (let y = Math.floor(horizon); y < h; y += 2) {
    const depth = (y - horizon) / Math.max(1, h - horizon);
    const distance = 18 / Math.pow(depth + 0.04, 1.22);
    const leftRay = player.yaw - 0.82;
    const rightRay = player.yaw + 0.82;

    const shade = 1 - depth * 0.68;
    ctx.globalAlpha = 0.93;
    ctx.fillStyle = depth > 0.45 ? patterns.ground : patterns.darkerGround;

    const offset = Math.floor((Math.sin(player.x * 0.04 + y * 0.022) + Math.cos(player.z * 0.02 + y * 0.015)) * 28);
    ctx.save();
    ctx.translate(offset, 0);
    ctx.fillRect(-256, y, w + 512, 2);
    ctx.restore();

    ctx.globalAlpha = 0.18 + depth * 0.2;
    ctx.fillStyle = `rgba(255, 214, 183, ${0.08 + depth * 0.12})`;
    ctx.fillRect(0, y, w, 2);

    const ridge = terrainHeight(player.x + Math.sin(leftRay) * distance, player.z + Math.cos(rightRay) * distance);
    if (ridge > 11 && y % 6 === 0) {
      ctx.globalAlpha = 0.12 * shade;
      ctx.fillStyle = '#dde9e8';
      ctx.fillRect(0, y, w, 1);
    }
  }

  ctx.globalAlpha = 1;
  drawDistantRidges(horizon);
}

function drawDistantRidges(horizon) {
  for (let band = 0; band < 4; band++) {
    const baseY = horizon - 34 + band * 18;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = -20; x <= w + 20; x += 12) {
      const world = (x - w / 2) * 0.02 + player.yaw * 6 + band * 19;
      const y = baseY + Math.sin(world * 1.7) * (12 + band * 3) + Math.cos(world * 0.8) * 18;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.globalAlpha = 0.18 - band * 0.025;
    ctx.fillStyle = band % 2 ? '#3f3d38' : '#595047';
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawTargets() {
  const horizon = h * 0.51;
  let nearest = null;

  for (const target of scanTargets) {
    const dx = target.x - player.x;
    const dz = target.z - player.z;
    const distance = Math.hypot(dx, dz);
    if (distance > 360) continue;

    const angle = Math.atan2(dx, dz) - player.yaw;
    const wrapped = Math.atan2(Math.sin(angle), Math.cos(angle));
    if (Math.abs(wrapped) > 0.86) continue;

    const sx = w / 2 + wrapped * w * 0.62;
    const sy = horizon + 2300 / (distance + 18) + terrainHeight(target.x, target.z) * 0.9;
    const size = Math.max(15, 1750 / (distance + 28));

    ctx.globalAlpha = target.scanned ? 0.18 : 0.68;
    ctx.drawImage(textures.mineral, sx - size / 2, sy - size / 2, size, size);

    if (!target.scanned && Math.abs(sx - w / 2) < 42 && Math.abs(sy - h / 2) < 80) {
      nearest = target;
    }
  }

  ctx.globalAlpha = 1;
  if (nearest) {
    nearest.scanned = true;
    log.textContent = `SCAN COMPLETE: ${nearest.label}. Map confidence improved. Exterior remains unpleasant.`;
  }
}

function drawWind(t) {
  wind.phase += 0.016 + wind.gust * 0.02;
  wind.gust = 0.5 + 0.5 * Math.sin(t * 0.55) + Math.random() * 0.1;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 95; i++) {
    const y = (i * 37 + t * (70 + wind.gust * 95)) % h;
    const x = (i * 193 + t * 165 + Math.sin(i) * 90) % (w + 260) - 160;
    const len = 42 + wind.gust * 80 + Math.random() * 24;
    ctx.globalAlpha = 0.025 + wind.gust * 0.035;
    ctx.strokeStyle = '#d9eef3';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y - 8 - wind.gust * 10);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawCockpit(t) {
  const bob = Math.sin(player.bob) * 4;

  ctx.save();
  ctx.translate(0, bob);

  ctx.fillStyle = patterns.glass;
  roundedRect(w * 0.14, h * 0.13, w * 0.72, h * 0.58, 26, true, false);

  ctx.strokeStyle = 'rgba(160, 215, 235, 0.16)';
  ctx.lineWidth = 2;
  roundedRect(w * 0.14, h * 0.13, w * 0.72, h * 0.58, 26, false, true);

  ctx.fillStyle = patterns.cockpit;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, h * 0.67);
  ctx.lineTo(w * 0.23, h * 0.72);
  ctx.lineTo(w * 0.35, h);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(w, h);
  ctx.lineTo(w, h * 0.67);
  ctx.lineTo(w * 0.77, h * 0.72);
  ctx.lineTo(w * 0.65, h);
  ctx.closePath();
  ctx.fill();

  ctx.fillRect(0, h * 0.78, w, h * 0.22);

  ctx.fillStyle = 'rgba(4, 11, 16, 0.82)';
  roundedRect(w * 0.32, h * 0.79, w * 0.36, h * 0.15, 18, true, false);

  drawInstrument(w * 0.37, h * 0.84, 'ATM', 'BREATHABLE*', t);
  drawInstrument(w * 0.50, h * 0.84, 'WIND', 'SEVERE', t + 10);
  drawInstrument(w * 0.63, h * 0.84, 'MAP', 'POOR', t + 20);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(0, 0, w, h);

  ctx.restore();
}

function drawInstrument(x, y, label, value, t) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(92, 222, 255, 0.08)';
  roundedRect(x - 48, y - 28, 96, 56, 8, true, false);
  ctx.strokeStyle = 'rgba(150, 236, 255, 0.18)';
  roundedRect(x - 48, y - 28, 96, 56, 8, false, true);
  ctx.fillStyle = `rgba(192, 248, 255, ${0.55 + Math.sin(t * 2) * 0.08})`;
  ctx.font = '10px system-ui';
  ctx.fillText(label, x, y - 6);
  ctx.font = '11px system-ui';
  ctx.fillText(value, x, y + 12);
  ctx.restore();
}

function roundedRect(x, y, width, height, radius, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function update(dt) {
  const forward = Number(keys.has('w') || keys.has('ArrowUp')) - Number(keys.has('s') || keys.has('ArrowDown')) + touch.move.y;
  const strafe = Number(keys.has('d') || keys.has('ArrowRight')) - Number(keys.has('a') || keys.has('ArrowLeft')) + touch.move.x;

  const moveSpeed = 34;
  const sin = Math.sin(player.yaw);
  const cos = Math.cos(player.yaw);
  player.x += (sin * forward + cos * strafe) * moveSpeed * dt;
  player.z += (cos * forward - sin * strafe) * moveSpeed * dt;
  player.yaw += touch.look.x * dt * 1.7;
  player.speed = Math.min(1, Math.abs(forward) + Math.abs(strafe));
  player.bob += dt * (1.8 + player.speed * 5.8);

  messageTimer += dt;
  if (messageTimer > 7 && running) {
    messageTimer = 0;
    messageIndex = (messageIndex + 1) % messages.length;
    log.textContent = messages[messageIndex];
  }

  updateHud();
}

function updateHud() {
  const scanned = scanTargets.filter(t => t.scanned).length;
  const seal = 91 - Math.round(wind.gust * 4);
  const signal = Math.max(23, Math.round(46 + Math.sin(player.z * 0.02) * 18 - wind.gust * 8));

  sealText.textContent = `${seal}%`;
  signalText.textContent = `${signal}%`;
  scanText.textContent = `${scanned} / ${scanTargets.length}`;
  sealFill.style.width = `${seal}%`;
  signalFill.style.width = `${signal}%`;
  scanFill.style.width = `${(scanned / scanTargets.length) * 100}%`;
}

function frame(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  const t = now / 1000;

  if (running) update(dt);
  drawSky(t);
  drawTerrain();
  drawTargets();
  drawWind(t);
  drawCockpit(t);

  requestAnimationFrame(frame);
}

function attachControls() {
  window.addEventListener('keydown', event => keys.add(event.key.toLowerCase()));
  window.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));

  canvas.addEventListener('pointerdown', event => {
    pointer.dragging = true;
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
  });

  window.addEventListener('pointerup', () => pointer.dragging = false);
  window.addEventListener('pointermove', event => {
    if (!pointer.dragging || event.pointerType === 'touch') return;
    const dx = event.clientX - pointer.lastX;
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    player.yaw += dx * 0.004;
  });

  setupStick(moveStick, touch.move, true);
  setupStick(lookStick, touch.look, false);
}

function setupStick(element, state, movementStick) {
  const nub = element.querySelector('.nub');
  const reset = () => {
    state.id = null;
    state.x = 0;
    state.y = 0;
    state.active = false;
    nub.style.transform = 'translate(0px, 0px)';
  };

  element.addEventListener('pointerdown', event => {
    state.id = event.pointerId;
    state.active = true;
    element.setPointerCapture(event.pointerId);
  });

  element.addEventListener('pointermove', event => {
    if (state.id !== event.pointerId) return;
    const rect = element.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = event.clientX - cx;
    const dy = event.clientY - cy;
    const len = Math.hypot(dx, dy);
    const max = 42;
    const scale = len > max ? max / len : 1;
    const nx = dx * scale;
    const ny = dy * scale;
    nub.style.transform = `translate(${nx}px, ${ny}px)`;
    state.x = nx / max;
    state.y = movementStick ? -ny / max : 0;
    if (!movementStick) state.x = nx / max;
  });

  element.addEventListener('pointerup', reset);
  element.addEventListener('pointercancel', reset);
}

wakeButton.addEventListener('click', () => {
  running = true;
  wakePanel.style.display = 'none';
  log.textContent = 'WAKE CYCLE COMPLETE: Vehicle optics restored. Exterior wind remains above advisory threshold.';
});

window.addEventListener('resize', resize);
resize();
attachControls();
requestAnimationFrame(frame);
