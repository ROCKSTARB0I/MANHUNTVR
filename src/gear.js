// gear.js — what each gang wears over the body: armour, straps, pouches, caps,
// gas masks, ghillie rags, cloaks, printed slogans. Everything hangs on a bone so
// it moves (and falls) with the man. Sizes follow the body's cross-sections in
// body.js (chest bone at 1.30 m, spine 1.10, hips 0.95, head 1.60).
import * as THREE from '../vendor/three.module.js';
import { T } from './paint.js?v=26';

const srgb = (c) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
const mat = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: Array.isArray(c) ? srgb(c) : c, roughness: 0.85, side: THREE.DoubleSide }, o));
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const textCache = {};
function printTex(text, fg, bg, font) {
  const key = text + fg + bg + font; if (textCache[key]) return textCache[key];
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, 512, 160); }
  g.fillStyle = fg; g.font = font || 'bold 96px Impact, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.save(); g.translate(256, 82); g.rotate(-0.03); g.fillText(text, 0, 0); g.restore();
  // worn: scratch the paint away in places
  g.globalCompositeOperation = 'destination-out'; for (let k = 0; k < 140; k++) { g.globalAlpha = Math.random() * 0.7; g.fillRect(Math.random() * 512, Math.random() * 160, 2 + Math.random() * 10, 1 + Math.random() * 3); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (textCache[key] = t);
}

export function addGear(P, o, B) {
  const bone = (n) => P.bones[B[n]], k = o.bulk || 1, add = (n, m) => { m.castShadow = true; bone(n).add(m); return m; };
  for (const it of o.gear || []) {
    const g = typeof it === 'string' ? { t: it } : it, col = g.col || [0.06, 0.06, 0.06];
    const cm = () => g.map ? mat([0.9, 0.9, 0.9], { map: T.cloth[g.map] }) : mat(col);
    switch (g.t) {
      case 'vest': { // body armour / load-bearing vest round the chest, pouches on the front
        const m = cm(), v = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.94, g.h || 0.36, 20, 1, true), m);
        v.scale.set(0.205 * k, 1, 0.152 * k); v.position.set(0, g.y ?? -0.1, 0.008); add('chest', v);
        const top = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 20), m); top.scale.set(0.2 * k, 0.2, 0.15 * k); top.rotation.x = Math.PI / 2; top.position.set(0, (g.y ?? -0.1) + (g.h || 0.36) / 2, 0.008); add('chest', top);
        if (g.pouches !== false) { const pm = mat(g.pouchCol || col.map((c) => c * 0.8)); for (const x of [-0.1, -0.035, 0.035, 0.1]) { const p = box(0.06, 0.08, 0.035, pm); p.position.set(x * k, (g.y ?? -0.1) - 0.08, 0.16 * k); add('chest', p); } }
        break; }
      case 'riot': { // Cerberus: padded riot vest with shoulder pads and a grenade strap
        const m = mat([0.05, 0.05, 0.055], { roughness: 0.7 }), v = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.95, 0.42, 20, 1, true), m);
        v.scale.set(0.215 * k, 1, 0.162 * k); v.position.set(0, -0.08, 0.008); add('chest', v);
        for (const s of [1, -1]) { const sp = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), m); sp.scale.set(1, 0.6, 1.1); sp.position.set(0.17 * s * k, 0.12, 0); sp.rotation.z = -0.5 * s; add('chest', sp); }
        for (let i = 0; i < 6; i++) { const p = box(0.05, 0.07, 0.04, m); p.position.set((-0.13 + i * 0.052) * k, -0.2, 0.17 * k); add('chest', p); }
        const nade = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.09, 10), mat(0x2a3020, { roughness: 0.6 })); nade.position.set(-0.09, 0.0, 0.18 * k); add('chest', nade);
        break; }
      case 'bandolier': { // ammo belt over the left shoulder, shells along it
        const sm = mat(g.col || [0.16, 0.12, 0.08]), shell = mat(0xa83a22, { roughness: 0.5 }), brass = mat(0xb08a40, { metalness: 0.8, roughness: 0.35 });
        for (const z of [0.142 * k, -0.12]) { const st = box(0.055, 0.64, 0.014, sm); st.position.set(0, -0.03, z); st.rotation.set(z > 0 ? -0.1 : 0.1, 0, -0.72); add('chest', st); }
        for (let i = 0; i < 9; i++) { const t = -0.22 + i * 0.055, s = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.045, 6), i % 2 ? shell : brass); s.position.set(t * Math.cos(0.72), -0.03 - t * Math.sin(0.72) * 1.1, 0.152 * k); s.rotation.z = -0.72 + Math.PI / 2; add('chest', s); }
        break; }
      case 'suspenders': { const m = mat(g.col || [0.5, 0.06, 0.05]); for (const s of [1, -1]) for (const z of [0.128 * k, -0.108]) { const st = box(0.026, 0.48, 0.008, m); st.position.set(0.085 * s, -0.08, z); st.rotation.set(z > 0 ? -0.18 : 0.12, 0, -0.04 * s); add('chest', st); } break; }
      case 'bib': { // overall bib and straps (same cloth as the legs)
        const m = mat(g.col); const b = box(0.24 * k, 0.26, 0.012, m); b.position.set(0, 0.06, 0.112 * k); b.rotation.x = 0.06; add('spine', b);
        for (const s of [1, -1]) { const st = box(0.04, 0.42, 0.01, m); st.position.set(0.08 * s, -0.02, 0.0); st.rotation.set(0, 0, 0.02 * s); st.position.z = 0.125 * k; add('chest', st); const bk = box(0.04, 0.42, 0.01, m); bk.position.set(0.06 * s, -0.04, -0.108); bk.rotation.z = -0.25 * s; add('chest', bk); }
        if (g.print) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.065), new THREE.MeshStandardMaterial({ map: printTex(g.print, g.printCol || '#c8c0b0', null), transparent: true, alphaTest: 0.2, polygonOffset: true, polygonOffsetFactor: -2 })); p.position.set(0, 0.08, 0.12 * k); add('spine', p); }
        break; }
      case 'pouches': { const m = cm(); const a = box(0.07, 0.1, 0.05, m); a.position.set(0.17 * k, -0.06, 0.04); add('hips', a); const b = box(0.05, 0.16, 0.04, m); b.position.set(0.16 * k, -0.08, -0.06); add('hips', b); break; }
      case 'thighPouch': { const p = box(0.06, 0.14, 0.11, cm()); p.position.set(-0.075, -0.2, 0.0); add('thighR', p); break; }
      case 'backpack': { const m = cm(); const p = box(0.26 * k, 0.32, 0.1, m); p.position.set(0, -0.04, -0.165); add('chest', p); const s = box(0.08, 0.1, 0.05, m); s.position.set(0.15 * k, -0.08, -0.15); add('chest', s); break; }
      case 'armband': { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.066 * k, 0.064 * k, 0.07, 14, 1, true), mat(g.col || [0.45, 0.04, 0.03])); a.position.set(0.012, -0.11, 0); a.rotation.z = 0.1; add(g.side === 'R' ? 'armR' : 'armL', a); break; }
      case 'kneepad': { const kp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(0x101010, { roughness: 0.5 })); kp.rotation.x = Math.PI / 2; kp.scale.set(1, 0.7, 1.2); kp.position.set(0, 0.0, 0.04); add('shinR', kp); break; }
      case 'bracer': { // spiked leather bracer on the left forearm
        const lm = mat(0x111010, { roughness: 0.45 }); const br = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.044, 0.16, 12, 1, true), lm); br.position.set(0.01, -0.13, 0); add('foreL', br);
        const sm = mat(0x9a9a96, { metalness: 0.9, roughness: 0.3 }); for (let i = 0; i < 8; i++) { const a = (i % 4) * 1.57, sp = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.03, 6), sm); sp.position.set(0.01 + Math.cos(a) * 0.05, -0.08 - Math.floor(i / 4) * 0.08, Math.sin(a) * 0.05); sp.lookAt(sp.position.clone().multiplyScalar(3)); sp.rotateX(Math.PI / 2); add('foreL', sp); }
        break; }
      case 'skirt': { // kilt / skirt hung from the hips, torn hem
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.175 * k, 0.25 * k, 0.42, 20, 3, true), cm()); s.position.set(0, -0.2, 0.0); s.scale.z = 0.85; add('hips', s); break; }
      case 'cloak': { // the Skullys' shroud: open at the front, hood and point handled by 'cone'
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * k, 0.32 * k, 0.95, 22, 4, true, 0.35, Math.PI * 2 - 0.7), cm()); c.scale.z = 0.8; c.position.set(0, -0.36, -0.01); add('chest', c); break; }
      case 'cone': { const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 16, 1, true), cm()); c.position.set(0, 0.29, -0.035); c.rotation.x = -0.3; add('head', c); break; }
      case 'cap': { // baseball cap (with a printed front if given)
        const m = cm(), c = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), m); c.scale.set(1, 0.95, 1.06); c.position.set(0, 0.135, 0.004); add('head', c);
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.008, 16, 1, false, -Math.PI / 2, Math.PI), m); br.position.set(0, 0.17, 0.1); br.rotation.x = 0.12; br.scale.z = 0.9; add('head', br);
        if (g.print) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.035), new THREE.MeshStandardMaterial({ map: printTex(g.print, '#e0dccc', null), transparent: true, alphaTest: 0.2 })); p.position.set(0, 0.2, 0.118); p.rotation.x = -0.35; add('head', p); }
        break; }
      case 'bandanaCap': { // a bandana tied tight round the skull, rag strips hanging behind
        const m = cm(), c = new THREE.Mesh(new THREE.SphereGeometry(0.122, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.46), m); c.scale.set(1, 1, 1.06); c.position.set(0, 0.112, 0.004); add('head', c);
        for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.14 + i * 0.02), m); s.position.set(-0.04 + i * 0.02, 0.04, -0.118); s.rotation.set(0.25, 0, (i - 2) * 0.12); add('head', s); }
        break; }
      case 'mohawk': { const m = mat(g.col || [0.08, 0.06, 0.05], { roughness: 1 }); for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.08 + Math.sin(i / 6 * Math.PI) * 0.04, 6), m); const a = -0.9 + i * 0.32; s.position.set(0, 0.11 + Math.cos(a) * 0.125, Math.sin(a) * 0.125 + 0.004); s.rotation.x = a; add('head', s); } break; }
      case 'knot': { const m = mat(g.col || [0.42, 0.33, 0.24]); const kn = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), m); kn.position.set(0, 0.235, -0.02); add('head', kn); const tl = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.12, 8), m); tl.position.set(0, 0.25, -0.08); tl.rotation.x = -1.9; add('head', tl); break; }
      case 'gasmask': { // black rubber respirator: one filter, red lenses that catch the light, radio earpieces
        const rub = mat(0x0c0c0d, { roughness: 0.45 }), face = new THREE.Mesh(new THREE.SphereGeometry(0.104, 18, 12, Math.PI * 0.18, Math.PI * 0.64, Math.PI * 0.28, Math.PI * 0.5), rub);
        face.scale.set(1, 1.05, 1.18); face.position.set(0, 0.1, 0.012); add('head', face);
        const lm = new THREE.MeshStandardMaterial({ color: 0x5a0606, emissive: 0xa01008, emissiveIntensity: 0.9, roughness: 0.1, metalness: 0.3 });
        for (const s of [1, -1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.012, 16), lm); l.rotation.x = Math.PI / 2; l.position.set(0.04 * s, 0.13, 0.112); add('head', l); const rim = new THREE.Mesh(new THREE.TorusGeometry(0.029, 0.006, 6, 16), rub); rim.position.copy(l.position); add('head', rim); }
        const f = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.06, 14), mat(0x1c1c1c, { roughness: 0.6, metalness: 0.4 })); f.rotation.x = Math.PI / 2 + 0.5; f.position.set(0.03, 0.04, 0.13); add('head', f);
        for (const s of [1, -1]) { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.025, 12), rub); e.rotation.z = Math.PI / 2; e.position.set(0.112 * s, 0.11, 0); add('head', e); }
        break; }
      case 'ghillie': { // rag strips over everything: shoulders, back, arms, head
        const cols = g.cols || [[0.2, 0.22, 0.12], [0.3, 0.27, 0.16], [0.12, 0.13, 0.08], [0.36, 0.34, 0.22]], ms = cols.map((c) => mat(c, { roughness: 1 }));
        const spots = [['chest', 0.2, -0.1, 0.12, 60], ['spine', 0.18, -0.05, 0.12, 30], ['armL', 0.06, -0.15, 0.1, 16], ['armR', 0.06, -0.15, 0.1, 16], ['head', 0.12, 0.13, 0.1, 22], ['hips', 0.18, -0.05, 0.1, 18]];
        for (const [bn, r, yc, ys, n] of spots) for (let i = 0; i < n; i++) {
          const a = (i * 2.399) % (Math.PI * 2), y = yc + ((i * 0.618) % 1 - 0.5) * ys * 2;
          if (bn === 'head' && Math.sin(a) > 0.55) continue; // keep the face slit clear
          const s = new THREE.Mesh(new THREE.PlaneGeometry(0.035 + (i % 3) * 0.01, 0.12 + (i % 5) * 0.03), ms[i % ms.length]);
          s.position.set(Math.cos(a) * r * k, y, Math.sin(a) * r * 0.8 * k); s.rotation.set(0.2 + (i % 4) * 0.1, -a + Math.PI / 2, (i % 7 - 3) * 0.12); add(bn, s);
        }
        break; }
      case 'print': { // a slogan painted on the back or front of a jacket, or tattooed on bare skin
        const back = g.side === 'back', w = g.w || 0.24, p = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.31), new THREE.MeshStandardMaterial({ map: printTex(g.text, g.fg || '#d8d0c0', g.bg || null, g.font), transparent: true, alphaTest: 0.15, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -3 }));
        const y = g.y ?? (back ? 0.02 : 0.0), vest = (o.gear || []).some((q) => q === 'riot' || q.t === 'vest' || q.t === 'riot'); p.position.set(g.x || 0, y, back ? -(vest ? 0.165 * k : 0.124) : (vest ? 0.168 : 0.138) * k); if (back) p.rotation.y = Math.PI; p.rotation.x = back ? 0.06 : -0.12; add(g.bone || 'chest', p);
        break; }
    }
  }
}
