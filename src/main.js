// MANHUNT — main: renderer, Quest + desktop input, Cash (head, hands, light,
// noise, health), the HUD/wrist meters, the scene flow and the frame loop.
import * as THREE from '../vendor/three.module.js';
import { paintAll, T } from './paint.js?v=7';
import { District, SCENES } from './district.js?v=7';
import { spawnHunters } from './hunters.js?v=7';
import { Kit, LEVELS, SLOTS, SLOT } from './kit.js?v=7';
import { Blood } from './blood.js?v=7';
import { Director } from './director.js?v=7';
import { Sound } from './sound.js?v=7';
import { makeHand, Person, BONE } from './body.js?v=7';
import { VHS } from './vhs.js?v=7';
import { Cutscene } from './cutscene.js?v=7';

const V = THREE.Vector3;
const $ = (id) => document.getElementById(id);
const QUEST = /OculusBrowser|Quest/i.test(navigator.userAgent);
const S = { exposure: 1, mic: false, vhs: true, third: false };
try { Object.assign(S, JSON.parse(localStorage.getItem('manhuntvr') || '{}')); } catch (e) {}
const save = () => { try { localStorage.setItem('manhuntvr', JSON.stringify(S)); } catch (e) {} };

// ---------------------------------------------------------------- renderer
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !QUEST, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, QUEST ? 1 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.5 * S.exposure;
renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local-floor');
if (QUEST) renderer.xr.setFramebufferScaleFactor(0.9);
if (renderer.xr.setFoveation) renderer.xr.setFoveation(1);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x040404);
scene.fog = new THREE.FogExp2(0x070706, 0.042);
const camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.03, 300);
const dolly = new THREE.Group(); dolly.add(camera); scene.add(dolly);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
const vhs = new VHS(renderer, camera); vhs.amount = S.vhs ? 1 : 0;
const hemi = new THREE.HemisphereLight(0x2a2824, 0x0b0907, 0.35); scene.add(hemi);
const moon = new THREE.DirectionalLight(0x9a9488, 0.2); moon.position.set(-30, 50, 20); scene.add(moon);

// --------------------------------------------------------------- the game
paintAll(QUEST);
let world = new District(scene, 0);
const cut = new Cutscene(renderer, camera, null, world);
const sound = new Sound();
const G = {
  scene, world, sound, vhs: null, slot: 1, time: 0, hunters: [], hands: [],
  player: null, kit: null, blood: null, director: null, state: 'menu',
  rings: [],
  noise(p, r, kind = 'player', from = null) {
    if (kind !== 'shout') { G.rings.push({ p: p.clone(), r, t: 0 }); if (G.rings.length > 12) G.rings.shift(); }
    for (const h of G.hunters) if (h !== from) h.hear({ p: p.clone(), r, kind });
    if (kind === 'player' && r > 9) G.director?.event('noise');
  },
  onKill(h, cause) { G.director.onKill(h, cause); hud.flash('kill'); },
  openPen,
};
G.vhs = vhs; G.cut = cut; G.camera = camera;
const flashLight = new THREE.PointLight(0xffd090, 0, 9, 1.6); scene.add(flashLight); let flashT = 0;
G.flash = (p) => { flashLight.position.copy(p); flashLight.intensity = 30; flashT = 0.06; }; G.goScene = (i) => goScene(i); window.manhunt = G; // for debugging from the console

// the start door belongs to the scene; the Director opens it
function closePen() { world.closeStart(); }
function openPen() { if (world.openStart()) sound.clank(world.startDoor.position.clone().add(new V(0, 1, 2))); }

// ---------------------------------------------------------------- Cash
const P = G.player = {
  pos: world.start.clone(), yaw: world.startYaw, head: new V(), chest: new V(), hp: 100, alive: true,
  crouch: false, crouchKey: false, light: 0, moveVis: 0, moving: false, speed: 0, stride: 0, hurtT: -99, noiseLvl: 0, standH: 1.7,
  hurt(n, by) {
    if (!this.alive) return;
    this.hp -= n; this.hurtT = G.time; sound.hurt(); hud.flash('hurt'); vhs.hot = Math.max(vhs.hot, 0.8);
    for (const h of G.hands) h.haptic?.(1, 200);
    if (Math.random() < 0.5) sound.say('cash_hurt');
    if (this.hp < 40) G.director.event('hurt');
    if (this.hp <= 0) die();
  },
};
dolly.position.copy(P.pos); dolly.rotation.y = P.yaw;

// Cash's own body, seen in third person on desktop
const cashBody = new Person({ mask: null, weapon: null, top: [0.09, 0.09, 0.1], legs: [0.14, 0.15, 0.17], skin: [0.55, 0.38, 0.28], bulk: 1.08, stubble: true });
cashBody.root.visible = false; scene.add(cashBody.root);
let eyeY = 1.68;

// ------------------------------------------------------------- hands
function newHand(side, desktop) {
  const obj = new THREE.Group();
  const model = makeHand(side === 'L');
  model.group.position.set(side === 'L' ? -0.032 : 0.032, 0.025, 0);
  obj.add(model.group);
  return { side, obj, model, desktop, pos: new V(), prev: new V(), vel: new V(), grip: false, gripPrev: false, trigger: 0, item: null, use: false, useHeld: false, haptic: null, src: null };
}
// desktop hands ride the camera
const dHands = [newHand('R', true), newHand('L', true)];
dHands[0].obj.position.set(0.2, -0.27, -0.42); dHands[0].obj.rotation.set(1.2, 0, -0.15);
dHands[1].obj.position.set(-0.24, -0.31, -0.38); dHands[1].obj.rotation.set(1.25, 0, 0.2);
dHands.forEach((h) => { h.base = { p: h.obj.position.clone(), r: h.obj.rotation.clone() }; });
// VR hands ride the controller grips
const vHands = [0, 1].map((i) => {
  const grip = renderer.xr.getControllerGrip(i); dolly.add(grip);
  const h = newHand(i === 0 ? 'L' : 'R', false); h.obj = grip; grip.add(h.model.group);
  grip.addEventListener('connected', (e) => {
    h.src = e.data; h.side = e.data.handedness === 'left' ? 'L' : 'R';
    // rebuild the model for the correct side
    grip.remove(h.model.group); h.model = makeHand(h.side === 'L'); h.model.group.position.set(h.side === 'L' ? -0.032 : 0.032, 0.025, 0); grip.add(h.model.group);
    h.haptic = (a, ms) => { const act = e.data.gamepad?.hapticActuators?.[0]; act?.pulse?.(a, ms); };
  });
  grip.addEventListener('disconnected', () => { h.src = null; });
  return h;
});
function useDesktopHands() { G.hands = dHands; dHands.forEach((h) => camera.add(h.obj)); vHands.forEach((h) => { h.obj.visible = false; }); }
function useVRHands() { G.hands = vHands; dHands.forEach((h) => { if (h.item) G.kit.drop(h, new V()); camera.remove(h.obj); }); vHands.forEach((h) => { h.obj.visible = true; }); }
useDesktopHands();

// ------------------------------------------------------------- HUD
const hud = (() => {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const wrist = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.055), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: true }));
  // VR subtitles hang low in front of the face
  const sc = document.createElement('canvas'); sc.width = 1024; sc.height = 160; const sg = sc.getContext('2d');
  const stex = new THREE.CanvasTexture(sc); stex.colorSpace = THREE.SRGBColorSpace;
  const subs = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.172), new THREE.MeshBasicMaterial({ map: stex, transparent: true, depthTest: false }));
  subs.position.set(0, -0.42, -1.3); subs.renderOrder = 999; subs.visible = false; camera.add(subs);
  const fx = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false }));
  fx.renderOrder = 1000; camera.add(fx);
  let fade = 0, red = 0, t = 0;
  const lines = [];
  return {
    wrist, fx,
    attachWrist(hand) { wrist.parent?.remove(wrist); hand.obj.add(wrist); wrist.position.set(hand.side === 'L' ? 0.04 : -0.04, 0.11, 0.0); wrist.rotation.set(0, hand.side === 'L' ? Math.PI / 2 : -Math.PI / 2, 0); wrist.rotateX(-0.6); },
    flash(k) { if (k === 'hurt') red = 0.55; if (k === 'kill') red = 0.2; if (k === 'heal') red = 0.08; },
    fadeTo(v) { fade = v; },
    sub(L, on) {
      const el = $('caption');
      if (on) { lines.push(L); } else { const i = lines.indexOf(L); if (i >= 0) lines.splice(i, 1); }
      const cur = lines[lines.length - 1];
      el.hidden = !cur; if (cur) el.innerHTML = `<b>${who(cur)}:</b> ${cur.text}`;
      sg.clearRect(0, 0, 1024, 160); subs.visible = !!cur && renderer.xr.isPresenting;
      if (cur) {
        sg.fillStyle = 'rgba(0,0,0,0.6)'; sg.fillRect(0, 0, 1024, 160);
        sg.font = 'bold 30px "Courier New", monospace'; sg.fillStyle = cur.who === 'DIRECTOR' ? '#e8d5a0' : cur.who === 'CASH' ? '#cfd6dc' : '#ff8c7a';
        wrap(sg, `${who(cur)}: ${cur.text}`, 24, 50, 976, 38);
      }
      stex.needsUpdate = true;
    },
    update(dt) {
      t += dt;
      const target = Math.max(fade, red); red = Math.max(0, red - dt * 0.9);
      fx.material.color.set(red > fade ? 0x6a0000 : 0x000000);
      fx.material.opacity += (target - fx.material.opacity) * Math.min(1, dt * 6);
      if (t < (G.execMeter && G.execMeter.lvl >= 0 ? 0.05 : 0.2)) return; t = 0;
      // wrist / desktop meters
      const light = Math.min(1, P.light), noise = Math.min(1, P.noiseLvl / 10);
      g.clearRect(0, 0, 512, 256);
      g.fillStyle = 'rgba(8,8,10,0.82)'; roundRect(g, 4, 4, 504, 248, 22); g.fill();
      g.font = 'bold 34px "Courier New", monospace';
      meter(g, 18, 22, P.hidden ? 'HIDDEN' : 'SEEN', light, light > 0.35 ? '#ffdd66' : light > 0.15 ? '#a08a40' : '#3c4450', 170);
      meter(g, 18, 82, 'NOISE', noise, noise > 0.6 ? '#ff5544' : '#7a8a96', 170);
      meter(g, 18, 142, 'HEALTH', Math.max(0, P.hp / 100), P.hp > 40 ? '#b23a2a' : '#ff2a1a', 170);
      g.fillStyle = '#e8d5a0'; g.font = 'bold 26px "Courier New", monospace';
      g.fillText(G.director?.gate ? 'GATE OPEN' : `KILLS ${G.director?.kills || 0}/${G.director?.quota || 0}`, 22, 240);
      { const it = G.hands[0]?.item || G.hands[1]?.item; g.fillStyle = '#9aa2aa'; g.font = 'bold 22px "Courier New", monospace'; g.fillText((it ? WNAMES[it.kind] : 'BARE HANDS') + `  (${G.kit.carried().length}/4)`, 22, 206); }
      radar(g, 418, 128, 88); radar(rg, 80, 80, 74);
      tex.needsUpdate = true;
      const em = G.execMeter, ex = $('exec');
      ex.hidden = !em || em.lvl < 0;
      if (em && em.lvl >= 0) { ex.querySelector('b').style.width = em.t * 100 + '%'; ex.querySelector('b').style.background = LEVELS[em.lvl].css; ex.lastElementChild.textContent = LEVELS[em.lvl].name; ex.lastElementChild.style.color = LEVELS[em.lvl].css; }
      if (em && em.lvl >= 0) { g.fillStyle = 'rgba(8,8,10,0.92)'; g.fillRect(14, 14, 484, 70); g.fillStyle = LEVELS[em.lvl].css; g.fillRect(20, 20, 472 * em.t, 58); g.fillStyle = '#000'; g.font = 'bold 40px "Courier New", monospace'; g.fillText(LEVELS[em.lvl].name, 34, 64); tex.needsUpdate = true; }
      $('mLight').style.width = light * 100 + '%'; $('mLight').style.background = light > 0.35 ? '#ffdd66' : light > 0.15 ? '#a08a40' : '#3c4450';
      $('mNoise').style.width = noise * 100 + '%';
      $('mHp').style.width = Math.max(0, P.hp) + '%'; updateWeapon();
      $('show').textContent = G.director?.gate ? 'THE GATE IS OPEN — EAST WALL' : `HUNTERS DOWN ${G.director?.kills || 0} / ${G.director?.quota || 0}`;
    },
  };
})();
sound.subs = (L, on) => hud.sub(L, on); G.hud = hud; cut.sound = sound;
// ------------------------------------------------------------- weapon icon
const WNAMES = { bag: 'PLASTIC BAG', shard: 'GLASS SHARD', crowbar: 'CROWBAR', bottle: 'BOTTLE', brick: 'BRICK', rifle: 'RIFLE' };
function drawWeapon(g, kind, x = 0, y = 0, s = 1) {
  g.save(); g.translate(x, y); g.scale(s, s); g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'crowbar') { g.strokeStyle = '#8a1c14'; g.lineWidth = 9; g.beginPath(); g.moveTo(18, 82); g.lineTo(70, 22); g.quadraticCurveTo(80, 10, 88, 22); g.stroke(); g.strokeStyle = '#333'; g.lineWidth = 5; g.beginPath(); g.moveTo(12, 88); g.lineTo(22, 78); g.stroke(); }
  else if (kind === 'shard') { g.fillStyle = 'rgba(190,220,210,0.9)'; g.beginPath(); g.moveTo(30, 86); g.lineTo(44, 82); g.lineTo(70, 12); g.lineTo(52, 40); g.closePath(); g.fill(); g.fillStyle = '#5a4a3a'; g.fillRect(26, 78, 20, 14); }
  else if (kind === 'bag') { g.fillStyle = '#e4e2da'; g.beginPath(); g.moveTo(24, 36); g.quadraticCurveTo(14, 86, 48, 88); g.quadraticCurveTo(82, 86, 72, 36); g.closePath(); g.fill(); g.strokeStyle = '#e4e2da'; g.lineWidth = 5; g.beginPath(); g.arc(36, 32, 10, Math.PI, 0); g.arc(60, 32, 10, Math.PI, 0); g.stroke(); }
  else if (kind === 'bottle') { g.fillStyle = '#2f6a2c'; g.beginPath(); g.moveTo(42, 10); g.lineTo(54, 10); g.lineTo(54, 30); g.quadraticCurveTo(68, 38, 68, 52); g.lineTo(68, 88); g.lineTo(28, 88); g.lineTo(28, 52); g.quadraticCurveTo(28, 38, 42, 30); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(34, 50, 5, 30); }
  else if (kind === 'rifle') { g.fillStyle = '#1a1a1a'; g.fillRect(10, 42, 70, 12); g.fillRect(70, 46, 22, 5); g.fillRect(36, 54, 10, 22); g.fillRect(10, 50, 14, 16); }
  else if (kind === 'brick') { g.fillStyle = '#8a3a26'; g.beginPath(); g.moveTo(14, 46); g.lineTo(62, 34); g.lineTo(86, 44); g.lineTo(86, 64); g.lineTo(38, 78); g.lineTo(14, 66); g.closePath(); g.fill(); g.fillStyle = '#a24a30'; g.beginPath(); g.moveTo(14, 46); g.lineTo(62, 34); g.lineTo(86, 44); g.lineTo(38, 56); g.closePath(); g.fill(); }
  else { g.fillStyle = '#b08068'; g.beginPath(); g.ellipse(48, 54, 26, 22, 0, 0, 7); g.fill(); g.strokeStyle = '#7a5040'; g.lineWidth = 3; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(30 + k * 12, 36); g.lineTo(30 + k * 12, 50); g.stroke(); } }
  g.restore();
}
let shownWeapon = '?';
function updateWeapon() {
  const it = G.hands[0]?.item || G.hands[1]?.item, kind = it ? it.kind : null;
  const key = (kind === 'rifle' ? 'rifle' + it.ammo : kind) + '|' + SLOTS.map((s) => G.kit.inv[s]?.kind || '').join(','); if (key === shownWeapon) return; shownWeapon = key;
  const g = $('wIcon').getContext('2d'); g.clearRect(0, 0, 96, 96); drawWeapon(g, kind);
  $('wName').textContent = kind ? WNAMES[kind] + (kind === 'rifle' ? ` · ${it.ammo}` : '') : 'BARE HANDS';
  $('wList').innerHTML = SLOTS.map((s, i) => { const c = G.kit.inv[s]; return `<span class="${c && c === it ? 'on' : ''}">${i + 1} ${c ? WNAMES[c.kind] : '—'}</span>`; }).join('');
}
function who(L) { return L.who === 'DIRECTOR' ? 'THE DIRECTOR' : L.who === 'CASH' ? 'CASH' : L.who === 'NEWS' ? 'CHANNEL 6' : 'HOOD'; }
function meter(g, x, y, label, v, col, w = 310) {
  g.fillStyle = '#9aa2aa'; g.fillText(label, x, y + 34);
  g.fillStyle = '#1c1f24'; g.fillRect(x + 140, y + 8, w, 32);
  g.fillStyle = col; g.fillRect(x + 140, y + 8, w * v, 32);
}
// Manhunt radar: hunters within 25 m, blue = unaware, yellow = suspicious, red = hunting you; forward is up
const radarCanvas = document.getElementById('radar'), rg = radarCanvas.getContext('2d');
function radar(g, cx, cy, r) {
  if (g === rg) g.clearRect(0, 0, 160, 160);
  g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = 'rgba(10,14,12,0.85)'; g.fill(); g.clip();
  g.strokeStyle = 'rgba(120,160,130,0.25)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, r * 0.5, 0, Math.PI * 2); g.moveTo(cx - r, cy); g.lineTo(cx + r, cy); g.moveTo(cx, cy - r); g.lineTo(cx, cy + r); g.stroke();
  const f = G.lookDir || new V(0, 0, -1), yaw = Math.atan2(f.x, f.z), c = Math.cos(yaw), s = Math.sin(yaw), range = 25;
  for (const h of G.hunters) {
    if (!h.alive) continue;
    const dx = h.pos.x - P.pos.x, dz = h.pos.z - P.pos.z;
    // rotate so the way Cash faces is up
    const rx = dx * c - dz * s, rz = dx * s + dz * c;
    const x = cx - rx / range * r, y = cy - rz / range * r;
    const col = h.aware() ? '#ff2a1a' : (h.state === 'investigate' || h.state === 'search' || h.susp > 0.3) ? '#ffd23a' : '#3a8cff';
    g.fillStyle = col; g.beginPath(); g.arc(x, y, r * 0.075, 0, Math.PI * 2); g.fill();
  }
  for (const R of G.rings) { // sound you made (or threw), spreading out
    const dx = R.p.x - P.pos.x, dz = R.p.z - P.pos.z, rx = dx * c - dz * s, rz = dx * s + dz * c;
    const k = Math.min(1, R.t / 0.7), x = cx - rx / range * r, y = cy - rz / range * r;
    g.strokeStyle = `rgba(230,230,220,${(1 - k) * 0.8})`; g.lineWidth = 3; g.beginPath(); g.arc(x, y, Math.max(1, R.r / range * r * k), 0, Math.PI * 2); g.stroke();
  }
  g.fillStyle = '#e8e8e0'; g.beginPath(); g.moveTo(cx, cy - r * 0.09); g.lineTo(cx - r * 0.06, cy + r * 0.06); g.lineTo(cx + r * 0.06, cy + r * 0.06); g.fill();
  g.restore(); g.strokeStyle = 'rgba(200,220,200,0.5)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function wrap(g, s, x, y, w, lh) { const words = s.split(' '); let line = ''; for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (g.measureText(t).width > w) { g.fillText(line, x, y); y += lh; line = wd; } else line = t; } g.fillText(line, x, y); }

// -------------------------------------------------------------- scene flow
// Kill the Rabbit: a man in a dirty rabbit suit who leads you out once the yard is clear
let rabbit = null;
function makeRabbit() {
  const r = new Person({ mask: null, weapon: null, top: [0.82, 0.8, 0.76], legs: [0.8, 0.78, 0.74], skin: [0.6, 0.44, 0.34], hood: false });
  const fur = new THREE.MeshStandardMaterial({ color: 0xd8d4cc, roughness: 1 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), fur); head.position.set(0, 0.11, 0.01); r.bones[BONE.head].add(head);
  for (const s of [1, -1]) { const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.24, 4, 8), fur); ear.position.set(0.06 * s, 0.38, -0.01); ear.rotation.z = -0.15 * s; r.bones[BONE.head].add(ear); }
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x080808 }); for (const s of [1, -1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), eyeM); e.position.set(0.05 * s, 0.14, 0.14); r.bones[BONE.head].add(e); }
  r.root.position.set(world.B.x1 - 6, 0, world.B.z0 + 6); scene.add(r.root); r.leaving = false; return r;
}
function rabbitTick(dt) {
  if (!rabbit) return;
  const g = world.gate.position, target = rabbit.leaving ? new V(g.x + 3, 0, g.z) : rabbit.root.position.clone().setY(0);
  const d = target.clone().sub(rabbit.root.position); d.y = 0;
  rabbit.anim.speed = rabbit.leaving && d.length() > 0.3 ? 1.6 : 0;
  if (rabbit.anim.speed) { d.normalize(); rabbit.root.position.addScaledVector(d, 1.6 * dt); rabbit.root.rotation.y = Math.atan2(d.x, d.z); }
  else rabbit.root.lookAt(P.pos.x, 0, P.pos.z);
  rabbit.animate(dt, G.time);
  if (world.gateOpen && !rabbit.leaving) rabbit.leaving = true;
}
function populate() {
  G.blood = G.blood || new Blood(scene, world);
  G.kit = new Kit(G);
  G.hunters = spawnHunters(G);
  G.director = new Director(G);
  if (rabbit) { scene.remove(rabbit.root); rabbit = null; }
  if (world.def.rabbit) rabbit = makeRabbit();
}
function teardown() {
  for (const h of G.hunters) { scene.remove(h.body.root); h.saw?.(null, 0, true); }
  G.kit?.clear(); for (const h of [...dHands, ...vHands]) h.item = null;
  G.blood?.clear();
  for (const c of G.director?.cams || []) scene.remove(c.g);
  sound.hush();
}
function resetScene(fromSave = false) {
  teardown();
  world.closeGate();
  closePen();
  P.pos.copy(world.start); P.yaw = world.startYaw; P.hp = 100; P.alive = true; P.hurtT = -99;
  dolly.position.set(P.pos.x, 0, P.pos.z); dolly.rotation.y = P.yaw; eyeY = 1.68;
  populate(); hud.fadeTo(0); $('hud').hidden = false;
  G.state = 'play'; G.time = 0; if (!fromSave) G.director.intro();
}
function playIntro() {
  G.state = 'cut'; hud.fadeTo(0); $('hud').hidden = true;
  cut.start(() => { if (G.state === 'cut') loadingThen(resetScene); }, renderer.xr.isPresenting);
}
// a five-second loading card between the tape and the level, with a tip
const TIPS = [
  'Stand perfectly still in the dark and you are invisible. Even a hunter standing next to you won\'t see you.',
  'Hold to charge an execution: grey is hasty, green is violent, red is gruesome. The Director pays for red.',
  'Running is loud. Watch the rings on your radar: that is how far your noise carries.',
  'Tap on a wall or throw a bottle to lure a hunter away from his friends and into your shadow.',
  'Blue dots on the radar have no idea you are there. Yellow is suspicious. Red is coming for you.',
  'Fighting in the open is a good way to die. If two of them see you, run for the dark.',
  'CCTV cameras report you to the hunters. A crowbar or a brick will shut them up.',
  'Painkillers patch you up. Look for the orange bottles.',
  'A glass bottle breaks into a shard. Keep it.',
  'The gate only opens when every last hunter is dead.',
];
let loadT = 0, loadNext = null;
const loadCanvas = document.createElement('canvas'); loadCanvas.width = 1024; loadCanvas.height = 512;
const loadTex = new THREE.CanvasTexture(loadCanvas); loadTex.colorSpace = THREE.SRGBColorSpace;
const loadRoom = new THREE.Scene(); loadRoom.background = new THREE.Color(0x030303);
const loadPanel = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshBasicMaterial({ map: loadTex, toneMapped: false })); loadRoom.add(loadPanel);
function loadingThen(next, idx = world.idx) {
  G.state = 'loading'; loadT = 0; loadNext = next;
  const sc = SCENES[idx]; document.querySelector('.lsScene').textContent = `SCENE ${idx + 1}`; document.querySelector('.lsTitle').textContent = sc.title;
  const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
  $('lsTip').textContent = tip; $('loadScreen').hidden = false; $('hud').hidden = true;
  // VR: the same card on a panel in a dark room, 2.5 m ahead
  const g = loadCanvas.getContext('2d'); g.fillStyle = '#050505'; g.fillRect(0, 0, 1024, 512);
  g.fillStyle = '#b2120c'; g.font = '500 26px Oswald, sans-serif'; g.fillText(`S C E N E   ${idx + 1}`, 60, 90);
  g.fillStyle = '#e6e0d2'; g.font = 'bold 96px Oswald, Impact, sans-serif'; g.fillText(sc.title, 56, 190);
  g.fillStyle = '#b2120c'; g.fillRect(60, 240, 5, 130); g.font = '500 20px Oswald, sans-serif'; g.fillText('T I P', 82, 262);
  g.fillStyle = '#e6e0d2'; g.font = '28px "Courier New", monospace'; wrap(g, tip, 82, 302, 860, 36);
  loadTex.needsUpdate = true;
  const cp = camera.getWorldPosition(new V()), f = camera.getWorldDirection(new V()); f.y = 0; f.normalize();
  loadPanel.position.copy(cp).addScaledVector(f, 2.5); loadPanel.position.y = cp.y; loadPanel.lookAt(cp.x, cp.y, cp.z);
}
function loadingTick(dt) {
  loadT += dt; $('lsFill').style.width = Math.min(100, loadT / 5 * 100) + '%';
  if (loadT >= 5) { $('loadScreen').hidden = true; const n = loadNext; loadNext = null; n && n(); }
}
function die() {
  P.alive = false; G.state = 'dead'; hud.fadeTo(0.85); sound.score?.set('silent');
  G.director.any('dir_death', 0);
  $('banner').textContent = 'CUT.'; $('banner').hidden = false;
  setTimeout(() => { $('banner').hidden = true; if (!loadGame()) resetScene(); }, 7000);
}
function win() {
  G.state = 'won'; hud.fadeTo(1);
  const stars = G.director.rating();
  sound.say(stars >= 4 ? 'dir_rate_high' : stars >= 2 ? 'dir_rate_mid' : 'dir_rate_low'); sound.say('dir_win');
  $('banner').innerHTML = `SCENE COMPLETE<br><span class="stars">${'★'.repeat(stars)}<i>${'★'.repeat(5 - stars)}</i></span>`; $('banner').hidden = false;
  const next = world.idx + 1;
  if (next < SCENES.length) {
    // Manhunt saves at the end of every scene: the profile now starts at the next one
    try { localStorage.setItem(slotKey(G.slot), JSON.stringify({ v: 2, scene: next, fresh: true, time: 0, savedAt: Date.now(), stars, quota: 0, dir: { kills: 0 } })); } catch (e) {}
    setTimeout(() => { $('banner').hidden = true; loadingThen(() => { goScene(next); resetScene(); }, next); }, 9000);
  } else setTimeout(() => { $('banner').innerHTML = 'THE END'; setTimeout(() => { $('banner').hidden = true; if (renderer.xr.isPresenting) renderer.xr.getSession().end(); $('screen').hidden = false; G.state = 'menu'; document.exitPointerLock?.(); }, 6000); }, 9000);
}
// swap the whole world for another scene
function goScene(idx) {
  teardown(); world.dispose();
  world = new District(scene, idx); G.world = world; cut.world = world;
  scene.fog.density = SCENES[idx].fog || 0.042; hemi.intensity = SCENES[idx].amb || 0.35;
  populate();
  P.pos.copy(world.start); dolly.position.set(P.pos.x, 0, P.pos.z);
}

// ---------------------------------------------------------------- input
const keys = {}; let pitch = 0, freecam = false; const fc = { p: new V(), yaw: 0, pitch: 0 };
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Backquote' && G.state === 'paused') { pauseToggle(); return; }
  if (G.state === 'paused') { if (e.code === 'ArrowDown') pauseSelect(pauseSel + 1); if (e.code === 'ArrowUp') pauseSelect(pauseSel - 1); if (e.code === 'Enter') pauseDo(pauseItems[pauseSel].dataset.a); return; }
  if (G.state !== 'play') return;
  const R = dHands[0];
  if (e.code === 'KeyE') { if (R.item?.kind === 'bag') { R.use = true; R.useHeld = true; } else G.kit.pickInView(R, camera.getWorldPosition(new V()), camera.getWorldDirection(new V())); }
  // inventory: 1 melee, 2 single-use, 3 lure, 4 gun, X bare hands
  const slotKey = { Digit1: 'melee', Digit2: 'single', Digit3: 'lure', Digit4: 'gun' }[e.code];
  if (slotKey) G.kit.equip(R, slotKey);
  if (e.code === 'KeyX') G.kit.equip(R, null);
  if (e.code === 'KeyG') { const h = R.item ? R : dHands[1]; if (h.item) G.kit.drop(h, new V()); }
  if (e.code === 'KeyQ') G.kit.throwFrom(R.item && R.item.kind !== 'bag' ? R : dHands[1], camera.getWorldDirection(new V()));
  if (e.code === 'KeyF') { // swap hands
    const a = dHands[0].item, b = dHands[1].item; if (a) G.kit.drop(dHands[0], new V()); if (b) G.kit.drop(dHands[1], new V()); if (b) G.kit.grab(dHands[0], b); if (a) G.kit.grab(dHands[1], a);
  }
  if (e.code === 'KeyC') P.crouchKey = !P.crouchKey;
  if (e.code === 'Backquote') { pauseToggle(); return; }
  if (e.code === 'KeyV') { S.third = !S.third; save(); thirdPerson(S.third); }
  if (e.code === 'KeyT') { const eye = P.head.clone(), d = camera.getWorldDirection(new V()); for (let k = 0.3; k <= 1.2; k += 0.15) { const q = eye.clone().addScaledVector(d, k); if (!world.clear(eye, q, false)) { knock(q); break; } } }
  if (e.code === 'KeyN') { freecam = !freecam; fc.p.copy(camera.getWorldPosition(new V())); fc.yaw = P.yaw; fc.pitch = pitch; }
  if (e.code === 'Escape' && !document.pointerLockElement) { /* menu stays reachable via the pause button */ }
});
addEventListener('keydown', () => { if (G.state === 'cut') cut.skip(); });
addEventListener('mousedown', () => { if (G.state === 'cut') cut.skip(); });
function vrSkip() { for (const h of vHands) { const gp = h.src?.gamepad; if (gp && gp.buttons.some((b, i) => i !== 1 && b.pressed && !(h.skipLatch?.[i]))) { cut.skip(); } h.skipLatch = gp ? gp.buttons.map((b) => b.pressed) : null; } }
addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'KeyE') dHands[0].useHeld = false; });
let drag = null;
canvas.addEventListener('mousedown', (e) => {
  if (G.state !== 'play') return;
  if (!document.pointerLockElement) { lockPointer(); drag = { x: e.clientX, y: e.clientY }; }
  if (e.button === 0) { const R = dHands[0]; R.use = true; R.useHeld = true; if (!G.kit.candidate(R)) swing(R); }
  if (e.button === 2) G.kit.throwFrom(dHands[0].item && dHands[0].item.kind !== 'bag' ? dHands[0] : dHands[1], camera.getWorldDirection(new V()));
});
addEventListener('mouseup', (e) => { if (e.button === 0) dHands[0].useHeld = false; drag = null; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => { if (G.state === 'play' && !renderer.xr.isPresenting) G.kit.cycle(dHands[0], e.deltaY > 0 ? 1 : -1); }, { passive: true });
addEventListener('mousemove', (e) => {
  let dx = 0, dy = 0;
  if (document.pointerLockElement === canvas) { dx = e.movementX; dy = e.movementY; }
  else if (drag) { dx = e.clientX - drag.x; dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY }; }
  else return;
  if (freecam) { fc.yaw -= dx * 0.0024; fc.pitch = Math.max(-1.5, Math.min(1.5, fc.pitch - dy * 0.0024)); return; }
  P.yaw -= dx * 0.0024; pitch = Math.max(-1.45, Math.min(1.45, pitch - dy * 0.0024));
});
// desktop swing: animate the hand so the weapon really moves through space
const swings = [];
function swing(hand) {
  const k = hand.item?.kind;
  if (k === 'bag') return;
  swings.push({ hand, t: 0, kind: k === 'crowbar' || k === 'brick' || k === 'bottle' ? 'arc' : 'thrust' });
}
function updateSwings(dt) {
  G.swingHot = swings.some((s) => s.t > 0.06 && s.t < 0.34);
  for (const h of dHands) { h.obj.position.copy(h.base.p); h.obj.rotation.copy(h.base.r); }
  if (S.third) { for (let i = swings.length - 1; i >= 0; i--) { swings[i].t += dt; if (swings[i].t > 0.62) swings.splice(i, 1); } return; }
  for (let i = swings.length - 1; i >= 0; i--) {
    const s = swings[i]; s.t += dt; const o = s.hand.obj;
    if (s.kind === 'thrust') {
      const d = s.t < 0.09 ? s.t / 0.09 : Math.max(0, 1 - (s.t - 0.09) / 0.2);
      o.position.z -= d * 0.42; o.position.y += d * 0.12; o.position.x -= d * 0.08; o.rotation.x -= d * 0.5;
      if (s.t > 0.3) swings.splice(i, 1);
    } else {
      const wind = Math.min(1, s.t / 0.12), hit = s.t < 0.12 ? 0 : Math.min(1, (s.t - 0.12) / 0.14), back = s.t < 0.36 ? 0 : Math.min(1, (s.t - 0.36) / 0.25);
      const a = wind * (1 - hit) * (1 - back), b = hit * (1 - back);
      o.position.x += a * 0.12 - b * 0.22; o.position.y += a * 0.25 - b * 0.12; o.position.z += a * 0.08 - b * 0.38;
      o.rotation.x += -a * 0.8 + b * 0.9; o.rotation.z += a * 0.6 - b * 0.7;
      if (s.t > 0.62) swings.splice(i, 1);
    }
  }
}

// VR: right stick snap turn, left stick walk, left stick click sprint, B crouch, A/X unused, Y menu
let snapReady = true, vrSprint = false, vrCrouch = false, prevBtn = {};
function vrInput(dt) {
  let mx = 0, mz = 0, run = false;
  for (const h of vHands) {
    const gp = h.src?.gamepad; if (!gp) continue;
    h.gripPrev = h.grip; h.grip = (gp.buttons[1]?.value || 0) > 0.5; h.trigger = gp.buttons[0]?.value || 0;
    const ax = gp.axes.length >= 4 ? [gp.axes[2], gp.axes[3]] : [gp.axes[0], gp.axes[1]];
    const key = h.side;
    const press = (i) => { const b = !!gp.buttons[i]?.pressed, was = prevBtn[key + i]; prevBtn[key + i] = b; return b && !was; };
    if (h.side === 'L') {
      mx = ax[0]; mz = ax[1];
      if (press(3)) vrSprint = !vrSprint;
      if (press(5)) { /* Y */ }
    } else {
      if (Math.abs(ax[0]) > 0.7 && snapReady) { P.yaw -= Math.sign(ax[0]) * Math.PI / 6; snapReady = false; }
      if (Math.abs(ax[0]) < 0.3) snapReady = true;
      if (press(5)) vrCrouch = !vrCrouch; // B
      if (press(4)) G.kit.cycle(h); // A: next weapon
    }
  }
  const mag = Math.hypot(mx, mz); if (mag < 0.15) { vrSprint = false; return [0, 0, false]; }
  run = vrSprint && mag > 0.8;
  return [mx, mz, run];
}

// ----------------------------------------------------------- microphone
let mic = null;
async function startMic() {
  try {
    const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false } });
    const src = sound.ctx.createMediaStreamSource(st), an = sound.ctx.createAnalyser(); an.fftSize = 1024; src.connect(an);
    mic = { an, buf: new Float32Array(1024), t: 0, floor: 0.01 };
  } catch (e) { S.mic = false; save(); $('micBox').checked = false; }
}
function micLevel(dt) {
  if (!mic) return 0;
  mic.an.getFloatTimeDomainData(mic.buf); let s = 0; for (const v of mic.buf) s += v * v; const rms = Math.sqrt(s / mic.buf.length);
  mic.floor = Math.min(mic.floor * 1.0005 + 1e-6, rms) * 0.98 + mic.floor * 0.02;
  return Math.max(0, rms - mic.floor * 2.5);
}

// ------------------------------------------------------------- the loop
const clock = new THREE.Clock();
const tmp = new V(), headLocal = new V(), lastHead = new V(), eyeTmp = new V();
let stepAcc = 0, micT = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const xr = renderer.xr.isPresenting;
  if (xr && (G.state === 'play' || G.state === 'paused')) vrPauseInput();
  if (G.state === 'play' || G.state === 'dead' || G.state === 'won') {
    G.time += dt;
    // -------- move Cash
    let mx = 0, mz = 0, run = false;
    if (xr) [mx, mz, run] = vrInput(dt);
    else if (!freecam) {
      mx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0); mz = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0);
      if (keys.ArrowLeft) P.yaw += dt * 2; if (keys.ArrowRight) P.yaw -= dt * 2;
      run = keys.ShiftLeft || keys.ShiftRight;
    }
    if (!P.alive || G.state !== 'play' || G.kit.exec || G.kit.struggle) { mx = mz = 0; }
    // crouch: desktop key / Ctrl, VR physical or B
    if (xr) { const hy = camera.position.y; P.standH = Math.max(P.standH * 0.9995, hy); P.crouch = vrCrouch || hy < P.standH * 0.78; }
    else P.crouch = P.crouchKey || keys.ControlLeft;
    const len = Math.hypot(mx, mz);
    const speed = P.crouch ? 1.05 : run ? 3.6 : 1.7;
    if (len > 0.01) {
      // move relative to where the head faces
      const yaw = xr ? Math.atan2(-tmp.set(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(new THREE.Quaternion())).x, -tmp.z) : P.yaw;
      const dir = new V(mx, 0, mz).applyAxisAngle(new V(0, 1, 0), yaw).multiplyScalar(speed * Math.min(1, len) / Math.max(1, len));
      dolly.position.addScaledVector(dir, dt);
    }
    dolly.rotation.y = xr ? P.yaw : 0;
    if (!xr) { dolly.rotation.y = 0; camera.rotation.set(pitch, P.yaw, 0, 'YXZ'); }
    // head in world, room-scale aware; collide the head and carry the dolly back out of walls
    if (xr) {
      camera.updateMatrixWorld(true); camera.getWorldPosition(P.head);
      const fixed = P.head.clone(); world.collide(fixed, 0.25);
      dolly.position.x += fixed.x - P.head.x; dolly.position.z += fixed.z - P.head.z;
      camera.updateMatrixWorld(true); camera.getWorldPosition(P.head);
    } else {
      const fixed = dolly.position.clone(); world.collide(fixed, 0.3); dolly.position.copy(fixed);
      const eh = P.crouch ? 1.12 : 1.68; eyeY += (eh - eyeY) * Math.min(1, dt * 8);
      P.head.set(dolly.position.x, eyeY, dolly.position.z);
      if (S.third && !freecam) {
        // over the right shoulder, pulled in if a wall is in the way
        const f = new V(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)), r = new V(Math.cos(P.yaw), 0, -Math.sin(P.yaw));
        const want = P.head.clone().addScaledVector(f, -2.3).addScaledVector(r, 0.5).add(new V(0, 0.35 - pitch * 0.6, 0));
        for (let k = 1; k >= 0.2; k -= 0.1) { const q = P.head.clone().lerp(want, k); if (world.clear(P.head, q, false)) { want.copy(q); break; } if (k <= 0.25) want.copy(P.head.clone().lerp(want, 0.2)); }
        camera.position.copy(want).sub(dolly.position);
      } else camera.position.set(0, eyeY, 0);
      camera.updateMatrixWorld(true);
    }
    P.pos.set(P.head.x, 0, P.head.z);
    P.chest.copy(P.head).y -= 0.45;
    G.lookDir = camera.getWorldDirection(G.lookDir || new V());
    let moved = lastHead.distanceTo(P.head) / Math.max(dt, 1e-3); lastHead.copy(P.head);
    if (moved > 9) { moved = 0; P.speed = 0; stepAcc = 0; } // a teleport (reset, menu -> pen), not a sprint
    P.speed = P.speed * 0.8 + Math.min(6, moved) * 0.2;
    P.moving = P.speed > 0.25;
    P.moveVis = P.speed > 2.6 ? 0.35 : P.speed > 1.2 ? 0.12 : (xr ? P.walking : P.speed > 0.3) ? 0.04 : 0;
    // light: lamps + hunters' torches on you
    P.light = world.lightAt(P.pos);
    for (const h of G.hunters) {
      if (!h.torch || !h.alive) continue;
      const tp = h.torch.getWorldPosition(tmp.clone()), tt = h.torch.target.getWorldPosition(new V());
      const to = P.chest.clone().sub(tp), d = to.length(); if (d > 16) continue;
      const cos = to.normalize().dot(tt.sub(tp).normalize());
      if (cos > Math.cos(0.42) && world.clear(tp, P.chest)) P.light += 0.9 * (1 - d / 16);
    }
    // Manhunt's shadows: dark enough and perfectly still = invisible
    // in the headset only real walking breaks cover (the stick, or crossing the room); looking around, leaning and hand movement don't
    P.walking = xr ? (len > 0.15 && P.alive) || P.speed > 0.7 : P.speed > 0.18;
    P.hidden = P.alive && P.light < 0.14 && !P.walking;
    vhs.hide += ((P.hidden ? 1 : 0) - vhs.hide) * Math.min(1, dt * 4);
    for (const R of G.rings) R.t += dt; G.rings = G.rings.filter((R) => R.t < 0.75);
    // footsteps make noise; louder when running, nearly silent crouched
    stepAcc += (xr && !P.walking ? 0 : P.speed) * dt; // leaning and looking around in VR make no footsteps
    const stride = P.speed > 2.6 ? 0.85 : 0.7;
    if (stepAcc > stride && P.alive) {
      stepAcc = 0;
      const r = P.crouch ? 1.2 : P.speed > 2.6 ? 10 : P.speed > 1.2 ? 4.5 : 2.2;
      sound.step(P.pos, P.speed > 2.6 ? 'run' : P.crouch ? 'sneak' : 'walk', 'asphalt', 'me');
      G.noise(P.pos, r, 'player'); P.noiseLvl = Math.max(P.noiseLvl, r);
    }
    // the microphone: your real voice and breath count
    if (S.mic && mic) { micT -= dt; if (micT < 0) { micT = 0.25; const lv = micLevel(); if (lv > 0.01) { const r = Math.min(18, lv * 160); G.noise(P.pos, r, 'player'); P.noiseLvl = Math.max(P.noiseLvl, r); } } }
    P.noiseLvl = Math.max(0, P.noiseLvl - dt * 6);
    // heal slowly when left alone
    if (P.alive && G.time - P.hurtT > 6) P.hp = Math.min(100, P.hp + dt * 3);

    // -------- Cash's body (third person)
    if (!xr && S.third) {
      const B = cashBody; B.root.visible = true;
      B.root.position.set(P.pos.x, 0, P.pos.z); B.root.rotation.y = P.yaw + Math.PI;
      B.anim.speed = len > 0.01 && P.alive ? speed : 0; B.anim.crouch += ((P.crouch ? 1 : 0) - B.anim.crouch) * Math.min(1, dt * 8);
      B.anim.swing = swings.length ? Math.min(1, swings[0].t / 0.4) : -1; B.anim.struggle = G.kit.struggle ? 0.6 : 0;
      B.animate(dt, G.time); B.face(dt, sound.mouth('CASH'));
    } else cashBody.root.visible = false;

    // -------- hands
    if (!xr) updateSwings(dt);
    for (const h of G.hands) {
      h.obj.updateMatrixWorld(true);
      h.obj.getWorldPosition(h.pos);
      const v = tmp.copy(h.pos).sub(h.prev).divideScalar(Math.max(dt, 1e-3));
      h.vel.lerp(v, 0.6); h.prev.copy(h.pos);
      if (xr) G.kit.handInput(h);
      if (xr && !h.item) h.knockable = true;
      h.model.curl(h.item ? 0.92 : xr ? Math.min(1, 0.26 + h.trigger * 0.45 + (h.grip ? 0.38 : 0)) : 0.62, h.item ? 0.7 : 0.4);
      h.model.group.visible = !(h.item?.kind === 'bag' && false);
    }
    G.kit.update(dt);
    if (xr) vrKnocks();
    for (const h of dHands) h.use = false;

    // -------- the world
    world.update(G.time, dt);
    for (const h of G.hunters) h.update(dt, G.time);
    G.blood.update(dt);
    G.director.update(dt); rabbitTick(dt);
    // tension score: how hunted are you?
    let hunted = 0; for (const h of G.hunters) if (h.alive) hunted = Math.max(hunted, h.aware() ? 1 : h.susp * 0.7);
    sound.tension(hunted); sound.tick(dt);
    // the score follows what's happening: hiding / suspect / pursuit / combat
    if (sound.score) {
      const near = G.hunters.some((h) => h.alive && h.state === 'attack' && h.pos.distanceTo(P.pos) < 3);
      const st = (G.kit.exec || G.kit.struggle || near || G.time - P.hurtT < 3) ? 'combat'
        : G.hunters.some((h) => h.alive && h.aware()) ? 'pursuit'
        : G.hunters.some((h) => h.alive && (h.state === 'investigate' || h.state === 'search' || h.susp > 0.3)) ? 'suspect' : 'hiding';
      sound.score.set(st);
    }
    // escape
    if (G.state === 'play' && world.atExit(P.pos)) win();
    // prompts (desktop) and control hints
    prompt(); if (G.state === 'play') tutor(dt);
  }
  // the menu: a live CCTV feed of the Hoods on patrol
  if (G.state === 'menu' && !xr) {
    G.time += dt; P.hidden = true; P.pos.set(-31, 0, 22);
    for (const h of dHands) h.obj.visible = false;
    world.update(G.time, dt); for (const h of G.hunters) h.update(dt, G.time);
    const c = world.cams[1];
    dolly.position.set(c.p.x, 0, c.p.z + 0.4); camera.position.set(0, c.p.y - 0.2, 0);
    camera.rotation.set(-0.32, c.yaw + Math.PI + Math.sin(G.time * 0.12) * 0.55, 0, 'YXZ');
    menuClock(dt);
  }
  // freecam (desktop): fly around without moving Cash
  if (freecam && !xr) {
    const f = new V(-Math.sin(fc.yaw) * Math.cos(fc.pitch), Math.sin(fc.pitch), -Math.cos(fc.yaw) * Math.cos(fc.pitch)), r = new V(Math.cos(fc.yaw), 0, -Math.sin(fc.yaw));
    const sp = (keys.ShiftLeft ? 14 : 5) * dt;
    if (keys.KeyW) fc.p.addScaledVector(f, sp); if (keys.KeyS) fc.p.addScaledVector(f, -sp); if (keys.KeyD) fc.p.addScaledVector(r, sp); if (keys.KeyA) fc.p.addScaledVector(r, -sp);
    if (keys.KeyE) fc.p.y += sp; if (keys.KeyQ) fc.p.y -= sp;
    camera.position.copy(fc.p).sub(dolly.position); camera.rotation.set(fc.pitch, fc.yaw, 0, 'YXZ');
  }
  // ears
  if (sound.ctx) { camera.getWorldPosition(eyeTmp); const q = camera.getWorldQuaternion(new THREE.Quaternion()); sound.ear(eyeTmp, new V(0, 0, -1).applyQuaternion(q), new V(0, 1, 0).applyQuaternion(q)); }
  hud.update(dt);
  if (flashT > 0) { flashT -= dt; if (flashT <= 0) flashLight.intensity = 0; }
  vhs.update(dt);
  if ((G.state === 'cut' || G.state === 'menu' || G.state === 'loading') && sound.score) sound.score.set(G.state === 'menu' ? 'silent' : G.state === 'loading' ? 'hiding' : 'theme');
  if (G.state === 'loading') { loadingTick(dt); renderer.render(renderer.xr.isPresenting ? loadRoom : scene, camera); return; }
  if (G.state === 'cut') { cut.update(dt); if (renderer.xr.isPresenting) vrSkip(); cut.render(); return; }
  vhs.render(scene, camera);
});

// tapping on a wall: a soft knock that lures whoever hears it to come and look
let knockT = 0;
function knock(p) {
  if (G.time - knockT < 0.6) return; knockT = G.time;
  sound.knock(p); G.knocked = true; G.noise(P.pos, 8, 'lure'); for (const h of G.hands) h.haptic?.(0.6, 40);
}
function vrKnocks() {
  for (const h of G.hands) {
    if (h.vel.length() < 1.1) continue;
    for (const q of world.boxes) {
      if (h.pos.y < q.y0 || h.pos.y > q.y1 || !q.see) continue;
      const dx = Math.max(q.x0 - h.pos.x, 0, h.pos.x - q.x1), dz = Math.max(q.z0 - h.pos.z, 0, h.pos.z - q.z1);
      if (dx * dx + dz * dz < 0.0025) { knock(h.pos); break; }
    }
  }
}
// third person: the right hand (and whatever it holds) moves from the camera into Cash's right fist
function thirdPerson(on) {
  const R = dHands[0], L = dHands[1];
  if (on) {
    cashBody.bones[BONE.handR].add(R.obj); R.base = { p: new V(0, -0.09, 0.02), r: new THREE.Euler(0, Math.PI, 0) };
    cashBody.bones[BONE.handL].add(L.obj); L.base = { p: new V(0, -0.09, 0.02), r: new THREE.Euler(0, Math.PI, 0) };
    R.model.group.visible = L.model.group.visible = false;
  } else {
    camera.add(R.obj); camera.add(L.obj);
    R.base = { p: new V(0.2, -0.27, -0.42), r: new THREE.Euler(1.2, 0, -0.15) }; L.base = { p: new V(-0.24, -0.31, -0.38), r: new THREE.Euler(1.25, 0, 0.2) };
    R.model.group.visible = L.model.group.visible = true;
  }
}
// ------------------------------------------------------------- pause, save, load
const pauseItems = [...document.querySelectorAll('#pauseList button')];
let pauseSel = 0;
const pCanvas = document.createElement('canvas'); pCanvas.width = 768; pCanvas.height = 512;
const pTex = new THREE.CanvasTexture(pCanvas); pTex.colorSpace = THREE.SRGBColorSpace;
const pPanel = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshBasicMaterial({ map: pTex, transparent: true, depthTest: false, toneMapped: false }));
pPanel.renderOrder = 3000; pPanel.visible = false; scene.add(pPanel);
function pauseSelect(i) { pauseSel = (i + pauseItems.length) % pauseItems.length; pauseItems.forEach((b, k) => b.classList.toggle('sel', k === pauseSel)); drawPausePanel(); }
pauseItems.forEach((b, k) => { b.addEventListener('mouseenter', () => pauseSelect(k)); b.addEventListener('click', () => pauseDo(b.dataset.a)); });
function drawPausePanel(msg = $('pauseMsg').textContent) {
  const g = pCanvas.getContext('2d'); g.clearRect(0, 0, 768, 512); g.fillStyle = 'rgba(5,5,5,0.92)'; g.fillRect(0, 0, 768, 512);
  g.fillStyle = '#b2120c'; g.font = '500 24px Oswald, sans-serif'; g.fillText('P A U S E D', 40, 60);
  g.fillStyle = '#e6e0d2'; g.font = 'bold 64px Oswald, Impact, sans-serif'; g.fillText('MANHUNT', 36, 130);
  pauseItems.forEach((b, k) => { if (k === pauseSel) { const gr = g.createLinearGradient(30, 0, 500, 0); gr.addColorStop(0, 'rgba(178,18,12,0.95)'); gr.addColorStop(1, 'rgba(178,18,12,0)'); g.fillStyle = gr; g.fillRect(30, 170 + k * 66, 470, 56); } g.fillStyle = '#fff'; g.font = '34px Oswald, sans-serif'; g.fillText(b.textContent.toUpperCase(), 50, 210 + k * 66); });
  g.fillStyle = '#e8d5a0'; g.font = '24px "Courier New", monospace'; g.fillText(msg || 'Right stick: choose   A: select   Y: resume', 40, 480);
  pTex.needsUpdate = true;
}
function pauseToggle() {
  if (G.state === 'play') {
    G.pausedOnce = true; G.state = 'paused'; $('pause').hidden = false; $('pauseMsg').textContent = ''; pauseSelect(0); document.exitPointerLock?.(); sound.hush();
    if (renderer.xr.isPresenting) { const cp = camera.getWorldPosition(new V()), f = camera.getWorldDirection(new V()); f.y = 0; f.normalize(); pPanel.position.copy(cp).addScaledVector(f, 1.4); pPanel.lookAt(cp); pPanel.visible = true; }
  } else if (G.state === 'paused') { G.state = 'play'; $('pause').hidden = true; pPanel.visible = false; }
}
function pauseDo(a) {
  if (a === 'resume') pauseToggle();
  if (a === 'save') { saveGame(); $('pauseMsg').textContent = 'Game saved.'; drawPausePanel(); }
  if (a === 'load') { if (loadGame()) { $('pause').hidden = true; pPanel.visible = false; } else { $('pauseMsg').textContent = 'No saved game yet.'; drawPausePanel(); } }
  if (a === 'quit') { $('pause').hidden = true; pPanel.visible = false; teardown(); populate(); $('hud').hidden = true; $('screen').hidden = false; G.state = 'menu'; if (renderer.xr.isPresenting) renderer.xr.getSession().end(); }
}
const dollyOf = () => dolly;
function saveGame() {
  const data = {
    v: 2, scene: world.idx, time: G.time, pen: !!world.startOpen,
    p: { x: P.pos.x, z: P.pos.z, yaw: P.yaw, hp: P.hp },
    dir: { kills: G.director.kills, points: G.director.points, spotted: G.director.spotted, gate: G.director.gate },
    hunters: G.hunters.map((h) => ({ alive: h.alive, x: h.pos.x, z: h.pos.z, yaw: h.yaw, wp: h.wp })),
    items: G.kit.items.filter((it) => !it.gone && !it.hand).map((it) => ({ kind: it.kind, x: it.pos.x, y: it.def.rest, z: it.pos.z })),
    held: G.hands.map((h) => h.item ? h.item.kind : null), inv: SLOTS.map((s) => G.kit.inv[s]?.kind || null), invAmmo: G.kit.inv.gun?.ammo ?? 0,
    cams: G.director.cams.map((c) => c.alive),
  };
  data.savedAt = Date.now(); data.stars = G.director.rating ? G.director.rating() : 0; data.quota = G.director.quota;
  try { localStorage.setItem(slotKey(G.slot), JSON.stringify(data)); } catch (e) {}
}
function loadGame() {
  const d = readSlot(G.slot);
  if (!d) return false;
  if ((d.scene || 0) !== world.idx) goScene(d.scene || 0);
  if (d.fresh) { resetScene(); return true; }
  resetScene(true);
  G.time = d.time; if (d.pen && world.openStart()) { world.startSwing = 1; world.startDoor.rotation.y = world.startBaseYaw - 1.6; }
  P.pos.set(d.p.x, 0, d.p.z); P.yaw = d.p.yaw; P.hp = d.p.hp; dolly.position.set(d.p.x, 0, d.p.z);
  Object.assign(G.director, { kills: d.dir.kills, points: d.dir.points, spotted: d.dir.spotted });
  if (d.dir.gate) { G.director.gate = true; world.openGate(); }
  d.hunters.forEach((s, i) => { const h = G.hunters[i]; if (!h) return; h.pos.set(s.x, 0, s.z); h.yaw = s.yaw; h.wp = s.wp; h.place(); if (!s.alive) { h.alive = false; h.state = 'dead'; if (h.torch) { h.torch.intensity = 0; h.beam.visible = false; } if (h.body.weapon) h.body.weapon.parent?.remove(h.body.weapon); h.body.die(new V(), null, world); G.blood.pool(h.pos.clone(), 1.2); } });
  G.kit.clear(); d.items.forEach((it) => G.kit.spawn(it.kind, new V(it.x, it.y, it.z)));
  if (d.inv) { const R = G.hands[0]; d.inv.forEach((k) => { if (k) { const it = G.kit.spawn(k, P.head.clone()); if (k === 'rifle') it.ammo = d.invAmmo; G.kit.grab(R, it); } }); const first = d.held && d.held[0]; if (first) G.kit.equip(R, SLOT[first]); }
  else d.held.forEach((k, i) => { if (k && G.hands[i]) G.kit.grab(G.hands[i], G.kit.spawn(k, P.head.clone())); });
  d.cams.forEach((alive, i) => { const c = G.director.cams[i]; if (c && !alive) { c.alive = false; c.led.visible = false; c.head.rotation.x = 1.2; c.head.rotation.z = 0.6; } });
  G.state = 'play'; return true;
}
function vrPauseInput() {
  for (const h of vHands) {
    const gp = h.src?.gamepad; if (!gp) continue;
    const key = 'p' + h.side, press = (i) => { const b = !!gp.buttons[i]?.pressed, was = prevBtn[key + i]; prevBtn[key + i] = b; return b && !was; };
    if (h.side === 'L' && press(5)) pauseToggle();                       // Y
    if (G.state !== 'paused' || h.side !== 'R') continue;
    const y = gp.axes.length >= 4 ? gp.axes[3] : gp.axes[1];
    if (Math.abs(y) > 0.7 && !h.pauseLatch) { pauseSelect(pauseSel + (y > 0 ? 1 : -1)); h.pauseLatch = true; } if (Math.abs(y) < 0.3) h.pauseLatch = false;
    if (press(4)) pauseDo(pauseItems[pauseSel].dataset.a);              // A
  }
}
// ------------------------------------------------------------- control hints, as you need them
// [id, condition, desktop text, VR text]. Each shows once, for a few seconds.
const TUTOR = [
  ['move', () => G.time > 2, 'Move with <b>W A S D</b>. Look with the <b>mouse</b>. <b>Shift</b> runs, <b>C</b> crouches.', 'Walk with the <b>left stick</b>, turn with the <b>right stick</b>. Click the left stick to sprint. Crouch for real, or press <b>B</b>.', () => G.walked > 3],
  ['radar', () => G.time > 9 && G.hunters.some((h) => h.alive && h.pos.distanceTo(P.pos) < 25), 'The <b>radar</b> shows the hunters. Blue: unaware. Yellow: suspicious. Red: hunting you.', 'The <b>radar on your left wrist</b> shows the hunters. Blue: unaware. Yellow: suspicious. Red: hunting you.', null],
  ['shadow', () => world.startOpen && P.light < 0.14 && G.time > 14, 'You are in <b>shadow</b>. Stand completely still in the dark and nobody can see you.', 'You are in <b>shadow</b>. Stand completely still in the dark and nobody can see you.', () => P.hidden && G.hiddenT > 1],
  ['pickup', () => G.kit.items.some((it) => !it.hand && !it.flying && Math.hypot(it.pos.x - P.pos.x, it.pos.z - P.pos.z) < 1.7), 'Press <b>E</b> to pick up weapons and junk.', 'Reach for it and squeeze <b>grip</b> to pick things up.', () => G.hands.some((h) => h.item)],
  ['throw', () => G.hands.some((h) => h.item && (h.item.kind === 'bottle' || h.item.kind === 'brick')), 'Press <b>Q</b> or <b>right-click</b> to throw. Noise draws the hunters to it.', 'Swing your arm and <b>let go of grip</b> to throw. Noise draws the hunters to it.', () => G.thrown],
  ['exec', () => G.hands.some((h) => h.item && G.kit.candidate(h)), 'Behind him and unseen: <b>hold click</b> to charge an execution. Grey, green, red. Let go, then <b>click</b> to strike.', 'Behind him and unseen: <b>hold trigger</b> to charge an execution. Grey, green, red. Let go, then really strike.', () => G.kit.exec || G.kit.struggle],
  ['bag', () => G.hands.some((h) => h.item && h.item.kind === 'bag'), 'The bag: get behind a hunter, charge with <b>click</b>, then <b>keep holding</b> while he struggles.', 'The bag: get behind a hunter, charge with <b>trigger</b>, then <b>hold grip and pull</b> while he struggles.', () => G.kit.struggle],
  ['switch', () => G.kit.carried().length >= 2, 'You carry one of each kind. Press <b>1–4</b> or roll the <b>mouse wheel</b> to switch, <b>X</b> for bare hands.', 'You carry one of each kind. Press <b>A</b> to switch weapons.', () => G.switched],
  ['run', () => P.speed > 2.6, 'Running is <b>loud</b>. The rings on your radar show how far the noise carries.', 'Running is <b>loud</b>. The rings on your radar show how far the noise carries.', null],
  ['knock', () => G.time > 75, 'Press <b>T</b> facing a wall to <b>tap on it</b> and lure a hunter toward you.', '<b>Knock on a wall</b> with your hand to lure a hunter toward you.', () => G.knocked],
  ['spotted', () => G.hunters.some((h) => h.alive && h.aware()), 'You have been <b>seen</b>. Fighting in the open gets you killed. Break line of sight and get into the dark.', 'You have been <b>seen</b>. Fighting in the open gets you killed. Break line of sight and get into the dark.', () => !G.hunters.some((h) => h.alive && h.aware())],
  ['pills', () => P.hp < 60, 'Find <b>painkillers</b> (orange bottles) to heal.', 'Find <b>painkillers</b> (orange bottles) to heal.', () => G.tookPills || P.hp >= 60],
  ['cams', () => G.director.cams.some((c) => c.see > 0.4), '<b>CCTV</b> reports you to the hunters. Smash cameras with a crowbar or a brick.', '<b>CCTV</b> reports you to the hunters. Smash cameras with a crowbar or a brick.', () => G.director.cams.some((c) => !c.alive)],
  ['piggsy', () => world.def.id === 'deliverance' && G.time > 6, '<b>Piggsy</b> shrugs off hits. Get him to <b>charge</b> at you across the <b>rotten boards</b>. Three falls.', '<b>Piggsy</b> shrugs off hits. Get him to <b>charge</b> at you across the <b>rotten boards</b>. Three falls.', () => world.weak && world.weak.some((w) => w.broken)],
  ['pause', () => G.time > 40, 'Press <b>`</b> to pause, save or load.', 'Press <b>Y</b> to pause, save or load.', () => G.pausedOnce],
];
const tutorDone = new Set(); let tutorT = 0, tutorCur = null;
const tipCanvas = document.createElement('canvas'); tipCanvas.width = 1024; tipCanvas.height = 160;
const tipTex = new THREE.CanvasTexture(tipCanvas); tipTex.colorSpace = THREE.SRGBColorSpace;
const tipMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.117), new THREE.MeshBasicMaterial({ map: tipTex, transparent: true, depthTest: false, toneMapped: false }));
tipMesh.position.set(0, 0.26, -1.0); tipMesh.renderOrder = 2500; tipMesh.visible = false; camera.add(tipMesh);
function tutor(dt) {
  const xr = renderer.xr.isPresenting;
  G.walked = (G.walked || 0) + (P.speed > 0.4 ? P.speed * dt : 0);
  G.hiddenT = P.hidden ? (G.hiddenT || 0) + dt : 0;
  if (tutorCur) {
    // stays up until you've done it (info-only hints time out)
    tutorT += dt;
    let ok = false; try { ok = tutorCur.done ? !!tutorCur.done() : tutorT > 9; } catch (e) {}
    if (ok || tutorT > 90) { tutorCur = null; $('tip').hidden = true; tipMesh.visible = false; tutorT = -1.2; }
    return;
  }
  if (tutorT < 0) { tutorT += dt; return; } // a short gap between hints
  for (const [id, cond, desk, vr, done] of TUTOR) {
    if (tutorDone.has(id)) continue;
    let ok = false; try { ok = cond(); } catch (e) {}
    if (!ok) continue;
    tutorDone.add(id);
    let already = false; try { already = done && !!done(); } catch (e) {}
    if (already) continue; // you've already worked it out
    tutorCur = { id, done }; tutorT = 0;
    sound.sample('sfx/hint.wav', 0.9); // Nathan's notification sound
    const html = xr ? vr : desk;
    $('tip').innerHTML = html; $('tip').hidden = xr;
    if (xr) {
      const g = tipCanvas.getContext('2d'); g.clearRect(0, 0, 1024, 160); g.fillStyle = 'rgba(6,6,6,0.88)'; g.fillRect(0, 0, 1024, 160); g.fillStyle = '#b2120c'; g.fillRect(0, 0, 8, 160);
      g.fillStyle = '#ece6d8'; g.font = '30px "Courier New", monospace'; wrap(g, html.replace(/<[^>]+>/g, ''), 28, 48, 970, 36); tipTex.needsUpdate = true; tipMesh.visible = true;
    }
    break;
  }
}
function prompt() {
  const el = $('prompt'); if (renderer.xr.isPresenting) { el.hidden = true; return; }
  const R = dHands[0]; let s = '';
  const eye = P.head, dir = camera.getWorldDirection(new V());
  if (G.kit.struggle) s = 'HOLD THE MOUSE — keep the bag tight';
  else if (G.kit.exec) s = `STRIKE — ${G.kit.exec.need - G.kit.exec.done} more`;
  else if (G.kit.charge) s = 'RELEASE TO EXECUTE';
  else if (R.item && G.kit.candidate(R)) s = 'HOLD CLICK — charge an execution';
  if (!s) for (const it of G.kit.items) { if (it.hand || it.flying) continue; if (Math.hypot(it.pos.x - P.pos.x, it.pos.z - P.pos.z) < 1.7) { s = `E — pick up ${it.kind === 'pills' ? 'painkillers' : it.kind}`; break; } }
  el.hidden = !s; el.textContent = s;
}

function lockPointer() { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }

// ------------------------------------------------------------- menu
function begin(vr) {
  if (!vr) for (const h of dHands) h.obj.visible = true;
  sound.start();
  $('screen').hidden = true; $('hud').hidden = false;
  if (S.mic && !mic) startMic();
  teardown(); populate(); P.pos.copy(world.start); dolly.position.set(P.pos.x, 0, P.pos.z);
  if (!readSlot(G.slot) && world.idx !== 0) goScene(0);
  if (readSlot(G.slot)) { $('hud').hidden = true; loadingThen(() => { if (!loadGame()) { resetScene(); } $('hud').hidden = false; }); }
  else playIntro();
}
// ------------------------------------------------------------- save profiles
const slotKey = (n) => `manhuntvr_save_${n}`;
function readSlot(n) { try { return JSON.parse(localStorage.getItem(slotKey(n)) || 'null'); } catch (e) { return null; } }
try { const old = localStorage.getItem('manhuntvr_save'); if (old && !localStorage.getItem(slotKey(1))) { localStorage.setItem(slotKey(1), old); localStorage.removeItem('manhuntvr_save'); } } catch (e) {}
let slotMode = 'desktop';
function showSlots(mode) {
  slotMode = mode; $('how').hidden = true; $('opts').hidden = true;
  const list = $('slotList'); list.innerHTML = '';
  for (let n = 1; n <= 3; n++) {
    const d = readSlot(n), row = document.createElement('div'); row.className = 'slot';
    const go = document.createElement('button'); go.className = 'go';
    if (d) {
      const mins = Math.floor(d.time / 60), secs = String(Math.floor(d.time % 60)).padStart(2, '0');
      const when = d.savedAt ? new Date(d.savedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
      go.innerHTML = `<b>PROFILE ${n}</b>Scene ${(d.scene || 0) + 1}: ${SCENES[d.scene || 0]?.title || ''} &middot; ${d.fresh ? 'start of scene' : `kills ${d.dir.kills}/${d.quota || 0}`} &middot; ${mins}:${secs}<br>${'★'.repeat(d.stars || 0)}${'☆'.repeat(5 - (d.stars || 0))} &middot; saved ${when}`;
    } else go.innerHTML = `<b>PROFILE ${n}</b>Empty &middot; start a new game`;
    go.onclick = () => startSlot(n);
    const del = document.createElement('button'); del.className = 'del'; del.textContent = 'DELETE'; del.disabled = !d;
    del.onclick = () => {
      if (!del.classList.contains('sure')) { del.classList.add('sure'); del.textContent = 'SURE?'; setTimeout(() => { del.classList.remove('sure'); del.textContent = 'DELETE'; }, 3000); return; }
      try { localStorage.removeItem(slotKey(n)); } catch (e) {} showSlots(slotMode);
    };
    row.append(go, del); list.append(row);
  }
  $('slots').hidden = false;
}
function startSlot(n) {
  G.slot = n; $('slots').hidden = true;
  if (slotMode === 'vr') startVR(); else { useDesktopHands(); thirdPerson(S.third); begin(false); lockPointer(); }
}
$('playDesktop').onclick = () => showSlots('desktop');
$('howBtn').onclick = () => { $('how').hidden = !$('how').hidden; $('opts').hidden = true; $('slots').hidden = true; };
$('optBtn').onclick = () => { $('opts').hidden = !$('opts').hidden; $('how').hidden = true; $('slots').hidden = true; };
$('vhsBox').checked = !!S.vhs;
$('thirdBox').checked = !!S.third;
$('thirdBox').onchange = (e) => { S.third = e.target.checked; save(); };
$('vhsBox').onchange = (e) => { S.vhs = e.target.checked; vhs.amount = S.vhs ? 1 : 0; save(); };
// keyboard: up/down to move the red bar, Enter to choose
const items = [...document.querySelectorAll('#menuList button')];
let selI = 0;
function sel(i) { selI = (i + items.length) % items.length; items.forEach((b, k) => b.classList.toggle('sel', k === selI)); }
items.forEach((b, k) => b.addEventListener('mouseenter', () => sel(k)));
addEventListener('keydown', (e) => {
  if ($('screen').hidden) return;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') { sel(selI + 1); e.preventDefault(); }
  if (e.code === 'ArrowUp' || e.code === 'KeyW') { sel(selI - 1); e.preventDefault(); }
  if (e.code === 'Enter' || e.code === 'Space') { items[selI].click(); e.preventDefault(); }
});
let clockT = 2 * 3600 + 13 * 60 + 44, clockAcc = 0;
function menuClock(dt) { clockAcc += dt; if (clockAcc < 1) return; clockAcc = 0; clockT++; const h = Math.floor(clockT / 3600), m = Math.floor(clockT / 60) % 60, s = clockT % 60; $('feedClock').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} AM`; }
$('micBox').checked = !!S.mic;
$('micBox').onchange = (e) => { S.mic = e.target.checked; save(); };
$('enterVR').onclick = () => { if (!navigator.xr) { $('vrNote').textContent = 'WebXR is not available here. Open this page in the Quest browser.'; return; } showSlots('vr'); };
async function startVR() {
  if (!navigator.xr) { $('vrNote').textContent = 'WebXR is not available here. Open this page in the Quest browser.'; return; }
  try {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
    await renderer.xr.setSession(session);
    useVRHands(); begin(true);
    const L = vHands.find((h) => h.side === 'L') || vHands[0]; hud.attachWrist(L);
    for (const h of vHands) h.obj.addEventListener('connected', () => { if (h.side === 'L') hud.attachWrist(h); });
    session.addEventListener('end', () => { useDesktopHands(); $('screen').hidden = false; G.state = 'menu'; sound.hush(); });
  } catch (e) { $('vrNote').textContent = 'Could not start VR: ' + e.message; }
}
if (navigator.xr) navigator.xr.isSessionSupported('immersive-vr').then((ok) => { if (!ok) $('enterVR').classList.add('dim'); });
populate(); // the Hoods are already out there, seen on the menu feed
$('loading').hidden = true;
// the menu theme starts with the first click or key (browsers need a gesture for sound)
addEventListener('pointerdown', () => sound.start(), { once: true });
addEventListener('keydown', () => sound.start(), { once: true });
