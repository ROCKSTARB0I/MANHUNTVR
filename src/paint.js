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

// tenement facade: 3 x 3 storeys of brick (10.8 m square) with sash windows,
// sills and lintels, dark glass, a few lit rooms behind blinds. Used on the
// street scenes' outer walls (world UV tile 10.8 m).
function makeTenement(n, brickCanvas, seed = 7) {
  const [c, g] = cnv(n), [e, eg] = cnv(n), r = seeded(seed), cell = n / 3;
  const bt = n * 4 / 10.8; // the brick texture covers 4 m; this one covers 10.8 m
  for (let y = 0; y < n; y += bt) for (let x = 0; x < n; x += bt) g.drawImage(brickCanvas, x, y, bt, bt);
  eg.fillStyle = '#000'; eg.fillRect(0, 0, n, n);
  for (let fy = 0; fy < 3; fy++) for (let fx = 0; fx < 3; fx++) {
    const ww = cell * 0.36, wh = cell * 0.5, wx = fx * cell + (cell - ww) / 2, wy = fy * cell + cell * 0.2;
    g.fillStyle = '#5a564e'; g.fillRect(wx - cell * 0.03, wy - cell * 0.05, ww + cell * 0.06, cell * 0.05); g.fillRect(wx - cell * 0.04, wy + wh, ww + cell * 0.08, cell * 0.04); // lintel, sill
    const lit = r() < 0.22, boarded = !lit && r() < 0.15;
    if (boarded) { g.fillStyle = '#4a3a28'; g.fillRect(wx, wy, ww, wh); g.fillStyle = 'rgba(0,0,0,0.4)'; for (let k = 1; k < 4; k++) g.fillRect(wx, wy + wh * k / 4, ww, 2); continue; }
    const gr = g.createLinearGradient(wx, wy, wx + ww, wy + wh); gr.addColorStop(0, lit ? '#8a6a30' : '#1c2024'); gr.addColorStop(1, lit ? '#4a3416' : '#0a0c0e'); g.fillStyle = gr; g.fillRect(wx, wy, ww, wh);
    g.fillStyle = '#2a2622'; g.fillRect(wx + ww / 2 - 2, wy, 4, wh); g.fillRect(wx, wy + wh / 2 - 2, ww, 4); // sash bars
    if (lit) { const eg2 = eg.createLinearGradient(wx, wy, wx, wy + wh); eg2.addColorStop(0, '#b88a40'); eg2.addColorStop(1, '#6a4a1a'); eg.fillStyle = eg2; eg.fillRect(wx, wy, ww, wh); eg.fillStyle = 'rgba(0,0,0,0.5)'; for (let y = wy + 6; y < wy + wh; y += 9) eg.fillRect(wx, y, ww, 3); }
    // grime running down from the sill
    const sg = g.createLinearGradient(0, wy + wh, 0, wy + wh + cell * 0.4); sg.addColorStop(0, 'rgba(20,16,10,0.45)'); sg.addColorStop(1, 'rgba(20,16,10,0)'); g.fillStyle = sg; g.fillRect(wx, wy + wh + cell * 0.04, ww, cell * 0.4);
  }
  return { map: tex(c), emissive: tex(e) };
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


// ---------------------------------------------------------------- gang masks
// Each gang's head gear, painted from the descriptions of the real hunters.
// 'wrap' kinds go all the way round the head (512 wide, the face in the middle
// third); the rest are face plates (256, eyes at 88/168, mouth at ~178).
export const WRAP = new Set(['stocking', 'execRed', 'execBlack', 'gimp', 'balaBlue', 'balaBlack', 'balaRed', 'wrapCamo', 'gasHood', 'swat']);
const maskCache = {};
const rgbS = (c, k = 1) => `rgb(${clamp(Math.pow(c[0], 1 / 2.2) * 255 * k)},${clamp(Math.pow(c[1], 1 / 2.2) * 255 * k)},${clamp(Math.pow(c[2], 1 / 2.2) * 255 * k)})`;
export function gangMask(kind, skin = [0.55, 0.4, 0.3]) {
  const key = kind + (/Paint$/.test(kind) ? skin.join() : ''); if (maskCache[key]) return maskCache[key];
  if (T.mask && T.mask[kind] && !WRAP.has(kind)) return (maskCache[key] = T.mask[kind]);
  const wrap = WRAP.has(kind), W = wrap ? 512 : 256, H = 256, cx = W / 2;
  const [c, g] = cnv(W, H); const rr = seeded(kind.length * 31 + kind.charCodeAt(0));
  const ex = wrap ? 37 : 40, ey = wrap ? 124 : 104, my = wrap ? 185 : 178; // eye spread / eye row / mouth row
  const cloth = (base, cells, amp, seed) => { const a = field(W, cells, 3, seed); g.fillStyle = base; g.fillRect(0, 0, W, H); pixels(g, W, H, (x, y, i, p) => { const v = 1 + (a[i] - 0.5) * amp; p[0] = clamp(p[0] * v); p[1] = clamp(p[1] * v); p[2] = clamp(p[2] * v); }); };
  const knit = (r, gg, b) => pixels(g, W, H, (x, y, i, p) => { const k = (Math.sin(x * 1.6) * Math.sin(y * 0.8 + (x % 8 < 4 ? 1.5 : 0))) * 0.5 + 0.5, v = 0.75 + k * 0.4 + (rr() - 0.5) * 0.1; p[0] = clamp(r * v); p[1] = clamp(gg * v); p[2] = clamp(b * v); p[3] = 255; });
  const skinC = rgbS(skin), skinD = rgbS(skin, 0.55);
  const eyeHoles = (w, h, rim) => { for (const s of [-1, 1]) { g.fillStyle = skinD; g.beginPath(); g.ellipse(cx + s * ex, ey, w + 3, h + 3, -s * 0.12, 0, 7); g.fill(); g.fillStyle = '#0c0807'; g.beginPath(); g.ellipse(cx + s * ex, ey, w, h, -s * 0.12, 0, 7); g.fill(); if (rim) { g.strokeStyle = rim; g.lineWidth = 2.5; g.stroke(); } } };
  const blood = (n, y0 = 0, y1 = H) => { for (let k = 0; k < n; k++) { const x = cx + (rr() - 0.5) * W * (wrap ? 0.4 : 0.8), y = y0 + rr() * (y1 - y0); g.fillStyle = `rgba(${70 + rr() * 50},${4 + rr() * 8},${4 + rr() * 6},${0.55 + rr() * 0.4})`; g.beginPath(); g.ellipse(x, y, 2 + rr() * 9, 2 + rr() * 7, rr() * 3, 0, 7); g.fill(); if (rr() < 0.5) g.fillRect(x - 1, y, 2 + rr() * 2, 10 + rr() * 40); } };
  const scuff = (n, col) => { for (let k = 0; k < n; k++) { g.fillStyle = col.replace('A', (0.06 + rr() * 0.18).toFixed(2)); g.beginPath(); g.ellipse(rr() * W, rr() * H, 4 + rr() * 20, 3 + rr() * 12, rr() * 3, 0, 7); g.fill(); } };
  const text = (t, x, y, size, col, font = 'Impact, sans-serif', rot = 0) => { g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = col; g.font = `bold ${size}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 0, 0); g.restore(); };
  const plate = (fill) => { // a hockey-style face plate: shaped, with breathing holes and eye holes cut through
    g.fillStyle = fill; g.beginPath(); g.ellipse(128, 128, 112, 124, 0, 0, 7); g.fill();
    const a = field(256, 8, 4, 81); pixels(g, 256, 256, (x, y, i, p) => { const v = 0.84 + a[i] * 0.22; p[0] = clamp(p[0] * v); p[1] = clamp(p[1] * v); p[2] = clamp(p[2] * v); });
  };
  const cut = (holes = true) => { g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.ellipse(88, 104, 22, 14, -0.15, 0, 7); g.ellipse(168, 104, 22, 14, 0.15, 0, 7); g.fill(); if (holes) for (let k = 0; k < 14; k++) { g.beginPath(); g.arc(98 + (k % 5) * 15, 182 + Math.floor(k / 5) * 13, 3.5, 0, 7); g.fill(); } g.globalCompositeOperation = 'source-over'; };
  const crack = (x, y, n, len, col = 'rgba(30,24,20,0.85)', w = 1.6) => { g.strokeStyle = col; g.lineWidth = w; for (let k = 0; k < n; k++) { g.beginPath(); let px = x, py = y; g.moveTo(px, py); const a0 = rr() * 6.28; for (let s = 0; s < 6; s++) { px += Math.cos(a0 + (rr() - 0.5)) * len / 6; py += Math.sin(a0 + (rr() - 0.5)) * len / 6; g.lineTo(px, py); } g.stroke(); } };

  switch (kind) {
    case 'stocking': { // tan nylon pulled over the head: features squashed flat, runs and torn holes
      cloth('#7e6450', 24, 0.3, 501);
      const gr = g.createRadialGradient(cx, 150, 10, cx, 150, 110); gr.addColorStop(0, 'rgba(255,230,200,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0.25)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      for (const s of [-1, 1]) { g.fillStyle = 'rgba(40,24,16,0.55)'; g.beginPath(); g.ellipse(cx + s * ex, ey, 20, 11, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(10,6,4,0.8)'; g.beginPath(); g.ellipse(cx + s * ex, ey, 9, 5, 0, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(60,36,24,0.35)'; g.beginPath(); g.ellipse(cx, 156, 12, 16, 0, 0, 7); g.fill(); // flattened nose
      g.fillStyle = 'rgba(70,20,16,0.6)'; g.fillRect(cx - 22, my - 2, 44, 5); // lips pressed under the nylon
      g.strokeStyle = 'rgba(60,40,28,0.5)'; g.lineWidth = 1; for (let k = 0; k < 10; k++) { const x = cx + (rr() - 0.5) * 220; g.beginPath(); g.moveTo(x, rr() * 80); g.lineTo(x + (rr() - 0.5) * 6, 120 + rr() * 130); g.stroke(); } // ladders
      for (let k = 0; k < 5; k++) { const x = cx + (rr() - 0.5) * 160, y = 60 + rr() * 150; g.fillStyle = skinD; g.beginPath(); g.ellipse(x, y, 5 + rr() * 9, 3 + rr() * 6, rr() * 3, 0, 7); g.fill(); } // torn holes
      g.strokeStyle = 'rgba(20,10,8,0.8)'; g.lineWidth = 2; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(cx - ex - 24 + k * 6, ey - 26); g.lineTo(cx - ex - 6 + k * 6, ey + 10); g.stroke(); } // claw tear by the left eye
      break; }
    case 'execRed': case 'execBlack': { // a medieval executioner's hood
      const red = kind === 'execRed'; cloth(red ? '#6e1410' : '#151313', 16, 0.35, 511);
      for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(0,0,0,${0.15 + rr() * 0.2})`; g.lineWidth = 2 + rr() * 4; const x = rr() * W; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + (rr() - 0.5) * 40, 128, x + (rr() - 0.5) * 30, 256); g.stroke(); } // folds
      if (red) text('HATE', cx, 62, 40, '#120a08', 'Impact, sans-serif');
      else { g.fillStyle = '#7a120e'; g.fillRect(cx - 12, 0, 24, 256); g.fillRect(cx - 70, 52, 140, 22); }
      for (const s of [-1, 1]) { g.fillStyle = '#050403'; g.beginPath(); g.moveTo(cx + s * (ex - 22), ey); g.quadraticCurveTo(cx + s * ex, ey - 16, cx + s * (ex + 22), ey - 2); g.quadraticCurveTo(cx + s * ex, ey + 12, cx + s * (ex - 22), ey); g.fill(); }
      blood(red ? 6 : 3, 150, 256); break; }
    case 'gimp': { // stitched leather, an X cut into the forehead, a zipped mouth
      cloth('#1c1714', 10, 0.3, 521);
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,255,255,0.08)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.02)'); gr.addColorStop(1, 'rgba(0,0,0,0.2)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(120,100,80,0.6)'; g.setLineDash([3, 4]); g.lineWidth = 1.5; for (const x of [cx, cx - 90, cx + 90, 40, W - 40]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); } g.setLineDash([]);
      eyeHoles(13, 9, '#8a8478');
      g.strokeStyle = skinD; g.lineWidth = 5; g.beginPath(); g.moveTo(cx - 16, 36); g.lineTo(cx + 16, 68); g.moveTo(cx + 16, 36); g.lineTo(cx - 16, 68); g.stroke();
      g.fillStyle = '#6a6a66'; g.fillRect(cx - 28, my - 3, 56, 6); g.fillStyle = '#2a2a28'; for (let x = -26; x < 28; x += 4) g.fillRect(cx + x, my - 3, 2, 6);
      break; }
    case 'balaBlue': case 'balaBlack': case 'balaRed': { // knitted balaclava, one wide eye opening and a mouth hole
      const col = { balaBlue: [40, 60, 120], balaBlack: [26, 26, 28], balaRed: [120, 22, 18] }[kind]; knit(...col);
      g.fillStyle = skinC; g.beginPath(); g.ellipse(cx, ey, ex + 26, 17, 0, 0, 7); g.fill();
      g.strokeStyle = `rgb(${col.map((v) => v * 0.6).join()})`; g.lineWidth = 4; g.stroke();
      for (const s of [-1, 1]) { g.fillStyle = '#efe6dc'; g.beginPath(); g.ellipse(cx + s * ex, ey, 9, 5, 0, 0, 7); g.fill(); g.fillStyle = '#1a120c'; g.beginPath(); g.arc(cx + s * ex, ey, 4, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(cx - ex - 20, ey - 18, 2 * ex + 40, 5); // brow shadow
      g.fillStyle = skinD; g.beginPath(); g.ellipse(cx, my, 18, 10, 0, 0, 7); g.fill(); g.fillStyle = '#3a1410'; g.fillRect(cx - 12, my - 1, 24, 3);
      if (kind === 'balaBlack') { g.strokeStyle = skinD; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - ex - 30, ey - 22); g.lineTo(cx - ex - 6, ey + 4); g.stroke(); }
      for (let k = 0; k < 4; k++) { g.fillStyle = skinD; g.beginPath(); g.ellipse(cx + (rr() - 0.5) * 240, 40 + rr() * 200, 3 + rr() * 6, 2 + rr() * 4, rr() * 3, 0, 7); g.fill(); }
      break; }
    case 'swat': { knit(22, 22, 24); g.fillStyle = skinC; g.beginPath(); g.ellipse(cx, ey, ex + 20, 13, 0, 0, 7); g.fill(); for (const s of [-1, 1]) { g.fillStyle = '#0c0807'; g.beginPath(); g.ellipse(cx + s * ex, ey, 8, 5, 0, 0, 7); g.fill(); } break; }
    case 'gasHood': { cloth('#121214', 12, 0.3, 531); break; }
    case 'wrapCamo': { // strips of camo cloth wound round the whole head, a slit to see through
      cloth('#4a4a34', 14, 0.5, 541); for (let k = 0; k < 26; k++) { g.fillStyle = ['#2c3020', '#5a4c32', '#1c1c16', '#6a6646'][k % 4]; g.save(); g.translate(rr() * W, rr() * H); g.rotate(-0.4 + rr() * 0.8); g.fillRect(-60, -6, 120, 8 + rr() * 8); g.restore(); }
      g.fillStyle = '#080706'; g.fillRect(cx - ex - 16, ey - 5, 2 * ex + 32, 10); break; }
    case 'gorilla': { // a hockey mask painted as an ape's face
      plate('#2a221c'); g.fillStyle = '#4a3a30'; g.beginPath(); g.ellipse(128, 160, 70, 64, 0, 0, 7); g.fill();
      g.fillStyle = '#16100c'; g.beginPath(); g.ellipse(128, 82, 96, 20, 0, 0, 7); g.fill(); // heavy brow
      g.fillStyle = '#0c0806'; g.beginPath(); g.ellipse(112, 150, 10, 7, 0.4, 0, 7); g.ellipse(144, 150, 10, 7, -0.4, 0, 7); g.fill();
      g.fillStyle = '#d8d0b8'; for (let k = 0; k < 8; k++) g.fillRect(96 + k * 8.5, 196, 6, 10); g.fillStyle = '#5a1810'; g.fillRect(92, 192, 72, 4);
      scuff(30, 'rgba(0,0,0,A)'); cut(false); break; }
    case 'puppet': { // a ventriloquist dummy's face on a hockey mask
      plate('#d9c6a8'); g.fillStyle = 'rgba(190,60,50,0.55)'; g.beginPath(); g.arc(70, 150, 22, 0, 7); g.arc(186, 150, 22, 0, 7); g.fill();
      g.strokeStyle = '#2a1a12'; g.lineWidth = 3; g.beginPath(); g.moveTo(92, 170); g.lineTo(92, 236); g.moveTo(164, 170); g.lineTo(164, 236); g.stroke(); // hinged jaw
      g.fillStyle = '#7a1810'; g.beginPath(); g.ellipse(128, 172, 32, 8, 0, 0, 7); g.fill();
      g.strokeStyle = '#2a1a12'; g.lineWidth = 4; g.beginPath(); g.arc(88, 80, 22, 3.6, 5.8); g.arc(168, 80, 22, 3.6, 5.8); g.stroke();
      scuff(30, 'rgba(60,40,20,A)'); blood(4, 120, 240); cut(false); break; }
    case 'hockeyBloody': case 'hockeyRed': case 'hockeyCracked': {
      plate(kind === 'hockeyRed' ? '#8a1c16' : '#d4cebe'); scuff(26, 'rgba(50,36,24,A)');
      if (kind === 'hockeyBloody') { blood(40); g.fillStyle = 'rgba(90,6,4,0.7)'; g.beginPath(); g.ellipse(150, 150, 60, 80, 0.3, 0, 7); g.fill(); }
      if (kind === 'hockeyCracked') { crack(128, 60, 4, 120, 'rgba(20,16,12,0.9)', 2.2); crack(80, 200, 3, 80); }
      cut(); break; }
    case 'doll': { // a porcelain doll's face: red lipstick, painted blue eyes, a stitched tear in the forehead
      const gr = g.createRadialGradient(128, 128, 20, 128, 128, 130); gr.addColorStop(0, '#f2ece2'); gr.addColorStop(1, '#cfc4b4'); g.fillStyle = gr; g.beginPath(); g.ellipse(128, 128, 110, 124, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(220,110,110,0.4)'; g.beginPath(); g.arc(68, 150, 22, 0, 7); g.arc(188, 150, 22, 0, 7); g.fill();
      for (const x of [88, 168]) { g.fillStyle = '#f8f6f0'; g.beginPath(); g.ellipse(x, 104, 18, 12, 0, 0, 7); g.fill(); g.fillStyle = '#3a6ab0'; g.beginPath(); g.arc(x, 104, 8, 0, 7); g.fill(); g.fillStyle = '#080808'; g.beginPath(); g.arc(x, 104, 3.5, 0, 7); g.fill(); g.strokeStyle = '#141010'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, 104, 18, 12, 0, 3.3, 6.1); g.stroke(); }
      g.fillStyle = '#b0141a'; g.beginPath(); g.moveTo(104, 176); g.quadraticCurveTo(128, 162, 152, 176); g.quadraticCurveTo(128, 194, 104, 176); g.fill();
      g.strokeStyle = '#3a2620'; g.lineWidth = 2; g.beginPath(); g.moveTo(96, 40); g.lineTo(130, 62); g.lineTo(150, 50); g.stroke(); for (let k = 0; k < 7; k++) { const x = 100 + k * 7; g.beginPath(); g.moveTo(x, 38 + k * 3.5); g.lineTo(x + 4, 50 + k * 3.5); g.stroke(); }
      crack(60, 70, 3, 50, 'rgba(70,60,50,0.6)', 1); blood(8, 150, 256); cut(false); g.globalCompositeOperation = 'source-over'; break; }
    case 'babyface': { // a stretched puppet face, torn round the edges
      g.fillStyle = '#c8a688'; g.beginPath(); g.ellipse(128, 128, 108, 120, 0, 0, 7); g.fill(); scuff(40, 'rgba(90,50,30,A)');
      g.fillStyle = 'rgba(200,90,80,0.4)'; g.beginPath(); g.arc(70, 150, 20, 0, 7); g.arc(186, 150, 20, 0, 7); g.fill();
      g.strokeStyle = '#2a1810'; g.lineWidth = 3; g.beginPath(); g.moveTo(100, 180); g.quadraticCurveTo(128, 196, 156, 180); g.stroke();
      g.globalCompositeOperation = 'destination-out'; for (let k = 0; k < 24; k++) { const a = rr() * 6.28; g.beginPath(); g.arc(128 + Math.cos(a) * 112, 128 + Math.sin(a) * 124, 6 + rr() * 12, 0, 7); g.fill(); } g.globalCompositeOperation = 'source-over';
      cut(false); break; }
    case 'skullCrimson': case 'pazuzu': case 'flayed': {
      g.fillStyle = '#0a0808'; g.fillRect(0, 0, 256, 256);
      const face = { skullCrimson: '#d6d0bc', pazuzu: '#6a5a3c', flayed: '#7a2418' }[kind];
      g.fillStyle = face; g.beginPath(); g.ellipse(128, 104, 80, 82, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(70, 150); g.quadraticCurveTo(128, 250, 186, 150); g.fill();
      if (kind === 'pazuzu') { for (let k = 0; k < 30; k++) { g.strokeStyle = 'rgba(20,14,8,0.5)'; g.lineWidth = 1.5; g.beginPath(); const y = 40 + rr() * 170; g.moveTo(60 + rr() * 40, y); g.quadraticCurveTo(128, y + (rr() - 0.5) * 20, 196 - rr() * 40, y); g.stroke(); } g.fillStyle = '#e0d8b8'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(128 + s * 26, 186); g.lineTo(128 + s * 18, 220); g.lineTo(128 + s * 10, 186); g.fill(); } }
      if (kind === 'flayed') { scuff(50, 'rgba(160,40,30,A)'); g.strokeStyle = 'rgba(230,200,180,0.5)'; g.lineWidth = 2; for (let k = 0; k < 12; k++) { g.beginPath(); g.moveTo(70 + rr() * 116, 40 + rr() * 40); g.lineTo(70 + rr() * 116, 200); g.stroke(); } }
      g.fillStyle = '#050404'; g.beginPath(); g.ellipse(90, 104, 22, 24, 0.2, 0, 7); g.fill(); if (kind !== 'flayed') { g.beginPath(); g.ellipse(166, 104, 22, 24, -0.2, 0, 7); g.fill(); } else { g.fillStyle = '#d8d0c0'; g.beginPath(); g.arc(166, 104, 12, 0, 7); g.fill(); g.fillStyle = '#100808'; g.beginPath(); g.arc(166, 104, 4, 0, 7); g.fill(); }
      g.fillStyle = '#050404'; g.beginPath(); g.moveTo(128, 128); g.lineTo(116, 154); g.lineTo(140, 154); g.fill();
      if (kind === 'skullCrimson') { g.fillStyle = '#050404'; g.fillRect(92, 176, 72, 26); g.fillStyle = face; for (let k = 0; k < 7; k++) g.fillRect(94 + k * 10, 176, 7, 26); }
      break; }
    case 'skullPaint': { // a skull painted on bare skin
      g.fillStyle = skinC; g.fillRect(0, 0, 256, 256);
      g.fillStyle = '#e8e2d6'; g.beginPath(); g.ellipse(128, 100, 84, 70, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(66, 130); g.quadraticCurveTo(128, 236, 190, 130); g.fill();
      g.fillStyle = '#0a0808'; g.beginPath(); g.ellipse(88, 106, 26, 22, 0.2, 0, 7); g.ellipse(168, 106, 26, 22, -0.2, 0, 7); g.fill();
      g.beginPath(); g.moveTo(128, 128); g.lineTo(116, 152); g.lineTo(140, 152); g.fill();
      g.strokeStyle = '#0a0808'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(84, 182); g.lineTo(172, 182); g.stroke(); for (let k = 0; k < 9; k++) { g.beginPath(); g.moveTo(88 + k * 10, 170); g.lineTo(88 + k * 10, 196); g.stroke(); }
      blood(5, 150, 256); for (const x of [88, 168]) { g.fillStyle = '#e8e0d4'; g.beginPath(); g.ellipse(x, 106, 7, 4, 0, 0, 7); g.fill(); g.fillStyle = '#1a120c'; g.beginPath(); g.arc(x, 106, 3, 0, 7); g.fill(); }
      break; }
    case 'smileyPaint': { // a yellow smiley painted straight onto the face, red smeared over it
      g.fillStyle = skinC; g.fillRect(0, 0, 256, 256); g.fillStyle = '#d6b01e'; g.beginPath(); g.ellipse(128, 132, 100, 112, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(150,20,14,0.6)'; for (let k = 0; k < 10; k++) { g.beginPath(); g.ellipse(60 + rr() * 140, 60 + rr() * 150, 8 + rr() * 22, 4 + rr() * 10, rr() * 3, 0, 7); g.fill(); }
      g.fillStyle = '#100c06'; g.beginPath(); g.ellipse(88, 104, 12, 18, 0, 0, 7); g.ellipse(168, 104, 12, 18, 0, 0, 7); g.fill();
      g.strokeStyle = '#100c06'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.arc(128, 132, 62, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
      g.fillStyle = '#f0f0f0'; g.beginPath(); g.arc(112, 40, 4, 0, 7); g.arc(144, 40, 4, 0, 7); g.fill(); break; }
    case 'smileyFrown': case 'smileyPlease': case 'smileyCracked': {
      g.fillStyle = '#d8b424'; g.fillRect(0, 0, 256, 256); scuff(50, 'rgba(60,44,10,A)');
      g.fillStyle = '#141008'; g.beginPath(); g.ellipse(92, 100, 12, 22, 0, 0, 7); g.ellipse(164, 100, 12, 22, 0, 0, 7); g.fill();
      g.strokeStyle = '#141008'; g.lineWidth = 11; g.lineCap = 'round'; g.beginPath();
      if (kind === 'smileyFrown') g.arc(128, 222, 60, 1.25 * Math.PI, 1.75 * Math.PI); else g.arc(128, 128, 64, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
      if (kind === 'smileyPlease') { blood(30); text('PLEASE', 128, 34, 30, 'rgba(110,8,6,0.9)', 'Impact, sans-serif', -0.05); text('STOP ME', 128, 232, 30, 'rgba(110,8,6,0.9)', 'Impact, sans-serif', 0.04); }
      if (kind === 'smileyCracked') { g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(80, 90); g.lineTo(40, 20); g.lineTo(70, 0); g.lineTo(110, 0); g.lineTo(100, 80); g.fill(); g.globalCompositeOperation = 'source-over'; crack(92, 100, 5, 70, 'rgba(20,14,6,0.9)', 2); blood(8); }
      break; }
    case 'bandanaLow': case 'bandanaCamo': { // a bandana tied over nose and mouth; the top half is see-through
      g.clearRect(0, 0, 256, 256);
      if (kind === 'bandanaLow') { g.fillStyle = '#7a6438'; g.fillRect(0, 120, 256, 136); g.strokeStyle = 'rgba(40,28,14,0.6)'; g.lineWidth = 3; for (let k = 0; k < 256; k += 18) { g.beginPath(); g.moveTo(k, 120); g.lineTo(k, 256); g.stroke(); g.beginPath(); g.moveTo(0, 120 + k * 0.53); g.lineTo(256, 120 + k * 0.53); g.stroke(); } }
      else { g.fillStyle = '#4a4a30'; g.fillRect(0, 120, 256, 136); for (let k = 0; k < 30; k++) { g.fillStyle = ['#2a3020', '#6a5a38', '#1a1a12'][k % 3]; g.beginPath(); g.ellipse(rr() * 256, 130 + rr() * 120, 10 + rr() * 20, 5 + rr() * 10, rr() * 3, 0, 7); g.fill(); } }
      g.globalCompositeOperation = 'destination-in'; g.beginPath(); g.moveTo(0, 124); g.quadraticCurveTo(128, 112, 256, 124); g.lineTo(256, 256); g.lineTo(0, 256); g.fill(); g.globalCompositeOperation = 'source-over';
      break; }
    default: return T.mask.knit;
  }
  return (maskCache[key] = tex(c, { repeat: false }));
}

// cloth prints: camo, plaid, Hawaiian, leather. Mapped on lofted cloth (u round the limb, v = 6/m along it).
function makeCamo(n, cols, seed, blot = 1) {
  const [c, g] = cnv(n); g.fillStyle = cols[0]; g.fillRect(0, 0, n, n); const r = seeded(seed);
  for (let L = 1; L < cols.length; L++) for (let k = 0; k < 26; k++) { g.fillStyle = cols[L]; const x = r() * n, y = r() * n; g.beginPath(); for (let a = 0; a < 6.28; a += 0.5) { const R = (14 + r() * 26) * blot; g.lineTo(x + Math.cos(a) * R * 1.4, y + Math.sin(a) * R * 0.6); } g.fill(); }
  const a = field(n, 32, 2, seed + 3); pixels(g, n, n, (x, y, i, p) => { const v = 0.85 + a[i] * 0.3 + (((x + y) % 3) ? 0 : -0.06); p[0] = clamp(p[0] * v); p[1] = clamp(p[1] * v); p[2] = clamp(p[2] * v); });
  return tex(c);
}
function makePlaid(n, base, lines) {
  const [c, g] = cnv(n); g.fillStyle = base; g.fillRect(0, 0, n, n);
  for (const [col, w, step] of lines) { g.fillStyle = col; for (let k = 0; k < n; k += step) { g.globalAlpha = 0.55; g.fillRect(k, 0, w, n); g.fillRect(0, k, n, w); } } g.globalAlpha = 1;
  const a = field(n, 32, 2, 77); pixels(g, n, n, (x, y, i, p) => { const tw = ((x + y) % 4 < 2) ? 1 : 0.85; const v = tw * (0.85 + a[i] * 0.3); p[0] = clamp(p[0] * v); p[1] = clamp(p[1] * v); p[2] = clamp(p[2] * v); });
  return tex(c);
}
function makeHawaiian(n, base, petal, leaf) {
  const [c, g] = cnv(n); g.fillStyle = base; g.fillRect(0, 0, n, n); const r = seeded(91);
  for (let k = 0; k < 18; k++) { const x = r() * n, y = r() * n; g.fillStyle = leaf; g.beginPath(); g.ellipse(x + 12, y + 8, 18, 6, r() * 3, 0, 7); g.fill(); g.fillStyle = petal; for (let p = 0; p < 5; p++) { const a = p * 1.256; g.beginPath(); g.ellipse(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 8, 5, a, 0, 7); g.fill(); } g.fillStyle = '#e8d040'; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
  return tex(c);
}
function makeLeather(n) {
  const [c, g] = cnv(n); const a = field(n, 24, 3, 61), b = field(n, 6, 3, 62);
  pixels(g, n, n, (x, y, i, p) => { const v = 120 + a[i] * 70 - b[i] * 40; p[0] = p[1] = p[2] = clamp(v); p[3] = 255; }); return tex(c);
}
export function paintCloth(n = 256) {
  T.cloth = {
    camoForest: makeCamo(n, ['#4e5a34', '#2c3a22', '#6a5a3a', '#1a1c14'], 201),
    camoUrban: makeCamo(n, ['#8a8a86', '#5a5a58', '#c0c0ba', '#2a2a2a'], 202),
    camoDesert: makeCamo(n, ['#b8a07a', '#8a6e4a', '#d6c6a0', '#6a5a40'], 203, 1.3),
    camoBlack: makeCamo(n, ['#262626', '#121212', '#3a3a3a'], 204),
    plaidRed: makePlaid(n, '#8a1c18', [['#1a1010', 14, 40], ['#d8c8a0', 3, 40]]),
    plaidBrown: makePlaid(n, '#7a6438', [['#2a2014', 12, 36], ['#b89a5a', 4, 36]]),
    plaidOrange: makePlaid(n, '#b0602a', [['#3a2010', 10, 34], ['#e8c080', 3, 34]]),
    hawaiianBlue: makeHawaiian(n, '#d8d4c4', '#3a60b0', '#2a6a3a'),
    hawaiianBlack: makeHawaiian(n, '#141414', '#d070a0', '#3a7a40'),
    leather: makeLeather(n),
  };
  for (const t of Object.values(T.cloth)) t.repeat.set(2, 0.34); // u wraps the limb, v runs 6/m: square-ish prints
}

export function paintAll(low) {
  const n = low ? 256 : 512;
  const brick = makeBrick(1024);
  T.brick = brick;
  T.facade = ['dark', 'dark', 'boarded', 'lit', 'broken', 'dark'].map((k) => makeFacade(n, k, brick.canvas));
  T.tenement = makeTenement(1024, brick.canvas);
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
  paintCloth(n / 2);
  T.knit = makeKnit(n / 2, 121); T.fleece = makeKnit(n / 2, 131);
  T.denim = makeDenim(n / 2);
  T.skin = makeSkinDetail(256);
  T.glow = makeGlow(); T.flame = makeFlame(); T.beam = makeBeam();
  T.exit = makeLabel('EXIT', '#0d3a12', '#5cff6a');
  T.noEntry = makeLabel('NO ENTRY', '#e8e0c8', '#a01010');
  return T;
}
