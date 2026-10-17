// setkit.js — the tools a scene's set (sets.js) uses to dress its traced map:
// everything is placed in plan cells (the radar map's grid) and stands on the
// floor height there. Vehicles, signs, a basketball court, shop shutters,
// awnings, fences, fires, lamps, graffiti — what the real scenes are made of.
import * as THREE from '../vendor/three.module.js';
import { T } from './paint.js?v=20';

const V = THREE.Vector3;
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

export function makeKit(D, { X, Z, Hc, m }) {
  const mat = (k, o) => D.mat('k_' + k, o);
  const wx = (i) => X(i), wz = (j) => Z(j), fy = (i, j) => Hc(i, j);
  const solid = (x0, x1, z0, z1, y0, y1, see = true) => D.boxes.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0, y1, see });
  // a group at a plan cell, on the floor, turned ry; with a solid footprint (w x d metres)
  const place = (g, i, j, ry = 0, w = 0, d = 0, h = 2) => {
    const x = wx(i), z = wz(j), y = fy(i, j); g.position.set(x, y, z); g.rotation.y = ry; D.root.add(g);
    if (w) { const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)), hx = (w * c + d * s) / 2, hz = (w * s + d * c) / 2; solid(x - hx, x + hx, z - hz, z + hz, y, y + h); }
    return g;
  };
  const glass = () => mat('glass', { color: 0x0a0d10, roughness: 0.08, metalness: 0.85 });
  const rubber = () => mat('rubber', { color: 0x121212, roughness: 0.9 });
  const wheels = (g, xs, zs, r = 0.4) => { for (const sx of xs) for (const sz of zs) { const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.28, 14), rubber()); w.rotation.z = Math.PI / 2; w.position.set(sx, r, sz); g.add(w); } };
  // white box-body with a coloured stripe and lettering, used for the box truck and ambulance
  const bodyTex = (stripe, text, cross) => canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#d8d6ce'; g.fillRect(0, 0, w, h); for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(60,50,40,${Math.random() * 0.08})`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 30, 1 + Math.random() * 3); }
    g.fillStyle = stripe; g.fillRect(0, h * 0.62, w, h * 0.12);
    if (text) { g.fillStyle = stripe; g.font = 'bold 52px Arial'; g.fillText(text, 30, h * 0.48); }
    if (cross) { g.fillStyle = '#c8241c'; g.fillRect(w * 0.7, h * 0.18, 70, 22); g.fillRect(w * 0.7 + 24, h * 0.18 - 24, 22, 70); }
    const gr = g.createLinearGradient(0, h, 0, h * 0.5); gr.addColorStop(0, 'rgba(40,30,20,0.55)'); gr.addColorStop(1, 'rgba(40,30,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); // road grime
  });
  const K = {
    X, Z, m, fy, mat, solid, place,
    prop: (kind, i, j, ry = 0) => D.prop(kind, wx(i), wz(j), ry),
    fire: (i, j) => D.fire(wx(i), wz(j)),
    lamp: (i, j, o = {}) => D.lamp(wx(i), wz(j), o),
    graffiti: (i, j, ry, y = 2.2, w = 3, k) => D.graffiti(wx(i), y + fy(i, j), wz(j), ry, w, k),
    // chain-link from cell to cell, standing on the floor
    fence: (i0, j0, i1, j1, h = 3.2) => { const n0 = D.root.children.length, b0 = D.boxes.length; D.fence(wx(i0), wz(j0), wx(i1), wz(j1), h); const y = fy((i0 + i1) / 2, (j0 + j1) / 2); if (y) { for (let k = n0; k < D.root.children.length; k++) D.root.children[k].position.y += y; for (let k = b0; k < D.boxes.length; k++) { D.boxes[k].y0 += y; D.boxes[k].y1 += y; } } },
    // a painted sign on a wall: text on a plate, optionally lit
    sign: (text, i, j, ry, { w = 3, h = 0.7, y = 3, bg = '#d8d2c0', fg = '#1a1a1a', font = 'bold 64px Arial', lit = false, border = null } = {}) => {
      const t = canvasTex(Math.round(256 * w / h), 256, (g, cw, ch) => { if (bg) { g.fillStyle = bg; g.fillRect(0, 0, cw, ch); } if (border) { g.strokeStyle = border; g.lineWidth = 14; g.strokeRect(7, 7, cw - 14, ch - 14); } g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; const lines = text.split('\n'); lines.forEach((l, k) => g.fillText(l, cw / 2, ch / 2 + (k - (lines.length - 1) / 2) * 70)); for (let k = 0; k < 300; k++) { g.fillStyle = `rgba(40,30,20,${Math.random() * 0.12})`; g.fillRect(Math.random() * cw, Math.random() * ch, 3 + Math.random() * 20, 2); } });
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, transparent: !bg, depthWrite: !!bg, emissive: lit ? 0xffffff : 0x000000, emissiveMap: lit ? t : null, emissiveIntensity: lit ? 0.7 : 0, polygonOffset: true, polygonOffsetFactor: -2 }));
      s.position.set(wx(i), y + fy(i, j), wz(j)); s.rotation.y = ry; D.root.add(s); return s;
    },
    // neon shop sign: glowing letters and a coloured light
    neon: (text, i, j, ry, col = '#ff3a6a', y = 3.2, w = 2.4) => {
      const t = canvasTex(512, 160, (g, cw, ch) => { g.fillStyle = '#000'; g.fillRect(0, 0, cw, ch); g.shadowColor = col; g.shadowBlur = 24; g.fillStyle = col; g.font = 'bold 96px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, cw / 2, ch / 2); g.fillText(text, cw / 2, ch / 2); });
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 160 / 512), new THREE.MeshBasicMaterial({ map: t, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); s.position.set(wx(i), y + fy(i, j), wz(j)); s.rotation.y = ry; D.root.add(s);
      const L = new THREE.PointLight(new THREE.Color(col), 4, 6, 2); L.position.copy(s.position).add(new V(Math.sin(ry), -0.4, Math.cos(ry)).multiplyScalar(0.8)); D.root.add(L); return s;
    },
    // a rolled-down metal shop shutter on a wall face
    shutter: (i, j, ry, w = 3, h = 2.8) => {
      const t = T.corrugated.map.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(w / 2.5, h / 2.5); t.rotation = Math.PI / 2;
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, color: 0x8a8678, roughness: 0.6, metalness: 0.5, polygonOffset: true, polygonOffsetFactor: -1 }));
      s.position.set(wx(i), h / 2 + fy(i, j), wz(j)); s.rotation.y = ry; D.root.add(s); D.graffiti(s.position.x + Math.sin(ry) * 0.01, 1.3 + fy(i, j), s.position.z + Math.cos(ry) * 0.01, ry, w * 0.9); return s;
    },
    // a canvas shop awning sticking out of a wall
    awning: (i, j, ry, w = 4, col = 0x7a1a14) => { const g = new THREE.Group(); const a = new THREE.Mesh(box(w, 0.08, 1.4), mat('awn' + col, { color: col, roughness: 0.9 })); a.position.set(0, 3.0, 0.7); a.rotation.x = 0.35; g.add(a); return place(g, i, j, ry); },
    // an air-conditioning unit bolted to a wall
    ac: (i, j, ry, y = 3.2) => { const g = new THREE.Group(); const b = new THREE.Mesh(box(0.9, 0.55, 0.6), mat('ac', { map: T.van.map, color: 0xb8b4a8, roughness: 0.6, metalness: 0.4 })); b.position.set(0, y, 0.3); g.add(b); const grille = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), mat('acg', { color: 0x222222 })); grille.position.set(0.15, y, 0.61); g.add(grille); return place(g, i, j, ry); },
    // a heap of brick rubble
    rubble: (i, j, r = 1.6, h = 1.0) => { const g = new THREE.Group(); const brk = mat('rub', { map: T.brick.map, color: 0x8a7a6a, roughness: 1 }); for (let k = 0; k < 9; k++) { const c = new THREE.Mesh(new THREE.DodecahedronGeometry(r * (0.35 + Math.random() * 0.4), 0), brk); c.position.set((Math.random() - 0.5) * r, h * (0.2 + Math.random() * 0.3), (Math.random() - 0.5) * r); c.scale.y = 0.55; c.rotation.set(Math.random(), Math.random(), Math.random()); g.add(c); } return place(g, i, j, Math.random() * 6, r * 1.4, r * 1.4, h); },
    // blood on the floor (the cellar)
    blood: (i, j, s = 1.6) => { const k = Math.floor(Math.random() * 8), t = T.blood[k]; const d = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 0.15, polygonOffset: true, polygonOffsetFactor: -3 })); d.rotation.x = -Math.PI / 2; d.rotation.z = Math.random() * 6; d.position.set(wx(i), fy(i, j) + 0.015, wz(j)); D.root.add(d); },
    // a bare bulb hanging indoors
    bulb: (i, j, o = {}) => D.lamp(wx(i), wz(j), { h: 3.0, r: 7, i: 0.8, arm: 'none', col: 0xffe2a0, ...o }),
    tree: (i, j, size = 3) => D.tree(wx(i), wz(j), size),
    // ---- vehicles
    boxTruck: (i, j, ry = 0) => { // the white box truck with the blue stripe (Born Again's car park)
      const g = new THREE.Group(); const bt = bodyTex('#2a4a9a');
      const side = new THREE.MeshStandardMaterial({ map: bt, roughness: 0.6 }), plain = mat('bt_end', { color: 0xd0cec6, roughness: 0.6 });
      const cargo = new THREE.Mesh(box(2.4, 2.6, 5.2), [side, side, plain, plain, plain, plain]); // box faces: +x, -x, +y, -y, +z, -z
      cargo.position.set(0, 2.0, -0.9); g.add(cargo);
      const cab = new THREE.Mesh(box(2.3, 1.7, 1.8), mat('bt_cab', { color: 0xd6d4cc, roughness: 0.5, metalness: 0.2 })); cab.position.set(0, 1.45, 2.5); g.add(cab);
      const ws = new THREE.Mesh(box(2.0, 0.75, 0.05), glass()); ws.position.set(0, 1.85, 3.41); g.add(ws);
      const grille = new THREE.Mesh(box(2.1, 0.5, 0.06), mat('bt_grille', { color: 0x2a4a9a, roughness: 0.5 })); grille.position.set(0, 0.95, 3.42); g.add(grille);
      wheels(g, [-1.1, 1.1], [-2.6, -1.4, 2.6], 0.48); g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      return place(g, i, j, ry, 2.5, 7.2, 3.2);
    },
    ambulance: (i, j, ry = 0) => {
      const g = new THREE.Group(); const t = bodyTex('#c8241c', 'AMBULANCE', true);
      const b = new THREE.Mesh(box(2.3, 2.3, 5.6), [new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }), mat('amb_top', { color: 0xdedcd4 }), mat('amb_top', { color: 0xdedcd4 }), mat('amb_end', { color: 0xdedcd4 }), mat('amb_end', { color: 0xdedcd4 })]);
      b.position.set(0, 1.55, 0); g.add(b);
      const ws = new THREE.Mesh(box(2.0, 0.7, 0.05), glass()); ws.position.set(0, 2.0, 2.81); g.add(ws);
      for (const sx of [-0.7, 0.7]) { const l = new THREE.Mesh(box(0.35, 0.18, 0.3), mat('amb_light' + sx, { color: sx < 0 ? 0xc81a14 : 0xd8d8d0, emissive: sx < 0 ? 0x400000 : 0x202020 })); l.position.set(sx, 2.8, 2.4); g.add(l); }
      wheels(g, [-1.05, 1.05], [-1.9, 1.9], 0.42); g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      return place(g, i, j, ry, 2.4, 5.8, 3);
    },
    flippedPickup: (i, j, ry = 0) => { // the orange pickup lying on its side in the alley
      const g = new THREE.Group(), inner = new THREE.Group(); inner.rotation.z = Math.PI / 2; inner.position.y = 1.0; g.add(inner);
      const paint = mat('pk_paint', { map: T.barrel.map, color: 0xc06a28, roughness: 0.7, metalness: 0.3 });
      const bed = new THREE.Mesh(box(1.9, 0.9, 2.2), paint); bed.position.set(0, 0.75, -1.2); inner.add(bed);
      const cab = new THREE.Mesh(box(1.9, 1.5, 1.6), paint); cab.position.set(0, 1.05, 0.7); inner.add(cab);
      const hood = new THREE.Mesh(box(1.9, 0.8, 1.4), paint); hood.position.set(0, 0.7, 2.2); inner.add(hood);
      const ws = new THREE.Mesh(box(1.7, 0.6, 0.05), glass()); ws.position.set(0, 1.45, 1.5); inner.add(ws);
      wheels(inner, [-1.0, 1.0], [-1.6, 2.0], 0.42); g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      return place(g, i, j, ry, 2.0, 5.2, 2.2);
    },
    car: (i, j, ry = 0) => D.prop('car', wx(i), wz(j), ry),
    van: (i, j, ry = 0) => D.prop('van', wx(i), wz(j), ry),
    // ---- a basketball court: painted lines, two hoops, cracked asphalt, floodlit
    court: (i0, j0, i1, j1) => {
      const x0 = wx(i0), x1 = wx(i1), z0 = wz(j0), z1 = wz(j1), y = fy((i0 + i1) / 2, (j0 + j1) / 2) + 0.012, L = x1 - x0, Wd = z1 - z0;
      const t = canvasTex(1024, 560, (g, w, h) => { g.strokeStyle = 'rgba(232,228,214,0.82)'; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20); g.beginPath(); g.moveTo(w / 2, 10); g.lineTo(w / 2, h - 10); g.stroke(); g.beginPath(); g.arc(w / 2, h / 2, 70, 0, 7); g.stroke(); for (const s of [0, 1]) { const x = s ? w - 10 : 10, d = s ? -1 : 1; g.strokeRect(s ? w - 10 - 190 : 10, h / 2 - 85, 190, 170); g.beginPath(); g.arc(x + d * 190, h / 2, 85, s ? Math.PI / 2 : -Math.PI / 2, s ? Math.PI * 1.5 : Math.PI / 2, s === 1); g.stroke(); g.beginPath(); g.arc(x, h / 2, 260, s ? Math.PI * 0.62 : -Math.PI * 0.38, s ? Math.PI * 1.38 : Math.PI * 0.38); g.stroke(); } for (let k = 0; k < 1600; k++) { g.clearRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 16, 2 + Math.random() * 3); } });
      const lines = new THREE.Mesh(new THREE.PlaneGeometry(L, Wd), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      lines.rotation.x = -Math.PI / 2; lines.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); D.root.add(lines);
      const metal = mat('hoop', { color: 0x3a3c3e, metalness: 0.7, roughness: 0.5 }), board = mat('board', { color: 0xc8c4b8, roughness: 0.7 }), rim = mat('rim', { color: 0xb84a1a, metalness: 0.6, roughness: 0.4 });
      for (const s of [-1, 1]) {
        const g = new THREE.Group(); const px = s < 0 ? x0 + 0.3 : x1 - 0.3, cz = (z0 + z1) / 2; g.position.set(px, y, cz); g.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 8), metal); pole.position.set(0, 1.7, -0.5); g.add(pole);
        const arm = new THREE.Mesh(box(0.08, 0.08, 0.9), metal); arm.position.set(0, 3.3, -0.1); g.add(arm);
        const bd = new THREE.Mesh(box(1.8, 1.05, 0.05), board); bd.position.set(0, 3.45, 0.35); g.add(bd);
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.015, 6, 20), rim); r.rotation.x = Math.PI / 2; r.position.set(0, 3.05, 0.62); g.add(r);
        D.root.add(g); solid(px - 0.2, px + 0.2, cz - 0.2, cz + 0.2, y, y + 3.5);
      }
    },
    // an open doorway with a dark recess and a frame (the start room door, the exit door)
    doorway: (i, j, ry, w = 1.3, h = 2.3) => { const g = new THREE.Group(); const dark = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat('doordark', { color: 0x050505, roughness: 1 })); dark.position.set(0, h / 2, 0.02); g.add(dark); const fr = mat('doorframe', { color: 0x3a3630, roughness: 0.8 }); for (const sx of [-1, 1]) { const p = new THREE.Mesh(box(0.12, h + 0.1, 0.12), fr); p.position.set(sx * (w / 2 + 0.06), h / 2, 0.05); g.add(p); } const top = new THREE.Mesh(box(w + 0.24, 0.12, 0.12), fr); top.position.set(0, h + 0.06, 0.05); g.add(top); return place(g, i, j, ry); },
    // a bank of wheelie bins / dumpster against a wall
    bins: (i, j, ry = 0, n = 2) => { for (let k = 0; k < n; k++) { const g = new THREE.Group(); const b = new THREE.Mesh(box(0.6, 1.05, 0.7), mat('bin', { color: 0x2c3a2c, roughness: 0.6 })); b.position.y = 0.53; g.add(b); const l = new THREE.Mesh(box(0.64, 0.06, 0.74), mat('binlid', { color: 0x1e2a1e })); l.position.y = 1.08; g.add(l); place(g, i + Math.cos(ry) * k * 0.7 / m, j - Math.sin(ry) * k * 0.7 / m, ry, 0.6, 0.7, 1.1); } },
  };
  return K;
}
