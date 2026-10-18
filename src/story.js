// story.js — the cutscenes between scenes, shot in 3D like the opening tape: small sets built from
// the game's own painted surfaces, real people (the same bodies as the hunters), a moving camera,
// voiced lines and the tape's 2D layer (CCTV, the Journalist's camcorder, the news). Desktop shows
// the film full screen; in VR you stand where the camera is, inside each shot. Any button skips.
// Every story is keyed by the scene it leads into ('ending' plays after the last one).
import * as THREE from '../vendor/three.module.js';
import { Person, BONE as B } from './body.js?v=43';
import { T } from './paint.js?v=43';
import { GANG_SETS } from './hunters.js?v=43';

const V = THREE.Vector3, PI = Math.PI;
const RW = 1280, RH = 720, W = 960, H = 540;
const O = new V(900, 0, 0); // the stage, far from any level
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, k) => a + (b - a) * k;

// the cast
const CASH = { mask: null, weapon: null, cash: true, stains: 0.5, top: [0.44, 0.5, 0.58], legs: [0.62, 0.68, 0.78], hood: false, skin: [0.55, 0.38, 0.28], bulk: 1.15, stubble: true };
const JOURNO = { longHair: true, mask: null, weapon: null, top: [0.72, 0.66, 0.58], legs: [0.12, 0.12, 0.14], skin: [0.66, 0.5, 0.4], hair: [0.07, 0.035, 0.018], bulk: 0.86, dirt: 0.1, stains: 0, hood: false };
const RAMIREZ = { mask: null, weapon: null, skin: [0.55, 0.38, 0.27], bulk: 1.22, stubble: true, top: [0.55, 0.47, 0.34], sleeves: 'short', legs: [0.9, 0.9, 0.9], legsMap: 'camoUrban', boots: [0.08, 0.08, 0.07], gloves: [0.06, 0.06, 0.05], hood: false, gear: [{ t: 'vest', col: [0.06, 0.06, 0.05] }, { t: 'cap', col: [0.12, 0.05, 0.04] }] };
const STARK = { mask: null, weapon: null, skin: [0.7, 0.55, 0.47], bulk: 1.05, hair: [0.55, 0.55, 0.52], top: [0.22, 0.22, 0.24], legs: [0.22, 0.22, 0.24], legsMap: 'fleece', dirt: 0.05, stains: 0, hood: false };
const COP = { mask: null, weapon: null, skin: [0.62, 0.45, 0.35], stubble: true, top: [0.1, 0.13, 0.26], sleeves: 'short', legs: [0.05, 0.06, 0.1], legsMap: 'fleece', hood: false, gear: [{ t: 'cap', col: [0.05, 0.06, 0.12] }] };
const gang = (k, n = 0, o = {}) => Object.assign({ hood: false, dirt: 1, stains: 0.4, seed: 300 + n }, GANG_SETS[k].members[n % GANG_SETS[k].members.length], o);

// ------------------------------------------------------------ the stage kit
function makeKit(root) {
  const mats = {};
  const mat = (tex, col = 0xffffff, rep = 3) => {
    const key = tex + col + rep; if (mats[key]) return mats[key];
    const t = T[tex], c = (m) => { if (!m) return undefined; const k = m.clone(); k.needsUpdate = true; k.wrapS = k.wrapT = THREE.RepeatWrapping; return k; };
    return (mats[key] = t ? new THREE.MeshStandardMaterial({ map: c(t.map), normalMap: c(t.normal), roughnessMap: c(t.rough), color: col, roughness: 1 }) : new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 }));
  };
  // a box with its texture tiled in metres
  const box = (x, y, z, w, h, d, m, tile = 3) => {
    const g = new THREE.BoxGeometry(w, h, d), p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), X = p.getX(i) + x, Y = p.getY(i) + y, Z = p.getZ(i) + z; if (ay > 0.5) uv.setXY(i, X / tile, Z / tile); else if (ax > 0.5) uv.setXY(i, Z / tile, Y / tile); else uv.setXY(i, X / tile, Y / tile); }
    const mesh = new THREE.Mesh(g, typeof m === 'number' ? new THREE.MeshStandardMaterial({ color: m, roughness: 0.8 }) : m); mesh.position.set(x, y, z); root.add(mesh); return mesh;
  };
  const K = {
    mat, box,
    // an interior: floor, four walls (one left open towards the camera if `open`), a ceiling
    room(x, z, w, d, h, wall, floor, { open = null, ceil = true } = {}) {
      box(x, -0.05, z, w, 0.1, d, floor);
      if (open !== 'n') box(x, h / 2, z - d / 2, w, h, 0.12, wall); if (open !== 's') box(x, h / 2, z + d / 2, w, h, 0.12, wall);
      if (open !== 'w') box(x - w / 2, h / 2, z, 0.12, h, d, wall); if (open !== 'e') box(x + w / 2, h / 2, z, 0.12, h, d, wall);
      if (ceil) box(x, h, z, w, 0.1, d, 0x1a1816);
    },
    ground(x, z, w, d, m) { box(x, -0.05, z, w, 0.1, d, m, 4); },
    light(x, y, z, col = 0xffd8a0, i = 3, r = 10, bulb = true) {
      const L = new THREE.PointLight(col, i * 8, r * 1.3, 1.4); L.position.set(x, y, z); root.add(L);
      if (bulb) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: col })); b.position.set(x, y, z); root.add(b); }
      return L;
    },
    spot(x, y, z, tx, ty, tz, col = 0xe8e0d0, i = 30) { const s = new THREE.SpotLight(col, i * 4, 30, 0.5, 0.5, 1.4); s.position.set(x, y, z); s.target.position.set(tx, ty, tz); root.add(s, s.target); return s; },
    person(look, x, z, yaw = 0) {
      const P = new Person(Object.assign({ seed: 400 + root.children.length }, look)); P.root.position.set(x, 0, z); P.root.rotation.y = yaw; root.add(P.root); P.at = new V(x, 0, z); P.yaw = yaw;
      if (look.longHair) { // shoulder-length hair: a cap over the crown and a fall down the back
        const hc = new THREE.Color(...(look.hair || [0.3, 0.18, 0.08])), hm = new THREE.MeshStandardMaterial({ color: hc, roughness: 0.75 }), hd = P.bones[B.head];
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 12, 0, PI * 2, 0, PI * 0.58), hm); cap.position.set(0, 0.13, -0.005); cap.scale.set(1.04, 1.06, 1.12); hd.add(cap);
        const fall = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.16, 4, 10), hm); fall.position.set(0, 0.0, -0.06); fall.scale.set(1.15, 1, 0.55); hd.add(fall);
        for (const sd of [1, -1]) { const side = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.14, 4, 8), hm); side.position.set(0.1 * sd, 0.03, 0.0); hd.add(side); }
      }
      return P;
    },
    // a TV: a dark box with a screen that shows static or a picture
    tv(x, y, z, ry = 0) {
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; root.add(g);
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.5), new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.6 })));
      const c = document.createElement('canvas'); c.width = 128; c.height = 96; const tex = new THREE.CanvasTexture(c);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.42), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); scr.position.z = 0.252; g.add(scr);
      const glow = new THREE.PointLight(0x9ab0d0, 1.5, 4); glow.position.z = 0.6; g.add(glow);
      g.userData.draw = (fn) => { fn(c.getContext('2d'), 128, 96); tex.needsUpdate = true; }; g.userData.screen = scr; return g;
    },
    car(x, z, ry, col = 0x6a1a1a) {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
      const body = new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.5 }), glass = new THREE.MeshStandardMaterial({ color: 0x0a0d10, roughness: 0.1, metalness: 0.8 }), tyre = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 3.8), body); b.position.y = 0.6; g.add(b);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.9), glass); cab.position.set(0, 1.15, -0.2); g.add(cab);
      for (const sx of [-0.8, 0.8]) for (const sz of [-1.2, 1.2]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.25, 14), tyre); w.rotation.z = PI / 2; w.position.set(sx, 0.32, sz); g.add(w); }
      for (const sx of [-0.55, 0.55]) { const h = new THREE.Mesh(new THREE.CircleGeometry(0.1, 10), new THREE.MeshBasicMaterial({ color: 0xfff2c8 })); h.position.set(sx, 0.65, -1.91); h.rotation.y = PI; g.add(h); }
      return g;
    },
    van(x, z, ry, col = 0x1a1c1e) {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
      const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, metalness: 0.4 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.2, 5.4), m); b.position.y = 1.4; g.add(b);
      const tyre = new THREE.MeshStandardMaterial({ color: 0x111111 }); for (const sx of [-0.95, 0.95]) for (const sz of [-1.8, 1.8]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 14), tyre); w.rotation.z = PI / 2; w.position.set(sx, 0.4, sz); g.add(w); }
      const back = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), new THREE.MeshBasicMaterial({ color: 0x030303 })); back.position.set(0, 1.4, 2.71); g.add(back); // doors open: dark inside
      return g;
    },
    sign(text, x, y, z, ry = 0, { w = 2, h = 0.5, bg = '#1a1a1a', fg = '#e8e0c8', font = 'bold 64px Arial' } = {}) {
      const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w); const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width / 2, c.height / 2);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t })); m.position.set(x, y, z); m.rotation.y = ry; root.add(m); return m;
    },
  };
  return K;
}

// ------------------------------------------------------------ acting
// each frame: walk cycle from speed, then a pose laid over the bones
function act(P, dt, t, { speed = 0, pose = null, talk = 0, crouch = 0 } = {}) {
  P.anim.speed = speed; P.anim.crouch = crouch; P.animate(dt, t); P.face?.(dt, talk);
  if (pose) pose(P, t);
  P.root.position.copy(P.at); P.root.rotation.y = P.yaw;
}
// move along a straight line between two times, facing the way you go
function walk(P, a, b, t0, t1, t) { const k = clamp01((t - t0) / (t1 - t0)); P.at.set(lerp(a[0], b[0], k), 0, lerp(a[1], b[1], k)); if (k > 0 && k < 1) P.yaw = Math.atan2(b[0] - a[0], b[1] - a[1]); return k > 0 && k < 1 ? Math.hypot(b[0] - a[0], b[1] - a[1]) / (t1 - t0) : 0; }
const POSE = {
  kneel: (P) => { P.bones[B.hips].position.y -= 0.5; for (const s of ['L', 'R']) { P.bones[B['thigh' + s]].rotation.x -= 0.1; P.bones[B['shin' + s]].rotation.x += 1.75; } },
  sit: (P) => { P.bones[B.hips].position.y -= 0.45; for (const s of ['L', 'R']) { P.bones[B['thigh' + s]].rotation.x -= 1.5; P.bones[B['shin' + s]].rotation.x += 1.5; } },
  aim: (P) => { P.bones[B.armR].rotation.x -= 1.1; P.bones[B.foreR].rotation.x -= 0.1; P.bones[B.armL].rotation.x -= 1.0; P.bones[B.armL].rotation.z -= 0.35; P.bones[B.foreL].rotation.x -= 0.3; },
  phone: (P) => { P.bones[B.armR].rotation.x -= 0.4; P.bones[B.armR].rotation.z -= 0.3; P.bones[B.foreR].rotation.x -= 2.2; },
  point: (P) => { P.bones[B.armR].rotation.x -= 1.5; },
  hands: (P) => { for (const s of ['L', 'R']) { P.bones[B['arm' + s]].rotation.x -= 0.5; P.bones[B['fore' + s]].rotation.x -= 1.1; } }, // hands together in front (a tray, a camera, cuffs)
  lie: (P) => { P.root.rotation.x = -PI / 2; },
  pinned: (P) => { P.bones[B.chest].rotation.x -= 0.2; P.bones[B.armL].rotation.z += 0.8; P.bones[B.armR].rotation.z -= 0.8; P.bones[B.head].rotation.x -= 0.3; },
  choke: (P) => { P.bones[B.armR].rotation.x -= 1.5; P.bones[B.foreR].rotation.x -= 0.2; },
  thrash: (P, t) => { P.bones[B.armL].rotation.z += 0.6 + Math.sin(t * 9) * 0.6; P.bones[B.armR].rotation.z -= 0.6 + Math.sin(t * 9 + 1) * 0.6; P.bones[B.chest].rotation.y = Math.sin(t * 6) * 0.4; P.bones[B.head].rotation.x += Math.sin(t * 7) * 0.3; },
  smash: (P, t) => { const k = (t * 1.6) % 1; P.bones[B.armR].rotation.x -= k < 0.5 ? 2.6 * k * 2 : 2.6 * (1 - k) * 2 * 0.3; },
  cower: (P) => { P.bones[B.hips].position.y -= 0.6; for (const s of ['L', 'R']) { P.bones[B['thigh' + s]].rotation.x -= 1.6; P.bones[B['shin' + s]].rotation.x += 1.4; P.bones[B['arm' + s]].rotation.x -= 1.4; P.bones[B['fore' + s]].rotation.x -= 1.6; } P.bones[B.head].rotation.x += 0.4; },
};

// ------------------------------------------------------------ the stories
// shots: [t0, t1, from, to, look, fov, hud]   (positions relative to the stage; `to` slides the camera over the shot)
// lines: [t, id]   (lines.js ids; ones that aren't in lines.js are skipped)
const STORIES = {
  // after Fuelled By Hate... and before White Trash: the Cerberus van empties Cash out at the junkyard gate
  'white-trash': (K) => {
    K.ground(0, 0, 30, 30, K.mat('asphalt', 0x6a6660)); K.box(0, 2, -8, 30, 4, 0.3, K.mat('metal', 0x7a756a)); K.sign('DENTONS CITY SALVAGE', 0, 3.4, -7.8, 0, { w: 5, h: 0.8, bg: '#2a2a20', fg: '#d8c870' });
    K.light(-3, 4.5, -5, 0xffc070, 6, 16); K.light(3, 3.6, 1.5, 0xffc070, 5, 12);
    const van = K.van(7.5, -0.8, -PI / 2); const c1 = K.person(gang('cerberus', 0), 4.3, 0.2, -PI / 2), c2 = K.person(gang('cerberus', 1), 4.4, -1.7, -PI / 2), cash = K.person(CASH, 4.8, -0.8, -PI / 2);
    return { len: 14, shots: [[0, 6, [-2.5, 2.4, 4], [-2, 2.3, 3.4], [2.5, 1, -1], 55, 'cctv:CAM 07  SALVAGE GATE'], [6, 14, [0.4, 1.4, 1.6], [0.3, 1.4, 1.2], [3.5, 1.0, -0.8], 42, null]],
      lines: [[1, 'dir_st_wt_1'], [8, 'dir_st_wt_2']],
      tick(t, dt) { const thrown = clamp01((t - 2) / 1.2); cash.at.set(4.8 - thrown * 3.2, 0, -0.8); act(cash, dt, t, { pose: thrown > 0.95 ? POSE.kneel : null, talk: 0 });
        act(c1, dt, t, { pose: POSE.aim }); act(c2, dt, t, { pose: t > 6 ? POSE.aim : null }); if (t > 10) { c1.at.x += dt * 1.2; c2.at.x += dt * 1.2; } } };
  },
  // Grounds for Assault: the Cerberus feed Piggsy through his door; then Ramirez briefs the Wardogs at the zoo
  'grounds': (K) => {
    K.room(0, 0, 5, 5, 3, K.mat('planks', 0x6a5a44), K.mat('planks', 0x4a3a2a)); K.light(0, 2.7, 0, 0xd8a070, 2.2, 7);
    const pig = K.person(gang('piggsy', 0, { weapon: null, bulk: 1.5 }), 0, -1, 0), cb = K.person(gang('cerberus', 2), 1.8, 1.8, -PI * 0.75);
    K.ground(20, 0, 16, 14, K.mat('concrete', 0x8a8a84)); K.box(20, 1.5, -6, 16, 3, 0.4, K.mat('brick', 0x8a6a58)); K.sign('CARCER CITY ZOO', 20, 2.6, -5.75, 0, { w: 4, h: 0.7, bg: '#2a3a20', fg: '#e8e0c8' }); K.light(20, 4, -2, 0xffc890, 5, 14);
    const ram = K.person(RAMIREZ, 20, -2.5, 0), w = [0, 1, 2].map((n) => K.person(gang('wardogs', n), 18.5 + n * 1.5, 0.4, PI));
    return { len: 22, shots: [[0, 9, [2.2, 2.6, 2.2], [2, 2.5, 2], [0, 0.9, -0.8], 60, 'cctv:CAM 02  ATTIC'], [9, 22, [23.6, 1.7, 1.4], [23.1, 1.7, 0.9], [20, 1.4, -1.6], 45, null]],
      lines: [[1, 'cb_st_feed'], [5, 'piggsy_2'], [10, 'rz_st_brief'], [17, 'dir_st_gr']],
      tick(t, dt) { act(pig, dt, t, { pose: t > 4 ? POSE.thrash : POSE.kneel }); act(cb, dt, t, { pose: POSE.hands, speed: walk(cb, [1.8, 1.8], [2.6, 2.6], 4, 5.5, t) });
        act(ram, dt, t, { pose: t > 14 ? POSE.point : null, talk: 0.5 + Math.sin(t * 9) * 0.5 }); for (const x of w) act(x, dt, t, {}); } };
  },
  // Strapped for Cash: the Journalist's video diary
  'strapped': (K) => {
    K.room(0, 0, 4, 4, 2.7, K.mat('wallpaper', 0x9a8a70), K.mat('wood', 0x6a5040)); K.light(1, 2.4, 0.8, 0xffe0b0, 2.5, 6); K.box(0, 0.4, -1.4, 1.6, 0.8, 0.7, 0x3a2a20);
    const j = K.person(JOURNO, 0, -0.6, 0);
    return { len: 18, shots: [[0, 18, [0, 1.2, 0.9], [0, 1.25, 0.8], [0, 1.35, -0.6], 40, 'cam']], lines: [[0.6, 'jo_diary_1']],
      tick(t, dt) { act(j, dt, t, { pose: POSE.sit, talk: 0 }); j.face?.(dt, 0.4 + Math.sin(t * 11) * 0.4); } };
  },
  // View of Innocence: the Innocentz in their mall, on the Director's monitors
  'innocence': (K) => {
    K.ground(0, 0, 24, 24, K.mat('slab', 0xb8b0a0)); K.box(0, 2.5, -7, 24, 5, 0.3, K.mat('stucco', 0x9a9284)); K.sign('VIEW OF INNOCENCE MALL', 0, 4, -6.8, 0, { w: 6, h: 0.8, bg: '#1a1a3a', fg: '#ff4aa0' });
    K.light(-4, 4.5, -3, 0xd8e0ff, 4, 14); K.light(5, 4.5, 2, 0xff70c0, 3, 12);
    const a = K.person(gang('innocentz', 0), -3, -2, PI / 2), b = K.person(gang('innocentz', 1), 3, -1, -PI / 2), c = K.person(gang('innocentz', 2), 0, 2, PI);
    return { len: 13, shots: [[0, 13, [-8, 4.5, 6], [-6, 4.4, 6], [0, 1, -1], 55, 'cctv:CAM 11  MALL ATRIUM']], lines: [[1, 'dir_st_vi']],
      tick(t, dt) { act(a, dt, t, { speed: walk(a, [-3, -2], [3, -3], 0, 12, t) }); act(b, dt, t, { pose: t % 4 < 2 ? POSE.point : null }); act(c, dt, t, { speed: walk(c, [0, 2], [-2, -4], 3, 11, t) }); } };
  },
  // after View of Innocence: the tape. His family on a screen; Cash puts his fist through it
  'drunk-driving': (K) => {
    K.room(0, 0, 4, 4, 2.6, K.mat('plaster', 0x7a7262), K.mat('concrete', 0x5a5650)); const tv = K.tv(0, 1, -1.6, 0); K.box(0, 0.35, -1.6, 1, 0.7, 0.6, 0x2a2018);
    K.light(0, 2.3, 0.6, 0xffd8a0, 1.2, 5);
    const cash = K.person(CASH, 0, 0.2, PI);
    let broke = false;
    return { len: 16, shots: [[0, 8, [0, 1.3, 1.6], [0, 1.25, 1.2], [0, 1.0, -1.6], 40, null], [8, 16, [1.4, 1.5, -0.4], [1.3, 1.5, -0.6], [0, 1.2, -0.6], 46, null]], lines: [[0.8, 'dir_st_tape'], [9, 'cash_st_tape']],
      tick(t, dt) { act(cash, dt, t, { pose: t > 11 && t < 12.5 ? POSE.smash : null, talk: 0 }); if (t > 11.6 && !broke) { broke = true; tv.userData.screen.material.color.set(0x050505); }
        if (!broke) tv.userData.draw((g, w, h) => { g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, w, h); if (t < 6) { g.fillStyle = '#6a4a3a'; g.fillRect(30, 30, 20, 40); g.fillRect(60, 34, 18, 36); g.fillStyle = '#c8b8a0'; g.fillRect(34, 22, 12, 12); g.fillRect(63, 26, 12, 12); } for (let k = 0; k < 400; k++) { const v = Math.random() * 255; g.fillStyle = `rgba(${v},${v},${v},${t < 6 ? 0.2 : 0.9})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 1); } }); } };
  },
  // Mouth of Madness: the Journalist again, closer to the Director now
  'madness': (K) => {
    K.room(0, 0, 4, 4, 2.7, K.mat('wallpaper', 0x9a8a70), K.mat('wood', 0x6a5040)); K.light(-1, 2.4, 0.8, 0xffe0b0, 2.2, 6); const tv = K.tv(1.3, 1.0, -1.6, -0.3);
    const j = K.person(JOURNO, 0, -0.5, 0);
    return { len: 18, shots: [[0, 18, [0, 1.25, 0.9], [0.05, 1.25, 0.8], [0, 1.35, -0.5], 40, 'cam']], lines: [[0.6, 'jo_diary_2']],
      tick(t, dt) { act(j, dt, t, { pose: POSE.sit }); j.face?.(dt, 0.4 + Math.sin(t * 10) * 0.4); tv.userData.draw((g, w, h) => { g.fillStyle = '#20304a'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8e8e8'; g.font = '12px Arial'; g.fillText('CASH STILL AT LARGE', 6, 86); }); } };
  },
  // Divided They Fall: through the wooden gate, into Ramirez's hands
  'divided': (K) => {
    K.ground(0, 0, 20, 20, K.mat('asphalt', 0x5a5650)); K.box(0, 2.5, -2.2, 12, 5, 0.3, K.mat('brick', 0x6a5446)); K.box(-5, 1.2, 2, 0.15, 2.4, 3, K.mat('wood', 0x7a6040)); K.light(-2, 4, 1, 0xd8c890, 4, 12);
    const cash = K.person(CASH, -4, 2, PI / 2), ram = K.person(RAMIREZ, 1, 0, -PI / 2), w = [0, 1, 2].map((n) => K.person(gang('wardogs', n, { weapon: 'machete' }), 2 + n, 2.5 + (n % 2), -PI / 2));
    return { len: 20, shots: [[0, 6, [-2, 1.6, 6], [-1, 1.6, 5], [-2, 1.2, 1], 48, null], [6, 13, [0.6, 1.6, 1.8], [0.5, 1.6, 1.4], [-0.6, 1.4, -1.6], 40, null], [13, 20, [-3, 1.4, 4], [-2.6, 1.5, 3.6], [0, 0.6, 0], 50, null]],
      lines: [[6, 'rz_st_hide'], [13.5, 'rz_st_count']],
      tick(t, dt) { const s = walk(cash, [-4, 2], [-0.6, -1.6], 0.5, 5, t); act(cash, dt, t, { speed: s, pose: t > 5 && t < 12 ? POSE.pinned : t >= 12 ? POSE.kneel : null }); if (t > 5) cash.yaw = 0;
        walk(ram, [1, 0], [-0.6, -0.8], 3.5, 5, t); act(ram, dt, t, { pose: t > 5 && t < 12 ? POSE.choke : t > 14 ? POSE.point : null, talk: t > 6 ? 0.5 + Math.sin(t * 9) * 0.5 : 0 }); if (t > 5) ram.yaw = PI;
        w.forEach((x, n) => { act(x, dt, t, { speed: walk(x, [2 + n, 2.5 + (n % 2)], [-1 + n * 0.8, 1 + (n % 2) * 0.4], 12, 15, t) }); }); } };
  },
  // Press Coverage: Starkweather calls the Chief of Police; then the car at the roadblock
  'press': (K) => {
    K.room(0, 0, 6, 5, 3, K.mat('wallpaper', 0x6a5238), K.mat('wood', 0x4a3020)); K.box(0, 0.4, -1, 2.4, 0.8, 1, 0x3a2414); K.light(0, 2.6, 0.5, 0xffd8a0, 2, 7);
    const st = K.person(STARK, 0, -1.9, 0);
    K.ground(30, 0, 12, 30, K.mat('asphalt', 0x5a5650)); K.box(25, 2.5, 0, 0.4, 5, 30, K.mat('concreteWall', 0x7a7a74)); K.box(35, 2.5, 0, 0.4, 5, 30, K.mat('concreteWall', 0x7a7a74)); K.box(30, 5, 0, 10, 0.3, 30, K.mat('concreteWall', 0x6a6a64));
    for (let z = -12; z <= 12; z += 6) K.light(30, 4.6, z, 0xffc070, 3, 9);
    const car = K.car(30, 3, 0); K.box(30, 0.5, -6, 6, 1, 0.4, 0xc8b020); const cash = K.person(CASH, 29.6, 3.5, PI), jo = K.person(JOURNO, 30.4, 3.3, PI);
    return { len: 22, shots: [[0, 10, [0.9, 1.45, 0.3], [0.7, 1.45, 0.1], [0, 1.2, -1.9], 42, null], [10, 22, [33, 1.5, -3], [32.6, 1.5, -2.4], [30, 1, 3], 50, null]],
      lines: [[0.8, 'dir_st_pc_1'], [5.5, 'sc_st_pc'], [7.5, 'dir_st_pc_2'], [12, 'jo_st_block'], [16, 'cash_st_block']],
      tick(t, dt) { act(st, dt, t, { pose: (P) => { POSE.sit(P); POSE.phone(P); }, talk: 0 }); st.face?.(dt, t < 10 ? 0.4 + Math.sin(t * 9) * 0.4 : 0);
        car.position.z = 3 + Math.max(0, 10 - (t - 10) * 3) ; act(cash, dt, t, { pose: POSE.sit }); act(jo, dt, t, { pose: POSE.sit }); cash.at.z = car.position.z + 0.5; jo.at.z = car.position.z + 0.3; } };
  },
  // Wrong Side of the Tracks: SWAT cut the power to the rails
  'tracks': (K) => {
    K.room(0, 0, 6, 5, 3, K.mat('concreteWall', 0x8a8a84), K.mat('concrete', 0x6a6a64)); K.box(0, 0.6, -2, 4, 1.2, 0.6, 0x3a4048); K.light(0, 2.7, 0, 0xd8e8f0, 2.5, 7);
    for (let k = 0; k < 4; k++) K.box(-1.5 + k, 1.6, -2.3, 0.7, 0.5, 0.1, new THREE.MeshBasicMaterial({ color: k === 2 ? 0x2aff4a : 0x2a6a3a }));
    const sw = K.person(gang('swat', 0), 0.5, -1.2, PI);
    return { len: 12, shots: [[0, 12, [-2.4, 2.6, 2], [-2.3, 2.6, 1.9], [0.4, 1, -1.5], 55, 'cctv:CAM 14  TRACK CONTROL']], lines: [[1, 'sw_st_power'], [6, 'dir_st_ws']],
      tick(t, dt) { act(sw, dt, t, { pose: t > 2.5 && t < 4 ? POSE.point : null }); } };
  },
  // Trained to Kill: Piggsy gets out
  'trained': (K) => {
    K.room(0, 0, 5, 5, 3, K.mat('planks', 0x5a4a34), K.mat('planks', 0x3a2a1a)); K.light(1.5, 2.6, 1, 0xd8a070, 1.6, 6);
    const pig = K.person(gang('piggsy', 0, { weapon: null, bulk: 1.5 }), 0, -1, 0);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2, 6), new THREE.MeshStandardMaterial({ color: 0x5a5a58, metalness: 0.8 })); chain.position.set(0, 2, -2.2); chain.rotation.x = 0.9; K.box(0, 2.9, -2.4, 0.2, 0.2, 0.2, 0x3a3a38);
    return { len: 12, shots: [[0, 12, [1.6, 2.4, 1.6], [1.5, 2.3, 1.5], [0, 1, -1], 60, 'cctv:CAM 02  ATTIC']], lines: [[0.8, 'piggsy_1'], [4, 'piggsy_2'], [9, 'piggsy_2']],
      tick(t, dt) { act(pig, dt, t, { pose: t < 8 ? POSE.thrash : null, speed: t > 9 ? 2 : 0 }); if (t > 9) pig.at.z += dt * 2; } };
  },
  // Border Patrol: the Journalist on the news outside the estate; the Cerberus with Cash in the garage
  'border': (K) => {
    K.ground(0, 0, 20, 20, K.mat('asphalt', 0x5a5650)); K.box(0, 3, -8, 20, 6, 0.4, K.mat('stucco', 0xc8c0a8)); K.light(0, 5, -3, 0xffe8c8, 5, 16); K.spot(0, 2, 3, 0, 1.4, -0.5, 0xffffff, 20);
    const jo = K.person(JOURNO, 0, -0.5, 0);
    K.room(30, 0, 8, 7, 3.2, K.mat('concreteWall', 0x8a8a84), K.mat('concrete', 0x6a6a64)); K.van(30, -2.4, 0); K.light(30, 3, 1, 0xd8d8c8, 3, 9);
    const cash = K.person(CASH, 31.3, 2.6, PI), cbs = [0, 1, 2].map((n) => K.person(gang('cerberus', n), 28.5 + n * 1.2, 1.1 + n * 0.3, PI * 0.7));
    return { len: 22, shots: [[0, 10, [0, 1.55, 2.6], [0, 1.55, 2.3], [0, 1.5, -0.5], 38, 'news:STARKWEATHER ESTATE|WAPONA HILLS — LIVE'], [10, 22, [27.2, 2.6, 3.2], [27.4, 2.5, 3], [30.6, 1, 1.8], 58, 'cctv:CAM 21  GARAGE']],
      lines: [[0.6, 'jo_st_news'], [11, 'cb_st_garage'], [17, 'piggsy_2']],
      tick(t, dt) { act(jo, dt, t, { pose: POSE.hands }); jo.face?.(dt, t < 10 ? 0.4 + Math.sin(t * 10) * 0.4 : 0); act(cash, dt, t, { pose: POSE.kneel });
        cbs.forEach((c, n) => act(c, dt, t, { pose: POSE.aim, speed: t > 18 ? 2 : 0 })); if (t > 18) for (const c of cbs) c.at.x -= dt * 2; } };
  },
  // Key Personnel: Cash at the cellar door; the Cerberus leader takes the lift key
  'key-personnel': (K) => {
    K.room(0, 0, 8, 6, 3.4, K.mat('wallpaper', 0x7a5a3a), K.mat('wood', 0x5a4030)); K.light(0, 3, 0, 0xffe2b0, 2.5, 8);
    const lead = K.person({ mask: null, weapon: null, skin: [0.62, 0.45, 0.35], bulk: 1.2, stubble: true, top: [0.06, 0.06, 0.06], legs: [0.06, 0.06, 0.07], legsMap: 'fleece', hood: false, gear: [{ t: 'vest', col: [0.05, 0.05, 0.05] }] }, 0, -1, PI / 2);
    const a = K.person(gang('cerberus', 0), 1.4, -1.4, -PI / 2), b = K.person(gang('cerberus', 1), 1.4, -0.4, -PI / 2);
    return { len: 16, shots: [[0, 16, [-3.6, 1.6, 2.4], [-3.5, 1.6, 2.3], [0.5, 1.3, -1], 34, 'peek']], lines: [[0.8, 'cl_st_key'], [6, 'cb_st_key'], [9, 'cl_st_motor']],
      tick(t, dt) { act(lead, dt, t, { pose: t > 5 && t < 7 ? POSE.point : null, talk: 0 }); lead.face?.(dt, (t < 5 || t > 9) ? 0.4 + Math.sin(t * 9) * 0.4 : 0); act(a, dt, t, { pose: t > 6 && t < 7.5 ? POSE.point : null }); act(b, dt, t, {});
        if (t > 12) { for (const p of [lead, a, b]) p.at.x += dt * 1.8; } } };
  },
  // Deliverance: the lift, and Piggsy's saw through its doors
  'deliverance': (K) => {
    K.room(0, 0, 2.2, 2.2, 2.6, K.mat('metal', 0x8a8478), K.mat('metal', 0x6a6460)); K.light(0, 2.4, 0, 0xffe8c8, 1.5, 4);
    const cash = K.person(CASH, 0, 0.2, PI); const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.6), new THREE.MeshStandardMaterial({ color: 0x9a9c98, metalness: 0.9 })); blade.position.set(0, 1.2, -1.2); blade.visible = false;
    K.box(0, 0, 0, 0.01, 0.01, 0.01, 0x000000).add(blade);
    return { len: 12, shots: [[0, 12, [0.8, 2.2, 0.9], [0.8, 2.2, 0.9], [0, 1.2, -0.9], 70, 'cctv:CAM 30  ELEVATOR']], lines: [[1, 'dir_st_dl'], [4, 'piggsy_2']],
      tick(t, dt) { act(cash, dt, t, { pose: t > 8 ? POSE.point : null, crouch: t > 4 && t < 8 ? 0.5 : 0 }); blade.visible = t > 4; blade.position.y = 1.2 + Math.sin(t * 6) * 0.3; if (t > 8) cash.at.y = (t - 8) * 0.6; } };
  },
  // the end: the news, the morning after
  'ending': (K) => {
    K.ground(0, 0, 20, 20, K.mat('asphalt', 0x5a5650)); K.box(0, 3, -8, 20, 6, 0.4, K.mat('stucco', 0xc8c0a8)); K.light(0, 5, -3, 0xffe8c8, 5, 16); K.spot(0, 2, 3, 0, 1.4, -0.5, 0xffffff, 20);
    const jo = K.person(JOURNO, 0, -0.5, 0);
    return { len: 20, shots: [[0, 20, [0, 1.55, 2.6], [0, 1.55, 2.2], [0, 1.5, -0.5], 38, 'news:THE STARKWEATHER TAPES|WAPONA HILLS — LIVE']], lines: [[0.6, 'jo_st_end']],
      tick(t, dt) { act(jo, dt, t, { pose: POSE.hands }); jo.face?.(dt, 0.4 + Math.sin(t * 10) * 0.4); } };
  },
};

export const hasStory = (id) => !!STORIES[id];

export class Story {
  constructor(renderer, camera, sound) {
    this.renderer = renderer; this.camera = camera; this.sound = sound;
    this.rt = new THREE.WebGLRenderTarget(RW, RH, { colorSpace: THREE.SRGBColorSpace, samples: 2 });
    this.cam = new THREE.PerspectiveCamera(42, RW / RH, 0.05, 200);
    this.hud = document.createElement('canvas'); this.hud.width = W; this.hud.height = H; this.g = this.hud.getContext('2d');
    this.hudTex = new THREE.CanvasTexture(this.hud); this.hudTex.colorSpace = THREE.SRGBColorSpace;
    this.flat = new THREE.Scene(); this.flatCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
    this.flatImg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: this.rt.texture, toneMapped: false, depthTest: false }));
    this.flatHud = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: this.hudTex, transparent: true, toneMapped: false, depthTest: false }));
    this.flatHud.renderOrder = 1; this.flat.add(this.flatImg, this.flatHud);
    // in VR the 2D layer hangs just in front of your eyes
    this.vrHud = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), new THREE.MeshBasicMaterial({ map: this.hudTex, transparent: true, toneMapped: false, depthTest: false })); this.vrHud.renderOrder = 9; this.vrHud.position.set(0, 0, -1.2);
    this.active = false;
  }
  start(id, onDone) {
    const make = STORIES[id]; if (!make) { onDone?.(); return false; }
    this.stage = new THREE.Scene(); this.stage.background = new THREE.Color(0x000000);
    this.stage.add(new THREE.HemisphereLight(0x8a8c90, 0x2a2622, 2.6));
    const root = new THREE.Group(); root.position.copy(O); this.stage.add(root);
    this.film = make(makeKit(root)); this.t = 0; this.said = new Set(); this.done = onDone; this.active = true;
    document.getElementById('skip').hidden = false;
    if (this.renderer.xr.isPresenting) this.camera.add(this.vrHud);
    return true;
  }
  skip() { if (this.active) { this.sound.hush(); this.finish(); } }
  finish() {
    this.active = false; document.getElementById('skip').hidden = true; this.camera.remove(this.vrHud);
    this.stage = null; this.film = null; const d = this.done; this.done = null; d && d();
  }
  shot() { const S = this.film.shots; return S.find(([a, b]) => this.t >= a && this.t < b) || S[S.length - 1]; }
  update(dt) {
    if (!this.active) return;
    this.t += dt; const t = this.t, F = this.film;
    for (const [at, id] of F.lines) if (t >= at && !this.said.has(id)) { this.said.add(id); this.sound.say(id); }
    F.tick(t, dt);
    const [a, b, from, to, look, fov] = this.shot(), k = clamp01((t - a) / (b - a)), c = this.cam;
    c.position.set(O.x + lerp(from[0], to[0], k), O.y + lerp(from[1], to[1], k), O.z + lerp(from[2], to[2], k)); c.lookAt(O.x + look[0], O.y + look[1], O.z + look[2]); c.fov = fov; c.updateProjectionMatrix();
    this.drawHud();
    if (t >= F.len && (this.sound.idle() || t > F.len + 15)) this.finish();
  }
  render() {
    if (!this.active) return;
    const R = this.renderer, xr = R.xr.enabled;
    if (R.xr.isPresenting) { // VR: stand where the camera stands
      const dolly = this.camera.parent, c = this.cam, f = new V(0, 0, -1).applyQuaternion(c.quaternion);
      dolly.position.set(c.position.x, c.position.y - 1.6, c.position.z); dolly.rotation.set(0, Math.atan2(-f.x, -f.z), 0); dolly.updateMatrixWorld(true);
      R.render(this.stage, this.camera); return;
    }
    R.xr.enabled = false; R.setRenderTarget(this.rt); R.render(this.stage, this.cam); R.setRenderTarget(null); R.xr.enabled = xr;
    const a = innerWidth / innerHeight, k = 16 / 9;
    this.flatImg.scale.set(a > k ? k / a : 1, a > k ? 1 : a / k, 1); this.flatHud.scale.copy(this.flatImg.scale);
    R.setClearColor(0x000000); R.clear(); R.render(this.flat, this.flatCam);
  }
  drawHud() {
    const g = this.g, t = this.t, [a, b, , , , , hud] = this.shot(), lt = t - a; g.clearRect(0, 0, W, H);
    const kind = (hud || '').split(':')[0], arg = (hud || '').slice(kind.length + 1);
    if (kind === 'cctv') { g.strokeStyle = 'rgba(220,230,220,0.7)'; g.lineWidth = 2; g.strokeRect(24, 24, W - 48, H - 48); g.fillStyle = '#e8f0e8'; g.font = 'bold 20px "Courier New", monospace'; g.fillText(arg, 40, 56); g.fillText(`02:${String(14 + Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t) % 60).padStart(2, '0')} AM`, W - 230, 56); g.fillStyle = 'rgba(120,200,190,0.10)'; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, (t * 90) % H, W, 30); }
    else if (kind === 'cam') { // the Journalist's camcorder
      g.strokeStyle = '#e8e8e8'; g.lineWidth = 3; for (const [x, y, sx, sy] of [[40, 40, 1, 1], [W - 40, 40, -1, 1], [40, H - 40, 1, -1], [W - 40, H - 40, -1, -1]]) { g.beginPath(); g.moveTo(x, y + 40 * sy); g.lineTo(x, y); g.lineTo(x + 40 * sx, y); g.stroke(); }
      if (Math.sin(t * 5) > -0.3) { g.fillStyle = '#ff2a1a'; g.beginPath(); g.arc(70, 76, 9, 0, PI * 2); g.fill(); } g.fillStyle = '#e8e8e8'; g.font = 'bold 22px "Courier New", monospace'; g.fillText('REC', 88, 84);
      const fr = Math.floor(t * 25) % 25, s = 39 + Math.floor(t); g.fillText(`00:00:${String(s % 60).padStart(2, '0')}:${String(fr).padStart(2, '0')}`, W - 260, 84); g.fillText('57min', W - 130, H - 60); g.fillText('35min ▮▮▮▯', 70, H - 60); }
    else if (kind === 'news') { const [l1, l2] = arg.split('|'); g.fillStyle = '#a01010'; g.fillRect(40, 400, 560, 46); g.fillStyle = '#fff'; g.font = 'bold 28px Arial, sans-serif'; g.fillText(l1, 56, 433); g.fillStyle = '#e8e2d0'; g.fillRect(40, 446, 560, 32); g.fillStyle = '#111'; g.font = 'bold 18px Arial, sans-serif'; g.fillText(l2, 56, 468); g.fillStyle = '#fff'; g.font = 'bold 14px Arial'; g.fillText('LIVE  CHANNEL 6', 800, 40); }
    else if (kind === 'peek') { g.fillStyle = '#000'; g.fillRect(0, 0, W * 0.32, H); g.fillRect(W * 0.78, 0, W * 0.22, H); }
    // tape grain, scanlines, fades at the cuts
    g.globalAlpha = 0.08; for (let i = 0; i < 900; i++) { const v = Math.random() < 0.5 ? 0 : 255; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); } g.globalAlpha = 1;
    g.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
    const fade = Math.min(1, lt / 0.5, (b - t) / 0.5); g.fillStyle = `rgba(0,0,0,${1 - Math.max(0, fade)})`; g.fillRect(0, 0, W, H);
    this.hudTex.needsUpdate = true;
  }
}
