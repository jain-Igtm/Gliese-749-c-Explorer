const activityCanvas = document.getElementById('activityLayer');
const ctx = activityCanvas.getContext('2d');

const ACTIVITY_SEED = 749031;
let w = 0;
let h = 0;
let dpr = 1;
let startTime = performance.now();
let active = false;

const skyTraffic = makeItems(8, 1000);
const roadTraffic = makeItems(10, 2000);
const wildlife = makeItems(7, 3000);
const buildLights = makeItems(18, 4000);

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
  drawBuildLights(t);
  drawRoadTraffic(t);
  drawWildlife(t);
  drawSkyTraffic(t);
  drawSignalLines(t);
}

function drawBuildLights(t) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const item of buildLights) {
    const pulse = 0.5 + Math.sin(t * item.speed * 16 + item.seed) * 0.5;
    const x = item.x * w + Math.sin(t * 0.18 + item.seed) * 7;
    const y = (0.38 + item.y * 0.34) * h;
    const a = 0.05 + pulse * 0.16;
    ctx.fillStyle = item.flip ? `rgba(120,235,255,${a})` : `rgba(255,180,95,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, 2 + pulse * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ctx.fillStyle;
    ctx.beginPath();
    ctx.moveTo(x, y + 2);
    ctx.lineTo(x + Math.sin(t + item.seed) * 7, y + 18 + pulse * 14);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRoadTraffic(t) {
  for (const item of roadTraffic) {
    const travel = wrap(item.phase + t * item.speed * 0.18);
    const depth = lerp(0.84, 0.38, travel);
    const scale = lerp(1.55, 0.32, travel);
    const roadX = w * (0.5 + Math.sin(depth * 6 + ACTIVITY_SEED * 0.001) * 0.10);
    const x = roadX + (item.x - 0.5) * 55 * scale;
    const y = h * depth;
    const a = lerp(0.38, 0.08, travel);
    const cars = 2 + Math.floor(item.y * 3);
    for (let i = 0; i < cars; i++) {
      const xx = x + Math.sin(t + item.seed + i) * 1.5 * scale;
      const yy = y + i * 8 * scale;
      roundedRect(xx - 5 * scale, yy - 2 * scale, 10 * scale, 5 * scale, 2 * scale);
      ctx.fillStyle = `rgba(8,12,14,${a})`;
      ctx.fill();
      ctx.fillStyle = `rgba(120,235,255,${a * 0.9})`;
      ctx.fillRect(xx - 3 * scale, yy - 1 * scale, 1.5 * scale, 1.5 * scale);
      ctx.fillStyle = `rgba(255,180,90,${a * 0.75})`;
      ctx.fillRect(xx + 2 * scale, yy - 1 * scale, 1.5 * scale, 1.5 * scale);
    }
  }
}

function drawWildlife(t) {
  for (const item of wildlife) {
    const side = item.flip ? 1 : -1;
    const travel = wrap(item.phase + t * item.speed * 0.12);
    const baseX = item.flip ? w * 0.82 : w * 0.18;
    const x = baseX + (travel - 0.5) * w * 0.22 * side;
    const y = (0.58 + item.y * 0.30) * h + Math.sin(t * 1.7 + item.seed) * 8;
    const s = 9 + item.x * 14;
    const a = 0.18 + Math.sin(t * 2 + item.seed) * 0.04;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(side, 1);
    ctx.fillStyle = `rgba(7,12,10,${a})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 1.15, s * 0.42, Math.sin(t + item.seed) * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(s * 0.75, -s * 0.14, s * 0.38, s * 0.26, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(7,12,10,${a})`;
    ctx.lineWidth = Math.max(1, s * 0.08);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * s * 0.28, s * 0.08);
      ctx.lineTo(i * s * 0.34 + Math.sin(t * 5 + i + item.seed) * s * 0.18, s * 0.58);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawSkyTraffic(t) {
  for (const item of skyTraffic) {
    const travel = wrap(item.phase + t * item.speed * 0.16);
    const x = -w * 0.16 + travel * w * 1.32;
    const y = (0.08 + item.y * 0.26) * h + Math.sin(t * 0.7 + item.seed) * 12;
    const s = 18 + item.x * 34;
    const alpha = 0.10 + Math.sin(Math.PI * travel) * 0.25;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.08 + (item.x - 0.5) * 0.12);
    ctx.fillStyle = `rgba(5,9,13,${alpha})`;
    ctx.beginPath();
    ctx.moveTo(s * 1.25, 0);
    ctx.lineTo(-s * 0.4, -s * 0.24);
    ctx.lineTo(-s * 1.1, -s * 0.78);
    ctx.lineTo(-s * 0.82, -s * 0.10);
    ctx.lineTo(-s * 1.1, s * 0.78);
    ctx.lineTo(-s * 0.4, s * 0.24);
    ctx.closePath();
    ctx.fill();
    if (Math.sin(t * item.speed * 80 + item.seed) > 0.45) {
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(120,235,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(-s * 0.5, -s * 0.55, Math.max(1.5, s * 0.06), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,176,90,${alpha})`;
      ctx.beginPath();
      ctx.arc(-s * 0.5, s * 0.55, Math.max(1.5, s * 0.06), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawSignalLines(t) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 7; i++) {
    const y = h * (0.18 + i * 0.065) + Math.sin(t * 0.4 + i) * 10;
    const x = wrap(t * (0.015 + i * 0.004) + seeded(8000 + i, 0, 1)) * w;
    ctx.strokeStyle = `rgba(125,220,255,${0.018 + i * 0.002})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 50, y);
    ctx.lineTo(x + 50, y + Math.sin(t + i) * 6);
    ctx.stroke();
  }
  ctx.restore();
}

function makeItems(count, baseSeed) {
  return Array.from({ length: count }, (_, i) => ({
    seed: baseSeed + i * 31,
    x: seeded(baseSeed + i * 11, 0, 1),
    y: seeded(baseSeed + i * 17, 0, 1),
    speed: seeded(baseSeed + i * 23, 0.25, 1.0),
    phase: seeded(baseSeed + i * 29, 0, 1),
    flip: seeded(baseSeed + i * 37, 0, 1) > 0.5
  }));
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

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function seeded(seed, min, max) {
  const x = Math.sin(ACTIVITY_SEED + seed * 999.17) * 43758.5453123;
  return min + (x - Math.floor(x)) * (max - min);
}
