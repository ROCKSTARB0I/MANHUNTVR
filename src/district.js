// district.js — Scene 1: "THE PENS", a sealed-off block of Carcer City's east side.
// Builds the geometry, the collision boxes, the lamps, a baked light grid the
// hunters use to judge whether they can see you, and a walk grid for their
// pathfinding. Everything is boxes on purpose: cheap to collide and to ray-test.
import * as THREE from '../vendor/three.module.js';
import { T, seeded } from './paint.js?v=2';

const V = THREE.Vector3;
export const BOUNDS = { x0: -36, x1: 36, z0: -26, z1: 26 };
const CELL = 0.5;

export class District {
  constructor(scene) {
    this.scene = scene;
    this.boxes = [];          // {x0,x1,z0,z1,y0,y1, solid, see}  see=false -> fences you can see through
    this.lamps = [];          // {p, r, i, col, flicker, light, bulb}
    this.cams = [];           // CCTV spots {p, yaw, sweep}
    this.items = [];          // item spawns {kind, p}
    this.routes = [];         // patrol loops [[x,z]..]
    this.hunterSpawns = [];
    this.start = new V(-31, 0, 19.5); this.startYaw = Math.PI * 0.75;
    this.exit = new V(34.2, 0, 0);
    this.mats = {};
    this.R = seeded(1979);
    this.root = new THREE.Group(); scene.add(this.root);
    this.build();
    this.bakeLight();
    this.bakeWalk();
  }

  mat(key, opts) {
    if (!this.mats[key]) this.mats[key] = new THREE.MeshStandardMaterial(opts);
    return this.mats[key];
  }
  texMat(key, t, rx, ry, extra = {}) {
    const map = t.map.clone(); map.needsUpdate = true; map.repeat.set(rx, ry);
    let bump; if (t.bump) { bump = t.bump.clone(); bump.needsUpdate = true; bump.repeat.set(rx, ry); }
    return this.mat(key, Object.assign({ map, bumpMap: bump, bumpScale: 0.03, roughness: 0.92, metalness: 0 }, extra));
  }

  // box with collision. see=false means it does not block sight (fences)
  box(x0, x1, z0, z1, y0, y1, material, { solid = true, see = true, shadow = true } = {}) {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    // world-scaled UVs so textures don't stretch
    const pos = g.attributes.position, uv = g.attributes.uv, n = g.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + (x0 + x1) / 2, y = pos.getY(i) + (y0 + y1) / 2, z = pos.getZ(i) + (z0 + z1) / 2;
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
      if (ay > 0.5) uv.setXY(i, x / 4, z / 4); else if (ax > 0.5) uv.setXY(i, z / 4, y / 4); else uv.setXY(i, x / 4, y / 4);
    }
    const m = new THREE.Mesh(g, material);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.receiveShadow = true; m.castShadow = shadow;
    this.root.add(m);
    if (solid) this.boxes.push({ x0, x1, z0, z1, y0, y1, see });
    return m;
  }

  // a building: brick facade shell (solid) with facade bays painted on the street side
  building(x0, x1, z0, z1, h, face) {
    const brick = this.mat('brick', { map: rep(T.brick.map, 1, 1), bumpMap: rep(T.brick.bump, 1, 1), bumpScale: 0.04, roughness: 0.95 });
    this.box(x0, x1, z0, z1, 0, h, brick);
    // facade bays on the given face ('n','s','e','w')
    const bays = (face === 'n' || face === 's') ? Math.floor((x1 - x0) / 4) : Math.floor((z1 - z0) / 4);
    const floors = Math.floor(h / 3.6);
    for (let b = 0; b < bays; b++) for (let f = 0; f < floors; f++) {
      const k = Math.floor(this.R() * T.facade.length), fac = T.facade[k];
      const m = new THREE.MeshStandardMaterial({ map: fac.map, emissiveMap: fac.emissive, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.9 });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(4, 3.6), m);
      const y = 1.8 + f * 3.6 + (f === 0 ? 0 : 0);
      if (f === 0 && this.R() < 0.6) continue; // ground floors mostly bare brick / shutters
      if (face === 's') { p.position.set(x0 + 2 + b * 4, y, z1 + 0.02); }
      if (face === 'n') { p.position.set(x0 + 2 + b * 4, y, z0 - 0.02); p.rotation.y = Math.PI; }
      if (face === 'e') { p.position.set(x1 + 0.02, y, z0 + 2 + b * 4); p.rotation.y = Math.PI / 2; }
      if (face === 'w') { p.position.set(x0 - 0.02, y, z0 + 2 + b * 4); p.rotation.y = -Math.PI / 2; }
      this.root.add(p);
    }
    // roof parapet line of darker cap
    this.box(x0 - 0.1, x1 + 0.1, z0 - 0.1, z1 + 0.1, h, h + 0.25, this.mat('cap', { color: 0x3a3632, roughness: 1 }), { solid: false });
  }

  graffiti(x, y, z, ry, w = 3, i) {
    const t = T.graffiti[i ?? Math.floor(this.R() * T.graffiti.length)];
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 2), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.set(x, y, z); m.rotation.y = ry; this.root.add(m);
  }

  lamp(x, z, { h = 5.2, r = 11, i = 1, col = 0xffb46a, flicker = 0, real = true, arm = 'pole', dir = 0 } = {}) {
    const p = new V(x, h, z);
    if (arm === 'pole') {
      const metal = this.mat('pole', { color: 0x2b2d2f, roughness: 0.6, metalness: 0.6 });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, h + 0.3, 8), metal); pole.position.set(x - Math.sin(dir) * 0.9, (h + 0.3) / 2, z - Math.cos(dir) * 0.9); this.root.add(pole);
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.0), metal); a.position.set(x - Math.sin(dir) * 0.45, h + 0.25, z - Math.cos(dir) * 0.45); a.rotation.y = dir; this.root.add(a);
      this.boxes.push({ x0: pole.position.x - 0.1, x1: pole.position.x + 0.1, z0: pole.position.z - 0.1, z1: pole.position.z + 0.1, y0: 0, y1: h, see: true });
    }
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.28, 0.2, 10), this.mat('lamphead', { color: 0x222222, roughness: 0.5 }));
    head.position.copy(p).y += 0.15; head.rotation.y = dir; this.root.add(head);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 6), new THREE.MeshBasicMaterial({ color: col }));
    bulb.position.copy(p); this.root.add(bulb);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: col, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(2.2); glow.position.copy(p); this.root.add(glow);
    let light = null;
    if (real) {
      light = new THREE.PointLight(col, i * 26, r * 1.25, 1.8);
      light.position.copy(p).y -= 0.2; this.root.add(light);
    }
    const L = { p, r, i, col, flicker, light, bulb, glow, base: i, on: 1 };
    this.lamps.push(L); return L;
  }

  fire(x, z) { // burning oil drum: a light source with a flame
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 14, 1, true), this.mat('drum', { map: rep(T.barrel.map, 1, 1), roughness: 0.7, metalness: 0.4, side: THREE.DoubleSide }));
    drum.position.set(x, 0.45, z); this.root.add(drum);
    this.boxes.push({ x0: x - 0.32, x1: x + 0.32, z0: z - 0.32, z1: z + 0.32, y0: 0, y1: 0.9, see: true });
    const flames = [];
    for (let k = 0; k < 3; k++) {
      const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.flame, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      f.scale.set(0.5, 0.9, 1); f.position.set(x + (k - 1) * 0.1, 1.2, z); this.root.add(f); flames.push(f);
    }
    const L = this.lamp(x, z, { h: 1.4, r: 8, i: 0.9, col: 0xff7a2a, flicker: 2, arm: 'none' });
    L.flames = flames; L.bulb.visible = false; L.glow.scale.setScalar(3);
    return L;
  }

  prop(kind, x, z, ry = 0) {
    const R = this.R;
    if (kind === 'dumpster') {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
      const m = this.mat('dumpster', { map: rep(T.dumpster.map, 1, 1), roughness: 0.75, metalness: 0.35 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.15, 1.1), m); body.position.y = 0.68; g.add(body);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.06, 1.15), this.mat('lid', { color: 0x15201a, roughness: 0.6 })); lid.position.set(0, 1.28, -0.05); lid.rotation.x = -0.12; g.add(lid);
      for (const sx of [-0.8, 0.8]) for (const sz of [-0.45, 0.45]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 8), this.mat('rubber', { color: 0x111111 })); w.rotation.x = Math.PI / 2; w.position.set(sx, 0.06, sz); g.add(w); }
      body.castShadow = true; this.root.add(g);
      this.solidOBB(x, z, 0.98, 0.58, ry, 1.3);
    } else if (kind === 'crate') {
      const s = 0.8 + R() * 0.4;
      const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), this.mat('crate', { map: rep(T.crate.map, 1, 1), roughness: 0.9 }));
      m.position.set(x, s / 2, z); m.rotation.y = ry; m.castShadow = true; this.root.add(m);
      this.solidOBB(x, z, s / 2, s / 2, ry, s);
    } else if (kind === 'barrel') {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 14), this.mat('barrel', { map: rep(T.barrel.map, 1, 1), roughness: 0.6, metalness: 0.4 }));
      m.position.set(x, 0.45, z); this.root.add(m);
      this.boxes.push({ x0: x - 0.3, x1: x + 0.3, z0: z - 0.3, z1: z + 0.3, y0: 0, y1: 0.9, see: true });
    } else if (kind === 'car') { // burnt-out sedan
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
      const ch = this.mat('charred', { map: rep(T.charred.map, 1, 1), roughness: 0.95, metalness: 0.3 });
      const lower = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 4.4), ch); lower.position.y = 0.55; g.add(lower);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 2.2), ch); cab.position.set(0, 1.17, -0.2); g.add(cab);
      const holes = this.mat('void', { color: 0x050505, roughness: 1 });
      for (const sz of [-0.2]) { const w = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.4, 1.9), holes); w.position.set(0, 1.2, sz); g.add(w); }
      for (const sx of [-0.85, 0.85]) for (const sz of [-1.4, 1.4]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 6, 12), this.mat('rim', { color: 0x3a2a20, metalness: 0.6, roughness: 0.6 })); r.rotation.y = Math.PI / 2; r.position.set(sx, 0.3, sz); g.add(r); }
      lower.castShadow = cab.castShadow = true; this.root.add(g);
      this.solidOBB(x, z, 0.9, 2.2, ry, 1.45);
    } else if (kind === 'van') { // the snuff crew's white van
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
      const m = this.mat('van', { map: rep(T.van.map, 1, 1), roughness: 0.5, metalness: 0.3 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.0, 5.0), m); b.position.y = 1.25; g.add(b);
      const ws = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 0.05), this.mat('glass', { color: 0x0a0d10, roughness: 0.1, metalness: 0.8 })); ws.position.set(0, 1.75, 2.5); g.add(ws);
      for (const sx of [-0.95, 0.95]) for (const sz of [-1.7, 1.6]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 14), this.mat('rubber', { color: 0x111111 })); w.rotation.z = Math.PI / 2; w.position.set(sx, 0.36, sz); g.add(w); }
      b.castShadow = true; this.root.add(g);
      this.solidOBB(x, z, 1.0, 2.5, ry, 2.3);
    } else if (kind === 'mattress') {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.18, 1.9), this.mat('matt', { color: 0x6b6150, roughness: 1 }));
      m.position.set(x, 0.09, z); m.rotation.y = ry; m.rotation.z = 0.04; this.root.add(m);
    } else if (kind === 'trash') {
      for (let k = 0; k < 5; k++) {
        const s = 0.25 + R() * 0.25;
        const b = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), this.mat('bag', { color: 0x0b0b0c, roughness: 0.35, metalness: 0.1 }));
        b.scale.y = 0.75; b.position.set(x + (R() - 0.5) * 1.2, s * 0.7, z + (R() - 0.5) * 1.2); this.root.add(b);
      }
    }
  }

  // oriented solid prop -> conservative AABB
  solidOBB(x, z, hx, hz, ry, h) {
    const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry));
    const ex = hx * c + hz * s, ez = hx * s + hz * c;
    this.boxes.push({ x0: x - ex, x1: x + ex, z0: z - ez, z1: z + ez, y0: 0, y1: h, see: true });
  }

  fence(x0, z0, x1, z1, h = 3.2) { // chain-link: blocks walking, not sight
    const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0);
    const t = T.chain.clone(); t.needsUpdate = true; t.repeat.set(len / 0.6, h / 0.6);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, h), new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, metalness: 0.7, roughness: 0.5 }));
    m.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2); m.rotation.y = ang + Math.PI / 2; this.root.add(m);
    const post = this.mat('post', { color: 0x777a7c, metalness: 0.7, roughness: 0.4 });
    const n = Math.ceil(len / 3);
    for (let k = 0; k <= n; k++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, h + 0.1, 6), post); p.position.set(x0 + (x1 - x0) * k / n, h / 2, z0 + (z1 - z0) * k / n); this.root.add(p); }
    // barbed coil on top
    const wire = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.012, 4, 40), post);
    for (let k = 0; k < len / 0.5; k++) { const w = wire.clone(); w.position.set(x0 + (x1 - x0) * k / (len / 0.5), h + 0.18, z0 + (z1 - z0) * k / (len / 0.5)); w.rotation.y = ang; this.root.add(w); }
    const th = 0.06;
    this.boxes.push({ x0: Math.min(x0, x1) - th, x1: Math.max(x0, x1) + th, z0: Math.min(z0, z1) - th, z1: Math.max(z0, z1) + th, y0: 0, y1: h, see: false });
  }

  build() {
    const B = BOUNDS;
    // ground: asphalt street, concrete lots, gravel yard
    const asphalt = this.texMat('asphalt', T.asphalt, 18, 4, { roughness: 0.85 });
    const street = new THREE.Mesh(new THREE.PlaneGeometry(72, 9), asphalt); street.rotation.x = -Math.PI / 2; street.position.set(0, 0, 0); street.receiveShadow = true; this.root.add(street);
    const conc = this.texMat('concrete', T.concrete, 18, 5);
    for (const z of [-15.75, 15.75]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(72, 22.5), conc); s.rotation.x = -Math.PI / 2; s.position.set(0, -0.01, z); s.receiveShadow = true; this.root.add(s); }
    // painted lines
    const line = this.mat('line', { color: 0x8a7a40, roughness: 0.8 });
    for (let x = -34; x < 34; x += 4) { const l = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.12), line); l.rotation.x = -Math.PI / 2; l.position.set(x, 0.005, 0); this.root.add(l); }
    // curbs
    const curb = this.mat('curb', { color: 0x58554f, roughness: 0.9 });
    this.box(B.x0, B.x1, -4.65, -4.5, 0, 0.14, curb, { solid: false, shadow: false });
    this.box(B.x0, B.x1, 4.5, 4.65, 0, 0.14, curb, { solid: false, shadow: false });

    // ---- the perimeter: tall blank walls and buildings seal the block
    const wallM = this.mat('wall', { map: rep(T.brick.map, 1, 1), bumpMap: rep(T.brick.bump, 1, 1), bumpScale: 0.04, roughness: 0.95, color: 0x8a8580 });
    this.box(B.x0 - 1, B.x0, B.z0, B.z1, 0, 7, wallM);          // west
    this.box(B.x0, B.x1, B.z1, B.z1 + 1, 0, 7, wallM);          // south
    this.box(B.x0, B.x1, B.z0 - 1, B.z0, 0, 7, wallM);          // north
    this.box(B.x1, B.x1 + 1, B.z0, -3, 0, 7, wallM);            // east, gap for the gate
    this.box(B.x1, B.x1 + 1, 3, B.z1, 0, 7, wallM);

    // ---- north row of tenements, alleys between them
    this.building(-36, -22, -26, -8, 14.4, 's');
    this.building(-19, -6, -26, -8, 10.8, 's');
    this.building(-3, 9, -26, -10, 18, 's');
    this.building(12, 24, -26, -8, 10.8, 's');
    this.building(27, 36, -26, -8, 14.4, 's');
    // alley clutter
    this.prop('dumpster', -20.5, -12, Math.PI / 2); this.prop('trash', -20.4, -9.5);
    this.prop('dumpster', -4.5, -13.5, Math.PI / 2); this.prop('crate', -4.2, -11.4, 0.3);
    this.prop('crate', 10.4, -15, 0.5); this.prop('crate', 10.6, -13.9, 0.1); this.prop('trash', 10.5, -11);
    this.prop('dumpster', 25.5, -10.5, Math.PI / 2);
    // dead-end wire across the back of the alleys
    this.fence(-22, -20, -19, -20); this.fence(-6, -20, -3, -20); this.fence(9, -20, 12, -20); this.fence(24, -20, 27, -20);

    // ---- south side: holding pen (start), the old Fairway warehouse, a lot
    // holding pen in the SW corner, chain link
    this.fence(-35.9, 14, -26, 14); this.fence(-26, 14, -26, 17.5); this.fence(-26, 21.5, -26, 25.9);
    this.prop('mattress', -33, 22, 0.3); this.prop('barrel', -34.8, 15.2);
    this.lamp(-30, 24.8, { h: 3.4, r: 7, i: 0.55, col: 0xf2ead8, arm: 'none', flicker: 1 });

    // warehouse: hollow shell with door gaps; inside is dark
    const corr = this.mat('corr', { map: rep(T.corrugated.map, 1, 1), roughness: 0.6, metalness: 0.5, color: 0x9a9a98 });
    const W = { x0: -10, x1: 18, z0: 9, z1: 24, h: 6.5 };
    this.box(W.x0, W.x1, W.z1 - 0.3, W.z1, 0, W.h, corr);                     // back
    this.box(W.x0, W.x0 + 0.3, W.z0, W.z1, 0, W.h, corr);                     // west
    this.box(W.x1 - 0.3, W.x1, W.z0, 13, 0, W.h, corr); this.box(W.x1 - 0.3, W.x1, 15.5, W.z1, 0, W.h, corr); // east w/ side door
    this.box(W.x0, -4, W.z0, W.z0 + 0.3, 0, W.h, corr);                       // front, rolling door gap -4..0
    this.box(0, 7, W.z0, W.z0 + 0.3, 0, W.h, corr);
    this.box(9, W.x1, W.z0, W.z0 + 0.3, 0, W.h, corr);                        // second gap 7..9 (pedestrian door)
    this.box(-4, 0, W.z0, W.z0 + 0.3, 3.2, W.h, corr, { solid: false });        // above rolling door
    this.box(7, 9, W.z0, W.z0 + 0.3, 2.3, W.h, corr, { solid: false });
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(W.x1 - W.x0, W.z1 - W.z0), this.mat('roofin', { color: 0x1a1a1a, roughness: 1, side: THREE.DoubleSide }));
    roof.rotation.x = Math.PI / 2; roof.position.set((W.x0 + W.x1) / 2, W.h, (W.z0 + W.z1) / 2); this.root.add(roof);
    const slab = this.texMat('slab', T.slab, 7, 4);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(W.x1 - W.x0, W.z1 - W.z0), slab); fl.rotation.x = -Math.PI / 2; fl.position.set((W.x0 + W.x1) / 2, 0.005, (W.z0 + W.z1) / 2); this.root.add(fl);
    // interior: shelving rows (solid) to sneak between
    const shelf = this.mat('shelf', { color: 0x40362c, roughness: 0.8, metalness: 0.4 });
    for (const x of [-6, -1, 4, 9]) { this.box(x, x + 1.0, 13, 21, 0, 2.6, shelf); }
    this.prop('crate', 13, 20.5, 0.2); this.prop('crate', 14.1, 21, 0.9); this.prop('crate', 13.4, 19.4, 0.4);
    this.prop('mattress', 15.5, 12, 1.2); this.prop('trash', -8, 22);
    // the "studio": a chair under a bare bulb with a camera tripod — the Director's set
    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.5), this.mat('chair', { color: 0x2a2018 })); chair.position.set(14.5, 0.45, 17.5); this.root.add(chair);
    const tri = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 5), this.mat('pole')); tri.position.set(12.8, 0.75, 17); this.root.add(tri);
    const camBox = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.4), this.mat('cbody', { color: 0x111111 })); camBox.position.set(12.8, 1.55, 17); camBox.rotation.y = -1.2; this.root.add(camBox);
    this.lamp(14.5, 17.5, { h: 3.0, r: 5, i: 0.8, col: 0xfff1d0, arm: 'none', flicker: 1 });
    for (let k = 0; k < 3; k++) { const d = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshStandardMaterial({ map: T.blood[k], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 })); d.rotation.x = -Math.PI / 2; d.rotation.z = k * 2; d.position.set(14.3 + k * 0.4, 0.011 + k * 0.001, 17.8 - k * 0.3); this.root.add(d); }
    this.lamp(3, 11.5, { h: 5.6, r: 7, i: 0.45, col: 0xe8e2d0, arm: 'none', flicker: 3 });

    // south-east lot: burnt cars, the van, a fire barrel
    this.prop('car', 23, 12, 0.3); this.prop('car', 28.5, 19, -1.2); this.prop('van', 30, 8.5, Math.PI / 2 + 0.1);
    this.fire(25.5, 16);
    this.building(20, 36, 22, 26, 10.8, 'n');
    this.prop('crate', 21, 7, 0.4); this.prop('barrel', 19.5, 6.5);

    // street furniture
    this.prop('car', -12, -2.3, Math.PI / 2 + 0.05); this.prop('car', 6, 2.5, -Math.PI / 2 + 0.15);
    this.prop('dumpster', -17, 6.2, 0); this.prop('trash', -15, 6);
    this.prop('crate', -23, 7, 0.2); this.prop('barrel', -24, 6.3);
    this.fire(-8, -6);

    // street lamps: a few working, a few dead, one flickering. Dark gaps are where you live.
    this.lamp(-28, -5, { dir: 0, i: 1.0 });
    this.lamp(-14, 5, { dir: Math.PI, i: 0.0, real: false }); // dead lamp
    this.lamp(2, -5, { dir: 0, i: 1.1, flicker: 1 });
    this.lamp(14, 5, { dir: Math.PI, i: 1.0 });
    this.lamp(30, -5, { dir: 0, i: 1.0 });
    this.lamps[this.lamps.length - 4].bulb.material.color.set(0x111111);

    // the exit: a chained gate in the east wall
    this.gate = new THREE.Group(); this.gate.position.set(B.x1 + 0.5, 0, 0);
    const bars = this.mat('bars', { color: 0x4a4440, metalness: 0.8, roughness: 0.5 });
    for (let z = -2.8; z <= 2.8; z += 0.25) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 4, 5), bars); b.position.set(0, 2, z); this.gate.add(b); }
    for (const y of [0.3, 2, 3.8]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 6), bars); r.position.y = y; this.gate.add(r); }
    this.chain = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 6, 14), this.mat('chainlock', { color: 0x9a9a9a, metalness: 0.9, roughness: 0.3 }));
    this.chain.position.set(-0.1, 1.2, 0); this.chain.rotation.y = Math.PI / 2; this.gate.add(this.chain);
    this.root.add(this.gate);
    this.gateBox = { x0: B.x1 - 0.1, x1: B.x1 + 1, z0: -3, z1: 3, y0: 0, y1: 4, see: false };
    this.boxes.push(this.gateBox);
    this.exitSign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({ map: T.exit, color: 0x333333 }));
    this.exitSign.position.set(B.x1 - 0.05, 4.4, 0); this.exitSign.rotation.y = -Math.PI / 2; this.root.add(this.exitSign);
    this.lamp(33, 3.2, { h: 4.2, r: 6, i: 0.5, col: 0xff3a2a, arm: 'none' });

    // graffiti
    this.graffiti(-28, 2.4, -7.95, 0, 4, 1); this.graffiti(-12, 2.2, -7.95, 0, 3.5, 4); this.graffiti(18, 2.1, -7.95, 0, 3.4, 8);
    this.graffiti(2, 2.6, 8.94, Math.PI, 4, 6); this.graffiti(-35.94, 2.5, 8, Math.PI / 2, 4, 3); this.graffiti(-35.94, 2.3, -2, Math.PI / 2, 3, 10);
    this.graffiti(B.x1 - 0.05, 2.5, -10, -Math.PI / 2, 4, 2); this.graffiti(-25.9, 1.8, 19.5, -Math.PI / 2, 2.4, 7);

    // CCTV: high on walls, sweeping
    this.cams.push({ p: new V(-21.9, 4.5, -8.2), yaw: Math.PI * 0.85, sweep: 0.7 });
    this.cams.push({ p: new V(8.8, 4.8, -9.8), yaw: Math.PI, sweep: 0.8 });
    this.cams.push({ p: new V(-9.6, 5.2, 8.8), yaw: -Math.PI * 0.15, sweep: 0.7 });
    this.cams.push({ p: new V(17.6, 5.2, 23.6), yaw: Math.PI * 1.25, sweep: 0.5 });
    this.cams.push({ p: new V(35.5, 5.5, -7.8), yaw: -Math.PI * 0.75, sweep: 0.6 });

    // weapons and junk lying around
    this.items.push({ kind: 'bag', p: new V(-33.5, 0.05, 16.2) });       // in your pen
    this.items.push({ kind: 'bottle', p: new V(-29.2, 0.05, 15.4) });
    this.items.push({ kind: 'shard', p: new V(-16.2, 0.03, 7.5) });
    this.items.push({ kind: 'brick', p: new V(-22.3, 0.06, 8.2) });
    this.items.push({ kind: 'crowbar', p: new V(-4.3, 0.03, 20.5) });
    this.items.push({ kind: 'bottle', p: new V(-20.2, 0.05, -9.2) });
    this.items.push({ kind: 'bag', p: new V(10.3, 0.05, -10.6) });
    this.items.push({ kind: 'bottle', p: new V(19.8, 0.95, 6.5) });
    this.items.push({ kind: 'brick', p: new V(2, 0.06, 6.8) });
    this.items.push({ kind: 'shard', p: new V(15.2, 0.03, 13.2) });
    // painkillers
    this.items.push({ kind: 'pills', p: new V(-34.6, 0.05, 24.4) });
    this.items.push({ kind: 'pills', p: new V(-8.6, 0.05, 21.8) });
    this.items.push({ kind: 'pills', p: new V(22.4, 0.05, -10.2) });
    this.items.push({ kind: 'pills', p: new V(29, 0.05, 23.2) });

    // patrols
    this.routes.push([[-20, -1], [-6, -2], [-6, 2.5], [-20, 2.5]]);
    this.routes.push([[-2, 12], [-2, 22], [11.5, 22], [11.5, 12]]);
    this.routes.push([[22, -1], [32, -1], [32, 4], [22, 4]]);
    this.routes.push([[-20.5, -6], [-20.5, -17], [-20.5, -6], [-30, -6]]);
    this.routes.push([[20, 9], [26, 12], [31, 15], [24, 20], [19, 15]]);
  }

  // -------------------------------------------------------------- queries
  // does the segment a->b (3D) clear every sight-blocking box?
  clear(a, b, forSight = true) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    for (const q of this.boxes) {
      if (forSight && !q.see) continue;
      let t0 = 0, t1 = 1;
      if (!slab(a.x, dx, q.x0, q.x1)) continue;
      const r = clip(a.x, dx, q.x0, q.x1, t0, t1); if (!r) continue; [t0, t1] = r;
      const r2 = clip(a.z, dz, q.z0, q.z1, t0, t1); if (!r2) continue; [t0, t1] = r2;
      const r3 = clip(a.y, dy, q.y0, q.y1, t0, t1); if (!r3) continue;
      return false;
    }
    return true;
  }

  // push a circle (x,z,r) out of walls; returns the corrected point
  collide(p, r, h = 1.6) {
    for (let it = 0; it < 2; it++) for (const q of this.boxes) {
      if (q.y1 < 0.35 || q.y0 > h) continue;
      const cx = Math.max(q.x0, Math.min(p.x, q.x1)), cz = Math.max(q.z0, Math.min(p.z, q.z1));
      const dx = p.x - cx, dz = p.z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += dx * k; p.z += dz * k; }
        else { // centre inside the box: shove out the short way
          const ox = Math.min(p.x - q.x0, q.x1 - p.x), oz = Math.min(p.z - q.z0, q.z1 - p.z);
          if (ox < oz) p.x = (p.x - q.x0 < q.x1 - p.x) ? q.x0 - r : q.x1 + r; else p.z = (p.z - q.z0 < q.z1 - p.z) ? q.z0 - r : q.z1 + r;
        }
      }
    }
    p.x = Math.max(BOUNDS.x0 + r, Math.min(BOUNDS.x1 + (this.gateOpen ? 6 : -r), p.x));
    p.z = Math.max(BOUNDS.z0 + r, Math.min(BOUNDS.z1 - r, p.z));
    return p;
  }

  // ------------------------------------------------------------ light grid
  bakeLight() {
    const B = BOUNDS, nx = Math.ceil((B.x1 - B.x0) / CELL), nz = Math.ceil((B.z1 - B.z0) / CELL);
    this.lnx = nx; this.lnz = nz;
    this.lgrid = this.lamps.map(() => new Float32Array(nx * nz));
    const a = new V(), b = new V();
    this.lamps.forEach((L, li) => {
      const g = this.lgrid[li];
      if (L.base <= 0) return;
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        b.set(B.x0 + (i + 0.5) * CELL, 1.0, B.z0 + (j + 0.5) * CELL);
        const d = b.distanceTo(L.p); if (d > L.r) continue;
        a.copy(L.p).y -= 0.25;
        if (!this.clear(a, b)) continue;
        const f = 1 - d / L.r; g[j * nx + i] = f * f;
      }
    });
  }
  // 0 = pitch black, ~1 = standing under a lamp
  lightAt(p) {
    const B = BOUNDS, i = Math.floor((p.x - B.x0) / CELL), j = Math.floor((p.z - B.z0) / CELL);
    if (i < 0 || j < 0 || i >= this.lnx || j >= this.lnz) return 0.05;
    let s = 0.04; const k = j * this.lnx + i;
    this.lamps.forEach((L, li) => { s += this.lgrid[li][k] * L.base * L.on; });
    return Math.min(1.2, s);
  }

  // ------------------------------------------------------------- walk grid
  bakeWalk() {
    const B = BOUNDS, nx = this.lnx, nz = this.lnz, r = 0.35;
    this.walk = new Uint8Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = B.x0 + (i + 0.5) * CELL, z = B.z0 + (j + 0.5) * CELL;
      let ok = 1;
      for (const q of this.boxes) { if (q.y1 < 0.35) continue; if (x > q.x0 - r && x < q.x1 + r && z > q.z0 - r && z < q.z1 + r) { ok = 0; break; } }
      this.walk[j * nx + i] = ok;
    }
  }
  cellOf(x, z) { return [Math.floor((x - BOUNDS.x0) / CELL), Math.floor((z - BOUNDS.z0) / CELL)]; }
  walkable(i, j) { return i >= 0 && j >= 0 && i < this.lnx && j < this.lnz && this.walk[j * this.lnx + i] === 1; }
  nearestWalk(i, j) {
    if (this.walkable(i, j)) return [i, j];
    for (let r = 1; r < 8; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (this.walkable(i + di, j + dj)) return [i + di, j + dj];
    return [i, j];
  }
  // A* over the walk grid; returns a list of world [x,z] waypoints (smoothed)
  path(from, to) {
    const nx = this.lnx, nz = this.lnz;
    let [si, sj] = this.nearestWalk(...this.cellOf(from.x, from.z));
    let [ti, tj] = this.nearestWalk(...this.cellOf(to.x, to.z));
    const N = nx * nz, start = sj * nx + si, goal = tj * nx + ti;
    if (!this._g) { this._g = new Float32Array(N); this._from = new Int32Array(N); this._seen = new Uint32Array(N); this._stamp = 0; }
    const g = this._g, fr = this._from, seen = this._seen, stamp = ++this._stamp;
    const heap = new MinHeap();
    g[start] = 0; fr[start] = -1; seen[start] = stamp; heap.push(start, 0);
    const h = (k) => { const i = k % nx, j = (k / nx) | 0; return Math.hypot(i - ti, j - tj); };
    let found = false, iter = 0;
    while (heap.size && iter++ < 9000) {
      const k = heap.pop(); if (k === goal) { found = true; break; }
      const i = k % nx, j = (k / nx) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ii = i + di, jj = j + dj; if (!this.walkable(ii, jj)) continue;
        if (di && dj && (!this.walkable(i + di, j) || !this.walkable(i, j + dj))) continue;
        const kk = jj * nx + ii, c = g[k] + (di && dj ? 1.414 : 1);
        if (seen[kk] !== stamp || c < g[kk]) { seen[kk] = stamp; g[kk] = c; fr[kk] = k; heap.push(kk, c + h(kk)); }
      }
    }
    if (!found) return [[to.x, to.z]];
    const cells = []; for (let k = goal; k !== -1; k = fr[k]) cells.push(k); cells.reverse();
    const pts = cells.map((k) => [BOUNDS.x0 + ((k % nx) + 0.5) * CELL, BOUNDS.z0 + (((k / nx) | 0) + 0.5) * CELL]);
    // string-pull: skip points while the straight walk stays on walkable cells
    const out = [pts[0]]; let a = 0;
    while (a < pts.length - 1) {
      let b = pts.length - 1;
      while (b > a + 1 && !this.lineWalk(pts[a], pts[b])) b--;
      out.push(pts[b]); a = b;
    }
    out.shift(); out.push([to.x, to.z]);
    return out;
  }
  lineWalk(a, b) {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(d / (CELL * 0.5));
    for (let s = 0; s <= n; s++) { const x = a[0] + (b[0] - a[0]) * s / n, z = a[1] + (b[1] - a[1]) * s / n; const [i, j] = this.cellOf(x, z); if (!this.walkable(i, j)) return false; }
    return true;
  }

  openGate() {
    this.gateOpen = true;
    const i = this.boxes.indexOf(this.gateBox); if (i >= 0) this.boxes.splice(i, 1);
    this.chain.visible = false; this.exitSign.material.color.set(0xffffff);
  }

  update(t, dt) {
    for (const L of this.lamps) {
      if (!L.flicker || L.base <= 0) continue;
      let on = 1;
      if (L.flicker === 1) on = (Math.sin(t * 13.1) + Math.sin(t * 7.3) > 1.6) ? 0.15 : 1;
      if (L.flicker === 2) on = 0.8 + Math.sin(t * 11 + L.p.x) * 0.1 + Math.sin(t * 23.7) * 0.08;
      if (L.flicker === 3) on = (Math.sin(t * 0.9) > 0.6 && Math.sin(t * 31) > 0) ? 0.05 : 1;
      L.on = on;
      if (L.light) L.light.intensity = L.base * 26 * on;
      L.glow.material.opacity = 0.55 * on;
      if (L.flames) L.flames.forEach((f, k) => { f.scale.set(0.45 + Math.sin(t * 9 + k) * 0.06, 0.8 + Math.sin(t * 13 + k * 2) * 0.15, 1); });
    }
  }
}

function rep(t, x, y) { const c = t.clone(); c.needsUpdate = true; c.repeat.set(x, y); return c; }
function slab() { return true; }
function clip(o, d, lo, hi, t0, t1) {
  if (Math.abs(d) < 1e-9) return (o < lo || o > hi) ? null : [t0, t1];
  let a = (lo - o) / d, b = (hi - o) / d; if (a > b) [a, b] = [b, a];
  t0 = Math.max(t0, a); t1 = Math.min(t1, b);
  return t0 <= t1 ? [t0, t1] : null;
}
class MinHeap {
  constructor() { this.k = []; this.p = []; }
  get size() { return this.k.length; }
  push(k, p) { const K = this.k, P = this.p; let i = K.length; K.push(k); P.push(p); while (i > 0) { const j = (i - 1) >> 1; if (P[j] <= p) break; K[i] = K[j]; P[i] = P[j]; i = j; } K[i] = k; P[i] = p; }
  pop() {
    const K = this.k, P = this.p, top = K[0], lk = K.pop(), lp = P.pop();
    if (K.length) { let i = 0; const n = K.length; while (true) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && P[c + 1] < P[c]) c++; if (P[c] >= lp) break; K[i] = K[c]; P[i] = P[c]; i = c; } K[i] = lk; P[i] = lp; }
    return top;
  }
}
