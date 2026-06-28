const cockpit = document.getElementById('cockpitTexture');
const ctx = cockpit.getContext('2d');

let width = 0;
let height = 0;
let dpr = 1;
let t = 0;

setupCanvas();
window.addEventListener('resize', setupCanvas);
requestAnimationFrame(loop);

function setupCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 1.8);
  width = window.innerWidth;
  height = window.innerHeight;
  cockpit.width = Math.floor(width * dpr);
  cockpit.height = Math.floor(height * dpr);
  cockpit.style.position = 'fixed';
  cockpit.style.inset = '0';
  cockpit.style.width = '100vw';
  cockpit.style.height = '100vh';
  cockpit.style.zIndex = '12';
  cockpit.style.pointerEvents = 'none';
  cockpit.style.touchAction = 'none';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function loop(now) {
  t = now / 1000;
  drawCockpitTexture();
  requestAnimationFrame(loop);
}

function drawCockpitTexture() {
  ctx.clearRect(0, 0, width, height);

  const top = height * 0.10;
  const horizonBottom = height * 0.58;
  const dashTop = height * 0.56;
  const dashBottom = height * 0.84;
  const cx = width / 2;

  drawGlassTint(top, horizonBottom);
  drawRoof(top);
  drawWindowFrames(top, horizonBottom);
  drawDash(dashTop, dashBottom);
  drawScreens(dashTop, dashBottom);
  drawYoke(dashTop, dashBottom);
  drawConsole(dashTop, dashBottom);
  drawSeats(dashTop, dashBottom);
  drawCabinTextureGrain();
}

function drawGlassTint(top, bottom) {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, 'rgba(120,220,255,0.045)');
  g.addColorStop(0.6, 'rgba(120,220,255,0.018)');
  g.addColorStop(1, 'rgba(255,180,120,0.025)');
  ctx.fillStyle = g;
  ctx.fillRect(0, top, width, bottom - top);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 42; i++) {
    const y = top + seeded(i, 0, bottom - top);
    const x = seeded(i * 9, -80, width + 30);
    ctx.strokeStyle = `rgba(210,245,255,${seeded(i * 7, 0.018, 0.055)})`;
    ctx.lineWidth = seeded(i * 4, 0.6, 1.6);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + seeded(i * 3, 60, 210), y + seeded(i * 5, -16, 8));
    ctx.stroke();
  }
  ctx.restore();
}

function drawRoof(top) {
  const roofH = height * 0.13;
  const g = ctx.createLinearGradient(0, 0, 0, roofH + 30);
  g.addColorStop(0, 'rgba(0,0,0,0.92)');
  g.addColorStop(0.7, 'rgba(8,12,14,0.86)');
  g.addColorStop(1, 'rgba(4,7,9,0.30)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, roofH);

  roundRect(width * 0.34, roofH * 0.28, width * 0.32, roofH * 0.30, 12, 'rgba(4,10,13,0.88)', 'rgba(110,210,255,0.12)');

  drawLightCluster(width * 0.18, roofH * 0.50, -1);
  drawLightCluster(width * 0.82, roofH * 0.50, 1);

  ctx.fillStyle = 'rgba(255,190,115,0.08)';
  ctx.fillRect(0, roofH - 3, width, 3);
}

function drawLightCluster(x, y, dir) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(dir * 0.08);
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 4; i++) {
      const lx = (i - 1.5) * 14;
      const ly = row * 9;
      const glow = ctx.createRadialGradient(lx, ly, 1, lx, ly, 15);
      glow.addColorStop(0, 'rgba(255,230,180,0.82)');
      glow.addColorStop(1, 'rgba(255,190,100,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(lx - 16, ly - 16, 32, 32);
      roundRect(lx - 5, ly - 3, 10, 6, 2, 'rgba(255,230,185,0.82)', null);
    }
  }
  ctx.restore();
}

function drawWindowFrames(top, bottom) {
  const roofH = height * 0.13;
  const baseY = bottom;
  const center = width / 2;
  const sideW = width * 0.08;

  ctx.strokeStyle = 'rgba(0,0,0,0.92)';
  ctx.lineWidth = Math.max(12, width * 0.035);
  ctx.lineCap = 'round';

  drawFrameLine(width * 0.08, roofH, width * 0.23, baseY);
  drawFrameLine(width * 0.35, roofH * 0.98, width * 0.43, baseY);
  drawFrameLine(width * 0.65, roofH * 0.98, width * 0.57, baseY);
  drawFrameLine(width * 0.92, roofH, width * 0.77, baseY);

  ctx.lineWidth = Math.max(10, width * 0.025);
  drawFrameLine(0, baseY, width, baseY);

  ctx.strokeStyle = 'rgba(90,180,210,0.15)';
  ctx.lineWidth = 2;
  drawFrameLine(width * 0.08, roofH, width * 0.23, baseY);
  drawFrameLine(width * 0.35, roofH * 0.98, width * 0.43, baseY);
  drawFrameLine(width * 0.65, roofH * 0.98, width * 0.57, baseY);
  drawFrameLine(width * 0.92, roofH, width * 0.77, baseY);

  for (let i = 0; i < 11; i++) {
    const bx = width * 0.18 + i * width * 0.064;
    const by = baseY - 8;
    ctx.fillStyle = 'rgba(150,120,85,0.75)';
    ctx.beginPath();
    ctx.arc(bx, by, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFrameLine(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawDash(top, bottom) {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, 'rgba(9,12,13,0.98)');
  g.addColorStop(0.45, 'rgba(20,15,12,0.96)');
  g.addColorStop(1, 'rgba(8,6,5,0.98)');
  ctx.fillStyle = g;

  ctx.beginPath();
  ctx.moveTo(0, top + 10);
  ctx.bezierCurveTo(width * 0.20, top - 18, width * 0.36, top + 10, width * 0.50, top - 10);
  ctx.bezierCurveTo(width * 0.64, top + 10, width * 0.80, top - 18, width, top + 10);
  ctx.lineTo(width, bottom);
  ctx.lineTo(0, bottom);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(120,225,255,0.16)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, top + 10);
  ctx.bezierCurveTo(width * 0.20, top - 18, width * 0.36, top + 10, width * 0.50, top - 10);
  ctx.bezierCurveTo(width * 0.64, top + 10, width * 0.80, top - 18, width, top + 10);
  ctx.stroke();

  for (let i = 0; i < 22; i++) {
    const x = seeded(i * 5, 0, width);
    const y = seeded(i * 8, top + 8, bottom - 15);
    ctx.fillStyle = `rgba(255,210,150,${seeded(i, 0.025, 0.08)})`;
    ctx.fillRect(x, y, seeded(i * 3, 20, 80), 1);
  }
}

function drawScreens(top, bottom) {
  const mainW = width * 0.38;
  const mainH = height * 0.095;
  const mainX = width * 0.31;
  const mainY = top + height * 0.025;
  panel(mainX, mainY, mainW, mainH, 'TERRAIN MAP', true);

  const sideW = width * 0.22;
  const sideH = height * 0.105;
  panel(width * 0.055, top + height * 0.035, sideW, sideH, 'ENVIRONMENT', false);
  panel(width * 0.725, top + height * 0.035, sideW, sideH, 'SYSTEMS', false);

  const lowerW = width * 0.24;
  panel(width * 0.38, top + height * 0.145, lowerW, height * 0.06, 'SCAN ACTIVE', true);
}

function panel(x, y, w, h, title, map) {
  roundRect(x, y, w, h, 10, 'rgba(2,10,14,0.88)', 'rgba(120,225,255,0.18)');
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(20,240,255,0.14)');
  g.addColorStop(1, 'rgba(20,120,180,0.05)');
  ctx.fillStyle = g;
  ctx.fillRect(x + 6, y + 18, w - 12, h - 24);

  ctx.fillStyle = 'rgba(180,245,255,0.72)';
  ctx.font = `${Math.max(8, width * 0.018)}px system-ui`;
  ctx.fillText(title, x + 10, y + 14);

  ctx.strokeStyle = 'rgba(90,230,255,0.35)';
  ctx.lineWidth = 1;
  if (map) {
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const px = x + 10 + i * ((w - 20) / 23);
      const py = y + h * 0.62 + Math.sin(i * 0.8 + t) * h * 0.18;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  } else {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(100,230,255,0.42)' : 'rgba(255,180,90,0.35)';
      ctx.fillRect(x + 12, y + 26 + i * 12, w * seeded(i + x, 0.20, 0.70), 3);
    }
  }
}

function drawYoke(top, bottom) {
  const x = width * 0.20;
  const y = top + height * 0.19;
  const r = width * 0.075;

  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = Math.max(9, width * 0.018);
  ctx.strokeStyle = 'rgba(5,8,10,0.98)';
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI * 0.10, Math.PI * 0.90);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI * 1.10, Math.PI * 1.90);
  ctx.stroke();

  roundRect(-r * 0.42, -r * 0.30, r * 0.84, r * 0.62, 8, 'rgba(18,22,24,0.98)', 'rgba(120,220,255,0.15)');
  ctx.fillStyle = 'rgba(120,220,255,0.45)';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.16);
  ctx.lineTo(r * 0.14, r * 0.12);
  ctx.lineTo(-r * 0.14, r * 0.12);
  ctx.closePath();
  ctx.fill();

  for (let i = 0; i < 6; i++) {
    const bx = (i < 3 ? -1 : 1) * r * 0.54;
    const by = (i % 3 - 1) * r * 0.22;
    roundRect(bx - 5, by - 4, 10, 8, 3, 'rgba(180,230,255,0.22)', null);
  }
  ctx.restore();
}

function drawConsole(top, bottom) {
  const x = width * 0.39;
  const y = top + height * 0.21;
  const w = width * 0.22;
  const h = height * 0.30;

  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, 'rgba(22,18,15,0.96)');
  g.addColorStop(1, 'rgba(7,6,5,0.98)');
  roundRect(x, y, w, h, 14, g, 'rgba(255,190,120,0.12)');

  roundRect(x + w * 0.18, y + h * 0.05, w * 0.64, h * 0.22, 8, 'rgba(2,14,18,0.95)', 'rgba(120,225,255,0.16)');

  ctx.fillStyle = 'rgba(60,70,70,0.9)';
  roundRect(x + w * 0.18, y + h * 0.36, w * 0.22, h * 0.34, 8, 'rgba(8,8,8,0.95)', 'rgba(180,140,90,0.18)');
  roundRect(x + w * 0.48, y + h * 0.37, w * 0.16, h * 0.16, 100, 'rgba(150,120,80,0.9)', 'rgba(255,220,160,0.22)');
  roundRect(x + w * 0.67, y + h * 0.37, w * 0.16, h * 0.16, 100, 'rgba(150,120,80,0.9)', 'rgba(255,220,160,0.22)');

  roundRect(x - w * 0.05, y + h * 0.74, w * 1.10, h * 0.34, 15, 'rgba(26,20,16,0.98)', 'rgba(255,190,120,0.12)');
}

function drawSeats(top, bottom) {
  const y = height * 0.78;
  const w = width * 0.30;
  const h = height * 0.22;
  seatShape(width * 0.02, y, w, h, -1);
  seatShape(width * 0.68, y, w, h, 1);
}

function seatShape(x, y, w, h, side) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, 'rgba(12,10,8,0.98)');
  g.addColorStop(0.55, 'rgba(37,27,21,0.98)');
  g.addColorStop(1, 'rgba(10,8,7,0.98)');
  roundRect(x, y, w, h, 24, g, 'rgba(255,205,150,0.12)');

  ctx.save();
  ctx.beginPath();
  roundRectPath(x + w * 0.12, y + h * 0.08, w * 0.76, h * 0.78, 18);
  ctx.clip();
  ctx.strokeStyle = 'rgba(190,135,85,0.20)';
  ctx.lineWidth = 1;
  for (let i = -h; i < w + h; i += 22) {
    ctx.beginPath();
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i + h, y + h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + i + h, y);
    ctx.lineTo(x + i, y + h);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCabinTextureGrain() {
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(255,255,255,${seeded(i * 2, 0.006, 0.018)})`;
    ctx.fillRect(seeded(i * 4, 0, width), seeded(i * 7, height * 0.52, height), seeded(i, 1, 3), seeded(i * 3, 1, 2));
  }
  ctx.restore();
}

function roundRect(x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  roundRectPath(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function roundRectPath(x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function seeded(seed, min, max) {
  const x = Math.sin(seed * 999.17) * 43758.5453123;
  return min + (x - Math.floor(x)) * (max - min);
}
