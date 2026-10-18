// setkit.js — the tools a scene's set (sets.js) uses to dress its traced map:
// everything is placed in plan cells (the radar map's grid) and stands on the
// floor height there. Vehicles, signs, a basketball court, shop shutters,
// awnings, fences, fires, lamps, graffiti — what the real scenes are made of.
import * as THREE from '../vendor/three.module.js';
import { T } from './paint.js?v=46';

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
    // White Trash: the Skinz' junkyard
    quonset: (i, j, ry, len = 12, r = 4) => { const g = new THREE.Group(), cm = mat('quonset', { map: T.corrugated.map, color: 0x6a7a52, roughness: 0.7, metalness: 0.4, side: THREE.DoubleSide });
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 24, 1, true, -Math.PI / 2, Math.PI), cm); shell.rotation.z = Math.PI / 2; shell.rotation.y = 0; g.add(shell);
      const endM = mat('quonsetEnd', { color: 0x3a3a34, roughness: 0.8, side: THREE.DoubleSide });
      for (const s2 of [1, -1]) { const e = new THREE.Mesh(new THREE.CircleGeometry(r, 24, 0, Math.PI), endM); e.position.x = s2 * len / 2; e.rotation.y = s2 * Math.PI / 2; g.add(e); }
      const door = new THREE.Mesh(box(0.05, 2.2, 1.6), mat('qdoor', { color: 0x1e2018, roughness: 0.6, metalness: 0.5 })); door.position.set(len / 2 + 0.03, 1.1, 0); g.add(door);
      return place(g, i, j, ry, len, r * 2, r); },
    crane: (i, j, ry) => { const g = new THREE.Group(), y = mat('craneY', { color: 0xc8981a, roughness: 0.55, metalness: 0.3 }), dk = mat('craneD', { color: 0x1a1a18, roughness: 0.7 });
      const base = new THREE.Mesh(box(2.4, 1.2, 3.2), y); base.position.y = 0.9; g.add(base); for (const s2 of [1, -1]) { const t = new THREE.Mesh(box(0.6, 0.6, 3.6), dk); t.position.set(s2 * 1.2, 0.3, 0); g.add(t); }
      const cab = new THREE.Mesh(box(1.4, 1.4, 1.4), y); cab.position.set(-0.4, 2.2, 0.6); g.add(cab); const gl = new THREE.Mesh(box(1.42, 0.6, 1.2), mat('glass', { color: 0x0a0d10, roughness: 0.08, metalness: 0.85 })); gl.position.set(-0.4, 2.5, 0.65); g.add(gl);
      const boom = new THREE.Mesh(box(0.4, 0.4, 9), y); boom.position.set(0.6, 5.6, -2.6); boom.rotation.x = 0.85; g.add(boom);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 6, 4), dk); cable.position.set(0.6, 6.4, -6.0); g.add(cable); const hook = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 6, 10, 4), dk); hook.position.set(0.6, 3.3, -6.0); g.add(hook);
      return place(g, i, j, ry, 3, 3.6, 3); },
    trailer: (i, j, ry, len = 9) => { const g = new THREE.Group(), w = mat('trailer', { map: T.van.map, color: 0x9a968a, roughness: 0.6, metalness: 0.4 });
      const b = new THREE.Mesh(box(2.5, 2.5, len), w); b.position.y = 1.55; g.add(b); for (const s2 of [1, -1]) { const st = new THREE.Mesh(box(2.52, 0.12, len), mat('trailerStripe', { color: 0x6a2018 })); st.position.y = 1.0 + (s2 > 0 ? 1.4 : 0); g.add(st); }
      const win = new THREE.Mesh(box(2.54, 0.5, 0.7), mat('trailerWin', { color: 0xc8c070, emissive: 0x8a7a30, emissiveIntensity: 0.6 })); win.position.set(0, 2.1, len * 0.3); g.add(win); // the toilet window, lit
      const door = new THREE.Mesh(box(2.54, 1.9, 0.8), mat('trailerDoor', { color: 0x4a4a44 })); door.position.set(0, 1.25, -len * 0.15); g.add(door);
      for (const z of [-len * 0.3, len * 0.3]) for (const s2 of [1, -1]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12), rubber()); t.rotation.z = Math.PI / 2; t.position.set(s2 * 1.1, 0.4, z); g.add(t); }
      return place(g, i, j, ry, 2.6, len, 2.8); },
    guardhouse: (i, j, ry) => { const g = new THREE.Group(), c = mat('ghouse', { map: T.concrete.map, color: 0x8a8678, roughness: 0.9 });
      const b = new THREE.Mesh(box(2.6, 2.6, 2.6), c); b.position.y = 1.3; g.add(b); const roof = new THREE.Mesh(box(3, 0.2, 3), mat('ghroof', { color: 0x2a2a28 })); roof.position.y = 2.7; g.add(roof);
      const win = new THREE.Mesh(box(1.4, 0.7, 0.05), mat('ghwin', { color: 0xd8d090, emissive: 0xb8a850, emissiveIntensity: 0.8 })); win.position.set(0, 1.6, 1.31); g.add(win);
      const sw = new THREE.Mesh(box(0.25, 0.35, 0.08), mat('switch', { color: 0x8a1a10, emissive: 0x6a0a04, emissiveIntensity: 0.6 })); sw.position.set(0.9, 1.3, 1.34); g.add(sw);
      return place(g, i, j, ry, 2.6, 2.6, 2.7); },
    tank: (i, j, ry) => { const g = new THREE.Group(), m2 = mat('tank', { color: 0x4a6a5a, roughness: 0.5, metalness: 0.4 }); const t = new THREE.Mesh(new THREE.CapsuleGeometry(0.8, 2.2, 6, 14), m2); t.rotation.z = Math.PI / 2; t.position.y = 1.2; g.add(t); for (const x of [-0.9, 0.9]) { const l = new THREE.Mesh(box(0.2, 0.5, 1.2), mat('tankleg', { color: 0x2a2a28 })); l.position.set(x, 0.25, 0); g.add(l); } return place(g, i, j, ry, 3.8, 1.7, 2); },
    tyres: (i, j, n = 5) => { const g = new THREE.Group(); for (let k = 0; k < n; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.14, 8, 16), rubber()); t.rotation.x = Math.PI / 2; t.position.set((Math.random() - 0.5) * 0.12, 0.14 + k * 0.27, (Math.random() - 0.5) * 0.12); g.add(t); } return place(g, i, j, Math.random() * 6, 1, 1, n * 0.27); },
    drums: (i, j, n = 4) => { for (let k = 0; k < n; k++) D.prop('barrel', wx(i + (k % 2) * 1.3), wz(j + Math.floor(k / 2) * 1.3), Math.random() * 6); },
    // Fuelled By Hate: open containers, scrap mounds, the crusher, the raised guard hut, the fuse box
    container: (i, j, ry, col = 0x7a4a2a) => { const g = new THREE.Group(), cm = mat('cont' + col, { map: T.corrugated.map, color: col, roughness: 0.7, metalness: 0.4, side: THREE.DoubleSide }), L = 6, Wd = 2.4, Hh = 2.6;
      for (const [w, h, d, x, y, z] of [[L, Hh, 0.06, 0, Hh / 2, Wd / 2], [L, Hh, 0.06, 0, Hh / 2, -Wd / 2], [L, 0.06, Wd, 0, Hh, 0], [0.06, Hh, Wd, -L / 2, Hh / 2, 0]]) { const p = new THREE.Mesh(box(w, h, d), cm); p.position.set(x, y, z); p.castShadow = true; g.add(p); }
      const door = new THREE.Mesh(box(0.06, Hh, Wd / 2), cm); door.position.set(L / 2 + 0.5, Hh / 2, Wd / 2 + 0.5); door.rotation.y = 1.2; g.add(door);
      place(g, i, j, ry); const x = wx(i), z = wz(j), y = fy(i, j), c = Math.cos(ry), sn = Math.sin(ry);
      for (const [lx, lz, w, d] of [[0, Wd / 2, L, 0.15], [0, -Wd / 2, L, 0.15], [-L / 2, 0, 0.15, Wd]]) { const px = x + lx * c + lz * sn, pz = z - lx * sn + lz * c, hx = (Math.abs(w * c) + Math.abs(d * sn)) / 2, hz = (Math.abs(w * sn) + Math.abs(d * c)) / 2; solid(px - hx, px + hx, pz - hz, pz + hz, y, y + Hh); }
      return g; },
    mound: (i, j, r = 4, h = 3) => { const g = new THREE.Group(), sm = mat('mound', { map: T.scrap.map, color: 0x5a5650, roughness: 0.8, metalness: 0.3 });
      for (let k = 0; k < 7; k++) { const c = new THREE.Mesh(new THREE.DodecahedronGeometry(r * (0.4 + Math.random() * 0.35), 1), sm); c.position.set((Math.random() - 0.5) * r, h * (0.2 + Math.random() * 0.25), (Math.random() - 0.5) * r); c.scale.y = 0.6; c.rotation.set(Math.random(), Math.random(), Math.random()); c.castShadow = true; g.add(c); }
      return place(g, i, j, Math.random() * 6, r * 1.3, r * 1.3, h); },
    crusher: (i, j, ry) => { const g = new THREE.Group(), gm = mat('crusherG', { color: 0x3a5a3a, roughness: 0.6, metalness: 0.5 }), dk = mat('crusherD', { color: 0x1c1c1a, roughness: 0.7, metalness: 0.5 }), rust = mat('crusherR', { color: 0x6a3a1c, roughness: 0.9 });
      const body = new THREE.Mesh(box(5, 3.2, 4), gm); body.position.y = 1.6; g.add(body); const hop = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 1.6, 1.6, 4, 1, true), rust); hop.position.y = 4; hop.rotation.y = Math.PI / 4; g.add(hop);
      const press = new THREE.Mesh(box(4.6, 0.5, 3.6), dk); press.position.y = 5.4; g.add(press); for (const s2 of [1, -1]) { const ram = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.4, 10), dk); ram.position.set(s2 * 1.6, 6.4, 0); g.add(ram); }
      const belt = new THREE.Mesh(box(1.4, 0.2, 9), dk); belt.position.set(0, 2.6, -6.2); belt.rotation.x = -0.32; g.add(belt); for (let k = 0; k < 4; k++) { const leg = new THREE.Mesh(box(0.15, 1 + k * 0.8, 0.15), gm); leg.position.set(0, (1 + k * 0.8) / 2, -9.5 + k * 2.2); g.add(leg); }
      const stairs = new THREE.Group(); for (let k = 0; k < 10; k++) { const st = new THREE.Mesh(box(1, 0.08, 0.32), dk); st.position.set(3.1, 0.32 * k + 0.1, 1.9 - k * 0.3); stairs.add(st); } g.add(stairs);
      return place(g, i, j, ry, 5.4, 4.4, 5.5); },
    hutRaised: (i, j, ry) => { const g = new THREE.Group(), wd = mat('hutW', { map: T.wood.map, color: 0x8a7a64, roughness: 0.9 }), dk = mat('hutD', { color: 0x2a2826, roughness: 0.8 });
      for (const [x, z] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) { const leg = new THREE.Mesh(box(0.2, 2.6, 0.2), dk); leg.position.set(x, 1.3, z); g.add(leg); }
      const cab = new THREE.Mesh(box(3, 2.4, 3), wd); cab.position.y = 3.8; g.add(cab); const roof = new THREE.Mesh(box(3.4, 0.2, 3.4), dk); roof.position.y = 5.1; g.add(roof);
      const tv = new THREE.Mesh(box(1.6, 0.6, 0.05), mat('hutTV', { color: 0x9ab8d8, emissive: 0x6a88b8, emissiveIntensity: 1.4 })); tv.position.set(0, 4.1, 1.52); g.add(tv); g.userData.tv = tv;
      for (let k = 0; k < 9; k++) { const st = new THREE.Mesh(box(1, 0.08, 0.3), dk); st.position.set(2, 0.28 * k + 0.1, 1.6 - k * 0.3); g.add(st); }
      const gateM = new THREE.Mesh(box(0.05, 1.1, 1), mat('hutGate', { color: 0x4a4640, metalness: 0.7, roughness: 0.5 })); gateM.position.set(1.5, 0.6, 1.9); g.add(gateM);
      return place(g, i, j, ry, 3, 3, 5.2); },
    fusebox: (i, j, ry) => { const g = new THREE.Group(), p = new THREE.Mesh(box(0.15, 1.8, 0.15), mat('pole', { color: 0x3a3632 })); p.position.y = 0.9; g.add(p);
      const b = new THREE.Mesh(box(0.5, 0.6, 0.25), mat('fuse', { color: 0x6a6a5a, metalness: 0.6, roughness: 0.5 })); b.position.set(0, 1.4, 0.2); g.add(b); const l = new THREE.Mesh(box(0.06, 0.06, 0.02), mat('fuseL', { color: 0x30ff40, emissive: 0x20c030, emissiveIntensity: 1 })); l.position.set(0.15, 1.6, 0.33); g.add(l); g.userData.led = l;
      return place(g, i, j, ry, 0.5, 0.5, 1.8); },
    timber: (i, j, ry) => { const g = new THREE.Group(), w = mat('timber', { map: T.wood.map, color: 0x9a8060, roughness: 1 }); for (let k = 0; k < 12; k++) { const b = new THREE.Mesh(box(4, 0.2, 0.2), w); b.position.set(0, 0.1 + Math.floor(k / 4) * 0.21, -0.35 + (k % 4) * 0.23); g.add(b); } return place(g, i, j, ry, 4, 1, 0.7); },
    // Grounds for Assault: the zoo
    cave: (i, j, ry, r = 3.2) => { const g = new THREE.Group(), rk = mat('rock', { map: T.concrete.map, color: 0x7a7468, roughness: 1 });
      for (let k = 0; k < 9; k++) { const a = Math.PI * (0.15 + k * 0.09) * 2 - Math.PI * 0.2; if (Math.cos(a) > 0.85) continue; const c = new THREE.Mesh(new THREE.DodecahedronGeometry(r * (0.45 + Math.random() * 0.25), 1), rk); c.position.set(Math.sin(a) * r, r * 0.45 + Math.random() * 0.5, -Math.cos(a) * r * 0.9); c.scale.y = 0.8; c.castShadow = true; g.add(c); const sx = g.position; }
      const roof = new THREE.Mesh(new THREE.SphereGeometry(r * 1.15, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), mat('rockIn', { map: T.concrete.map, color: 0x4a463e, roughness: 1, side: THREE.DoubleSide })); roof.position.y = r * 0.6; roof.scale.y = 0.7; g.add(roof);
      place(g, i, j, ry); const x = wx(i), z = wz(j), y = fy(i, j), c = Math.cos(ry), sn = Math.sin(ry);
      for (const [lx, lz] of [[-r, 0], [r, 0], [0, -r]]) { const px = x + lx * c + lz * sn, pz = z - lx * sn + lz * c; solid(px - 0.9, px + 0.9, pz - 0.9, pz + 0.9, y, y + 3); }
      return g; },
    rocks: (i, j, r = 3, h = 2.4) => { const g = new THREE.Group(), rk = mat('rock', { map: T.concrete.map, color: 0x7a7468, roughness: 1 }); for (let k = 0; k < 6; k++) { const c = new THREE.Mesh(new THREE.DodecahedronGeometry(r * (0.4 + Math.random() * 0.3), 1), rk); c.position.set((Math.random() - 0.5) * r, h * (0.25 + Math.random() * 0.3), (Math.random() - 0.5) * r); c.scale.y = 0.75; c.castShadow = true; g.add(c); } return place(g, i, j, Math.random() * 6, r * 1.2, r * 1.2, h); },
    platform: (i, j, ry) => { const g = new THREE.Group(), wd = mat('deck', { map: T.wood.map, color: 0x7a6a54, roughness: 0.9 });
      for (const [x, z] of [[-1.4, -1], [1.4, -1], [-1.4, 1], [1.4, 1]]) { const p = new THREE.Mesh(box(0.2, 3.4, 0.2), wd); p.position.set(x, 1.7, z); g.add(p); }
      const deck = new THREE.Mesh(box(3.2, 0.15, 2.4), wd); deck.position.y = 3.4; g.add(deck); for (const z of [-1.2, 1.2]) { const r = new THREE.Mesh(box(3.2, 0.08, 0.06), wd); r.position.set(0, 4.3, z); g.add(r); }
      for (let k = 0; k < 11; k++) { const rung = new THREE.Mesh(box(0.5, 0.05, 0.05), wd); rung.position.set(1.7, 0.3 + k * 0.3, 0); g.add(rung); }
      return place(g, i, j, ry, 3.2, 2.4, 3.6); },
    statue: (i, j, ry) => { const g = new THREE.Group(), st = mat('statue', { map: T.concrete.map, color: 0x9a968a, roughness: 0.9 });
      const plinth = new THREE.Mesh(box(1.6, 1.4, 1.6), st); plinth.position.y = 0.7; g.add(plinth);
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 10), st); body.scale.set(1.3, 0.9, 0.8); body.position.y = 2.1; g.add(body); const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), st); head.position.set(0.95, 2.6, 0); g.add(head);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 1, 8), st); trunk.position.set(1.3, 2.1, 0); trunk.rotation.z = 0.3; g.add(trunk); for (const [x, z] of [[-0.5, -0.3], [-0.5, 0.3], [0.5, -0.3], [0.5, 0.3]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.7, 8), st); l.position.set(x, 1.55, z); g.add(l); }
      return place(g, i, j, ry, 1.6, 1.6, 3); },
    vending: (i, j, ry, col = 0xb01c1c) => { const g = new THREE.Group(); const b = new THREE.Mesh(box(0.9, 1.9, 0.75), mat('vend' + col, { color: col, roughness: 0.4, metalness: 0.3 })); b.position.y = 0.95; g.add(b);
      const p = new THREE.Mesh(box(0.55, 1.1, 0.02), mat('vendP', { color: 0xd8e0e8, emissive: 0xa8c0d8, emissiveIntensity: 0.9 })); p.position.set(-0.1, 1.15, 0.38); g.add(p); return place(g, i, j, ry, 0.9, 0.75, 1.9); },
    restaurant: (i, j, ry, L = 16, D = 5) => { const g = new THREE.Group(), c = mat('rest', { map: T.brick.map, color: 0x9a8a78, roughness: 0.9 });
      const b = new THREE.Mesh(box(L, 3.2, D), c); b.position.y = 1.6; g.add(b);
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 1, 1, 4, 1), mat('restR', { color: 0x4a3a34, roughness: 0.8 })); roof.scale.set(L * 0.78, 1.8, D * 0.9); roof.rotation.y = Math.PI / 4; roof.position.y = 4.1; g.add(roof);
      for (let k = 0; k < 5; k++) { const w = new THREE.Mesh(box(1.4, 1, 0.05), mat('restW', { color: 0x5a7a4a, emissive: 0x2a3a1a, emissiveIntensity: 0.5 })); w.position.set(-L / 2 + 2 + k * (L - 4) / 4, 1.9, D / 2 + 0.03); g.add(w); }
      const d = new THREE.Mesh(box(1.2, 2.2, 0.06), mat('restD', { color: 0x7a1c14, roughness: 0.6 })); d.position.set(L / 2 - 1.2, 1.1, D / 2 + 0.04); g.add(d);
      return place(g, i, j, ry, L, D, 4.5); },
    // Strapped for Cash
    dome: (i, j, r = 4) => { const g = new THREE.Group(); const geo = new THREE.IcosahedronGeometry(r, 1);
      const frame = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x9a9a92 })); const glass = new THREE.Mesh(geo, mat('domeGlass', { color: 0x7a8a8a, roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
      for (const o of [frame, glass]) { o.position.y = 0; g.add(o); } const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.05, 0.5, 20), mat('domeBase', { map: T.concrete.map, color: 0x8a867a })); base.position.y = 0.25; g.add(base);
      g.userData.cut = true; return place(g, i, j, 0, r * 1.6, r * 1.6, r); },
    pool: (i, j, w = 8, d = 5) => { const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat('poolT', { map: T.walltile.map, color: 0x6a90a8, roughness: 0.3 })); t.rotation.x = -Math.PI / 2; t.position.y = 0.02; g.add(t);
      for (const [x, z, ww, dd] of [[0, d / 2, w, 0.3], [0, -d / 2, w, 0.3], [w / 2, 0, 0.3, d], [-w / 2, 0, 0.3, d]]) { const r = new THREE.Mesh(box(ww, 0.12, dd), mat('poolR', { color: 0xd8d4c8, roughness: 0.6 })); r.position.set(x, 0.06, z); g.add(r); }
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.4, d * 0.3), mat('poolScum', { color: 0x2a3a1a, transparent: true, opacity: 0.6 })); s.rotation.x = -Math.PI / 2; s.position.set(w * 0.15, 0.03, 0.4); g.add(s);
      return place(g, i, j, 0); },
    shop: (i, j, ry) => { const g = new THREE.Group(), sh = mat('shelf', { color: 0x6a5a48, roughness: 0.8 });
      for (const x of [-1.6, 0, 1.6]) { const s2 = new THREE.Mesh(box(1.2, 1.6, 0.4), sh); s2.position.set(x, 0.8, -1); g.add(s2); for (let k = 0; k < 6; k++) { const toy = new THREE.Mesh(box(0.15, 0.2, 0.12), mat('toy' + (k % 3), { color: [0x3a7ab0, 0xc8a020, 0xb03a3a][k % 3], roughness: 0.6 })); toy.position.set(x - 0.45 + (k % 3) * 0.45, 0.6 + Math.floor(k / 3) * 0.6, -0.9); g.add(toy); } }
      const counter = new THREE.Mesh(box(2.4, 1, 0.7), sh); counter.position.set(0, 0.5, 1); g.add(counter);
      const sw = new THREE.Mesh(box(0.35, 0.45, 0.1), mat('exitSw', { color: 0x1a8a20, emissive: 0x106a14, emissiveIntensity: 0.8 })); sw.position.set(2.4, 1.3, -1.2); g.add(sw);
      return place(g, i, j, ry, 4.4, 3, 1.6); },
    cafe: (i, j, ry) => { const g = new THREE.Group(), c = mat('cafeW', { color: 0xb87a78, roughness: 0.9 }); const b = new THREE.Mesh(box(7, 3, 0.4), c); b.position.y = 1.5; g.add(b);
      const win = new THREE.Mesh(box(3, 1.2, 0.05), mat('cafeWin', { color: 0xd8c890, emissive: 0x8a7a40, emissiveIntensity: 0.6 })); win.position.set(-1.2, 1.6, 0.23); g.add(win);
      const door = new THREE.Mesh(box(1.1, 2.2, 0.06), mat('cafeD', { color: 0x3a2a20 })); door.position.set(2.2, 1.1, 0.23); g.add(door);
      return place(g, i, j, ry, 7, 0.4, 3); },
    // View of Innocence: the mall
    washers: (i, j, ry, n = 4) => { const g = new THREE.Group(), w = mat('washer', { color: 0xd8d4c8, roughness: 0.4, metalness: 0.2 }), dk = mat('washerD', { color: 0x1a1c1e, roughness: 0.1, metalness: 0.6 });
      for (let k = 0; k < n; k++) { const b = new THREE.Mesh(box(0.7, 0.9, 0.7), w); b.position.set(k * 0.75 - (n - 1) * 0.375, 0.45, 0); g.add(b); const d = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), dk); d.position.set(k * 0.75 - (n - 1) * 0.375, 0.5, 0.36); g.add(d); }
      return place(g, i, j, ry, n * 0.75, 0.7, 0.9); },
    planter: (i, j, l = 3) => { const g = new THREE.Group(); const b = new THREE.Mesh(box(l, 0.6, 1.1), mat('planter', { map: T.walltile.map, color: 0x8a7a6a, roughness: 0.7 })); b.position.y = 0.3; g.add(b);
      for (let k = 0; k < l * 2; k++) { const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35 + Math.random() * 0.2, 0), mat('bush', { color: 0x2a4a22, roughness: 1 })); bush.position.set(-l / 2 + 0.3 + k * 0.48, 0.8, (Math.random() - 0.5) * 0.4); g.add(bush); }
      return place(g, i, j, 0, l, 1.1, 0.9); },
    counter: (i, j, ry, l = 6) => { const g = new THREE.Group(); const b = new THREE.Mesh(box(l, 1.05, 0.7), mat('bar', { map: T.wood.map, color: 0x6a3a22, roughness: 0.5 })); b.position.y = 0.52; g.add(b); const top = new THREE.Mesh(box(l + 0.1, 0.06, 0.8), mat('barTop', { color: 0x2a1a12, roughness: 0.3 })); top.position.y = 1.08; g.add(top);
      return place(g, i, j, ry, l, 0.7, 1.1); },
    medallion: (i, j, r = 1.6) => { if (!K._med) { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); x.translate(128, 128); for (let k = 0; k < 8; k++) { x.rotate(Math.PI / 4); x.fillStyle = k % 2 ? '#8a1c18' : '#d8d0c0'; x.beginPath(); x.moveTo(0, 0); x.lineTo(30, 100); x.lineTo(0, 124); x.lineTo(-30, 100); x.closePath(); x.fill(); } x.fillStyle = '#2a2a2a'; x.beginPath(); x.arc(0, 0, 18, 0, 7); x.fill(); K._med = new THREE.CanvasTexture(c); K._med.colorSpace = THREE.SRGBColorSpace; }
      const d = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshStandardMaterial({ map: K._med, transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 })); d.rotation.x = -Math.PI / 2; d.position.set(wx(i), fy(i, j) + 0.02, wz(j)); D.root.add(d); },
    shopfront: (i, j, ry, name, col = '#d8c890', bg = '#202020') => { K.sign(name, i, j, ry, { w: 3.4, h: 0.7, y: 3.0 + fy(i, j) * 0, bg, fg: col, font: 'bold 64px Arial', lit: true }); },
    kiosk: (i, j, ry) => { const g = new THREE.Group(), c = mat('kiosk', { map: T.concrete.map, color: 0xb0a890, roughness: 0.9 }); const b = new THREE.Mesh(box(3, 2.4, 2.4), c); b.position.y = 1.2; g.add(b);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1, 4), mat('kioskR', { color: 0x8a2a1c, roughness: 0.8 })); roof.position.y = 2.9; roof.rotation.y = Math.PI / 4; g.add(roof);
      const w = new THREE.Mesh(box(1.8, 0.7, 0.05), mat('kioskW', { color: 0x2a2a20, roughness: 0.5 })); w.position.set(0, 1.5, 1.22); g.add(w); return place(g, i, j, ry, 3, 2.4, 3); },
    // restroom: a row of stalls with half-open doors, and sinks on the wall opposite
    stalls: (i, j, ry, n = 3) => { const g = new THREE.Group(), pm = mat('stall', { color: 0x6a6448, roughness: 0.55, metalness: 0.2 }), wc = mat('porcelain', { color: 0xc8c2b0, roughness: 0.25 });
      for (let k = 0; k <= n; k++) { const p = new THREE.Mesh(box(0.05, 2.0, 1.5), pm); p.position.set(k * 0.95 - n * 0.475, 1.15, 0.75); g.add(p); }
      for (let k = 0; k < n; k++) { const d = new THREE.Mesh(box(0.8, 1.8, 0.04), pm); const x = k * 0.95 - n * 0.475 + 0.475; d.position.set(x - 0.38 + Math.cos(0.6 + k * 0.4) * 0.38, 1.1, 1.5 + Math.sin(0.6 + k * 0.4) * 0.38); d.rotation.y = -(0.6 + k * 0.4); g.add(d); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.42, 12), wc); t.position.set(x, 0.21, 0.35); g.add(t); }
      return place(g, i, j, ry, n * 0.95, 1.6, 2.1); },
    sinks: (i, j, ry, n = 3) => { const g = new THREE.Group(), wc = mat('porcelain', { color: 0xc8c2b0, roughness: 0.25 }), mir = mat('mirror', { color: 0x30342e, roughness: 0.1, metalness: 0.9 });
      for (let k = 0; k < n; k++) { const s = new THREE.Mesh(box(0.55, 0.18, 0.45), wc); s.position.set(k * 0.8, 0.85, 0.25); g.add(s); const mr = new THREE.Mesh(box(0.5, 0.6, 0.02), mir); mr.position.set(k * 0.8, 1.6, 0.03); g.add(mr); }
      return place(g, i, j, ry, n * 0.8, 0.5, 1); },
    // Kill the Rabbit: the prison's back rooms. A steel morgue slab, the wall of body drawers, a furnace,
    // a workshop bench with a vice, the dentist's chair under its lamp, a sheeted body.
    slab: (i, j, ry) => { const g = new THREE.Group(), st = mat('steel', { color: 0x9a9c98, roughness: 0.3, metalness: 0.8 });
      const t = new THREE.Mesh(box(2.0, 0.06, 0.8), st); t.position.y = 0.9; g.add(t); for (const x of [-0.8, 0.8]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), st); l.position.set(x, 0.45, 0); g.add(l); }
      const dr = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8), st); dr.position.set(0, 0.8, 0); g.add(dr);
      return place(g, i, j, ry, 2.0, 0.8, 1); },
    drawers: (i, j, ry, n = 4) => { const g = new THREE.Group(), st = mat('steel', { color: 0x9a9c98, roughness: 0.3, metalness: 0.8 }), dk = mat('steelDk', { color: 0x2a2c2a, roughness: 0.5, metalness: 0.6 });
      const b = new THREE.Mesh(box(n * 0.75, 2.3, 0.6), dk); b.position.set(0, 1.15, 0.3); g.add(b);
      for (let k = 0; k < n; k++) for (let r = 0; r < 3; r++) { const d = new THREE.Mesh(box(0.66, 0.66, 0.04), st); d.position.set(k * 0.75 - (n - 1) * 0.375, 0.42 + r * 0.74, 0.62); g.add(d); const h = new THREE.Mesh(box(0.2, 0.04, 0.05), dk); h.position.set(d.position.x, d.position.y + 0.18, 0.66); g.add(h); }
      return place(g, i, j, ry, n * 0.75, 0.7, 2.3); },
    sheeted: (i, j, ry) => { const g = new THREE.Group(), sh = mat('sheet', { color: 0xb8b4a8, roughness: 1 }), bl = mat('shroudblood', { color: 0x3a0806, roughness: 0.4 });
      const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.4, 4, 10), sh); b.rotation.z = Math.PI / 2; b.scale.set(1, 1, 0.6); b.position.y = 1.02; g.add(b);
      const s = new THREE.Mesh(new THREE.CircleGeometry(0.16, 10), bl); s.rotation.x = -Math.PI / 2; s.position.set(0.3, 1.16, 0); g.add(s); return place(g, i, j, ry); },
    furnace: (i, j, ry) => { const g = new THREE.Group(), ir = mat('iron', { color: 0x2a2624, roughness: 0.8, metalness: 0.6 }), br = mat('firebrick', { map: T.brick?.map || null, color: 0x6a4a3a, roughness: 0.9 });
      const b = new THREE.Mesh(box(2.6, 2.4, 1.8), br); b.position.y = 1.2; g.add(b); const d = new THREE.Mesh(box(1.0, 0.8, 0.08), ir); d.position.set(0, 0.9, 0.92); g.add(d);
      const glow = new THREE.Mesh(box(0.8, 0.12, 0.02), new THREE.MeshBasicMaterial({ color: 0xff6a1a })); glow.position.set(0, 0.55, 0.97); g.add(glow);
      const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3, 10), ir); fl.position.set(0.7, 3.2, -0.3); g.add(fl);
      const L = new THREE.PointLight(0xff7a2a, 3, 7, 1.6); L.position.set(0, 0.8, 1.4); g.add(L);
      return place(g, i, j, ry, 2.6, 1.8, 2.4); },
    bench: (i, j, ry) => { const g = new THREE.Group(), wd = mat('deck', { map: T.wood.map, color: 0x7a6a54, roughness: 0.9 }), ir = mat('iron', { color: 0x2a2624, roughness: 0.8, metalness: 0.6 });
      const t = new THREE.Mesh(box(2.4, 0.08, 0.9), wd); t.position.y = 0.92; g.add(t); for (const x of [-1.1, 1.1]) for (const z of [-0.35, 0.35]) { const l = new THREE.Mesh(box(0.08, 0.9, 0.08), ir); l.position.set(x, 0.45, z); g.add(l); }
      const v = new THREE.Mesh(box(0.2, 0.18, 0.16), ir); v.position.set(0.9, 1.05, 0.3); g.add(v); const s = new THREE.Mesh(box(2.2, 0.04, 0.7), wd); s.position.y = 0.25; g.add(s);
      return place(g, i, j, ry, 2.4, 0.9, 1); },
    dentChair: (i, j, ry) => { const g = new THREE.Group(), lt = mat('vinyl', { color: 0x5a7a6a, roughness: 0.5 }), st = mat('steel', { color: 0x9a9c98, roughness: 0.3, metalness: 0.8 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.3, 0.5, 10), st); base.position.y = 0.25; g.add(base);
      const seat = new THREE.Mesh(box(0.6, 0.12, 0.7), lt); seat.position.set(0, 0.6, 0); g.add(seat);
      const back = new THREE.Mesh(box(0.6, 0.9, 0.12), lt); back.position.set(0, 1.0, -0.42); back.rotation.x = -0.5; g.add(back);
      const leg = new THREE.Mesh(box(0.5, 0.1, 0.6), lt); leg.position.set(0, 0.48, 0.6); leg.rotation.x = 0.5; g.add(leg);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.8, 6), st); arm.position.set(0.5, 0.9, -0.2); g.add(arm);
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.1, 12), st); lamp.position.set(0.3, 1.8, 0.1); g.add(lamp);
      const tray = new THREE.Mesh(box(0.4, 0.03, 0.3), st); tray.position.set(-0.55, 0.95, 0.2); g.add(tray);
      return place(g, i, j, ry, 0.8, 1.3, 1.2); },
    // a body wrapped in a filthy sheet, hung from the ceiling on a rope
    hanged: (i, j, y = 3.4) => { const g = new THREE.Group(), sheet = mat('shroud', { color: 0x6a5e4a, roughness: 1 }), bl = mat('shroudblood', { color: 0x3a0806, roughness: 0.4 }), rope = mat('rope', { color: 0x4a3a24, roughness: 1 });
      const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1.1, 6, 12), sheet); b.position.y = y - 1.5; b.scale.z = 0.8; g.add(b);
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), sheet); h.position.y = y - 0.62; g.add(h);
      const st = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), bl); st.position.y = y - 1.55; st.scale.set(1.02, 2.6, 0.84); g.add(st);
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6), rope); r.position.y = y - 0.3; g.add(r);
      g.rotation.z = (Math.random() - 0.5) * 0.08; place(g, i, j, Math.random() * 6); K.blood(i, j, 1.4); return g; },
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
