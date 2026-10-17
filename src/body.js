// body.js — people. One skinned mesh per person lofted from rings along a bone
// chain (loft.js), a procedural animator (gait, search, swing, struggle), and a
// verlet ragdoll that takes over the bones when someone dies. Also Josh's own
// hands: jointed fingers, worn sleeves, scarred knuckles, prison ink.
import * as THREE from '../vendor/three.module.js';
import { Loft, ring, blend } from './loft.js?v=1';
import { T } from './paint.js?v=1';

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

function buildGeometry(o) {
  const L = new Loft();
  const skin = o.skin, top = o.top, legs = o.legs, boots = [0.07, 0.06, 0.055];
  const v = (x, y, z) => new V(x, y, z);
  const W = (n) => [[B[n], 1]];
  const bulk = o.bulk;
  // torso: hips -> chest -> shoulders, ring weights blended along the spine
  const torso = [
    [0.86, 0.165, 0.115, legs], [0.93, 0.172, 0.118, legs], [0.99, 0.162, 0.112, top],
    [1.08, 0.158 * bulk, 0.118, top], [1.18, 0.168 * bulk, 0.124 * bulk, top], [1.28, 0.185 * bulk, 0.13 * bulk, top],
    [1.38, 0.2 * bulk, 0.125 * bulk, top], [1.45, 0.195 * bulk, 0.11, top], [1.49, 0.12, 0.08, top], [1.52, 0.07, 0.065, top],
  ];
  const tw = (y) => y < 1.0 ? blend(B.hips, B.spine, (y - 0.86) / 0.24, 0.85, 0.3)
    : y < 1.30 ? blend(B.spine, B.chest, (y - 1.0) / 0.3, 0.6, 0.35)
    : y < 1.49 ? W('chest') : blend(B.chest, B.neck, 0.6);
  L.tube(torso.map(([y, rx, rz, col]) => ring(v(0, y, 0), up, fwd, rx, rz, tw(y), col, { n: 2.6 })), 14, { capStart: true });
  // neck + head
  L.tube([ring(v(0, 1.49, 0), up, fwd, 0.064, 0.066, blend(B.chest, B.neck, 0.5), skin), ring(v(0, 1.57, 0.005), up, fwd, 0.058, 0.06, W('neck'), skin), ring(v(0, 1.63, 0.01), up, fwd, 0.06, 0.07, W('head'), skin)], 10);
  L.blob(v(0, 1.71, 0.012), 0.094, 0.118, 0.108, W('head'), skin, 14, 10);
  L.blob(v(0, 1.66, 0.075), 0.05, 0.045, 0.04, W('head'), skin, 8, 6); // jaw/chin mass
  L.blob(v(0.085, 1.70, 0.0), 0.015, 0.03, 0.02, W('head'), skin, 6, 4); L.blob(v(-0.085, 1.70, 0.0), 0.015, 0.03, 0.02, W('head'), skin, 6, 4); // ears
  // arms
  for (const s of [1, -1]) {
    const S = s > 0 ? 'L' : 'R', a = BP[B['arm' + S]], e = BP[B['fore' + S]], w = BP[B['hand' + S]];
    const dirA = e.clone().sub(a).normalize(), dirF = w.clone().sub(e).normalize();
    const rings = [];
    const seg = (p0, p1, r0, r1, nA, nB, k0, k1, col) => {
      for (let k = k0; k <= k1; k++) { const t = k / 4; const c = p0.clone().lerp(p1, t); rings.push(ring(c, p1.clone().sub(p0), fwd, r0 + (r1 - r0) * t, (r0 + (r1 - r0) * t) * 0.95, blend(B[nA], B[nB], t, 1.0, 0.18), col)); }
    };
    rings.push(ring(a.clone().add(v(-0.035 * s, 0.045, 0)), dirA, fwd, 0.078 * bulk, 0.085 * bulk, blend(B.chest, B['arm' + S], 0.7), top));
    seg(a, e, 0.07 * bulk, 0.056, 'arm' + S, 'fore' + S, 0, 4, top);
    seg(e, w, 0.056, 0.04, 'fore' + S, 'hand' + S, 1, 3, top);
    rings.push(ring(e.clone().lerp(w, 0.92), dirF, fwd, 0.038, 0.034, W('fore' + S), o.sleeves ? top : skin));
    rings.push(ring(w.clone(), dirF, fwd, 0.03, 0.024, W('hand' + S), skin));
    L.tube(rings, 10);
    // hand: palm block + fist of fingers
    L.blob(w.clone().add(v(0.006 * s, -0.06, 0.005)), 0.024, 0.055, 0.042, W('hand' + S), skin, 8, 6);
    L.blob(w.clone().add(v(0.0, -0.105, 0.018)), 0.024, 0.03, 0.04, W('hand' + S), skin, 8, 6);
  }
  // legs
  for (const s of [1, -1]) {
    const S = s > 0 ? 'L' : 'R', h = BP[B['thigh' + S]], k = BP[B['shin' + S]], a = BP[B['foot' + S]];
    const rings = [];
    for (let i = 0; i <= 5; i++) { const t = i / 5, c = h.clone().lerp(k, t); rings.push(ring(c, up, fwd, 0.095 - t * 0.035, 0.1 - t * 0.036, i === 0 ? blend(B.hips, B['thigh' + S], 0.6) : blend(B['thigh' + S], B['shin' + S], t, 1, 0.16), legs)); }
    for (let i = 1; i <= 4; i++) { const t = i / 4, c = k.clone().lerp(a, t); rings.push(ring(c, up, fwd, 0.06 - t * 0.014 + (i === 1 ? 0.006 : 0), 0.064 - t * 0.016, blend(B['shin' + S], B['foot' + S], t, 1, 0.12), t > 0.7 ? boots : legs)); }
    L.tube(rings, 10);
    // boot
    L.tube([ring(a.clone().add(v(0, -0.01, -0.06)), fwd, up, 0.048, 0.055, W('foot' + S), boots), ring(a.clone().add(v(0, -0.03, 0.06)), fwd, up, 0.05, 0.045, W('foot' + S), boots), ring(a.clone().add(v(0, -0.05, 0.16)), fwd, up, 0.045, 0.03, W('foot' + S), boots)], 10, { capStart: true, capEnd: true });
  }
  return L.geometry();
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
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, map: T.fleece.map, bumpMap: T.skin, bumpScale: 0.004 });
    this.skel = makeSkeleton();
    this.mesh = new THREE.SkinnedMesh(geo, mat);
    this.mesh.add(this.skel.bones[0]); this.mesh.bind(this.skel);
    this.mesh.castShadow = true; this.mesh.frustumCulled = false;
    this.root = new THREE.Group(); this.root.add(this.mesh);
    this.bones = this.skel.bones;
    this.rest = this.bones.map((b) => b.position.clone());
    // mask on the face, held by the head bone
    if (o.mask) {
      const mk = new THREE.Mesh(new THREE.SphereGeometry(0.112, 18, 12, Math.PI * 0.04, Math.PI * 0.92, Math.PI * 0.12, Math.PI * 0.68), new THREE.MeshStandardMaterial({ map: T.mask[o.mask], transparent: o.mask === 'hockey', alphaTest: 0.5, roughness: o.mask === 'hockey' ? 0.4 : 0.9, side: THREE.DoubleSide }));
      mk.rotation.y = 0; mk.scale.set(0.98, 1.12, 1.02); mk.position.set(0, 0.11, 0.014);
      if (o.mask === 'knit') { mk.geometry = new THREE.SphereGeometry(0.108, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.82); mk.material.transparent = false; }
      this.bones[B.head].add(mk); this.maskMesh = mk;
      // eyes glinting behind the holes
      const eyeM = new THREE.MeshBasicMaterial({ color: 0x1a1410 });
      for (const s of [1, -1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), eyeM); e.position.set(0.033 * s, 0.11, 0.085); this.bones[B.head].add(e); }
    }
    // weapon in the right hand
    this.weapon = o.weapon ? makeHunterWeapon(o.weapon) : null;
    if (this.weapon) { this.weapon.position.set(0, -0.1, 0.02); this.bones[B.handR].add(this.weapon); }
    // a flashlight for some
    this.wounds = [];
    this.anim = { phase: 0, speed: 0, look: 0, lookV: 0, swing: -1, struggle: 0, alert: 0, stagger: 0, crouch: 0, hold: 0 };
    this.rag = null;
  }

  // world position of a bone (after updateMatrixWorld)
  bonePos(name, out = new V()) { return this.bones[B[name]].getWorldPosition(out); }
  headPos(out = new V()) { return this.bones[B.head].localToWorld(out.set(0, 0.11, 0.01)); }

  // ---------------------------------------------------------- animation
  animate(dt, t) {
    if (this.rag) { this.rag.step(dt); return; }
    const A = this.anim, b = this.bones;
    for (let i = 0; i < b.length; i++) { b[i].quaternion.identity(); b[i].position.copy(this.rest[i]); }
    const sp = A.speed;
    A.phase += dt * (sp < 0.05 ? 0 : 2.2 + sp * 1.5);
    const ph = A.phase, run = Math.min(1, Math.max(0, (sp - 1.8) / 1.6)), walkAmp = Math.min(1, sp / 1.2);
    const swing = (0.45 + run * 0.35) * walkAmp;
    const e = new THREE.Euler();
    const rot = (n, x, y = 0, z = 0) => b[B[n]].quaternion.multiply(new Q().setFromEuler(e.set(x, y, z)));
    // legs
    rot('thighL', -Math.sin(ph) * swing - A.crouch * 0.9); rot('thighR', Math.sin(ph) * swing - A.crouch * 0.9);
    rot('shinL', Math.max(0, Math.sin(ph - 1.3)) * (0.6 + run * 0.7) * walkAmp + A.crouch * 1.4);
    rot('shinR', Math.max(0, Math.sin(ph - 1.3 + Math.PI)) * (0.6 + run * 0.7) * walkAmp + A.crouch * 1.4);
    rot('footL', -A.crouch * 0.5); rot('footR', -A.crouch * 0.5);
    b[B.hips].position.y = this.rest[B.hips].y - Math.abs(Math.cos(ph)) * 0.03 * walkAmp - A.crouch * 0.28 + 0.015 * walkAmp;
    // torso
    rot('hips', 0, Math.sin(ph) * 0.12 * walkAmp, 0);
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
    const bone = this.bones[B[boneName]];
    const local = bone.worldToLocal(worldPoint.clone());
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.035 * size, 10), new THREE.MeshStandardMaterial({ map: T.blood[Math.floor(Math.random() * 3)], transparent: true, roughness: 0.25, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    d.position.copy(local);
    d.lookAt(local.clone().multiplyScalar(2)); // face outward from the bone axis-ish
    bone.add(d); this.wounds.push(d);
  }

  // ------------------------------------------------------------ ragdoll
  die(impulse = new V(), at = null, world = null) {
    if (this.rag) return;
    this.root.updateMatrixWorld(true);
    this.rag = new Ragdoll(this, impulse, at, world);
  }
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
  } else if (kind === 'pipe') {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 8), new THREE.MeshStandardMaterial({ color: 0x5a524a, metalness: 0.8, roughness: 0.6 }));
    m.rotation.x = Math.PI / 2; m.position.z = 0.25; g.add(m);
  }
  // point the weapon along the hand (bone points down -Y)
  g.rotation.x = -Math.PI / 2 + 0.3;
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

// ---------------------------------------------------------- Josh's hands
// A right hand built in grip space (WebXR: origin in the curled fingers, -Z
// along the handle toward the thumb, +Y back along the forearm, +X out of the
// back of the right hand). The left is the mirror. Fingers are real jointed
// bones that curl around whatever he's holding.
export function makeHand(left = false) {
  const L = new Loft();
  const skin = [0.5, 0.35, 0.26], knuckle = [0.58, 0.36, 0.29], sleeve = [0.13, 0.13, 0.14], cuff = [0.17, 0.17, 0.18], ink = [0.17, 0.2, 0.24];
  const v = (x, y, z) => new V(x, y, z);
  // bones: 0 wrist, then per finger (index..pinky) 3 bones, thumb 3 bones
  const bones = [new THREE.Bone()]; bones[0].position.set(0, 0.075, 0.0);
  const fingerDefs = [ // base (relative to wrist root space), length of phalanges
    { base: v(-0.005, -0.004, -0.031), l: [0.039, 0.025, 0.020], r: 0.0102 },
    { base: v(-0.007, -0.009, -0.010), l: [0.043, 0.028, 0.021], r: 0.0106 },
    { base: v(-0.006, -0.007, 0.011), l: [0.040, 0.026, 0.020], r: 0.0100 },
    { base: v(-0.004, -0.001, 0.030), l: [0.032, 0.020, 0.018], r: 0.0088 },
  ];
  const fingers = [];
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
    // geometry in bind (open) pose
    let y = f.base.y; const rings = [];
    for (let k = 0; k < 3; k++) {
      const r = f.r * (1 - k * 0.12);
      rings.push(ring(v(f.base.x, y - 0.002, f.base.z), v(0, -1, 0), v(1, 0, 0), r, r * 1.05, k === 0 ? [[chain[0], 0.7], [0, 0.3]] : blend(chain[k - 1], chain[k], 0.6), k === 0 ? knuckle : skin));
      rings.push(ring(v(f.base.x, y - f.l[k] * 0.6, f.base.z), v(0, -1, 0), v(1, 0, 0), r * 0.92, r * 0.95, Wn(chain[k]), skin));
      y -= f.l[k];
    }
    rings.push(ring(v(f.base.x - 0.001, y + 0.002, f.base.z), v(0, -1, 0), v(1, 0, 0), f.r * 0.62, f.r * 0.7, Wn(chain[2]), skin, { capLen: 0.006 }));
    L.tube(rings, 8, { capEnd: true });
    // knuckle scar
    L.blob(v(f.base.x + 0.008, f.base.y + 0.003, f.base.z), 0.006, 0.006, 0.008, [[chain[0], 0.5], [0, 0.5]], fi % 2 ? knuckle : [0.72, 0.5, 0.42], 6, 4);
  });
  // thumb: from the palm side near the index, pointing along -Z
  {
    const tb = v(-0.017, 0.048, -0.026), td = v(-0.55, -0.74, -0.38).normalize();
    const chain = []; let parent = bones[0], pos = tb.clone().sub(bones[0].position);
    const ls = [0.04, 0.032, 0.026];
    for (let k = 0; k < 3; k++) { const b = new THREE.Bone(); b.position.copy(pos); parent.add(b); bones.push(b); chain.push(bones.length - 1); parent = b; pos = td.clone().multiplyScalar(ls[k]); }
    fingers.push(chain);
    const d = td; let c = tb.clone(); const rings = [];
    for (let k = 0; k < 3; k++) { const r = 0.0125 - k * 0.0012; rings.push(ring(c.clone(), d, v(1, 0, 0), r, r * 1.08, k === 0 ? [[chain[0], 0.6], [0, 0.4]] : blend(chain[k - 1], chain[k], 0.6), skin)); c = c.clone().addScaledVector(d, ls[k]); }
    rings.push(ring(c.clone(), d, v(1, 0, 0), 0.008, 0.009, Wn(chain[2]), skin));
    L.tube(rings, 8, { capEnd: true });
  }
  // palm block (soft superellipse rings from wrist to knuckles), back of hand faces +X
  const palm = [];
  for (let k = 0; k <= 4; k++) {
    const t = k / 4, y = 0.085 - t * 0.085;
    palm.push(ring(v(-0.005, y, -0.001), v(0, -1, 0), v(1, 0, 0), 0.03 + t * 0.012, 0.016 + t * 0.002, Wn(0), skin, { n: 3 }));
  }
  L.tube(palm, 14);
  // prison ink across the back of the hand: a dark band of tiny blobs (letters read as smudged ink)
  // forearm + rolled sleeve
  const arm = [];
  arm.push(ring(v(-0.004, 0.085, -0.002), v(0, 1, 0), v(1, 0, 0), 0.03, 0.019, Wn(0), skin));
  arm.push(ring(v(-0.004, 0.13, 0), v(0, 1, 0), v(1, 0, 0), 0.031, 0.024, Wn(0), skin));
  // faded prison ink: a band of barbed wire round the forearm
  arm.push(ring(v(-0.004, 0.148, 0), v(0, 1, 0), v(1, 0, 0), 0.032, 0.026, Wn(0), skin));
  arm.push(ring(v(-0.004, 0.153, 0), v(0, 1, 0), v(1, 0, 0), 0.0322, 0.0262, Wn(0), ink));
  arm.push(ring(v(-0.004, 0.163, 0), v(0, 1, 0), v(1, 0, 0), 0.0328, 0.027, Wn(0), ink));
  arm.push(ring(v(-0.004, 0.168, 0), v(0, 1, 0), v(1, 0, 0), 0.033, 0.0275, Wn(0), skin));
  arm.push(ring(v(-0.004, 0.19, 0), v(0, 1, 0), v(1, 0, 0), 0.035, 0.031, Wn(0), skin));
  arm.push(ring(v(-0.004, 0.205, 0), v(0, 1, 0), v(1, 0, 0), 0.046, 0.052, Wn(0), cuff));
  arm.push(ring(v(-0.004, 0.24, 0), v(0, 1, 0), v(1, 0, 0), 0.047, 0.053, Wn(0), cuff));
  arm.push(ring(v(-0.004, 0.26, 0), v(0, 1, 0), v(1, 0, 0), 0.042, 0.048, Wn(0), sleeve));
  arm.push(ring(v(-0.004, 0.42, 0), v(0, 1, 0), v(1, 0, 0), 0.045, 0.05, Wn(0), sleeve));
  L.tube(arm, 12, { capEnd: true });
  // put bones into world-of-hand space: bone 0 sits at the wrist; children positions are relative
  const geo = L.geometry(left);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, bumpMap: T.skin, bumpScale: 0.003 });
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
        ch.forEach((bi, k) => {
          const b = bones[bi];
          if (fi === 4) b.quaternion.setFromEuler(new THREE.Euler(-a * (k === 0 ? 0.5 : 0.35), 0, -sgn * a * (k === 0 ? 0.35 : 0.5)));
          else b.quaternion.setFromEuler(new THREE.Euler(0, 0, -sgn * a * (k === 0 ? 1.45 : k === 1 ? 1.6 : 1.1)));
        });
      });
    },
  };
  hand.curl(0.35);
  return hand;
}

export { B as BONE, SKIN_TONES };
