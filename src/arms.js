// arms.js — Cash's arms in first person. The hands ride the controllers (or the
// camera on desktop); these join each hand back to a shoulder hung under the
// head, with a two-bone IK elbow that drops down and out like a real arm.
import * as THREE from '../vendor/three.module.js';
import { T } from './paint.js?v=27';

const V = THREE.Vector3, UP = new V(0, 1, 0);
const UPPER = 0.30, FORE = 0.19;          // shoulder->elbow, sleeve start->elbow (the hand mesh carries the first 12 cm of forearm)
const WRIST = new V(0, 0.2, 0);           // in hand-model space: where the sleeve starts on the hand mesh

// a tapered sleeve segment, base at y=0, top at y=1 (scaled to length each frame)
function segment(r0, r1, mat, folds = true) {
  const g = new THREE.CylinderGeometry(r1, r0, 1, 16, 6, false); g.translate(0, 0.5, 0); // closed: never see into the sleeve
  // creases: squash the cloth a little in rings and darken them (fabric bunching)
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), a = Math.atan2(p.getZ(i), p.getX(i)), fold = Math.sin(y * 19 + Math.sin(a * 2) * 1.5) * 0.5 + 0.5;
    const s = folds ? 1 - fold * 0.06 : 1; p.setX(i, p.getX(i) * s); p.setZ(i, p.getZ(i) * s);
    const k = folds ? 0.72 + 0.28 * (1 - fold) : 0.88 + 0.12 * y; // skin: just a touch darker toward the wrist end col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.frustumCulled = false; return m;
}

export class Arms {
  constructor(scene) {
    const map = T.fleece.map.clone(); map.needsUpdate = true; map.repeat.set(2, 3);
    this.mat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.44, 0.5, 0.58, THREE.SRGBColorSpace), map, vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }); // shaded from inside too, so a sleeve near the eye isn't see-through
    // bare forearm: Cash's tan, a little darker toward the elbow
    this.skin = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.5, 0.35, 0.26, THREE.SRGBColorSpace), vertexColors: true, roughness: 0.62, bumpMap: T.skin, bumpScale: 0.0015, side: THREE.DoubleSide });
    this.arms = [1, -1].map((side) => {
      const g = new THREE.Group();
      const upper = segment(0.052, 0.058, this.mat), fore = segment(0.033, 0.042, this.skin, false);
      // the jacket sleeve rolled up thick just below the elbow
      const elbow = new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.02, 8, 16), this.mat); elbow.castShadow = true; const cap = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), this.mat); elbow.add(cap); elbow.userData.roll = true;
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.058, 14, 10), this.mat);
      g.add(upper, fore, elbow, shoulder); scene.add(g);
      return { side, g, upper, fore, elbow, shoulder };
    });
    this._q = new THREE.Quaternion(); this._a = new V(); this._b = new V(); this._c = new V(); this._f = new V(); this._r = new V();
  }
  // lay a segment from a to b
  lay(m, a, b) { const d = this._c.copy(b).sub(a), L = d.length(); m.position.copy(a); m.quaternion.setFromUnitVectors(UP, d.divideScalar(L || 1)); m.scale.set(1, L, 1); }
  visibleChain(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }

  update(camera, hands) {
    camera.updateMatrixWorld();
    const head = camera.getWorldPosition(this._a);
    const f = this._f.set(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(this._q)); f.y = 0;
    if (f.lengthSq() < 1e-4) f.set(0, 0, -1); f.normalize();
    const r = this._r.crossVectors(f, UP).normalize();
    for (const A of this.arms) {
      const h = hands.find((x) => (x.side === 'R' ? 1 : -1) === A.side);
      const show = !!h && this.visibleChain(h.model?.group);
      A.g.visible = show; if (!show) continue;
      // shoulder: below and behind the eyes, out to the side, turning with the body (yaw only)
      const S = head.clone().addScaledVector(UP, -0.25).addScaledVector(r, 0.19 * A.side).addScaledVector(f, -0.07);
      h.model.group.updateMatrixWorld(); const W = h.model.group.localToWorld(WRIST.clone());
      // two-bone IK, elbow pulled down, out and a little back
      const d = W.clone().sub(S); let len = d.length(); const n = d.divideScalar(len || 1);
      len = Math.min(len, UPPER + FORE - 0.002);
      const ca = Math.max(-1, Math.min(1, (UPPER * UPPER + len * len - FORE * FORE) / (2 * UPPER * len))), sa = Math.sqrt(1 - ca * ca);
      const pole = new V().addScaledVector(UP, -1).addScaledVector(r, 0.55 * A.side).addScaledVector(f, -0.25);
      pole.addScaledVector(n, -pole.dot(n)); if (pole.lengthSq() < 1e-5) pole.copy(r).multiplyScalar(A.side); pole.normalize();
      const E = S.clone().addScaledVector(n, UPPER * ca).addScaledVector(pole, UPPER * sa);
      this.lay(A.upper, E, S); this.lay(A.fore, W, E);
      // the rolled cuff sits a few cm down the forearm, ringing it
      const fd = W.clone().sub(E).normalize(); A.elbow.position.copy(E).addScaledVector(fd, 0.035); A.elbow.quaternion.setFromUnitVectors(new V(0, 0, 1), fd); A.shoulder.position.copy(S);
    }
  }
}
