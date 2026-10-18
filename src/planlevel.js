// planlevel.js — builds a scene from its traced layout plan (plans.js): the
// real Manhunt map's footprint, walls, buildings and blocks at true scale.
// Floors only where the plan has floor; tall facades round the outside; walls
// and fences on the plan's lines (with doorways cut wherever an area would be
// sealed off); buildings and low junk from the blocks; lamps in pools; CCTV on
// the walls. Static geometry is merged per material so the Quest draws a few
// big meshes instead of hundreds of boxes.
import * as THREE from '../vendor/three.module.js';
import { T, seeded } from './paint.js?v=35';
import { PLANS } from './plans.js?v=35';
import { HAND } from './handplans.js?v=35';
import { SETS } from './sets.js?v=35';

const V = THREE.Vector3;
// what each scene looks like: ground, walls, heights, light, junk
const STYLES = {
  street:   { ground: 'asphalt', wall: 'brick', wallH: 3.4, facade: [9, 15], bld: [7, 13], block: 'junk', lamp: 0xd8d08a, lamps: 1, tenement: true },
  ruins:    { ground: 'asphalt', wall: 'brick', wallH: 3.0, facade: [6, 12], bld: [6, 11], block: 'rubble', lamp: 0xd8c890, lamps: 0.8, tenement: true },
  yard:     { ground: 'gravel', wall: 'corrugated', wallH: 3.2, facade: [6, 9], bld: [4, 6], block: 'junk', lamp: 0xffc070, lamps: 0.9 },
  mall:     { ground: 'tiles', wall: 'concrete', wallH: 4.2, facade: [5, 5], bld: [3, 4], block: 'counter', lamp: 0xe8f0d8, lamps: 1.1, ceil: 5 },
  zoo:      { ground: 'concrete', wall: 'brick', wallH: 2.6, facade: [4, 7], bld: [4, 7], block: 'crate', lamp: 0xffc890, lamps: 0.8, grass: true },
  cemetery: { ground: 'gravel', wall: 'stone', wallH: 2.4, facade: [3, 5], bld: [4, 9], block: 'grave', lamp: 0xd8e0ff, lamps: 0.6, grass: true },
  asylum:   { ground: 'tiles', wall: 'concrete', wallH: 3.6, facade: [6, 10], bld: [8, 12], block: 'counter', lamp: 0xe0ecd8, lamps: 1, grass: true },
  docks:    { ground: 'concrete', wall: 'corrugated', wallH: 3.6, facade: [7, 12], bld: [6, 10], block: 'crate', lamp: 0xffd090, lamps: 1 },
  mallFloors: { ground: 'tiles', wall: 'concrete', wallH: 3.8, facade: [13, 14], bld: [3, 4], block: 'counter', lamp: 0xe8f0d8, lamps: 1.2 },
  rail:     { ground: 'gravel', wall: 'brick', wallH: 3.0, facade: [5, 9], bld: [4, 7], block: 'crate', lamp: 0xffb060, lamps: 0.8 },
};

function decode(P) {
  const g = [];
  for (const r of P.rows) { const row = []; for (const m of r.matchAll(/(\d*)(\D)/g)) { const n = m[1] ? +m[1] : 1; for (let k = 0; k < n; k++) row.push(m[2]); } while (row.length < P.w) row.push(' '); g.push(row); }
  return g;
}
// greedy rectangles over cells where test(i,j) is true
function rects(w, h, test) {
  const used = new Uint8Array(w * h), out = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    if (used[j * w + i] || !test(i, j)) continue;
    let iw = 1; while (i + iw < w && !used[j * w + i + iw] && test(i + iw, j)) iw++;
    let jh = 1; grow: while (j + jh < h) { for (let k = 0; k < iw; k++) if (used[(j + jh) * w + i + k] || !test(i + k, j + jh)) break grow; jh++; }
    for (let b = 0; b < jh; b++) for (let a = 0; a < iw; a++) used[(j + b) * w + i + a] = 1;
    out.push([i, j, iw, jh]);
  }
  return out;
}
// one merged mesh of many world-UV'd boxes
class Batch {
  constructor() { this.p = []; this.n = []; this.uv = []; }
  box(x0, x1, y0, y1, z0, z1, tile = 3.6) {
    const P = this.p, N = this.n, U = this.uv;
    const face = (a, b, c, d, nx, ny, nz, uvf) => { for (const v of [a, b, c, a, c, d]) { P.push(...v); N.push(nx, ny, nz); U.push(...uvf(v)); } };
    const xy = (v) => [v[0] / tile, v[1] / tile], zy = (v) => [v[2] / tile, v[1] / tile], xz = (v) => [v[0] / tile, v[2] / tile];
    face([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 0, 0, 1, xy);
    face([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], 0, 0, -1, xy);
    face([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], 1, 0, 0, zy);
    face([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], -1, 0, 0, zy);
    face([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], 0, 1, 0, xz);
  }
  quad4(x0, x1, z0, z1, y00, y10, y01, y11, tile = 3.6) { const P = this.p, N = this.n, U = this.uv; const A = [x0, y01, z1], Bq = [x1, y11, z1], C = [x1, y10, z0], Dq = [x0, y00, z0]; for (const v of [A, Bq, C, A, C, Dq]) { P.push(...v); N.push(0, 1, 0); U.push(v[0] / tile, -v[2] / tile); } }
  quad(x0, x1, z0, z1, y, tile = 3.6) { const P = this.p, N = this.n, U = this.uv; for (const v of [[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z1], [x1, y, z0], [x0, y, z0]]) { P.push(...v); N.push(0, 1, 0); U.push(v[0] / tile, -v[2] / tile); } }
  mesh(mat) {
    if (!this.p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeBoundingSphere(); const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m;
  }
}

import { makeKit } from './setkit.js?v=35';

export function buildPlan(D, matFor) {
  const def = D.def, P = HAND[def.plan] || PLANS[def.plan], R = seeded(4000 + D.idx);
  let S = STYLES[def.style] || STYLES.street;
  const g = decode(P), W = P.w, H = P.h, m = P.m;
  const X = (i) => (i - W / 2) * m, Z = (j) => (j - H / 2) * m;
  D.B = { x0: X(0), x1: X(W), z0: Z(0), z1: Z(H) };
  const at = (i, j) => (i < 0 || j < 0 || i >= W || j >= H ? ' ' : g[j][i]);
  for (const [x0, y0, x1, y1, c] of (SETS[def.id] || {}).carve || []) for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) if (g[j]) g[j][i] = c; // the set opens or closes cells the trace got wrong
  // ---------- the scene's set: floor heights (zones, ramps for stairs) and hand-placed dressing, in plan cells
  const SET = SETS[def.id] || {};
  if (def.look || SET.look) S = { ...S, ...def.look, ...SET.look }; // the scene's own materials (see district.js TEX)
  const rampAt = (ci, cj) => { for (const r of SET.ramps || []) if (ci >= r.x0 && ci <= r.x1 && cj >= r.y0 && cj <= r.y1) { const t = r.axis === 'x' ? (ci - r.x0) / (r.x1 - r.x0) : (cj - r.y0) / (r.y1 - r.y0); return r.h0 + (r.h1 - r.h0) * Math.max(0, Math.min(1, t)); } return null; };
  const Hc = (ci, cj) => { const rh = rampAt(ci, cj); if (rh !== null) return rh; let h = 0; for (const z of SET.zones || []) if (ci >= z.x0 && ci < z.x1 && cj >= z.y0 && cj < z.y1) h = z.h; return h; };
  const isRamp = (i, j) => rampAt(i + 0.5, j + 0.5) !== null;
  if (SET.zones || SET.ramps) D.hf = (x, z) => Hc(x / m + W / 2, z / m + H / 2);
  const lowest = Math.min(0, ...(SET.zones || []).map((z) => z.h), ...(SET.ramps || []).map((r) => Math.min(r.h0, r.h1))) - 0.5;
  const walkable = (c) => c === '.' || c === ',' || c === 'i'; // i: indoors (roofed)
  const lining = (i, j) => { for (const L of SET.linings || []) if (i >= L.x0 && i < L.x1 && j >= L.y0 && j < L.y1) return L.mat; return SET.inner || 'plaster'; };

  // ---------- open doorways so every sizable area is reachable
  const comp = new Int32Array(W * H).fill(-1), sizes = []; let nc = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!walkable(at(i, j)) || comp[j * W + i] >= 0) continue;
    const st = [[i, j]]; comp[j * W + i] = nc; let n = 0;
    while (st.length) { const [x, y] = st.pop(); n++; for (const [a, b] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) if (walkable(at(a, b)) && comp[b * W + a] < 0) { comp[b * W + a] = nc; st.push([a, b]); } }
    sizes.push(n); nc++;
  }
  const main = sizes.indexOf(Math.max(...sizes));
  const cuttable = (c) => c === '#' || c === 'b' || c === 'B' || c === 't';
  const joined = new Set([main]); let guard = 0;
  while (guard++ < 200) {
    // the cheapest bridge from what's joined to a sizable area that isn't: a short run of wall cells
    let best = null;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const c0 = at(i, j); if (!cuttable(c0)) continue;
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        let a = 1; while (cuttable(at(i - dx * a, j - dy * a)) && a < 5) a++;
        let b = 1; while (cuttable(at(i + dx * b, j + dy * b)) && b < 5) b++;
        const ca = comp[(j - dy * a) * W + (i - dx * a)], cb = comp[(j + dy * b) * W + (i + dx * b)];
        if (!(i - dx * a >= 0 && j - dy * a >= 0 && i + dx * b < W && j + dy * b < H) || ca < 0 || cb < 0 || ca === cb) continue;
        const inA = joined.has(ca), inB = joined.has(cb); if (inA === inB) continue;
        const other = inA ? cb : ca; if (sizes[other] < 25) continue;
        const cost = a + b + (c0 === 'B' ? 3 : 0); // rather a fence or junk than through a building
        if (!best || cost < best.cost || (cost === best.cost && sizes[other] > sizes[best.other])) best = { cost, i, j, dx, dy, a, b, other };
      }
    }
    if (!best) break;
    // a doorway ~2 m wide: clear the wall run here and one line either side
    const { i, j, dx, dy, a, b } = best;
    for (let o = -1; o <= 1; o++) for (let k = -a + 1; k < b; k++) { const x = i + dx * k + dy * o, y = j + dy * k + dx * o; if (cuttable(at(x, y))) g[y][x] = '.'; }
    joined.add(best.other);
  }
  // re-label after the doorways
  const reach = new Uint8Array(W * H);
  { let s = null; for (let j = 0; j < H && !s; j++) for (let i = 0; i < W; i++) if (comp[j * W + i] === main) { s = [i, j]; break; }
    const st = [s]; reach[s[1] * W + s[0]] = 1; while (st.length) { const [x, y] = st.pop(); for (const [a, b] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) if (walkable(at(a, b)) && !reach[b * W + a]) { reach[b * W + a] = 1; st.push([a, b]); } } }

  // ---------- start and exit: the two far ends of the walkable route (or given in radar pixels)
  const bfs = (si, sj) => { const d = new Int32Array(W * H).fill(-1), q = [[si, sj]]; d[sj * W + si] = 0; let last = [si, sj];
    for (let k = 0; k < q.length; k++) { const [x, y] = q[k]; last = [x, y]; for (const [a, b] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) if (reach[b * W + a] && d[b * W + a] < 0) { d[b * W + a] = d[y * W + x] + 1; q.push([a, b]); } } return { d, last }; };
  const pick = (px) => { const i = Math.round((px[0] - P.ox) / 2), j = Math.round((px[1] - P.oy) / 2); let bst = null, bd = 1e9; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (reach[y * W + x]) { const dd = (x - i) ** 2 + (y - j) ** 2; if (dd < bd) { bd = dd; bst = [x, y]; } } return bst; };
  let sCell, eCell;
  { let any = null; for (let k = 0; k < W * H && !any; k++) if (reach[k]) any = [k % W, (k / W) | 0];
    const far1 = bfs(...any).last, far2 = bfs(...far1).last;
    const near = (c) => { let bst = null, bd = 1e9; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (reach[y * W + x]) { const dd = (x - c[0]) ** 2 + (y - c[1]) ** 2; if (dd < bd) { bd = dd; bst = [x, y]; } } return bst; };
    sCell = SET.start ? near(SET.start) : def.startPx ? pick(def.startPx) : far1; eCell = SET.exit ? near(SET.exit) : def.exitPx ? pick(def.exitPx) : (def.startPx ? bfs(...sCell).last : far2); }
  const route = bfs(...sCell).d;
  // walk a few metres in from the start along the route, and face down it
  const toward = (c, steps) => { let cur = c; for (let k = 0; k < steps; k++) { let nx = null; for (const [a, b] of [[cur[0] + 1, cur[1]], [cur[0] - 1, cur[1]], [cur[0], cur[1] + 1], [cur[0], cur[1] - 1]]) if (reach[b * W + a] && route[b * W + a] === route[cur[1] * W + cur[0]] + 1) nx = [a, b]; if (!nx) break; cur = nx; } return cur; };
  const s2 = toward(sCell, 6);
  D.start.set(X(sCell[0] + 0.5), 0, Z(sCell[1] + 0.5)); D.startYaw = SET.start && SET.start[2] !== undefined ? SET.start[2] : Math.atan2(-(X(s2[0]) - X(sCell[0])), -(Z(s2[1]) - Z(sCell[1])));

  // ---------- geometry
  const mats = matFor(S), batches = {};
  const B = (k) => (batches[k] = batches[k] || new Batch());
  const solid = (x0, x1, z0, z1, h, see = true) => D.boxes.push({ x0, x1, z0, z1, y0: 0, y1: h, see, plan: true }); // plan walls: the walk grid doesn't pad these (narrow passages stay open)
  // floors
  const floorish = (i, j) => at(i, j) === '.' || at(i, j) === '#' || at(i, j) === 'b' || at(i, j) === 't' || at(i, j) === 'i';
  const levels = [...new Set([0, ...(SET.zones || []).map((z) => z.h)])];
  for (const lv of levels) for (const [i, j, w, h] of rects(W, H, (i, j) => floorish(i, j) && !isRamp(i, j) && Hc(i + 0.5, j + 0.5) === lv && !(SET.inner && at(i, j) === 'i'))) B('floor').quad(X(i), X(i + w), Z(j), Z(j + h), lv, 3.6);
  if (SET.inner) for (const [i, j, w, h] of rects(W, H, (i, j) => at(i, j) === 'i' && !isRamp(i, j))) B(lining(i, j) === 'tiles' ? 'tfloor' : (SET.innerFloor || 'ifloor')).quad(X(i), X(i + w), Z(j), Z(j + h), Hc(i + w / 2, j + h / 2), 3.6);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (floorish(i, j) && isRamp(i, j)) B('floor').quad4(X(i), X(i + 1), Z(j), Z(j + 1), Hc(i, j), Hc(i + 1, j), Hc(i, j + 1), Hc(i + 1, j + 1), 3.6);
  // where two levels meet without stairs: a retaining wall with a parapet on the high side
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!walkable(at(i, j))) continue;
    for (const [a, b] of [[1, 0], [0, 1]]) {
      if (!walkable(at(i + a, j + b))) continue;
      const h1 = Hc(i + 0.5, j + 0.5), h2 = Hc(i + a + 0.5, j + b + 0.5); if (Math.abs(h1 - h2) < 0.45) continue;
      const hi = Math.max(h1, h2), lo = Math.min(h1, h2), x = X(i + a), z = Z(j + b);
      const bx = a ? [x - 0.1, x + 0.1, Z(j), Z(j + 1)] : [X(i), X(i + 1), z - 0.1, z + 0.1];
      B('wall').box(bx[0], bx[1], lo - 0.2, hi + 0.95, bx[2], bx[3], 3.6); D.boxes.push({ x0: bx[0], x1: bx[1], z0: bx[2], z1: bx[3], y0: lowest, y1: hi + 0.95, see: true, plan: true });
    }
  }
  for (const [i, j, w, h] of rects(W, H, (i, j) => at(i, j) === ',')) B(S.grass ? 'grass' : 'floor').quad(X(i), X(i + w), Z(j), Z(j + h), 0.01 + Hc(i + w / 2, j + h / 2), 3.6);
  // the outer edge: void cells touching the plan become tall facades
  const edge = (i, j) => at(i, j) === ' ' && [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([a, b]) => { const c = at(i + a, j + b); return c !== ' '; });
  for (const [i, j, w, h] of rects(W, H, edge)) {
    const fh = S.facade[0] + R() * (S.facade[1] - S.facade[0]);
    B('facade').box(X(i), X(i + w), lowest, fh, Z(j), Z(j + h), S.tenement ? 10.8 : 3.6); solid(X(i), X(i + w), Z(j), Z(j + h), fh);
  }
  // walls and fences on the plan's lines
  for (const [i, j, w, h] of rects(W, H, (i, j) => at(i, j) === '#')) {
    const outer = [[-1, 0], [w, 0], [0, -1], [0, h]].some(([a, b]) => at(i + a, j + b) === ' ');
    const inner = [[-1, 0], [w, 0], [0, -1], [0, h]].some(([a, b]) => at(i + a, j + b) === 'i');
    const wh = outer ? S.facade[0] : inner ? Math.max(S.wallH, 3.8) : S.wallH;
    const base = Hc(i + w / 2, j + h / 2);
    B(outer ? 'facade' : 'wall').box(X(i), X(i + w), lowest, wh + Math.max(0, base), Z(j), Z(j + h), outer && S.tenement ? 10.8 : 3.6); solid(X(i), X(i + w), Z(j), Z(j + h), wh);
  }
  // indoors (when the set asks): every wall face inside a room gets plaster, or tiles in the rooms the set names
  if (SET.inner) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (at(i, j) !== 'i') continue; const y0 = Hc(i + 0.5, j + 0.5), y1 = y0 + 3.4, k = lining(i, j), t = 0.04;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const c = at(i + a, j + b); if (c !== '#' && c !== ' ' && c !== 'B' && c !== 'b') continue;
      if (a) { const x = a > 0 ? X(i + 1) : X(i); B(k).box(a > 0 ? x - t : x, a > 0 ? x : x + t, y0, y1, Z(j), Z(j + 1), 3.6); }
      else { const z = b > 0 ? Z(j + 1) : Z(j); B(k).box(X(i), X(i + 1), y0, y1, b > 0 ? z - t : z, b > 0 ? z : z + t, 3.6); }
    }
  }
  // buildings and low blocks
  for (const [i, j, w, h] of rects(W, H, (i, j) => at(i, j) === 'B')) {
    const bh = S.bld[0] + R() * (S.bld[1] - S.bld[0]);
    B('building').box(X(i), X(i + w), lowest, bh, Z(j), Z(j + h), 3.6); solid(X(i), X(i + w), Z(j), Z(j + h), bh);
  }
  for (const [i, j, w, h] of rects(W, H, (i, j) => at(i, j) === 'b')) {
    const bh = 0.9 + R() * 1.4;
    const bb = Hc(i + w / 2, j + h / 2), tall = (SET.tall || []).find((t) => i >= t.x0 && i < t.x1 && j >= t.y0 && j < t.y1);
    if (tall) { B('building').box(X(i), X(i + w), lowest, bb + tall.h, Z(j), Z(j + h), 3.6); solid(X(i), X(i + w), Z(j), Z(j + h), bb + tall.h); continue; }
    if (SET.blockH) { const sh = SET.blockH[0] + R() * (SET.blockH[1] - SET.blockH[0]); B(SET.blockMat || 'block').box(X(i), X(i + w), bb, bb + sh, Z(j), Z(j + h), 3.6); solid(X(i), X(i + w), Z(j), Z(j + h), bb + sh); continue; }
    B('block').box(X(i), X(i + w), bb, bb + bh, Z(j), Z(j + h), 1.8); solid(X(i), X(i + w), Z(j), Z(j + h), bb + bh);
  }
  for (const [i, j, w, h] of rects(W, H, (i, j) => at(i, j) === 't')) { if (w * h < 3) continue; D.tree?.(X(i + w / 2), Z(j + h / 2), Math.sqrt(w * h) * m); }
  for (const k in batches) { const mesh = batches[k].mesh(mats[k] || mats.wall); if (mesh) { mesh.castShadow = k !== 'floor'; D.root.add(mesh); } }
  if (S.ceil) { const c = new Batch(); for (const [i, j, w, h] of rects(W, H, (i, j) => at(i, j) !== ' ')) c.quad(X(i), X(i + w), Z(j), Z(j + h), 0, 3.6); const cm = c.mesh(mats.ceil); cm.rotation.x = Math.PI; cm.position.y = S.ceil; D.root.add(cm); }
  // the walk grid treats the void as solid
  D.planVoid = (x, z) => { const i = Math.floor(x / m + W / 2), j = Math.floor(z / m + H / 2); return !walkable(at(i, j)); };
  // indoors: a ceiling at 3.4 m with a roof slab over it, and the walls round indoor rooms carried up to it
  { const ceil = new Batch(), roof = new Batch(), indoorish = (i, j) => at(i, j) === 'i' || (at(i, j) === '#' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => at(i + a, j + b) === 'i'));
    for (const [i, j, w, h] of rects(W, H, indoorish)) { const y = Hc(i + w / 2, j + h / 2) + 3.4; ceil.quad(X(i), X(i + w), Z(j), Z(j + h), y, 3.6); roof.box(X(i), X(i + w), y, y + 0.35, Z(j), Z(j + h), 3.6); }
    const cm = ceil.mesh(mats.ceil); if (cm) D.root.add(cm); // the ceiling material is double-sided
    const rm = roof.mesh(mats.building); if (rm) D.root.add(rm); }

  // ---------- exit gate across the route at the far end
  { const [ei, ej] = toward(eCell, 0), ex = X(ei + 0.5), ez = Z(ej + 0.5);
    const run = (dx, dy) => { let n = 0; for (const s of [1, -1]) { let k = 1; while (k < 30 && reach[(ej + dy * k * s) * W + ei + dx * k * s]) k++; n += k - 1; } return n + 1; };
    const rx = run(1, 0), rz = run(0, 1), alongZ = rz <= rx; // the gate spans the narrow way
    const gw = Math.min(10, Math.max(2.5, (alongZ ? rz : rx) * m));
    D.makeGate(ex, ez, alongZ, gw, -1);
    // whatever the gate doesn't span is walled shut so the only way out is through it
    const prev = toward(eCell, 0); D.exitCell = prev;
  }
  // how open the ground is round a cell (share of walkable cells in a square), so dressing never plugs a passage
  const open = (i, j, r) => { let n = 0, t = 0; for (let y = j - r; y <= j + r; y++) for (let x = i - r; x <= i + r; x++) { t++; if (x >= 0 && y >= 0 && x < W && y < H && reach[y * W + x]) n++; } return n / t; };
  // ---------- lamps: pools of light along the route, dark between
  const L = []; const want = Math.round((W * H * m * m) / 260 * S.lamps);
  for (let t = 0; t < want * 30 && L.length < want; t++) {
    const i = (R() * W) | 0, j = (R() * H) | 0; if (!reach[j * W + i]) continue;
    const x = X(i + 0.5), z = Z(j + 0.5); if (L.some(([a, b]) => Math.hypot(a - x, b - z) < 13)) continue;
    // hang it off the nearest wall if there's one close, else a pole
    let wall = null; for (let r = 1; r < 5 && !wall; r++) for (const [a, b] of [[r, 0], [-r, 0], [0, r], [0, -r]]) { const c = at(i + a, j + b); if (c === '#' || c === ' ' || c === 'B') { wall = [a, b]; break; } }
    const real = L.length < 14;
    if (!wall && open(i, j, 4) < 0.9 && at(i, j) !== 'i') continue; // poles only out in the open
    if (at(i, j) === 'i') D.lamp(x, z, { h: 3.0, r: 8, i: 0.8, col: S.lamp, arm: 'none', real, flicker: R() < 0.3 ? 1 : 0 }); // indoors: a bulb under the ceiling
    else if (wall) D.lamp(x + Math.sign(wall[0]) * 0.3, z + Math.sign(wall[1]) * 0.3, { h: 4.2, r: 10, i: 0.9, col: S.lamp, arm: 'none', real, flicker: R() < 0.3 ? 1 : 0 });
    else D.lamp(x, z, { h: 5.2, r: 11, i: 1, col: S.lamp, real, flicker: R() < 0.25 ? 1 : 0, dir: R() * 6.28 });
    L.push([x, z]);
  }
  // ---------- CCTV on walls facing into the open
  for (let k = 0, t = 0; k < (def.cams ?? 4) && t < 600; t++) {
    const i = (R() * W) | 0, j = (R() * H) | 0; if (!reach[j * W + i]) continue;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = at(i + a, j + b); if (c === '#' || c === ' ' || c === 'B') { D.cams.push({ p: new V(X(i + 0.5) + a * 0.3, 4.2 + Hc(i + 0.5, j + 0.5), Z(j + 0.5) + b * 0.3), yaw: Math.atan2(-a, -b), sweep: 0.6 + R() * 0.4 }); k++; break; } }
  }
  // ---------- the scene's own set dressing (sets.js)
  if (SET.dress) SET.dress(makeKit(D, { X, Z, Hc, m, W, H, at, reach, mats, R }));
  // ---------- dressing: junk against the walls, by style
  const kinds = { junk: ['dumpster', 'trash', 'barrel', 'mattress'], rubble: ['trash', 'barrel', 'mattress'], counter: ['crate', 'trash'], crate: ['crate', 'barrel'], grave: ['crate'] }[S.block] || ['trash'];
  const want2 = SET.noJunk ? 0 : SET.dress ? Math.round(W * H * m * m / 260) : Math.round(W * H * m * m / 90);
  for (let k = 0, t = 0; k < want2 && t < want2 * 20; t++) {
    const i = (R() * W) | 0, j = (R() * H) | 0; if (!reach[j * W + i]) continue;
    if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const c = at(i + a, j + b); return c === '#' || c === ' '; })) continue;
    if (Math.hypot(X(i) - D.start.x, Z(j) - D.start.z) < 4 || open(i, j, 4) < 0.6) continue; // never in a narrow passage
    D.prop(kinds[k % kinds.length], X(i + 0.5), Z(j + 0.5), R() * 6.28); k++;
  }
  if (S.ground === 'asphalt' || S.ground === 'concrete') for (let k = 0; k < 10; k++) { const i = (R() * W) | 0, j = (R() * H) | 0; if (reach[j * W + i] && open(i, j, 4) > 0.9 && Math.hypot(X(i) - D.start.x, Z(j) - D.start.z) > 8) D.fire?.(X(i + 0.5), Z(j + 0.5)); if (k > 2) break; }
  // the scene's own hunters, where the game puts them (patrol loops in plan cells); otherwise random patrols
  if (SET.patrols) for (const p of SET.patrols) D.routes.push(p.map(([i, j]) => [X(i), Z(j)]));
  D.finish(500 + D.idx, SET.patrols ? 0 : def.hunters || 7, 0);
}
