export function createTexture(width, height, painter) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  painter(ctx, width, height);
  return canvas;
}

export function makeNoiseTexture(width, height, base = [60, 54, 46], spread = 38, alpha = 1) {
  return createTexture(width, height, (ctx, w, h) => {
    const image = ctx.createImageData(w, h);
    for (let i = 0; i < image.data.length; i += 4) {
      const n = (Math.random() - 0.5) * spread;
      image.data[i] = clamp(base[0] + n);
      image.data[i + 1] = clamp(base[1] + n * 0.82);
      image.data[i + 2] = clamp(base[2] + n * 0.55);
      image.data[i + 3] = Math.round(255 * alpha);
    }
    ctx.putImageData(image, 0, 0);
  });
}

export function makeCockpitTexture() {
  return createTexture(360, 180, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#1b2a32');
    g.addColorStop(0.55, '#071116');
    g.addColorStop(1, '#02070a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 900; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const v = 70 + Math.random() * 55;
      ctx.fillStyle = `rgba(${v}, ${v + 12}, ${v + 20}, ${0.04 + Math.random() * 0.07})`;
      ctx.fillRect(x, y, Math.random() * 2.2, Math.random() * 1.4);
    }

    ctx.strokeStyle = 'rgba(180, 230, 255, 0.08)';
    for (let y = 18; y < h; y += 26) {
      ctx.beginPath();
      ctx.moveTo(0, y + Math.random() * 2);
      ctx.lineTo(w, y + Math.random() * 2);
      ctx.stroke();
    }
  });
}

export function makeGlassTexture() {
  return createTexture(420, 260, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(185, 238, 255, 0.11)');
    g.addColorStop(0.5, 'rgba(35, 90, 115, 0.035)');
    g.addColorStop(1, 'rgba(255, 226, 200, 0.08)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 80; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.strokeStyle = `rgba(220,245,255,${0.025 + Math.random() * 0.05})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.random() * 90 - 30, y + Math.random() * 16 - 8);
      ctx.stroke();
    }
  });
}

export function makeMineralTexture() {
  return createTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 3, w * 0.5, h * 0.5, w * 0.52);
    g.addColorStop(0, 'rgba(205,255,255,0.95)');
    g.addColorStop(0.25, 'rgba(92,220,255,0.65)');
    g.addColorStop(0.58, 'rgba(50,96,120,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = `rgba(230,255,255,${0.12 + Math.random() * 0.18})`;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.5);
      ctx.lineTo(Math.random() * w, Math.random() * h);
      ctx.stroke();
    }
  });
}

export function patternFrom(ctx, texture, repeat = 'repeat') {
  return ctx.createPattern(texture, repeat);
}

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}
