// cutscene.js — the opening tape, shot in 3D. Real sets with real people:
// a Channel 6 news studio, the execution chamber at Carcer City State
// Penitentiary, then the actual holding pen from the game where Cash wakes up
// with the Director in his ear. Each shot is filmed by a moving camera into a
// render target; on-screen graphics (news ticker, CCTV timestamps, grain) are a
// transparent 2D layer on top. Desktop shows it full screen; VR shows it as a
// flat screen in a dark room. Any key, click or controller button skips.
import * as THREE from '../vendor/three.module.js';
import { Person, BONE as B } from './body.js?v=31';
import { T } from './paint.js?v=31';

const V = THREE.Vector3;
const RW = 1280, RH = 720, W = 960, H = 540;
const SHOTS = [[0, 6.5, 'news'], [6.5, 12, 'newsMug'], [12, 18, 'chamber'], [18, 24.5, 'chamberClose'], [24.5, 26.5, 'static'], [26.5, 31.5, 'monitors'], [31.5, 35.5, 'wake'], [35.5, 62, 'pen']];
const LINES = [[0.8, 'news_1'], [6.8, 'news_2'], [13.5, 'news_3'], [27.4, 'dir_intro_1'], [36, 'cash_wake'], [38, 'dir_intro_2'], [47, 'cash_reply'], [49, 'dir_intro_3']];
const LENGTH = 62;
const STUDIO = new V(400, 0, 0), CHAMBER = new V(500, 0, 0), DEN = new V(600, 0, 0);

// a material from one of the painted surfaces (colour + normal + roughness), tinted
function surface(t, color = 0xffffff, extra = {}) {
  const c = (m) => { if (!m) return undefined; const k = m.clone(); k.needsUpdate = true; k.wrapS = k.wrapT = THREE.RepeatWrapping; return k; };
  return new THREE.MeshStandardMaterial(Object.assign({ map: c(t.map), normalMap: c(t.normal), roughnessMap: c(t.rough), bumpMap: t.normal ? undefined : c(t.bump), bumpScale: 0.02, color, roughness: 1 }, extra));
}
// texture coordinates in metres (one texture tile = `tile` metres) so nothing stretches
function worldBox(w, h, d, mat, tile = 3.6) {
  const g = new THREE.BoxGeometry(w, h, d), p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (ay > 0.5) uv.setXY(i, x / tile, z / tile); else if (ax > 0.5) uv.setXY(i, z / tile, y / tile); else uv.setXY(i, x / tile, y / tile);
  }
  return new THREE.Mesh(g, mat);
}

export class Cutscene {
  constructor(renderer, camera, sound, world) {
    this.renderer = renderer; this.camera = camera; this.sound = sound; this.world = world;
    this.rt = new THREE.WebGLRenderTarget(RW, RH, { colorSpace: THREE.SRGBColorSpace, samples: 2 });
    this.cam = new THREE.PerspectiveCamera(42, RW / RH, 0.05, 200);
    // 2D layer: graphics, grain, fades
    this.hud = document.createElement('canvas'); this.hud.width = W; this.hud.height = H; this.g = this.hud.getContext('2d');
    this.hudTex = new THREE.CanvasTexture(this.hud); this.hudTex.colorSpace = THREE.SRGBColorSpace;
    // presentation: VR screen room, desktop full-screen quad
    this.room = new THREE.Scene(); this.room.background = new THREE.Color(0x000000);
    const scr = new THREE.Group();
    scr.add(new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.8), new THREE.MeshBasicMaterial({ map: this.rt.texture, toneMapped: false })));
    const ov = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.8), new THREE.MeshBasicMaterial({ map: this.hudTex, transparent: true, toneMapped: false })); ov.position.z = 0.002; scr.add(ov);
    this.screen = scr; this.room.add(scr);
    this.flat = new THREE.Scene(); this.flatCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
    this.flatImg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: this.rt.texture, toneMapped: false, depthTest: false }));
    this.flatHud = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: this.hudTex, transparent: true, toneMapped: false, depthTest: false }));
    this.flatHud.renderOrder = 1; this.flat.add(this.flatImg, this.flatHud);
    this.active = false; this.t = 0;
    this.sets = new THREE.Scene(); this.sets.background = new THREE.Color(0x000000);
    this.buildStudio(); this.buildChamber(); this.buildDen();
    this.mug = makeMug();
  }

  // ------------------------------------------------------------ sets
  buildStudio() {
    const S = new THREE.Group(); S.position.copy(STUDIO); this.sets.add(S);
    const mat = (c, r = 0.7, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    // backdrop: a city-at-night photo wall with the station logo
    const bd = document.createElement('canvas'); bd.width = 1024; bd.height = 512; const b = bd.getContext('2d');
    const gr = b.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#120c08'); gr.addColorStop(1, '#3a2614'); b.fillStyle = gr; b.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 60; i++) { const w = 20 + Math.random() * 50, h = 80 + Math.random() * 260, x = Math.random() * 1024; b.fillStyle = '#0a0705'; b.fillRect(x, 512 - h, w, h); b.fillStyle = 'rgba(255,190,110,0.5)'; for (let k = 0; k < h / 14; k++) if (Math.random() < 0.3) b.fillRect(x + 4 + Math.random() * (w - 8), 512 - h + k * 14 + 4, 3, 4); }
    b.fillStyle = '#a01010'; b.fillRect(780, 40, 180, 120); b.fillStyle = '#fff'; b.font = 'bold 100px Arial'; b.fillText('6', 838, 140); b.font = 'bold 22px Arial'; b.fillText('NEWS', 836, 190);
    const bt = new THREE.CanvasTexture(bd); bt.colorSpace = THREE.SRGBColorSpace;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), new THREE.MeshStandardMaterial({ map: bt, emissive: 0xffffff, emissiveMap: bt, emissiveIntensity: 0.35, roughness: 0.9 }));
    back.position.set(0, 2, -2.2); S.add(back);
    const floor = worldBox(10, 0.02, 8, surface(T.slab, 0x4a443c, { roughness: 0.55 })); floor.position.y = -0.01; S.add(floor);
    // the desk
    const desk = worldBox(2.6, 0.78, 0.9, surface(T.wood, 0x6a4a34, { roughness: 0.45 }), 1.2); desk.position.set(0, 0.39, 0.55); S.add(desk);
    const top = worldBox(2.7, 0.04, 1.0, surface(T.wood, 0x8a6a50, { roughness: 0.25 }), 1.2); top.position.set(0, 0.8, 0.55); S.add(top);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.5), new THREE.MeshBasicMaterial({ color: 0x8a1010 })); front.position.set(0, 0.45, 1.006); S.add(front);
    const papers = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.01, 0.22), mat(0xe8e4da)); papers.position.set(0.15, 0.83, 0.75); papers.rotation.y = 0.2; S.add(papers);
    // the anchor: a man in a suit, seated
    const a = new Person({ mask: null, weapon: null, top: [0.1, 0.1, 0.12], legs: [0.1, 0.1, 0.12], skin: [0.6, 0.42, 0.32], bulk: 1.05, hair: [0.045, 0.03, 0.02] });
    a.root.position.set(0, -0.42, 0.1); S.add(a.root); this.anchor = a;
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.01), mat(0x7a1414)); tie.position.set(0, -0.05, 0.13); a.bones[B.chest].add(tie);
    // over-the-shoulder monitor with the mugshot
    const mt = new THREE.CanvasTexture(makeMug()); mt.colorSpace = THREE.SRGBColorSpace;
    const mon = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.05), new THREE.MeshBasicMaterial({ map: mt, toneMapped: false })); mon.position.set(1.5, 1.9, -1.4); mon.rotation.y = -0.25; S.add(mon); this.monitor = mon;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.15, 0.05), mat(0x111111)); frame.position.set(1.5, 1.9, -1.43); frame.rotation.y = -0.25; S.add(frame);
    // studio lighting: key, fill, a warm rim from behind
    const key = new THREE.SpotLight(0xfff0dc, 14, 12, 0.6, 0.6, 1.5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0005; key.position.set(1.6, 3.2, 4); key.target.position.set(0, 1.2, 0); S.add(key, key.target);
    const fill = new THREE.PointLight(0xffe2c4, 3, 10, 1.6); fill.position.set(-2.5, 2, 3); S.add(fill);
    const rim = new THREE.PointLight(0xffb070, 8, 6, 1.6); rim.position.set(-1, 2.6, -1.2); S.add(rim);
  }

  buildChamber() {
    const C = new THREE.Group(); C.position.copy(CHAMBER); this.sets.add(C);
    const mat = (c, r = 0.7, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    // institutional tile: walls and floor
    const tc = document.createElement('canvas'); tc.width = tc.height = 256; const t = tc.getContext('2d');
    t.fillStyle = '#9a9a8e'; t.fillRect(0, 0, 256, 256); t.strokeStyle = '#5e5e56'; t.lineWidth = 3;
    for (let i = 0; i <= 256; i += 32) { t.beginPath(); t.moveTo(i, 0); t.lineTo(i, 256); t.moveTo(0, i); t.lineTo(256, i); t.stroke(); }
    for (let k = 0; k < 40; k++) { t.fillStyle = `rgba(60,50,30,${Math.random() * 0.15})`; t.fillRect(Math.random() * 256, Math.random() * 256, 30, 30); }
    const tt = new THREE.CanvasTexture(tc); tt.colorSpace = THREE.SRGBColorSpace; tt.wrapS = tt.wrapT = THREE.RepeatWrapping; tt.repeat.set(3, 2);
    const wall = surface(T.slab, 0xc4c2a8, { roughness: 0.7 }); tt.dispose();
    const box = (w, h, d, x, y, z, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); C.add(o); return o; };
    const wb = (w, h, d, x, y, z, m, tile) => { const o = worldBox(w, h, d, m, tile); o.position.set(x, y, z); o.receiveShadow = true; C.add(o); return o; };
    wb(6, 0.1, 6, 0, -0.05, 0, surface(T.concrete, 0x8a8a80, { roughness: 0.8 }));
    wb(6, 3, 0.1, 0, 1.5, -3, wall); wb(0.1, 3, 6, -3, 1.5, 0, wall); wb(0.1, 3, 6, 3, 1.5, 0, wall);
    // a darker painted dado band along the bottom of the walls, scuffed by trolleys
    const dado = surface(T.concrete, 0x5a5648, { roughness: 0.6 });
    wb(5.9, 0.9, 0.02, 0, 0.45, -2.94, dado, 1.8); wb(0.02, 0.9, 5.9, -2.94, 0.45, 0, dado, 1.8); wb(0.02, 0.9, 5.9, 2.94, 0.45, 0, dado, 1.8);
    wb(6, 0.1, 6, 0, 3.05, 0, surface(T.concrete, 0x4a4a44));
    // witness window in the back wall, people behind the glass
    box(2.6, 1.0, 0.12, 0.8, 1.6, -2.95, mat(0x222220)).material = new THREE.MeshStandardMaterial({ color: 0x1a1c1a, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.35 });
    for (let k = 0; k < 3; k++) {
      const w = new Person({ mask: null, weapon: null, top: [[0.12, 0.1, 0.09], [0.2, 0.18, 0.15], [0.08, 0.08, 0.1]][k], legs: [0.1, 0.1, 0.1], skin: [[0.6, 0.44, 0.34], [0.45, 0.3, 0.22], [0.66, 0.5, 0.4]][k] });
      w.root.position.set(-0.1 + k * 0.85, 0, -3.5); C.add(w.root); w.animate(0, 0);
    }
    box(3.2, 3, 1.4, 0.8, 1.5, -3.75, mat(0x0c0c0b));
    const wl = new THREE.PointLight(0xffe6c0, 3, 3, 1.5); wl.position.set(0.8, 2.2, -3.4); C.add(wl);
    // the clock on the wall: 11:58
    const ck = document.createElement('canvas'); ck.width = ck.height = 128; const k = ck.getContext('2d');
    k.fillStyle = '#eeeae0'; k.beginPath(); k.arc(64, 64, 60, 0, 7); k.fill(); k.strokeStyle = '#222'; k.lineWidth = 5; k.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; k.fillStyle = '#222'; k.fillRect(64 + Math.sin(a) * 48 - 2, 64 - Math.cos(a) * 48 - 4, 4, 8); }
    k.lineCap = 'round'; k.lineWidth = 6; k.beginPath(); k.moveTo(64, 64); k.lineTo(64 + Math.sin(-0.02) * 32, 64 - Math.cos(-0.02) * 32); k.stroke();
    k.lineWidth = 4; k.beginPath(); k.moveTo(64, 64); k.lineTo(64 + Math.sin(-0.21) * 46, 64 - Math.cos(-0.21) * 46); k.stroke();
    const ckt = new THREE.CanvasTexture(ck); ckt.colorSpace = THREE.SRGBColorSpace;
    const clock = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), new THREE.MeshStandardMaterial({ map: ckt, roughness: 0.4 })); clock.position.set(-1.4, 2.4, -2.94); C.add(clock);
    // the governor's red phone
    box(0.18, 0.28, 0.08, -2.94, 1.5, -1.2, mat(0x8a1010, 0.4)).rotation.y = Math.PI / 2;
    // floor drain and a stencilled sign
    const drain = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), mat(0x111111, 0.6)); drain.rotation.x = -Math.PI / 2; drain.position.set(0.4, 0.005, 1.2); C.add(drain);
    const sg = document.createElement('canvas'); sg.width = 512; sg.height = 128; const sx = sg.getContext('2d');
    sx.fillStyle = '#e8e2d0'; sx.fillRect(0, 0, 512, 128); sx.fillStyle = '#1a1a1a'; sx.font = 'bold 44px Arial'; sx.fillText('EXECUTION CHAMBER', 30, 60); sx.font = '26px Arial'; sx.fillText('AUTHORIZED PERSONNEL ONLY', 60, 105);
    const sgt = new THREE.CanvasTexture(sg); sgt.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.25), new THREE.MeshStandardMaterial({ map: sgt, roughness: 0.6 })); sign.position.set(-2.94, 2.3, 0.6); sign.rotation.y = Math.PI / 2; C.add(sign);
    // fluorescent panel
    const panel = box(1.2, 0.04, 0.4, 0, 3.0, 0, new THREE.MeshBasicMaterial({ color: 0xf4f2e8 }));
    const lamp = new THREE.SpotLight(0xf0eedc, 30, 10, 1.15, 0.7, 1.4); lamp.position.set(0, 2.9, 0.2); lamp.target.position.set(0, 0.9, 0); lamp.castShadow = true; lamp.shadow.mapSize.set(1024, 1024); lamp.shadow.bias = -0.0005; C.add(lamp, lamp.target);
    const bounce = new THREE.PointLight(0xe8e4d0, 3, 8, 1.4); bounce.position.set(0, 2.6, 1.5); C.add(bounce);
    const low = new THREE.PointLight(0xffe0b0, 2.5, 6, 1.5); low.position.set(-2, 1.2, 2); C.add(low);
    // the gurney with arm boards
    const steel = new THREE.MeshStandardMaterial({ color: 0x9a9890, roughness: 0.32, metalness: 0.85 }), vinyl = new THREE.MeshStandardMaterial({ color: 0x6a645a, roughness: 0.35, map: T.fleece.map });
    box(2.0, 0.08, 0.7, 0, 0.9, 0, vinyl).castShadow = true;
    box(2.06, 0.03, 0.76, 0, 0.85, 0, steel);
    box(0.06, 0.85, 0.06, -0.8, 0.45, 0.28, steel); box(0.06, 0.85, 0.06, 0.8, 0.45, 0.28, steel); box(0.06, 0.85, 0.06, -0.8, 0.45, -0.28, steel); box(0.06, 0.85, 0.06, 0.8, 0.45, -0.28, steel);
    box(0.22, 0.05, 0.8, 0.58, 0.92, 0.7, vinyl); box(0.22, 0.05, 0.8, 0.58, 0.92, -0.7, vinyl);
    // Cash, strapped down in an orange jumpsuit, arms out
    const cash = new Person({ mask: null, weapon: null, top: [0.62, 0.3, 0.06], legs: [0.62, 0.3, 0.06], skin: [0.55, 0.38, 0.28], bulk: 1.15, stubble: true, cashFace: true });
    cash.root.rotation.set(-Math.PI / 2, 0, -Math.PI / 2); cash.root.position.set(-0.8, 1.06, 0); C.add(cash.root); this.cashBed = cash;
    // leather straps across shins, thighs, waist and chest, and on both wrists
    const leather = new THREE.MeshStandardMaterial({ color: 0x2a1e16, roughness: 0.55, map: T.fleece.map });
    for (const [x, r] of [[-0.55, 0.15], [-0.1, 0.19], [0.18, 0.22], [0.45, 0.25]]) { // bands arched over shins, thighs, waist, chest
      const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.055, 24, 1, true, -Math.PI / 2, Math.PI), leather); leather.side = THREE.DoubleSide; band.scale.set(1.3, 1, 1.05); band.rotation.z = Math.PI / 2; band.position.set(x, 0.94, 0); band.castShadow = true; C.add(band);
      const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.04), new THREE.MeshStandardMaterial({ color: 0x8a8478, metalness: 0.9, roughness: 0.3 })); buckle.position.set(x, 0.94 + r * 1.3, 0.05); C.add(buckle);
    }
    for (const z of [0.72, -0.72]) box(0.08, 0.03, 0.14, 0.58, 0.99, z, mat(0x2a1e16, 0.7));
    // IV stand, lines into both arms
    box(0.03, 1.8, 0.03, -0.3, 0.9, 1.2, mat(0x9a9a96, 0.3, 0.8));
    for (const z of [1.1, 1.3]) { const bag = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.04), new THREE.MeshStandardMaterial({ color: 0xe8f0e8, transparent: true, opacity: 0.7, roughness: 0.1 })); bag.position.set(-0.3, 1.7, z); C.add(bag); }
    const line = (a, b) => { const c = new THREE.CatmullRomCurve3([a, a.clone().lerp(b, 0.5).add(new V(0, -0.3, 0)), b]); C.add(new THREE.Mesh(new THREE.TubeGeometry(c, 16, 0.004, 4), mat(0xe8e8e0, 0.3))); };
    line(new V(-0.3, 1.6, 1.15), new V(0.58, 0.98, 0.85)); line(new V(-0.3, 1.6, 1.25), new V(0.58, 0.98, -0.85));
    // the heart monitor on a cart, its trace drawn every frame
    this.ekg = document.createElement('canvas'); this.ekg.width = 256; this.ekg.height = 128; this.ekgTex = new THREE.CanvasTexture(this.ekg);
    box(0.6, 0.9, 0.5, 2.2, 0.45, 1.6, mat(0x3a3c3a, 0.5, 0.4));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), new THREE.MeshBasicMaterial({ map: this.ekgTex, toneMapped: false })); scr.position.set(2.2, 1.1, 1.36); scr.rotation.y = -0.6; C.add(scr);
    box(0.56, 0.36, 0.3, 2.2, 1.1, 1.5, mat(0x222222)).rotation.y = -0.6; scr.position.set(2.11, 1.1, 1.34);
    // a doctor and a guard
    const doc = new Person({ mask: null, weapon: null, top: [0.85, 0.85, 0.82], legs: [0.2, 0.22, 0.25], skin: [0.66, 0.5, 0.4] });
    doc.root.position.set(-0.7, 0, 1.1); doc.root.rotation.y = Math.PI * 0.85; C.add(doc.root); this.doctor = doc;
    const guard = new Person({ mask: null, weapon: null, top: [0.18, 0.2, 0.18], legs: [0.14, 0.15, 0.14], skin: [0.42, 0.29, 0.21], bulk: 1.15 });
    guard.root.position.set(-2.4, 0, -1.8); guard.root.rotation.y = 0.6; C.add(guard.root); this.guard = guard;
  }

  buildDen() { // the Director's room: dark, a wall of TVs, a chair, his silhouette
    const D = new THREE.Group(); D.position.copy(DEN); this.sets.add(D);
    this.feed = new THREE.WebGLRenderTarget(512, 288, { colorSpace: THREE.SRGBColorSpace });
    this.penCam = new THREE.PerspectiveCamera(58, 16 / 9, 0.05, 120);
    const floor = worldBox(10, 0.02, 10, surface(T.concrete, 0x3a3630)); floor.position.y = -0.01; D.add(floor);
    const casing = new THREE.MeshStandardMaterial({ color: 0x1a1918, roughness: 0.5 });
    const statTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 96; const g = c.getContext('2d'); const img = g.createImageData(128, 96); for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 200; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; } g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    this.tvs = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) {
      const x = (c - 2) * 0.78, y = 0.75 + r * 0.6, live = (r + c) % 2 === 0 || (r === 1 && c === 2);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.56, 0.5), casing); box.position.set(x, y, -1.8); D.add(box);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), new THREE.MeshBasicMaterial({ map: live ? this.feed.texture : statTex, toneMapped: false })); scr.position.set(x, y, -1.549); D.add(scr);
      this.tvs.push(scr);
    }
    const glow = new THREE.PointLight(0xd8e0d0, 5, 6, 1.4); glow.position.set(0, 1.4, -1.0); D.add(glow);
    // the chair and the man in it, seen only from behind against the screens
    const dark = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9 });
    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.12), dark); chair.position.set(-0.75, 0.95, 0.3); D.add(chair);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.6), dark); seat.position.set(-0.75, 0.5, 0.05); D.add(seat);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), dark); head.position.set(-0.75, 1.62, 0.2); head.scale.set(0.9, 1.1, 1); D.add(head);
    const shoulders = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.3, 4, 8), dark); shoulders.rotation.z = Math.PI / 2; shoulders.position.set(-0.75, 1.42, 0.22); D.add(shoulders);
    const mic = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.006, 4, 16, Math.PI * 0.8), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.6, roughness: 0.3 })); mic.position.set(-0.73, 1.62, 0.19); mic.rotation.y = Math.PI / 2; D.add(mic);
    const desk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.7), new THREE.MeshStandardMaterial({ color: 0x15110d, roughness: 0.4 })); desk.position.set(0, 0.8, -0.9); D.add(desk);
  }

  // ------------------------------------------------------------ run
  start(onDone, vr) {
    this.active = true; this.t = 0; this.done = onDone; this.said = new Set(); this.flatline = false; this.hiss = false;
    const cp = this.camera.getWorldPosition(new V()), f = this.camera.getWorldDirection(new V()); f.y = 0; f.normalize();
    this.screen.position.copy(cp).addScaledVector(f, 3); this.screen.position.y = Math.max(1.4, cp.y);
    this.screen.lookAt(cp.x, this.screen.position.y, cp.z);
    this.vr = vr;
    // real shadows on the sets (desktop only: the Quest can't spare it)
    this.shadowsWas = this.renderer.shadowMap.enabled; if (!vr) { this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
    // Cash on the mattress in the real pen
    this.cashPen = new Person({ mask: null, weapon: null, cash: true, stains: 0.5, top: [0.44, 0.5, 0.58], legs: [0.62, 0.68, 0.78], hood: false, skin: [0.55, 0.38, 0.28], bulk: 1.15, stubble: true });
    this.world.scene.add(this.cashPen.root);
    document.getElementById('skip').hidden = false;
  }
  skip() { if (this.active) { this.sound.hush(); this.finish(); } }
  finish() {
    this.active = false; document.getElementById('skip').hidden = true;
    this.renderer.shadowMap.enabled = !!this.shadowsWas;
    if (this.cashPen) { this.world.scene.remove(this.cashPen.root); this.cashPen = null; }
    const d = this.done; this.done = null; d && d();
  }
  update(dt) {
    if (!this.active) return;
    this.t += dt; const t = this.t;
    for (const [at, id] of LINES) if (t >= at && !this.said.has(id)) { this.said.add(id); this.sound.say(id); }
    const S = this.sound;
    if (t > 12 && t < 22 && S.ctx) { this.beepT = (this.beepT || 0) - dt; if (this.beepT <= 0) { this.beepT = 0.8 + (t - 12) * 0.18; S.tone(S.sfx, { f: 1050, dur: 0.09, gain: 0.06 }); } }
    if (t > 22 && !this.flatline && S.ctx) { this.flatline = true; S.tone(S.sfx, { f: 1050, dur: 2.4, gain: 0.05 }); }
    if (t > 24.5 && t < 27 && !this.hiss && S.ctx) { this.hiss = true; S.burst(S.sfx, { dur: 2.4, f: 3000, q: 0.4, gain: 0.08, attack: 0.02 }); }
    this.animatePeople(dt, t);
    this.drawEkg(t);
    this.drawHud();
    // don't cut the Director off: hold the last shot until every line has been spoken (up to 25 s more)
    if (t >= LENGTH && (this.sound.idle() || t > LENGTH + 25)) this.finish();
  }

  animatePeople(dt, t) {
    const a = this.anchor; a.anim.speed = 0; a.animate(dt, t); a.face(dt, this.sound.mouth('NEWS'));
    // talking: little nods and turns, hands resting on the desk
    a.bones[B.head].rotation.x += Math.sin(t * 2.3) * 0.03; a.bones[B.head].rotation.y += Math.sin(t * 0.7) * 0.08;
    for (const s of ['L', 'R']) { a.bones[B['arm' + s]].rotation.x -= 0.45; a.bones[B['arm' + s]].rotation.z += s === 'L' ? 0.15 : -0.15; a.bones[B['fore' + s]].rotation.x -= 1.15; }
    a.bones[B.thighL].rotation.x -= 1.5; a.bones[B.thighR].rotation.x -= 1.5; a.bones[B.shinL].rotation.x += 1.5; a.bones[B.shinR].rotation.x += 1.5;
    // Cash on the gurney: arms out on the boards, chest rising, then still
    const c = this.cashBed; c.anim.speed = 0; c.animate(dt, t);
    c.bones[B.armL].rotation.z += 1.3; c.bones[B.armR].rotation.z -= 1.3;
    const breath = t < 21 ? Math.sin(t * 2.2) * 0.04 * Math.max(0, 1 - (t - 12) / 10) : 0;
    c.bones[B.chest].rotation.x += breath; c.bones[B.head].rotation.y = t < 19 ? Math.sin(t * 0.8) * 0.3 : 0.15;
    if (c.lids) { const shut = clamp01((t - 20.5) / 1.5); for (const l of c.lids) l.rotation.x = -1.2 + shut * 1.15; if (t < 20.5) c.face(0, 0); }
    // the doctor works the IV, the guard stands
    const d = this.doctor; d.anim.speed = 0; d.animate(dt, t); d.face(dt, 0); this.guard.face(dt, 0); d.bones[B.armR].rotation.x -= 1.1 + Math.sin(t * 0.9) * 0.15; d.bones[B.foreR].rotation.x -= 0.8; d.bones[B.head].rotation.x += 0.3;
    this.guard.anim.speed = 0; this.guard.animate(dt, t);
    // Cash in the pen: lies there, sits up, gets to his feet
    const p = this.cashPen; if (!p) return;
    const lt = t - 31.5, up = clamp01((lt - 5) / 4), stand = clamp01((lt - 18) / 3.5);
    p.anim.speed = 0; p.anim.crouch = (1 - stand) * up * 0.9; p.animate(dt, t); p.face(dt, this.sound.mouth('CASH'));
    p.bones[B.head].rotation.y = Math.sin(t * 0.6) * 0.5 * up;
    const lie = 1 - up;
    p.root.position.set(-33 + stand * 0.6, 0.12 * lie, 22 + stand * 0.3);
    p.root.rotation.set(-Math.PI / 2 * lie, 0.3 + stand * 1.6, 0);
    if (lie > 0.01) p.root.position.z = 22 - 0.95 * lie + 0.95;
  }

  drawEkg(t) {
    const g = this.ekg.getContext('2d'); g.fillStyle = '#020a04'; g.fillRect(0, 0, 256, 128);
    g.strokeStyle = '#3cff6a'; g.lineWidth = 2; g.beginPath();
    const lt = t - 12;
    for (let x = 0; x < 256; x++) {
      const tt = lt - (256 - x) / 80, alive = tt < 10, ph = (tt / (1.3 + Math.max(0, tt) * 0.2)) % 1;
      const beat = alive && ph > 0.1 && ph < 0.18 ? Math.sin((ph - 0.1) / 0.08 * Math.PI) * 44 * Math.max(0, 1 - tt / 10.5) : 0;
      x ? g.lineTo(x, 80 - beat) : g.moveTo(0, 80 - beat);
    }
    g.stroke(); g.fillStyle = '#3cff6a'; g.font = '18px monospace'; g.fillText(lt < 10 ? `HR ${Math.max(0, Math.round(64 - lt * 6))}` : 'HR --', 8, 22);
    this.ekgTex.needsUpdate = true;
  }

  // camera for the current shot; returns which scene to film
  shoot(t) {
    const shot = SHOTS.find(([a, b]) => t >= a && t < b) || SHOTS[SHOTS.length - 1], lt = t - shot[0], c = this.cam;
    const at = (o, x, y, z) => c.position.set(o.x + x, o.y + y, o.z + z), look = (o, x, y, z) => c.lookAt(o.x + x, o.y + y, o.z + z);
    c.fov = 42;
    switch (shot[2]) {
      case 'news': at(STUDIO, 0.5 - lt * 0.03, 1.35, 4.2 - lt * 0.08); look(STUDIO, 0.35, 1.1, 0); break;
      case 'newsMug': at(STUDIO, 0.6, 1.8, 1.5 - lt * 0.05); look(STUDIO, 1.5, 1.9, -1.4); c.fov = 30; break;
      case 'chamber': at(CHAMBER, -2.7, 2.8, 2.7); look(CHAMBER, 0.2, 0.8, -0.2); c.fov = 62; break; // CCTV up in the corner
      case 'chamberClose': at(CHAMBER, -0.3 + lt * 0.03, 1.9 - lt * 0.02, 1.4 - lt * 0.03); look(CHAMBER, 0.6, 1.0, 0); c.fov = 40; break;
      case 'monitors': at(DEN, 0.2 - lt * 0.05, 1.5, 2.6 - lt * 0.12); look(DEN, 0, 1.6, -1.5); c.fov = 50; break;
      case 'wake': at(new V(-33, 0, 22), 0, 0.35, 0.15); c.lookAt(-32.6 + Math.sin(lt * 1.3) * 0.3, 3.4, 23.2); c.fov = 70; break;
      default: c.position.set(-35.3, 2.5, 17.2); c.lookAt(-32.6 + Math.sin(lt * 0.2) * 0.5, 0.7, 22); c.fov = 52; // the pen's CCTV
    }
    c.updateProjectionMatrix();
    return { kind: shot[2], lt, end: shot[1] };
  }

  render() {
    if (!this.active) return;
    const R = this.renderer, xr = R.xr.enabled;
    const s = this.shoot(this.t);
    if (R.xr.isPresenting) { // VR: no flat screen; you stand where the camera is, inside the scene
      const dolly = this.camera.parent, c = this.cam;
      const f = new V(0, 0, -1).applyQuaternion(c.quaternion);
      dolly.position.set(c.position.x, c.position.y - 1.6, c.position.z);
      dolly.rotation.set(0, Math.atan2(-f.x, -f.z), 0); dolly.updateMatrixWorld(true);
      if (s.kind === 'static') { R.setClearColor(0x000000); R.clear(); return; }
      const scene = s.kind === 'wake' || s.kind === 'pen' ? this.world.scene : this.sets;
      if (s.kind === 'monitors') { const pc = this.penCam; pc.position.set(-35.2, 3.0, 15.0); pc.lookAt(-32.5, 0.4, 21.8); R.xr.enabled = false; const ex = R.toneMappingExposure; R.toneMappingExposure = ex * 2.6; R.setRenderTarget(this.feed); R.render(this.world.scene, pc); R.setRenderTarget(null); R.toneMappingExposure = ex; R.xr.enabled = true; }
      const ex = R.toneMappingExposure; if (scene === this.world.scene) R.toneMappingExposure = ex * 2.2;
      R.render(scene, this.camera); R.toneMappingExposure = ex;
      return;
    }
    R.xr.enabled = false; // film with our own camera
    R.setRenderTarget(this.rt);
    if (s.kind === 'static') { R.setClearColor(0x000000); R.clear(); }
    else if (s.kind === 'monitors') {
      // film the pen first, then the wall of TVs showing it
      const pc = this.penCam; pc.position.set(-35.2, 3.0, 15.0); pc.lookAt(-32.5, 0.4, 21.8);
      const ex = R.toneMappingExposure; R.toneMappingExposure = ex * 2.6;
      R.setRenderTarget(this.feed); R.render(this.world.scene, pc); R.toneMappingExposure = ex;
      R.setRenderTarget(this.rt); R.render(this.sets, this.cam);
    }
    else if (s.kind === 'wake' || s.kind === 'pen') { const ex = R.toneMappingExposure; R.toneMappingExposure = ex * 2.2; R.render(this.world.scene, this.cam); R.toneMappingExposure = ex; }
    else R.render(this.sets, this.cam);
    R.setRenderTarget(null); R.xr.enabled = xr;
    if (R.xr.isPresenting) R.render(this.room, this.camera);
    else {
      // letterbox to 16:9
      const a = innerWidth / innerHeight, k = 16 / 9;
      this.flatImg.scale.set(a > k ? k / a : 1, a > k ? 1 : a / k, 1); this.flatHud.scale.copy(this.flatImg.scale);
      R.setClearColor(0x000000); R.clear(); R.render(this.flat, this.flatCam);
    }
  }

  // ------------------------------------------------------------ 2D layer
  drawHud() {
    const g = this.g, t = this.t; g.clearRect(0, 0, W, H);
    const shot = SHOTS.find(([a, b]) => t >= a && t < b) || SHOTS[SHOTS.length - 1], lt = t - shot[0], k = shot[2];
    if (k === 'news' || k === 'newsMug') {
      g.fillStyle = '#a01010'; g.fillRect(40, 400, 520, 46); g.fillStyle = '#fff'; g.font = 'bold 30px Arial, sans-serif'; g.fillText('EXECUTION TONIGHT', 56, 434);
      g.fillStyle = '#e8e2d0'; g.fillRect(40, 446, 520, 34); g.fillStyle = '#111'; g.font = 'bold 20px Arial, sans-serif'; g.fillText('CARCER CITY STATE PENITENTIARY', 56, 470);
      g.fillStyle = 'rgba(16,14,12,0.9)'; g.fillRect(0, 505, W, 35); g.fillStyle = '#ffd24a'; g.font = '18px Arial, sans-serif';
      const tick = '  ...  CONVICTED KILLER JAMES EARL CASH TO DIE BY LETHAL INJECTION AT MIDNIGHT  ...  GOVERNOR DENIES FINAL APPEAL  ...  CROWD GATHERS OUTSIDE PRISON GATES  ...';
      g.fillText(tick + tick, W - (t * 110) % 1900, 529);
      g.fillStyle = '#fff'; g.font = 'bold 14px Arial'; g.fillText('LIVE', 890, 40);
    } else if (k === 'chamber' || k === 'chamberClose') {
      camHud(g, 'CAM 03  DEATH ROW - CHAMBER', `11:58:${String(Math.floor(t - 12) % 60).padStart(2, '0')} PM`, t);
    } else if (k === 'static') {
      const img = g.createImageData(W / 4, H / 4), d = img.data;
      for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      const c = document.createElement('canvas'); c.width = W / 4; c.height = H / 4; c.getContext('2d').putImageData(img, 0, 0);
      g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, W, H); g.imageSmoothingEnabled = true;
      g.fillStyle = '#fff'; g.font = 'bold 34px "Courier New", monospace'; g.fillText('TAPE 02', W / 2 - 70, H / 2 + 12);
    } else if (k === 'monitors') {
      // no graphics: just his room
    } else if (k === 'wake') { // eyelids
      const open = clamp01(lt / 3.4) * (lt > 2.1 && lt < 2.45 ? 0.2 : 1), lid = 1 - open;
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H * lid * 0.5 + 2); g.fillRect(0, H - H * lid * 0.5 - 2, W, H * lid * 0.5 + 2);
      g.fillStyle = `rgba(0,0,0,${0.5 * (1 - open)})`; g.fillRect(0, 0, W, H);
    } else {
      camHud(g, 'CAM 01  CARCER MARKET', `00:0${Math.floor(lt / 10)}:${String(Math.floor(lt * 3) % 60).padStart(2, '0')} AM`, t);
      g.fillStyle = '#ff2a1a'; g.font = 'bold 22px "Courier New", monospace'; if (Math.sin(t * 5) > -0.2) g.fillText('● LIVE', 820, 40);
      g.fillStyle = '#e8e2d0'; g.font = '16px "Courier New", monospace'; g.fillText(`VIEWERS ${1200 + Math.floor(lt * 37)}`, 790, 66);
    }
    // tape grain + scanlines, and fades at every cut
    g.globalAlpha = 0.1; for (let i = 0; i < 1100; i++) { const v = Math.random() < 0.5 ? 0 : 255; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); } g.globalAlpha = 1;
    g.fillStyle = 'rgba(0,0,0,0.14)'; for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
    const fade = Math.min(1, lt / 0.5, (shot[1] - t) / 0.5);
    if (k !== 'newsMug' && k !== 'chamberClose' || lt > 0.5) { g.fillStyle = `rgba(0,0,0,${1 - Math.max(0, fade)})`; g.fillRect(0, 0, W, H); }
    this.hudTex.needsUpdate = true;
  }
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));
function camHud(g, label, time, t) {
  g.fillStyle = '#e8e8e0'; g.font = '20px "Courier New", monospace'; g.fillText(label, 26, 40); g.fillText(time, 26, 66);
  if (Math.sin(t * 4) > 0) { g.fillStyle = '#ff2a1a'; g.beginPath(); g.arc(W - 40, H - 40, 9, 0, 7); g.fill(); g.fillStyle = '#e8e8e0'; g.fillText('REC', W - 100, H - 33); }
  g.strokeStyle = 'rgba(230,230,220,0.6)'; g.lineWidth = 2;
  for (const [x, y, dx, dy] of [[20, 20, 1, 1], [W - 20, 20, -1, 1], [20, H - 20, 1, -1], [W - 20, H - 20, -1, -1]]) { g.beginPath(); g.moveTo(x, y + dy * 30); g.lineTo(x, y); g.lineTo(x + dx * 30, y); g.stroke(); }
}
function makeMug() { // the prison photo on the studio monitor
  const c = document.createElement('canvas'); c.width = 320; c.height = 240; const g = c.getContext('2d');
  g.fillStyle = '#9a9a92'; g.fillRect(0, 0, 320, 240);
  g.strokeStyle = 'rgba(40,40,40,0.4)'; for (let y = 20; y < 240; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(320, y); g.stroke(); }
  const sk = g.createRadialGradient(150, 90, 10, 160, 100, 60); sk.addColorStop(0, '#9a6a52'); sk.addColorStop(1, '#5e3e30');
  g.fillStyle = '#2b2b2e'; g.beginPath(); g.moveTo(70, 240); g.quadraticCurveTo(160, 150, 250, 240); g.fill();
  g.fillStyle = sk; g.fillRect(140, 130, 40, 40); g.beginPath(); g.ellipse(160, 100, 44, 54, 0, 0, 7); g.fill();
  g.fillStyle = 'rgba(30,25,22,0.5)'; g.beginPath(); g.ellipse(160, 128, 34, 24, 0, 0, Math.PI); g.fill();
  g.fillStyle = '#1a1210'; g.fillRect(138, 92, 14, 4); g.fillRect(168, 92, 14, 4); g.fillRect(150, 130, 20, 3);
  g.fillStyle = '#111'; g.fillRect(100, 190, 120, 40); g.fillStyle = '#eee'; g.font = 'bold 15px "Courier New", monospace'; g.fillText('CASH J.E.', 115, 206); g.fillText('C-1374', 128, 224);
  return c;
}
