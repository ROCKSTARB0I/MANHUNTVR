// finisher.js — once the execution hits are in, the tape cuts to Cash finishing
// the job: his whole body, your weapon in his fist, more blows on the man on his
// knees, then the last one. Both men are driven by keyed performances (spline-
// interpolated like captured motion: stance, wind-up, contact, follow-through,
// recovery) with springs layered on top so every impact jolts through the body.
// Desktop gets a slow orbiting camera; in VR the view fades and you watch from
// a step to the side (nothing moves you on its own), then it fades back.
import * as THREE from '../vendor/three.module.js';
import { BONE } from './body.js?v=23';

const V = THREE.Vector3;
const INTRO = 0.4, BLOW = 0.82, LASTBLOW = 1.5, HOLD = 2.2, FADE = 0.22, REACH = 0.64;

// ---------------------------------------------------------------- performance data
// Cash. Angles in radians on his own bones (x: bend forward/raise, y: twist, z: out to the side).
const READY = { hipsY: 0.07, hipsYaw: 0.1, spineX: 0.22, spineY: 0.05, chestX: 0.05, chestY: 0.1, neckX: -0.1, headX: 0.18,
  armRX: -0.75, armRZ: -0.15, foreR: -1.5, armLX: -1.15, armLZ: 0.15, foreL: -0.45,
  thighL: -0.35, shinL: 0.45, thighR: 0.2, shinR: 0.35, footL: -0.1, footR: -0.25 };
const BLOW_KEYS = [
  [0, READY],
  [0.34, { hipsY: 0.035, hipsYaw: -0.18, spineX: -0.12, spineY: -0.3, chestX: -0.1, chestY: -0.38, neckX: 0.12, headX: 0.1,
    armRX: -2.8, armRZ: -0.35, foreR: -1.95, armLX: -1.0, armLZ: 0.1, foreL: -0.15, thighL: -0.28, shinL: 0.33, thighR: 0.26, shinR: 0.24 }],
  [0.47, { hipsY: 0.15, hipsYaw: 0.26, spineX: 0.64, spineY: 0.26, chestX: 0.22, chestY: 0.36, neckX: 0.05, headX: 0.32,
    armRX: -0.55, armRZ: -0.05, foreR: -0.22, armLX: -0.85, foreL: -0.65, thighL: -0.58, shinL: 0.78, thighR: 0.1, shinR: 0.52 }],
  [0.58, { hipsY: 0.16, spineX: 0.74, chestY: 0.46, armRX: -0.1, foreR: -0.45, armRZ: 0.06 }],
  [0.8, { hipsY: 0.1, hipsYaw: 0.14, spineX: 0.38, chestY: 0.2, armRX: -0.55, foreR: -1.1, armRZ: -0.1 }],
  [1, READY],
];
const STAND = { hipsY: 0.02, hipsYaw: 0.05, spineX: 0.32, spineY: 0.0, chestX: 0.12, chestY: 0.05, neckX: 0.25, headX: 0.45,
  armRX: -0.12, armRZ: -0.1, foreR: -0.35, armLX: -0.05, armLZ: 0.1, foreL: -0.25, thighL: -0.12, shinL: 0.2, thighR: 0.05, shinR: 0.12, footL: 0, footR: 0 };
const LAST_KEYS = [
  [0, READY],
  [0.3, { hipsY: 0.0, hipsYaw: -0.05, spineX: -0.22, spineY: -0.1, chestX: -0.18, chestY: -0.15, neckX: 0.15, headX: 0.05,
    armRX: -2.95, armRZ: -0.2, foreR: -1.7, armLX: -2.75, armLZ: 0.2, foreL: -1.75, thighL: -0.2, shinL: 0.2, thighR: 0.15, shinR: 0.15 }],
  [0.46, { hipsY: 0.0, spineX: -0.26, chestX: -0.2, armRX: -3.0, armLX: -2.85 }], // the held breath before it comes down
  [0.55, { hipsY: 0.26, hipsYaw: 0.05, spineX: 0.9, spineY: 0.05, chestX: 0.3, chestY: 0.1, neckX: 0.1, headX: 0.35,
    armRX: -0.35, armRZ: -0.05, foreR: -0.2, armLX: -0.45, armLZ: 0.05, foreL: -0.25, thighL: -0.75, shinL: 1.05, thighR: 0.05, shinR: 0.85 }],
  [0.66, { hipsY: 0.27, spineX: 0.98, chestX: 0.34, armRX: -0.05, armLX: -0.15 }],
  [1, STAND],
];
// the man on his knees; `d` = how much fight is left (hands up), `s` = slump
function victimPose(d, s) {
  return { hipsY: 0.45 + s * 0.05, spineX: 0.2 + s * 0.45, neckX: 0.15 + s * 0.3, headX: 0.1 + s * 0.25, thighL: -0.12, thighR: -0.04, shinL: 1.5, shinR: 1.56, footL: 0.65, footR: 0.6,
    armLX: -2.05 * d - 0.15 * (1 - d), armLZ: 0.35 * d + 0.08, foreL: -1.95 * d - 0.25 * (1 - d), armRX: -2.0 * d - 0.1 * (1 - d), armRZ: -0.35 * d - 0.08, foreR: -1.9 * d - 0.3 * (1 - d) };
}

// Catmull-Rom through the keys, channel by channel; missing channels carry the last value
function fill(keys) { let last = {}; return keys.map(([u, p]) => { last = Object.assign({}, last, p); return [u, last]; }); }
const BK = fill(BLOW_KEYS), LK = fill(LAST_KEYS);
function sample(keys, u, out = {}) {
  u = Math.max(0, Math.min(1, u)); let i = 0; while (i < keys.length - 2 && u > keys[i + 1][0]) i++;
  const k0 = keys[Math.max(0, i - 1)][1], k1 = keys[i][1], k2 = keys[i + 1][1], k3 = keys[Math.min(keys.length - 1, i + 2)][1];
  const t = (u - keys[i][0]) / Math.max(1e-4, keys[i + 1][0] - keys[i][0]), t2 = t * t, t3 = t2 * t;
  for (const c in k1) { const p0 = k0[c] ?? k1[c], p1 = k1[c], p2 = k2[c] ?? p1, p3 = k3[c] ?? p2; out[c] = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); }
  return out;
}
const mix = (a, b, k) => { const o = {}; for (const c in a) o[c] = a[c] + ((b[c] ?? a[c]) - a[c]) * k; return o; };
// a damped spring for secondary motion
class Spring { constructor(k = 160, c = 11) { this.k = k; this.c = c; this.x = 0; this.v = 0; } kick(v) { this.v += v; } step(dt) { const n = Math.ceil(dt / 0.008); for (let i = 0; i < n; i++) { const h = dt / n; this.v += (-this.k * this.x - this.c * this.v) * h; this.x += this.v * h; } return this.x; } }
// small, slow, layered noise so nobody is ever perfectly still
const wob = (t, s) => Math.sin(t * 1.3 + s) * 0.5 + Math.sin(t * 2.9 + s * 1.7) * 0.3 + Math.sin(t * 6.1 + s * 2.3) * 0.2;

function apply(rot, b, B, rest, p, extra = {}) {
  b[B.hips].position.y = rest[B.hips].y - p.hipsY;
  rot('hips', 0, p.hipsYaw || 0, 0);
  rot('spine', p.spineX + (extra.spineX || 0), (p.spineY || 0) + (extra.spineY || 0), extra.spineZ || 0);
  rot('chest', (p.chestX || 0) + (extra.chestX || 0), p.chestY || 0, 0);
  rot('neck', p.neckX + (extra.neckX || 0), extra.neckY || 0, 0);
  rot('head', p.headX + (extra.headX || 0), extra.headY || 0, extra.headZ || 0);
  rot('armL', p.armLX, 0, p.armLZ || 0); rot('foreL', p.foreL);
  rot('armR', p.armRX, 0, p.armRZ || 0); rot('foreR', p.foreR);
  rot('thighL', p.thighL); rot('shinL', p.shinL); rot('footL', p.footL || 0);
  rot('thighR', p.thighR); rot('shinR', p.shinR); rot('footR', p.footR || 0);
}

export class Finisher {
  constructor(G, o, ctx) {
    Object.assign(this, o); this.G = G; this.ctx = ctx; this.t = 0;
    const { cashBody: C, P, camera, dolly } = ctx, h = this.h;
    this.vr = ctx.renderer.xr.isPresenting;
    this.blows = [2, 3, 5][this.level] || 3; this.n = -1; this.struck = false; this.over = false;
    // Cash squares up to the man he's holding down, at striking distance
    const to = h.pos.clone().sub(P.pos).setY(0); this.face = to.lengthSq() ? to.normalize() : new V(0, 0, -1);
    this.cashPos = h.pos.clone().addScaledVector(this.face, -REACH).setY(0);
    C.root.visible = true; C.root.position.copy(this.cashPos); C.root.position.y = G.world.heightAt(this.cashPos.x, this.cashPos.z); C.root.rotation.y = Math.atan2(this.face.x, this.face.z);
    h.yaw = Math.atan2(this.face.x, this.face.z); h.place?.(); // back to Cash
    // your weapon, in his right fist, held the way your hand held it
    const it = this.it; it.mesh.updateMatrixWorld(true); this.hand.obj.updateMatrixWorld(true);
    const rel = new THREE.Matrix4().copy(this.hand.obj.matrixWorld).invert().multiply(it.mesh.matrixWorld);
    const grip = new THREE.Group(); grip.position.set(0, -0.09, 0.02); grip.rotation.set(0, Math.PI, 0);
    const w = it.mesh.clone(true); rel.decompose(w.position, w.quaternion, w.scale); grip.add(w);
    C.bones[BONE.handR].add(grip); this.grip = grip; it.mesh.visible = false;
    // performances
    this.cs = { recoil: new Spring(220, 14), twist: new Spring(150, 10) };
    this.vs = { spine: new Spring(120, 7), neck: new Spring(170, 8), head: new Spring(200, 7), twist: new Spring(110, 6), side: new Spring(130, 7) };
    this.cashPose = Object.assign({}, READY); this.from = null;
    C.pose = (rot, b, dt, t, B) => this.drive(C, rot, b, B, dt, t);
    h.body.pose = (rot, b, dt, t, B) => this.driveVictim(rot, b, B, dt, t);
    // VR: a black shell for the fades
    if (this.vr) {
      this.shell = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false }));
      this.shell.renderOrder = 3000; camera.add(this.shell); this.dollyWas = dolly.position.clone();
    }
    this.orbit = 0; G.cineCam = null;
    G.sound.tapeStatic(0.45, 0.16); // the tape cuts
  }
  // where the man is hit this blow (blunt things to the head, blades to the neck)
  target() { const b = this.h.body; return (this.it.kind === 'shard' || this.it.kind === 'knife') ? b.bonePos('neck', new V()).add(new V(0, 0.05, 0)) : b.headPos(new V()); }

  // Cash's body this frame
  drive(C, rot, b, B, dt, t) {
    const T = this.t - INTRO; let p;
    if (T < 0) p = mix(STAND, READY, Math.min(1, this.t / INTRO) ** 2 * (3 - 2 * Math.min(1, this.t / INTRO)));
    else {
      const k = Math.min(this.blows - 1, Math.floor(T / BLOW)), last = k === this.blows - 1;
      p = sample(last ? LK : BK, (T - k * BLOW) / (last ? LASTBLOW : BLOW)); // after the last blow this runs on into his standing pose and holds
    }
    // breathing (heavy once it's done), weight settling, recoil from each impact
    const breath = Math.sin(t * (this.over ? 9 : 5.5)) * (this.over ? 0.05 : 0.02);
    apply(rot, b, B, C.rest, p, { chestX: breath - this.cs.recoil.step(dt) * 0.6, spineY: this.cs.twist.step(dt), spineZ: wob(t, 1) * 0.015, neckY: wob(t, 4) * 0.05, headZ: wob(t, 7) * 0.03 });
  }
  driveVictim(rot, b, B, dt, t) {
    const done = Math.max(0, this.n + (this.struck ? 1 : 0)), fight = Math.max(0, 1 - done / Math.max(2, this.blows - 1)), slump = Math.min(1, done / this.blows);
    const p = victimPose(fight, slump);
    // he shakes; his hands tremble in front of his face while he still can
    const shake = (0.03 + fight * 0.03), v = this.vs;
    p.foreL += Math.sin(t * 23) * shake; p.foreR += Math.sin(t * 21 + 1) * shake;
    apply(rot, b, B, this.h.body.rest, p, { spineX: v.spine.step(dt), spineY: v.twist.step(dt) + wob(t, 2) * 0.04, spineZ: v.side.step(dt), neckX: v.neck.step(dt), headX: v.head.step(dt), headY: wob(t, 9) * 0.1 });
  }

  update(dt) {
    const G = this.G, { cashBody: C, dolly } = this.ctx, h = this.h;
    this.t += dt; G.kit.killGlow = 1;
    if (!this.over) { h.speed = 0; h.body.anim.speed = 0; }
    // -------- the blows: contact frame of each key set triggers the hit
    const T = this.t - INTRO;
    if (!this.over && T >= 0) {
      const k = Math.min(this.blows - 1, Math.floor(T / BLOW)), last = k === this.blows - 1;
      if (k !== this.n) { this.n = k; this.struck = false; }
      const u = last ? (T - k * BLOW) / LASTBLOW : (T - k * BLOW) / BLOW;
      if (!this.struck && u >= (last ? 0.55 : 0.47)) { this.struck = true; this.strike(last); }
    }
    C.animate(dt, G.time); C.face(dt, 0);
    // -------- camera
    if (!this.vr) {
      const mid = this.cashPos.clone().lerp(h.pos, 0.5), side = new V(-this.face.z, 0, this.face.x);
      this.orbit += dt * 0.2;
      const dir = side.clone().multiplyScalar(Math.cos(this.orbit)).addScaledVector(this.face, Math.sin(this.orbit) * 0.8 - 0.35).normalize();
      const p = mid.clone().addScaledVector(dir, 2.1 - Math.min(0.5, this.t * 0.06)); p.y = 1.3 + Math.sin(this.t * 0.7) * 0.04 + wob(this.t, 3) * 0.015; // slow push-in, handheld drift
      const shake = this.shakeT > 0 ? (this.shakeT -= dt, (Math.random() - 0.5) * 0.05 * this.shakeT / 0.2) : 0;
      G.cineCam = { p: p.add(new V(shake, shake * 0.6, 0)), look: mid.setY(0.95 + wob(this.t, 5) * 0.01) };
    } else {
      // fade out, step aside, fade in; at the end fade out, step back, fade in
      let op = 0; const t = this.t, F = FADE, e = this.over ? this.overT : Infinity;
      if (t < F) op = t / F; else if (t < 2 * F) op = 1 - (t - F) / F;
      if (t > e - 2 * F && t < e - F) op = (t - (e - 2 * F)) / F;
      else if (t >= e - F) { if (!this.back) { this.back = true; dolly.position.copy(this.dollyWas); } op = 1 - (t - (e - F)) / F; }
      this.shell.material.opacity = Math.max(0, Math.min(1, op));
      if (!this.moved && t >= F) { this.moved = true; const side = new V(-this.face.z, 0, this.face.x); dolly.position.addScaledVector(side, 1.5).addScaledVector(this.face, 0.4); }
    }
    if (this.over && this.t >= this.overT) return this.end();
  }
  strike(last) {
    const G = this.G, h = this.h, kit = this.kit, at = this.target(), dir = at.clone().sub(this.cashPos.clone().setY(1.7)).normalize();
    const kind = this.it.kind, pw = last ? 1.6 : 1;
    if (kind === 'shard' || kind === 'knife') G.sound.stab(at, 1.3); else if (kind === 'bottle') G.sound.glass(at); else { G.sound.crunch(at); G.sound.thud(at, 1.6 * pw); }
    for (const x of G.hands) x.haptic?.(1, last ? 220 : 120);
    G.vhs.hot = Math.min(1.3, G.vhs.hot + 0.45 * pw); this.shakeT = 0.2;
    // the impact goes through both of them
    const v = this.vs, sideK = (Math.random() - 0.5);
    v.spine.kick(3.5 * pw); v.neck.kick(6 * pw); v.head.kick(9 * pw); v.twist.kick(sideK * 5); v.side.kick(sideK * 4);
    this.cs.recoil.kick(2.2 * pw); this.cs.twist.kick(-1.2);
    h.body.wound(kind === 'shard' || kind === 'knife' ? 'neck' : this.n % 2 ? 'head' : 'neck', at, 1.3 + this.level * 0.3);
    G.blood.spray(at, dir, (50 + this.level * 30) * pw, (1.3 + this.level * 0.3) * pw);
    G.blood.spray(at, new V(0, 1, 0).sub(dir).normalize(), 12 + this.level * 10, 0.8);
    G.blood.splat(new V(h.pos.x + dir.x * 0.5, 0, h.pos.z + dir.z * 0.5), 0.35 + this.level * 0.15);
    // he screams through the first blows, then it's muffled sobbing and gurgling; Cash grunts with every one
    const weak = this.n / Math.max(1, this.blows - 1);
    G.sound.painScream(h.eye(new V()), (1.3 - weak * 0.6) * pw, weak > 0.5 || Math.random() < 0.25); G.sound.effort(this.cashPos.clone().setY(1.6), pw);
    G.sound.tapeStatic(last ? 0.6 : 0.14, last ? 0.2 : 0.1);
    if (!last) return;
    // the last one: he goes down for good
    h.body.pose = null;
    kit.finishKill(this.hand, this.it, h, this.level, at, dir);
    G.sound.gurgle(at);
    this.over = true; this.overT = this.t + HOLD;
  }
  end() {
    const G = this.G, { cashBody: C, camera, dolly } = this.ctx;
    this.grip.parent?.remove(this.grip); if (!this.it.gone) this.it.mesh.visible = true;
    G.sound.tapeStatic(0.3, 0.12);
    C.pose = null; this.h.body.pose = null; C.anim.swing = -1; G.cineCam = null;
    if (this.vr) { camera.remove(this.shell); if (!this.back) dolly.position.copy(this.dollyWas); }
    G.finisher = null;
  }
}
