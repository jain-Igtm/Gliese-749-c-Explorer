const cockpit = document.getElementById('cockpitTexture');
const ctx = cockpit.getContext('2d');
let w = 0;
let h = 0;
let dpr = 1;
let time = 0;

resize();
window.addEventListener('resize', resize);
requestAnimationFrame(loop);

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 1.8);
  w = window.innerWidth;
  h = window.innerHeight;
  cockpit.width = Math.floor(w * dpr);
  cockpit.height = Math.floor(h * dpr);
  cockpit.style.position = 'fixed';
  cockpit.style.inset = '0';
  cockpit.style.width = '100vw';
  cockpit.style.height = '100vh';
  cockpit.style.zIndex = '12';
  cockpit.style.pointerEvents = 'none';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function loop(now) {
  time = now / 1000;
  draw();
  requestAnimationFrame(loop);
}

function draw() {
  ctx.clearRect(0, 0, w, h);
  const roof = h * 0.085;
  const glassBottom = h * 0.60;
  const dash = h * 0.67;

  glass(roof, glassBottom);
  roofBar(roof);
  frames(roof, glassBottom);
  dashboard(dash);
  screens(dash);
  wheel(dash);
  console(dash);
  seats();
  grain();
}

function glass(top, bottom) {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, 'rgba(110,220,255,0.014)');
  g.addColorStop(1, 'rgba(255,180,100,0.008)');
  ctx.fillStyle = g;
  ctx.fillRect(0, top, w, bottom - top);

  ctx.strokeStyle = 'rgba(210,245,255,0.018)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    const y = top + rnd(i, 0, bottom - top);
    const x = rnd(i * 7, -40, w);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + rnd(i * 3, 55, 140), y + rnd(i * 5, -7, 4));
    ctx.stroke();
  }
}

function roofBar(roof) {
  const g = ctx.createLinearGradient(0, 0, 0, roof);
  g.addColorStop(0, 'rgba(0,0,0,0.90)');
  g.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, roof);
  lamps(w * 0.16, roof * 0.55);
  lamps(w * 0.84, roof * 0.55);
}

function lamps(x, y) {
  for (let i = 0; i < 4; i++) {
    const lx = x + (i - 1.5) * 9;
    const glow = ctx.createRadialGradient(lx, y, 1, lx, y, 12);
    glow.addColorStop(0, 'rgba(255,225,175,0.42)');
    glow.addColorStop(1, 'rgba(255,190,100,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(lx - 14, y - 14, 28, 28);
  }
}

function frames(top, bottom) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.64)';
  ctx.lineWidth = Math.max(4, w * 0.009);
  line(w * 0.03, top, w * 0.13, bottom);
  line(w * 0.30, top, w * 0.35, bottom);
  line(w * 0.70, top, w * 0.65, bottom);
  line(w * 0.97, top, w * 0.87, bottom);
  ctx.lineWidth = Math.max(5, w * 0.011);
  line(0, bottom, w, bottom);
}

function dashboard(y) {
  const bottom = h * 0.84;
  const g = ctx.createLinearGradient(0, y, 0, bottom);
  g.addColorStop(0, 'rgba(8,11,13,0.66)');
  g.addColorStop(0.5, 'rgba(24,16,12,0.68)');
  g.addColorStop(1, 'rgba(7,5,4,0.88)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, y + 10);
  ctx.bezierCurveTo(w * 0.25, y - 7, w * 0.38, y + 8, w * 0.50, y - 3);
  ctx.bezierCurveTo(w * 0.62, y + 8, w * 0.75, y - 7, w, y + 10);
  ctx.lineTo(w, bottom);
  ctx.lineTo(0, bottom);
  ctx.closePath();
  ctx.fill();
}

function screens(y) {
  panel(w * 0.36, y + h * 0.030, w * 0.28, h * 0.055, 'MAP');
  panel(w * 0.08, y + h * 0.042, w * 0.15, h * 0.055, 'ENV');
  panel(w * 0.77, y + h * 0.042, w * 0.15, h * 0.055, 'SYS');
}

function panel(x, y, pw, ph, title) {
  round(x, y, pw, ph, 8, 'rgba(2,10,14,0.58)', 'rgba(120,225,255,0.12)');
  ctx.fillStyle = 'rgba(110,235,255,0.045)';
  ctx.fillRect(x + 5, y + 15, pw - 10, ph - 20);
  ctx.fillStyle = 'rgba(190,245,255,0.48)';
  ctx.font = `${Math.max(7, w * 0.013)}px system-ui`;
  ctx.fillText(title, x + 8, y + 12);
}

function wheel(y) {
  const x = w * 0.22;
  const yy = y + h * 0.12;
  const r = w * 0.048;
  ctx.strokeStyle = 'rgba(0,0,0,0.62)';
  ctx.lineWidth = Math.max(5, w * 0.010);
  ctx.beginPath();
  ctx.arc(x, yy, r, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, yy, r, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  round(x - r * 0.34, yy - r * 0.20, r * 0.68, r * 0.40, 7, 'rgba(18,22,24,0.60)', 'rgba(120,220,255,0.10)');
}

function console(y) {
  const x = w * 0.43;
  const yy = y + h * 0.10;
  const cw = w * 0.14;
  const ch = h * 0.15;
  round(x, yy, cw, ch, 12, 'rgba(18,14,11,0.62)', 'rgba(255,190,120,0.08)');
  round(x + cw * 0.17, yy + ch * 0.08, cw * 0.66, ch * 0.18, 6, 'rgba(2,14,18,0.62)', 'rgba(120,225,255,0.10)');
}

function seats() {
  const y = h * 0.865;
  seat(w * 0.02, y, w * 0.24, h * 0.12);
  seat(w * 0.74, y, w * 0.24, h * 0.12);
}

function seat(x, y, sw, sh) {
  const g = ctx.createLinearGradient(x, y, x + sw, y + sh);
  g.addColorStop(0, 'rgba(12,10,8,0.76)');
  g.addColorStop(0.55, 'rgba(37,27,21,0.72)');
  g.addColorStop(1, 'rgba(10,8,7,0.78)');
  round(x, y, sw, sh, 22, g, 'rgba(255,205,150,0.08)');
}

function grain() {
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  for (let i = 0; i < 85; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rnd(i * 2, 0.003, 0.009)})`;
    ctx.fillRect(rnd(i * 4, 0, w), rnd(i * 7, h * 0.67, h), rnd(i, 1, 2), 1);
  }
  ctx.restore();
}

function line(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function round(x, y, rw, rh, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + rw, y, x + rw, y + rh, r);
  ctx.arcTo(x + rw, y + rh, x, y + rh, r);
  ctx.arcTo(x, y + rh, x, y, r);
  ctx.arcTo(x, y, x + rw, y, r);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}

function rnd(seed, min, max) {
  const x = Math.sin(seed * 999.17) * 43758.5453;
  return min + (x - Math.floor(x)) * (max - min);
}
