// DEAD AIR — main: renderer, Quest + desktop input, Josh (head, hands, light,
// noise, health), the HUD/wrist meters, the scene flow and the frame loop.
import * as THREE from '../vendor/three.module.js';
import { paintAll, T } from './paint.js?v=1';
import { District } from './district.js?v=1';
import { spawnHunters } from './hunters.js?v=1';
import { Kit } from './kit.js?v=1';
import { Blood } from './blood.js?v=1';
import { Director, QUOTA } from './director.js?v=1';
import { Sound } from './sound.js?v=1';
import { makeHand } from './body.js?v=1';

const V = THREE.Vector3;
const $ = (id) => document.getElementById(id);
const QUEST = /OculusBrowser|Quest/i.test(navigator.userAgent);
const S = { exposure: 1, mic: false };
try { Object.assign(S, JSON.parse(localStorage.getItem('deadair') || '{}')); } catch (e) {}
const save = () => { try { localStorage.setItem('deadair', JSON.stringify(S)); } catch (e) {} };

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
scene.background = new THREE.Color(0x030407);
scene.fog = new THREE.FogExp2(0x06070a, 0.042);
const camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.03, 300);
const dolly = new THREE.Group(); dolly.add(camera); scene.add(dolly);
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
scene.add(new THREE.HemisphereLight(0x1c2838, 0x0b0806, 0.35));
const moon = new THREE.DirectionalLight(0x6f86b0, 0.22); moon.position.set(-30, 50, 20); scene.add(moon);

// --------------------------------------------------------------- the game
paintAll(QUEST);
const world = new District(scene);
const sound = new Sound();
const G = {
  scene, world, sound, time: 0, hunters: [], hands: [],
  player: null, kit: null, blood: null, director: null, state: 'menu',
  noise(p, r, kind = 'player', from = null) {
    for (const h of G.hunters) if (h !== from) h.hear({ p: p.clone(), r, kind });
    if (kind === 'player' && r > 9) G.director?.event('noise');
  },
  onKill(h, cause) { G.director.onKill(h, cause); hud.flash('kill'); },
  openPen,
};
window.deadair = G; // for debugging from the console

// pen gate (chain-link door Josh starts behind)
const pen = new THREE.Group(); pen.position.set(-26, 0, 17.5);
{
  const t = T.chain.clone(); t.needsUpdate = true; t.repeat.set(4 / 0.6, 3 / 0.6);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, metalness: 0.7, roughness: 0.5 }));
  door.position.set(0, 1.5, 2); door.rotation.y = Math.PI / 2; pen.add(door);
  const frame = new THREE.MeshStandardMaterial({ color: 0x777a7c, metalness: 0.7, roughness: 0.4 });
  for (const z of [0.05, 3.95]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 3, 6), frame); p.position.set(0, 1.5, z); pen.add(p); }
  scene.add(pen);
}
const penBox = { x0: -26.08, x1: -25.92, z0: 17.5, z1: 21.5, y0: 0, y1: 3, see: false };
function closePen() { pen.rotation.y = 0; if (!world.boxes.includes(penBox)) world.boxes.push(penBox); world.bakeWalk(); G.penOpen = false; }
function openPen() { if (G.penOpen) return; G.penOpen = true; world.boxes.splice(world.boxes.indexOf(penBox), 1); world.bakeWalk(); sound.clank(new V(-26, 1, 19)); G.penSwing = 0; }
closePen();

// ---------------------------------------------------------------- Josh
const P = G.player = {
  pos: world.start.clone(), yaw: world.startYaw, head: new V(), chest: new V(), hp: 100, alive: true,
  crouch: false, crouchKey: false, light: 0, moveVis: 0, moving: false, speed: 0, stride: 0, hurtT: -99, noiseLvl: 0, standH: 1.7,
  hurt(n, by) {
    if (!this.alive) return;
    this.hp -= n; this.hurtT = G.time; sound.hurt(); hud.flash('hurt');
    for (const h of G.hands) h.haptic?.(1, 200);
    if (Math.random() < 0.5) sound.say('josh_hurt');
    if (this.hp < 40) G.director.event('hurt');
    if (this.hp <= 0) die();
  },
};
dolly.position.copy(P.pos); dolly.rotation.y = P.yaw;

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
    flash(k) { if (k === 'hurt') red = 0.55; if (k === 'kill') red = 0.2; },
    fadeTo(v) { fade = v; },
    sub(L, on) {
      const el = $('caption');
      if (on) { lines.push(L); } else { const i = lines.indexOf(L); if (i >= 0) lines.splice(i, 1); }
      const cur = lines[lines.length - 1];
      el.hidden = !cur; if (cur) el.innerHTML = `<b>${cur.who === 'DIRECTOR' ? 'THE DIRECTOR' : cur.who === 'JOSH' ? 'JOSH' : 'HUNTER'}:</b> ${cur.text}`;
      sg.clearRect(0, 0, 1024, 160); subs.visible = !!cur && renderer.xr.isPresenting;
      if (cur) {
        sg.fillStyle = 'rgba(0,0,0,0.6)'; sg.fillRect(0, 0, 1024, 160);
        sg.font = 'bold 30px "Courier New", monospace'; sg.fillStyle = cur.who === 'DIRECTOR' ? '#e8d5a0' : cur.who === 'JOSH' ? '#cfd6dc' : '#ff8c7a';
        wrap(sg, `${cur.who === 'DIRECTOR' ? 'DIRECTOR' : cur.who === 'JOSH' ? 'JOSH' : 'HUNTER'}: ${cur.text}`, 24, 50, 976, 38);
      }
      stex.needsUpdate = true;
    },
    update(dt) {
      t += dt;
      const target = Math.max(fade, red); red = Math.max(0, red - dt * 0.9);
      fx.material.color.set(red > fade ? 0x6a0000 : 0x000000);
      fx.material.opacity += (target - fx.material.opacity) * Math.min(1, dt * 6);
      if (t < 0.2) return; t = 0;
      // wrist / desktop meters
      const light = Math.min(1, P.light), noise = Math.min(1, P.noiseLvl / 10);
      g.clearRect(0, 0, 512, 256);
      g.fillStyle = 'rgba(8,8,10,0.82)'; roundRect(g, 4, 4, 504, 248, 22); g.fill();
      g.font = 'bold 34px "Courier New", monospace';
      meter(g, 24, 30, 'SEEN', light, light > 0.35 ? '#ffdd66' : light > 0.15 ? '#a08a40' : '#3c4450');
      meter(g, 24, 100, 'NOISE', noise, noise > 0.6 ? '#ff5544' : '#7a8a96');
      meter(g, 24, 170, 'HEALTH', Math.max(0, P.hp / 100), P.hp > 40 ? '#b23a2a' : '#ff2a1a');
      g.fillStyle = '#e8d5a0'; g.font = 'bold 30px "Courier New", monospace';
      g.fillText(G.director?.gate ? 'GATE OPEN' : `SHOW ${G.director?.kills || 0}/${QUOTA}`, 330, 238);
      tex.needsUpdate = true;
      $('mLight').style.width = light * 100 + '%'; $('mLight').style.background = light > 0.35 ? '#ffdd66' : light > 0.15 ? '#a08a40' : '#3c4450';
      $('mNoise').style.width = noise * 100 + '%';
      $('mHp').style.width = Math.max(0, P.hp) + '%';
      $('show').textContent = G.director?.gate ? 'THE GATE IS OPEN — EAST WALL' : `THE SHOW ${G.director?.kills || 0} / ${QUOTA}`;
    },
  };
})();
sound.subs = (L, on) => hud.sub(L, on);
function meter(g, x, y, label, v, col) {
  g.fillStyle = '#9aa2aa'; g.fillText(label, x, y + 34);
  g.fillStyle = '#1c1f24'; g.fillRect(x + 150, y + 8, 310, 32);
  g.fillStyle = col; g.fillRect(x + 150, y + 8, 310 * v, 32);
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function wrap(g, s, x, y, w, lh) { const words = s.split(' '); let line = ''; for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (g.measureText(t).width > w) { g.fillText(line, x, y); y += lh; line = wd; } else line = t; } g.fillText(line, x, y); }

// -------------------------------------------------------------- scene flow
function populate() {
  G.blood = G.blood || new Blood(scene, world);
  G.kit = new Kit(G);
  G.hunters = spawnHunters(G);
  G.director = new Director(G);
}
function teardown() {
  for (const h of G.hunters) scene.remove(h.body.root);
  G.kit?.clear(); for (const h of [...dHands, ...vHands]) h.item = null;
  G.blood?.clear();
  for (const c of G.director?.cams || []) scene.remove(c.g);
  sound.hush();
}
function resetScene() {
  teardown();
  world.gateOpen = false; if (!world.boxes.includes(world.gateBox)) world.boxes.push(world.gateBox); world.chain.visible = true; world.exitSign.material.color.set(0x333333);
  closePen();
  P.pos.copy(world.start); P.yaw = world.startYaw; P.hp = 100; P.alive = true;
  dolly.position.set(P.pos.x, 0, P.pos.z); dolly.rotation.y = P.yaw;
  populate(); hud.fadeTo(0);
  G.state = 'play'; G.time = 0; G.director.intro();
}
function die() {
  P.alive = false; G.state = 'dead'; hud.fadeTo(0.85);
  G.director.any('dir_death', 0);
  $('banner').textContent = 'CUT.'; $('banner').hidden = false;
  setTimeout(() => { $('banner').hidden = true; resetScene(); }, 7000);
}
function win() {
  G.state = 'won'; hud.fadeTo(1); sound.say('dir_win');
  $('banner').textContent = "THAT'S A WRAP"; $('banner').hidden = false;
  setTimeout(() => { $('banner').hidden = true; if (renderer.xr.isPresenting) resetScene(); else { $('screen').hidden = false; G.state = 'menu'; document.exitPointerLock?.(); } }, 9000);
}

// ---------------------------------------------------------------- input
const keys = {}; let pitch = 0, freecam = false; const fc = { p: new V(), yaw: 0, pitch: 0 };
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (G.state !== 'play') return;
  const R = dHands[0];
  if (e.code === 'KeyE') { if (R.item?.kind === 'bag') { R.use = true; R.useHeld = true; } else G.kit.pickInView(R.item ? dHands[1] : R, camera.getWorldPosition(new V()), camera.getWorldDirection(new V())); }
  if (e.code === 'KeyG') { const h = R.item ? R : dHands[1]; if (h.item) G.kit.drop(h, new V()); }
  if (e.code === 'KeyQ') G.kit.throwFrom(R.item && R.item.kind !== 'bag' ? R : dHands[1], camera.getWorldDirection(new V()));
  if (e.code === 'KeyF') { // swap hands
    const a = dHands[0].item, b = dHands[1].item; if (a) G.kit.drop(dHands[0], new V()); if (b) G.kit.drop(dHands[1], new V()); if (b) G.kit.grab(dHands[0], b); if (a) G.kit.grab(dHands[1], a);
  }
  if (e.code === 'KeyC') P.crouchKey = !P.crouchKey;
  if (e.code === 'KeyN') { freecam = !freecam; fc.p.copy(camera.getWorldPosition(new V())); fc.yaw = P.yaw; fc.pitch = pitch; }
  if (e.code === 'Escape' && !document.pointerLockElement) { /* menu stays reachable via the pause button */ }
});
addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'KeyE') dHands[0].useHeld = false; });
let drag = null;
canvas.addEventListener('mousedown', (e) => {
  if (G.state !== 'play') return;
  if (!document.pointerLockElement) { lockPointer(); drag = { x: e.clientX, y: e.clientY }; }
  if (e.button === 0) { const R = dHands[0]; R.use = true; R.useHeld = true; swing(R); }
  if (e.button === 2) G.kit.throwFrom(dHands[0].item && dHands[0].item.kind !== 'bag' ? dHands[0] : dHands[1], camera.getWorldDirection(new V()));
});
addEventListener('mouseup', (e) => { if (e.button === 0) dHands[0].useHeld = false; drag = null; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
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
  if (!k || k === 'bag') return;
  swings.push({ hand, t: 0, kind: k === 'crowbar' || k === 'brick' || k === 'bottle' ? 'arc' : 'thrust' });
}
function updateSwings(dt) {
  for (const h of dHands) { h.obj.position.copy(h.base.p); h.obj.rotation.copy(h.base.r); }
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
      if (press(4)) { /* A */ }
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
  if (G.state === 'play' || G.state === 'dead' || G.state === 'won') {
    G.time += dt;
    // -------- move Josh
    let mx = 0, mz = 0, run = false;
    if (xr) [mx, mz, run] = vrInput(dt);
    else if (!freecam) {
      mx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0); mz = (keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0);
      if (keys.ArrowLeft) P.yaw += dt * 2; if (keys.ArrowRight) P.yaw -= dt * 2;
      run = keys.ShiftLeft || keys.ShiftRight;
    }
    if (!P.alive || G.state !== 'play') { mx = mz = 0; }
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
      const eh = P.crouch ? 1.12 : 1.68; camera.position.y += (eh - camera.position.y) * Math.min(1, dt * 8);
      camera.position.x = camera.position.z = 0;
      camera.updateMatrixWorld(true); camera.getWorldPosition(P.head);
    }
    P.pos.set(P.head.x, 0, P.head.z);
    P.chest.copy(P.head).y -= 0.45;
    G.lookDir = camera.getWorldDirection(G.lookDir || new V());
    const moved = lastHead.distanceTo(P.head) / Math.max(dt, 1e-3); lastHead.copy(P.head);
    P.speed = P.speed * 0.8 + Math.min(6, moved) * 0.2;
    P.moving = P.speed > 0.25;
    P.moveVis = P.speed > 2.6 ? 0.35 : P.speed > 1.2 ? 0.12 : P.speed > 0.3 ? 0.04 : 0;
    // light: lamps + hunters' torches on you
    P.light = world.lightAt(P.pos);
    for (const h of G.hunters) {
      if (!h.torch || !h.alive) continue;
      const tp = h.torch.getWorldPosition(tmp.clone()), tt = h.torch.target.getWorldPosition(new V());
      const to = P.chest.clone().sub(tp), d = to.length(); if (d > 16) continue;
      const cos = to.normalize().dot(tt.sub(tp).normalize());
      if (cos > Math.cos(0.42) && world.clear(tp, P.chest)) P.light += 0.9 * (1 - d / 16);
    }
    // footsteps make noise; louder when running, nearly silent crouched
    stepAcc += P.speed * dt;
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

    // -------- hands
    if (!xr) updateSwings(dt);
    for (const h of G.hands) {
      h.obj.updateMatrixWorld(true);
      h.obj.getWorldPosition(h.pos);
      const v = tmp.copy(h.pos).sub(h.prev).divideScalar(Math.max(dt, 1e-3));
      h.vel.lerp(v, 0.6); h.prev.copy(h.pos);
      if (xr) G.kit.handInput(h);
      h.model.curl(h.item ? 0.92 : xr ? 0.25 + h.trigger * 0.6 + (h.grip ? 0.3 : 0) : 0.55, h.item ? 0.7 : 0.35);
      h.model.group.visible = !(h.item?.kind === 'bag' && false);
    }
    G.kit.update(dt);
    for (const h of dHands) h.use = false;

    // -------- the world
    world.update(G.time, dt);
    for (const h of G.hunters) h.update(dt, G.time);
    G.blood.update(dt);
    G.director.update(dt);
    if (G.penOpen && G.penSwing < 1) { G.penSwing = Math.min(1, G.penSwing + dt * 0.6); pen.rotation.y = -G.penSwing * 1.6; }
    // tension score: how hunted are you?
    let hunted = 0; for (const h of G.hunters) if (h.alive) hunted = Math.max(hunted, h.aware() ? 1 : h.susp * 0.7);
    sound.tension(hunted); sound.tick(dt);
    // escape
    if (G.state === 'play' && world.gateOpen && P.pos.x > 35.4) win();
    // prompts (desktop)
    prompt();
  }
  // freecam (desktop): fly around without moving Josh
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
  renderer.render(scene, camera);
});

function prompt() {
  const el = $('prompt'); if (renderer.xr.isPresenting) { el.hidden = true; return; }
  const R = dHands[0]; let s = '';
  const eye = P.head, dir = camera.getWorldDirection(new V());
  if (R.item?.kind === 'bag') {
    const h = G.hunters.find((h) => h.alive && !h.aware() && h.state !== 'bagged' && h.body.headPos(new V()).distanceTo(eye) < 1.5 && h.behind(P.pos));
    if (h) s = 'CLICK — pull the bag over his head (hold)';
  } else if (G.kit.struggle) s = 'HOLD — keep it tight';
  if (!s) for (const it of G.kit.items) { if (it.hand || it.flying) continue; const to = it.mesh.position.clone().sub(eye); const d = to.length(); if (d < 2.4 && to.normalize().dot(dir) - d * 0.05 > 0.72) { s = `E — pick up ${it.kind}`; break; } }
  el.hidden = !s; el.textContent = s;
}

function lockPointer() { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }

// ------------------------------------------------------------- menu
function begin(vr) {
  sound.start();
  $('screen').hidden = true; $('hud').hidden = false;
  if (S.mic && !mic) startMic();
  resetScene();
}
$('playDesktop').onclick = () => { useDesktopHands(); begin(false); lockPointer(); };
$('howBtn').onclick = () => { $('how').hidden = !$('how').hidden; };
$('micBox').checked = !!S.mic;
$('micBox').onchange = (e) => { S.mic = e.target.checked; save(); };
$('enterVR').onclick = async () => {
  if (!navigator.xr) { $('vrNote').textContent = 'WebXR is not available here. Open this page in the Quest browser.'; return; }
  try {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
    await renderer.xr.setSession(session);
    useVRHands(); begin(true);
    const L = vHands.find((h) => h.side === 'L') || vHands[0]; hud.attachWrist(L);
    for (const h of vHands) h.obj.addEventListener('connected', () => { if (h.side === 'L') hud.attachWrist(h); });
    session.addEventListener('end', () => { useDesktopHands(); $('screen').hidden = false; G.state = 'menu'; sound.hush(); });
  } catch (e) { $('vrNote').textContent = 'Could not start VR: ' + e.message; }
};
if (navigator.xr) navigator.xr.isSessionSupported('immersive-vr').then((ok) => { if (!ok) $('enterVR').classList.add('dim'); });
$('loading').hidden = true;
