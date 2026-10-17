// grime.js — the filth layer. Runs over any scene after it's built and makes it
// look lived-in and rotten: dirt pooled at the foot of every wall, rust and rain
// streaks, mould, wet stains, litter, oily puddles, light shafts with dust, flies
// over rubbish and corpses, rats, steam, drips, dumped victims, and the sounds
// that go with all of it. Static dressing is merged into a handful of meshes so
// the Quest can draw it cheaply; the moving things are few and small.
import * as THREE from '../vendor/three.module.js';
import { T, seeded } from './paint.js?v=25';
import { Person } from './body.js?v=25';

const V = THREE.Vector3;

// ------------------------------------------------------------------ textures
let TX = null;
function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function textures() {
  if (TX) return TX; const R = seeded(4242);
  // dirt that collects at the foot of walls: black at the bottom, ragged fade upward
  const [a, ag] = canvas(128, 128);
  for (let x = 0; x < 128; x++) { const h = 50 + R() * 50; const gr = ag.createLinearGradient(0, 128, 0, 128 - h); gr.addColorStop(0, 'rgba(10,8,5,0.95)'); gr.addColorStop(0.4, 'rgba(18,14,8,0.55)'); gr.addColorStop(1, 'rgba(20,16,10,0)'); ag.fillStyle = gr; ag.fillRect(x, 0, 1, 128); }
  // wet stain spreading out across the floor from the wall
  const [f, fg] = canvas(128, 64);
  for (let x = 0; x < 128; x++) { const h = 30 + R() * 34; const gr = fg.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(8,7,5,0.85)'); gr.addColorStop(1, 'rgba(8,7,5,0)'); fg.fillStyle = gr; fg.fillRect(x, 0, 1, 64); }
  // streaks: rust and soot running down from ledges
  const [s, sg] = canvas(64, 256);
  for (let k = 0; k < 14; k++) { const x = R() * 64, w = 1 + R() * 6, l = 80 + R() * 176, rust = R() < 0.5; const gr = sg.createLinearGradient(0, 0, 0, l); gr.addColorStop(0, rust ? 'rgba(90,40,14,0.7)' : 'rgba(12,10,8,0.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); sg.fillStyle = gr; sg.fillRect(x, 0, w, l); }
  // mould: green-black blooms
  const [m, mg] = canvas(128);
  for (let k = 0; k < 90; k++) { const x = 64 + (R() - 0.5) * 110, y = 64 + (R() - 0.5) * 90, r = 3 + R() * 16; const gr = mg.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${20 + R() * 25},${34 + R() * 30},${10 + R() * 14},0.8)`); gr.addColorStop(1, 'rgba(20,30,10,0)'); mg.fillStyle = gr; mg.fillRect(x - r, y - r, r * 2, r * 2); }
  // puddle: a ragged blob
  const [p, pg] = canvas(128);
  pg.fillStyle = '#fff'; pg.beginPath(); for (let k = 0; k <= 24; k++) { const an = k / 24 * Math.PI * 2, rr = 44 + R() * 18; k ? pg.lineTo(64 + Math.cos(an) * rr, 64 + Math.sin(an) * rr * 0.7) : pg.moveTo(64 + Math.cos(an) * rr, 64 + Math.sin(an) * rr * 0.7); } pg.fill();
  // litter atlas: 4 x 2 cells of rubbish
  const [l, lg] = canvas(512, 256);
  const cell = (i, f2) => { lg.save(); lg.translate((i % 4) * 128 + 64, Math.floor(i / 4) * 128 + 64); f2(lg); lg.restore(); };
  cell(0, (g) => { g.rotate(0.3); g.fillStyle = '#c8c0a8'; g.fillRect(-46, -34, 92, 68); g.fillStyle = 'rgba(40,40,40,0.6)'; for (let y = -26; y < 28; y += 7) g.fillRect(-40, y, 60 + R() * 20, 2); g.fillStyle = 'rgba(80,60,30,0.4)'; g.beginPath(); g.arc(10, 6, 20, 0, 7); g.fill(); });  // newspaper
  cell(1, (g) => { g.fillStyle = '#8a1818'; g.fillRect(-14, -34, 28, 68); g.fillStyle = '#c8c8c8'; g.fillRect(-14, -34, 28, 6); g.fillStyle = '#e8e0d0'; g.fillRect(-10, -6, 20, 14); });             // crushed can
  cell(2, (g) => { g.fillStyle = '#4a4436'; g.beginPath(); g.ellipse(0, 0, 50, 30, 0.4, 0, 7); g.fill(); g.fillStyle = 'rgba(20,18,12,0.6)'; g.beginPath(); g.ellipse(-8, 6, 30, 14, 0.1, 0, 7); g.fill(); });             // rag
  cell(3, (g) => { for (let k = 0; k < 9; k++) { g.save(); g.rotate(R() * 6); g.fillStyle = '#e8e0cc'; g.fillRect(-2, -14 + k * 2, 4, 14); g.fillStyle = '#c8822c'; g.fillRect(-2, -14 + k * 2, 4, 4); g.restore(); } }); // cigarette butts
  cell(4, (g) => { g.rotate(-0.4); g.fillStyle = '#e8e8e0'; g.fillRect(-4, -40, 8, 60); g.fillStyle = '#c8c8c0'; g.fillRect(-2, 20, 4, 18); g.fillStyle = '#d8b4a0'; g.fillRect(-3, -40, 6, 8); });              // syringe
  cell(5, (g) => { g.fillStyle = '#2a2a24'; g.beginPath(); g.ellipse(0, 0, 54, 40, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.ellipse(-14, -10, 20, 10, 0.4, 0, 7); g.fill(); });  // bin bag
  cell(6, (g) => { g.fillStyle = '#3a6a2a'; g.fillRect(-10, -40, 20, 70); g.fillStyle = 'rgba(20,40,10,0.5)'; g.fillRect(-10, -40, 20, 10); });                                                            // broken bottle
  cell(7, (g) => { g.fillStyle = '#6a5038'; g.fillRect(-40, -30, 80, 60); g.strokeStyle = '#4a3828'; g.lineWidth = 3; g.strokeRect(-40, -30, 80, 60); g.beginPath(); g.moveTo(-40, -30); g.lineTo(40, 30); g.stroke(); }); // flattened box
  // shaft of light: bright at the lamp, gone at the floor
  const [b, bg] = canvas(32, 128); const gr = bg.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); bg.fillStyle = gr; bg.fillRect(0, 0, 32, 128);
  TX = { ao: tex(a), floor: tex(f), streak: tex(s), mould: tex(m), puddle: tex(p, false), litter: tex(l), shaft: tex(b) };
  return TX;
}

// a growing list of quads merged into one BufferGeometry
class Quads {
  constructor() { this.P = []; this.UV = []; this.I = []; }
  // centre c, half-extents along unit vectors u (width) and v (height), uv rect [u0,v0,u1,v1]
  add(c, u, hu, v, hv, uv = [0, 0, 1, 1]) {
    const n = this.P.length / 3;
    for (const [su, sv, tu, tv] of [[-1, -1, uv[0], uv[1]], [1, -1, uv[2], uv[1]], [1, 1, uv[2], uv[3]], [-1, 1, uv[0], uv[3]]]) {
      this.P.push(c.x + u.x * hu * su + v.x * hv * sv, c.y + u.y * hu * su + v.y * hv * sv, c.z + u.z * hu * su + v.z * hv * sv); this.UV.push(tu, tv);
    }
    this.I.push(n, n + 1, n + 2, n, n + 2, n + 3);
  }
  mesh(mat) {
    if (!this.I.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.UV, 2)); g.setIndex(this.I); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.renderOrder = 2; return m;
  }
}
const decal = (o) => Object.assign({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, o);

export class Grime {
  constructor(game) {
    this.game = game; const W = this.W = game.world; this.R = seeded(9000 + W.idx * 31);
    this.root = new THREE.Group(); W.root.add(this.root);
    this.indoor = !!(W.def.amb && W.def.amb > 0.5) || ['buildAttic', 'buildOffices', 'buildMansion'].includes(W.def.build);
    this.flies = []; this.rats = []; this.steam = []; this.drips = []; this.timers = { scream: 20 + this.R() * 30, drip: 1, squeak: 6 };
    const tx = textures();
    this.walls(tx); this.floorDressing(tx); this.shafts(tx); this.dust();
    this.vermin(); this.vents(); this.victims();
  }

  // ---- dirt at the foot of walls, streaks and mould up them, wet stains on the floor
  walls(tx) {
    const R = this.R, ao = new Quads(), fl = new Quads(), st = new Quads(), mo = new Quads(), up = new V(0, 1, 0);
    for (const q of this.W.boxes) {
      const h = q.y1 - q.y0; if (q.y0 > 0.2 || h < 0.7 || !q.see) continue;
      const faces = [[new V((q.x0 + q.x1) / 2, 0, q.z1 + 0.012), new V(1, 0, 0), (q.x1 - q.x0) / 2, new V(0, 0, 1)], [new V((q.x0 + q.x1) / 2, 0, q.z0 - 0.012), new V(-1, 0, 0), (q.x1 - q.x0) / 2, new V(0, 0, -1)],
        [new V(q.x1 + 0.012, 0, (q.z0 + q.z1) / 2), new V(0, 0, -1), (q.z1 - q.z0) / 2, new V(1, 0, 0)], [new V(q.x0 - 0.012, 0, (q.z0 + q.z1) / 2), new V(0, 0, 1), (q.z1 - q.z0) / 2, new V(-1, 0, 0)]];
      for (const [c, u, hu, n] of faces) {
        if (hu < 0.15) continue;
        const reps = Math.max(1, Math.round(hu * 2 / 2.5));
        const fy = this.W.heightAt(c.x, c.z); ao.add(c.clone().setY(fy + Math.min(0.45, h / 2)), u, hu, up, Math.min(0.45, h / 2), [0, 0, reps, 1]);
        fl.add(c.clone().addScaledVector(n, 0.35).setY(fy + 0.004), u, hu, n.clone().negate(), 0.35, [0, 1, reps, 0]);
        if (h > 2.2) for (let k = 0; k < hu * 0.8; k++) if (R() < 0.6) { const w = 0.15 + R() * 0.5, l = 0.8 + R() * Math.min(3, h * 0.6); st.add(c.clone().addScaledVector(u, (R() * 2 - 1) * (hu - w)).setY(q.y1 - l / 2 - 0.05), u, w, up, l / 2); }
        if (R() < 0.3) { const w = 0.4 + R() * 0.8; mo.add(c.clone().addScaledVector(u, (R() * 2 - 1) * Math.max(0, hu - w)).setY(fy + 0.3 + R() * 0.5), u, w, up, w * 0.7); }
      }
    }
    const fogged = { fog: true };
    const add = (m) => { if (m) this.root.add(m); };
    add(ao.mesh(new THREE.MeshBasicMaterial(decal({ map: tx.ao, color: 0xffffff, ...fogged }))));
    add(fl.mesh(new THREE.MeshBasicMaterial(decal({ map: tx.floor, ...fogged }))));
    add(st.mesh(new THREE.MeshBasicMaterial(decal({ map: tx.streak, opacity: 0.85, ...fogged }))));
    add(mo.mesh(new THREE.MeshLambertMaterial(decal({ map: tx.mould, ...fogged }))));
    tx.ao.wrapS = tx.floor.wrapS = THREE.RepeatWrapping;
  }

  // ---- litter carpeting the ground, oily puddles, the odd blood stain
  floorDressing(tx) {
    const W = this.W, R = this.R, B = W.B, lit = new Quads(), pud = new Quads(), up = new V(0, 1, 0);
    const free = (x, z) => { const [i, j] = W.cellOf(x, z); return W.walkable(i, j); };
    const area = (B.x1 - B.x0) * (B.z1 - B.z0), nLitter = Math.min(1600, Math.round(area * 0.42)), nPud = Math.round(area * (this.indoor ? 0.004 : 0.007));
    for (let k = 0, tries = 0; k < nLitter && tries < nLitter * 4; tries++) {
      // litter drifts against walls: pick a spot, then bias it toward the nearest blocked cell
      let x = B.x0 + R() * (B.x1 - B.x0), z = B.z0 + R() * (B.z1 - B.z0); if (!free(x, z)) continue;
      const kind = Math.floor(R() * 8), s = kind === 5 ? 0.35 + R() * 0.25 : kind === 0 || kind === 7 ? 0.2 + R() * 0.15 : 0.06 + R() * 0.07, an = R() * 6.28;
      const u = new V(Math.cos(an), 0, Math.sin(an)), v = new V(-Math.sin(an), 0, Math.cos(an));
      const cu = (kind % 4) / 4, cv = 1 - Math.floor(kind / 4) / 2;
      lit.add(new V(x, 0.008 + R() * 0.004 + this.W.heightAt(x, z), z), u, s, v, s, [cu, cv - 0.5, cu + 0.25, cv]); k++;
    }
    for (let k = 0, tries = 0; k < nPud && tries < 400; tries++) {
      const x = B.x0 + R() * (B.x1 - B.x0), z = B.z0 + R() * (B.z1 - B.z0); if (!free(x, z)) continue;
      const s = 0.5 + R() * 1.4, an = R() * 6.28; pud.add(new V(x, 0.006 + this.W.heightAt(x, z), z), new V(Math.cos(an), 0, Math.sin(an)), s, new V(-Math.sin(an), 0, Math.cos(an)), s * 0.7); k++;
    }
    const lm = lit.mesh(new THREE.MeshLambertMaterial({ map: tx.litter, transparent: true, alphaTest: 0.3, depthWrite: true }));
    if (lm) this.root.add(lm);
    // puddles: near-black, glassy, so lamps flare off them
    const pm = pud.mesh(new THREE.MeshStandardMaterial(decal({ color: 0x0b0c09, roughness: 0.04, metalness: 0.6, alphaMap: tx.puddle, opacity: 0.92 })));
    if (pm) this.root.add(pm);
  }

  // ---- shafts of light under the lamps, flickering with them
  shafts(tx) {
    this.cones = [];
    for (const L of this.W.lamps) {
      if (!L.light || L.base <= 0 || L.p.y < 2.5) continue;
      const h = L.p.y, r = Math.min(3.2, L.r * 0.28);
      const g = new THREE.CylinderGeometry(0.12, r, h, 18, 1, true); g.translate(0, -h / 2, 0);
      // soft haze: fades toward the floor and toward the cone's edges as you look across it
      const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
        uniforms: { col: { value: new THREE.Color(L.col) }, op: { value: 0.09 } },
        vertexShader: 'varying vec2 vUv; varying float vF; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.0); vec3 n = normalize(normalMatrix * normal); vF = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'uniform vec3 col; uniform float op; varying vec2 vUv; varying float vF; void main(){ float a = op * pow(vUv.y, 1.6) * pow(vF, 2.2); gl_FragColor = vec4(col * a, a); }',
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }));
      m.position.copy(L.p); m.renderOrder = 3; this.root.add(m); this.cones.push({ m, L });
    }
  }
  dust() { // motes hanging in the light
    const n = Math.min(500, this.cones.length * 70); if (!n) return;
    const P = new Float32Array(n * 3); this.dustBase = [];
    for (let k = 0; k < n; k++) { const c = this.cones[k % this.cones.length].L.p, a = this.R() * 6.28, r = this.R() * 2.2, y = this.R() * c.y; P[k * 3] = c.x + Math.cos(a) * r * (1 - y / c.y * 0.6); P[k * 3 + 1] = y; P[k * 3 + 2] = c.z + Math.sin(a) * r * (1 - y / c.y * 0.6); this.dustBase.push(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    this.dustPts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff0d0, size: 0.018, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.root.add(this.dustPts);
  }

  // ---- flies and rats
  swarm(p, n = 26) { // a cloud of flies, buzzing
    const P = new Float32Array(n * 3), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x0a0a08, size: 0.016, sizeAttenuation: true, transparent: true, opacity: 0.95 }));
    this.root.add(pts); const f = { p: p.clone(), pts, ph: [...Array(n)].map(() => [this.R() * 6.28, 0.3 + this.R() * 0.5, 0.5 + this.R() * 2, this.R() * 6.28]) };
    this.flies.push(f); return f;
  }
  vermin() {
    const W = this.W, R = this.R;
    for (const pr of W.props || []) if ((pr.kind === 'trash' || pr.kind === 'dumpster') && R() < 0.75) this.swarm(new V(pr.x, pr.kind === 'dumpster' ? 1.4 : 0.5, pr.z));
    // rats: little dark bodies that scurry between hiding spots and bolt from you
    const n = 3 + Math.floor(R() * 4), fur = new THREE.MeshLambertMaterial({ color: 0x241c16 }), tail = new THREE.MeshLambertMaterial({ color: 0x8a6458 });
    for (let k = 0; k < n; k++) {
      const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), fur); b.scale.set(0.8, 0.7, 1.8); b.position.y = 0.045; g.add(b);
      const hd = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 6), fur); hd.rotation.x = Math.PI / 2; hd.position.set(0, 0.05, 0.13); g.add(hd);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.008, 0.2, 4), tail); t.rotation.x = Math.PI / 2 - 0.2; t.position.set(0, 0.03, -0.2); g.add(t);
      const p = this.randomFree(); if (!p) continue; g.position.copy(p); this.root.add(g);
      this.rats.push({ g, goal: p.clone(), wait: R() * 3, speed: 0 });
    }
  }
  randomFree() { const W = this.W, B = W.B; for (let t = 0; t < 60; t++) { const x = B.x0 + 1 + this.R() * (B.x1 - B.x0 - 2), z = B.z0 + 1 + this.R() * (B.z1 - B.z0 - 2), [i, j] = W.cellOf(x, z); if (W.walkable(i, j)) return new V(x, W.heightAt(x, z), z); } return null; }
  vents() { // steam curling out of grates, water dripping from pipes
    const n = this.indoor ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const p = this.randomFree(); if (!p) continue;
      const grate = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshStandardMaterial({ color: 0x1a1a18, metalness: 0.7, roughness: 0.5 })); grate.rotation.x = -Math.PI / 2; grate.position.copy(p).setY(0.007); this.root.add(grate);
      const puffs = []; for (let s = 0; s < 6; s++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: 0x9a9890, transparent: true, opacity: 0, depthWrite: false })); this.root.add(sp); puffs.push({ sp, t: s / 6 }); }
      this.steam.push({ p, puffs });
    }
    for (let k = 0; k < 4; k++) { const p = this.randomFree(); if (p) this.drips.push(p); }
  }

  // ---- the Director's leftovers: dumped victims and body bags, with flies
  victims() {
    const W = this.W, R = this.R, n = 2 + Math.floor(R() * 2);
    for (let k = 0; k < n; k++) {
      const p = this.randomFree(); if (!p || p.distanceTo(W.start) < 8) continue;
      if (R() < 0.5) { // a zipped body bag, slumped
        const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 1.4, 6, 12), new THREE.MeshStandardMaterial({ color: 0x1a2016, roughness: 0.35, metalness: 0.1 }));
        bag.rotation.z = Math.PI / 2; bag.rotation.y = R() * 6; bag.scale.set(1, 1, 0.7); bag.position.copy(p).setY(0.17); this.root.add(bag);
        const bx = { x0: p.x - 0.5, x1: p.x + 0.5, z0: p.z - 0.5, z1: p.z + 0.5, y0: 0, y1: 0.3, see: true }; W.boxes.push(bx); (this.myBoxes = this.myBoxes || []).push(bx);
      } else { // a dead man, dumped where he fell
        const body = new Person({ mask: null, weapon: null, top: [0.3 + R() * 0.2, 0.28, 0.24], legs: [0.2, 0.2, 0.22], skin: [0.5, 0.42, 0.38], bulk: 0.95 + R() * 0.2 });
        body.root.position.copy(p); body.root.rotation.y = R() * 6.28; this.root.add(body.root);
        body.die(new V((R() - 0.5) * 2, 0, (R() - 0.5) * 2), null, W);
        for (const b of ['neck', 'chest', 'head']) body.wound(b, body.bonePos(b, new V()).add(new V(0, 0, 0.08)), 1.6);
        this.game.blood?.pool(p.clone(), 1.3 + R() * 0.6);
        this.corpses = this.corpses || []; this.corpses.push(body);
      }
      this.swarm(p.clone().setY(0.4), 40);
    }
  }
  // a fresh corpse (one of Cash's) attracts flies after a while
  onKill(h) { setTimeout(() => { if (this.W === this.game.world && h.body.rag) this.swarm(h.body.bonePos('chest', new V()).setY(0.4), 30); }, 12000); }

  // ------------------------------------------------------------------ frame
  update(dt, t) {
    const G = this.game, P = G.player, S = G.sound;
    for (const c of this.cones) c.m.material.uniforms.op.value = 0.09 * c.L.on;
    if (this.dustPts) { const a = this.dustPts.geometry.attributes.position, b = this.dustBase; for (let k = 0; k < a.count; k++) { a.array[k * 3] = b[k * 3] + Math.sin(t * 0.3 + k) * 0.15; a.array[k * 3 + 1] = b[k * 3 + 1] + Math.sin(t * 0.2 + k * 1.7) * 0.2; a.array[k * 3 + 2] = b[k * 3 + 2] + Math.cos(t * 0.25 + k * 0.7) * 0.15; } a.needsUpdate = true; }
    let nearFly = null, nd = 9;
    for (const f of this.flies) {
      const a = f.pts.geometry.attributes.position;
      for (let k = 0; k < f.ph.length; k++) { const [p0, r, sp, p1] = f.ph[k]; a.array[k * 3] = f.p.x + Math.sin(t * sp * 3 + p0) * r * Math.cos(t * sp + p1); a.array[k * 3 + 1] = f.p.y + Math.sin(t * sp * 5 + p1) * 0.25; a.array[k * 3 + 2] = f.p.z + Math.cos(t * sp * 3 + p0) * r * Math.sin(t * sp * 1.3 + p1); }
      a.needsUpdate = true; const d = f.p.distanceTo(P.head); if (d < nd) { nd = d; nearFly = f; }
    }
    if (S.ctx) { if (!this.buzz) this.buzz = S.buzzLoop?.(); this.buzz?.(nearFly ? nearFly.p : P.head, nearFly ? Math.max(0, 1 - nd / 9) : 0); }
    // rats: wander, freeze, bolt from Cash
    for (const r of this.rats) {
      const g = r.g, dp = g.position.distanceTo(P.pos);
      if (dp < 3 && !r.fleeing) { r.fleeing = true; const away = g.position.clone().sub(P.pos).setY(0).normalize(); r.goal = g.position.clone().addScaledVector(away, 6); r.wait = 0; if (S.ctx && Math.random() < 0.7) S.squeak?.(g.position); }
      if (r.wait > 0) { r.wait -= dt; continue; }
      const d = r.goal.clone().sub(g.position).setY(0), L = d.length();
      if (L < 0.2) { r.fleeing = false; r.wait = 1 + Math.random() * 5; r.goal = this.randomNear(g.position) || g.position.clone(); continue; }
      const sp = r.fleeing ? 4 : 1.2; g.position.addScaledVector(d.normalize(), Math.min(L, sp * dt)); this.W.collide(g.position, 0.08, 0.2);
      g.rotation.y = Math.atan2(d.x, d.z); g.children[0].position.y = 0.045 + Math.abs(Math.sin(t * 30)) * 0.01;
    }
    for (const s of this.steam) for (const pf of s.puffs) { pf.t = (pf.t + dt * 0.25) % 1; pf.sp.position.set(s.p.x + Math.sin(pf.t * 4 + s.p.x) * 0.2, 0.1 + pf.t * 2.4, s.p.z); pf.sp.scale.setScalar(0.4 + pf.t * 1.6); pf.sp.material.opacity = 0.16 * Math.sin(pf.t * Math.PI); }
    if (this.corpses) for (const c of this.corpses) c.animate(dt, t);
    // the soundscape: drips, the odd distant scream, rats in the walls, a fluorescent hum indoors
    if (!S.ctx) return;
    const T2 = this.timers;
    if ((T2.drip -= dt) < 0) { T2.drip = 0.6 + Math.random() * 2.2; const p = this.drips[Math.floor(Math.random() * this.drips.length)]; if (p && p.distanceTo(P.pos) < 18) S.drip?.(p.clone().setY(2.5)); }
    if ((T2.scream -= dt) < 0) { T2.scream = 35 + Math.random() * 50; S.scream?.(); }
    if ((T2.squeak -= dt) < 0) { T2.squeak = 5 + Math.random() * 10; const r = this.rats[Math.floor(Math.random() * this.rats.length)]; if (r && r.g.position.distanceTo(P.pos) < 12) S.squeak?.(r.g.position); }
    if (this.indoor && !this.hum) this.hum = S.humLoop?.();
  }
  randomNear(p) { for (let t = 0; t < 20; t++) { const q = p.clone().add(new V((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8)), [i, j] = this.W.cellOf(q.x, q.z); if (this.W.walkable(i, j)) return q; } return null; }
  dispose() { // a scene reset builds a fresh layer; take this one away completely
    this.buzz?.(null, 0, true); this.hum?.(true); this.root.parent?.remove(this.root);
    for (const b of this.myBoxes || []) { const i = this.W.boxes.indexOf(b); if (i >= 0) this.W.boxes.splice(i, 1); }
  }
}
