// body.js — people. One skinned mesh per person lofted from rings along a bone
// chain (loft.js), a procedural animator (gait, search, swing, struggle), and a
// verlet ragdoll that takes over the bones when someone dies. Also Cash's own
// hands: jointed fingers, worn sleeves, scarred knuckles, prison ink.
import * as THREE from '../vendor/three.module.js';
import { Loft, ring, blend } from './loft.js?v=17';
import { T } from './paint.js?v=17';

const V = THREE.Vector3, Q = THREE.Quaternion;
const up = new V(0, 1, 0), fwd = new V(0, 0, 1);

// bone table: name, parent, bind position (world, standing at origin, facing +Z).
// Body-left is +X.
const BONES = [
  ['hips', -1, [0, 0.95, 0]],
  ['spine', 0, [0, 1.10, 0]],
  ['chest', 1, [0, 1.30, 0]],
  ['neck', 2, [0, 1.50, 0]],
  ['head', 3, [0, 1.60, 0.01]],
  ['armL', 2, [0.19, 1.44, 0]],
  ['foreL', 5, [0.22, 1.16, -0.01]],
  ['handL', 6, [0.24, 0.90, 0.01]],
  ['armR', 2, [-0.19, 1.44, 0]],
  ['foreR', 8, [-0.22, 1.16, -0.01]],
  ['handR', 9, [-0.24, 0.90, 0.01]],
  ['thighL', 0, [0.10, 0.92, 0]],
  ['shinL', 11, [0.10, 0.50, 0.01]],
  ['footL', 12, [0.10, 0.08, -0.01]],
  ['thighR', 0, [-0.10, 0.92, 0]],
  ['shinR', 14, [-0.10, 0.50, 0.01]],
  ['footR', 15, [-0.10, 0.08, -0.01]],
];
const B = Object.fromEntries(BONES.map((b, i) => [b[0], i]));
const BP = BONES.map((b) => new V(...b[2]));
// ends of bones without a child, for the ragdoll / directions
const TIP = { head: new V(0, 1.82, 0.02), handL: new V(0.25, 0.76, 0.03), handR: new V(-0.25, 0.76, 0.03), footL: new V(0.10, 0.03, 0.16), footR: new V(-0.10, 0.03, 0.16) };

const SKIN_TONES = [[0.62, 0.44, 0.34], [0.48, 0.32, 0.23], [0.30, 0.20, 0.14], [0.70, 0.52, 0.42], [0.55, 0.40, 0.30]];

// The body, built in three skins that share one skeleton: the top (a hoodie
// or jacket), the legs (jeans and boots), and bare skin (neck, hands, head).
// Rings are anatomical cross-sections: separate half-widths for left/right,
// front and back, so chest, glutes, biceps and calves have real shape.
function buildGeometry(o) {
  const Lt = new Loft(), Ll = new Loft(), Ls = new Loft();
  const skin = o.skin, top = o.top, legs = o.legs, boots = o.cash ? [0.22, 0.22, 0.24] : [0.06, 0.05, 0.045], sole = o.cash ? [0.86, 0.85, 0.82] : [0.03, 0.03, 0.03]; // Cash: dark sneakers, white soles
  const v = (x, y, z) => new V(x, y, z);
  const W = (n) => [[B[n], 1]];
  const k = o.bulk;
  // [y, half-width, front, back, n]
  const torso = [
    [0.84, 0.150, 0.090, 0.105, 2.2], [0.88, 0.162, 0.098, 0.122, 2.3], [0.93, 0.168, 0.102, 0.128, 2.4],
    [0.98, 0.163, 0.098, 0.115, 2.4], [1.03, 0.150 * k, 0.094 * k, 0.098, 2.4],
  ];
  const chest = [
    [1.00, 0.158 * k, 0.104 * k, 0.108, 2.4], [1.06, 0.152 * k, 0.1 * k, 0.1, 2.4], [1.12, 0.156 * k, 0.106 * k, 0.098, 2.5],
    [1.19, 0.164 * k, 0.116 * k, 0.1, 2.6], [1.26, 0.175 * k, 0.128 * k, 0.106, 2.6], [1.32, 0.183 * k, 0.132 * k, 0.108, 2.6],
    [1.37, 0.196 * k, 0.122 * k, 0.11, 2.5], [1.415, 0.19 * k, 0.102, 0.104, 2.4], [1.45, 0.165 * k, 0.084, 0.096, 2.3],
    [1.485, 0.128 * k, 0.07, 0.086, 2.2], [1.515, 0.092, 0.066, 0.078, 2.1],
  ];
  const tw = (y) => y < 1.0 ? blend(B.hips, B.spine, (y - 0.86) / 0.24, 0.85, 0.3)
    : y < 1.30 ? blend(B.spine, B.chest, (y - 1.0) / 0.3, 0.6, 0.35)
    : y < 1.47 ? W('chest') : blend(B.chest, B.neck, 0.6);
  const R = ([y, hx, f, b, n], col, pad = 0) => ring(v(0, y, 0), up, fwd, hx + pad, f + pad, tw(y), col, { rxn: hx + pad, ryn: b + pad, n });
  Ll.tube(torso.map((r) => R(r, legs)), 20, { capStart: true });
  Ll.blob(v(0, 1.02, 0.0), 0.152 * k, o.cash ? 0.02 : 0.012, 0.098 * k, tw(1.02), o.cash ? [0.12, 0.09, 0.07] : [legs[0] * 0.7, legs[1] * 0.7, legs[2] * 0.7], 18, 4); // belt line
  // Cash's denim jacket hangs wide open over a cream T-shirt: colour the front of the torso by angle
  const tee = [0.72, 0.66, 0.54], openFront = o.cash ? (r, a) => (Math.sin(a) > 0 && Math.abs(Math.cos(a)) < 0.4 ? tee : r.col) : null;
  Lt.tube(chest.map((r) => R(r, top, 0.006)), o.cash ? 36 : 20, { capStart: true, colFn: openFront });
  // the hood bunched behind the neck, and a collar ring
  if (o.hood === 'up') Lt.tube([ring(v(0, 1.46, -0.01), up, fwd, 0.15 * k, 0.075, blend(B.chest, B.neck, 0.2), top, { ryn: 0.11 }), ring(v(0, 1.54, -0.02), up, fwd, 0.125, 0.08, blend(B.neck, B.head, 0.3), top, { ryn: 0.115 }), ring(v(0, 1.62, -0.02), up, fwd, 0.118, 0.085, blend(B.neck, B.head, 0.7), top, { ryn: 0.12 })], 18);
  else if (o.hood !== false) Lt.blob(v(0, 1.5, -0.075), 0.115, 0.06, 0.065, blend(B.chest, B.neck, 0.4), [top[0] * 0.85, top[1] * 0.85, top[2] * 0.85], 14, 8);
  Lt.tube([ring(v(0, 1.495, 0.005), up, fwd, 0.08, 0.072, blend(B.chest, B.neck, 0.5), o.cash ? tee : top, { ryn: 0.078 }), ring(v(0, 1.525, 0.008), up, fwd, 0.072, 0.066, blend(B.chest, B.neck, 0.6), o.cash ? tee : top, { ryn: 0.072 })], 16); // collar (Cash: the T-shirt's crew neck)
  // trapezius slopes from the neck to the shoulders
  for (const sd of [1, -1]) Lt.blob(v(0.085 * sd * k, 1.475, -0.02), 0.075 * k, 0.04, 0.06, blend(B.chest, B.neck, 0.25), top, 12, 8);
  // shoulders: deltoid caps under the cloth
  for (const sd of [1, -1]) Lt.blob(v(0.175 * sd * k, 1.4, -0.002), 0.07 * k, 0.07, 0.075 * k, blend(B.chest, B[sd > 0 ? 'armL' : 'armR'], 0.55), top, 14, 10);
  // neck (in the shadow of a raised hood it's barely lit)
  const nk = o.hood === 'up' ? skin.map((c) => c * 0.3) : skin;
  Ls.tube([ring(v(0, 1.47, 0), up, fwd, 0.08, 0.072, blend(B.chest, B.neck, 0.5), nk, { ryn: 0.075 }), ring(v(0, 1.56, 0.008), up, fwd, 0.066, 0.064, W('neck'), nk, { ryn: 0.066 }), ring(v(0, 1.63, 0.014), up, fwd, 0.058, 0.064, W('head'), nk)], 14);
  if (o.mask) {
    Ls.blob(v(0, 1.71, 0.012), 0.094, 0.118, 0.108, W('head'), skin, 16, 12);
    Ls.blob(v(0, 1.66, 0.075), 0.05, 0.045, 0.04, W('head'), skin, 10, 8);
    Ls.blob(v(0.085, 1.70, 0.0), 0.015, 0.03, 0.02, W('head'), skin, 6, 4); Ls.blob(v(-0.085, 1.70, 0.0), 0.015, 0.03, 0.02, W('head'), skin, 6, 4);
  }
  // arms: biceps in front, triceps behind, forearm full near the elbow
  for (const sd of [1, -1]) {
    const S = sd > 0 ? 'L' : 'R', a = BP[B['arm' + S]], e = BP[B['fore' + S]], w = BP[B['hand' + S]];
    const dA = e.clone().sub(a), dF = w.clone().sub(e);
    const at = (p0, p1, t) => p0.clone().lerp(p1, t);
    const upper = [[0.02, 0.064, 0.06, 0.062], [0.25, 0.056, 0.058, 0.056], [0.5, 0.052, 0.056, 0.054], [0.75, 0.047, 0.048, 0.048], [0.98, 0.043, 0.042, 0.044]];
    const fore = [[0.08, 0.046, 0.046, 0.044], [0.3, 0.045, 0.044, 0.04], [0.6, 0.038, 0.036, 0.034], [0.88, 0.032, 0.03, 0.029]];
    const rings = [];
    upper.forEach(([t, rx, f, b]) => rings.push(ring(at(a, e, t), dA, fwd, rx * k + 0.01, f * k + 0.012, t < 0.15 ? blend(B.chest, B['arm' + S], 0.7) : blend(B['arm' + S], B['fore' + S], t, 1.0, 0.16), top, { ryn: b * k + 0.012 })));
    if (o.cash) { // sleeves rolled up thick just below the elbow, bare forearms
      for (const [t, g] of [[0.04, 0.022], [0.12, 0.026], [0.2, 0.02]]) rings.push(ring(at(e, w, t), dF, fwd, 0.046 + g, 0.045 + g, blend(B['fore' + S], B['hand' + S], t, 1.0, 0.1), top.map((c) => c * (t === 0.12 ? 1.1 : 0.85)), { ryn: 0.044 + g }));
      Lt.tube(rings, 14, { capEnd: true });
      Ls.tube(fore.map(([t, rx, f, b]) => ring(at(e, w, t), dF, fwd, rx * k, f * k, blend(B['fore' + S], B['hand' + S], t, 1.0, 0.1), skin, { ryn: b * k })).concat([ring(at(e, w, 0.98), dF, fwd, 0.03, 0.028, W('fore' + S), skin)]), 14);
    } else {
      fore.forEach(([t, rx, f, b]) => rings.push(ring(at(e, w, t), dF, fwd, rx + 0.012 - t * 0.004, f + 0.012 - t * 0.004, blend(B['fore' + S], B['hand' + S], t, 1.0, 0.1), top, { ryn: b + 0.012 - t * 0.004 })));
      rings.push(ring(at(e, w, 0.97), dF, fwd, 0.036, 0.034, W('fore' + S), [top[0] * 0.8, top[1] * 0.8, top[2] * 0.8])); // cuff
      Lt.tube(rings, 14, { capEnd: true });
    }
    // hand: wrist, palm (wide front-to-back), fingers loosely curled, thumb forward
    const d = new V(0, -1, 0);
    Ls.tube([
      ring(w.clone().add(v(0, 0.01, 0)), d, fwd, 0.024, 0.03, W('hand' + S), skin),
      ring(w.clone().add(v(0, -0.03, 0.004)), d, fwd, 0.019, 0.042, W('hand' + S), skin, { n: 2.6 }),
      ring(w.clone().add(v(0, -0.07, 0.006)), d, fwd, 0.017, 0.044, W('hand' + S), skin, { n: 2.6 }),
      ring(w.clone().add(v(-0.004 * sd, -0.1, 0.008)), d, fwd, 0.016, 0.04, W('hand' + S), skin, { n: 2.4 }),
      ring(w.clone().add(v(-0.012 * sd, -0.125, 0.01)), d, fwd, 0.013, 0.035, W('hand' + S), skin, { n: 2.2 }),
    ], 12, { capEnd: true });
    Ls.blob(w.clone().add(v(-0.008 * sd, -0.05, 0.045)), 0.012, 0.03, 0.013, W('hand' + S), skin, 10, 6); // thumb
  }
  // legs: thighs (quads in front, hamstrings behind), knees, calves bulging at the back
  for (const sd of [1, -1]) {
    const S = sd > 0 ? 'L' : 'R', h = BP[B['thigh' + S]], kn = BP[B['shin' + S]], an = BP[B['foot' + S]];
    const rings = [];
    const thigh = [[0, 0.098, 0.1, 0.11], [0.2, 0.09, 0.095, 0.098], [0.45, 0.08, 0.088, 0.085], [0.7, 0.068, 0.072, 0.068], [0.92, 0.056, 0.058, 0.056]];
    const shin = [[0.06, 0.056, 0.056, 0.06], [0.22, 0.054, 0.05, 0.07], [0.4, 0.05, 0.046, 0.066], [0.62, 0.044, 0.042, 0.048], [0.85, 0.04, 0.04, 0.04], [1.0, 0.042, 0.042, 0.042]];
    thigh.forEach(([t, rx, f, b]) => rings.push(ring(h.clone().lerp(kn, t), up, fwd, rx + 0.008, f + 0.008, t === 0 ? blend(B.hips, B['thigh' + S], 0.6) : blend(B['thigh' + S], B['shin' + S], t, 1, 0.16), legs, { ryn: b + 0.008 })));
    shin.forEach(([t, rx, f, b]) => rings.push(ring(kn.clone().lerp(an, t), up, fwd, rx + 0.008 + t * 0.006, f + 0.008 + t * 0.006, blend(B['shin' + S], B['foot' + S], t, 1, 0.12), legs, { ryn: b + 0.008 + t * 0.006 })));
    Ll.tube(rings, 14);
    // boot: shaft, then the foot running forward with a dark sole
    Ll.tube([
      ring(an.clone().add(v(0, 0.06, 0)), up, fwd, 0.05, 0.052, W('foot' + S), boots),
      ring(an.clone().add(v(0, -0.01, 0.0)), up, fwd, 0.052, 0.058, W('foot' + S), boots),
    ], 14);
    Ll.tube([
      ring(an.clone().add(v(0, -0.035, -0.07)), fwd, up, 0.046, 0.05, W('foot' + S), boots, { n: 2.4 }),
      ring(an.clone().add(v(0, -0.04, 0.03)), fwd, up, 0.05, 0.045, W('foot' + S), boots, { n: 2.4 }),
      ring(an.clone().add(v(0, -0.05, 0.12)), fwd, up, 0.048, 0.034, W('foot' + S), boots, { n: 2.4 }),
      ring(an.clone().add(v(0, -0.058, 0.175)), fwd, up, 0.036, 0.022, W('foot' + S), boots, { n: 2.2 }),
    ], 14, { capStart: true, capEnd: true });
    Ll.tube([ring(an.clone().add(v(0, -0.077, -0.075)), fwd, up, 0.05, 0.008, W('foot' + S), sole, { n: 3 }), ring(an.clone().add(v(0, -0.077, 0.185)), fwd, up, 0.04, 0.008, W('foot' + S), sole, { n: 3 })], 12, { capStart: true, capEnd: true });
  }
  const geo = { top: Lt.geometry(), legs: Ll.geometry(), skin: Ls.geometry() };
  shadeBody(geo, o);
  return geo;
}

// Bake what a game engine's AO and a bit of wear would give: creases, armpits,
// the crotch and the collar go dark; clothes pick up grime, mud at the hems,
// old stains. Vertex colours are linear here.
function shadeBody(geo, o) {
  const list = [geo.top, geo.legs, geo.skin], P = [], N = [], cell = 0.06, grid = new Map();
  for (const g of list) { const p = g.attributes.position.array, n = g.attributes.normal.array; for (let i = 0; i < p.length; i += 3) { const id = P.length / 3; P.push(p[i], p[i + 1], p[i + 2]); N.push(n[i], n[i + 1], n[i + 2]); const key = `${Math.floor(p[i] / cell)},${Math.floor(p[i + 1] / cell)},${Math.floor(p[i + 2] / cell)}`; let a = grid.get(key); if (!a) grid.set(key, a = []); a.push(id); } }
  const r = 0.085, hash = (x, y, z) => { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); };
  const noise = (x, y, z) => { const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz; let s = 0; for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) s += hash(ix + a, iy + b, iz + c) * (a ? fx : 1 - fx) * (b ? fy : 1 - fy) * (c ? fz : 1 - fz); return s; };
  const dirt = o.dirt ?? 0.6, seed = (o.seed || 0) * 13.7;
  let off = 0;
  list.forEach((g, gi) => {
    const col = g.attributes.color.array, cnt = col.length / 3;
    for (let i = 0; i < cnt; i++) {
      const id = off + i, x = P[id * 3], y = P[id * 3 + 1], z = P[id * 3 + 2], nx = N[id * 3], ny = N[id * 3 + 1], nz = N[id * 3 + 2];
      let occ = 0; const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
      for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (let c = -2; c <= 2; c++) {
        const L = grid.get(`${cx + a},${cy + b},${cz + c}`); if (!L) continue;
        for (const j of L) { const dx = P[j * 3] - x, dy = P[j * 3 + 1] - y, dz = P[j * 3 + 2] - z, d = Math.hypot(dx, dy, dz); if (d < 0.012 || d > r) continue; const f = (dx * nx + dy * ny + dz * nz) / d; if (f > 0.25) occ += (f - 0.25) * (1 - d / r); }
      }
      let k = 1 - Math.min(0.62, occ * 0.03);
      if (gi < 2) { // cloth: grime blotches, darker low down, mud on the jeans and boots
        const n1 = noise(x * 9 + seed, y * 9, z * 9), n2 = noise(x * 31, y * 31 + seed, z * 31);
        k *= 1 - dirt * (0.28 * Math.max(0, n1 - 0.35) + 0.1 * n2);
        const mud = gi === 1 ? Math.max(0, 0.45 - y) * 2 * dirt * noise(x * 14, y * 6 + seed, z * 14) : 0;
        col[i * 3] = col[i * 3] * k * (1 - mud * 0.2) + mud * 0.03; col[i * 3 + 1] = col[i * 3 + 1] * k * (1 - mud * 0.3) + mud * 0.02; col[i * 3 + 2] = col[i * 3 + 2] * k * (1 - mud * 0.45) + mud * 0.008;
        if (o.stains && noise(x * 7 + 40, y * 7, z * 7 + seed) > 0.72) { const t = Math.min(1, (noise(x * 7 + 40, y * 7, z * 7 + seed) - 0.72) * 6) * o.stains; col[i * 3] += (0.07 - col[i * 3]) * t; col[i * 3 + 1] += (0.012 - col[i * 3 + 1]) * t; col[i * 3 + 2] += (0.01 - col[i * 3 + 2]) * t; } // old dried blood
      } else { col[i * 3] *= k; col[i * 3 + 1] *= k; col[i * 3 + 2] *= k; }
    }
    off += cnt;
  });
}

export function makeSkeleton() {
  const bones = BONES.map(([n]) => { const b = new THREE.Bone(); b.name = n; return b; });
  BONES.forEach(([, p, pos], i) => {
    const world = new V(...pos);
    if (p >= 0) { bones[i].position.copy(world.sub(BP[p])); bones[p].add(bones[i]); } else bones[i].position.copy(world);
  });
  bones[0].updateMatrixWorld(true); // bind inverses come from these
  return new THREE.Skeleton(bones);
}

// ------------------------------------------------------------------ Person
export class Person {
  constructor(o = {}) {
    this.o = o = Object.assign({ skin: SKIN_TONES[0], top: [0.18, 0.18, 0.2], legs: [0.16, 0.2, 0.3], bulk: 1, mask: 'hockey', sleeves: true, weapon: 'bat' }, o);
    const geo = buildGeometry(o);
    this.skel = makeSkeleton();
    this.root = new THREE.Group();
    const mats = {
      top: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, map: T.fleece.map, bumpMap: T.fleece.bump, bumpScale: 0.006, side: THREE.DoubleSide }), // both sides: the lofted tubes are open, never let you see through them
      legs: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, map: T.denim.map, bumpMap: T.denim.bump, bumpScale: 0.005, side: THREE.DoubleSide }),
      skin: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, bumpMap: T.skin, bumpScale: 0.002, side: THREE.DoubleSide }),
    };
    this.meshes = ['legs', 'top', 'skin'].map((k, i) => {
      const m = new THREE.SkinnedMesh(geo[k], mats[k]);
      if (i === 0) m.add(this.skel.bones[0]);
      m.castShadow = true; m.frustumCulled = false; this.root.add(m); return m;
    });
    this.root.updateMatrixWorld(true);
    for (const m of this.meshes) m.bind(this.skel, m.matrixWorld);
    this.mesh = this.meshes[0];
    this.bones = this.skel.bones;
    this.rest = this.bones.map((b) => b.position.clone());
    // mask on the face, held by the head bone
    if (o.mask) {
      const mk = new THREE.Mesh(new THREE.SphereGeometry(0.112, 18, 12, Math.PI * 0.04, Math.PI * 0.92, Math.PI * 0.12, Math.PI * 0.68), new THREE.MeshStandardMaterial({ map: T.mask[o.mask], transparent: o.mask === 'hockey', alphaTest: 0.5, roughness: o.mask === 'hockey' ? 0.4 : 0.9, side: THREE.DoubleSide }));
      mk.rotation.y = 0; mk.scale.set(0.98, 1.12, 1.02); mk.position.set(0, 0.11, 0.014);
      if (o.mask === 'knit') { mk.geometry = new THREE.SphereGeometry(0.108, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.82); mk.material.transparent = false; }
      if (o.mask === 'swat') { // ballistic helmet and a dark visor over the balaclava
        mk.geometry = new THREE.SphereGeometry(0.106, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.85); mk.material.transparent = false;
        const helm = new THREE.Mesh(new THREE.SphereGeometry(0.128, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), new THREE.MeshStandardMaterial({ color: 0x1a1c1a, roughness: 0.5, metalness: 0.2 }));
        helm.position.set(0, 0.13, 0); helm.scale.set(1, 0.9, 1.08); this.bones[B.head].add(helm);
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.02), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.05, metalness: 0.9 })); visor.position.set(0, 0.12, 0.112); this.bones[B.head].add(visor);
      }
      if (o.mask === 'pig') {
        mk.geometry = new THREE.SphereGeometry(0.13, 20, 14); mk.material.transparent = false; mk.scale.set(1.05, 1.05, 1.15); mk.position.set(0, 0.11, 0.02);
        const pink = new THREE.MeshStandardMaterial({ color: 0xb0786a, roughness: 0.6 });
        const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.07, 16), pink); snout.rotation.x = Math.PI / 2; snout.position.set(0, 0.075, 0.155); this.bones[B.head].add(snout);
        const disc = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), new THREE.MeshStandardMaterial({ map: T.mask.pig, roughness: 0.6 })); disc.position.set(0, 0.075, 0.191); this.bones[B.head].add(disc);
        for (const s of [1, -1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 8), pink); ear.position.set(0.09 * s, 0.23, 0.0); ear.rotation.z = -0.6 * s; this.bones[B.head].add(ear); }
      }
      this.bones[B.head].add(mk); this.maskMesh = mk;
      // eyes glinting behind the holes
      const eyeM = new THREE.MeshBasicMaterial({ color: 0x1a1410 });
      for (const s of [1, -1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), eyeM); e.position.set(0.033 * s, 0.11, 0.085); this.bones[B.head].add(e); }
    }
    // bare faces get eyes, brows, a nose and a mouth
    if (!o.mask) {
      const hb = this.bones[B.head], dark = new THREE.MeshStandardMaterial({ color: 0x1a120e, roughness: 0.6 });
      this.head = makeHead(o.skin, o.stubble, o.hair, o.cash || o.cashFace); this.head.position.set(0, 0.088, 0.012); this.head.scale.setScalar(1.2); hb.add(this.head); // a man-sized head, sat down on the neck
      const white = new THREE.MeshStandardMaterial({ color: 0xb8ae9e, roughness: 0.35 }), iris = new THREE.MeshStandardMaterial({ color: 0x1e140c, roughness: 0.15 });
      const skinM = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(o.skin[0] * 0.9, o.skin[1] * 0.82, o.skin[2] * 0.82, THREE.SRGBColorSpace), roughness: 0.8 });
      for (const s of [1, -1]) {
        const eye = new THREE.Group(); eye.position.set(0.033 * s, 0.122, 0.085); hb.add(eye);
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.0128, 14, 12), white); e.scale.set(1, 0.85, 1); eye.add(e);
        const ir = new THREE.Mesh(new THREE.SphereGeometry(0.0082, 12, 10), iris); ir.position.z = 0.0094; ir.scale.z = 0.45; eye.add(ir);
        const lower = new THREE.Mesh(new THREE.SphereGeometry(0.0136, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.3), skinM); lower.rotation.x = Math.PI - 0.5; eye.add(lower);
        const lid = new THREE.Mesh(new THREE.SphereGeometry(0.0136, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), skinM); lid.rotation.x = -0.7; eye.add(lid);
        (this.lids || (this.lids = [])).push(lid);
      }
      this.blinkT = 2 + Math.random() * 3;
    }
    // hood up: a fleece shell round the skull, open at the face
    if (o.hood === 'up') {
      const sr = o.top.map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)) * 0.8);
      const hm = new THREE.MeshStandardMaterial({ color: new THREE.Color(sr[0], sr[1], sr[2]), map: T.fleece.map, bumpMap: T.fleece.bump, bumpScale: 0.006, roughness: 0.95, side: THREE.DoubleSide });
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.128, 24, 16, Math.PI / 2 + 0.78, Math.PI * 2 - 1.56, 0, Math.PI * 0.7), hm);
      hood.position.set(0, 0.112, -0.012); hood.scale.set(1.02, 1.12, 1.1); hood.castShadow = true;
      // the rim folds back a little round the face
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.104, 0.012, 6, 20, Math.PI * 1.2), hm); rim.rotation.set(0.12, 0, -0.1 * Math.PI); rim.position.set(0, 0.105, 0.06); rim.scale.set(0.92, 1.25, 1);
      this.bones[B.head].add(hood, rim); this.hoodMesh = hood;
    }
    // Cash's Darkwoods inmate patch on the right breast
    if (o.cash) {
      const pc = document.createElement('canvas'); pc.width = 128; pc.height = 64; const pg = pc.getContext('2d');
      pg.fillStyle = '#d8d2c0'; pg.fillRect(0, 0, 128, 64); pg.strokeStyle = '#3a3a3a'; pg.lineWidth = 4; pg.strokeRect(3, 3, 122, 58);
      pg.fillStyle = '#1a1a1a'; pg.font = 'bold 34px "Courier New", monospace'; pg.textAlign = 'center'; pg.fillText('10771', 64, 44);
      const pt = new THREE.CanvasTexture(pc); pt.colorSpace = THREE.SRGBColorSpace;
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.042), new THREE.MeshStandardMaterial({ map: pt, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }));
      patch.scale.setScalar(0.7); patch.position.set(-0.13, 0.08, 0.125 * (o.bulk || 1)); patch.rotation.set(-0.12, -0.6, 0); this.bones[B.chest].add(patch);
      const k = o.bulk || 1, ch = this.bones[B.chest];
      const jacket = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(o.top[0] * 0.85, o.top[1] * 0.85, o.top[2] * 0.85, THREE.SRGBColorSpace), map: T.fleece.map, roughness: 0.95, side: THREE.DoubleSide });
      // the jacket's raised collar round the back and sides of the neck
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.135, 0.045, 20, 1, true, Math.PI * 0.62, Math.PI * 1.76), jacket); collar.position.set(0, 0.19, -0.015); collar.rotation.x = -0.15; ch.add(collar); // folded down onto the shoulders
      // the dark blue strap he hangs weapons from: over the left shoulder, across chest and back to the right hip
      const strapM = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.07, 0.075, 0.09, THREE.SRGBColorSpace), roughness: 0.55 });
      for (const z of [0.135 * k, -0.118]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.62, 0.012), strapM); st.position.set(0.0, -0.02, z); st.rotation.set(z > 0 ? -0.1 : 0.1, 0, -0.72); ch.add(st); }
      const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.016), new THREE.MeshStandardMaterial({ color: 0x8a8a84, metalness: 0.9, roughness: 0.35 })); buckle.position.set(-0.053, -0.08, 0.145 * k); buckle.rotation.z = -0.72; ch.add(buckle);
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.05), strapM); pouch.position.set(-0.15, -0.2, 0.07); pouch.rotation.set(0, -0.5, -0.1); this.bones[B.spine].add(pouch); // holster at the right hip
    }
    // weapon in the right hand
    this.weapon = o.weapon ? makeHunterWeapon(o.weapon) : null;
    if (this.weapon) { this.weapon.position.set(0, -0.1, 0.02); this.bones[B.handR].add(this.weapon); }
    // a flashlight for some
    this.wounds = []; this.soaks = []; this.soakT = 0;
    for (const m of this.meshes) m.userData.base = m.geometry.attributes.color.array.slice();
    this.anim = { phase: 0, speed: 0, look: 0, lookV: 0, swing: -1, struggle: 0, alert: 0, stagger: 0, crouch: 0, hold: 0 };
    this.rag = null;
  }

  // mouth 0..1 (driven by the voice), with blinking
  face(dt, talk = 0) {
    if (!this.head) return;
    const m = this.head.morphTargetInfluences; m[0] += (talk - m[0]) * Math.min(1, dt * 22);
    const mo = this.head.userData.mouth; mo.gap.scale.y = 0.0001 + m[0] * 0.006; mo.gap.position.y = -0.045 - m[0] * 0.004;
    this.blinkT -= dt; let k = 0;
    if (this.blinkT < 0) { k = Math.min(1, -this.blinkT / 0.06); if (this.blinkT < -0.14) this.blinkT = 2 + Math.random() * 4; }
    const shut = this.blinkT < 0 ? (this.blinkT > -0.07 ? k : 1 - (-this.blinkT - 0.07) / 0.07) : 0;
    for (const l of this.lids) l.rotation.x = -0.7 + shut * 0.7;
  }
  // world position of a bone (after updateMatrixWorld)
  bonePos(name, out = new V()) { return this.bones[B[name]].getWorldPosition(out); }
  headPos(out = new V()) { return this.bones[B.head].localToWorld(out.set(0, 0.11, 0.01)); }

  // ---------------------------------------------------------- animation
  animate(dt, t) {
    if (this.soaks.length) this.soak(dt);
    if (this.rag) { this.rag.step(dt); return; }
    const A = this.anim, b = this.bones;
    for (let i = 0; i < b.length; i++) { b[i].quaternion.identity(); b[i].position.copy(this.rest[i]); }
    const sp = A.speed;
    A.phase += dt * (sp < 0.05 ? 0 : 2.2 + sp * 1.5);
    const ph = A.phase, run = Math.min(1, Math.max(0, (sp - 1.8) / 1.6)), walkAmp = Math.min(1, sp / 1.2);
    const swing = (0.45 + run * 0.35) * walkAmp;
    const e = new THREE.Euler();
    const rot = (n, x, y = 0, z = 0) => b[B[n]].quaternion.multiply(new Q().setFromEuler(e.set(x, y, z)));
    if (this.pose) { this.pose(rot, b, dt, t, B); return; } // a scripted performance (finisher.js) drives every bone
    // legs
    rot('thighL', -Math.sin(ph) * swing - A.crouch * 0.9); rot('thighR', Math.sin(ph) * swing - A.crouch * 0.9);
    rot('shinL', Math.max(0, Math.sin(ph - 1.3)) * (0.6 + run * 0.7) * walkAmp + A.crouch * 1.4);
    rot('shinR', Math.max(0, Math.sin(ph - 1.3 + Math.PI)) * (0.6 + run * 0.7) * walkAmp + A.crouch * 1.4);
    // feet roll heel-to-toe with the stride
    rot('footL', -A.crouch * 0.5 + (Math.sin(ph) * 0.25 - Math.max(0, Math.sin(ph - 1.3)) * 0.35) * walkAmp);
    rot('footR', -A.crouch * 0.5 + (-Math.sin(ph) * 0.25 - Math.max(0, Math.sin(ph - 1.3 + Math.PI)) * 0.35) * walkAmp);
    b[B.hips].position.y = this.rest[B.hips].y - Math.abs(Math.cos(ph)) * 0.03 * walkAmp - A.crouch * 0.28 + 0.015 * walkAmp;
    // torso
    rot('hips', 0, Math.sin(ph) * 0.12 * walkAmp, Math.cos(ph) * 0.05 * walkAmp); // hips turn and drop with each step
    rot('spine', run * 0.18 + A.crouch * 0.35 + A.alert * 0.06, -Math.sin(ph) * 0.1 * walkAmp, Math.sin(t * 1.3) * 0.015);
    rot('chest', 0.02 + Math.sin(t * 1.7) * 0.01, A.look * 0.4, 0);
    rot('neck', -run * 0.15 - A.crouch * 0.2, A.look * 0.4, 0);
    rot('head', A.lookV, A.look * 0.4, 0);
    // arms
    const armSw = swing * 0.8;
    rot('armL', (Math.sin(ph) * armSw * 0.9 - run * 0.2) * (1 - A.hold * 0.8) - A.hold * 0.45, 0, 0.12); rot('foreL', -0.25 - run * 1.1 - Math.max(0, Math.sin(ph)) * 0.3 * walkAmp * (1 - A.hold) - A.hold * 0.65);
    if (A.swing >= 0) { // overhead strike with the right hand
      const s = A.swing, raise = s < 0.45 ? s / 0.45 : 1 - (s - 0.45) / 0.55;
      const strike = s < 0.45 ? 0 : Math.min(1, (s - 0.45) / 0.18);
      rot('chest', 0, -0.4 * raise + 0.5 * strike, 0);
      rot('armR', -2.6 * raise - 0.6 * strike * (1 - raise), 0, -0.25 * raise);
      rot('foreR', -1.0 * raise);
    } else {
      rot('armR', -Math.sin(ph) * armSw * 0.5 - 0.15, 0, -0.1); rot('foreR', -0.55 - run * 0.8);
    }
    if (A.struggle > 0) { // bag over the head / being held: hands claw at the face, body bucks
      const s = A.struggle, k = Math.sin(t * 17) * 0.25 + Math.sin(t * 9.3) * 0.2;
      for (const S of ['L', 'R']) { b[B['arm' + S]].quaternion.identity(); b[B['fore' + S]].quaternion.identity(); }
      rot('armL', -2.1 * s + k, 0, 0.5 * s); rot('foreL', -1.8 * s - k * 0.6);
      rot('armR', -2.1 * s - k, 0, -0.5 * s); rot('foreR', -1.8 * s + k * 0.6);
      rot('spine', -0.25 * s + k * 0.15, k * 0.3, 0); rot('neck', -0.4 * s, Math.sin(t * 13) * 0.4 * s, 0);
      rot('shinL', 0.3 * s); rot('shinR', 0.6 * s * Math.max(0, Math.sin(t * 6)));
      rot('thighL', -0.3 * s * Math.max(0, Math.sin(t * 5 + 1)));
    }
    if (A.stagger > 0) { rot('spine', -0.35 * A.stagger, 0, 0.2 * A.stagger); rot('neck', -0.5 * A.stagger); A.stagger = Math.max(0, A.stagger - dt * 1.8); }
  }

  // ------------------------------------------------------------ wounds
  wound(boneName, worldPoint, size = 1) {
    const bi = B[boneName], bone = this.bones[bi];
    const local = bone.worldToLocal(worldPoint.clone());
    // the gash itself: a torn, wet opening facing out from the bone
    const out = local.clone().setY(0); if (out.lengthSq() < 1e-6) out.set(0, 0, 1); out.normalize();
    const d = new THREE.Mesh(new THREE.PlaneGeometry(...Array(2).fill(Math.min(boneName === 'neck' || boneName === 'head' ? 0.1 : 0.2, 0.13 * size))), new THREE.MeshStandardMaterial({ map: T.wound[Math.floor(Math.random() * T.wound.length)], transparent: true, alphaTest: 0.05, roughness: 0.18, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    const surf = { head: 0.115, neck: 0.075, chest: 0.15, spine: 0.14, hips: 0.15 }[boneName] || 0.06, rad = Math.hypot(local.x, local.z);
    d.position.copy(local).addScaledVector(out, Math.max(0, surf - rad) + 0.008); // sit on the skin/cloth, not inside it
    bone.add(d); bone.updateMatrixWorld(true);
    d.up.set(0, 1, 0); d.lookAt(bone.localToWorld(d.position.clone().add(out))); d.rotateZ((Math.random() - 0.5) * 0.35); // lookAt wants a world point
    this.wounds.push(d);
    // blood soaks out through the clothes from here and runs down
    this.soaks.push({ p: BP[bi].clone().add(local), r: 0, max: 0.13 + size * 0.09, t: 0 }); this.soakT = 0;
  }
  // grow the soaked patches in the vertex colours (bind space = geometry space)
  soak(dt) {
    this.soakT -= dt; let live = false;
    for (const s of this.soaks) { s.t += dt; s.r = s.max * Math.min(1, Math.sqrt(s.t / 7)); if (s.t < 7) live = true; }
    if (this.soakT > 0) return; this.soakT = 0.12;
    for (const m of this.meshes) {
      const pos = m.geometry.attributes.position.array, ca = m.geometry.attributes.color, col = ca.array, base = m.userData.base;
      for (let i = 0; i < pos.length; i += 3) {
        let k = 0;
        for (const s of this.soaks) {
          const dx = pos[i] - s.p.x, dy = pos[i + 1] - s.p.y, dz = pos[i + 2] - s.p.z;
          if (dy > s.r || dy < -s.r * 3.2) continue;
          const d = Math.sqrt(dx * dx + dz * dz * 0.8 + (dy > 0 ? dy * dy : dy * dy * 0.1)) / (s.r + 1e-4); // runs down far more than up
          const rag = 0.85 + 0.1 * Math.sin(pos[i] * 23 + pos[i + 1] * 17) + 0.05 * Math.sin(pos[i + 2] * 31 - pos[i + 1] * 29);
          if (d < rag) k = Math.max(k, Math.min(1, (rag - d) * 2.5));
        }
        const wet = Math.min(0.97, k * 1.1);
        col[i] = base[i] + (0.075 - base[i]) * wet; col[i + 1] = base[i + 1] + (0.0015 - base[i + 1]) * wet; col[i + 2] = base[i + 2] + (0.002 - base[i + 2]) * wet;
      }
      ca.needsUpdate = true;
    }
    if (!live) this.soakT = 1e9; // done spreading: stop touching the buffers
  }

  // ------------------------------------------------------------ ragdoll
  die(impulse = new V(), at = null, world = null) {
    if (this.rag) return;
    this.root.updateMatrixWorld(true);
    this.rag = new Ragdoll(this, impulse, at, world);
  }
}

// A sculpted head: an ellipsoid pushed and pulled into a face (sockets, brow,
// cheekbones, nose, lips, chin, jaw, ears), vertex-painted, with a morph
// target that drops the jaw so the mouth opens when he talks.
function makeHead(skin, stubble = false, hair = null, cash = false) {
  const g = new THREE.SphereGeometry(1, 72, 56), p = g.attributes.position, n = p.count;
  const open = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const gs = (x, y, z, cx, cy, cz, sx, sy, sz) => Math.exp(-((x - cx) ** 2 / (2 * sx * sx) + (y - cy) ** 2 / (2 * sy * sy) + (z - cz) ** 2 / (2 * sz * sz)));
  const v = new V();
  for (let i = 0; i < n; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i));
    const ux = v.x, uy = v.y, uz = v.z;
    // base skull: narrower jaw, flatter face, fuller back of the skull
    let rx = 0.076, ry = 0.104, rz = 0.1;
    if (uy < 0) { rx *= 1 - 0.26 * Math.min(1, -uy * 1.2) * (uz > -0.2 ? 1 : 0.4); ry *= 0.9; }
    if (uz < 0) rz *= 1.06;
    let x = ux * rx, y = uy * ry, z = uz * rz;
    if (uz > 0) { z *= 1 - 0.06 * gs(ux, uy, uz, 0, 0.1, 1, 0.5, 0.45, 0.6); const side = Math.abs(ux); if (uy < 0.35) x *= 1 - 0.1 * Math.max(0, uz - 0.4) * side; }
    const front = Math.max(0, uz);
    // features as offsets along the surface normal, mostly on the face
    let d = 0;
    d -= 0.012 * (gs(x, y, z, 0.031, 0.018, 0.09, 0.017, 0.013, 0.04) + gs(x, y, z, -0.031, 0.018, 0.09, 0.013, 0.011, 0.04));   // eye sockets
    d += 0.0085 * gs(x, y, z, 0, 0.037, 0.09, 0.05, 0.007, 0.04) * front;                                                           // brow ridge
    d += 0.007 * gs(x, y, z, 0, 0.006, 0.1, 0.006, 0.016, 0.05) * front + 0.011 * gs(x, y, z, 0, -0.02, 0.1, 0.01, 0.008, 0.05) * front;                                                         // nose bridge + tip
    d += 0.005 * gs(x, y, z, 0, -0.027, 0.1, 0.014, 0.005, 0.05) * front;
    d -= 0.006 * (gs(x, y, z, 0.05, -0.03, 0.06, 0.015, 0.02, 0.04) + gs(x, y, z, -0.05, -0.03, 0.06, 0.015, 0.02, 0.04)); // hollow cheeks
    d -= 0.004 * (gs(x, y, z, 0.065, 0.035, 0.04, 0.012, 0.02, 0.03) + gs(x, y, z, -0.065, 0.035, 0.04, 0.012, 0.02, 0.03)); // temples                                                           // nostrils
    d += 0.008 * (gs(x, y, z, 0.048, 0.0, 0.07, 0.016, 0.013, 0.04) + gs(x, y, z, -0.048, 0.0, 0.07, 0.016, 0.013, 0.04));       // cheekbones
    d += 0.0045 * gs(x, y, z, 0, -0.041, 0.095, 0.02, 0.004, 0.04) * front + 0.005 * gs(x, y, z, 0, -0.05, 0.095, 0.018, 0.0045, 0.04) * front; // lips
    d += 0.011 * gs(x, y, z, 0, -0.082, 0.078, 0.02, 0.012, 0.04) * front;
    d -= 0.003 * gs(x, y, z, 0, -0.065, 0.09, 0.012, 0.004, 0.04) * front; // dip under the lower lip                                                         // chin
    d -= 0.005 * (gs(x, y, z, 0.03, -0.035, 0.085, 0.012, 0.02, 0.04) + gs(x, y, z, -0.03, -0.035, 0.085, 0.012, 0.02, 0.04));   // nasolabial folds
    v.set(x, y, z); const nrm = v.clone().normalize(); v.addScaledVector(nrm, d);
    p.setXYZ(i, v.x, v.y, v.z);
    // jaw-open morph: everything under the mouth line swings down about a hinge below the ears
    const below = Math.min(1, Math.max(0, (-0.044 - v.y) / 0.012)) * (v.z > -0.03 ? 1 : 0.2);
    const piv = new V(0, -0.02, -0.01), q = v.clone().sub(piv).applyAxisAngle(new V(1, 0, 0), 0.32 * below).add(piv);
    open[i * 3] = q.x; open[i * 3 + 1] = q.y; open[i * 3 + 2] = q.z;
    // paint: lips redder, brows and stubble darker, a little colour in the cheeks
    let c = [skin[0], skin[1], skin[2]];
    const lip = gs(v.x, v.y, v.z, 0, -0.05, 0.095, 0.018, 0.008, 0.03) * front, seam = gs(v.x, v.y, v.z, 0, -0.05, 0.095, 0.019, 0.0016, 0.03) * front;
    c = [c[0] * (1 - seam * 0.6) + lip * 0.06, c[1] * (1 - seam * 0.6) - lip * 0.04, c[2] * (1 - seam * 0.6) - lip * 0.03];
    const cheek = gs(v.x, v.y, v.z, 0.045, -0.01, 0.07, 0.02, 0.02, 0.04) + gs(v.x, v.y, v.z, -0.045, -0.01, 0.07, 0.02, 0.02, 0.04);
    c = [c[0] + cheek * 0.04, c[1] - cheek * 0.01, c[2] - cheek * 0.01];
    const socket = gs(v.x, v.y, v.z, 0.031, 0.016, 0.09, 0.016, 0.012, 0.04) + gs(v.x, v.y, v.z, -0.031, 0.016, 0.09, 0.016, 0.012, 0.04);
    c = c.map((k) => k * (1 - socket * 0.3));
    if (stubble) { const jaw = Math.min(1, Math.max(0, (-0.035 - v.y) / 0.02)) * (v.z > -0.04 ? 1 : 0) * (1 - lip); c = c.map((k) => k * (1 - jaw * 0.32)); }
    const crease = gs(v.x, v.y, v.z, 0.032, 0.03, 0.09, 0.012, 0.003, 0.03) + gs(v.x, v.y, v.z, -0.032, 0.03, 0.09, 0.012, 0.003, 0.03);
    const philtrum = gs(v.x, v.y, v.z, 0, -0.033, 0.098, 0.004, 0.004, 0.03) * front, under = gs(v.x, v.y, v.z, 0, -0.03, 0.09, 0.016, 0.0035, 0.03) * front;
    c = c.map((k) => k * (1 - crease * 0.25 - under * 0.18 - philtrum * 0.08));
    if (hair) { const line = v.z > 0.03 ? 0.05 : v.z > -0.02 ? 0.028 : -0.03, top = Math.min(1, Math.max(0, (v.y - line) / 0.008)); c = c.map((k, j) => k * (1 - top) + hair[j] * top); }
    if (stubble) { const scalp = Math.min(1, Math.max(0, (v.y - 0.05) / 0.03)) * (v.z < 0.08 ? 1 : 0.3); c = c.map((k) => k * (1 - scalp * 0.22)); } // shaved head shadow
    const lin = (x) => x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    col[i * 3] = lin(c[0]); col[i * 3 + 1] = lin(c[1]); col[i * 3 + 2] = lin(c[2]);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // front projection for the painted face
  const uv = g.attributes.uv;
  // front only: the back and far sides of the head map to a blank corner of the texture, or the face shows through behind
  for (let i = 0; i < n; i++) { if (p.getZ(i) > 0.025) uv.setXY(i, 0.5 + p.getX(i) / 0.16, 0.5 + p.getY(i) / 0.22); else uv.setXY(i, 0.004, 0.996); }
  g.morphAttributes.position = [new THREE.BufferAttribute(open, 3)];
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, map: paintFace(stubble, hair, cash), roughness: 0.62, bumpMap: T.skin, bumpScale: 0.0012 }));
  mesh.morphTargetInfluences = [0];
  // the inside of the mouth, seen when the jaw drops
  const inner = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), new THREE.MeshStandardMaterial({ color: 0x2a0c0a, roughness: 0.9 }));
  inner.position.set(0, -0.056, 0.06); inner.scale.set(0.9, 0.45, 0.6); mesh.add(inner);
  // lips: a soft upper and lower lip and the dark gap between them; the lower lip rides the jaw
  const gap = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), new THREE.MeshStandardMaterial({ color: 0x1a0806, roughness: 1 }));
  gap.scale.set(0.02, 0.0001, 0.006); gap.position.set(0, -0.045, 0.082); mesh.add(gap);
  mesh.userData.mouth = { gap };
  // ears
  const ear = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(skin[0] * 0.95, skin[1] * 0.85, skin[2] * 0.85, THREE.SRGBColorSpace), roughness: 0.7 }); // skin tones are sRGB
  for (const s of [1, -1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), ear); e.scale.set(0.35, 1.25, 0.8); e.position.set(0.079 * s, 0.0, -0.005); mesh.add(e); }
  mesh.castShadow = true;
  return mesh;
}

// The face, painted the way old games did it: shading, lids, brows, nostrils,
// lips and stubble as a texture that multiplies the skin colour. Coordinates
// are head-space metres: x -0.08..0.08 left to right, y -0.11..0.11 bottom to top.
const faceCache = {};
function paintFace(stubble, hair, cash = false) {
  const key = (stubble ? 's' : '') + (hair ? 'h' : '') + (cash ? 'c' : ''); if (faceCache[key]) return faceCache[key];
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  const X = (x) => (0.5 + x / 0.16) * N, Y = (y) => (0.5 - y / 0.22) * N, S = (d) => d / 0.16 * N;
  g.fillStyle = '#fff'; g.fillRect(0, 0, N, N);
  const blob = (x, y, rx, ry, col, a = 1) => { g.save(); g.translate(X(x), Y(y)); g.scale(1, ry / rx); const gr = g.createRadialGradient(0, 0, 0, 0, 0, S(rx)); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.globalAlpha = a; g.fillStyle = gr; g.beginPath(); g.arc(0, 0, S(rx), 0, 7); g.fill(); g.restore(); };
  for (const s of [1, -1]) {
    blob(0.031 * s, 0.019, 0.022, 0.016, 'rgba(120,90,80,0.55)');            // socket shadow
    blob(0.031 * s, 0.0, 0.016, 0.008, 'rgba(150,110,100,0.35)');            // under-eye
    // upper lid line and crease
    g.strokeStyle = 'rgba(60,35,28,0.8)'; g.lineWidth = S(0.0016); g.beginPath(); g.ellipse(X(0.031 * s), Y(0.019), S(0.015), S(0.0075), 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    g.strokeStyle = 'rgba(110,75,65,0.5)'; g.lineWidth = S(0.0012); g.beginPath(); g.ellipse(X(0.031 * s), Y(0.022), S(0.014), S(0.008), 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    // brows: many short hair strokes along an arch
    for (let k = 0; k < 70; k++) {
      const t = k / 70, bx = (0.012 + t * 0.036) * s, by = 0.036 + Math.sin(t * Math.PI) * 0.005 - t * 0.002;
      g.strokeStyle = `rgba(${hair ? '40,26,18' : '55,40,30'},${0.55 + Math.random() * 0.35})`; g.lineWidth = S(0.0009 + Math.random() * 0.0007);
      g.beginPath(); g.moveTo(X(bx + (Math.random() - 0.5) * 0.002), Y(by + (Math.random() - 0.5) * 0.004)); g.lineTo(X(bx + 0.004 * s), Y(by + 0.0025)); g.stroke();
    }
    blob(0.011 * s, -0.005, 0.006, 0.022, 'rgba(150,110,100,0.4)');           // side of the nose
    blob(0.0085 * s, -0.029, 0.0045, 0.0028, 'rgba(60,30,26,0.85)');          // nostril
    // smile lines from the nose wing toward the mouth corner
    g.strokeStyle = 'rgba(140,100,90,0.22)'; g.lineWidth = S(0.003); g.beginPath(); g.moveTo(X(0.015 * s), Y(-0.025)); g.quadraticCurveTo(X(0.026 * s), Y(-0.038), X(0.027 * s), Y(-0.05)); g.stroke();
    blob(0.045 * s, -0.012, 0.022, 0.018, 'rgba(235,170,160,0.25)');           // a little colour in the cheek
  }
  blob(0, -0.02, 0.007, 0.006, 'rgba(255,240,235,0.4)');                       // nose tip highlight
  blob(0, -0.033, 0.004, 0.006, 'rgba(160,115,105,0.35)');                     // philtrum
  // lips: upper lip darker, lower lip fuller, a dark line where they meet
  g.fillStyle = 'rgba(190,110,105,0.75)'; g.beginPath(); g.moveTo(X(-0.023), Y(-0.044)); g.quadraticCurveTo(X(-0.01), Y(-0.036), X(0), Y(-0.039)); g.quadraticCurveTo(X(0.01), Y(-0.036), X(0.023), Y(-0.044)); g.quadraticCurveTo(X(0), Y(-0.046), X(-0.023), Y(-0.044)); g.fill();
  g.fillStyle = 'rgba(205,125,118,0.7)'; g.beginPath(); g.moveTo(X(-0.021), Y(-0.045)); g.quadraticCurveTo(X(0), Y(-0.058), X(0.021), Y(-0.045)); g.quadraticCurveTo(X(0), Y(-0.047), X(-0.021), Y(-0.045)); g.fill();
  g.strokeStyle = 'rgba(70,30,28,0.9)'; g.lineWidth = S(0.0014); g.beginPath(); g.moveTo(X(-0.024), Y(-0.0443)); g.quadraticCurveTo(X(0), Y(-0.0465), X(0.024), Y(-0.0443)); g.stroke();
  blob(0, -0.062, 0.016, 0.005, 'rgba(150,110,100,0.4)');                      // shadow under the lower lip
  if (stubble) { // a few days of growth on the jaw, chin and top lip
    for (let k = 0; k < 9000; k++) {
      const x = (Math.random() - 0.5) * 0.15, y = -0.03 - Math.random() * 0.08;
      if (y > -0.04 && Math.abs(x) < 0.03 && y < -0.032) continue;
      if (y > -0.05 && y < -0.04 && Math.abs(x) < 0.025) continue;
      g.fillStyle = `rgba(45,35,30,${0.15 + Math.random() * 0.3})`; g.fillRect(X(x), Y(y), 1.4, 1.4);
    }
    for (let k = 0; k < 1500; k++) { const x = (Math.random() - 0.5) * 0.05, y = -0.031 - Math.random() * 0.009; g.fillStyle = 'rgba(45,35,30,0.3)'; g.fillRect(X(x), Y(y), 1.3, 1.3); }
  }
  if (cash) {
    // James Earl Cash: a short dark-brown beard on the chin, stubble on the top lip, a scar on the left of the forehead
    for (let k = 0; k < 14000; k++) {
      const x = (Math.random() - 0.5) * 0.06, y = -0.05 - Math.random() * 0.05, edge = Math.abs(x) / 0.03 + Math.max(0, (-0.05 - y) / 0.05 - 0.7);
      if (y > -0.058 && Math.abs(x) > 0.012 || Math.random() < edge * 0.7) continue; // chin, fading out at the sides
      g.strokeStyle = `rgba(${38 + Math.random() * 20 | 0},${24 + Math.random() * 12 | 0},${16 + Math.random() * 8 | 0},${0.35 + Math.random() * 0.45})`; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(X(x), Y(y)); g.lineTo(X(x + (Math.random() - 0.5) * 0.003), Y(y - 0.0025 - Math.random() * 0.002)); g.stroke();
    }
    for (let k = 0; k < 2600; k++) { const x = (Math.random() - 0.5) * 0.048, y = -0.03 - Math.random() * 0.011; if (Math.abs(x) > 0.024 - (y + 0.03) * -0.4) continue; g.fillStyle = `rgba(40,28,20,${0.3 + Math.random() * 0.35})`; g.fillRect(X(x), Y(y), 1.4, 1.6); }
    // the scar: a pale, slightly shiny seam with old stitch marks across it
    g.save(); g.translate(X(0.034), Y(0.072)); g.rotate(-0.55);
    g.strokeStyle = 'rgba(230,185,170,0.85)'; g.lineWidth = S(0.0028); g.lineCap = 'round'; g.beginPath(); g.moveTo(-S(0.018), 0); g.quadraticCurveTo(0, -S(0.0025), S(0.018), S(0.001)); g.stroke();
    g.strokeStyle = 'rgba(150,80,70,0.45)'; g.lineWidth = S(0.001); g.beginPath(); g.moveTo(-S(0.018), S(0.0016)); g.quadraticCurveTo(0, -S(0.0008), S(0.018), S(0.0026)); g.stroke();
    g.strokeStyle = 'rgba(170,110,100,0.5)'; g.lineWidth = S(0.0008); for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(S(k * 0.005), -S(0.003)); g.lineTo(S(k * 0.005 + 0.0005), S(0.003)); g.stroke(); }
    g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (faceCache[key] = t);
}

function makeHunterWeapon(kind) {
  const g = new THREE.Group();
  if (kind === 'bat') {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.016, 0.84, 10), new THREE.MeshStandardMaterial({ map: T.wood.map, color: 0xb08860, roughness: 0.6 }));
    m.position.y = 0; m.rotation.x = Math.PI / 2; m.position.z = 0.34; g.add(m);
    // nails
    const nm = new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.9, roughness: 0.4 });
    for (let k = 0; k < 6; k++) { const n = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.09, 4), nm); n.position.set(Math.cos(k * 2) * 0.03, Math.sin(k * 2) * 0.03, 0.62 + k * 0.02); n.rotation.z = k * 2; g.add(n); }
  } else if (kind === 'machete') {
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.05, 0.48), new THREE.MeshStandardMaterial({ color: 0x8a8d90, metalness: 0.95, roughness: 0.3 }));
    bl.position.z = 0.32; g.add(bl);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.035, 0.13), new THREE.MeshStandardMaterial({ color: 0x111111 })); h.position.z = 0.04; g.add(h);
  } else if (kind === 'rifle') {
    const dark = new THREE.MeshStandardMaterial({ color: 0x141414, metalness: 0.6, roughness: 0.4 });
    const recv = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.42), dark); recv.position.z = 0.12; g.add(recv);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 8), dark); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.02, 0.48); g.add(barrel);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.06), dark); mag.position.set(0, -0.09, 0.18); mag.rotation.x = 0.2; g.add(mag);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.2), dark); stock.position.set(0, -0.02, -0.18); g.add(stock);
    g.userData.muzzle = new V(0, 0.02, 0.66);
  } else if (kind === 'chainsaw') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.32), new THREE.MeshStandardMaterial({ color: 0xa8740c, roughness: 0.5, metalness: 0.3 })); body.position.z = 0.05; g.add(body);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.09, 0.62), new THREE.MeshStandardMaterial({ color: 0x8a8d90, metalness: 0.9, roughness: 0.35 })); bar.position.z = 0.5; g.add(bar);
    const chain = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.11, 0.64), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.8, roughness: 0.6, wireframe: true })); chain.position.z = 0.5; g.add(chain);
  } else if (kind === 'pipe') {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 8), new THREE.MeshStandardMaterial({ color: 0x5a524a, metalness: 0.8, roughness: 0.6 }));
    m.rotation.x = Math.PI / 2; m.position.z = 0.25; g.add(m);
  }
  // point the weapon along the hand (bone points down -Y); the chainsaw is carried out in front
  g.rotation.x = kind === 'chainsaw' || kind === 'rifle' ? -0.35 : -Math.PI / 2 + 0.3;
  return g;
}

// -------------------------------------------------------------- Ragdoll
// Verlet particles at the joints, distance constraints between them, ground
// and wall collision. Each frame the bones are re-aimed at their particles.
const RJ = [ // particle: [boneName or tip, isTip]
  ['hips'], ['chest'], ['neck'], ['headTip'],
  ['armL'], ['foreL'], ['handL'], ['handLTip'],
  ['armR'], ['foreR'], ['handR'], ['handRTip'],
  ['thighL'], ['shinL'], ['footL'], ['footLTip'],
  ['thighR'], ['shinR'], ['footR'], ['footRTip'],
];
const RI = Object.fromEntries(RJ.map((r, i) => [r[0], i]));
const LINKS = [
  ['hips', 'chest'], ['chest', 'neck'], ['neck', 'headTip'],
  ['chest', 'armL'], ['armL', 'foreL'], ['foreL', 'handL'], ['handL', 'handLTip'],
  ['chest', 'armR'], ['armR', 'foreR'], ['foreR', 'handR'], ['handR', 'handRTip'],
  ['hips', 'thighL'], ['thighL', 'shinL'], ['shinL', 'footL'], ['footL', 'footLTip'],
  ['hips', 'thighR'], ['thighR', 'shinR'], ['shinR', 'footR'], ['footR', 'footRTip'],
  // braces keep the torso a torso
  ['armL', 'armR'], ['thighL', 'thighR'], ['armL', 'hips'], ['armR', 'hips'], ['armL', 'thighL'], ['armR', 'thighR'], ['neck', 'armL'], ['neck', 'armR'],
  ['headTip', 'chest'], ['thighL', 'chest'], ['thighR', 'chest'],
];
// soft limits: keep hands/feet from folding through the body
const SOFT = [['headTip', 'hips', 0.75], ['handLTip', 'armL', 0.25], ['handRTip', 'armR', 0.25], ['footLTip', 'thighL', 0.35], ['footRTip', 'thighR', 0.35], ['footL', 'hips', 0.4], ['footR', 'hips', 0.4]];
// which particle pair aims which bone
const AIM = [
  ['spine', 'hips', 'chest'], ['chest', 'chest', 'neck'], ['neck', 'neck', 'headTip'], ['head', 'neck', 'headTip'],
  ['armL', 'armL', 'foreL'], ['foreL', 'foreL', 'handL'], ['handL', 'handL', 'handLTip'],
  ['armR', 'armR', 'foreR'], ['foreR', 'foreR', 'handR'], ['handR', 'handR', 'handRTip'],
  ['thighL', 'thighL', 'shinL'], ['shinL', 'shinL', 'footL'], ['footL', 'footL', 'footLTip'],
  ['thighR', 'thighR', 'shinR'], ['shinR', 'shinR', 'footR'], ['footR', 'footR', 'footRTip'],
];

class Ragdoll {
  constructor(person, impulse, at, world) {
    this.p = person; this.world = world;
    const n = RJ.length;
    this.x = []; this.o = []; this.r = [];
    const tipOf = { headTip: ['head', TIP.head], handLTip: ['handL', TIP.handL], handRTip: ['handR', TIP.handR], footLTip: ['footL', TIP.footL], footRTip: ['footR', TIP.footR] };
    for (const [name] of RJ) {
      let w;
      if (tipOf[name]) { const [bn, tip] = tipOf[name]; w = person.bones[B[bn]].localToWorld(tip.clone().sub(BP[B[bn]])); }
      else w = person.bones[B[name]].getWorldPosition(new V());
      this.x.push(w); this.o.push(w.clone());
      this.r.push(name === 'headTip' ? 0.1 : name === 'hips' || name === 'chest' ? 0.12 : 0.05);
    }
    // rest lengths from the bind pose
    const bind = (name) => {
      if (tipOf[name]) return TIP[tipOf[name][0]];
      return BP[B[name]];
    };
    this.links = LINKS.map(([a, b]) => [RI[a], RI[b], bind(a).distanceTo(bind(b))]);
    this.soft = SOFT.map(([a, b, d]) => [RI[a], RI[b], d]);
    // initial kick: impulse concentrated near the hit point
    for (let i = 0; i < n; i++) {
      let k = 0.5;
      if (at) k = Math.max(0.25, 1.2 - this.x[i].distanceTo(at) * 1.5);
      this.o[i].addScaledVector(impulse, -k / 60);
    }
    // rest-frame directions for each aimed bone
    this.aim = AIM.map(([bn, a, b]) => [B[bn], RI[a], RI[b], bind(b).clone().sub(bind(a)).normalize()]);
    this.t = 0; this.settled = false;
    this.hipsAxis = BP[B.thighL].clone().sub(BP[B.thighR]).normalize();
  }
  pin(i, pos) { this.x[i].copy(pos); this.o[i].copy(pos); }
  step(dt) {
    this.t += dt;
    const x = this.x, o = this.o, n = x.length;
    if (!this.settled) {
      const h = Math.min(dt, 1 / 45), damp = this.t > 3 ? 0.9 : 0.985, tmp = new V();
      for (let i = 0; i < n; i++) {
        tmp.copy(x[i]);
        x[i].x += (x[i].x - o[i].x) * damp; x[i].z += (x[i].z - o[i].z) * damp;
        x[i].y += (x[i].y - o[i].y) * damp - 9.8 * h * h;
        o[i].copy(tmp);
      }
      for (let it = 0; it < 8; it++) {
        for (const [a, b, L] of this.links) {
          const d = tmp.subVectors(x[b], x[a]), len = d.length() || 1e-6, k = (len - L) / len * 0.5;
          x[a].addScaledVector(d, k); x[b].addScaledVector(d, -k);
        }
        for (const [a, b, L] of this.soft) {
          const d = tmp.subVectors(x[b], x[a]), len = d.length() || 1e-6; if (len >= L) continue;
          const k = (len - L) / len * 0.5; x[a].addScaledVector(d, k); x[b].addScaledVector(d, -k);
        }
        for (let i = 0; i < n; i++) {
          const r = this.r[i];
          if (x[i].y < r) { x[i].y = r; const vx = x[i].x - o[i].x, vz = x[i].z - o[i].z; o[i].x = x[i].x - vx * 0.6; o[i].z = x[i].z - vz * 0.6; }
          if (this.world) {
            const before = x[i].clone(); this.world.collide(x[i], r, x[i].y + r);
            if (before.x !== x[i].x || before.z !== x[i].z) { o[i].x = x[i].x; o[i].z = x[i].z; }
          }
        }
      }
      // sleep once nearly still
      let mv = 0; for (let i = 0; i < n; i++) mv += x[i].distanceToSquared(o[i]);
      if (this.t > 2.5 && mv < 1e-6) this.settled = true;
    }
    this.pose();
  }
  pose() {
    const P = this.p, bones = P.bones, x = this.x;
    // root: hips position + orientation from spine and hip axis
    const root = P.root; root.updateMatrixWorld(true);
    const rootQ = root.getWorldQuaternion(new Q()), rootInv = rootQ.clone().invert();
    const toLocal = (w) => root.worldToLocal(w.clone());
    const hips = bones[B.hips];
    const spineDir = x[RI.chest].clone().sub(x[RI.hips]).normalize();
    const side = x[RI.thighL].clone().sub(x[RI.thighR]); side.addScaledVector(spineDir, -side.dot(spineDir)).normalize();
    const fwdW = new V().crossVectors(side, spineDir).normalize();
    const m = new THREE.Matrix4().makeBasis(side, spineDir, fwdW);
    const hipsW = new Q().setFromRotationMatrix(m);
    hips.position.copy(toLocal(x[RI.hips]));
    hips.quaternion.copy(rootInv).multiply(hipsW);
    const worldQ = []; worldQ[B.hips] = hipsW;
    // walk the chain in table order (parents first)
    for (const [bi, a, b, rest] of this.aim) {
      const parent = BONES[bi][1];
      const pw = worldQ[parent] || hipsW;
      const dir = x[b].clone().sub(x[a]).normalize();
      // start from the parent's frame so twist follows the body, then swing to the particle direction
      const restW = rest.clone().applyQuaternion(pw);
      const w = new Q().setFromUnitVectors(restW, dir).multiply(pw);
      worldQ[bi] = w;
      bones[bi].quaternion.copy(pw.clone().invert().multiply(w));
    }
  }
}

// ---------------------------------------------------------- Cash's hands
// A right hand built in grip space (WebXR: origin in the curled fingers, -Z
// along the handle toward the thumb, +Y back along the forearm, +X out of the
// back of the right hand). The left is the mirror. Fingers are real jointed
// bones that curl around whatever he's holding.
export function makeHand(left = false) {
  const L = new Loft();
  const skin = [0.52, 0.36, 0.27], knuckle = [0.56, 0.35, 0.28], nail = [0.66, 0.52, 0.47], scar = [0.6, 0.42, 0.36], sleeve = skin, cuff = skin, ink = skin; // Cash's jacket sleeves are rolled up past the elbow: bare forearms (arms.js adds the rolled cuff and the jacket)
  const v = (x, y, z) => new V(x, y, z);
  // bones: 0 wrist, then per finger (index..pinky) 3 bones, thumb 3 bones
  const bones = [new THREE.Bone()]; bones[0].position.set(0, 0.075, 0.0);
  const fingerDefs = [ // base (relative to wrist root space), length of phalanges
    { base: v(-0.005, -0.004, -0.030), l: [0.040, 0.025, 0.020], r: 0.0094 },
    { base: v(-0.007, -0.010, -0.010), l: [0.044, 0.028, 0.021], r: 0.0097 },
    { base: v(-0.006, -0.008, 0.010), l: [0.041, 0.026, 0.020], r: 0.0091 },
    { base: v(-0.004, -0.002, 0.028), l: [0.032, 0.020, 0.018], r: 0.0080 },
  ];
  const fingers = [], joints = [], tips = [];
  const Wn = (i) => [[i, 1]];
  // palm: from wrist (y≈0.075) to knuckles (y≈0); fingers start at the knuckle line pointing -Y then curl toward +X? no:
  // fingers extend down -Y from the knuckles in the open pose; curling rotates them about Z toward -X (palm side).
  fingerDefs.forEach((f, fi) => {
    let parent = bones[0], pos = f.base.clone().sub(bones[0].position);
    const chain = [];
    for (let k = 0; k < 3; k++) {
      const b = new THREE.Bone(); b.position.copy(pos); parent.add(b); bones.push(b); chain.push(bones.length - 1);
      parent = b; pos = v(0, -f.l[k], 0);
    }
    fingers.push(chain);
    // geometry in bind (open) pose: several rings per phalanx, fuller at the joints, tapering to the tip
    let y = f.base.y + 0.004; const rings = [];
    for (let k = 0; k < 3; k++) {
      const r0 = f.r * (1 - k * 0.11), r1 = f.r * (1 - (k + 1) * 0.11);
      const prev = k === 0 ? [[chain[0], 0.65], [0, 0.35]] : blend(chain[k - 1], chain[k], 0.62);
      const col = k === 0 ? knuckle : skin;
      rings.push(ring(v(f.base.x, y - 0.001, f.base.z), v(0, -1, 0), v(1, 0, 0), r0 * 1.08, r0 * 0.95, prev, col, { ryn: r0 * 1.05 }));
      rings.push(ring(v(f.base.x, y - f.l[k] * 0.3, f.base.z), v(0, -1, 0), v(1, 0, 0), r0 * 0.95, r0 * 0.8, Wn(chain[k]), skin, { ryn: r0 * 1.02 }));
      rings.push(ring(v(f.base.x, y - f.l[k] * 0.62, f.base.z), v(0, -1, 0), v(1, 0, 0), (r0 + r1) * 0.46, (r0 + r1) * 0.39, Wn(chain[k]), skin, { ryn: (r0 + r1) * 0.5 }));
      rings.push(ring(v(f.base.x, y - f.l[k] * 0.9, f.base.z), v(0, -1, 0), v(1, 0, 0), r1 * 0.98, r1 * 0.85, blend(chain[k], chain[Math.min(2, k + 1)], 0.5), skin, { ryn: r1 * 0.95 }));
      y -= f.l[k];
    }
    rings.push(ring(v(f.base.x, y + 0.004, f.base.z), v(0, -1, 0), v(1, 0, 0), f.r * 0.74, f.r * 0.72, Wn(chain[2]), skin));
    L.tube(rings, 14);
    joints.push(...f.l.map((_, k) => ({ x: f.base.x, z: f.base.z, y: f.base.y - f.l.slice(0, k).reduce((a, b) => a + b, 0) }))); tips.push({ x: f.base.x, z: f.base.z, y });
    // rounded fingertip pad and a fingernail on the back (+X) of the last joint
    L.blob(v(f.base.x - 0.0008, y + 0.004, f.base.z), f.r * 0.74, f.r * 0.85, f.r * 0.72, Wn(chain[2]), skin, 10, 6);
    L.blob(v(f.base.x + f.r * 0.6, y + 0.0095, f.base.z), f.r * 0.14, f.r * 0.7, f.r * 0.52, Wn(chain[2]), nail, 8, 5);
    // knuckle: a hard bump, a couple of them scarred from fights
    L.blob(v(f.base.x + 0.0075, f.base.y + 0.004, f.base.z), 0.0045, 0.0065, 0.0075, [[chain[0], 0.5], [0, 0.5]], fi === 1 || fi === 2 ? scar : knuckle, 8, 5);
  });
  // thumb: from the palm side near the index, pointing along -Z
  {
    const tb = v(-0.017, 0.048, -0.026), td = v(-0.55, -0.74, -0.38).normalize();
    const chain = []; let parent = bones[0], pos = tb.clone().sub(bones[0].position);
    const ls = [0.035, 0.03, 0.025];
    for (let k = 0; k < 3; k++) { const b = new THREE.Bone(); b.position.copy(pos); parent.add(b); bones.push(b); chain.push(bones.length - 1); parent = b; pos = td.clone().multiplyScalar(ls[k]); }
    fingers.push(chain);
    const d = td; let c = tb.clone(); const rings = [];
    for (let k = 0; k < 3; k++) {
      const r = 0.0112 - k * 0.0011;
      rings.push(ring(c.clone(), d, v(1, 0, 0), r * 1.05, r * 1.1, k === 0 ? [[chain[0], 0.6], [0, 0.4]] : blend(chain[k - 1], chain[k], 0.6), skin));
      rings.push(ring(c.clone().addScaledVector(d, ls[k] * 0.5), d, v(1, 0, 0), r * 0.93, r * 0.96, Wn(chain[k]), skin));
      c = c.clone().addScaledVector(d, ls[k]);
    }
    rings.push(ring(c.clone().addScaledVector(d, -0.004), d, v(1, 0, 0), 0.0078, 0.0082, Wn(chain[2]), skin));
    rings.unshift(ring(tb.clone().addScaledVector(d, -0.012), d, v(1, 0, 0), 0.008, 0.009, [[0, 1]], skin)); // starts buried in the palm
    L.tube(rings, 14, { capStart: true });
    L.blob(c.clone().addScaledVector(d, -0.004), 0.0079, 0.0085, 0.0079, Wn(chain[2]), skin, 10, 6);
    L.blob(c.clone().addScaledVector(d, -0.008).add(v(0.0055, 0.002, -0.003)), 0.0018, 0.0068, 0.0052, Wn(chain[2]), nail, 8, 5);
    // the meaty pad at the base of the thumb, on the palm side
    L.blob(v(-0.014, 0.05, -0.019), 0.0085, 0.022, 0.012, [[0, 0.7], [chain[0], 0.3]], skin, 12, 8);
  }
  // palm block (soft superellipse rings from wrist to knuckles), back of hand faces +X
  const palm = [];
  for (let k = 0; k <= 7; k++) {
    const t = k / 7, y = 0.088 - t * 0.091;
    const wide = 0.029 + Math.sin(t * Math.PI * 0.5) * 0.014, thick = 0.0155 + Math.sin(t * Math.PI) * 0.003;
    palm.push(ring(v(-0.005, y, -0.001 + t * 0.0), v(0, -1, 0), v(1, 0, 0), wide, thick, Wn(0), skin, { n: 2.6 }));
  }
  L.tube(palm, 20);
  // tendons on the back of the hand

  // prison ink across the back of the hand: a dark band of tiny blobs (letters read as smudged ink)
  // forearm + rolled sleeve
  const arm = [];
  arm.push(ring(v(-0.004, 0.085, -0.002), v(0, 1, 0), v(1, 0, 0), 0.03, 0.019, Wn(0), skin));
  arm.push(ring(v(-0.004, 0.13, 0), v(0, 1, 0), v(1, 0, 0), 0.031, 0.024, Wn(0), skin));
  arm.push(ring(v(-0.004, 0.148, 0), v(0, 1, 0), v(1, 0, 0), 0.032, 0.026, Wn(0), skin));
  arm.push(ring(v(-0.004, 0.153, 0), v(0, 1, 0), v(1, 0, 0), 0.0322, 0.0262, Wn(0), ink));
  arm.push(ring(v(-0.004, 0.163, 0), v(0, 1, 0), v(1, 0, 0), 0.0328, 0.027, Wn(0), ink));
  arm.push(ring(v(-0.004, 0.168, 0), v(0, 1, 0), v(1, 0, 0), 0.033, 0.0275, Wn(0), skin));
  arm.push(ring(v(-0.004, 0.19, 0), v(0, 1, 0), v(1, 0, 0), 0.035, 0.031, Wn(0), skin));
  arm.push(ring(v(-0.004, 0.2, 0), v(0, 1, 0), v(1, 0, 0), 0.04, 0.036, Wn(0), cuff));
  arm.push(ring(v(-0.004, 0.207, 0), v(0, 1, 0), v(1, 0, 0), 0.047, 0.045, Wn(0), cuff));
  arm.push(ring(v(-0.004, 0.218, 0), v(0, 1, 0), v(1, 0, 0), 0.044, 0.042, Wn(0), sleeve));
  arm.push(ring(v(-0.004, 0.23, 0), v(0, 1, 0), v(1, 0, 0), 0.049, 0.047, Wn(0), cuff));
  arm.push(ring(v(-0.004, 0.245, 0), v(0, 1, 0), v(1, 0, 0), 0.046, 0.045, Wn(0), sleeve));
  arm.push(ring(v(-0.004, 0.26, 0), v(0, 1, 0), v(1, 0, 0), 0.042, 0.048, Wn(0), sleeve));
  arm.push(ring(v(-0.004, 0.29, 0), v(0, 1, 0), v(1, 0, 0), 0.044, 0.049, Wn(0), sleeve)); // the IK arm (arms.js) carries on from here
  L.tube(arm, 18, { capEnd: true });
  // put bones into world-of-hand space: bone 0 sits at the wrist; children positions are relative
  const geo = L.geometry(left);
  shadeHand(geo, joints, tips, left);
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.6, bumpMap: T.skin, bumpScale: 0.0016, sheen: 0.25, sheenRoughness: 0.5, sheenColor: new THREE.Color(0.8, 0.35, 0.28), side: THREE.DoubleSide });
  const mesh = new THREE.SkinnedMesh(geo, mat);
  // children were positioned relative to parents using world coords; fix bone 0 children (they used pos relative to wrist root already)
  if (left) { // mirror bone positions in X
    bones.forEach((b, i) => { if (i === 0) b.position.x = -b.position.x; else b.position.x = -b.position.x; });
  }
  bones[0].updateMatrixWorld(true); const skel = new THREE.Skeleton(bones); mesh.add(bones[0]); mesh.bind(skel);
  mesh.frustumCulled = false; mesh.castShadow = true;
  const g = new THREE.Group(); g.add(mesh);
  // curl: 0 open .. 1 fist. Curling rotates each phalanx toward the palm (-X for the right hand).
  const sgn = left ? -1 : 1;
  const hand = {
    group: g, mesh, bones, fingers, left,
    curl(amt, thumb = amt) {
      fingers.forEach((ch, fi) => {
        const a = fi === 4 ? thumb : amt;
        // a relaxed hand: each finger a little more curled than the last, fanned slightly
        const bias = fi === 4 ? 0 : fi * 0.09 * (1 - amt * 0.6), spread = fi === 4 ? 0 : (fi - 1.5) * 0.07 * (1 - amt);
        ch.forEach((bi, k) => {
          const b = bones[bi], c = Math.min(1, 0.12 + a * 0.92 + bias);
          if (fi === 4) b.quaternion.setFromEuler(new THREE.Euler(-(0.15 + a * 0.5) * (k === 0 ? 0.9 : 0.6), 0, -sgn * (0.1 + a) * (k === 0 ? 0.3 : 0.45)));
          else b.quaternion.setFromEuler(new THREE.Euler(k === 0 ? spread : 0, 0, -sgn * c * (k === 0 ? 1.25 : k === 1 ? 1.55 : 1.0)));
        });
      });
    },
  };
  hand.curl(0.35);
  return hand;
}

// What makes a hand read as a hand: shadow down between the fingers and in the
// palm, creases at the joints on the palm side, redder knuckles, a paler palm,
// pink fingertips. Bind-space, before the left-hand mirror is applied to bones.
function shadeHand(geo, joints, tips, left) {
  const p = geo.attributes.position.array, n = geo.attributes.normal.array, col = geo.attributes.color.array, cnt = p.length / 3;
  const sx = left ? -1 : 1, cell = 0.012, grid = new Map(), key = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i < cnt; i++) { const k = key(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(i); }
  const lin = (c) => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  for (let i = 0; i < cnt; i++) {
    const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2], nx = n[i * 3], ny = n[i * 3 + 1], nz = n[i * 3 + 2], hx = x * sx; // hx: + back of the hand, - palm
    if (y > 0.2) continue; // the sleeve
    let occ = 0; const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (let c = -2; c <= 2; c++) {
      const L = grid.get(`${cx + a},${cy + b},${cz + c}`); if (!L) continue;
      for (const j of L) { const dx = p[j * 3] - x, dy = p[j * 3 + 1] - y, dz = p[j * 3 + 2] - z, d = Math.hypot(dx, dy, dz); if (d < 0.003 || d > 0.024) continue; const f = (dx * nx + dy * ny + dz * nz) / d; if (f > 0.3) occ += (f - 0.3) * (1 - d / 0.024); }
    }
    let r = 1, g = 1, bl = 1;
    const ao = 1 - Math.min(0.55, occ * 0.05); r *= ao; g *= ao; bl *= ao;
    if (hx < -0.006) { r *= 1.08; g *= 1.1; bl *= 1.08; } // palm: paler
    else if (hx > 0.006) { r *= 0.94; g *= 0.92; bl *= 0.92; } // back of the hand: a shade more tan
    for (const J of joints) { const d = Math.hypot(z - J.z, y - J.y); if (d < 0.004 + 0.003) { if (hx < -0.002) { const k = 1 - d / 0.007; r *= 1 - k * 0.35; g *= 1 - k * 0.4; bl *= 1 - k * 0.4; } else { const k = 1 - d / 0.007; r *= 1 + k * 0.08; g *= 1 - k * 0.06; bl *= 1 - k * 0.04; } } }
    for (const T0 of tips) { const d = Math.hypot(z - T0.z, y - T0.y); if (d < 0.016) { const k = 1 - d / 0.016; r *= 1 + k * 0.1; g *= 1 - k * 0.02; bl *= 1 + k * 0.01; } }
    // fine mottling so the skin isn't plastic
    const m = 1 + (Math.sin(x * 900 + y * 700) * Math.sin(z * 800 - y * 500)) * 0.04; r *= m; g *= m; bl *= m;
    col[i * 3] *= r; col[i * 3 + 1] *= g; col[i * 3 + 2] *= bl;
  }
  geo.attributes.color.needsUpdate = true;
}

export { B as BONE, SKIN_TONES };
