// district.js — the scenes of Carcer City. Each scene is a builder method that
// lays out boxes, lamps, cameras, items, patrol routes, a start door and an exit gate.
// Builds the geometry, the collision boxes, the lamps, a baked light grid the
// hunters use to judge whether they can see you, and a walk grid for their
// pathfinding. Everything is boxes on purpose: cheap to collide and to ray-test.
import * as THREE from '../vendor/three.module.js';
import { T, seeded } from './paint.js?v=22';
import { buildPlan } from './planlevel.js?v=22';

const V = THREE.Vector3;
const CELL = 0.5, HC = 4; // walk/light cell, wall-index bucket (m)
// the wall list: every push/splice bumps a version so the spatial index knows to rebuild
class BoxList extends Array {
  static get [Symbol.species]() { return Array; }
  push(...a) { this.ver = (this.ver || 0) + 1; return super.push(...a); }
  splice(...a) { this.ver = (this.ver || 0) + 1; return super.splice(...a); }
}

export class District {
  constructor(scene, idx = 0) {
    this.scene = scene; this.idx = idx; this.def = SCENES[idx]; this.B = { ...this.def.B };
    this.boxes = new BoxList(); // {x0,x1,z0,z1,y0,y1, solid, see}  see=false -> fences you can see through
    this.lamps = [];          // {p, r, i, col, flicker, light, bulb}
    this.cams = [];           // CCTV spots {p, yaw, sweep}
    this.items = [];          // item spawns {kind, p}
    this.routes = [];         // patrol loops [[x,z]..]
    this.hunterSpawns = [];
    this.start = new V(); this.startYaw = 0; this.startOpen = false; this.startSwing = 0;
    this.mats = {};
    this.R = seeded(1979);
    this.root = new THREE.Group(); scene.add(this.root);
    this[this.def.build]();
    this.bakeLight();
    this.bakeWalk();
    if (this.pending) { // place patrols and loot only in places reachable from the start room
      const sb = this.startBox && this.boxes.indexOf(this.startBox); if (sb >= 0) { this.boxes.splice(sb, 1); this.bakeWalk(); }
      this.reach = this.flood(); const { seed, hunters } = this.pending;
      this.autoLoot(seed, 11); this.autoRoutes(seed + 7, hunters);
      if (sb >= 0) { this.boxes.push(this.startBox); this.bakeWalk(); }
    }
  }

  mat(key, opts) {
    if (!this.mats[key]) this.mats[key] = new THREE.MeshStandardMaterial(opts);
    return this.mats[key];
  }
  texMat(key, t, rx, ry, extra = {}) {
    const map = t.map.clone(); map.needsUpdate = true; map.repeat.set(rx, ry);
    if (t.normal) return this.mat(key, Object.assign({ map, normalMap: rep(t.normal, rx, ry), roughnessMap: rep(t.rough, rx, ry), roughness: 1, metalness: 0 }, extra));
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
    const brick = this.mat('brick', brickMat());
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
    const fy = this.heightAt(x, z), p = new V(x, h + fy, z);
    if (arm === 'pole') {
      const metal = this.mat('pole', { color: 0x2b2d2f, roughness: 0.6, metalness: 0.6 });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, h + 0.3, 8), metal); pole.position.set(x - Math.sin(dir) * 0.9, (h + 0.3) / 2 + fy, z - Math.cos(dir) * 0.9); this.root.add(pole);
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.0), metal); a.position.set(x - Math.sin(dir) * 0.45, h + 0.25 + fy, z - Math.cos(dir) * 0.45); a.rotation.y = dir; this.root.add(a);
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

  fire(x, z) {
    const n0 = this.root.children.length; // burning oil drum: a light source with a flame
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
    { const fy = this.heightAt(x, z); if (fy) for (let k = n0; k < this.root.children.length; k++) this.root.children[k].position.y += fy; }
  }

  prop(kind, x, z, ry = 0) {
    const n0 = this.root.children.length; try { return this.propAt(kind, x, z, ry); } finally { const fy = this.heightAt(x, z); if (fy) for (let k = n0; k < this.root.children.length; k++) this.root.children[k].position.y += fy; }
  }
  propAt(kind, x, z, ry = 0) {
    const R = this.R; (this.props || (this.props = [])).push({ kind, x, z });
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

  buildPens() {
    const B = this.B;
    this.start.set(-31, 0, 19.5); this.startYaw = Math.PI * 0.75;
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
    const wallM = this.mat('wall', brickMat(0x9a958e));
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

    // the exit: a chained gate in the east wall; the pen door Cash starts behind
    this.makeGate(B.x1 + 0.5, 0, true, 6, -1);
    this.lamp(33, 3.2, { h: 4.2, r: 6, i: 0.5, col: 0xff3a2a, arm: 'none' });
    this.makeStartDoor(-26, 17.5, true, 4);

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

  // ============================================================ scene 2: the mall
  buildMall() {
    const B = this.B;
    this.start.set(-26.5, 0, 0); this.startYaw = -Math.PI / 2;
    const tile = this.texMat('mallfloor', T.slab, 20, 14, { color: 0xb8b2a4, roughness: 0.4 });
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(B.x1 - B.x0, B.z1 - B.z0), tile); fl.rotation.x = -Math.PI / 2; this.root.add(fl);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(B.x1 - B.x0, B.z1 - B.z0), this.mat('mallceil', { color: 0x1c1b19, roughness: 1, side: THREE.DoubleSide }));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = 7; this.root.add(ceil);
    const wall = this.mat('mallwall', { map: rep(T.concrete.map, 1, 1), color: 0x8c867c, roughness: 0.9 });
    const glass = this.mat('shopglass', { color: 0x14181a, roughness: 0.05, metalness: 0.7, transparent: true, opacity: 0.55 });
    // perimeter
    this.box(B.x0 - 1, B.x0, B.z0, B.z1, 0, 7, wall); this.box(B.x0, B.x1, B.z1, B.z1 + 1, 0, 7, wall); this.box(B.x0, B.x1, B.z0 - 1, B.z0, 0, 7, wall);
    this.box(B.x1, B.x1 + 1, B.z0, -3, 0, 7, wall); this.box(B.x1, B.x1 + 1, 3, B.z1, 0, 7, wall);
    // shops along both sides of the concourse (z -6..6): walls with doorways and smashed shop windows
    const shops = [-22, -12, -2, 8, 18];
    for (const side of [-1, 1]) {
      const zf = 6 * side, zb = B.z1 * side;
      for (let k = 0; k < shops.length; k++) {
        const x0 = shops[k], x1 = x0 + 10;
        this.box(x0, x0 + 0.3, Math.min(zf, zb), Math.max(zf, zb), 0, 4.2, wall); // party wall
        // shop front: low wall + glass, doorway in the middle
        const zz = side > 0 ? [zf, zf + 0.25] : [zf - 0.25, zf];
        this.box(x0 + 0.3, x0 + 4, zz[0], zz[1], 0, 1.0, wall); this.box(x0 + 6, x1, zz[0], zz[1], 0, 1.0, wall);
        if (k % 2 === 0) { this.box(x0 + 0.3, x0 + 4, zz[0], zz[1], 1.0, 3.6, glass, { solid: true, see: false }); }
        this.box(x0 + 0.3, x1, zz[0], zz[1], 3.6, 4.2, wall, { solid: false });
        // inside: shelving and a counter
        const shelf = this.mat('shelf', { color: 0x40362c, roughness: 0.8, metalness: 0.4 });
        const zin = zf + 3 * side;
        this.box(x0 + 1.5, x0 + 4.5, Math.min(zin, zin + 0.8 * side), Math.max(zin, zin + 0.8 * side), 0, 1.8, shelf);
        this.box(x0 + 6, x0 + 9, Math.min(zin + 4 * side, zin + 4.8 * side), Math.max(zin + 4 * side, zin + 4.8 * side), 0, 1.1, this.mat('counter', { color: 0x5a4a3a, roughness: 0.6 }));
        if ((k + (side > 0 ? 1 : 0)) % 2) this.prop('trash', x0 + 7, zin + 1.5 * side); else this.prop('crate', x0 + 3, zin + 3 * side, 0.4);
      }
      this.box(28, 28.3, Math.min(zf, zb), Math.max(zf, zb), 0, 4.2, wall);
    }
    // the concourse: a dead fountain, benches, a fallen sign, mannequins
    this.box(-3, 3, -2, 2, 0, 0.6, this.mat('fountain', { color: 0x6a665e, roughness: 0.5 }));
    const water = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 3.4), this.mat('scum', { color: 0x1a2014, roughness: 0.1, metalness: 0.3 })); water.rotation.x = -Math.PI / 2; water.position.set(0, 0.55, 0); this.root.add(water);
    for (const x of [-15, -8, 10, 20]) this.box(x, x + 2, -0.25 + (x > 0 ? 3 : -3), 0.25 + (x > 0 ? 3 : -3), 0, 0.45, this.mat('bench', { color: 0x3a2a1c, roughness: 0.8 }));
    this.prop('car', 14, -3.5, 0.2); // someone drove in through the doors
    this.prop('barrel', -18, 4); this.prop('trash', 6, 4.5); this.prop('trash', -10, -4.8);
    this.fire(22, 0.5);
    // ceiling strip lights: most dead, two flickering, a burst skylight letting the moon in
    this.lamp(-14, 0, { h: 6.6, r: 9, i: 0.9, col: 0xf0ecdc, arm: 'none', flicker: 1 });
    this.lamp(5, 0, { h: 6.6, r: 9, i: 0.8, col: 0xf0ecdc, arm: 'none', flicker: 3 });
    this.lamp(-17, 13, { h: 3.6, r: 6, i: 0.6, col: 0xffc880, arm: 'none' });
    this.lamp(13, -13, { h: 3.6, r: 6, i: 0.6, col: 0xffc880, arm: 'none', flicker: 2 });
    this.lamp(-7, -13, { h: 3.6, r: 5, i: 0.0, real: false, arm: 'none' });
    this.lamp(27, 0, { h: 4.2, r: 6, i: 0.5, col: 0xff3a2a, arm: 'none' });
    this.graffiti(-5, 2.6, 5.7, Math.PI, 4, 0); this.graffiti(12, 2.4, -5.7, 0, 3.6, 3); this.graffiti(-24, 2.4, -5.7, 0, 3, 9);
    // the security office Cash starts in (west end), door into the concourse
    this.box(-30, -24, -4, -3.7, 0, 3, wall); this.box(-30, -24, 3.7, 4, 0, 3, wall); this.box(-24, -23.7, -4, -2, 0, 3, wall); this.box(-24, -23.7, 2, 4, 0, 3, wall);
    this.makeStartDoor(-23.85, -2, true, 4);
    this.makeGate(B.x1 + 0.5, 0, true, 6, -1);
    this.cams.push({ p: new V(-23.5, 5.5, 5.6), yaw: Math.PI * 0.75, sweep: 0.6 });
    this.cams.push({ p: new V(0, 6.5, -5.6), yaw: 0.2, sweep: 0.9 });
    this.cams.push({ p: new V(20, 5.5, 5.6), yaw: Math.PI * 1.2, sweep: 0.6 });
    for (const [k, x, z] of [['crowbar', -28, 2.6], ['bag', -16, 9], ['shard', -8, -10], ['bottle', 2, 9.5], ['brick', 9, -9], ['bottle', 15, 3.5], ['shard', 21, -12], ['bag', 24, 10], ['pills', -26, -15], ['pills', 4, 16], ['pills', 26, -16]])
      this.items.push({ kind: k, p: new V(x, (k === 'shard' ? 0.03 : 0.05) + this.heightAt(x, z), z) });
    this.routes.push([[-20, -2], [-6, -3], [-6, 3], [-20, 3]], [[-17, 10], [-13, 16], [-9, 10]], [[3, -10], [7, -15], [13, -11], [9, -9]],
      [[6, 2], [24, 2], [24, -2], [6, -2]], [[19, 10], [25, 15], [21, 17], [19, 12]], [[-7, -11], [-3, -16], [-9, -16]]);
  }

  // ========================================================== scene 3: the asylum
  buildAsylum() {
    const B = this.B;
    this.start.set(-25.5, 0, 9); this.startYaw = Math.PI;
    const lino = this.texMat('lino', T.slab, 18, 12, { color: 0x9a9a88, roughness: 0.55 });
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(B.x1 - B.x0, B.z1 - B.z0), lino); fl.rotation.x = -Math.PI / 2; this.root.add(fl);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(B.x1 - B.x0, B.z1 - B.z0), this.mat('aceil', { color: 0x2a2a26, roughness: 1, side: THREE.DoubleSide }));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = 3.6; this.root.add(ceil);
    // institutional green-and-cream walls
    const tc = document.createElement('canvas'); tc.width = tc.height = 256; const t = tc.getContext('2d');
    t.fillStyle = '#c8c2ae'; t.fillRect(0, 0, 256, 256); t.fillStyle = '#5e6a52'; t.fillRect(0, 150, 256, 106); t.fillStyle = '#3e4636'; t.fillRect(0, 146, 256, 6);
    for (let k = 0; k < 60; k++) { t.fillStyle = `rgba(60,50,30,${Math.random() * 0.25})`; t.fillRect(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 30, 8 + Math.random() * 60); }
    const tt = new THREE.CanvasTexture(tc); tt.colorSpace = THREE.SRGBColorSpace; tt.wrapS = tt.wrapT = THREE.RepeatWrapping;
    const wall = this.mat('asylumwall', { map: tt, roughness: 0.9 });
    const H = 3.6;
    this.box(B.x0 - 1, B.x0, B.z0, B.z1, 0, H, wall); this.box(B.x0, B.x1, B.z1, B.z1 + 1, 0, H, wall); this.box(B.x0, B.x1, B.z0 - 1, B.z0, 0, H, wall);
    this.box(B.x1, B.x1 + 1, B.z0, -2, 0, H, wall); this.box(B.x1, B.x1 + 1, 2, B.z1, 0, H, wall);
    // two cell blocks either side of the main corridor (z -2..2), a back corridor behind each
    for (const side of [-1, 1]) {
      const zc = 2 * side, zback = 8 * side;
      for (let x = -24; x < 24; x += 4) {
        this.box(x, x + 0.2, Math.min(zc, zback), Math.max(zc, zback), 0, H, wall);          // cell partition
        // cell front with a doorway (most doors gone)
        const zz = side > 0 ? [zc, zc + 0.2] : [zc - 0.2, zc];
        this.box(x + 0.2, x + 1.4, zz[0], zz[1], 0, H, wall); this.box(x + 2.6, x + 4, zz[0], zz[1], 0, H, wall);
        this.box(x + 1.4, x + 2.6, zz[0], zz[1], 2.3, H, wall, { solid: false });
        const zb = side > 0 ? [zback, zback + 0.2] : [zback - 0.2, zback];
        if ((x / 4) % 3 === 0) { this.box(x + 0.2, x + 1.4, zb[0], zb[1], 0, H, wall); this.box(x + 2.6, x + 4, zb[0], zb[1], 0, H, wall); } else this.box(x + 0.2, x + 4, zb[0], zb[1], 0, H, wall);
        if ((x / 4 + side) % 2 === 0) this.prop('mattress', x + 2, zc + 3 * side, 0.2); else this.box(x + 0.6, x + 1.6, Math.min(zc + 4 * side, zc + 5 * side), Math.max(zc + 4 * side, zc + 5 * side), 0, 0.5, this.mat('bed', { color: 0x6a6a64, metalness: 0.5, roughness: 0.6 }));
      }
      this.box(24, 24.2, Math.min(zc, zback), Math.max(zc, zback), 0, H, wall);
    }
    // the shower block (north-east) and padded room (south-west) behind the back corridors
    this.box(8, 8.2, 11, B.z1, 0, H, wall); this.box(-10, -9.8, B.z0, -11, 0, H, wall);
    const tiles = this.mat('tiles', { color: 0xa8b0a8, roughness: 0.3 });
    for (let x = 11; x < 26; x += 3) this.box(x, x + 0.15, 14, B.z1, 0, 2, tiles);
    this.prop('trash', 4, -12); this.prop('barrel', -16, 12.5); this.prop('crate', 16, -12, 0.3); this.prop('mattress', -14, -14, 1.1);
    // a wheelchair and a gurney in the corridor
    this.box(-8, -6.4, -0.6, 0.2, 0, 0.9, this.mat('gurney', { color: 0x8a8a84, metalness: 0.6, roughness: 0.4 }));
    this.prop('barrel', 12, 1.2);
    // bare bulbs: few and far between
    this.lamp(-18, 0, { h: 3.2, r: 6, i: 0.7, col: 0xffe6b0, arm: 'none', flicker: 1 });
    this.lamp(-2, 0, { h: 3.2, r: 6, i: 0.0, real: false, arm: 'none' });
    this.lamp(10, 0, { h: 3.2, r: 6, i: 0.7, col: 0xffe6b0, arm: 'none', flicker: 3 });
    this.lamp(-14, 10, { h: 3.2, r: 5, i: 0.55, col: 0xffe6b0, arm: 'none' });
    this.lamp(16, 16, { h: 3.2, r: 6, i: 0.6, col: 0xd8ffe0, arm: 'none', flicker: 2 });
    this.lamp(4, -10, { h: 3.2, r: 5, i: 0.5, col: 0xffe6b0, arm: 'none', flicker: 1 });
    this.lamp(26, 0, { h: 3.2, r: 5, i: 0.5, col: 0xff3a2a, arm: 'none' });
    // Cash wakes in an isolation cell in the west back corridor
    this.box(-28, -23, 11.8, 12, 0, H, wall); this.box(-23, -22.8, 8, 9.8, 0, H, wall); this.box(-23, -22.8, 11.8, 12, 0, H, wall);
    this.makeStartDoor(-22.9, 9.8, true, 2);
    this.makeGate(B.x1 + 0.5, 0, true, 4, -1);
    this.cams.push({ p: new V(-20, 3.3, -1.8), yaw: Math.PI * 0.6, sweep: 0.7 });
    this.cams.push({ p: new V(6, 3.3, 1.8), yaw: -0.3, sweep: 0.9 });
    this.cams.push({ p: new V(20, 3.3, -9.6), yaw: Math.PI * 0.8, sweep: 0.5 });
    for (const [k, x, z] of [['shard', -25, 11], ['bag', -18, 10], ['crowbar', -6, 12], ['bottle', 2, -10], ['brick', 12, 10], ['shard', 18, -12], ['bag', 6, 14], ['bottle', -12, -12], ['pills', -26, 15], ['pills', 0, -15], ['pills', 20, 16]])
      this.items.push({ kind: k, p: new V(x, (k === 'shard' ? 0.03 : 0.05) + this.heightAt(x, z), z) });
    this.routes.push([[-20, 0], [-4, 0]], [[-24, 10], [-6, 10]], [[0, 10], [18, 10], [18, 15], [12, 16]], [[-20, -10], [-2, -10], [-2, -14], [-8, -15]],
      [[4, 0], [22, 0]], [[6, -10], [22, -10], [22, -15]]);
  }

  // ======================================================= scene 4: the junkyard
  buildJunkyard() {
    const B = this.B;
    this.start.set(-32, 0, 20); this.startYaw = Math.PI * 0.75;
    const dirt = this.texMat('gravel', T.gravel, 22, 16, { roughness: 1, color: 0x8a7a66 });
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(B.x1 - B.x0, B.z1 - B.z0), dirt); fl.rotation.x = -Math.PI / 2; this.root.add(fl);
    const corr = this.mat('corr', { map: rep(T.corrugated.map, 1, 1), roughness: 0.6, metalness: 0.5, color: 0x9a9a98 });
    // perimeter: corrugated fence, chain link at the gate
    this.box(B.x0 - 0.3, B.x0, B.z0, B.z1, 0, 4, corr); this.box(B.x1, B.x1 + 0.3, B.z0, B.z1, 0, 4, corr); this.box(B.x0, B.x1, B.z1, B.z1 + 0.3, 0, 4, corr);
    this.box(B.x0, -3, B.z0 - 0.3, B.z0, 0, 4, corr); this.box(3, B.x1, B.z0 - 0.3, B.z0, 0, 4, corr);
    // shipping containers in rows: lanes to creep down
    const cols = [0x5a2a1c, 0x2a3a4a, 0x3a4a2a, 0x6a5a2a, 0x4a1a1a];
    const cont = (x, z, rot, k) => { const m = this.mat('cont' + k, { map: rep(T.corrugated.map, 1, 1), color: cols[k % cols.length], roughness: 0.6, metalness: 0.4 }); if (rot) this.box(x - 1.25, x + 1.25, z - 3, z + 3, 0, 2.6, m); else this.box(x - 3, x + 3, z - 1.25, z + 1.25, 0, 2.6, m); };
    let k = 0;
    for (const x of [-24, -10, 6, 20]) for (const z of [-16, -6, 8]) { if (!(x === -24 && z === 8)) cont(x, z, (x + z) % 4 === 0, k++); }
    cont(30, 18, true, 7); cont(-30, -18, false, 8);
    // stacks of crushed cars
    for (const [x, z] of [[-16, 14], [0, 16], [14, 14], [28, -10], [-30, 4], [-2, -22]]) {
      for (let y = 0; y < 3; y++) { const c = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 3.8), this.mat('charred', { map: rep(T.charred.map, 1, 1), roughness: 0.95, metalness: 0.3 })); c.position.set(x + (Math.random() - 0.5) * 0.3, 0.35 + y * 0.72, z); c.rotation.y = (Math.random() - 0.5) * 0.3; this.root.add(c); }
      this.solidOBB(x, z, 1.0, 2.0, 0, 2.2);
    }
    // the crane, dog kennels, a burning tyre pile
    this.box(10, 11, -1, 0, 0, 12, this.mat('crane', { color: 0x9a7a1a, metalness: 0.5, roughness: 0.6 }));
    const jib = new THREE.Mesh(new THREE.BoxGeometry(14, 0.6, 0.6), this.mat('crane')); jib.position.set(15, 12, -0.5); this.root.add(jib);
    for (let x = -34; x < -24; x += 2.2) this.box(x, x + 2, -25.5, -23.5, 0, 1.6, this.mat('kennel', { color: 0x4a3a2a, roughness: 0.9 }));
    this.fire(-6, 0); this.fire(24, 2);
    // two floodlights on poles, the rest is dark
    this.lamp(-4, 12, { h: 8, r: 16, i: 1.2, col: 0xf0f0e8, dir: Math.PI });
    this.lamp(26, -20, { h: 8, r: 14, i: 1.1, col: 0xf0f0e8, flicker: 1 });
    this.lamp(-20, -10, { h: 6, r: 9, i: 0.0, real: false });
    this.lamp(0, -25, { h: 4.2, r: 6, i: 0.5, col: 0xff3a2a, arm: 'none' });
    this.prop('van', -18, 0, 0.4); this.prop('car', 30, 8, 1.2); this.prop('barrel', 6, 2); this.prop('barrel', 7, 2.6); this.prop('trash', -12, -10);
    // Cash starts locked in a container in the south-west corner
    const m = this.mat('cont9', { map: rep(T.corrugated.map, 1, 1), color: 0x5a3a2a, roughness: 0.6, metalness: 0.4 });
    this.box(-35, -29, 21.5, 21.7, 0, 2.6, m); this.box(-35, -29, 18.3, 18.5, 0, 2.6, m); this.box(-35, -34.8, 18.5, 21.5, 0, 2.6, m);
    this.box(-35, -29, 18.3, 21.7, 2.6, 2.75, m, { solid: false });
    this.makeStartDoor(-29, 18.5, true, 3);
    this.makeGate(0, B.z0 - 0.5, false, 6, -1);
    this.cams.push({ p: new V(-23, 3.4, -4.8), yaw: Math.PI * 0.2, sweep: 0.8 });
    this.cams.push({ p: new V(10.5, 6, -1.2), yaw: Math.PI, sweep: 1.0 });
    this.cams.push({ p: new V(19, 3.4, 9.3), yaw: Math.PI * 0.5, sweep: 0.7 });
    for (const [k, x, z] of [['crowbar', -31, 19.4], ['brick', -28, 12], ['bottle', -14, 2], ['bag', -4, -10], ['shard', 4, 10], ['brick', 14, -12], ['bottle', 24, 12], ['bag', 30, -20], ['shard', -26, -12], ['pills', -34, -6], ['pills', 0, 24], ['pills', 34, 22], ['pills', 16, -24]])
      this.items.push({ kind: k, p: new V(x, (k === 'shard' ? 0.03 : 0.05) + this.heightAt(x, z), z) });
    this.routes.push([[-30, -1], [-12, -1], [-12, 2]], [[-17, -11], [-3, -11]], [[13, -11], [27, -11], [27, -2]], [[-6, 4], [2, 4], [2, 12], [-6, 12]],
      [[13, 4], [27, 4], [27, 13]], [[-20, 20], [-6, 21], [8, 21], [22, 22]], [[-8, -21], [8, -21]]);
  }

  // ===================================================== scene 5: Piggsy's attic
  buildAttic() {
    const B = this.B;
    this.start.set(-15, 0, 0); this.startYaw = -Math.PI / 2;
    const boards = this.texMat('boards', { map: T.wood.map }, 12, 8, { roughness: 0.85, color: 0x9a7a5a });
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(B.x1 - B.x0, B.z1 - B.z0), boards); fl.rotation.x = -Math.PI / 2; this.root.add(fl);
    const wood = this.mat('atticwall', { map: rep(T.wood.map, 1, 1), color: 0x5a4636, roughness: 0.9 });
    this.box(B.x0 - 0.5, B.x0, B.z0, B.z1, 0, 4.5, wood); this.box(B.x1, B.x1 + 0.5, B.z0, B.z1, 0, 4.5, wood);
    this.box(B.x0, B.x1, B.z0 - 0.5, B.z0, 0, 2.2, wood); this.box(B.x0, B.x1, B.z1, B.z1 + 0.5, 0, 2.2, wood);
    // the roof slopes down to the eaves
    for (const side of [-1, 1]) { const r = new THREE.Mesh(new THREE.PlaneGeometry(B.x1 - B.x0, 13.5), this.mat('roofslope', { color: 0x2a2018, roughness: 1, side: THREE.DoubleSide })); r.position.set(0, 3.4, side * 6); r.rotation.x = Math.PI / 2 + side * 0.2; this.root.add(r); }
    for (let x = -16; x <= 16; x += 4) this.box(x - 0.15, x + 0.15, -10, 10, 3.9, 4.2, wood, { solid: false });
    // junk: trunks, a rocking horse, sheeted furniture, a cage
    const sheet = this.mat('sheet', { color: 0xb8b2a0, roughness: 1 });
    for (const [x, z, w, d, h] of [[-8, -7, 2, 1.2, 1.1], [-2, 7, 1.6, 1.6, 1.4], [6, -6, 2.4, 1, 0.9], [12, 6, 1.4, 1.4, 1.8], [-11, 6, 1, 2.4, 1.0]]) this.box(x, x + w, z, z + d, 0, h, sheet);
    this.box(14, 17, -9, -6, 0, 2.2, this.mat('cage', { color: 0x3a3a3a, metalness: 0.8, roughness: 0.4 }), { see: false });
    this.prop('crate', 3, -9, 0.3); this.prop('crate', -5, 9, 0.8); this.prop('barrel', 9, 9); this.prop('mattress', 15, 8, 0.4);
    // rotten boards: lure Piggsy across one while he's charging and he goes through the floor
    this.weak = [];
    for (const [x, z] of [[-4, -2], [4, 3], [10, -3]]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), this.mat('rotten', { map: T.charred.map, color: 0x6a4a30, roughness: 1 }));
      pl.rotation.x = -Math.PI / 2; pl.position.set(x, 0.012, z); this.root.add(pl);
      this.weak.push({ x, z, r: 1.2, mesh: pl, broken: false });
    }
    this.lamp(-12, 0, { h: 3.4, r: 6, i: 0.6, col: 0xffd8a0, arm: 'none', flicker: 1 });
    this.lamp(2, 0, { h: 3.6, r: 7, i: 0.55, col: 0xffd8a0, arm: 'none', flicker: 3 });
    this.lamp(13, 0, { h: 3.4, r: 6, i: 0.5, col: 0xffd8a0, arm: 'none', flicker: 2 });
    // the hatch Cash climbs through, and the door out once Piggsy's dead
    this.box(-18, -16.2, -2, -1.8, 0, 2.2, wood); this.box(-18, -16.2, 1.8, 2, 0, 2.2, wood);
    this.makeStartDoor(-16.2, -1.8, true, 3.6);
    this.makeGate(B.x1 + 0.3, 0, true, 3, -1);
    this.cams.push({ p: new V(-17.5, 3.4, 9.5), yaw: Math.PI * 0.75, sweep: 0.6 });
    this.cams.push({ p: new V(17.5, 3.4, -9.5), yaw: -Math.PI * 0.25, sweep: 0.6 });
    for (const [k, x, z] of [['brick', -14, 5], ['bottle', -10, -6], ['bottle', 0, 8], ['brick', 8, -8], ['crowbar', -13, -8], ['pills', -16, 8], ['pills', 16, -2], ['pills', 0, -9]])
      this.items.push({ kind: k, p: new V(x, 0.05, z) });
    this.routes.push([[-6, 0], [6, 0], [12, 4], [12, -4], [0, -6], [-8, 4]]);
  }

  // ================================================== shared bits for new scenes
  perimeter(h, mat, gateSide = 'e', gw = 6) { // four walls with a gap where the exit gate goes
    const B = this.B;
    this.box(B.x0 - 1, B.x0, B.z0, B.z1, 0, h, mat);
    if (gateSide === 'e') { this.box(B.x1, B.x1 + 1, B.z0, -gw / 2, 0, h, mat); this.box(B.x1, B.x1 + 1, gw / 2, B.z1, 0, h, mat); } else this.box(B.x1, B.x1 + 1, B.z0, B.z1, 0, h, mat);
    this.box(B.x0, B.x1, B.z1, B.z1 + 1, 0, h, mat);
    if (gateSide === 'n') { this.box(B.x0, -gw / 2, B.z0 - 1, B.z0, 0, h, mat); this.box(gw / 2, B.x1, B.z0 - 1, B.z0, 0, h, mat); } else this.box(B.x0, B.x1, B.z0 - 1, B.z0, 0, h, mat);
    if (gateSide === 'e') this.makeGate(B.x1 + 0.5, 0, true, gw, -1); else this.makeGate(0, B.z0 - 0.5, false, gw, -1);
  }
  ground(t, rx, ry, extra = {}) { const m = this.texMat('g' + this.idx, t, rx, ry, extra); const f = new THREE.Mesh(new THREE.PlaneGeometry(this.B.x1 - this.B.x0, this.B.z1 - this.B.z0), m); f.rotation.x = -Math.PI / 2; f.receiveShadow = true; this.root.add(f); return f; }
  ceiling(h, col = 0x1c1b19) { const c = new THREE.Mesh(new THREE.PlaneGeometry(this.B.x1 - this.B.x0, this.B.z1 - this.B.z0), this.mat('ceil' + this.idx, { color: col, roughness: 1, side: THREE.DoubleSide })); c.rotation.x = Math.PI / 2; c.position.y = h; this.root.add(c); }
  // a small lock-up the scene starts in: three walls and the start door on the fourth
  startRoom(x, z, w = 4, d = 3, mat, doorSide = 'e') {
    const h = 2.8;
    this.box(x - 0.2, x, z, z + d, 0, h, mat); this.box(x, x + w, z - 0.2, z, 0, h, mat); this.box(x, x + w, z + d, z + d + 0.2, 0, h, mat);
    this.box(x, x + w, z - 0.2, z + d + 0.2, h, h + 0.15, mat, { solid: false });
    this.makeStartDoor(x + w, z, true, d);
    this.start.set(x + w * 0.4, 0, z + d / 2); this.startYaw = -Math.PI / 2;
  }
  scatter(R, kinds, n, zone) { for (let k = 0; k < n; k++) { const x = zone.x0 + R() * (zone.x1 - zone.x0), z = zone.z0 + R() * (zone.z1 - zone.z0); const [ci, cj] = this.cellOf(x, z); this.prop(kinds[k % kinds.length], x, z, R() * 6); } }
  loot(list) { for (const [k, x, z] of list) this.items.push({ kind: k, p: new V(x, (k === 'shard' ? 0.03 : 0.05) + this.heightAt(x, z), z) }); }
  // standard weapon/painkiller spread across the map, avoiding solid boxes
  autoLoot(seed, n = 10) {
    const R = seeded(seed), kinds = ['bag', 'shard', 'bottle', 'brick', 'crowbar', 'bottle', 'brick', 'shard', 'bag', 'pills', 'pills', 'pills'];
    const B = this.B; let made = 0, tries = 0;
    while (made < n && tries++ < 400) {
      const x = B.x0 + 2 + R() * (B.x1 - B.x0 - 4), z = B.z0 + 2 + R() * (B.z1 - B.z0 - 4);
      if ((this.reach && !this.reach(x, z)) || this.boxes.some((q) => x > q.x0 - 0.4 && x < q.x1 + 0.4 && z > q.z0 - 0.4 && z < q.z1 + 0.4)) continue;
      const k = kinds[made % kinds.length]; this.items.push({ kind: k, p: new V(x, (k === 'shard' ? 0.03 : 0.05) + this.heightAt(x, z), z) }); made++;
    }
  }
  // cells reachable on foot from the start (start door open)
  flood() {
    const nx = this.lnx, seen = new Uint8Array(nx * this.lnz), [si, sj] = this.nearestWalk(...this.cellOf(this.start.x, this.start.z)), q = [[si, sj]]; seen[sj * nx + si] = 1;
    while (q.length) { const [i, j] = q.pop(); for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) if (this.walkable(a, b) && !seen[b * nx + a]) { seen[b * nx + a] = 1; q.push([a, b]); } }
    return (x, z) => { const [i, j] = this.cellOf(x, z); return i >= 0 && j >= 0 && i < nx && j < this.lnz && seen[j * nx + i] === 1; };
  }
  // patrol loops through open ground
  autoRoutes(seed, n) {
    const R = seeded(seed), B = this.B, free = (x, z) => (!this.reach || this.reach(x, z)) && !this.boxes.some((q) => q.y1 > 0.35 && x > q.x0 - 0.6 && x < q.x1 + 0.6 && z > q.z0 - 0.6 && z < q.z1 + 0.6);
    for (let r = 0; r < n; r++) {
      let c = null; for (let t = 0; t < 200 && !c; t++) { const x = B.x0 + 4 + R() * (B.x1 - B.x0 - 8), z = B.z0 + 4 + R() * (B.z1 - B.z0 - 8); if (free(x, z) && Math.hypot(x - this.start.x, z - this.start.z) > 14) c = [x, z]; }
      if (!c) continue; const pts = [c];
      for (let k = 0; k < 3; k++) { for (let t = 0; t < 60; t++) { const a = R() * 6.28, d = 4 + R() * 8, x = c[0] + Math.cos(a) * d, z = c[1] + Math.sin(a) * d; if (x > B.x0 + 2 && x < B.x1 - 2 && z > B.z0 + 2 && z < B.z1 - 2 && free(x, z)) { pts.push([x, z]); break; } } }
      this.routes.push(pts);
    }
  }
  // CCTV on the walls: n cameras along the perimeter looking inward
  autoCams(seed, n, h = 4.5) {
    const R = seeded(seed), B = this.B;
    for (let k = 0; k < n; k++) {
      const side = k % 4, t = 0.2 + R() * 0.6;
      const p = side === 0 ? new V(B.x0 + 0.5, h, B.z0 + t * (B.z1 - B.z0)) : side === 1 ? new V(B.x0 + t * (B.x1 - B.x0), h, B.z1 - 0.5) : side === 2 ? new V(B.x0 + t * (B.x1 - B.x0), h, B.z0 + 0.5) : new V(B.x1 - 0.5, h, B.z0 + t * (B.z1 - B.z0));
      const yaw = side === 0 ? Math.PI / 2 : side === 1 ? Math.PI : side === 2 ? 0 : -Math.PI / 2;
      this.cams.push({ p, yaw, sweep: 0.6 + R() * 0.4 });
    }
  }
  finish(seed, hunters, cams = 3) { this.pending = { seed, hunters }; this.autoCams(seed + 3, cams); }

  // ================================================================ traced Manhunt maps
  buildPlan() {
    const surf = (t, color, extra = {}) => ({ map: rep(t.map, 1, 1), normalMap: t.normal ? rep(t.normal, 1, 1) : undefined, roughnessMap: t.rough ? rep(t.rough, 1, 1) : undefined, bumpMap: t.normal ? undefined : rep(t.bump, 1, 1), bumpScale: 0.03, roughness: 1, color, ...extra });
    buildPlan(this, (S) => {
      const ground = { asphalt: surf(T.asphalt, 0xffffff, { roughness: 0.9 }), gravel: surf(T.gravel, 0x9a8a76), tiles: surf(T.slab, 0xb0aa9c, { roughness: 0.55 }), concrete: surf(T.concrete, 0x9a9890) }[S.ground];
      const wallSurf = { brick: brickMat(0x9a958e), concrete: surf(T.concrete, 0x9a968c), corrugated: { map: rep(T.corrugated.map, 1, 1), roughness: 0.6, metalness: 0.5, color: 0x9a9a98 }, stone: surf(T.concrete, 0x8a8478) }[S.wall];
      return {
        floor: this.mat('pfloor' + this.idx, ground), grass: this.mat('pgrass', surf(T.gravel, 0x56663e)),
        wall: this.mat('pwall' + this.idx, wallSurf), facade: this.mat('pfacade' + this.idx, S.tenement ? { map: rep(T.tenement.map, 1, 1), emissive: 0xffffff, emissiveMap: rep(T.tenement.emissive, 1, 1), emissiveIntensity: 0.9, normalMap: rep(T.brick.normal, 1, 1), roughness: 0.95 } : S.wall === 'corrugated' ? brickMat(0x8a857e) : { ...wallSurf, color: 0x85817a }),
        building: this.mat('pbld' + this.idx, brickMat(0x7a756e)), block: this.mat('pblock' + this.idx, { map: rep(T.crate.map, 1, 1), color: 0x8a7a66, roughness: 0.9 }),
        ceil: this.mat('pceil', { color: 0x1c1b19, roughness: 1, side: THREE.DoubleSide }),
        scrap: this.mat('pscrap', { map: rep(T.scrap.map, 1, 1), bumpMap: rep(T.scrap.bump, 1, 1), bumpScale: 0.05, roughness: 0.75, metalness: 0.25, color: 0xb0aca4 }),
        plaster: this.mat('pplaster', surf(T.plaster, 0xc8c0b0)), tiles: this.mat('ptiles', surf(T.walltile, 0xd0ccc0, { roughnessMap: undefined, roughness: 0.4 })),
        ifloor: this.mat('pifloor', surf(T.concrete, 0x7a7266)), tfloor: this.mat('ptfloor', surf(T.slab, 0x9a9488, { roughness: 0.5 })),
      };
    });
  }
  // a scruffy city tree: a trunk and a few lumps of dark foliage
  tree(x, z, size = 3) {
    const n0 = this.root.children.length;
    const bark = this.mat('bark', { color: 0x2a2018, roughness: 1 }), leaf = this.mat('leaf', { color: 0x1c2a16, roughness: 1 });
    const h = 3 + size * 0.6, t = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, h, 7), bark); t.position.set(x, h / 2, z); this.root.add(t);
    for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 + size * 0.25, 1), leaf); b.position.set(x + (this.R() - 0.5) * size * 0.6, h + (this.R() - 0.3) * 1.2, z + (this.R() - 0.5) * size * 0.6); b.castShadow = true; this.root.add(b); }
    this.boxes.push({ x0: x - 0.25, x1: x + 0.25, z0: z - 0.25, z1: z + 0.25, y0: 0, y1: h, see: true });
    { const fy = this.heightAt(x, z); if (fy) for (let k = n0; k < this.root.children.length; k++) this.root.children[k].position.y += fy; }
  }

  // ================================================================ streets
  // tenement blocks on a grid of alleys; variants for alleys, slums, back streets
  buildStreets() {
    const B = this.B, v = this.def.variant || 'alleys', R = seeded(100 + this.idx);
    this.ground(T.asphalt, 20, 14, { roughness: 0.85 });
    const wallM = this.mat('wall', brickMat(0x9a958e));
    this.perimeter(7, wallM);
    // blocks: a grid with gaps of varying width for streets and alleys
    const xs = [B.x0 + 6, -14, 2, 18], zs = [B.z0 + 5, -4, 9];
    for (const x of xs) for (const z of zs) {
      if (R() < 0.18) continue; // an empty lot
      const w = 8 + R() * 4, d = 5 + R() * 3, h = 7 + Math.floor(R() * 3) * 3.6;
      if (x + w > B.x1 - 3 || z + d > B.z1 - 2) continue;
      this.building(x, x + w, z, z + d, h, R() < 0.5 ? 's' : 'n');
      if (R() < 0.6) this.prop(R() < 0.5 ? 'dumpster' : 'trash', x + w + 1.2, z + d * R(), Math.PI / 2);
    }
    if (v === 'slums') { for (let k = 0; k < 6; k++) this.fence(-30 + k * 10, B.z1 - 6, -26 + k * 10, B.z1 - 6); for (let k = 0; k < 4; k++) this.prop('mattress', -20 + k * 12, B.z1 - 3, R()); }
    if (v === 'traffic') { for (let k = 0; k < 9; k++) this.prop(R() < 0.25 ? 'van' : 'car', B.x0 + 8 + R() * (B.x1 - B.x0 - 16), B.z0 + 4 + R() * (B.z1 - B.z0 - 8), R() * 6); }
    for (let k = 0; k < 8; k++) this.graffiti(B.x0 + 0.06, 2.4, B.z0 + 4 + k * 5, Math.PI / 2, 3, k);
    this.fire(-6, 1); this.fire(20, -10);
    for (const [x, z, i] of [[-24, 2, 1.0], [-6, -10, 0.9], [10, 4, 1.0], [26, 12, 0.0]]) this.lamp(x, z, { i, real: i > 0, flicker: R() < 0.4 ? 1 : 0 });
    this.lamp(B.x1 - 2, 3, { h: 4.2, r: 6, i: 0.5, col: 0xff3a2a, arm: 'none' });
    this.startRoom(B.x0 + 1, B.z1 - 6, 4, 3, wallM);
    this.finish(200 + this.idx, this.def.hunters || 6);
  }

  // =============================================================== railyard
  buildRailyard() {
    const B = this.B, R = seeded(300 + this.idx);
    this.ground(T.gravel, 22, 14, { roughness: 1, color: 0x8a8070 });
    const corr = this.mat('corr', { map: rep(T.corrugated.map, 1, 1), roughness: 0.6, metalness: 0.5, color: 0x9a9a98 });
    this.perimeter(4, corr);
    const rail = this.mat('rail', { color: 0x5a524a, metalness: 0.8, roughness: 0.5 }), sleeper = this.mat('sleeper', { color: 0x3a2c20, roughness: 1 });
    for (const z of [-12, -4, 4, 12]) {
      for (const dz of [-0.72, 0.72]) { const r = new THREE.Mesh(new THREE.BoxGeometry(B.x1 - B.x0, 0.12, 0.08), rail); r.position.set(0, 0.06, z + dz); this.root.add(r); }
      for (let x = B.x0; x < B.x1; x += 0.8) { const sl = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.06, 2.2), sleeper); sl.position.set(x, 0.02, z); this.root.add(sl); }
      // boxcars parked along the track, gaps between them to slip through
      let x = B.x0 + 4 + R() * 6;
      while (x < B.x1 - 14) {
        const len = 10 + R() * 4, col = [0x5a2a1c, 0x3a3a2a, 0x4a3018, 0x2a2a2a][Math.floor(R() * 4)];
        if (R() < 0.75) { this.box(x, x + len, z - 1.4, z + 1.4, 0.4, 3.6, this.mat('boxcar' + col, { map: rep(T.corrugated.map, 1, 1), color: col, metalness: 0.4, roughness: 0.7 })); this.box(x + 1, x + len - 1, z - 1.2, z + 1.2, 0, 0.4, rail, { solid: false }); }
        x += len + 3 + R() * 5;
      }
    }
    // a signal box and a platform
    this.box(B.x0 + 14, B.x0 + 20, B.z1 - 6, B.z1 - 1, 0, 3.4, this.mat('wall', {}));
    this.box(-10, 20, B.z0 + 1, B.z0 + 3.5, 0, 1.0, this.mat('platform', { color: 0x6a665e, roughness: 0.9 }));
    this.fire(-20, 8); this.fire(14, -8);
    for (const [x, z, i] of [[-16, -8, 1.0], [6, 0, 0.0], [24, 8, 1.0], [-4, 16, 0.8]]) this.lamp(x, z, { i, real: i > 0, flicker: R() < 0.3 ? 1 : 0, h: 7, r: 13 });
    this.lamp(B.x1 - 2, 3, { h: 4.2, r: 6, i: 0.5, col: 0xff3a2a, arm: 'none' });
    this.startRoom(B.x0 + 1, B.z1 - 5, 3, 3, corr);
    this.finish(400 + this.idx, this.def.hunters || 6);
  }

  // ==================================================================== zoo
  buildZoo() {
    const B = this.B, R = seeded(500 + this.idx), indoor = this.def.variant === 'house';
    this.ground(indoor ? T.slab : T.concrete, 20, 14, { roughness: 0.9, color: indoor ? 0x8a8a7a : 0x7a7a6a });
    const wallM = this.mat('zoowall', brickMat(0xa89a80));
    this.perimeter(indoor ? 5 : 4, wallM);
    if (indoor) this.ceiling(5, 0x14140f);
    const bars = this.mat('bars', { color: 0x4a4440, metalness: 0.8, roughness: 0.5 });
    // enclosures: low walls with bar fronts (you see through them, you don't walk through)
    const pens = indoor ? [[-26, -14], [-12, -14], [2, -14], [16, -14], [-26, 6], [-12, 6], [2, 6], [16, 6]] : [[-28, -16], [-10, -16], [8, -16], [-28, 6], [-10, 6], [8, 6], [22, -4]];
    for (const [x, z] of pens) {
      const w = indoor ? 10 : 12, d = indoor ? 7 : 9;
      if (x + w > B.x1 - 2) continue;
      this.box(x, x + w, z, z + 0.3, 0, 1.0, wallM); this.box(x, x + 0.3, z, z + d, 0, 3, wallM); this.box(x + w - 0.3, x + w, z, z + d, 0, 3, wallM); this.box(x, x + w / 2 - 1, z + d - 0.3, z + d, 0, 3, wallM); this.box(x + w / 2 + 1, x + w, z + d - 0.3, z + d, 0, 3, wallM); // keeper's door
      this.box(x + 0.3, x + w - 0.3, z, z + 0.3, 1.0, 3.2, bars, { see: false });
      for (let bx = x + 0.6; bx < x + w - 0.3; bx += 0.3) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.2, 5), bars); b.position.set(bx, 2.1, z + 0.15); this.root.add(b); }
      // the occupants are long gone: straw, bones, a trough
      this.prop('mattress', x + w / 2, z + d / 2, R()); this.prop('trash', x + 2, z + d - 2);
    }
    if (!indoor) { for (let k = 0; k < 10; k++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 4, 6), this.mat('trunk', { color: 0x3a2a1c, roughness: 1 })); const x = B.x0 + 4 + R() * (B.x1 - B.x0 - 8), z = -1 + (R() - 0.5) * 6; t.position.set(x, 2, z); this.root.add(t); const crown = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), this.mat('leaves', { color: 0x1e2a16, roughness: 1 })); crown.position.set(x, 4.4, z); this.root.add(crown); this.boxes.push({ x0: x - 0.3, x1: x + 0.3, z0: z - 0.3, z1: z + 0.3, y0: 0, y1: 4, see: true }); } }
    this.fire(-4, -2);
    for (const [x, z, i] of [[-20, -2, 0.9], [0, 3, 1.0], [20, -2, 0.0], [12, 16, 0.8]]) this.lamp(x, z, { i, real: i > 0, flicker: R() < 0.4 ? 1 : 0, arm: indoor ? 'none' : 'pole', h: indoor ? 4.6 : 5.2 });
    this.lamp(B.x1 - 2, 3, { h: 4.2, r: 6, i: 0.5, col: 0xff3a2a, arm: 'none' });
    this.startRoom(B.x0 + 1, -1.5, 3, 3, wallM);
    this.finish(600 + this.idx, this.def.hunters || 7);
  }

  // ============================================================== graveyard
  buildGraveyard() {
    const B = this.B, R = seeded(700 + this.idx);
    this.ground(T.gravel, 20, 14, { roughness: 1, color: 0x5a6048 });
    const stone = this.mat('stone', { map: rep(T.concrete.map, 1, 1), color: 0x7a7a72, roughness: 1 });
    this.perimeter(3.2, stone);
    // rows of headstones (low: cover when crouched), a few big crypts and statues
    for (let z = B.z0 + 4; z < B.z1 - 4; z += 3.2) for (let x = B.x0 + 6; x < B.x1 - 6; x += 2.4) {
      if (Math.abs(z) < 2.5 || R() < 0.25) continue;
      const h = 0.7 + R() * 0.7; this.box(x - 0.35, x + 0.35, z - 0.1, z + 0.1, 0, h, stone);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.2, 10, 1, false, 0, Math.PI), stone); t.rotation.x = Math.PI / 2; t.rotation.z = Math.PI / 2; t.position.set(x, h, z); this.root.add(t);
    }
    for (const [x, z] of [[-24, -12], [-6, 12], [12, -14], [24, 10]]) { this.box(x - 2.5, x + 2.5, z - 2, z + 2, 0, 3.2, stone); const roof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.4, 4), stone); roof.rotation.y = Math.PI / 4; roof.position.set(x, 3.9, z); this.root.add(roof); }
    for (let k = 0; k < 8; k++) { const x = B.x0 + 4 + R() * (B.x1 - B.x0 - 8), z = (R() - 0.5) * 3; const t = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 5, 5), this.mat('deadtree', { color: 0x2a221a })); t.position.set(x, 2.5, z + (R() < 0.5 ? 6 : -6)); this.root.add(t); }
    this.fire(0, 0);
    for (const [x, z, i] of [[-16, 0, 0.7], [16, 0, 0.8]]) this.lamp(x, z, { i, flicker: 1 });
    this.lamp(B.x1 - 2, 3, { h: 4.2, r: 6, i: 0.5, col: 0xff3a2a, arm: 'none' });
    this.startRoom(B.x0 + 1, -1.5, 3, 3, stone);
    this.finish(800 + this.idx, this.def.hunters || 7);
  }

  // ================================================================ prison
  buildPrison() {
    const B = this.B, R = seeded(900 + this.idx), yard = this.def.variant === 'yard';
    this.ground(yard ? T.asphalt : T.slab, 20, 14, { color: yard ? 0x8a8a84 : 0x9a9a90, roughness: 0.7 });
    const wallM = this.mat('pwall', { map: rep(T.concrete.map, 1, 1), color: 0x9a9890, roughness: 0.9 });
    this.perimeter(yard ? 6 : 4, wallM);
    if (!yard) {
      this.ceiling(4, 0x22221e);
      // tiers of cells on both sides of a long hall, bars for fronts
      const bars = this.mat('bars', { color: 0x4a4440, metalness: 0.8, roughness: 0.5 });
      for (const side of [-1, 1]) for (let x = B.x0 + 2; x < B.x1 - 6; x += 3.5) {
        const zf = 4 * side, zb = (B.z1 - 1) * side;
        this.box(x, x + 0.2, Math.min(zf, zb), Math.max(zf, zb), 0, 4, wallM);
        const zz = side > 0 ? [zf, zf + 0.15] : [zf - 0.15, zf];
        if (R() < 0.7) this.box(x + 0.2, x + 3.5, zz[0], zz[1], 0, 3, bars, { see: false }); else { this.box(x + 0.2, x + 1.2, zz[0], zz[1], 0, 3, bars, { see: false }); this.box(x + 2.4, x + 3.5, zz[0], zz[1], 0, 3, bars, { see: false }); }
        for (let bx = x + 0.4; bx < x + 3.5; bx += 0.25) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 3, 5), bars); b.position.set(bx, 1.5, zf); this.root.add(b); }
        this.prop('mattress', x + 1.7, zf + 2.4 * side, 0);
      }
      for (const [x, i] of [[-20, 0.7], [-4, 0.0], [12, 0.7]]) this.lamp(x, 0, { h: 3.6, r: 7, i, real: i > 0, arm: 'none', col: 0xf0ecd8, flicker: R() < 0.5 ? 1 : 0 });
    } else {
      // the exercise yard: fences, bleachers, a guard tower with a searchlight
      this.fence(-20, -6, -20, 10); this.fence(0, -14, 0, 4); this.fence(16, -6, 16, 14);
      this.box(-12, -4, 10, 13, 0, 1.2, this.mat('bleach', { color: 0x5a5a54, metalness: 0.5 }));
      this.box(22, 26, -16, -12, 0, 7, wallM);
      this.lamp(24, -14, { h: 8, r: 16, i: 1.3, col: 0xf8f8f0, arm: 'none', flicker: 3 });
      this.lamp(-24, 6, { h: 6, r: 10, i: 0.8 }); this.lamp(6, 12, { h: 6, r: 10, i: 0.0, real: false }); this.fire(-8, -8);
    }
    this.lamp(B.x1 - 2, 3, { h: 3.6, r: 6, i: 0.5, col: 0xff3a2a, arm: 'none' });
    this.startRoom(B.x0 + 1, -1.5, 3, 3, wallM);
    this.finish(1000 + this.idx, this.def.hunters || 7);
  }

  // ========================================================= offices / studio
  buildOffices() {
    const B = this.B, R = seeded(1100 + this.idx);
    this.ground(T.slab, 20, 14, { color: 0x6a645a, roughness: 0.6 });
    this.ceiling(3.4, 0x2a2824);
    const wallM = this.mat('owall', { color: 0x8a8478, roughness: 0.9 }), desk = this.mat('desk', { color: 0x4a3a2a, roughness: 0.6 });
    this.perimeter(3.4, wallM);
    // a grid of offices off corridors; cubicles in the open-plan bits; a broadcast studio
    for (let x = B.x0 + 4; x < B.x1 - 8; x += 9) for (const z of [B.z0 + 1, 6]) {
      const w = 7, d = 7; if (R() < 0.2) continue;
      this.box(x, x + w, z, z + 0.15, 0, 3.4, wallM); this.box(x, x + 0.15, z, z + d, 0, 3.4, wallM); this.box(x + w - 0.15, x + w, z, z + d, 0, 3.4, wallM);
      this.box(x, x + 2.5, z + d - 0.15, z + d, 0, 3.4, wallM); this.box(x + 4, x + w, z + d - 0.15, z + d, 0, 3.4, wallM);
      this.box(x + 1.5, x + 4, z + 2, z + 3, 0, 0.75, desk); this.prop('crate', x + 5.5, z + 1.5, R());
    }
    for (let x = -12; x < 12; x += 4) for (let z = -5; z < 3; z += 3) this.box(x, x + 0.08, z, z + 2, 0, 1.4, this.mat('cube', { color: 0x5a564e, roughness: 1 }));
    this.lamp(-18, 0, { h: 3.2, r: 7, i: 0.7, arm: 'none', col: 0xf0f0e0, flicker: 1 }); this.lamp(4, -2, { h: 3.2, r: 7, i: 0.6, arm: 'none', col: 0xf0f0e0 });
    this.lamp(18, 10, { h: 3.2, r: 6, i: 0.8, arm: 'none', col: 0xffe8c0 }); this.lamp(-10, 12, { h: 3.2, r: 6, i: 0.0, real: false, arm: 'none' });
    this.lamp(B.x1 - 2, 3, { h: 3.2, r: 6, i: 0.5, col: 0xff3a2a, arm: 'none' });
    this.startRoom(B.x0 + 1, -1.5, 3, 3, wallM);
    this.finish(1200 + this.idx, this.def.hunters || 7);
  }

  // ================================================================== docks
  buildDocks() {
    const B = this.B, R = seeded(1300 + this.idx);
    this.ground(T.concrete, 22, 16, { roughness: 0.9, color: 0x6a6a64 });
    const corr = this.mat('corr', { map: rep(T.corrugated.map, 1, 1), roughness: 0.6, metalness: 0.5, color: 0x9a9a98 });
    this.perimeter(4, corr, 'e');
    // the quay: black water along the south edge
    const water = new THREE.Mesh(new THREE.PlaneGeometry(B.x1 - B.x0, 6), this.mat('water', { color: 0x050806, roughness: 0.05, metalness: 0.6 })); water.rotation.x = -Math.PI / 2; water.position.set(0, 0.02, B.z1 - 3); this.root.add(water);
    this.boxes.push({ x0: B.x0, x1: B.x1, z0: B.z1 - 6, z1: B.z1, y0: 0, y1: 1, see: true });
    const cols = [0x5a2a1c, 0x3a4a2a, 0x6a5a2a, 0x4a1a1a, 0x2a2a2a];
    for (let k = 0; k < 16; k++) { const x = B.x0 + 6 + (k % 4) * 15 + R() * 3, z = B.z0 + 5 + Math.floor(k / 4) * 8; if (R() < 0.15) continue; const col = cols[k % 5]; this.box(x - 3, x + 3, z - 1.25, z + 1.25, 0, 2.6, this.mat('cont' + col, { map: rep(T.corrugated.map, 1, 1), color: col, roughness: 0.6, metalness: 0.4 })); if (R() < 0.4) this.box(x - 3, x + 3, z - 1.25, z + 1.25, 2.6, 5.2, this.mat('cont' + col)); }
    this.box(-4, 8, B.z1 - 12, B.z1 - 7, 0, 6, corr); // a warehouse on the quay
    for (const [x, z, i] of [[-24, 0, 1.1], [0, -12, 0.0], [20, 2, 1.0], [-8, 10, 0.8]]) this.lamp(x, z, { i, real: i > 0, h: 8, r: 14 });
    this.fire(12, -14);
    this.lamp(B.x1 - 2, 3, { h: 4.2, r: 6, i: 0.5, col: 0xff3a2a, arm: 'none' });
    this.startRoom(B.x0 + 1, -1.5, 3, 3, corr);
    this.finish(1400 + this.idx, this.def.hunters || 8);
  }

  // =========================================================== estate grounds
  buildEstate() {
    const B = this.B, R = seeded(1500 + this.idx);
    this.ground(T.gravel, 20, 14, { roughness: 1, color: 0x3a4a2a });
    const hedge = this.mat('hedge', { color: 0x1a2a14, roughness: 1 }), stone = this.mat('stone', { map: rep(T.concrete.map, 1, 1), color: 0x8a8478, roughness: 1 });
    this.perimeter(3.5, stone);
    // a hedge maze garden: hedges you can't see over, gravel paths, statues and a fountain
    for (let x = B.x0 + 6; x < B.x1 - 6; x += 6) for (let z = B.z0 + 5; z < B.z1 - 5; z += 6) {
      if (R() < 0.35) continue;
      if (R() < 0.5) this.box(x, x + 5, z, z + 0.8, 0, 2.4, hedge); else this.box(x, x + 0.8, z, z + 5, 0, 2.4, hedge);
    }
    this.box(-2, 2, -2, 2, 0, 0.8, stone);
    for (const [x, z] of [[-14, 8], [14, -8], [-20, -14], [20, 14]]) { this.box(x - 0.5, x + 0.5, z - 0.5, z + 0.5, 0, 1.2, stone); const st = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1, 4, 8), stone); st.position.set(x, 2.2, z); this.root.add(st); }
    for (const [x, z, i] of [[-18, 0, 0.8], [0, 10, 0.9], [18, -4, 0.8], [6, -14, 0.0]]) this.lamp(x, z, { i, real: i > 0, h: 3.6, r: 9, col: 0xffd8a0 });
    this.lamp(B.x1 - 2, 3, { h: 4.2, r: 6, i: 0.5, col: 0xff3a2a, arm: 'none' });
    this.startRoom(B.x0 + 1, -1.5, 3, 3, stone);
    this.finish(1600 + this.idx, this.def.hunters || 8);
  }

  // ================================================================ mansion
  buildMansion() {
    const B = this.B, R = seeded(1700 + this.idx);
    const boards = this.texMat('mboards', { map: T.wood.map }, 16, 10, { roughness: 0.6, color: 0x6a4a30 });
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(B.x1 - B.x0, B.z1 - B.z0), boards); fl.rotation.x = -Math.PI / 2; this.root.add(fl);
    this.ceiling(4, 0x1a120c);
    const wallM = this.mat('mwall', { color: 0x4a2a22, roughness: 0.9 }), trim = this.mat('trim', { color: 0x2a1a12, roughness: 0.5 });
    this.perimeter(4, wallM);
    // rooms off a grand hall: library shelves, dining table, a gallery of screens
    for (let x = B.x0 + 2; x < B.x1 - 8; x += 10) for (const side of [-1, 1]) {
      const zf = 4 * side, zb = (B.z1 - 1) * side;
      this.box(x, x + 0.25, Math.min(zf, zb), Math.max(zf, zb), 0, 4, wallM);
      const zz = side > 0 ? [zf, zf + 0.25] : [zf - 0.25, zf];
      this.box(x + 0.25, x + 3.5, zz[0], zz[1], 0, 4, wallM); this.box(x + 6, x + 10, zz[0], zz[1], 0, 4, wallM);
      this.box(x + 3.5, x + 6, zz[0], zz[1], 3, 4, trim, { solid: false });
      const zin = zf + 3 * side;
      if (R() < 0.5) this.box(x + 1.5, x + 8.5, Math.min(zin, zin + 1.2 * side), Math.max(zin, zin + 1.2 * side), 0, 0.8, trim); else this.box(x + 1, x + 1.6, Math.min(zf + 1, zb - side), Math.max(zf + 1, zb - side), 0, 3, this.mat('books', { color: 0x3a2018, roughness: 0.8 }));
    }
    for (const [x, i] of [[-14, 0.7], [0, 0.8], [14, 0.6]]) this.lamp(x, 0, { h: 3.6, r: 7, i, arm: 'none', col: 0xffd8a0, flicker: R() < 0.3 ? 2 : 0 });
    this.lamp(B.x1 - 2, 3, { h: 3.6, r: 6, i: 0.5, col: 0xff3a2a, arm: 'none' });
    this.startRoom(B.x0 + 1, -1.5, 3, 3, wallM);
    this.finish(1800 + this.idx, this.def.hunters || 8);
  }

  // -------------------------------------------------------------- queries
  // does the segment a->b (3D) clear every sight-blocking box?
  // floor height (m) at a point; flat unless a scene's set gives zones and ramps (planlevel.js)
  heightAt(x, z) { return this.hf ? this.hf(x, z) : 0; }
  // spatial index over the walls: 4 m buckets, rebuilt whenever the list changes
  index() {
    if (this.idxVer === this.boxes.ver && this.hidx) return;
    const m = new Map(); this.stamp = this.stamp || 1;
    for (const q of this.boxes) for (let j = Math.floor(q.z0 / HC); j <= Math.floor(q.z1 / HC); j++) for (let i = Math.floor(q.x0 / HC); i <= Math.floor(q.x1 / HC); i++) { const k = i * 73856093 ^ j * 19349663; let a = m.get(k); if (!a) m.set(k, a = []); a.push(q); }
    this.hidx = m; this.idxVer = this.boxes.ver;
  }
  // walls whose buckets overlap the rectangle (each once)
  near(x0, z0, x1, z1) {
    this.index(); const out = [], st = ++this.stamp;
    for (let j = Math.floor(Math.min(z0, z1) / HC); j <= Math.floor(Math.max(z0, z1) / HC); j++) for (let i = Math.floor(Math.min(x0, x1) / HC); i <= Math.floor(Math.max(x0, x1) / HC); i++) {
      const a = this.hidx.get(i * 73856093 ^ j * 19349663); if (!a) continue;
      for (const q of a) if (q._st !== st) { q._st = st; out.push(q); }
    }
    return out;
  }
  clear(a, b, forSight = true) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    for (const q of this.near(a.x, a.z, b.x, b.z)) {
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
    for (let it = 0; it < 2; it++) for (const q of this.near(p.x - r, p.z - r, p.x + r, p.z + r)) {
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
    const E = this.exitZone;
    if (this.gateOpen && E && p.x > E.x0 - 1 && p.x < E.x1 + 1 && p.z > E.z0 - 1 && p.z < E.z1 + 1) return p;
    p.x = Math.max(this.B.x0 + r, Math.min(this.B.x1 - r, p.x));
    p.z = Math.max(this.B.z0 + r, Math.min(this.B.z1 - r, p.z));
    return p;
  }

  // ------------------------------------------------------------ light grid
  bakeLight() {
    const B = this.B, nx = Math.ceil((B.x1 - B.x0) / CELL), nz = Math.ceil((B.z1 - B.z0) / CELL);
    this.lnx = nx; this.lnz = nz;
    this.lgrid = this.lamps.map(() => new Float32Array(nx * nz));
    const a = new V(), b = new V();
    this.lamps.forEach((L, li) => {
      const g = this.lgrid[li];
      if (L.base <= 0) return;
      const i0 = Math.max(0, Math.floor((L.p.x - L.r - B.x0) / CELL)), i1 = Math.min(nx - 1, Math.ceil((L.p.x + L.r - B.x0) / CELL));
      const j0 = Math.max(0, Math.floor((L.p.z - L.r - B.z0) / CELL)), j1 = Math.min(nz - 1, Math.ceil((L.p.z + L.r - B.z0) / CELL));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        b.set(B.x0 + (i + 0.5) * CELL, 1.0, B.z0 + (j + 0.5) * CELL); b.y += this.heightAt(b.x, b.z);
        const d = b.distanceTo(L.p); if (d > L.r) continue;
        a.copy(L.p).y -= 0.25;
        if (!this.clear(a, b)) continue;
        const f = 1 - d / L.r; g[j * nx + i] = f * f;
      }
    });
  }
  // 0 = pitch black, ~1 = standing under a lamp
  lightAt(p) {
    const B = this.B, i = Math.floor((p.x - B.x0) / CELL), j = Math.floor((p.z - B.z0) / CELL);
    if (i < 0 || j < 0 || i >= this.lnx || j >= this.lnz) return 0.05;
    let s = 0.04; const k = j * this.lnx + i;
    this.lamps.forEach((L, li) => { s += this.lgrid[li][k] * L.base * L.on; });
    return Math.min(1.2, s);
  }

  // ------------------------------------------------------------- walk grid
  bakeWalk() {
    const B = this.B, nx = this.lnx, nz = this.lnz, r0 = 0.35;
    this.walk = new Uint8Array(nx * nz).fill(1);
    if (this.planVoid) for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (this.planVoid(B.x0 + (i + 0.5) * CELL, B.z0 + (j + 0.5) * CELL)) this.walk[j * nx + i] = 0; // off the map plan
    for (const q of this.boxes) { // rasterise each wall's footprint (grown by the walker's radius)
      if (q.y1 < 0.35) continue;
      const r = q.plan ? 0.08 : r0;
      const i0 = Math.max(0, Math.ceil((q.x0 - r - B.x0) / CELL - 0.5)), i1 = Math.min(nx - 1, Math.floor((q.x1 + r - B.x0) / CELL - 0.5));
      const j0 = Math.max(0, Math.ceil((q.z0 - r - B.z0) / CELL - 0.5)), j1 = Math.min(nz - 1, Math.floor((q.z1 + r - B.z0) / CELL - 0.5));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = B.x0 + (i + 0.5) * CELL, z = B.z0 + (j + 0.5) * CELL;
        if (x > q.x0 - r && x < q.x1 + r && z > q.z0 - r && z < q.z1 + r) this.walk[j * nx + i] = 0;
      }
    }
  }
  cellOf(x, z) { return [Math.floor((x - this.B.x0) / CELL), Math.floor((z - this.B.z0) / CELL)]; }
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
    const pts = cells.map((k) => [this.B.x0 + ((k % nx) + 0.5) * CELL, this.B.z0 + (((k / nx) | 0) + 0.5) * CELL]);
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

  // ---- the exit gate (chained shut until the Director opens it) and the start door
  makeGate(cx, cz, alongZ, w = 6, face = -1) {
    const g = new THREE.Group(); g.position.set(cx, this.heightAt(cx, cz), cz); if (!alongZ) g.rotation.y = Math.PI / 2;
    const bars = this.mat('bars', { color: 0x4a4440, metalness: 0.8, roughness: 0.5 });
    for (let z = -w / 2 + 0.2; z <= w / 2 - 0.2; z += 0.25) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 4, 5), bars); b.position.set(0, 2, z); g.add(b); }
    for (const y of [0.3, 2, 3.8]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, w), bars); r.position.y = y; g.add(r); }
    this.chain = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 6, 14), this.mat('chainlock', { color: 0x9a9a9a, metalness: 0.9, roughness: 0.3 }));
    this.chain.position.set(0.1 * face, 1.2, 0); this.chain.rotation.y = Math.PI / 2; g.add(this.chain);
    this.exitSign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({ map: T.exit, color: 0x333333 }));
    this.exitSign.position.set(0.45 * face, 4.4, 0); this.exitSign.rotation.y = face < 0 ? -Math.PI / 2 : Math.PI / 2; g.add(this.exitSign);
    this.root.add(g); this.gate = g; this.gateAlongZ = alongZ;
    const hw = w / 2;
    this.gateBox = alongZ ? { x0: cx - 0.6, x1: cx + 0.5, z0: cz - hw, z1: cz + hw, y0: 0, y1: 4, see: false } : { x0: cx - hw, x1: cx + hw, z0: cz - 0.6, z1: cz + 0.5, y0: 0, y1: 4, see: false };
    this.boxes.push(this.gateBox);
    // walking through the open gate (toward the outside) ends the scene
    this.exitZone = alongZ ? (face < 0 ? { x0: cx, x1: cx + 6, z0: cz - hw, z1: cz + hw } : { x0: cx - 6, x1: cx, z0: cz - hw, z1: cz + hw })
      : (face < 0 ? { x0: cx - hw, x1: cx + hw, z0: cz, z1: cz + 6 } : { x0: cx - hw, x1: cx + hw, z0: cz - 6, z1: cz });
  }
  openGate() {
    this.gateOpen = true;
    const i = this.boxes.indexOf(this.gateBox); if (i >= 0) this.boxes.splice(i, 1);
    this.chain.visible = false; this.exitSign.material.color.set(0xffffff);
  }
  closeGate() { this.gateOpen = false; if (!this.boxes.includes(this.gateBox)) this.boxes.push(this.gateBox); this.chain.visible = true; this.exitSign.material.color.set(0x333333); }
  // through the gate and at least 0.8 m past it
  atExit(p) {
    const E = this.exitZone, g = this.gate.position; if (!this.gateOpen || !E) return false;
    if (p.x < E.x0 || p.x > E.x1 || p.z < E.z0 || p.z > E.z1) return false;
    return (this.gateAlongZ ? Math.abs(p.x - g.x) : Math.abs(p.z - g.z)) > 0.8;
  }
  makeStartDoor(x, z, alongZ, w = 4) { // a chain-link door that swings open when the Director says so
    const pv = new THREE.Group(); pv.position.set(x, 0, z); if (!alongZ) pv.rotation.y = -Math.PI / 2;
    const t = T.chain.clone(); t.needsUpdate = true; t.repeat.set(w / 0.6, 3 / 0.6);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(w, 3), new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, metalness: 0.7, roughness: 0.5 }));
    door.position.set(0, 1.5, w / 2); door.rotation.y = Math.PI / 2; pv.add(door);
    const frame = this.mat('post', { color: 0x777a7c, metalness: 0.7, roughness: 0.4 });
    for (const zz of [0.05, w - 0.05]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 3, 6), frame); p.position.set(0, 1.5, zz); pv.add(p); }
    this.root.add(pv); this.startDoor = pv; this.startBaseYaw = pv.rotation.y;
    this.startBox = alongZ ? { x0: x - 0.08, x1: x + 0.08, z0: z, z1: z + w, y0: 0, y1: 3, see: false } : { x0: x, x1: x + w, z0: z - 0.08, z1: z + 0.08, y0: 0, y1: 3, see: false };
    this.boxes.push(this.startBox);
  }
  openStart() { if (this.startOpen || !this.startBox) return false; this.startOpen = true; const i = this.boxes.indexOf(this.startBox); if (i >= 0) this.boxes.splice(i, 1); this.bakeWalk(); this.startSwing = 0; return true; }
  closeStart() { if (!this.startBox) return; this.startOpen = false; this.startSwing = 0; this.startDoor.rotation.y = this.startBaseYaw; if (!this.boxes.includes(this.startBox)) this.boxes.push(this.startBox); this.bakeWalk(); }
  dispose() { this.scene.remove(this.root); this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }

  update(t, dt) {
    if (this.startOpen && this.startSwing < 1) { this.startSwing = Math.min(1, this.startSwing + dt * 0.6); this.startDoor.rotation.y = this.startBaseYaw - this.startSwing * 1.6; }
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

// brick walls: colour, normal and roughness maps from paint.js
function brickMat(color = 0xffffff) { return { map: rep(T.brick.map, 1, 1), normalMap: rep(T.brick.normal, 1, 1), normalScale: new THREE.Vector2(1, 1), roughnessMap: rep(T.brick.rough, 1, 1), roughness: 1, color }; }
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

// ------------------------------------------------------------------ scenes
export const SCENES = [
  { id: 'born-again', title: 'BORN AGAIN', area: 'Carcer Market', build: 'buildPlan', plan: 'born-again', style: 'street', B: { x0: -36, x1: 36, z0: -26, z1: 26 }, gang: 'hoods', fog: 0.042 },
  { id: 'doorway', title: 'DOORWAY INTO HELL', area: 'Carcer Market', build: 'buildPlan', plan: 'doorway', style: 'ruins', variant: 'alleys', B: { x0: -36, x1: 36, z0: -24, z1: 24 }, gang: 'hoods', fog: 0.045, hunters: 6 },
  { id: 'road-to-ruin', title: 'ROAD TO RUIN', area: 'Carcer Market', build: 'buildPlan', plan: 'doorway', style: 'ruins', B: { x0: -36, x1: 36, z0: -24, z1: 24 }, gang: 'hoods', fog: 0.045, hunters: 7 },
  { id: 'white-trash', title: 'WHITE TRASH', area: 'Dentons City Junkyard', build: 'buildPlan', plan: 'white-trash', style: 'yard', B: { x0: -38, x1: 38, z0: -28, z1: 28 }, gang: 'skinz', fog: 0.045 },
  { id: 'fuelled', title: 'FUELLED BY HATE', area: 'Dentons City Junkyard', build: 'buildPlan', plan: 'fuelled', style: 'mall', B: { x0: -30, x1: 30, z0: -20, z1: 20 }, gang: 'skinz', fog: 0.05, amb: 0.75 },
  { id: 'grounds', title: 'GROUNDS FOR ASSAULT', area: 'Carcer City Zoo', build: 'buildPlan', plan: 'grounds', style: 'zoo', B: { x0: -38, x1: 38, z0: -24, z1: 24 }, gang: 'wardogs', fog: 0.045, hunters: 7 },
  { id: 'strapped', title: 'STRAPPED FOR CASH', area: 'Carcer City Zoo', build: 'buildPlan', plan: 'strapped', style: 'zoo', variant: 'house', B: { x0: -32, x1: 32, z0: -18, z1: 18 }, gang: 'wardogs', fog: 0.055, amb: 0.65, hunters: 7 },
  { id: 'innocence', title: 'VIEW OF INNOCENCE', area: 'East Los Ablos', build: 'buildStreets', variant: 'slums', B: { x0: -36, x1: 36, z0: -24, z1: 24 }, gang: 'innocentz', fog: 0.045, hunters: 7 },
  { id: 'drunk-driving', title: 'DRUNK DRIVING', area: 'East Los Ablos', build: 'buildPlan', plan: 'drunk-driving', style: 'street', variant: 'traffic', B: { x0: -38, x1: 38, z0: -24, z1: 24 }, gang: 'innocentz', fog: 0.045, hunters: 7 },
  { id: 'graveyard', title: 'GRAVEYARD SHIFT', area: 'East Los Ablos', build: 'buildGraveyard', planWip: 'graveyard', style: 'cemetery', B: { x0: -34, x1: 34, z0: -22, z1: 22 }, gang: 'innocentz', fog: 0.05, hunters: 8 },
  { id: 'madness', title: 'MOUTH OF MADNESS', area: 'Darkwoods Penitentiary', build: 'buildAsylum', planWip: 'madness', style: 'asylum', B: { x0: -28, x1: 28, z0: -18, z1: 18 }, gang: 'smileys', fog: 0.06, amb: 0.65 },
  { id: 'doing-time', title: 'DOING TIME', area: 'Darkwoods Penitentiary', build: 'buildPrison', B: { x0: -34, x1: 34, z0: -16, z1: 16 }, gang: 'smileys', fog: 0.055, amb: 0.6, hunters: 7 },
  { id: 'rabbit', title: 'KILL THE RABBIT', area: 'Darkwoods Penitentiary', build: 'buildPrison', variant: 'yard', B: { x0: -34, x1: 34, z0: -20, z1: 20 }, gang: 'smileys', fog: 0.045, hunters: 8, rabbit: true },
  { id: 'divided', title: 'DIVIDED THEY FALL', area: 'Darkwoods Penitentiary', build: 'buildPlan', plan: 'divided', style: 'street', B: { x0: -38, x1: 38, z0: -18, z1: 18 }, gang: 'wardogs', fog: 0.055, amb: 0.6, hunters: 8 },
  { id: 'press', title: 'PRESS COVERAGE', area: 'Central', build: 'buildPlan', plan: 'press', style: 'street', B: { x0: -32, x1: 32, z0: -18, z1: 18 }, gang: 'swat', fog: 0.05, amb: 0.7, hunters: 7 },
  { id: 'tracks', title: 'WRONG SIDE OF THE TRACKS', area: 'Central', build: 'buildPlan', plan: 'tracks', style: 'rail', B: { x0: -42, x1: 42, z0: -20, z1: 20 }, gang: 'swat', fog: 0.045, hunters: 8 },
  { id: 'trained', title: 'TRAINED TO KILL', area: 'Carcer Point', build: 'buildDocks', B: { x0: -36, x1: 36, z0: -22, z1: 22 }, gang: 'swat', fog: 0.045, hunters: 9 },
  { id: 'border', title: 'BORDER PATROL', area: 'Wapona Hills', build: 'buildEstate', B: { x0: -34, x1: 34, z0: -22, z1: 22 }, gang: 'cerberus', fog: 0.045, hunters: 8 },
  { id: 'key-personnel', title: 'KEY PERSONNEL', area: 'Wapona Hills', build: 'buildMansion', B: { x0: -34, x1: 34, z0: -16, z1: 16 }, gang: 'cerberus', fog: 0.055, amb: 0.65, hunters: 8 },
  { id: 'deliverance', title: 'DELIVERANCE', area: 'Wapona Hills', build: 'buildAttic', B: { x0: -18, x1: 18, z0: -12, z1: 12 }, gang: 'piggsy', fog: 0.07, amb: 0.6 },
];
