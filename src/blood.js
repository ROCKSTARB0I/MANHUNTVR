// blood.js — droplets thrown by wounds (instanced, ballistic), splats where
// they land, and pools that spread slowly under the dead.
import * as THREE from '../vendor/three.module.js';
import { T } from './paint.js?v=17';

const V = THREE.Vector3, MAX = 400;
export class Blood {
  constructor(scene, world) {
    this.scene = scene; this.world = world;
    this.drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.008, 6, 4), new THREE.MeshStandardMaterial({ color: 0x3c0204, roughness: 0.12 }), MAX);
    this.drops.frustumCulled = false; this.drops.count = 0; scene.add(this.drops);
    this.p = []; this.v = []; this.n = 0;
    this.splats = []; this.pools = []; this.spurts = [];
    this.m = new THREE.Matrix4(); this.sz = []; this.q = new THREE.Quaternion(); this.s = new V(); this.yAxis = new V(0, 1, 0);
  }
  spray(at, dir, count = 30, power = 1) {
    for (let k = 0; k < count; k++) {
      if (this.p.length >= MAX) { this.p.shift(); this.v.shift(); this.sz.shift(); }
      const d = dir.clone().normalize().multiplyScalar(1.2 + Math.random() * 2.5 * power);
      d.x += (Math.random() - 0.5) * 1.6; d.y += Math.random() * 1.5; d.z += (Math.random() - 0.5) * 1.6;
      this.p.push(at.clone()); this.v.push(d); this.sz.push(0.5 + Math.random() * Math.random() * 2.2);
    }
  }
  // vel: landing velocity; a fast sideways hit leaves a tailed, stretched splat pointing where it was going
  splat(p, s = 0.25, vel = null) {
    const hs = vel ? Math.hypot(vel.x, vel.z) : 0, dirn = hs > 1.2;
    const map = dirn ? T.blood[4 + (Math.random() * 2 | 0)] : T.blood[Math.floor(Math.random() * 4)];
    if (!this.mats) this.mats = T.blood.map((t) => new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.14, polygonOffset: true, polygonOffsetFactor: -2 }));
    const m = new THREE.Mesh(this.quad || (this.quad = new THREE.PlaneGeometry(1, 1)), this.mats[T.blood.indexOf(map)]);
    m.rotation.x = -Math.PI / 2; m.rotation.z = dirn ? Math.atan2(-vel.z, vel.x) : Math.random() * 6.28;
    m.scale.set(s * (dirn ? 1.4 : 1), s * (dirn ? 0.8 : 1), 1); m.position.set(p.x, 0.008 + this.splats.length % 7 * 0.0006, p.z);
    this.scene.add(m); this.splats.push(m);
    if (this.splats.length > 160) { const o = this.splats.shift(); this.scene.remove(o); }
  }
  pool(p, size) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: T.blood[7], transparent: true, depthWrite: false, roughness: 0.04, metalness: 0.15, polygonOffset: true, polygonOffsetFactor: -1 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6.28; m.position.set(p.x, 0.006, p.z); m.scale.setScalar(0.01);
    this.scene.add(m); this.pools.push({ m, size, t: 0 });
  }
  // a wound that keeps pumping in pulses, following the body part it's on
  spurt(bone, local, dir, secs = 4, power = 1) { this.spurts.push({ bone, local: local.clone(), dir: dir.clone().normalize(), t: 0, secs, power, next: 0 }); }
  update(dt) {
    for (const s of this.spurts) {
      s.t += dt; s.next -= dt;
      if (s.next <= 0) {
        s.next = 0.32 + s.t * 0.05; // the pulse slows as he bleeds out
        const at = s.bone.localToWorld(s.local.clone()), fade = Math.max(0.2, 1 - s.t / s.secs);
        this.spray(at, s.dir.clone().add(new V(0, 0.4, 0)), Math.round(14 * s.power * fade), 0.9 * s.power * fade);
      }
    }
    this.spurts = this.spurts.filter((s) => s.t < s.secs);
    const g = 9.8 * dt;
    let w = 0;
    for (let i = 0; i < this.p.length; i++) {
      const p = this.p[i], v = this.v[i];
      v.y -= g; p.addScaledVector(v, dt);
      if (p.y <= 0.01) { if (Math.random() < 0.4) this.splat(p, (0.05 + Math.random() * 0.12) * (0.6 + this.sz[i] * 0.5), v); continue; }
      this.p[w] = p; this.v[w] = v; this.sz[w] = this.sz[i]; w++;
    }
    this.p.length = w; this.v.length = w; this.sz.length = w;
    // drops stretch along their flight like real thrown blood
    for (let i = 0; i < w; i++) { const v = this.v[i], sp = v.length(), k = this.sz[i]; this.q.setFromUnitVectors(this.yAxis, this.s.copy(v).divideScalar(sp || 1)); this.s.set(k, k * (1 + Math.min(4, sp * 0.6)), k); this.m.compose(this.p[i], this.q, this.s); this.drops.setMatrixAt(i, this.m); }
    this.drops.count = w; this.drops.instanceMatrix.needsUpdate = true;
    for (const P of this.pools) if (P.t < 1) { P.t = Math.min(1, P.t + dt / 25); const s = P.size * Math.sqrt(P.t) * 2.6; P.m.scale.set(s, s, 1); }
  }
  clear() {
    this.spurts = [];
    for (const s of this.splats) this.scene.remove(s); for (const P of this.pools) this.scene.remove(P.m);
    this.splats = []; this.pools = []; this.p = []; this.v = []; this.sz = [];
  }
}
