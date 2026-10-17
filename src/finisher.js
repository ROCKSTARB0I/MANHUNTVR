// finisher.js — once the execution hits are in, the tape cuts to Cash finishing
// the job: his whole body, your weapon in his fist, more blows on the man on his
// knees, then the last one. Desktop gets a slow orbiting camera; in VR the view
// fades and you watch from a step to the side (the camera never moves you on
// its own), then it fades back to where you stood.
import * as THREE from '../vendor/three.module.js';
import { BONE } from './body.js?v=13';

const V = THREE.Vector3;
const BLOW = 0.62, GAP = 0.16, HOLD = 1.7, FADE = 0.22;

export class Finisher {
  constructor(G, o, ctx) {
    Object.assign(this, o); this.G = G; this.ctx = ctx; this.t = 0;
    const { cashBody: C, P, camera, dolly } = ctx, h = this.h;
    this.vr = ctx.renderer.xr.isPresenting;
    this.blows = [2, 3, 5][this.level] || 3; this.n = 0; this.struck = false; this.over = false;
    // Cash stands where you stood, facing the man he's holding down
    this.cashPos = P.pos.clone(); const to = h.pos.clone().sub(this.cashPos).setY(0); this.face = to.lengthSq() ? to.normalize() : new V(0, 0, -1);
    C.root.visible = true; C.root.position.copy(this.cashPos); C.root.rotation.y = Math.atan2(this.face.x, this.face.z);
    Object.assign(C.anim, { speed: 0, crouch: 0, swing: -1, struggle: 0, stagger: 0 });
    // your weapon, in his right fist, held the way your hand held it
    const it = this.it; it.mesh.updateMatrixWorld(true); this.hand.obj.updateMatrixWorld(true);
    const rel = new THREE.Matrix4().copy(this.hand.obj.matrixWorld).invert().multiply(it.mesh.matrixWorld);
    const grip = new THREE.Group(); grip.position.set(0, -0.09, 0.02); grip.rotation.set(0, Math.PI, 0);
    const w = it.mesh.clone(true); rel.decompose(w.position, w.quaternion, w.scale); grip.add(w);
    C.bones[BONE.handR].add(grip); this.grip = grip; it.mesh.visible = false;
    // your own hands go away for the shot
    this.hidden = G.hands.map((x) => { const was = x.model.group.visible; x.model.group.visible = false; return was; });
    // he's on his knees
    h.body.anim.crouch = 0.85; h.body.anim.struggle = 0.25;
    // VR: a black shell for the fades
    if (this.vr) {
      this.shell = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false }));
      this.shell.renderOrder = 3000; camera.add(this.shell); this.dollyWas = dolly.position.clone();
    }
    this.orbit = 0; G.cineCam = null;
  }
  // where the man is hit this blow (blunt things to the head, blades to the neck)
  target() { const b = this.h.body; return this.it.kind === 'shard' ? b.bonePos('neck', new V()).add(new V(0, 0.05, 0)) : b.headPos(new V()); }

  update(dt) {
    const G = this.G, { cashBody: C, camera, dolly } = this.ctx, h = this.h;
    this.t += dt; G.kit.killGlow = 1;
    if (!this.over) { h.body.anim.crouch = 0.85; h.speed = 0; h.body.anim.speed = 0; } // kept on his knees
    // -------- Cash's blows
    if (!this.over) {
      const per = BLOW + GAP, k = Math.min(this.blows - 1, Math.floor(Math.max(0, this.t - 0.25) / per)), last = k === this.blows - 1;
      const local = Math.max(0, this.t - 0.25 - k * per) / (last ? BLOW * 1.35 : BLOW);
      if (k !== this.n) { this.n = k; this.struck = false; }
      C.anim.swing = this.t < 0.25 ? -1 : Math.min(1, local);
      if (!this.struck && local >= 0.55) { this.struck = true; this.strike(last); }
    } else C.anim.swing = -1;
    C.animate(dt, G.time); C.face(dt, 0);
    // -------- camera
    if (!this.vr) {
      const mid = this.cashPos.clone().lerp(this.h.pos, 0.5), side = new V(-this.face.z, 0, this.face.x);
      this.orbit += dt * 0.22;
      const dir = side.clone().multiplyScalar(Math.cos(this.orbit)).addScaledVector(this.face, Math.sin(this.orbit) * 0.8 - 0.35).normalize();
      const p = mid.clone().addScaledVector(dir, 2.0); p.y = 1.35 + Math.sin(this.t * 0.7) * 0.05;
      const shake = G.vhs.hot > 0.6 ? (Math.random() - 0.5) * 0.03 : 0;
      G.cineCam = { p: p.add(new V(shake, shake, 0)), look: mid.setY(0.95) };
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
    const G = this.G, h = this.h, kit = this.kit, at = this.target(), dir = at.clone().sub(this.cashPos.clone().setY(1.6)).normalize();
    const kind = this.it.kind;
    if (kind === 'shard') G.sound.stab(at, 1.3); else if (kind === 'bottle') G.sound.glass(at); else { G.sound.crunch(at); G.sound.thud(at, 1.6); }
    for (const x of G.hands) x.haptic?.(1, 120);
    G.vhs.hot = Math.min(1.3, G.vhs.hot + 0.45);
    h.body.wound(kind === 'shard' ? 'neck' : this.n % 2 ? 'head' : 'neck', at, 1.3 + this.level * 0.3);
    G.blood.spray(at, dir, 50 + this.level * 30, 1.3 + this.level * 0.3);
    G.blood.spray(at, new V(0, 1, 0).sub(dir).normalize(), 12 + this.level * 10, 0.8);
    G.blood.splat(new V(h.pos.x + dir.x * 0.5, 0, h.pos.z + dir.z * 0.5), 0.35 + this.level * 0.15);
    G.sound.grunt(h.eye(new V()), 1.2 + this.level * 0.3);
    h.body.anim.stagger = 1.2;
    if (!last) return;
    // the last one
    kit.finishKill(this.hand, this.it, h, this.level, at, dir);
    G.sound.gurgle(at);
    this.over = true; this.overT = this.t + HOLD;
  }
  end() {
    const G = this.G, { cashBody: C, camera, dolly } = this.ctx;
    this.grip.parent?.remove(this.grip); if (!this.it.gone) this.it.mesh.visible = true;
    C.anim.swing = -1; G.cineCam = null;
    if (this.vr) { camera.remove(this.shell); if (!this.back) dolly.position.copy(this.dollyWas); }
    G.finisher = null;
  }
}
