// loft.js — the skin builder. Flesh and cloth are lofted as smooth rings along
// bone chains; each ring carries its own bone weights, so joints bend like
// skin instead of hinging like toy parts. Hands, hunters and sleeves all come
// from here.
import * as THREE from '../vendor/three.module.js';

const V = THREE.Vector3;

// ring = { c: V, t: V (tangent), up: V (dorsal ref), rx, rxn, ry, ryn, n, w: [[bone, wt]..], col:[r,g,b] }
export class Loft {
  constructor() { this.P = []; this.C = []; this.UV = []; this.SI = []; this.SW = []; this.I = []; this.n = 0; }

  ringPoint(r, a, out) {
    const t = r.t.clone().normalize();
    const u = r.up.clone().addScaledVector(t, -r.up.dot(t)).normalize();
    const s = new V().crossVectors(t, u);
    const ca = Math.cos(a), sa = Math.sin(a), e = 2 / (r.n || 2);
    const cx = Math.sign(ca) * Math.pow(Math.abs(ca), e), cy = Math.sign(sa) * Math.pow(Math.abs(sa), e);
    const rx = cx >= 0 ? r.rx : (r.rxn ?? r.rx), ry = cy >= 0 ? r.ry : (r.ryn ?? r.ry);
    return out.copy(r.c).addScaledVector(s, cx * rx).addScaledVector(u, cy * ry);
  }

  pushVert(p, col, uv, w) {
    this.P.push(p.x, p.y, p.z); this.C.push(col[0], col[1], col[2]); this.UV.push(uv[0], uv[1]);
    const ww = w.slice().sort((a, b) => b[1] - a[1]).slice(0, 4); let tot = 0; for (const q of ww) tot += q[1];
    for (let k = 0; k < 4; k++) { this.SI.push(ww[k] ? ww[k][0] : 0); this.SW.push(ww[k] ? ww[k][1] / (tot || 1) : 0); }
    return this.n++;
  }

  tube(rings, seg = 12, { capStart = false, capEnd = false, colFn = null } = {}) {
    const base = this.n, p = new V();
    let len = 0;
    for (let i = 0; i < rings.length; i++) {
      if (i) len += rings[i].c.distanceTo(rings[i - 1].c);
      const r = rings[i];
      for (let j = 0; j <= seg; j++) {
        const a = j / seg * Math.PI * 2 - Math.PI / 2;
        this.ringPoint(r, a, p);
        this.pushVert(p, colFn ? colFn(r, a, i) : r.col, [j / seg, len * 6], r.w);
      }
    }
    const st = seg + 1;
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < seg; j++) {
      const a = base + i * st + j, b = a + 1, c = a + st, d = c + 1;
      this.I.push(a, c, b, b, c, d);
    }
    const cap = (ri, start) => {
      const r = rings[ri], cen = r.c.clone().addScaledVector(r.t.clone().normalize(), (start ? -1 : 1) * (r.capLen || 0));
      const ci = this.pushVert(cen, r.col, [0.5, len * 6], r.w), off = base + ri * st;
      for (let j = 0; j < seg; j++) start ? this.I.push(ci, off + j + 1, off + j) : this.I.push(ci, off + j, off + j + 1);
    };
    if (capStart) cap(0, true);
    if (capEnd) cap(rings.length - 1, false);
  }

  // ellipsoid blob around a center, weighted to given bones
  blob(c, rx, ry, rz, w, col, seg = 12, rings = 8) {
    const base = this.n, p = new V();
    for (let i = 0; i <= rings; i++) {
      const th = i / rings * Math.PI, y = Math.cos(th), s = Math.sin(th);
      for (let j = 0; j <= seg; j++) {
        const ph = j / seg * Math.PI * 2;
        p.set(c.x + Math.cos(ph) * s * rx, c.y + y * ry, c.z + Math.sin(ph) * s * rz);
        this.pushVert(p, col, [j / seg, i / rings], w);
      }
    }
    const st = seg + 1;
    for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
      const a = base + i * st + j, b = a + 1, cc = a + st, d = cc + 1;
      this.I.push(a, b, cc, b, d, cc);
    }
  }

  // mirror == true flips X (left from right) and the winding
  geometry(mirror = false) {
    const g = new THREE.BufferGeometry();
    const P = Float32Array.from(this.P);
    if (mirror) for (let i = 0; i < P.length; i += 3) P[i] = -P[i];
    const I = this.I.slice();
    if (mirror) for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; }
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('color', new THREE.BufferAttribute(Float32Array.from(this.C), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(Float32Array.from(this.UV), 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.SI, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.SW, 4));
    g.setIndex(I);
    g.computeVertexNormals();
    return g;
  }
}

// smooth weight between two bones across a joint at parameter s (0..1 along a span)
export function blend(a, b, s, center = 0.5, width = 0.25) {
  const k = Math.min(1, Math.max(0, (s - (center - width)) / (2 * width)));
  const w = k * k * (3 - 2 * k);
  return [[a, 1 - w], [b, w]];
}
export const ring = (c, t, up, rx, ry, w, col, extra = {}) => Object.assign({ c, t, up, rx, ry, w, col }, extra);
