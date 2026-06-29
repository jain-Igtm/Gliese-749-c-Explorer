const activityCanvas = document.getElementById('activityLayer');
const ctx = activityCanvas.getContext('2d');

const ACTIVITY_SEED = 749031;
let w = 0;
let h = 0;
let dpr = 1;
let startTime = performance.now();
let active = false;

const cargoShips = Array.from({ length: 6 }, (_, i) => ({
  seed: 1000 + i * 71,
  lane: seeded(1100 + i, 0.12, 0.36),
  size: seeded(1200 + i, 62, 118),
  speed: seeded(1300 + i, 0.018, 0.050),
  phase: seeded(1400 + i, 0, 1),
  heightBob: seeded(1500 + i, 5, 18),
  tilt: seeded(1600 + i, -0.08, 0.08),
  direction: seeded(1700 + i, 0, 1) > 0.5 ? 1 : -1
}));

const cargoDrops = Array.from({ length: 10 }, (_, i) => ({
  seed: 3000 + i * 43,
  shipIndex: i % 6,
  phase: seeded(3100 + i, 0, 1),
  speed: seeded(3200 + i, 0.035, 0.075),
  drift: seeded(3300 + i, -22, 22),
  size: seeded(3400 + i, 5, 12)
}));

const distantShips = Array.from({ length: 5 }, (_, i) => ({
  seed: 5000 + i * 59,
  y: seeded(5100 + i, 0.08, 0.22),
  size: seeded(5200 + i, 18, 42),
  speed: seeded(5300 + i, 0.010, 0.024),
  phase: seeded(5400 + i, 0, 1),
  direction: seeded(5500 + i, 0, 1) > 0.5 ? 1 : -1
}));

resize();
window.addEventListener('resize', resize);
window.addEventListener('pointerdown', () => { active = true; }, { once: true });
requestAnimationFrame(loop);

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 1.8);
  w = window.innerWidth;
  h = window.innerHeight;
  activityCanvas.width = Math.floor(w * dpr);
  activityCanvas.height = Math.floor(h * dpr);
  activityCanvas.style.position = 'fixed';
  activityCanvas.style.inset = '0';
  activityCanvas.style.width = '100vw';
  activityCanvas.style.height = '100vh';
  activityCanvas.style.zIndex = '13';
  activityCanvas.style.pointerEvents = 'none';
  activityCanvas.style.touchAction = 'none';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function loop(now) {
  const wakeHidden = document.getElementById('wakePanel')?.style.display === 'none';
  draw((now - startTime) / 1000, active || wakeHidden);
  requestAnimationFrame(loop);
}

function draw(t, shouldDraw) {
  ctx.clearRect(0, 0, w, h);
  if (!shouldDraw) return;
  drawDistantShips(t);
  drawCargoDrops(t);
  drawCargoShips(t);
  drawEngineWash(t);
}

function shipPosition(ship, t) {
  const travel = wrap(ship.phase + t * ship.speed);
  const dir = ship.direction;
  const x = dir > 0 ? -w * 0.22 + travel * w * 1.44 : w * 1.22 - travel * w * 1.44;
  const y = h * ship.lane + Math.sin(t * 0.8 + ship.seed) * ship.heightBob;
  return { x, y, travel };
}

function drawCargoShips(t) {
  for (const ship of cargoShips) {
    const p = shipPosition(ship, t);
    const fade = Math.sin(Math.PI * p.travel);
    const alpha = 0.42 + fade * 0.34;
    drawShip(p.x, p.y, ship.size, ship.direction, ship.tilt, alpha, t, ship.seed);
  }
}

function drawShip(x, y, s, dir, tilt, alpha, t, seed) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.rotate(tilt + Math.sin(t * 0.8 + seed) * 0.018);

  ctx.globalCompositeOperation = 'screen';
  const glow = ctx.createRadialGradient(0, 0, s * 0.10, 0, 0, s * 1.05);
  glow.addColorStop(0, `rgba(105,225,255,${alpha * 0.10})`);
  glow.addColorStop(1, 'rgba(105,225,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-s * 1.1, -s * 0.75, s * 2.2, s * 1.5);

  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(6,10,14,${alpha})`;
  ctx.beginPath();
  ctx.moveTo(s * 1.18, 0);
  ctx.lineTo(s * 0.52, -s * 0.23);
  ctx.lineTo(-s * 0.28, -s * 0.34);
  ctx.lineTo(-s * 1.0, -s * 0.18);
  ctx.lineTo(-s * 1.18, 0);
  ctx.lineTo(-s * 1.0, s * 0.18);
  ctx.lineTo(-s * 0.28, s * 0.34);
  ctx.lineTo(s * 0.52, s * 0.23);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = `rgba(18,29,35,${alpha})`;
  roundedRect(-s * 0.72, -s * 0.18, s * 1.25, s * 0.36, s * 0.08);
  ctx.fill();

  ctx.fillStyle = `rgba(110,235,255,${alpha * 0.85})`;
  roundedRect(s * 0.25, -s * 0.06, s * 0.34, s * 0.12, s * 0.04);
  ctx.fill();

  ctx.globalCompositeOperation = 'screen';
  drawEngine(-s * 1.03, -s * 0.14, s, alpha, t + seed);
  drawEngine(-s * 1.03, s * 0.14, s, alpha, t + seed + 1.4);

  ctx.fillStyle = `rgba(255,184,92,${alpha * 0.55})`;
  for (let i = 0; i < 4; i++) {
    const bx = -s * 0.42 + i * s * 0.24;
    const by = s * 0.26;
    ctx.beginPath();
    ctx.arc(bx, by, Math.max(1.5, s * 0.025), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawEngine(x, y, s, alpha, t) {
  const pulse = 0.65 + Math.sin(t * 18) * 0.35;
  const flame = ctx.createRadialGradient(x, y, 1, x - s * 0.30, y, s * 0.38);
  flame.addColorStop(0, `rgba(120,235,255,${alpha * 0.82})`);
  flame.addColorStop(0.45, `rgba(90,160,255,${alpha * 0.34 * pulse})`);
  flame.addColorStop(1, 'rgba(90,160,255,0)');
  ctx.fillStyle = flame;
  ctx.fillRect(x - s * 0.44, y - s * 0.18, s * 0.48, s * 0.36);
}

function drawCargoDrops(t) {
  for (const drop of cargoDrops) {
    const ship = cargoShips[drop.shipIndex];
    const p = shipPosition(ship, t);
    const fall = wrap(drop.phase + t * drop.speed);
    const alpha = Math.sin(Math.PI * fall) * 0.58;
    if (alpha <= 0.03) continue;

    const x = p.x + drop.drift * fall * ship.direction;
    const y = p.y + ship.size * 0.22 + fall * h * 0.43;
    if (y > h * 0.76) continue;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = `rgba(120,235,255,${alpha * 0.35})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, p.y + ship.size * 0.18);
    ctx.lineTo(x - drop.drift * 0.15, y);
    ctx.stroke();

    ctx.fillStyle = `rgba(10,16,19,${alpha * 0.9})`;
    roundedRect(x - drop.size, y - drop.size * 0.62, drop.size * 2, drop.size * 1.24, drop.size * 0.25);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,185,95,${alpha * 0.42})`;
    ctx.stroke();

    ctx.fillStyle = `rgba(120,235,255,${alpha * 0.75})`;
    ctx.beginPath();
    ctx.arc(x, y - drop.size * 0.9, Math.max(1.2, drop.size * 0.22), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawDistantShips(t) {
  for (const ship of distantShips) {
    const travel = wrap(ship.phase + t * ship.speed);
    const x = ship.direction > 0 ? -w * 0.10 + travel * w * 1.20 : w * 1.10 - travel * w * 1.20;
    const y = h * ship.y + Math.sin(t * 0.6 + ship.seed) * 6;
    const alpha = 0.15 + Math.sin(Math.PI * travel) * 0.20;
    drawSmallShip(x, y, ship.size, ship.direction, alpha, t, ship.seed);
  }
}

function drawSmallShip(x, y, s, dir, alpha, t, seed) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.fillStyle = `rgba(4,8,12,${alpha})`;
  ctx.beginPath();
  ctx.moveTo(s, 0);
  ctx.lineTo(-s * 0.55, -s * 0.22);
  ctx.lineTo(-s * 0.85, 0);
  ctx.lineTo(-s * 0.55, s * 0.22);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = `rgba(120,235,255,${alpha * 0.8})`;
  ctx.beginPath();
  ctx.arc(-s * 0.82, 0, Math.max(1.2, s * 0.08), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEngineWash(t) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 6; i++) {
    const y = h * (0.18 + i * 0.055) + Math.sin(t * 0.5 + i) * 8;
    const x = wrap(t * (0.018 + i * 0.003) + seeded(7000 + i, 0, 1)) * w;
    ctx.strokeStyle = `rgba(120,220,255,${0.018 + i * 0.002})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 65, y);
    ctx.lineTo(x + 45, y + Math.sin(t + i) * 5);
    ctx.stroke();
  }
  ctx.restore();
}

function roundedRect(x, y, ww, hh, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + ww, y, x + ww, y + hh, r);
  ctx.arcTo(x + ww, y + hh, x, y + hh, r);
  ctx.arcTo(x, y + hh, x, y, r);
  ctx.arcTo(x, y, x + ww, y, r);
  ctx.closePath();
}

function wrap(v) {
  return ((v % 1) + 1) % 1;
}

function seeded(seed, min, max) {
  const x = Math.sin(ACTIVITY_SEED + seed * 999.17) * 43758.5453123;
  return min + (x - Math.floor(x)) * (max - min);
}
