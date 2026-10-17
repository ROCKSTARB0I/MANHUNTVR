// paint.js — every surface in Carcer City is painted here on canvases at load.
// No image files: brick, asphalt, rust, chain-link, graffiti, masks, blood.
import * as THREE from '../vendor/three.module.js';

export const T = {};
export function seeded(a) {
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const R = seeded(90210);

function cnv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, { srgb = true, repeat = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4; return t;
}

// tileable value noise (0..1), n x n samples, base lattice `cells`
function field(n, cells, oct = 4, seed = 1) {
  const out = new Float32Array(n * n); let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++) {
    const c = cells << o, g = new Float32Array(c * c), r = seeded(seed * 97 + o * 13);
    for (let i = 0; i < c * c; i++) g[i] = r();
    for (let y = 0; y < n; y++) {
      const fy = y / n * c, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty), y0 = iy % c, y1 = (iy + 1) % c;
      for (let x = 0; x < n; x++) {
        const fx = x / n * c, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx), x0 = ix % c, x1 = (ix + 1) % c;
        const a = g[y0 * c + x0], b = g[y0 * c + x1], d = g[y1 * c + x0], e = g[y1 * c + x1];
        const top = a + (b - a) * sx, bot = d + (e - d) * sx;
        out[y * n + x] += amp * (top + (bot - top) * sy);
      }
    }
    tot += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}
// apply a per-pixel function over a canvas: f(x, y, i, rgba) mutates rgba [0..255]
function pixels(g, n, m, f) {
  const img = g.getImageData(0, 0, n, m), d = img.data, px = [0, 0, 0, 255];
  for (let y = 0; y < m; y++) for (let x = 0; x < n; x++) {
    const i = (y * n + x) * 4; px[0] = d[i]; px[1] = d[i + 1]; px[2] = d[i + 2]; px[3] = d[i + 3];
    f(x, y, y * n + x, px); d[i] = px[0]; d[i + 1] = px[1]; d[i + 2] = px[2]; d[i + 3] = px[3];
  }
  g.putImageData(img, 0, 0);
}
const clamp = (v, a = 0, b = 255) => v < a ? a : v > b ? b : v;

// ---------------------------------------------------------------- brick
function brickPattern(g, n, rows, per, ox = 0, oy = 0, w = n, h = n, rr = R) {
  const rh = h / rows, bw = w / per;
  g.fillStyle = '#5b5550'; g.fillRect(ox, oy, w, h);
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * bw / 2;
    for (let b = -1; b < per + 1; b++) {
      const x = ox + b * bw + off, y = oy + r * rh;
      const k = rr(); const base = k < 0.08 ? [70, 38, 30] : k < 0.2 ? [118, 62, 44] : [96 + rr() * 30, 46 + rr() * 16, 34 + rr() * 12];
      g.fillStyle = `rgb(${base[0] | 0},${base[1] | 0},${base[2] | 0})`;
      g.fillRect(x + 1.2, y + 1.2, bw - 2.4, rh - 2.4);
    }
  }
}
function makeBrick(n) {
  const [c, g] = cnv(n); brickPattern(g, n, 24, 9);
  const nz = field(n, 8, 5, 3), nz2 = field(n, 32, 3, 4);
  const [hc, hg] = cnv(n); hg.drawImage(c, 0, 0);
  pixels(g, n, n, (x, y, i, p) => {
    const grime = nz[i] * 0.55 + nz2[i] * 0.25, streak = Math.sin(x * 0.21 + nz[i] * 6) * 0.5 + 0.5;
    const s = 0.62 + grime * 0.55 - streak * 0.08 * nz[i];
    p[0] = clamp(p[0] * s - 6); p[1] = clamp(p[1] * s - 4); p[2] = clamp(p[2] * s - 2);
  });
  pixels(hg, n, n, (x, y, i, p) => { const mortar = p[0] > 85 && p[1] > 80 && Math.abs(p[0] - p[2]) < 15; const v = mortar ? 60 : 190 + nz2[i] * 60; p[0] = p[1] = p[2] = clamp(v); });
  return { map: tex(c), bump: tex(hc, { srgb: false }), canvas: c };
}

// facade bay: 4 m wide x 3.6 m tall of brick with one window
function makeFacade(n, kind, brickCanvas) {
  const [c, g] = cnv(n), [e, eg] = cnv(n / 4);
  g.drawImage(brickCanvas, 0, 0, n, n * 0.9, 0, 0, n, n); g.drawImage(brickCanvas, 0, 0, n, n * 0.9, 0, 0, n, n);
  eg.fillStyle = '#000'; eg.fillRect(0, 0, n / 4, n / 4);
  const ww = n * 0.3, wh = n * 0.44, wx = (n - ww) / 2, wy = n * 0.22;
  // lintel and sill
  g.fillStyle = '#6a6460'; g.fillRect(wx - n * 0.02, wy - n * 0.035, ww + n * 0.04, n * 0.035); g.fillRect(wx - n * 0.025, wy + wh, ww + n * 0.05, n * 0.03);
  g.fillStyle = '#1d1b1a'; g.fillRect(wx, wy, ww, wh);
  if (kind === 'boarded') {
    for (let i = 0; i < 6; i++) { const y = wy + i * wh / 6; g.fillStyle = `rgb(${70 + R() * 30 | 0},${52 + R() * 20 | 0},${36 + R() * 12 | 0})`; g.save(); g.translate(wx + ww / 2, y + wh / 12); g.rotate((R() - 0.5) * 0.08); g.fillRect(-ww * 0.56, -wh / 14, ww * 1.12, wh / 7.4); g.restore(); }
    g.fillStyle = '#222'; for (let i = 0; i < 12; i++) g.fillRect(wx + (i % 2 ? ww * 0.08 : ww * 0.86), wy + (i >> 1) * wh / 6 + wh / 14, 3, 3);
  } else {
    const lit = kind === 'lit';
    const gr = g.createLinearGradient(wx, wy, wx + ww, wy + wh);
    if (lit) { gr.addColorStop(0, '#6b4220'); gr.addColorStop(1, '#2b170a'); } else { gr.addColorStop(0, '#2a3038'); gr.addColorStop(0.5, '#0d0f12'); gr.addColorStop(1, '#171a1f'); }
    g.fillStyle = gr; g.fillRect(wx + 4, wy + 4, ww - 8, wh - 8);
    if (lit) {
      // drawn blinds, a little warm light leaking through
      for (let y = wy + 6; y < wy + wh - 6; y += 7) { g.fillStyle = 'rgba(30,18,8,0.55)'; g.fillRect(wx + 5, y, ww - 10, 3); }
      const ex = e.width / n; const gl = eg.createRadialGradient((wx + ww / 2) * ex, (wy + wh / 2) * ex, 2, (wx + ww / 2) * ex, (wy + wh / 2) * ex, ww * ex * 0.7);
      gl.addColorStop(0, '#a8682c'); gl.addColorStop(1, '#2a1406'); eg.fillStyle = gl; eg.fillRect(wx * ex, wy * ex, ww * ex, wh * ex);
    }
    if (kind === 'broken') { g.fillStyle = '#050505'; g.beginPath(); g.moveTo(wx + ww * 0.2, wy + wh * 0.1); for (let i = 0; i < 9; i++) g.lineTo(wx + ww * (0.15 + R() * 0.7), wy + wh * (0.1 + R() * 0.8)); g.fill(); }
    g.strokeStyle = '#3c3a37'; g.lineWidth = n * 0.012; g.strokeRect(wx + 3, wy + 3, ww - 6, wh - 6);
    g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.moveTo(wx, wy + wh * 0.45); g.lineTo(wx + ww, wy + wh * 0.45); g.stroke();
  }
  // soot streaks under the sill
  for (let i = 0; i < 14; i++) { const x = wx + R() * ww, l = n * (0.05 + R() * 0.25); const gr = g.createLinearGradient(0, wy + wh, 0, wy + wh + l); gr.addColorStop(0, 'rgba(10,8,6,0.35)'); gr.addColorStop(1, 'rgba(10,8,6,0)'); g.fillStyle = gr; g.fillRect(x, wy + wh + n * 0.03, 2 + R() * 5, l); }
  return { map: tex(c), emissive: tex(e) };
}

// ------------------------------------------------------------- ground
function makeAsphalt(n) {
  const [c, g] = cnv(n); const a = field(n, 16, 5, 11), b = field(n, 4, 4, 12), sp = seeded(77);
  pixels(g, n, n, (x, y, i, p) => { const v = 26 + a[i] * 30 + b[i] * 22 + (sp() < 0.08 ? sp() * 40 : 0); p[0] = clamp(v); p[1] = clamp(v * 0.98); p[2] = clamp(v * 0.95); p[3] = 255; });
  cracks(g, n, 9, 'rgba(8,8,8,0.8)');
  for (let i = 0; i < 6; i++) { const x = R() * n, y = R() * n, r = 20 + R() * 60; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(5,5,6,0.5)'); gr.addColorStop(1, 'rgba(5,5,6,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  return { map: tex(c), bump: bumpFrom(c, n) };
}
function makeConcrete(n, tint = [1, 1, 1], joints = true) {
  const [c, g] = cnv(n); const a = field(n, 8, 5, 21), b = field(n, 64, 2, 22);
  pixels(g, n, n, (x, y, i, p) => { const v = 70 + a[i] * 55 + b[i] * 18; p[0] = clamp(v * tint[0]); p[1] = clamp(v * tint[1]); p[2] = clamp(v * tint[2]); p[3] = 255; });
  if (joints) { g.fillStyle = 'rgba(20,20,20,0.7)'; g.fillRect(0, 0, n, 2); g.fillRect(0, 0, 2, n); }
  cracks(g, n, 5, 'rgba(25,24,22,0.7)');
  for (let i = 0; i < 8; i++) { const x = R() * n, y = R() * n, r = 15 + R() * 50; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(30,26,20,0.45)'); gr.addColorStop(1, 'rgba(30,26,20,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  return { map: tex(c), bump: bumpFrom(c, n) };
}
function makeGravel(n) {
  const [c, g] = cnv(n); const a = field(n, 8, 4, 31), sp = seeded(32);
  pixels(g, n, n, (x, y, i, p) => { const v = 40 + a[i] * 40; p[0] = clamp(v * 1.1); p[1] = clamp(v); p[2] = clamp(v * 0.85); p[3] = 255; });
  for (let i = 0; i < n * n / 30; i++) { const x = sp() * n, y = sp() * n, r = 0.8 + sp() * 2.2, v = 50 + sp() * 90; g.fillStyle = `rgb(${v | 0},${v * 0.95 | 0},${v * 0.88 | 0})`; g.beginPath(); g.ellipse(x, y, r, r * (0.6 + sp() * 0.4), sp() * 3, 0, 7); g.fill(); }
  return { map: tex(c), bump: bumpFrom(c, n) };
}
function cracks(g, n, count, col) {
  g.strokeStyle = col; g.lineCap = 'round';
  for (let k = 0; k < count; k++) {
    let x = R() * n, y = R() * n, a = R() * 6.28; g.lineWidth = 0.8 + R() * 1.6; g.beginPath(); g.moveTo(x, y);
    const steps = 10 + R() * 30;
    for (let s = 0; s < steps; s++) { a += (R() - 0.5) * 0.9; x += Math.cos(a) * 6; y += Math.sin(a) * 6; g.lineTo(x, y); if (R() < 0.08) { g.moveTo(x, y); } }
    g.stroke();
  }
}
function bumpFrom(c, n) {
  const [h, hg] = cnv(n); hg.drawImage(c, 0, 0);
  pixels(hg, n, n, (x, y, i, p) => { const v = (p[0] + p[1] + p[2]) / 3; p[0] = p[1] = p[2] = v; });
  return tex(h, { srgb: false });
}

// --------------------------------------------------------------- metal
function makeCorrugated(n, base = [92, 88, 80]) {
  const [c, g] = cnv(n); const a = field(n, 8, 5, 41), b = field(n, 32, 3, 42);
  pixels(g, n, n, (x, y, i, p) => {
    const rib = Math.sin(x / n * Math.PI * 2 * 16) * 0.5 + 0.5;
    const rust = Math.max(0, a[i] * 1.6 - 0.75 + (y / n) * 0.35) + Math.max(0, b[i] - 0.7) * 0.8;
    const l = 0.55 + rib * 0.35 + b[i] * 0.15;
    p[0] = clamp(base[0] * l * (1 - rust) + 120 * rust * l); p[1] = clamp(base[1] * l * (1 - rust) + 52 * rust * l); p[2] = clamp(base[2] * l * (1 - rust) + 24 * rust * l); p[3] = 255;
  });
  const [h, hg] = cnv(n); pixels(hg, n, n, (x, y, i, p) => { const v = (Math.sin(x / n * Math.PI * 2 * 16) * 0.5 + 0.5) * 200 + 30; p[0] = p[1] = p[2] = v; p[3] = 255; });
  return { map: tex(c), bump: tex(h, { srgb: false }) };
}
function makePaintedMetal(n, base) {
  const [c, g] = cnv(n); const a = field(n, 6, 5, 51), b = field(n, 24, 3, 52);
  pixels(g, n, n, (x, y, i, p) => {
    const rust = Math.max(0, a[i] * 1.8 - 0.95) * 2 + Math.max(0, b[i] - 0.78) * 2;
    const r = Math.min(1, rust), l = 0.75 + b[i] * 0.35;
    p[0] = clamp((base[0] * (1 - r) + 110 * r) * l); p[1] = clamp((base[1] * (1 - r) + 48 * r) * l); p[2] = clamp((base[2] * (1 - r) + 22 * r) * l); p[3] = 255;
  });
  return { map: tex(c), bump: bumpFrom(c, n) };
}
function makeCharred(n) {
  const [c, g] = cnv(n); const a = field(n, 8, 5, 61), b = field(n, 32, 3, 62);
  pixels(g, n, n, (x, y, i, p) => { const rust = Math.max(0, a[i] * 1.7 - 0.85); const v = 14 + b[i] * 22; p[0] = clamp(v + rust * 150); p[1] = clamp(v + rust * 60); p[2] = clamp(v + rust * 25); p[3] = 255; });
  return { map: tex(c), bump: bumpFrom(c, n) };
}
function makeWood(n, dark = 1) {
  const [c, g] = cnv(n); const a = field(n, 4, 4, 71);
  const planks = 6;
  pixels(g, n, n, (x, y, i, p) => {
    const pl = Math.floor(y / n * planks), grain = Math.sin((x / n) * 40 + a[i] * 18 + pl * 3) * 0.5 + 0.5, edge = (y / n * planks) % 1;
    let v = (0.6 + grain * 0.25 + a[i] * 0.3) * (edge < 0.04 || edge > 0.96 ? 0.35 : 1) * dark;
    p[0] = clamp(118 * v); p[1] = clamp(86 * v); p[2] = clamp(56 * v); p[3] = 255;
  });
  return { map: tex(c), bump: bumpFrom(c, n) };
}
function makeChainlink(n) {
  const [c, g] = cnv(n); g.clearRect(0, 0, n, n);
  g.strokeStyle = '#b8bcc0'; g.lineWidth = n / 64; const s = n / 8;
  for (let i = -8; i <= 16; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s + n, n); g.stroke(); g.beginPath(); g.moveTo(i * s + n, 0); g.lineTo(i * s, n); g.stroke(); }
  return tex(c);
}

// ------------------------------------------------------------ graffiti
const TAGS = ['HOODS', 'NO WAY OUT', 'SMILE', 'CARCER', 'WE SEE U', 'RUN', 'KEEP OUT', 'DEAD END', 'LIVE ON TAPE', '187', 'STAY DARK'];
function makeGraffiti(i) {
  const [c, g] = cnv(512, 256); const rr = seeded(500 + i * 17);
  const cols = [['#c8261e', '#1a0606'], ['#e8e2d0', '#151515'], ['#2e7ad8', '#0a1830'], ['#e0b81c', '#2a1e04'], ['#58c43c', '#0c2006'], ['#d03ca8', '#200818']];
  const [fill, edge] = cols[Math.floor(rr() * cols.length)], word = TAGS[i % TAGS.length];
  g.translate(256, 128); g.rotate((rr() - 0.5) * 0.25);
  const size = word.length > 7 ? 64 : 104;
  g.font = `900 ${size}px Impact, "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = 14; g.strokeStyle = edge; g.strokeText(word, 0, 0);
  g.fillStyle = fill; g.fillText(word, 0, 0);
  g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.25)'; g.strokeText(word, -2, -2);
  // drips
  g.fillStyle = fill; const w = g.measureText(word).width;
  for (let k = 0; k < 10; k++) { const x = (rr() - 0.5) * w, y = size * 0.25, l = 8 + rr() * 50; g.fillRect(x, y, 2.5, l); g.beginPath(); g.arc(x + 1.2, y + l, 2.4, 0, 7); g.fill(); }
  // overspray
  g.globalAlpha = 0.15; for (let k = 0; k < 400; k++) { const x = (rr() - 0.5) * w * 1.2, y = (rr() - 0.5) * size * 1.4; g.fillRect(x, y, 1.5, 1.5); }
  return tex(c, { repeat: false });
}

// --------------------------------------------------------------- blood
function makeBlood(i) {
  const n = 256, [c, g] = cnv(n); const rr = seeded(900 + i * 31);
  g.translate(n / 2, n / 2);
  const main = (r, col) => { g.fillStyle = col; g.beginPath(); const k = 18; for (let j = 0; j <= k; j++) { const a = j / k * Math.PI * 2, rad = r * (0.75 + rr() * 0.4); j ? g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad) : g.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); } g.fill(); };
  if (i === 3) { // streak
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(${90 + rr() * 30 | 0},4,6,${0.5 + rr() * 0.4})`; g.beginPath(); g.ellipse(-90 + k * 4.5, (rr() - 0.5) * 8, 10 - k * 0.2, 6 - k * 0.12, 0, 0, 7); g.fill(); }
  } else {
    main(60 - i * 8, 'rgba(70,2,4,0.95)'); main(48 - i * 8, 'rgba(110,6,8,0.92)');
    for (let k = 0; k < 16; k++) { const a = rr() * 6.28, d = 55 + rr() * 60, r = 2 + rr() * 9; g.fillStyle = 'rgba(100,4,6,0.9)'; g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, r, 0, 7); g.fill(); }
  }
  // glossy edge darkening
  const gr = g.createRadialGradient(0, 0, 10, 0, 0, 120); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(20,0,0,0.6)');
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = gr; g.fillRect(-n, -n, n * 2, n * 2);
  return tex(c, { repeat: false });
}

// ---------------------------------------------------------------- masks
function makeMask(kind) {
  const [c, g] = cnv(256); const rr = seeded(kind === 'hockey' ? 5 : kind === 'skull' ? 6 : 7);
  if (kind === 'hockey') {
    g.fillStyle = '#d8d2c2'; g.fillRect(0, 0, 256, 256);
    const a = field(256, 8, 4, 81); pixels(g, 256, 256, (x, y, i, p) => { const v = 0.82 + a[i] * 0.25; p[0] = clamp(p[0] * v); p[1] = clamp(p[1] * v); p[2] = clamp(p[2] * v * 0.97); });
    g.fillStyle = 'rgba(120,20,16,0.85)'; // red chevrons
    g.beginPath(); g.moveTo(60, 70); g.lineTo(100, 52); g.lineTo(104, 62); g.lineTo(66, 80); g.fill();
    g.beginPath(); g.moveTo(196, 70); g.lineTo(156, 52); g.lineTo(152, 62); g.lineTo(190, 80); g.fill();
    g.strokeStyle = 'rgba(60,40,30,0.4)'; g.lineWidth = 1.5; for (let k = 0; k < 7; k++) { g.beginPath(); let x = rr() * 256, y = rr() * 256; g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (rr() - 0.5) * 30; y += (rr() - 0.5) * 30; g.lineTo(x, y); } g.stroke(); }
    g.globalCompositeOperation = 'destination-out';
    g.beginPath(); g.ellipse(88, 104, 24, 15, -0.15, 0, 7); g.ellipse(168, 104, 24, 15, 0.15, 0, 7); g.fill();
    for (let k = 0; k < 14; k++) { g.beginPath(); g.arc(98 + (k % 5) * 15, 178 + Math.floor(k / 5) * 13, 3.5, 0, 7); g.fill(); }
    g.beginPath(); g.ellipse(128, 150, 7, 4, 0, 0, 7); g.fill();
  } else if (kind === 'skull') {
    g.fillStyle = '#141414'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#cfc9bc';
    g.beginPath(); g.ellipse(128, 96, 78, 74, 0, 0, 7); g.fill(); g.fillRect(84, 140, 88, 60);
    g.fillStyle = '#141414'; g.beginPath(); g.ellipse(96, 104, 22, 20, 0.2, 0, 7); g.ellipse(160, 104, 22, 20, -0.2, 0, 7); g.fill();
    g.beginPath(); g.moveTo(128, 124); g.lineTo(118, 146); g.lineTo(138, 146); g.fill();
    for (let k = 0; k < 6; k++) g.fillRect(90 + k * 14, 166, 3, 34);
    g.fillRect(84, 178, 88, 3);
  } else { // knit balaclava
    const a = field(256, 32, 2, 91);
    pixels(g, 256, 256, (x, y, i, p) => { const knit = (Math.sin(x * 1.6) * Math.sin(y * 0.8 + (x % 8 < 4 ? 1.5 : 0))) * 0.5 + 0.5; const v = 18 + knit * 14 + a[i] * 10; p[0] = clamp(v); p[1] = clamp(v); p[2] = clamp(v * 1.05); p[3] = 255; });
  }
  return tex(c, { repeat: false });
}

// ---------------------------------------------------------------- cloth
function makeKnit(n, seed) {
  const [c, g] = cnv(n); const a = field(n, 16, 3, seed), b = field(n, 4, 3, seed + 1);
  pixels(g, n, n, (x, y, i, p) => { const k = Math.sin(x * 2.2 + Math.sin(y * 1.1) * 1.5) * 0.5 + 0.5; const v = 150 + k * 40 + a[i] * 45 - b[i] * 50; p[0] = p[1] = p[2] = clamp(v); p[3] = 255; });
  return { map: tex(c), bump: bumpFrom(c, n) };
}
function makeDenim(n) {
  const [c, g] = cnv(n); const a = field(n, 8, 4, 101), b = field(n, 2, 3, 102);
  pixels(g, n, n, (x, y, i, p) => { const tw = ((x + y) % 4 < 2) ? 1 : 0.82; const fade = 0.7 + b[i] * 0.5; const v = tw * fade * (0.8 + a[i] * 0.3); p[0] = clamp(44 * v); p[1] = clamp(58 * v); p[2] = clamp(86 * v); p[3] = 255; });
  return { map: tex(c), bump: bumpFrom(c, n) };
}
function makeSkinDetail(n) {
  const [c, g] = cnv(n); const a = field(n, 64, 2, 111), b = field(n, 16, 3, 112);
  pixels(g, n, n, (x, y, i, p) => { const pore = a[i] > 0.72 ? 70 : 0; const crease = Math.abs(Math.sin(y / n * Math.PI * 22 + b[i] * 4)) < 0.06 ? 50 : 0; const v = 190 - pore - crease + b[i] * 40; p[0] = p[1] = p[2] = clamp(v); p[3] = 255; });
  return tex(c, { srgb: false });
}
function makeGlow() {
  const [c, g] = cnv(128); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return tex(c, { repeat: false });
}
function makeFlame() {
  const [c, g] = cnv(64, 128); const gr = g.createRadialGradient(32, 96, 2, 32, 80, 60);
  gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.25, 'rgba(255,170,60,0.9)'); gr.addColorStop(0.6, 'rgba(200,60,10,0.4)'); gr.addColorStop(1, 'rgba(80,10,0,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(32, 2); g.bezierCurveTo(60, 50, 64, 120, 32, 126); g.bezierCurveTo(0, 120, 4, 50, 32, 2); g.fill();
  return tex(c, { repeat: false });
}
function makeBeam() { // soft flashlight cone falloff along the cone (v) and across (u)
  const [c, g] = cnv(64, 256);
  pixels(g, 64, 256, (x, y, i, p) => { const u = Math.abs(x / 63 - 0.5) * 2, v = y / 255; const a = Math.pow(1 - u, 2.2) * Math.pow(1 - v, 1.6) * 0.9; p[0] = p[1] = p[2] = 255; p[3] = clamp(a * 255); });
  return tex(c, { repeat: false });
}
function makeLabel(text, bg, fg, w = 256, h = 128) {
  const [c, g] = cnv(w, h); g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = `bold ${h * 0.34}px Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2);
  return tex(c, { repeat: false });
}

export function paintAll(low) {
  const n = low ? 256 : 512;
  const brick = makeBrick(n);
  T.brick = brick;
  T.facade = ['dark', 'dark', 'boarded', 'lit', 'broken', 'dark'].map((k) => makeFacade(n, k, brick.canvas));
  T.asphalt = makeAsphalt(n);
  T.concrete = makeConcrete(n);
  T.slab = makeConcrete(n, [0.92, 0.95, 1.0], true);
  T.gravel = makeGravel(n);
  T.corrugated = makeCorrugated(n);
  T.dumpster = makePaintedMetal(n / 2, [34, 70, 44]);
  T.barrel = makePaintedMetal(n / 2, [70, 40, 30]);
  T.van = makePaintedMetal(n / 2, [150, 146, 136]);
  T.charred = makeCharred(n / 2);
  T.wood = makeWood(n / 2);
  T.crate = makeWood(n / 2, 1.2);
  T.chain = makeChainlink(128);
  T.graffiti = TAGS.map((_, i) => makeGraffiti(i));
  T.blood = [0, 1, 2, 3].map(makeBlood);
  T.mask = { hockey: makeMask('hockey'), skull: makeMask('skull'), knit: makeMask('knit') };
  T.knit = makeKnit(n / 2, 121); T.fleece = makeKnit(n / 2, 131);
  T.denim = makeDenim(n / 2);
  T.skin = makeSkinDetail(256);
  T.glow = makeGlow(); T.flame = makeFlame(); T.beam = makeBeam();
  T.exit = makeLabel('EXIT', '#0d3a12', '#5cff6a');
  T.noEntry = makeLabel('NO ENTRY', '#e8e0c8', '#a01010');
  return T;
}
