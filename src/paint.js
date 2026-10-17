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
// Real proportions: the texture tiles every 4 m, so 52 courses (77 mm) of 18
// bricks (222 mm) in running bond with ~10 mm recessed mortar. Each brick gets
// its own fired colour, sand speckle, chipped arrises; some are spalled or
// burnt; then the whole wall is aged: soot, rain streaks, salt bloom, damp.
function hash2(a, b) { let h = Math.imul(a * 374761393 + b * 668265263 | 0, 1274126177); h ^= h >>> 13; h = Math.imul(h, 1103515245); return ((h ^ h >>> 16) >>> 0) / 4294967296; }
const FIRED = [[132, 60, 42], [146, 72, 48], [118, 52, 38], [154, 86, 60], [104, 48, 36], [126, 68, 52], [140, 64, 40], [112, 60, 48]];
function makeBrick(n) {
  const rows = 52, per = 18, rh = n / rows, bw = n / per, mort = Math.max(1.6, n * 0.0024);
  const fine = field(n, 128, 2, 31), mid = field(n, 32, 3, 32), big = field(n, 4, 4, 33), damp = field(n, 6, 3, 34);
  // rain streaks: a smooth 1-D noise across the wall, stretched down it
  const col = new Float32Array(n), cr = seeded(35), cells = 48, g1 = Array.from({ length: cells }, () => cr());
  for (let x = 0; x < n; x++) { const f = x / n * cells, i = Math.floor(f), t = f - i, s = t * t * (3 - 2 * t); col[x] = g1[i % cells] + (g1[(i + 1) % cells] - g1[i % cells]) * s; }
  const H = new Float32Array(n * n);
  const [c, g] = cnv(n);
  pixels(g, n, n, (x, y, i, p) => {
    const r = Math.floor(y / rh), off = (r % 2) * bw / 2;
    const bx = Math.floor(((x - off) % n + n) % n / bw), id = (r % rows) * 97 + bx;
    const u = (((x - off) % n + n) % n) - bx * bw, v = y - r * rh;
    const k = hash2(id, 1), k2 = hash2(id, 2), k3 = hash2(id, 3);
    // distance into the brick from its edge, with chipped, uneven arrises
    const edge = Math.min(u, bw - u, v, rh - v) - mort / 2 - (mid[i] - 0.5) * 2.2 - (fine[i] > 0.82 ? 1.2 : 0);
    let h, cR, cG, cB;
    if (edge <= 0) { // mortar: sandy grey, crumbly, recessed
      const m = 0.82 + fine[i] * 0.3 - mid[i] * 0.12;
      cR = 128 * m; cG = 121 * m; cB = 110 * m; h = 0.18 + fine[i] * 0.12;
    } else {
      const base = k < 0.06 ? [64, 38, 32] : FIRED[Math.floor(k2 * FIRED.length)];
      const tone = 0.86 + k3 * 0.26 + (mid[i] - 0.5) * 0.18 + (fine[i] - 0.5) * 0.16;
      cR = base[0] * tone; cG = base[1] * tone; cB = base[2] * tone;
      // fired skin darker toward the arrises, sand specks and black grog
      const rim = Math.min(1, edge / 3); cR *= 0.88 + rim * 0.12; cG *= 0.88 + rim * 0.12; cB *= 0.9 + rim * 0.1;
      const sp = hash2(x * 7 + 3, y * 13 + 5); if (sp > 0.985) { cR *= 0.45; cG *= 0.45; cB *= 0.45; } else if (sp < 0.012) { cR += 30; cG += 22; cB += 14; }
      h = 0.62 + Math.min(1, edge / 2.4) * 0.3 + (fine[i] - 0.5) * 0.08 - (sp > 0.985 ? 0.1 : 0);
      // spalled face: frost has blown the skin off, exposing paler, rougher clay
      if (hash2(id, 4) < 0.07 && mid[i] + (hash2(id, 5) - 0.5) * 0.4 > 0.5 && edge > 1) { cR = 150 * tone + 10; cG = 92 * tone; cB = 66 * tone; h = 0.42 + fine[i] * 0.14; }
    }
    // weathering over the whole wall (big noise tiles, so it never seams)
    const soot = Math.max(0, big[i] - 0.45) * 1.3, streak = Math.pow(col[x], 3) * (0.4 + damp[i] * 0.6);
    let d = 1 - soot * 0.55 - streak * 0.35 - fine[i] * 0.05;
    cR *= d; cG *= d; cB *= d * 0.97;
    const salt = Math.max(0, damp[i] - 0.6) * 2.4 * (edge <= 0 ? 1 : 0.45 + Math.max(0, 0.6 - edge / 6));
    cR += (178 - cR) * salt * 0.55; cG += (172 - cG) * salt * 0.55; cB += (160 - cB) * salt * 0.55;
    const wet = Math.max(0, 0.42 - damp[i]) * 1.4; cR *= 1 - wet * 0.3; cG *= 1 - wet * 0.26; cB *= 1 - wet * 0.22; // damp, faintly green-black
    p[0] = clamp(cR); p[1] = clamp(cG); p[2] = clamp(cB); p[3] = 255;
    H[i] = h;
  });
  // height -> tangent-space normal map (canvas y runs down = -v)
  const [nc, ng] = cnv(n), s = 3.2;
  pixels(ng, n, n, (x, y, i, p) => {
    const hx = H[y * n + (x + 1) % n] - H[y * n + (x - 1 + n) % n], hy = H[((y + 1) % n) * n + x] - H[((y - 1 + n) % n) * n + x];
    let nx = -hx * s, ny = hy * s, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    p[0] = (nx * 0.5 + 0.5) * 255; p[1] = (ny * 0.5 + 0.5) * 255; p[2] = (nz * 0.5 + 0.5) * 255; p[3] = 255;
  });
  const [hc, hg] = cnv(n); pixels(hg, n, n, (x, y, i, p) => { p[0] = p[1] = p[2] = H[i] * 255; p[3] = 255; });
  // mortar and spalls are dull; fired brick skin a touch less so
  const [rc, rg] = cnv(n); pixels(rg, n, n, (x, y, i, p) => { const v = H[i] < 0.5 ? 1 : 0.86 - (H[i] - 0.6) * 0.3; p[0] = p[1] = p[2] = clamp(v * 255); p[3] = 255; });
  return { map: tex(c), bump: tex(hc, { srgb: false }), normal: tex(nc, { srgb: false }), rough: tex(rc, { srgb: false }), canvas: c };
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
// ---------------------------------------------------------------- ground
// Floors are built like the brick: colour C, height H and roughness G per
// pixel, then H becomes a normal map. Each tile covers ~3.6 m of ground.
function surf(n) { return { n, C: new Float32Array(n * n * 3), H: new Float32Array(n * n).fill(0.5), G: new Float32Array(n * n).fill(0.9) }; }
// visit every pixel of a disc (wrapping round the tile) with f(index, t) where t = 0 centre .. 1 edge
function disc(n, cx, cy, rx, ry, f) {
  const r = Math.max(rx, ry);
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    const dx = (x - cx) / rx, dy = (y - cy) / ry, t = dx * dx + dy * dy; if (t >= 1) continue;
    f(((y % n + n) % n) * n + ((x % n + n) % n), Math.sqrt(t));
  }
}
// a wobbly line network drawn into a mask (cracks, tar seal) -> Float32 0..1
function lineMask(n, count, w0, w1, seed, len = [10, 40]) {
  const [c, g] = cnv(n), r = seeded(seed); g.strokeStyle = '#fff'; g.lineCap = g.lineJoin = 'round';
  for (let k = 0; k < count; k++) {
    let x = r() * n, y = r() * n, a = r() * 6.28; const steps = len[0] + r() * (len[1] - len[0]); g.lineWidth = w0 + r() * (w1 - w0);
    const pts = [[x, y]]; for (let s = 0; s < steps; s++) { a += (r() - 0.5) * 0.8; x += Math.cos(a) * n / 170; y += Math.sin(a) * n / 170; pts.push([x, y]); if (r() < 0.05) { const b = a + (r() < 0.5 ? 1 : -1) * (0.6 + r()); let bx = x, by = y; g.beginPath(); g.moveTo(bx, by); for (let j = 0; j < 4 + r() * 8; j++) { bx += Math.cos(b) * n / 170; by += Math.sin(b) * n / 170; g.lineTo(bx, by); } g.stroke(); } }
    for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) { g.beginPath(); g.moveTo(pts[0][0] + ox, pts[0][1] + oy); for (const q of pts) g.lineTo(q[0] + ox, q[1] + oy); g.stroke(); }
  }
  const d = g.getImageData(0, 0, n, n).data, m = new Float32Array(n * n); for (let i = 0; i < n * n; i++) m[i] = d[i * 4 + 3] / 255; return m;
}
function bake(S, strength = 3) {
  const { n, C, H, G } = S, [c, g] = cnv(n), [nc, ng] = cnv(n), [hc, hg] = cnv(n), [rc, rg] = cnv(n);
  pixels(g, n, n, (x, y, i, p) => { p[0] = clamp(C[i * 3]); p[1] = clamp(C[i * 3 + 1]); p[2] = clamp(C[i * 3 + 2]); p[3] = 255; });
  pixels(ng, n, n, (x, y, i, p) => {
    const hx = H[y * n + (x + 1) % n] - H[y * n + (x - 1 + n) % n], hy = H[((y + 1) % n) * n + x] - H[((y - 1 + n) % n) * n + x];
    let ax = -hx * strength, ay = hy * strength; const l = Math.hypot(ax, ay, 1);
    p[0] = (ax / l * 0.5 + 0.5) * 255; p[1] = (ay / l * 0.5 + 0.5) * 255; p[2] = (1 / l * 0.5 + 0.5) * 255; p[3] = 255;
  });
  pixels(hg, n, n, (x, y, i, p) => { p[0] = p[1] = p[2] = clamp(H[i] * 255); p[3] = 255; });
  pixels(rg, n, n, (x, y, i, p) => { p[0] = p[1] = p[2] = clamp(G[i] * 255); p[3] = 255; });
  return { map: tex(c), bump: tex(hc, { srgb: false }), normal: tex(nc, { srgb: false }), rough: tex(rc, { srgb: false }), canvas: c };
}
const mulC = (S, i, k) => { S.C[i * 3] *= k; S.C[i * 3 + 1] *= k; S.C[i * 3 + 2] *= k; };
const mixC = (S, i, col, t) => { for (let j = 0; j < 3; j++) S.C[i * 3 + j] += (col[j] - S.C[i * 3 + j]) * t; };

// worn city asphalt: dark binder, exposed stone chips, alligator cracking,
// tar-sealed cracks, oil stains, a couple of patched potholes
function makeAsphalt(n) {
  const S = surf(n), big = field(n, 4, 4, 11), mid = field(n, 24, 3, 12), fine = field(n, 128, 2, 13), r = seeded(14);
  for (let i = 0; i < n * n; i++) { const v = 30 + big[i] * 16 + mid[i] * 10 + fine[i] * 8; S.C[i * 3] = v; S.C[i * 3 + 1] = v * 0.98; S.C[i * 3 + 2] = v * 0.94; S.H[i] = 0.45 + fine[i] * 0.1; S.G[i] = 0.82 + fine[i] * 0.12; }
  // aggregate: grey/brown stones, more exposed where traffic wore the binder off
  const chips = n * n / 34 | 0;
  for (let k = 0; k < chips; k++) {
    const x = r() * n, y = r() * n, rad = (0.6 + r() * r() * 2.6) * n / 1024 * 2.4, idx = (y | 0) * n + (x | 0), wear = Math.min(1, Math.max(0, big[idx] * 1.6 - 0.35 + mid[idx] * 0.4));
    const v = 62 + r() * 70, warm = r() * 10, col = [v + warm, v + warm * 0.5, v - 4];
    disc(n, x, y, rad, rad * (0.6 + r() * 0.4), (j, t) => { mixC(S, j, col, (1 - t * t) * (0.25 + wear * 0.6)); S.H[j] += (1 - t * t) * 0.18; S.G[j] = 0.7; });
  }
  // alligator cracking: cracked cells in fatigued patches
  const fat = field(n, 3, 2, 15), cs = n / 22, pts = [];
  for (let gy = 0; gy < 22; gy++) for (let gx = 0; gx < 22; gx++) pts.push([(gx + 0.15 + r() * 0.7) * cs, (gy + 0.15 + r() * 0.7) * cs]);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x; if (fat[i] < 0.56) continue;
    const gx = Math.floor(x / cs), gy = Math.floor(y / cs); let d1 = 1e9, d2 = 1e9;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const cx = (gx + ox + 22) % 22, cy = (gy + oy + 22) % 22, q = pts[cy * 22 + cx]; const px = q[0] + (gx + ox - cx) * cs, py = q[1] + (gy + oy - cy) * cs; const d = Math.hypot(px - x, py - y); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
    const e = d2 - d1, w = 1.2 + (fat[i] - 0.56) * 6;
    if (e < w) { const t = 1 - e / w; mulC(S, i, 1 - t * 0.75); S.H[i] -= t * 0.35; S.G[i] = 0.95; }
  }
  // long cracks, then tar sealant painted over some of them
  const cr = lineMask(n, 7, 1, 2.5, 16), tar = lineMask(n, 4, 7, 12, 17, [20, 60]);
  for (let i = 0; i < n * n; i++) {
    if (cr[i] > 0) { mulC(S, i, 1 - cr[i] * 0.8); S.H[i] -= cr[i] * 0.4; }
    if (tar[i] > 0) { mixC(S, i, [14, 13, 12], tar[i] * 0.9); S.H[i] += tar[i] * 0.04; S.G[i] -= tar[i] * 0.45; }
  }
  // oil stains (dark, slightly glossy) and patched potholes (newer, blacker asphalt, raised edge)
  for (let k = 0; k < 7; k++) { const x = r() * n, y = r() * n, rad = (30 + r() * 70) * n / 1024; disc(n, x, y, rad, rad * (0.5 + r() * 0.5), (j, t) => { const a = (1 - t) * (0.35 + fine[j] * 0.3); mulC(S, j, 1 - a * 0.6); S.G[j] -= a * 0.35; }); }
  for (let k = 0; k < 2; k++) { const x = r() * n, y = r() * n, rx = (50 + r() * 60) * n / 1024, ry = rx * (0.6 + r() * 0.4); disc(n, x, y, rx, ry, (j, t) => { mixC(S, j, [22 + fine[j] * 14, 21 + fine[j] * 13, 20 + fine[j] * 12], 0.85); S.H[j] = 0.5 + fine[j] * 0.06 + (t > 0.9 ? 0.12 : 0); S.G[j] = 0.75; }); }
  return bake(S, 3);
}

// poured concrete slab: saw-cut joints every ~1.8 m with chipped arrises,
// pores, faint aggregate, cracks running off the joints, rust and damp stains
function makeConcrete(n, joints = true) {
  const S = surf(n), big = field(n, 4, 4, 21), mid = field(n, 16, 4, 22), fine = field(n, 128, 2, 23), r = seeded(24);
  for (let i = 0; i < n * n; i++) {
    const v = 92 + big[i] * 30 + mid[i] * 16 + fine[i] * 10, x = i % n, y = (i / n) | 0;
    S.C[i * 3] = v * 1.02; S.C[i * 3 + 1] = v; S.C[i * 3 + 2] = v * 0.93; S.H[i] = 0.5 + mid[i] * 0.06 + fine[i] * 0.06; S.G[i] = 0.88 + fine[i] * 0.1;
    const h = hash2(x * 3 + 1, y * 7 + 2);
    if (h < 0.006) { mulC(S, i, 0.55); S.H[i] -= 0.25; } else if (h > 0.985) { const k = 1.15 + fine[i] * 0.2; mulC(S, i, k); S.H[i] += 0.05; }
    if (joints) {
      const jw = n / 340, jx = Math.min(x % (n / 2), n / 2 - x % (n / 2)), jy = Math.min(y % (n / 2), n / 2 - y % (n / 2)), dj = Math.min(jx, jy);
      const chip = (mid[i] - 0.5) * 3 * n / 1024 + (fine[i] > 0.85 ? 1.5 : 0) * n / 1024;
      if (dj < jw + chip) { const t = dj < jw ? 1 : 0.5; mulC(S, i, 1 - 0.65 * t); S.H[i] -= 0.4 * t; S.G[i] = 0.97; }
      else if (dj < jw * 8) mulC(S, i, 1 - (1 - dj / (jw * 8)) * 0.25); // dirt packed along the joint
    }
  }
  const cr = lineMask(n, 6, 0.8, 2, 25);
  for (let i = 0; i < n * n; i++) if (cr[i] > 0) { mulC(S, i, 1 - cr[i] * 0.7); S.H[i] -= cr[i] * 0.3; }
  // stains: damp/oil (dark, smoother), rust bleeding orange-brown, black gum
  for (let k = 0; k < 9; k++) { const x = r() * n, y = r() * n, rad = (25 + r() * 90) * n / 1024; disc(n, x, y, rad, rad * (0.5 + r() * 0.5), (j, t) => { const a = (1 - t) * (0.25 + mid[j] * 0.35); mulC(S, j, 1 - a * 0.5); S.G[j] -= a * 0.3; }); }
  for (let k = 0; k < 3; k++) { const x = r() * n, y = r() * n, rad = (12 + r() * 30) * n / 1024; disc(n, x, y, rad, rad * 2.2, (j, t) => mixC(S, j, [96, 52, 26], (1 - t) * 0.5 * fine[j] * 1.4)); }
  for (let k = 0; k < 40; k++) { const x = r() * n, y = r() * n, rad = (2 + r() * 4) * n / 1024; disc(n, x, y, rad, rad, (j, t) => { mixC(S, j, [24, 22, 21], 0.85); S.H[j] += 0.05; S.G[j] = 0.6; }); }
  return bake(S, 3);
}

// 30 cm ceramic floor tiles (institution / mall / pens): per-tile shade,
// grimy grout, scuffed glaze, cracked and missing tiles showing the screed
function makeTiles(n) {
  const S = surf(n), per = 12, tw = n / per, gw = Math.max(1.5, n / 400), mid = field(n, 16, 4, 41), fine = field(n, 128, 2, 42), big = field(n, 4, 3, 43);
  const crack = lineMask(n, 10, 0.8, 1.6, 44, [6, 18]);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x, tx = Math.floor(x / tw), ty = Math.floor(y / tw), id = ty * per + tx, u = x - tx * tw, v = y - ty * tw;
    const e = Math.min(u, tw - u, v, tw - v), k = hash2(id, 7);
    if (e < gw / 2) { const g = 70 + fine[i] * 20 - big[i] * 20; S.C[i * 3] = g; S.C[i * 3 + 1] = g * 0.95; S.C[i * 3 + 2] = g * 0.86; S.H[i] = 0.3; S.G[i] = 0.95; continue; }
    if (hash2(id, 9) < 0.02) { const g = 84 + mid[i] * 30 + fine[i] * 14; S.C[i * 3] = g; S.C[i * 3 + 1] = g * 0.97; S.C[i * 3 + 2] = g * 0.9; S.H[i] = 0.2 + fine[i] * 0.1; S.G[i] = 0.98; continue; } // tile gone: rough screed
    const shade = 0.9 + k * 0.14 + (mid[i] - 0.5) * 0.08, base = 168 * shade;
    S.C[i * 3] = base; S.C[i * 3 + 1] = base * 0.97; S.C[i * 3 + 2] = base * 0.9;
    const fleck = hash2(x * 5 + 11, y * 3 + 7); if (fleck > 0.992) mulC(S, i, 0.6); else if (fleck < 0.006) mulC(S, i, 1.12);
    const edgeDirt = Math.max(0, 1 - e / (tw * 0.18)); mulC(S, i, 1 - edgeDirt * 0.3 - big[i] * 0.28);
    S.H[i] = 0.62 + Math.min(1, e / 2.5) * 0.08 + fine[i] * 0.02;
    S.G[i] = 0.32 + big[i] * 0.3 + (1 - mid[i]) * 0.12; // glaze, scuffed dull in the walkways
    if (hash2(id, 11) < 0.12 && crack[i] > 0) { mulC(S, i, 1 - crack[i] * 0.7); S.H[i] -= crack[i] * 0.25; S.G[i] = 0.9; }
  }
  const r = seeded(45);
  for (let k = 0; k < 8; k++) { const x = r() * n, y = r() * n, rad = (30 + r() * 80) * n / 1024; disc(n, x, y, rad, rad * (0.5 + r() * 0.5), (j, t) => { const a = (1 - t) * (0.2 + mid[j] * 0.35); mixC(S, j, [70, 58, 40], a * 0.6); }); }
  return bake(S, 2.5);
}

// packed dirt and gravel: shaded stones bedded in brown earth, damp patches
function makeGravel(n) {
  const S = surf(n), big = field(n, 4, 4, 31), mid = field(n, 24, 3, 32), fine = field(n, 128, 2, 33), r = seeded(34);
  for (let i = 0; i < n * n; i++) { const v = 58 + big[i] * 26 + mid[i] * 18 + fine[i] * 10; S.C[i * 3] = v * 1.12; S.C[i * 3 + 1] = v; S.C[i * 3 + 2] = v * 0.8; S.H[i] = 0.4 + mid[i] * 0.15 + fine[i] * 0.05; S.G[i] = 0.97; }
  const stones = n * n / 26 | 0;
  for (let k = 0; k < stones; k++) {
    const x = r() * n, y = r() * n, rad = (1 + r() * r() * 7) * n / 1024 * 1.6, v = 70 + r() * 80, w = r(), col = [v * (1.02 + w * 0.12), v, v * (0.86 - w * 0.08)];
    disc(n, x, y, rad, rad * (0.55 + r() * 0.45), (j, t) => { const dome = Math.sqrt(1 - t * t); mixC(S, j, col.map((c) => c * (0.7 + dome * 0.4)), 0.92); S.H[j] = Math.max(S.H[j], 0.5 + dome * 0.3 * Math.min(1, rad / 4)); S.G[j] = 0.85; });
  }
  for (let i = 0; i < n * n; i++) { const wet = Math.max(0, 0.4 - big[i]) * 2.2; mulC(S, i, 1 - wet * 0.4); S.G[i] -= wet * 0.4; }
  return bake(S, 3.5);
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
// Blood that reads as blood: thick dark-red bodies with a thinner, brighter
// rim, satellite droplets, tails thrown in the direction of travel, a glossy
// highlight. i: 0-3 round splats, 4-5 directional (travel = +x), 6 streak, 7 pool.
function makeBlood(i) {
  const n = 256, [c, g] = cnv(n), rr = seeded(900 + i * 31);
  const blobPath = (x, y, r, rough = 0.35, k = 28) => { g.beginPath(); const ph = rr() * 6; for (let j = 0; j <= k; j++) { const a = j / k * Math.PI * 2, rad = r * (1 - rough / 2 + rough * (0.5 + 0.5 * Math.sin(a * 3 + ph) * Math.sin(a * 5.3 + ph * 2)) + (rr() - 0.5) * rough * 0.3); const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad; j ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); };
  const drop = (x, y, r, a = 0.92) => { g.fillStyle = `rgba(${60 + rr() * 30 | 0},2,4,${a})`; g.beginPath(); g.ellipse(x, y, r, r * (0.8 + rr() * 0.2), rr() * 3, 0, 7); g.fill(); };
  g.translate(n / 2, n / 2);
  if (i < 4) {
    const R0 = 52 - i * 7;
    g.fillStyle = 'rgba(120,10,10,0.55)'; blobPath(0, 0, R0 * 1.12, 0.45); g.fill(); // thin rim soaks wider
    g.fillStyle = 'rgba(62,2,4,0.97)'; blobPath(0, 0, R0, 0.4); g.fill();
    for (let k = 0; k < 9; k++) { const a = rr() * 6.28, L = R0 * (1.15 + rr() * 0.7), w = 3 + rr() * 5; g.fillStyle = 'rgba(64,2,4,0.95)'; g.save(); g.rotate(a); g.beginPath(); g.moveTo(R0 * 0.7, -w); g.quadraticCurveTo(L * 0.8, -w * 0.25, L, 0); g.quadraticCurveTo(L * 0.8, w * 0.25, R0 * 0.7, w); g.fill(); if (rr() < 0.6) { g.beginPath(); g.ellipse(L + 4 + rr() * 8, 0, 2 + rr() * 3, 1 + rr() * 1.5, 0, 0, 7); g.fill(); } g.restore(); }
    for (let k = 0; k < 40; k++) { const a = rr() * 6.28, d = R0 * (1.2 + rr() * 1.3); drop(Math.cos(a) * d, Math.sin(a) * d, 0.8 + rr() * 3.5 * (1.6 - d / (R0 * 2.5))); }
  } else if (i < 6) { // hit the floor moving: tail of satellite drops ahead, body stretched
    g.fillStyle = 'rgba(62,2,4,0.97)'; g.save(); g.scale(1.7, 0.8); blobPath(-20, 0, 34, 0.35); g.restore(); g.fill();
    for (let k = 0; k < 26; k++) { const t = rr(), x = 20 + t * 95, y = (rr() - 0.5) * (14 + t * 50), r = (1 - t) * 7 + 1; g.fillStyle = 'rgba(66,3,5,0.92)'; g.beginPath(); g.ellipse(x, y, r * 1.8, r, Math.atan2(y, x), 0, 7); g.fill(); }
    for (let k = 0; k < 5; k++) { const y = (rr() - 0.5) * 30; g.strokeStyle = 'rgba(70,3,5,0.9)'; g.lineWidth = 2 + rr() * 3; g.beginPath(); g.moveTo(30, y * 0.4); g.lineTo(60 + rr() * 50, y); g.stroke(); }
  } else if (i === 6) { // streak / smear
    for (let k = 0; k < 50; k++) { const t = k / 50; g.fillStyle = `rgba(${66 + rr() * 30 | 0},3,5,${0.85 - t * 0.5})`; g.beginPath(); g.ellipse(-100 + k * 4.2, (rr() - 0.5) * 6, 12 - t * 8, 9 - t * 5, 0, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(30,0,0,0.35)'; g.lineWidth = 1; for (let k = 0; k < 9; k++) { const y = (rr() - 0.5) * 16; g.beginPath(); g.moveTo(-100, y); g.lineTo(80, y * 0.4); g.stroke(); }
  } else { // pool: one big irregular body with lobes where it ran
    g.fillStyle = 'rgba(46,1,3,0.98)'; blobPath(0, 0, 92, 0.5, 40); g.fill();
    for (let k = 0; k < 6; k++) { const a = rr() * 6.28, d = 70 + rr() * 30; g.beginPath(); g.ellipse(Math.cos(a) * d, Math.sin(a) * d, 18 + rr() * 22, 12 + rr() * 14, a, 0, 7); g.fill(); }
  }
  // thick middles go near-black, a wet highlight off-centre
  g.globalCompositeOperation = 'source-atop';
  const gr = g.createRadialGradient(0, 0, 4, 0, 0, 110); gr.addColorStop(0, 'rgba(18,0,0,0.55)'); gr.addColorStop(0.6, 'rgba(18,0,0,0.15)'); gr.addColorStop(1, 'rgba(140,20,16,0.25)'); g.fillStyle = gr; g.fillRect(-n, -n, n * 2, n * 2);
  const hl = g.createRadialGradient(-14, -18, 0, -14, -18, 30); hl.addColorStop(0, 'rgba(180,80,70,0.22)'); hl.addColorStop(1, 'rgba(180,80,70,0)'); g.fillStyle = hl; g.fillRect(-n, -n, n * 2, n * 2);
  return tex(c, { repeat: false });
}
// an open wound: torn skin edges, raw meat, a dark wet hole, blood welling out
function makeWound(i) {
  const n = 128, [c, g] = cnv(n), rr = seeded(700 + i * 17), L = 30 + rr() * 14, W = 6 + rr() * 6;
  g.translate(n / 2, n / 2 - 16);
  const ph = [rr() * 6, rr() * 6, rr() * 6];
  // a torn outline: smooth lumps (sum of sines), not spikes
  const torn = (l, w, col, rough) => { g.fillStyle = col; g.beginPath(); const k = 48; for (let j = 0; j <= k; j++) { const a = j / k * Math.PI * 2, jag = 1 + rough * (0.5 * Math.sin(a * 5 + ph[0]) + 0.3 * Math.sin(a * 9 + ph[1]) + 0.2 * Math.sin(a * 17 + ph[2])); const px = Math.cos(a) * l * (1 + rough * 0.1 * Math.sin(a * 3 + ph[2])), py = Math.sin(a) * w * jag; j ? g.lineTo(px, py) : g.moveTo(px, py); } g.closePath(); g.fill(); };
  // runs of blood from the lower lip of the wound, thinning as they go
  for (let k = 0; k < 4 + (rr() * 3 | 0); k++) { const x = (rr() - 0.5) * L * 1.5, w = 1.5 + rr() * 3.5, len = 18 + rr() * 50; g.fillStyle = `rgba(${48 + rr() * 20 | 0},1,3,0.92)`; g.beginPath(); g.moveTo(x - w, W * 0.8); g.bezierCurveTo(x - w * 0.8, W + len * 0.5, x - w * 0.3, W + len * 0.85, x + (rr() - 0.5) * 3, W + len); g.bezierCurveTo(x + w * 0.3, W + len * 0.85, x + w * 0.8, W + len * 0.5, x + w, W * 0.8); g.fill(); }
  torn(L * 1.28, W * 2.2, 'rgba(46,1,3,0.9)', 0.35);  // smeared blood round it
  torn(L * 1.04, W * 1.35, 'rgba(70,5,6,1)', 0.3);   // bruised, bloody edges of the skin
  torn(L * 0.92, W * 1.0, 'rgba(98,16,15,1)', 0.25); // raw meat just inside
  for (let k = 0; k < 8; k++) { g.fillStyle = `rgba(${150 + rr() * 30 | 0},${48 + rr() * 20 | 0},${40 + rr() * 15 | 0},0.55)`; g.beginPath(); g.ellipse((rr() - 0.5) * L * 1.3, (rr() - 0.5) * W * 0.8, 3 + rr() * 5, 0.8 + rr(), (rr() - 0.5) * 0.3, 0, 7); g.fill(); } // muscle fibre
  torn(L * 0.78, W * 0.62, 'rgba(24,0,1,1)', 0.3);    // the opening
  torn(L * 0.45, W * 0.28, 'rgba(6,0,0,1)', 0.2);
  g.fillStyle = 'rgba(220,150,140,0.16)'; g.beginPath(); g.ellipse(-L * 0.15, -W * 0.75, L * 0.45, 1.2, 0, 0, 7); g.fill(); // wet glint on the upper lip
  return tex(c, { repeat: false });
}

// ---------------------------------------------------------------- masks
function makeMask(kind) {
  const [c, g] = cnv(256); const rr = seeded(kind === 'hockey' ? 5 : kind === 'skull' ? 6 : 7);
  if (kind === 'smiley') { // a grubby yellow smiley face
    g.fillStyle = '#d8b424'; g.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 50; k++) { g.fillStyle = `rgba(${50 + rr() * 40},${40 + rr() * 30},10,${0.1 + rr() * 0.25})`; g.beginPath(); g.ellipse(rr() * 256, rr() * 256, 4 + rr() * 20, 3 + rr() * 12, rr() * 3, 0, 7); g.fill(); }
    g.fillStyle = '#141008'; g.beginPath(); g.ellipse(92, 100, 12, 22, 0, 0, 7); g.ellipse(164, 100, 12, 22, 0, 0, 7); g.fill();
    g.strokeStyle = '#141008'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.arc(128, 128, 64, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
    g.fillStyle = 'rgba(110,10,8,0.75)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(70 + rr() * 120, 150 + rr() * 80, 3 + rr() * 6, 8 + rr() * 18, 0, 0, 7); g.fill(); }
  } else if (kind === 'swat') { // a black balaclava under the helmet
    g.fillStyle = '#121212'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#060606'; g.beginPath(); g.ellipse(128, 104, 70, 20, 0, 0, 7); g.fill();
  } else if (kind === 'pig') { // a filthy rubber pig's head
    const gr = g.createRadialGradient(128, 120, 20, 128, 120, 150); gr.addColorStop(0, '#d89a8c'); gr.addColorStop(1, '#8a5048'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(${60 + rr() * 40},${30 + rr() * 20},20,${0.15 + rr() * 0.3})`; g.beginPath(); g.ellipse(rr() * 256, rr() * 256, 4 + rr() * 22, 3 + rr() * 14, rr() * 3, 0, 7); g.fill(); }
    g.fillStyle = '#c87a6c'; g.beginPath(); g.ellipse(128, 150, 44, 32, 0, 0, 7); g.fill();            // snout
    g.fillStyle = '#3a1410'; g.beginPath(); g.ellipse(112, 150, 9, 13, 0.2, 0, 7); g.ellipse(144, 150, 9, 13, -0.2, 0, 7); g.fill(); // nostrils
    g.fillStyle = '#1a0a08'; g.beginPath(); g.ellipse(92, 100, 12, 8, -0.2, 0, 7); g.ellipse(164, 100, 12, 8, 0.2, 0, 7); g.fill(); // eye slits
    g.strokeStyle = '#4a1a14'; g.lineWidth = 4; g.beginPath(); g.moveTo(96, 196); g.quadraticCurveTo(128, 214, 160, 196); g.stroke();
    g.fillStyle = 'rgba(90,10,8,0.7)'; for (let k = 0; k < 8; k++) { g.beginPath(); g.ellipse(80 + rr() * 100, 170 + rr() * 70, 3 + rr() * 8, 6 + rr() * 16, 0, 0, 7); g.fill(); } // old blood
  } else if (kind === 'hockey') {
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
  const brick = makeBrick(1024);
  T.brick = brick;
  T.facade = ['dark', 'dark', 'boarded', 'lit', 'broken', 'dark'].map((k) => makeFacade(n, k, brick.canvas));
  T.asphalt = makeAsphalt(1024);
  T.concrete = makeConcrete(1024);
  T.slab = makeTiles(1024);
  T.gravel = makeGravel(1024);
  T.corrugated = makeCorrugated(n);
  T.dumpster = makePaintedMetal(n / 2, [34, 70, 44]);
  T.barrel = makePaintedMetal(n / 2, [70, 40, 30]);
  T.van = makePaintedMetal(n / 2, [150, 146, 136]);
  T.charred = makeCharred(n / 2);
  T.wood = makeWood(n / 2);
  T.crate = makeWood(n / 2, 1.2);
  T.chain = makeChainlink(128);
  T.graffiti = TAGS.map((_, i) => makeGraffiti(i));
  T.blood = [0, 1, 2, 3, 4, 5, 6, 7].map(makeBlood);
  T.wound = [0, 1, 2, 3].map(makeWound);
  T.mask = { hockey: makeMask('hockey'), skull: makeMask('skull'), knit: makeMask('knit'), pig: makeMask('pig'), smiley: makeMask('smiley'), swat: makeMask('swat') };
  T.knit = makeKnit(n / 2, 121); T.fleece = makeKnit(n / 2, 131);
  T.denim = makeDenim(n / 2);
  T.skin = makeSkinDetail(256);
  T.glow = makeGlow(); T.flame = makeFlame(); T.beam = makeBeam();
  T.exit = makeLabel('EXIT', '#0d3a12', '#5cff6a');
  T.noEntry = makeLabel('NO ENTRY', '#e8e0c8', '#a01010');
  return T;
}
