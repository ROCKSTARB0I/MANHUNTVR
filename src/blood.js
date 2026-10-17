// blood.js — droplets thrown by wounds (instanced, ballistic), splats where
// they land, and pools that spread slowly under the dead.
import * as THREE from '../vendor/three.module.js';
import { T } from './paint.js?v=2';

const V = THREE.Vector3, MAX = 400;
export class Blood {
  constructor(scene, world) {
    this.scene = scene; this.world = world;
    this.drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.012, 5, 4), new THREE.MeshStandardMaterial({ color: 0x5a0306, roughness: 0.2 }), MAX);
    this.drops.frustumCulled = false; this.drops.count = 0; scene.add(this.drops);
    this.p = []; this.v = []; this.n = 0;
    this.splats = []; this.pools = [];
    this.m = new THREE.Matrix4();
  }
  spray(at, dir, count = 30, power = 1) {
    for (let k = 0; k < count; k++) {
      if (this.p.length >= MAX) { this.p.shift(); this.v.shift(); }
      const d = dir.clone().normalize().multiplyScalar(1.2 + Math.random() * 2.5 * power);
      d.x += (Math.random() - 0.5) * 1.6; d.y += Math.random() * 1.5; d.z += (Math.random() - 0.5) * 1.6;
      this.p.push(at.clone()); this.v.push(d);
    }
  }
  splat(p, s = 0.25) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshStandardMaterial({ map: T.blood[Math.floor(Math.random() * 4)], transparent: true, depthWrite: false, roughness: 0.2, polygonOffset: true, polygonOffsetFactor: -2 - this.splats.length % 4 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6.28; m.position.set(p.x, 0.008 + Math.random() * 0.003, p.z);
    this.scene.add(m); this.splats.push(m);
    if (this.splats.length > 140) { const o = this.splats.shift(); this.scene.remove(o); o.geometry.dispose(); }
  }
  pool(p, size) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshStandardMaterial({ map: T.blood[1], color: 0x8a1010, transparent: true, depthWrite: false, roughness: 0.08, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -1 }));
    m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.006, p.z); m.scale.setScalar(0.01);
    this.scene.add(m); this.pools.push({ m, size, t: 0 });
  }
  update(dt) {
    const g = 9.8 * dt;
    let w = 0;
    for (let i = 0; i < this.p.length; i++) {
      const p = this.p[i], v = this.v[i];
      v.y -= g; p.addScaledVector(v, dt);
      if (p.y <= 0.01) { if (Math.random() < 0.35) this.splat(p, 0.1 + Math.random() * 0.25); continue; }
      this.p[w] = p; this.v[w] = v; w++;
    }
    this.p.length = w; this.v.length = w;
    for (let i = 0; i < w; i++) { this.m.makeTranslation(this.p[i].x, this.p[i].y, this.p[i].z); this.drops.setMatrixAt(i, this.m); }
    this.drops.count = w; this.drops.instanceMatrix.needsUpdate = true;
    for (const P of this.pools) if (P.t < 1) { P.t = Math.min(1, P.t + dt / 25); const s = P.size * Math.sqrt(P.t) * 2; P.m.scale.set(s, s, 1); }
  }
  clear() {
    for (const s of this.splats) this.scene.remove(s); for (const P of this.pools) this.scene.remove(P.m);
    this.splats = []; this.pools = []; this.p = []; this.v = [];
  }
}
