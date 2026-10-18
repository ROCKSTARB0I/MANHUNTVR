// objectives.js — a scene's own goals, as in the game: gates that open when a job
// is done, things to fetch, switches to throw. Each scene script places its gates
// (solid until opened, so hunters' paths respect them too), gives the Director his
// instructions and sets the line of objective text on the HUD.
import * as THREE from '../vendor/three.module.js';
import { PLANS } from './plans.js?v=43';
import { HAND } from './handplans.js?v=43';
import { makeHunterWeapon, Person } from './body.js?v=43';
import { GANG_SETS } from './hunters.js?v=43';
import { T } from './paint.js?v=43';

const V = THREE.Vector3;

export class Objectives {
  constructor(G) {
    this.G = G; this.text = ''; this.lockExit = false; this.parts = []; this.boxes = []; this.spots = []; this.tick = null;
    const def = G.world.def, P = HAND[def.plan] || PLANS[def.plan];
    if (P) { this.X = (i) => (i - P.w / 2) * P.m; this.Z = (j) => (j - P.h / 2) * P.m; this.m = P.m; }
    const script = SCRIPTS[def.id];
    if (script && P) { script(this, G); G.world.bakeWalk(); }
  }
  set(text, line) { this.text = text; if (line) this.G.sound.say(line); }
  mesh(o) { this.G.world.root.add(o); this.parts.push(o); return o; }
  box(b) { this.G.world.boxes.push(b); this.boxes.push(b); return b; }
  unbox(b) { const L = this.G.world.boxes, i = L.indexOf(b); if (i >= 0) L.splice(i, 1); this.G.world.bakeWalk(); }
  // a gate across a run of cells; kind: 'chain' (chain-link with a padlock), 'rope' (tied shut), 'scrap' (junk piled up, never opens)
  gate(x0, x1, z0, z1, kind) {
    const W = this.G.world, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, alongX = x1 - x0 > z1 - z0, len = Math.max(x1 - x0, z1 - z0), y = W.heightAt(cx, cz);
    const g = new THREE.Group(); g.position.set(cx, y, cz); if (!alongX) g.rotation.y = Math.PI / 2;
    const metal = W.mat('ogate', { color: 0x4a4640, metalness: 0.7, roughness: 0.55 });
    if (kind === 'facade') { // the aquarium's front wall: blue paint and white waves
      if (!this.waveTex) { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#1e3a6a'; x.fillRect(0, 0, 256, 128); x.strokeStyle = '#c8d8e8'; x.lineWidth = 6; for (let r = 0; r < 3; r++) { x.beginPath(); for (let k = 0; k <= 256; k += 4) x.lineTo(k, 30 + r * 34 + Math.sin(k / 256 * Math.PI * 4) * 8); x.stroke(); } this.waveTex = new THREE.CanvasTexture(c); this.waveTex.colorSpace = THREE.SRGBColorSpace; this.waveTex.wrapS = THREE.RepeatWrapping; }
      const t = this.waveTex.clone(); t.needsUpdate = true; t.repeat.set(len / 4, 1);
      const b = new THREE.Mesh(new THREE.BoxGeometry(len, 4.2, 0.5), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 })); b.position.y = 2.1; b.castShadow = true; g.add(b);
    } else if (kind === 'panel') { // a white-painted board set flush in the wall
      const b = new THREE.Mesh(new THREE.BoxGeometry(len, 2.6, 0.12), W.mat('opanel', { color: 0xe8e6de, roughness: 0.7 })); b.position.y = 1.3; g.add(b);
    } else if (kind === 'scrap') {
      const m = W.mats.pscrap || W.mat('oscrap', { color: 0x4a4038, roughness: 0.8 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(len + 0.4, 3.4, 1.2), m); b.position.y = 1.7; b.castShadow = true; g.add(b);
    } else {
      const panel = new THREE.Group(); panel.position.x = -len / 2; g.add(panel); // hinged at one end
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.6), W.mat('ochain', { map: T.chain || null, color: 0x8a8a84, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.6 }));
      mesh.position.set(len / 2, 1.4, 0); panel.add(mesh);
      for (const y2 of [0.12, 2.7]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 6), metal); r.rotation.z = Math.PI / 2; r.position.set(len / 2, y2, 0); panel.add(r); }
      for (const x of [0, len]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.9, 8), metal); p.position.set(x, 1.45, 0); panel.add(p); }
      if (kind === 'fence') { /* chain-link panel, no lock: never opens */ } else if (kind === 'rope') { // rope wound round the gate and the post, knotted
        const rope = W.mat('orope', { color: 0x8a7448, roughness: 1 });
        for (let k = 0; k < 5; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 5, 12), rope); t.position.set(len - 0.02, 1.0 + k * 0.07, 0); t.rotation.set(Math.PI / 2, 0, k * 0.4); panel.add(t); }
        g.userData.lock = new V(cx + (alongX ? len / 2 : 0), y + 1.15, cz + (alongX ? 0 : len / 2));
      } else { const lk = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.05), W.mat('olock', { color: 0x9a9a92, metalness: 0.9, roughness: 0.3 })); lk.position.set(len - 0.05, 1.2, 0.05); panel.add(lk); }
      g.userData.panel = panel;
    }
    this.mesh(g);
    const b = this.box({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0: 0, y1: 3.4, see: kind !== 'scrap' && kind !== 'facade' && kind !== 'panel' });
    const gt = { g, b, kind, open: false, swing: 0, at: new V(cx, y, cz), len };
    gt.unlock = () => { if (gt.open) return; gt.open = true; this.unbox(b); if (kind === 'scrap' || kind === 'panel') { g.visible = false; this.G.sound.thud?.(gt.at, 1.5); } else this.G.sound.rattle?.(gt.at); };
    this.gates = this.gates || []; this.gates.push(gt);
    return gt;
  }
  // the reachable runs of cells along row j (between i0 and i1), for closing every gap in a junk line
  runs(j, i0, i1) {
    const W = this.G.world, out = []; let cur = null;
    for (let i = i0; i <= i1; i++) { const ok = W.reach(this.X(i + 0.5), this.Z(j + 0.5)); if (ok && !cur) cur = [i, i]; else if (ok) cur[1] = i; else if (cur) { out.push(cur); cur = null; } }
    if (cur) out.push(cur); return out;
  }
  runsV(i, j0, j1) {
    const W = this.G.world, out = []; let cur = null;
    for (let j = j0; j <= j1; j++) { const ok = W.reach(this.X(i + 0.5), this.Z(j + 0.5)); if (ok && !cur) cur = [j, j]; else if (ok) cur[1] = j; else if (cur) { out.push(cur); cur = null; } }
    if (cur) out.push(cur); return out;
  }
  // gates across every gap in a column of cells (pick chooses the kind for each run)
  gateCol(i, j0, j1, pick) { return this.runsV(i, j0, j1).map(([a, b]) => this.gate(this.X(i + 0.3), this.X(i + 0.7), this.Z(a), this.Z(b + 1), pick(a, b))); }
  gateRow(j, i0, i1, pick) { return this.runs(j, i0, i1).map(([a, b]) => this.gate(this.X(a), this.X(b + 1), this.Z(j + 0.3), this.Z(j + 0.7), pick(a, b))); }
  // a fence along a line of cells with one 4-cell door per long gap: returns the doors (they open); the rest stays shut
  fenceLine(axis, k, a0, a1, doorKind = 'chain') {
    const runs = axis === 'col' ? this.runsV(k, a0, a1) : this.runs(k, a0, a1), doors = [];
    const seg = (p, q, kind) => axis === 'col' ? this.gate(this.X(k + 0.3), this.X(k + 0.7), this.Z(p), this.Z(q), kind) : this.gate(this.X(p), this.X(q), this.Z(k + 0.3), this.Z(k + 0.7), kind);
    const longest = runs.reduce((m, r) => (r[1] - r[0] > m[1] - m[0] ? r : m), runs[0] || [0, -1]);
    for (const [a, b] of runs) {
      if (a !== longest[0]) { seg(a, b + 1, 'fence'); continue; }
      const mid = Math.round((a + b) / 2); if (mid - 2 > a) seg(a, mid - 2, 'fence'); doors.push(seg(mid - 2, mid + 2, doorKind)); if (b + 1 > mid + 2) seg(mid + 2, b + 1, 'fence');
    }
    return doors;
  }
  cell(i, j) { return new V(this.X(i), 0, this.Z(j)); }
  inCells(i0, i1, j0, j1) { const P = this.G.player.pos, i = P.x / this.m + (this.X(0) / -this.m), j = P.z / this.m + (this.Z(0) / -this.m); return i >= i0 && i <= i1 && j >= j0 && j <= j1; }
  // a hunter kept out of sight until the scene calls him in
  hold(h) { if (!h) return; h.dormant = true; h.body.root.visible = false; }
  wake(h, at, charge = true) {
    if (!h || !h.dormant) return; h.dormant = false; h.body.root.visible = true; if (at) { h.pos.copy(at); h.place(); }
    const P = this.G.player.pos.clone(); h.investigate?.(P); if (charge) { h.susp = 1.4; h.last?.copy(P); } h.say?.('spot');
  }
  // a member of Cash's family, kneeling with hands tied behind, head down
  captive(at, look) {
    const G = this.G, P = new Person(Object.assign({ mask: null, weapon: null, hood: false, dirt: 0.6, stains: 0.4, seed: 70 + this.parts.length, skin: [0.48, 0.32, 0.23], bulk: 0.95 }, look));
    P.root.position.set(at.x, G.world.heightAt(at.x, at.z), at.z); P.root.rotation.y = Math.random() * 6.28;
    P.pose = (rot, b, dt, t, B) => { b[B.hips].position.y -= 0.5; rot('thighL', -0.1, 0, 0.08); rot('thighR', -0.1, 0, -0.08); rot('shinL', 1.75); rot('shinR', 1.75); rot('footL', -0.5); rot('footR', -0.5);
      rot('spine', 0.25); rot('neck', 0.45 + Math.sin(t * 2.3) * 0.08, Math.sin(t * 1.1) * 0.25); rot('armL', 0.55, 0, 0.3); rot('armR', 0.55, 0, -0.3); rot('foreL', -1.3, 0.4); rot('foreR', -1.3, -0.4); };
    P.animate(0.016, 0); this.mesh(P.root); this.captives = this.captives || []; const c = { P, at: at.clone(), alive: true, saved: false }; this.captives.push(c); return c;
  }
  // an escort (the tramp): follows Cash or waits where he's told, walks the world's paths, can be hurt
  companion(at, look, name = 'tramp', lines = ['tr_follow', 'tr_wait']) {
    const G = this.G, W = G.world, P = new Person(Object.assign({ mask: null, weapon: null, hood: false, dirt: 1, stains: 0.6, seed: 91, bulk: 0.95 }, look));
    P.root.position.set(at.x, W.heightAt(at.x, at.z), at.z); this.mesh(P.root);
    const c = { P, pos: at.clone(), yaw: 0, hp: 100, alive: true, follow: false, path: [], pathT: 0 };
    c.update = (dt) => {
      if (!c.alive) { P.animate(dt, G.time); return; }
      const me = G.player.pos, d = Math.hypot(me.x - c.pos.x, me.z - c.pos.z); let speed = 0;
      if (c.follow && d > 2.2) {
        c.pathT -= dt; if (c.pathT < 0 || !c.path.length) { c.path = W.path(c.pos, me) || []; c.pathT = 0.6; }
        while (c.path.length && Math.hypot(c.path[0][0] - c.pos.x, c.path[0][1] - c.pos.z) < 0.5) c.path.shift();
        const w = c.path[0] || [me.x, me.z], dx = w[0] - c.pos.x, dz = w[1] - c.pos.z, l = Math.hypot(dx, dz) || 1;
        speed = d > 7 ? 3.0 : 1.9; c.pos.x += dx / l * Math.min(l, speed * dt); c.pos.z += dz / l * Math.min(l, speed * dt); if (c.path.length <= 1) W.collide?.(c.pos, 0.3); // a found path is walkable; only bare steering needs pushing out of walls
        const ty = Math.atan2(dx, dz); c.yaw += Math.atan2(Math.sin(ty - c.yaw), Math.cos(ty - c.yaw)) * Math.min(1, dt * 6);
      }
      P.anim.speed += (speed - P.anim.speed) * Math.min(1, dt * 6); P.anim.crouch = c.follow ? 0 : 0.6;
      P.root.position.set(c.pos.x, W.heightAt(c.pos.x, c.pos.z), c.pos.z); P.root.rotation.y = c.yaw; P.animate(dt, G.time);
      for (const h of G.hunters) if (h.alive && !h.dormant && h.aware?.() && h.pos.distanceTo(c.pos) < 1.7) c.hp -= 22 * dt;
      if (c.hp <= 0) { c.alive = false; G.sound.painScream?.(c.pos.clone().setY(1.4)); G.blood?.pool?.(c.pos.clone(), 1.3); P.die(new V(), null, W); c.onDie?.(); }
    };
    this.spots.push({ at: c.pos, at3: c.pos, r: 2.6, reach: 1, label: '', live: () => c.alive && c.free, act: () => { c.follow = !c.follow; G.sound.say(c.follow ? lines[0] : lines[1]); } });
    const spot = this.spots[this.spots.length - 1]; Object.defineProperty(spot, 'label', { get: () => c.follow ? `E — tell the ${name} to wait here` : `E — tell the ${name} to follow you` });
    this.comp = c; return c;
  }
  // dress a hunter as someone else (another gang's member, a named character): a fresh body, no torch
  reskin(h, look) { if (!h) return; const G = this.G; G.scene.remove(h.body.root); h.torch = null; h.beam = null; const P = new Person(Object.assign({ hood: false, dirt: 1, stains: 0.5, seed: 200 + h.idx }, look)); h.body = P; G.scene.add(P.root); h.place(); return P; }
  arm(h, kind) { if (!h) return; h.gun = true; h.dropOnDeath = kind === 'revolver' ? 'revolver' : 'rifle'; const b = h.body; if (b.weapon) b.weapon.parent?.remove(b.weapon); b.weapon = makeHunterWeapon(kind); b.weapon.position.set(0, -0.1, 0.02); b.bones[10]?.add(b.weapon); }
  noCrowbars() { const K = this.G.kit; for (const it of [...K.items]) if (it.kind === 'crowbar' && !it.hand) K.remove(it); }
  hasItem(kind) { const G = this.G; return G.hands.some((h) => h.item?.kind === kind) || Object.values(G.kit.inv || {}).some((it) => it?.kind === kind); }
  nearPlayer(p, r) { const P = this.G.player.pos; return Math.hypot(P.x - p.x, P.z - p.z) < r; }
  // E on desktop: the closest live interaction spot in reach
  interact() { for (const s of this.spots) if (s.live() && this.nearPlayer(s.at, s.r)) { s.act(); return true; } return false; }
  prompt() { for (const s of this.spots) if (s.live() && this.nearPlayer(s.at, s.r)) return s.label; return ''; }
  update(dt) {
    for (const gt of this.gates || []) if (gt.open && gt.g.userData.panel && gt.swing < 1.5) { gt.swing = Math.min(1.5, gt.swing + dt * 1.4); gt.g.userData.panel.rotation.y = gt.swing; }
    // VR: squeeze grip with a hand on the spot (the knife does the cutting by touch)
    for (const h of this.G.hands) { if (h.desktop) continue; const g = h.grip > 0.6, was = h.gripPrev > 0.6; if (g && !was) for (const s of this.spots) if (s.live() && h.pos.distanceTo(s.at3 || s.at) < (s.reach || 0.6)) { s.act(); break; } }
    for (const c of this.captives || []) c.P.animate(dt, this.G.time);
    this.comp?.update(dt);
    this.tick?.(dt);
  }
  dispose() {
    for (const o of this.parts) o.parent?.remove(o);
    const L = this.G.world.boxes; for (const b of this.boxes) { const i = L.indexOf(b); if (i >= 0) L.splice(i, 1); }
    this.G.world.bakeWalk(); this.parts = []; this.boxes = []; this.spots = [];
  }
}

// ------------------------------------------------------------------ scene scripts
const SCRIPTS = {
  // Doing Time. Hunters 0-5 drop through the hole for the hammer executions, 6 the big Smiley with the bat,
  // 7-9 drop for the bat executions, 10-11 come down the stairs, 12-15 hold the top tier with guns.
  'doing-time'(O, G) {
    const H = G.hunters, W = G.world;
    O.lockExit = true;
    const kDoor = O.gateRow(83, 68, 92, () => 'chain');
    for (let k = 0; k < 12; k++) O.hold(H[k]);
    for (const k of [10, 11, 12, 13, 14, 15]) { const h = H[k]; if (!h) continue; h.gun = true; h.dropOnDeath = k % 2 ? 'revolver' : 'rifle'; const b = h.body; if (b.weapon) b.weapon.parent?.remove(b.weapon); b.weapon = makeHunterWeapon(k % 2 ? 'revolver' : 'shotgun'); b.weapon.position.set(0, -0.1, 0.02); b.bones[10]?.add(b.weapon); }
    if (H[6]) { H[6].dropOnDeath = 'bat'; H[6].hp = (H[6].hp || 100) * 1.6; H[6].body.root.scale.setScalar(1.15); }
    G.kit.spawn('hammer', new V(O.X(38), 0.04, O.Z(39)));
    const done = { hammer: [0, 0], bat: [0, 0] }; let phase = 0, wave = 0;
    const held = () => G.hands.map((h) => h.item?.kind).find((k) => k === 'hammer' || k === 'bat');
    const need = (w) => done[w][0] < 1 || done[w][1] < 1;
    const st = () => O.set(phase <= 1 ? (phase === 0 ? 'Find the Hammer' : `Execute with the Hammer: gruesome ${done.hammer[1] ? '✓' : '✗'}  violent ${done.hammer[0] ? '✓' : '✗'}`) : phase === 2 ? 'Get the Bat from the big Smiley' : phase === 3 ? `Execute with the Bat: gruesome ${done.bat[1] ? '✓' : '✗'}  violent ${done.bat[0] ? '✓' : '✗'}` : phase === 4 ? 'Make your way to the end of the Cellblock' : 'Go along the top of the Cellblock and get to the showers');
    const drop = (ks) => ks.forEach((k, n) => O.wake(H[k], O.cell(6 + n, 38 + n), true));
    const orig = G.director.onKill.bind(G.director);
    G.director.onKill = (h, cause) => { orig(h, cause); const w = held(); const lvl = h.execLevel;
      if (w && lvl != null && (phase === 1 && w === 'hammer' || phase === 3 && w === 'bat')) { if (lvl >= 2) done[w][1]++; else if (lvl >= 1) done[w][0]++; }
      st(); };
    O.set('Find the Hammer', 'dir_dt_intro');
    O.tick = () => {
      if (phase === 0 && O.hasItem('hammer')) { phase = 1; drop([0, 1, 2]); wave = 1; G.sound.say('dir_dt_hammer'); st(); }
      if (phase === 1) { if (!need('hammer')) { phase = 2; O.wake(H[6], O.cell(6, 39)); G.sound.say('dir_dt_big'); st(); }
        else if (wave === 1 && [0, 1, 2].every((k) => !H[k]?.alive)) { wave = 2; drop([3, 4, 5]); G.sound.say('dir_dt_again'); } }
      if (phase === 2 && O.hasItem('bat')) { phase = 3; drop([7, 8, 9]); st(); }
      if (phase === 3 && !need('bat')) { phase = 4; for (const g of kDoor) g.unlock(); O.wake(H[10], O.cell(80, 88)); O.wake(H[11], O.cell(90, 88)); G.sound.say('dir_dt_up'); st(); }
      if (phase === 3 && need('bat') && [7, 8, 9].every((k) => !H[k]?.alive) && !O.batRetry) { O.batRetry = 1; drop([3, 4, 5].filter((k) => H[k]?.dormant)); }
      if (phase === 4 && O.inCells(95, 130, 16, 72)) { phase = 5; st(); }
      if (phase >= 4 && [10, 11, 12, 13, 14, 15].every((k) => !H[k]?.alive) && O.lockExit) { W.openGate(); G.director.gate = true; O.lockExit = false; G.sound.say('dir_dt_done'); O.set('Walk out through the showers'); }
    };
  },
  // Deliverance. Hunter 0 is Piggsy; 1-5 the last Cerberus team behind the locked door; 6 Starkweather in his office.
  'deliverance'(O, G) {
    const H = G.hunters, W = G.world, K = G.kit, { X, Z } = O;
    O.lockExit = true;
    const pig = H[0];
    if (pig) { pig.hp = 99999; pig.noExec = true; }
    for (let k = 1; k <= 6; k++) { const h = H[k]; if (!h) continue; h.saw?.(null, 0, true); h.saw = null; h.boss = false; h.hp = 100; }
    for (let k = 1; k <= 5; k++) { O.reskin(H[k], { ...GANG_SETS.cerberus.members[k % GANG_SETS.cerberus.members.length], weapon: null }); O.arm(H[k], 'rifle'); O.hold(H[k]); }
    const S = H[6];
    if (S) { O.reskin(S, { mask: null, weapon: null, skin: [0.7, 0.55, 0.47], bulk: 1.05, stubble: false, hair: [0.55, 0.55, 0.52], top: [0.22, 0.22, 0.24], legs: [0.22, 0.22, 0.24], legsMap: 'fleece', boots: [0.05, 0.04, 0.035], dirt: 0.1, stains: 0, gear: [] }); O.arm(S, 'revolver'); S.noExec = true; S.hp = 140; O.hold(S);
      S.shots = 0; const shoot = S.shoot.bind(S); S.shoot = (P, d) => { shoot(P, d); if (++S.shots >= 3) { S.gun = false; S.flee = { goal: O.cell(62, 54), speed: 2.6 }; } }; }
    O.hold(pig);
    const atticDoor = O.gateRow(52, 125, 133, () => 'chain'), towerDoor = O.gateCol(8.5, 16, 22, () => 'chain'), office = O.gateCol(87.5, 60, 64, () => 'chain');
    for (const at of [[143, 54.5], [92, 79], [118, 71]]) K.spawn('shard', new V(X(at[0]), 0.015, Z(at[1])));
    // the grating at the top of the stair tower
    const grate = new THREE.Mesh(new THREE.BoxGeometry(6 * O.m, 0.05, 6 * O.m), new THREE.MeshStandardMaterial({ color: 0x3a3632, metalness: 0.7, roughness: 0.6, wireframe: true })); grate.position.set(X(15), 7.22, Z(19.5)); O.mesh(grate);
    const onGrate = (p) => p.x > X(12) && p.x < X(18) && p.z > Z(16.5) && p.z < Z(22.5);
    let phase = 0, wounds = 0, scares = 0, runT = 0;
    const held = (kind) => G.hands.find((h) => h.item?.kind === kind);
    const st = () => O.set(phase === 0 ? `Kill Piggsy  ·  wounds ${wounds}/3  (glass shards and a wooden spike are all that hurt him)` : phase === 1 ? 'Piggsy has fled to the attic. Follow him up' : phase === 2 ? 'Lure Piggsy onto the grating at the top of the stair tower' : phase === 3 ? 'Use the chainsaw to cut through the locked door' : phase === 4 ? 'Kill the last of the Cerberus' : phase === 5 ? 'Cut through the door to Starkweather\'s office' : phase === 6 ? 'Kill Starkweather' : 'Get out');
    O.set('Kill Piggsy  ·  wounds 0/3  (glass shards and a wooden spike are all that hurt him)', 'dir_dl_intro');
    // a stab in the back: he howls, swats Cash down and runs
    O.spots.push({ at: new V(), r: 2.2, reach: 1.2, label: 'E — drive it into his back', live: () => phase === 0 && pig && !pig.dormant && held('shard') && pig.pos.distanceTo(G.player.pos) < 2.2 && runT <= 0,
      act: () => { const hd = held('shard'); K.remove(hd.item); wounds++; G.sound.stab(pig.eye(new V()), 1.4); G.sound.say('piggsy_3', { at: pig.pos }); G.blood?.spray?.(pig.eye(new V()), new V(0, 0.4, 0), 30, 1); G.player.hurt?.(12, pig); pig.stun = 1.0;
        runT = 7; pig.flee = { goal: O.cell(...[[100, 62], [126, 90], [145, 56]][wounds % 3]), speed: 3.0 };
        if (wounds >= 3) { phase = 1; runT = 0; pig.flee = null; setTimeout(() => { O.hold(pig); for (const g of atticDoor) g.unlock(); G.sound.say('dir_dl_attic'); st(); }, 2500); } else st(); } });
    const stab = O.spots[O.spots.length - 1]; Object.defineProperty(stab, 'at', { get: () => pig.pos });
    O.spots.push({ at: O.cell(11, 19), at3: new V(X(10), 8.4, Z(19)), r: 2.4, reach: 1, label: 'E — saw through the door', live: () => phase === 3 && held('chainsaw'),
      act: () => { phase = 4; for (const g of towerDoor) g.unlock(); G.sound.say('dir_dl_cerberus'); for (let k = 1; k <= 5; k++) O.wake(H[k], O.cell(3 + (k % 3), 15 + k * 2), true); st(); } });
    O.spots.push({ at: O.cell(90, 62), r: 2.4, reach: 1, label: 'E — saw through the office door', live: () => phase === 5 && held('chainsaw'),
      act: () => { phase = 6; for (const g of office) g.unlock(); G.sound.say('dir_dl_office'); O.wake(S, O.cell(70, 60), true); st(); } });
    let saw = null;
    O.tick = (dt) => {
      // Piggsy comes for Cash as soon as he leaves the elevator
      if (phase === 0 && pig?.dormant && G.player.pos.distanceTo(O.cell(146, 91)) > 7) { O.wake(pig, O.cell(145, 60), true); G.sound.say('piggsy_2', { at: pig.pos }); }
      if (runT > 0) { runT -= dt; if (runT <= 0 && pig) { pig.flee = null; pig.state = 'hunt'; pig.last.copy(G.player.pos); } }
      if (phase === 1 && O.inCells(56, 156, 2, 33)) { phase = 2; O.wake(pig, O.cell(150, 18), false); pig.state = 'patrol'; pig.route = [[X(150), Z(18)], [X(150), Z(10)]]; pig.susp = 0; G.sound.say('dir_dl_lure'); st(); }
      if (phase === 2 && pig && onGrate(pig.pos) && runT <= 0) {
        if (scares === 0) { scares = 1; runT = 8; pig.flee = { goal: O.cell(140, 18), speed: 2.4 }; G.sound.creak?.(pig.pos); G.sound.say('piggsy_1', { at: pig.pos }); G.sound.say('dir_dl_grate'); }
        else { // the grating gives: he hangs on by his hands, the saw drops at Cash's feet
          phase = 3; grate.visible = false; O.box({ x0: X(12), x1: X(18), z0: Z(16.5), z1: Z(22.5), y0: 0, y1: 9, see: true }); W.bakeWalk();
          G.sound.crunch?.(pig.eye(new V())); G.sound.say('piggsy_2', { at: pig.pos }); pig.flee = null; pig.kill(new V(0, -3, 0), pig.eye(new V()), 'fall'); pig.body.root.visible = false; pig.saw?.(null, 0, true); pig.saw = null;
          K.spawn('chainsaw', new V(X(19.5), 7.25, Z(19.5))); G.sound.say('dir_dl_saw'); st(); }
      }
      if (phase === 4 && [1, 2, 3, 4, 5].every((k) => !H[k]?.alive)) { phase = 5; G.sound.say('dir_dl_last'); st(); }
      if (phase === 6 && S && !S.alive) { phase = 7; W.openGate(); G.director.gate = true; O.lockExit = false; O.set('It\'s over. Get out through the window'); }
      if (phase === 6 && S?.flee && S.pos.distanceTo(S.flee.goal) < 1.5) S.flee.goal = O.cell(...[[62, 54], [85, 76], [62, 76], [85, 54]][Math.floor(Math.random() * 4)]);
      // the saw in Cash's hands: it runs while he holds it
      const hs = held('chainsaw'); if (hs && !saw) saw = G.sound.sawLoop?.(); if (saw) { if (hs) saw(hs.item.mesh.getWorldPosition(new V()), 1); else { saw(null, 0, true); saw = null; } }
    };
  },
  // Key Personnel. Hunters: 0 the balcony chamber, 1-2 the octagon, 3-4 the dining room, 5-6 the hallway, 7 the rec
  // room, 8-9 the grand hall, 10 the camera operator, 11 upstairs, 12 the Cerberus Leader, 13-15 his guards,
  // 16-17 the west wing, 18-19 the basement.
  'key-personnel'(O, G) {
    const H = G.hunters, W = G.world, { X, Z } = O;
    O.lockExit = true;
    H.forEach((h, k) => O.arm(h, [6, 7, 13, 14, 15, 18, 19].includes(k) ? 'rifle' : 'revolver'));
    const L = H[12];
    if (L) { O.reskin(L, { mask: null, weapon: null, skin: [0.62, 0.45, 0.35], bulk: 1.2, stubble: true, top: [0.06, 0.06, 0.06], legs: [0.06, 0.06, 0.07], legsMap: 'fleece', boots: [0.04, 0.04, 0.04], gloves: [0.04, 0.04, 0.04], gear: [{ t: 'vest', col: [0.05, 0.05, 0.05] }, { t: 'print', side: 'back', text: 'CERBERUS', fg: '#a83020', w: 0.26, y: 0.04 }, { t: 'thighPouch' }] }); O.arm(L, 'revolver'); L.hp = 220; L.noExec = true; }
    const lift = O.gateCol(56, 70, 74, () => 'chain');
    let motor = false, key = false, keyMesh = null;
    const st = () => O.set(!motor ? 'Reach the basement in the west wing and turn Starkweather\'s ELEVATOR on' : !key ? 'Find the LEADER of the Cerberus team and acquire the ELEVATOR KEY' : 'Use the ELEVATOR to reach Starkweather');
    O.set('Reach the basement in the west wing and turn Starkweather\'s ELEVATOR on', 'dir_kp_intro');
    const ready = () => { if (motor && key) { for (const g of lift) g.unlock(); W.openGate(); G.director.gate = true; O.lockExit = false; G.sound.say('dir_kp_lift'); } st(); };
    O.spots.push({ at: O.cell(10, 11), at3: new V(X(8.4), -3.6 + 1.3, Z(10)), r: 2.6, reach: 0.8, label: 'E — start the elevator motor', live: () => !motor,
      act: () => { motor = true; G.sound.buzz?.(O.cell(8, 10)); G.noise?.(O.cell(8, 10), 14, 'player'); G.sound.say(key ? 'dir_kp_motor' : 'dir_kp_motor'); ready(); } });
    // smashing the surveillance monitors blinds the cameras
    O.spots.push({ at: O.cell(62, 6), r: 2.4, reach: 0.8, label: 'E — smash the monitors', live: () => !O.blind,
      act: () => { O.blind = true; G.sound.bang?.(O.cell(62, 4)); for (const c of G.director.cams) { c.alive = false; c.led.visible = false; } G.sound.say('dir_kp_blind'); } });
    O.spots.push({ at: new V(), r: 2, reach: 0.7, label: 'E — take the ELEVATOR KEY', live: () => keyMesh?.visible,
      act: () => { keyMesh.visible = false; key = true; ready(); } });
    const keySpot = O.spots[O.spots.length - 1];
    O.tick = () => {
      if (L && !L.alive && !keyMesh) { keyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.16), new THREE.MeshStandardMaterial({ color: 0xc8a848, metalness: 0.9, roughness: 0.3, emissive: 0x3a2a08 })); keyMesh.position.copy(L.pos).setY(W.heightAt(L.pos.x, L.pos.z) + 0.03); O.mesh(keyMesh); keySpot.at = keyMesh.position; keySpot.at3 = keyMesh.position; G.sound.say('dir_kp_leader'); }
    };
  },
  // Border Patrol. Hunters: 0 the merc who comes to check the garage, 1-4 the front yard (4 faces the padlocked gate),
  // 5-6 the lawn, 7-8 the fountain, 9-11 the crucifix field, 12-14 the maze, 15-16 the top of the stairs,
  // 17-19 the courtyard, 20-21 snipers on the mansion balconies.
  'border'(O, G) {
    const H = G.hunters, W = G.world, { X, Z } = O;
    O.lockExit = true;
    H.forEach((h, k) => O.arm(h, [4, 5, 6, 7, 8, 12, 13, 14].includes(k) ? 'shotgun' : k <= 3 ? 'revolver' : 'rifle'));
    O.hold(H[0]);
    const door = O.gateRow(86, 185, 194, () => 'chain'), padlock = O.gateCol(149, 63, 70, () => 'chain');
    O.set('You must find the side entrance to the mansion cellar', 'dir_bp_intro');
    O.spots.push({ at: O.cell(194, 88.5), at3: new V(X(194), 1.3, Z(87.6)), r: 2.2, reach: 0.8, label: 'E — press the gate button', live: () => !door[0]?.open,
      act: () => { for (const g of door) g.unlock(); G.sound.buzz?.(O.cell(194, 87)); O.wake(H[0], O.cell(190, 80), false); H[0]?.investigate?.(O.cell(190, 92)); } });
    O.spots.push({ at: O.cell(147, 66.5), r: 2.4, reach: 0.8, label: 'E — break the padlock', live: () => !padlock[0]?.open,
      act: () => { for (const g of padlock) g.unlock(); G.sound.bang?.(O.cell(149, 66)); G.noise?.(O.cell(149, 66), 12, 'player'); } });
    let said = {}, sawT = 20;
    const once = (k, line) => { if (!said[k]) { said[k] = 1; G.sound.say(line); } };
    O.tick = (dt) => {
      if (O.inCells(70, 119, 38, 70)) once('garden', 'cb_orders');
      if (O.inCells(20, 160, 12, 25) && O.lockExit) { W.openGate(); G.director.gate = true; O.lockExit = false; O.set('Get into the cellar through the side entrance'); once('yard', 'dir_bp_yard'); }
      // somewhere in the grounds, Piggsy's chainsaw
      sawT -= dt; if (sawT < 0) { sawT = 25 + Math.random() * 30; const far = O.cell(...[[40, 80], [130, 40], [150, 20], [60, 40]][Math.floor(Math.random() * 4)]).setY(1); const saw = G.sound.sawLoop?.(); if (saw) { saw(far, 1); setTimeout(() => saw(null, 0, true), 2500); } G.sound.say('piggsy_2', { at: far }); }
    };
  },
  // Trained to Kill. Hunters: 0-5 the stairs, parking and station cops, 6 SWAT on platform 1, 7-14 yard 1 (revolvers),
  // 15-22 yard 2 (shotguns), 23-28 yard 3 (SWAT). The only way into yard 3 is over the blue train's roof.
  'trained'(O, G) {
    const H = G.hunters, W = G.world, { X, Z } = O;
    O.lockExit = true;
    for (const k of [6, 23, 24, 25, 26, 27, 28]) { const sw = GANG_SETS.swat.members[k % 3]; O.reskin(H[k], { ...sw, skin: [0.6, 0.44, 0.34], weapon: null }); O.arm(H[k], 'rifle'); }
    H.forEach((h, k) => { if (k <= 5 || (k >= 7 && k <= 14)) O.arm(h, 'revolver'); else if (k >= 15 && k <= 22) O.arm(h, 'shotgun'); });
    const yardGate = O.gateCol(111, 59, 65, () => 'chain'), endGate = O.gateCol(2, 19, 25, () => 'chain');
    O.set('Make your way to the end of the Trainyard', 'dir_tk_intro');
    O.spots.push({ at: O.cell(109, 62), r: 2.2, reach: 0.8, label: 'E — break the lock on the yard gate', live: () => !yardGate[0]?.open,
      act: () => { for (const g of yardGate) g.unlock(); G.sound.bang?.(O.cell(111, 62)); G.noise?.(O.cell(111, 62), 12, 'player'); G.sound.say('dir_tk_yard'); } });
    O.spots.push({ at: O.cell(4, 22), r: 2.4, reach: 0.8, label: 'E — pry the lock off the last gate', live: () => !endGate[0]?.open,
      act: () => { for (const g of endGate) g.unlock(); G.sound.bang?.(O.cell(2, 22)); W.openGate(); G.director.gate = true; O.lockExit = false; O.set('Go through the gate', 'dir_tk_gate'); } });
    let said = false;
    O.tick = () => { if (!said && O.inCells(92, 140, 19, 25) && G.player.pos.y > 2) { said = true; G.sound.say('dir_tk_roof'); } };
  },
  // Wrong Side of the Tracks. Hunters: 0-1 platform cops, 2 the hallway gunman, 3-5 Bravo team in the tunnels, 6-7 the
  // team down the stairs behind Cash, 8-12 SWAT in the control building, 13-15 waiting at the train, 16-26 Carcer Point.
  'tracks'(O, G) {
    const H = G.hunters, W = G.world, { X, Z } = O;
    O.lockExit = true;
    const arm = (h, kind) => { if (!h) return; h.gun = true; h.dropOnDeath = kind === 'revolver' ? 'revolver' : 'rifle'; const b = h.body; if (b.weapon) b.weapon.parent?.remove(b.weapon); b.weapon = makeHunterWeapon(kind); b.weapon.position.set(0, -0.1, 0.02); b.bones[10]?.add(b.weapon); };
    H.forEach((h, k) => arm(h, [3, 4, 5, 13, 14, 15, 19, 20, 26].includes(k) ? 'shotgun' : [0, 1, 16, 17, 18, 21, 22, 23, 24, 25].includes(k) ? 'revolver' : 'rifle'));
    for (const k of [3, 4, 5, 6, 7, 13, 14, 15, 18, 21, 22, 23, 24, 25]) O.hold(H[k]);
    const rusty = O.gateCol(127, 5, 11, () => 'chain'), side = O.gateRow(22, 69, 73, () => 'chain'), ctrl = O.gateRow(12, 67, 70, () => 'chain'), barrier = O.gateCol(57, 59, 67, () => 'scrap');
    let phase = 0, clock = 120, boarded = false;
    const dead = (ks) => ks.every((k) => !H[k]?.alive);
    O.set('Restore power to the rails so that the last train can leave the station', 'dir_ws_intro');
    O.spots.push({ at: O.cell(129, 8), r: 2.2, reach: 0.8, label: 'E — smash the rusty lock', live: () => !rusty[0]?.open,
      act: () => { for (const g of rusty) g.unlock(); G.sound.bang?.(O.cell(127, 8)); G.noise?.(O.cell(127, 8), 14, 'player'); [3, 4, 5].forEach((k) => O.wake(H[k], null, false)); [6, 7].forEach((k) => O.wake(H[k], null, false)); G.sound.say('sw_regroup'); } });
    O.spots.push({ at: O.cell(71, 24.5), r: 2.2, reach: 0.8, label: 'E — smash the rusty lock', live: () => !side[0]?.open, act: () => { for (const g of side) g.unlock(); G.sound.bang?.(O.cell(71, 23)); G.noise?.(O.cell(71, 23), 14, 'player'); } });
    O.spots.push({ at: O.cell(66, 6), at3: new V(X(66), 1.2, Z(4.6)), r: 2.4, reach: 0.8, label: 'E — restore the third rail', live: () => phase === 1,
      act: () => { phase = 2; G.sound.buzz?.(O.cell(66, 5)); [13, 14, 15].forEach((k) => O.wake(H[k], null, false)); G.sound.say('dir_ws_power'); } });
    O.spots.push({ at: O.cell(178, 33), at3: new V(X(178), 1.4, Z(36.5)), r: 2.6, reach: 1.2, label: 'E — board the last train', live: () => phase === 2,
      act: () => { phase = 3; boarded = true; G.hud?.fadeTo(1); G.sound.say('dir_ws_train');
        setTimeout(() => { G.teleport?.(X(53.5), Z(71.5), -Math.PI / 2); G.hud?.fadeTo(0); O.set('Find a way out of this subway station'); W.openGate(); G.director.gate = true; O.lockExit = false; }, 1800); } });
    O.tick = (dt) => {
      if (phase === 0 && dead([8, 9, 10, 11, 12])) { phase = 1; for (const g of ctrl) g.unlock(); O.set('Get into the control room and restore the power'); }
      if (phase === 2) { clock -= dt; O.text = `Get onto the last train before the police order its departure  ${Math.floor(clock / 60)}:${String(Math.floor(clock % 60)).padStart(2, '0')}`;
        if (clock <= 0) { phase = 9; O.set('The last train has gone'); G.sound.say('dir_ws_missed'); setTimeout(() => G.player.hurt?.(999, null), 3500); } }
      if (phase === 3 && boarded) {
        if (H[18]?.dormant && G.player.pos.distanceTo(O.cell(47, 80)) < 6) O.wake(H[18], null, true);
        if (H[21]?.dormant && O.inCells(2, 58, 2, 35)) { [21, 22, 23].forEach((k) => O.wake(H[k], null, true)); G.sound.say('cp_code1'); }
        if (!H[21]?.dormant && H[24]?.dormant && dead([21, 22, 23])) [24, 25].forEach((k) => O.wake(H[k], null, true));
      }
    };
  },
  // Press Coverage. Hunters: 0-1 the tunnel cops, 2-7 the street round her building, 8-14 inside her apartment,
  // 15-16 the alley, 17-19 the casino, 20 the balcony sniper, 21-25 the vans, 26-28 the subway, 29 Tyson Tires' roof.
  'press'(O, G) {
    const H = G.hunters, W = G.world, { X, Z } = O;
    O.lockExit = true;
    const arm = (h, kind) => { if (!h) return; h.gun = true; h.dropOnDeath = kind === 'revolver' ? 'revolver' : 'rifle'; const b = h.body; if (b.weapon) b.weapon.parent?.remove(b.weapon); b.weapon = makeHunterWeapon(kind); b.weapon.position.set(0, -0.1, 0.02); b.bones[10]?.add(b.weapon); };
    H.forEach((h, k) => { if (k < 2 || k === 2) return; arm(h, [8, 10, 16, 21, 23, 26, 27, 28].includes(k) ? 'shotgun' : [20, 29].includes(k) ? 'shotgun' : 'revolver'); });
    for (const k of [20, 29]) if (H[k]) { H[k].sniper = true; H[k].hp = 80; }
    const barricade = O.gateRow(39, 100, 147, () => 'fence');
    const front = O.gateCol(99, 69, 74, () => 'chain'), panel = O.gateCol(65, 55, 60, () => 'panel'), window = O.gateCol(60, 49, 54, () => 'chain');
    const jo = O.companion(O.cell(190, 103), { top: [0.72, 0.66, 0.58], legs: [0.12, 0.12, 0.14], skin: [0.66, 0.5, 0.4], hair: [0.32, 0.18, 0.08], bulk: 0.86, dirt: 0.3, stains: 0.1, gear: [] }, 'Journalist', ['jo_follow', 'jo_wait']);
    jo.free = true; jo.follow = true;
    jo.onDie = () => { G.sound.say('dir_pc_dead'); O.set('The Journalist is dead'); setTimeout(() => G.player.hurt?.(999, null), 5000); };
    let phase = 0, wait = 0;
    const alive = (ks) => ks.some((k) => H[k]?.alive);
    const st = (t) => O.set(t + (jo.alive && phase < 3 ? `  ·  JOURNALIST ${Math.max(0, Math.round(jo.hp))}%` : ''));
    O.set('Take the Journalist to her apartment and recover the dossier', 'dir_pc_intro');
    O.tick = (dt) => {
      if (!jo.alive) return;
      const spotted = H.some((h) => h.alive && !h.dormant && h.aware?.());
      if (phase === 0) { st('Take the Journalist to her apartment and recover the dossier');
        if (jo.pos.distanceTo(O.cell(100, 71.5)) < 4.5 && !alive([2, 3, 4, 5, 6, 7]) && !spotted) { phase = 1; for (const g of front) g.unlock(); G.sound.say('jo_door'); } }
      if (phase === 1) { st(alive([8, 9, 10, 11, 12, 13, 14]) ? 'Clear her apartment of cops' : 'Take her to the white panel in the dining room');
        if (!alive([8, 9, 10, 11, 12, 13, 14]) && jo.pos.distanceTo(O.cell(66, 57.5)) < 3.5) { phase = 2; for (const g of panel) g.unlock(); G.sound.say('jo_panel'); wait = 6; } }
      if (phase === 2) { wait -= dt; if (wait < 0) { phase = 3; jo.P.root.visible = false; jo.alive = false; jo.follow = false; jo.free = false; for (const g of window) g.unlock(); W.openGate(); G.director.gate = true; O.lockExit = false; G.sound.say('dir_pc_window'); O.set('Break out of the perimeter created by the Police and reach the SUBWAY'); } }
    };
  },
  // Divided They Fall. Hunters: 0-2 the machete stalkers in the courtyard, 3-5 the shotgun team that comes out of
  // the block, 6-15 the floors (F1 6-7, F2 8-9, F3 10-11, F4 12-14, F5 15), 16 Ramirez, 17-19 cover his escape,
  // 20-21 the snipers who come through the gate if he gets his call off.
  'divided'(O, G) {
    const H = G.hunters, W = G.world, { X, Z } = O;
    O.lockExit = true;
    const arm = (h, kind) => { if (!h) return; h.gun = true; h.dropOnDeath = kind === 'revolver' ? 'revolver' : 'rifle'; const b = h.body; if (b.weapon) b.weapon.parent?.remove(b.weapon); b.weapon = makeHunterWeapon(kind); b.weapon.position.set(0, -0.1, 0.02); b.bones[10]?.add(b.weapon); };
    for (const k of [3, 4, 5, 6, 7, 8, 9, 10, 14, 15, 17, 18, 19, 20, 21]) arm(H[k], 'shotgun');
    for (const k of [3, 4, 5, 17, 18, 19, 20, 21]) O.hold(H[k]);
    const door = O.gateCol(70, 84, 92, () => 'chain');
    // Ramirez: the Wardogs' boss. Shaved head, beret, black vest over a tan tee, camo trousers; nobody executes him
    const R = H[16];
    if (R) {
      G.scene.remove(R.body.root); R.torch = null; R.beam = null;
      const P = new Person({ mask: null, weapon: null, skin: [0.55, 0.38, 0.27], bulk: 1.22, stubble: true, top: [0.55, 0.47, 0.34], sleeves: 'short', legs: [0.9, 0.9, 0.9], legsMap: 'camoUrban', boots: [0.08, 0.08, 0.07], gloves: [0.06, 0.06, 0.05], dirt: 0.6, stains: 0.3, seed: 316,
        gear: [{ t: 'vest', col: [0.06, 0.06, 0.05] }, { t: 'cap', col: [0.12, 0.05, 0.04] }, { t: 'bandolier' }, { t: 'thighPouch' }] });
      R.body = P; G.scene.add(P.root); P.weapon = makeHunterWeapon('shotgun'); P.weapon.position.set(0, -0.1, 0.02); P.bones[10]?.add(P.weapon);
      R.gun = true; R.noExec = true; R.hp = 260; R.dropOnDeath = 'rifle'; R.place();
    }
    let phase = 0, clock = 150, backup = false;
    const dead = (ks) => ks.every((k) => !H[k]?.alive);
    const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    O.set('Dispose of the three stalking hunters', 'dir_df_intro');
    O.tick = (dt) => {
      if (phase === 0 && dead([0, 1, 2])) { phase = 1; for (const g of door) g.unlock(); [3, 4, 5].forEach((k, n) => O.wake(H[k], O.cell(78 + n * 4, 88), true)); G.sound.say('rz_shotguns'); O.set('Get into the old apartment block and track down Ramirez', 'dir_df_block'); }
      // he sees Cash come up onto the top floor and runs for it
      if (phase === 1 && R?.alive && O.inCells(74, 171, 4, 19)) { phase = 2; R.flee = { goal: O.cell(78, 16), speed: 3.6, taunt: () => G.sound.say('rz_run') }; R.legs = [[78, 34], [162, 34], [162, 52], [78, 52], [78, 70], [162, 70], [162, 88], [68, 88], [40, 92]].map(([i, j]) => O.cell(i, j)); [17, 18, 19].forEach((k) => O.wake(H[k], null, false)); G.sound.say('dir_df_run'); }
      if (phase === 2 || phase === 3) {
        if (R && R.flee && R.pos.distanceTo(R.flee.goal) < 1.6 && R.legs.length) { R.flee.goal = R.legs.shift(); R.pathT = 0; } // down the block a flight at a time
        else if (R && R.flee && !R.legs.length && R.pos.distanceTo(R.flee.goal) < 2) { R.flee = null; R.state = 'hunt'; R.susp = 1.4; R.last.copy(G.player.pos); }
        if (!backup) { clock -= dt; O.text = `Kill Ramirez before he calls in back up  ${mmss(Math.max(0, clock))}`; if (clock <= 0) { backup = true; phase = 3; O.wake(H[20], O.cell(30, 100)); O.wake(H[21], O.cell(34, 100)); O.set('Kill Ramirez', 'dir_df_backup'); } }
        if (R && !R.alive) { phase = 4; W.openGate(); G.director.gate = true; O.lockExit = false; O.set('Make your way to the gate', 'dir_df_done'); }
      }
    };
  },
  // Kill the Rabbit. Hunters: 0-3 in the cellblock's cells (let out when the gate slams), 4-6 the showers,
  // 7 walks the back corridor, 8-12 the back rooms and the control room (all armed), 13-17 death row
  // (17 the one in the pink dress), 18-19 the yard, 20 the White Rabbit himself, who carries the key.
  'rabbit'(O, G) {
    const H = G.hunters, W = G.world, { X, Z } = O;
    O.lockExit = true;
    const arm = (h, kind) => { if (!h) return; h.gun = true; h.dropOnDeath = kind === 'shotgun' ? 'rifle' : 'revolver'; const b = h.body; if (b.weapon) b.weapon.parent?.remove(b.weapon); b.weapon = makeHunterWeapon(kind); b.weapon.position.set(0, -0.1, 0.02); b.bones[10]?.add(b.weapon); };
    [7, 8, 9, 10, 11, 12].forEach((k, n) => arm(H[k], n % 2 ? 'shotgun' : 'revolver'));
    for (const k of [0, 1, 2, 3, 13, 14, 15, 16, 17]) O.hold(H[k]);
    const pink = H[17]; if (pink) { const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.32, 0.6, 18, 2, true), new THREE.MeshStandardMaterial({ color: 0xd88aa8, roughness: 0.85, side: THREE.DoubleSide })); sk.position.y = -0.27; pink.body.bones[0].add(sk); }
    // the White Rabbit: a filthy rabbit suit over a man, the key on a string round his neck
    const R = H[20];
    if (R) {
      G.scene.remove(R.body.root); R.torch = null; R.beam = null;
      const P = new Person({ mask: null, weapon: null, top: [0.8, 0.78, 0.74], legs: [0.78, 0.76, 0.72], skin: [0.6, 0.44, 0.34], hood: false, dirt: 1, stains: 0.9, seed: 77 });
      const fur = new THREE.MeshStandardMaterial({ color: 0xd2cec4, roughness: 1 }), pinkM = new THREE.MeshStandardMaterial({ color: 0xc89a9a, roughness: 1 }), eyeM = new THREE.MeshBasicMaterial({ color: 0x080808 });
      const hd = P.bones[4]; const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), fur); head.position.set(0, 0.11, 0.01); hd.add(head);
      for (const sd of [1, -1]) { const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.26, 4, 8), fur); ear.position.set(0.065 * sd, 0.4, -0.01); ear.rotation.z = -0.2 * sd; hd.add(ear); const inr = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.2, 3, 6), pinkM); inr.position.set(0.065 * sd, 0.4, 0.02); inr.rotation.z = -0.2 * sd; hd.add(inr);
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), eyeM); e.position.set(0.055 * sd, 0.15, 0.145); hd.add(e); }
      const teeth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.01), new THREE.MeshStandardMaterial({ color: 0xe8e0c8 })); teeth.position.set(0, 0.06, 0.158); hd.add(teeth);
      const key = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.09, 0.01), new THREE.MeshStandardMaterial({ color: 0xc8a848, metalness: 0.9, roughness: 0.3 })); key.position.set(0, -0.25, 0.17); hd.add(key);
      R.body = P; G.scene.add(P.root); R.hp = 70; R.place();
      const taunts = ['rb_taunt_1', 'rb_taunt_2', 'rb_taunt_3']; let tn = 0;
      R.flee = { goal: O.cell(166, 39), speed: 0, taunt: () => G.sound.say(taunts[tn++ % 3]) };
    }
    let phase = 0, cellGate = null, shotT = 0, keyMesh = null;
    const stairs = O.gateRow(84, 84, 91, () => 'chain'), shop = O.gateCol(63, 64, 71, () => 'chain'), sensor = O.gateRow(47, 49, 55, () => 'chain');
    const yardRun = [[12, 12], [90, 10], [92, 42], [12, 42], [30, 26], [72, 28], [40, 12], [62, 42]].map(([i, j]) => O.cell(i, j));
    O.set('Follow the rabbit by exiting the Cellblock', 'dir_kr_intro');
    // the locker room switch reopens the cellblock gate
    O.spots.push({ at: O.cell(170, 80), at3: new V(X(170), 1.3, Z(81.4)), r: 2.4, reach: 0.7, label: 'E — throw the gate switch', live: () => phase === 1,
      act: () => { phase = 2; G.sound.buzz?.(O.cell(170, 81)); for (const g of cellGate || []) g.unlock(); O.set('Kill the patrolling hunter and get up to the Control Room', 'dir_kr_gate'); } });
    // the sensor lock on the workshop's yard door
    O.spots.push({ at: O.cell(51.5, 51), at3: new V(X(51.5), 1.3, Z(50)), r: 2.6, reach: 0.8, label: 'E — trip the sensor lock', live: () => phase === 5,
      act: () => { phase = 6; G.sound.buzz?.(O.cell(51.5, 49)); for (const g of sensor) g.unlock(); if (R) { O.wake(R, O.cell(52, 38), false); R.flee.goal = yardRun[0]; R.flee.speed = 3.2; } for (const k of [18, 19]) H[k]?.investigate?.(O.cell(52, 40)); O.set('Kill the White Rabbit to get the KEY to the prison gates', 'dir_kr_chase'); } });
    O.spots.push({ at: new V(), r: 2, reach: 0.7, label: 'E — take the key', live: () => phase === 7 && keyMesh?.visible,
      act: () => { keyMesh.visible = false; phase = 8; W.openGate(); G.director.gate = true; O.lockExit = false; O.set('Get to the gates and exit the prison', 'dir_kr_out'); } });
    const keySpot = O.spots[O.spots.length - 1];
    let chase = 0;
    O.tick = (dt) => {
      // the rabbit runs out of the cellblock; once he's through, the gate slams and the cells open
      if (phase === 0 && R) {
        const d = R.pos.distanceTo(G.player.pos); if (!R.flee.speed && d < 9) { R.flee.goal = O.cell(115, 39); R.flee.speed = 3.0; }
        if (R.flee.speed && R.pos.x < X(117)) { O.hold(R); cellGate = O.gateCol(119, 36, 42, () => 'chain'); W.bakeWalk(); G.sound.rattle?.(O.cell(119, 39)); for (const k of [0, 1, 2, 3]) O.wake(H[k], null, false);
          phase = 1; O.set('The gate is locked. Find the switch in the locker room past the showers', 'dir_kr_locked'); }
      }
      if (phase === 2 && !H[7]?.alive && O.inCells(79, 98, 85, 97)) { phase = 3; for (const g of stairs) g.unlock(); for (const k of [13, 14, 15, 16, 17]) O.wake(H[k], null, true); O.set('Kill all the Death Row hunters', 'dir_kr_control'); }
      if (phase === 3 && [13, 14, 15, 16, 17].every((k) => !H[k]?.alive)) { phase = 4; for (const g of shop) g.unlock(); O.set('Get to the Workshop any way you can', 'dir_kr_row'); }
      if (phase === 4 && O.inCells(39, 62, 50, 83)) { phase = 5; O.set('Activate the sensor lock and chase that rabbit', 'dir_kr_shop'); }
      if (phase === 6 && R) {
        // run him round the yard: always for the corner farthest from Cash, tiring as the chase goes on
        chase += dt; const me = G.player.pos, d = R.pos.distanceTo(me);
        R.flee.speed = d < 14 ? Math.max(2.4, 3.4 - chase * 0.012) : 1.6;
        shotT -= dt; if (shotT < 0 && (R.pos.distanceTo(R.flee.goal) < 1.5 || d < 7)) { shotT = 1.2;
          let best = R.flee.goal, bs = -1; for (const p of yardRun) { const s2 = p.distanceTo(me) - 0.5 * p.distanceTo(R.pos); if (s2 > bs) { bs = s2; best = p; } } R.flee.goal = best; }
        if (!R.alive) { phase = 7; keyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.16), new THREE.MeshStandardMaterial({ color: 0xc8a848, metalness: 0.9, roughness: 0.3, emissive: 0x3a2a08 })); keyMesh.position.copy(R.pos).setY(W.heightAt(R.pos.x, R.pos.z) + 0.03); O.mesh(keyMesh); keySpot.at = keyMesh.position; keySpot.at3 = keyMesh.position; O.set('Take the KEY from the rabbit', 'dir_kr_key'); }
      }
    };
  },
  // Mouth of Madness. Hunters: 0 the ward guard, 1-3 the park (3 has a revolver), 4-6 the greenhouses,
  // 7 hides in the greenhouses, 8 and 10 guard the grounds, 9 the Smiley in the dress.
  'madness'(O, G) {
    const H = G.hunters, W = G.world, { X, Z } = O;
    O.lockExit = true;
    const mesh = O.gateCol(23, 70, 96, () => 'chain'), green = O.gateCol(129, 28, 84, () => 'chain'), bricks = O.gateRow(33, 96, 202, () => 'scrap');
    O.hold(H[7]);
    if (H[3]) { H[3].gun = true; H[3].dropOnDeath = 'revolver'; const b = H[3].body; if (b.weapon) b.weapon.parent?.remove(b.weapon); b.weapon = makeHunterWeapon('revolver'); b.weapon.position.set(0, -0.1, 0.02); b.bones[10]?.add(b.weapon); }
    const dress = H[9]; if (dress) { const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.3, 0.55, 18, 2, true), new THREE.MeshStandardMaterial({ color: 0x8a5a7a, roughness: 0.9, side: THREE.DoubleSide })); sk.position.y = -0.25; dress.body.bones[0].add(sk); }
    const box = (i, j, y, col, w, h, d) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 })); m.position.set(X(i), y, Z(j)); O.mesh(m); return m; };
    box(12, 80, 0.6, 0x3a2a1a, 0.8, 1.2, 0.8); box(12, 80.6, 1.5, 0x3a2a1a, 0.8, 0.8, 0.12); // the electric chair
    const can = box(186, 60, 0.25, 0xa81c14, 0.34, 0.45, 0.18);
    let phase = 0, carrying = false, head = null, headHeld = false;
    O.set('Kill the hunter and escape from the ward', 'dir_mm_intro');
    O.spots.push({ at: O.cell(9, 75), r: 2, reach: 0.7, label: 'E — throw the switch on the chair', live: () => phase === 0,
      act: () => { phase = 1; G.sound.buzz?.(O.cell(12, 80)); G.sound.painScream?.(new V(X(12), 1.2, Z(80))); for (const g of mesh) g.unlock(); H[0]?.investigate?.(O.cell(12, 80)); if (H[0]) H[0].susp = 0.5; } });
    O.spots.push({ at: O.cell(186, 61.5), r: 2, reach: 0.6, label: 'E — pick up the gasoline', live: () => phase >= 2 && !carrying && can.visible, act: () => { carrying = true; can.visible = false; O.set('Destroy the bricked up doorway to gain access to the tower'); } });
    const brick = bricks.reduce((a, b) => (b.len > (a?.len || 0) ? b : a), null); // the gasoline goes at the widest bricked gap; the blast opens them all
    O.spots.push({ at: brick ? brick.at : new V(), r: 3, reach: 0.9, label: 'E — leave the gasoline and light it', live: () => carrying && brick && !brick.open,
      act: () => { carrying = false; const c2 = box(0, 0, 0.25, 0xa81c14, 0.34, 0.45, 0.18); c2.position.set(brick.at.x, 0.25, brick.at.z + 0.6); O.set('Get clear'); setTimeout(() => { c2.visible = false; G.sound.bang?.(brick.at); G.flash?.(brick.at.clone().setY(1)); G.noise?.(brick.at, 30, 'player'); for (const g of bricks) g.unlock(); if (G.player.pos.distanceTo(brick.at) < 3.5) G.player.hurt?.(40, null); phase = 4; O.set('Kill the Smiley in the dress', 'dir_mm_bricks'); }, 3500); } });
    O.spots.push({ at: O.cell(40, 77), r: 2.6, reach: 0.8, label: 'E — leave his head in the guard room', live: () => headHeld,
      act: () => { headHeld = false; phase = 7; W.openGate(); G.director.gate = true; O.lockExit = false; O.set('Go through the open door', 'dir_mm_done'); } });
    O.spots.push({ at: new V(), at3: null, r: 2, reach: 0.7, label: 'E — take his head', live: () => phase === 5 && head && head.visible, act: () => { head.visible = false; headHeld = true; phase = 6; O.set('Bring proof of the dress-wearing hunter\'s death to the Guard Room', 'dir_mm_head'); } });
    const headSpot = O.spots[O.spots.length - 1];
    O.tick = () => {
      if (phase === 1 && H[0] && !H[0].alive) { phase = 2; O.set('Gain access to the Greenhouse section', 'dir_mm_ward'); }
      if (phase === 2 && [1, 2, 3].every((k) => !H[k] || !H[k].alive)) { phase = 3; for (const g of green) g.unlock(); O.set('Find a way into the tower', 'dir_mm_green'); }
      if (phase === 3 && G.player.pos.distanceTo(O.cell(160, 60)) < 14 && H[7]?.dormant) O.wake(H[7], O.cell(190, 70));
      if (phase >= 4 && phase < 5 && dress && !dress.alive) { phase = 5; head = box(0, 0, 0.15, 0x9a7a5a, 0.22, 0.25, 0.22); head.position.copy(dress.pos).setY(0.15); headSpot.at = head.position; O.set('Take his head', 'dir_mm_dead'); }
    };
  },
  // Graveyard Shift: a lever in the guard hut opens the loading bay (and lets four Innocentz in); the lift needs
  // the failsafe in the basement; up top, the control room button opens the main doors.
  'graveyard'(O, G) {
    const H = G.hunters, W = G.world, { X, Z } = O;
    O.lockExit = true;
    const bay = O.fenceLine('row', 165, 20, 215), lift = O.fenceLine('row', 93, 20, 215);
    for (const k of [3, 4, 5]) O.hold(H[k]);
    H.forEach((h, k) => { if (!h || k < 7) return; h.gun = true; h.dropOnDeath = 'revolver'; const b = h.body; if (b.weapon) b.weapon.parent?.remove(b.weapon); b.weapon = makeHunterWeapon('revolver'); b.weapon.position.set(0, -0.1, 0.02); b.bones[10]?.add(b.weapon); });
    let phase = 0;
    O.set('Find a way into the factory complex', 'dir_gs_intro');
    O.spots.push({ at: O.cell(100, 190), at3: new V(X(100.9), 1.3, Z(184.7)), r: 2.6, reach: 0.7, label: 'E — pull the lever', live: () => phase <= 1,
      act: () => { phase = 2; for (const g of bay) g.unlock(); G.sound.buzz?.(O.cell(100, 186)); for (const k of [3, 4, 5]) O.wake(H[k], O.cell(90 + (k - 3) * 10, 172)); O.set('Get into the loading bay and find the lift', 'dir_gs_bay'); } });
    O.spots.push({ at: O.cell(82, 135), r: 2.4, reach: 0.7, label: 'E — reset the failsafe', live: () => phase === 3, act: () => { phase = 4; G.sound.buzz?.(O.cell(68, 124)); O.set('Get back to the lift', 'dir_gs_power'); } });
    O.spots.push({ at: O.cell(112, 97), r: 2.6, reach: 0.8, label: 'E — call the lift', live: () => phase === 2 || phase === 4,
      act: () => { if (phase === 2) { phase = 3; G.sound.click?.(); O.set('The lift is out of action. Deactivate the failsafe to power it up again', 'dir_gs_lift'); return; }
        phase = 5; G.sound.buzz?.(O.cell(112, 96)); for (const g of lift) g.unlock(); O.set('Get to the reception area and exit the factory any way you can', 'dir_gs_up'); } });
    O.spots.push({ at: O.cell(100, 60), r: 2.6, reach: 0.8, label: 'E — press the door release', live: () => phase === 5 || phase === 6,
      act: () => { phase = 7; G.sound.buzz?.(O.cell(100, 60)); W.openGate(); G.director.gate = true; O.lockExit = false; O.set('Get out through the main doors', 'dir_gs_doors'); } });
    O.tick = () => { if (phase === 0 && G.player.pos.distanceTo(O.cell(100, 186)) < 18) { phase = 1; O.set('Use the lever in the guard hut to open the loading bay gates', 'dir_gs_hut'); }
      if (phase === 5 && O.inCells(0, 233, 40, 90)) { phase = 6; O.set('The main doors are locked from the control room. Find the door release'); } };
  },
  // Drunk Driving: the Director gives Cash "a friend", a tramp locked up and guarded by a Babyface. The tramp is
  // the key: every gate on the way to the graveyard opens only when he reaches it. Keep him alive.
  'drunk-driving'(O, G) {
    const H = G.hunters, W = G.world;
    O.lockExit = true;
    const g1 = O.fenceLine('col', 40, 85, 112), g2 = O.fenceLine('row', 116, 40, 160);
    const tramp = O.companion(O.cell(10, 62), { top: [0.16, 0.24, 0.1], legs: [0.24, 0.2, 0.14], skin: [0.62, 0.44, 0.34], stubble: true, hair: [0.42, 0.12, 0.04], gear: [{ t: 'cap', col: [0.08, 0.12, 0.3] }] });
    tramp.free = false;
    const near = (gs) => gs.length && gs.some((g) => !g.open && g.at.distanceTo(tramp.pos) < 4.5);
    let phase = 0;
    const st = () => O.set((phase === 0 ? 'Rescue the tramp from his cell' : phase < 3 ? 'Take the tramp past the streets to the graveyard' : phase === 3 ? 'Take the tramp to the old tomb' : 'Go through the gate') + (tramp.alive && phase > 0 ? `  ·  TRAMP ${Math.max(0, Math.round(tramp.hp))}%` : ''));
    O.set('Rescue the tramp from his cell', 'dir_dd_intro');
    tramp.onDie = () => { G.sound.say('dir_dd_dead'); O.set('The tramp is dead'); setTimeout(() => G.player.hurt?.(999, null), 5000); };
    let t = 0;
    O.tick = (dt) => {
      t += dt || 0.016;
      if (phase === 0 && H[0] && !H[0].alive) { phase = 1; tramp.free = true; tramp.follow = true; G.sound.buzz?.(tramp.pos); G.sound.say('dir_dd_free'); }
      if (phase === 1 && near(g1)) { phase = 2; for (const g of g1) g.unlock(); G.sound.say('dir_dd_gate'); }
      if (phase === 2 && near(g2)) { phase = 3; for (const g of g2) g.unlock(); G.sound.say('dir_dd_yard'); }
      if (phase === 3 && W.gate && tramp.pos.distanceTo(W.gate.position) < 8.5) { phase = 4; W.openGate(); G.director.gate = true; O.lockExit = false; G.sound.say('dir_dd_tomb'); }
      if (Math.floor(t * 2) !== Math.floor((t - (dt || 0.016)) * 2)) st();
    };
  },
  // View of Innocence. The Innocentz carry revolvers here. Get a gun in the laundromat; find the tape (record
  // store, third floor) and the camera (toy store, second floor); the bar TV has no power until the switch in
  // the basement is thrown; play the tape. Hunter 11 hides in the bar toilets.
  'innocence'(O, G) {
    const H = G.hunters, W = G.world, { X, Z } = O;
    O.lockExit = true;
    H.forEach((h, k) => { if (!h) return; h.gun = true; if (k % 2 === 0) h.dropOnDeath = 'revolver'; const b = h.body; if (b.weapon) b.weapon.parent?.remove(b.weapon); b.weapon = makeHunterWeapon('revolver'); b.weapon.position.set(0, -0.1, 0.02); b.bones[10]?.add(b.weapon); });
    O.hold(H[11]);
    G.kit.spawn('revolver', new V(X(10), 0.95, Z(69)));
    const thing = (i, j, y, col, w, h, d) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 })); m.position.set(X(i), W.heightAt(X(i), Z(j)) + y, Z(j)); O.mesh(m); return m; };
    const tape = thing(91, 15.2, 1.15, 0x1a1a1a, 0.19, 0.03, 0.1), cam = thing(8, 6, 0.9, 0x2a2a2a, 0.22, 0.14, 0.3);
    const tv = thing(85, 41.6, 2.2, 0x111111, 1.1, 0.75, 0.4), screen = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.62), new THREE.MeshBasicMaterial({ color: 0x050505 })); screen.position.set(X(85), 2.2, Z(41.6) + 0.21); O.mesh(screen);
    let haveTape = false, haveCam = false, power = false, phase = 0;
    const set = () => O.set(phase === 0 ? 'Get your hands on a gun' : phase === 1 ? (haveTape ? 'Find the video camera' : haveCam ? 'Find the video tape' : 'Find the video tape and the video camera') : phase === 2 ? 'Go watch the video on the bar TV' : phase === 3 ? 'Find the power switch in the basement' : phase === 4 ? 'Go back to the bar TV' : 'Leave the mall');
    O.set('Get your hands on a gun', 'dir_vi_intro');
    O.spots.push({ at: O.cell(91, 16.5), at3: tape.position, r: 2, reach: 0.6, label: 'E — take the video tape', live: () => phase === 1 && !haveTape, act: () => { haveTape = true; tape.visible = false; G.sound.say(haveCam ? 'dir_vi_both' : 'dir_vi_tape'); if (haveCam) phase = 2; set(); } });
    O.spots.push({ at: O.cell(9, 8), at3: cam.position, r: 2, reach: 0.6, label: 'E — take the video camera', live: () => phase === 1 && !haveCam, act: () => { haveCam = true; cam.visible = false; G.sound.say(haveTape ? 'dir_vi_both' : 'dir_vi_cam'); if (haveTape) phase = 2; set(); } });
    O.spots.push({ at: O.cell(85, 44), at3: tv.position, r: 2.4, reach: 0.8, label: 'E — play the tape', live: () => phase === 2 || phase === 4,
      act: () => { if (!power) { phase = 3; G.sound.click?.(); G.sound.say('dir_vi_power'); set(); return; }
        phase = 5; screen.material.color.set(0x8aa0b0); G.vhs && (G.vhs.hot = 1); G.sound.tapeStatic?.(); G.sound.say('dir_vi_tape_play');
        setTimeout(() => { screen.material.color.set(0x050505); G.sound.glass?.(tv.position); W.openGate(); G.director.gate = true; O.lockExit = false; set(); }, 9000); } });
    O.spots.push({ at: O.cell(96, 76), at3: new V(X(97.5), -3.2 + 1.4, Z(76)), r: 2.2, reach: 0.7, label: 'E — throw the power switch', live: () => phase === 3,
      act: () => { power = true; phase = 4; G.sound.buzz?.(O.cell(96, 76)); O.wake(H[11], O.cell(94, 44)); G.sound.say('dir_vi_powered'); set(); } });
    O.tick = () => { if (phase === 0 && O.hasItem('revolver')) { phase = 1; G.sound.say('dir_vi_gun'); set(); } };
  },
  // Strapped for Cash. The Wardogs hold Cash's family as bait, four of them, each under guard: if a guard
  // spots Cash near one, that one dies. Save at least one; then the shark's mouth opens; the switch in the
  // souvenir shop opens the fire exit. Hunters: 0 guards the store room, 1-2 the pens captive, 3 the tunnels,
  // 4 the cafeteria captive, 5 the monkey dome captive, 6 and 9 patrol, 7-8 wait behind the shark's mouth.
  'strapped'(O, G) {
    const H = G.hunters, W = G.world;
    O.lockExit = true;
    const front = []; for (const [a, b] of O.runs(176, 0, 92)) { // the aquarium front across the bottom yard, the shark's mouth in it
      const mid = Math.round((a + b) / 2); front.push(O.gate(O.X(a), O.X(mid - 2), O.Z(176.2), O.Z(176.8), 'facade'), O.gate(O.X(mid + 2), O.X(b + 1), O.Z(176.2), O.Z(176.8), 'facade')); front.push(O.mouth = O.gate(O.X(mid - 2), O.X(mid + 2), O.Z(176.2), O.Z(176.8), 'chain')); }
    for (const k of [7, 8]) O.hold(H[k]);
    const looks = [{ top: [0.5, 0.12, 0.1], legs: [0.25, 0.28, 0.4] }, { top: [0.6, 0.55, 0.4], legs: [0.18, 0.18, 0.2], skin: [0.42, 0.28, 0.2] }, { top: [0.12, 0.25, 0.4], legs: [0.3, 0.32, 0.4] }, { top: [0.62, 0.6, 0.58], legs: [0.35, 0.3, 0.22], skin: [0.52, 0.36, 0.26] }];
    const fam = [[40, 8, [0]], [44, 62, [1, 2]], [70, 140, [4]], [20, 160, [5]]].map(([i, j, guards], k) => Object.assign(O.captive(O.cell(i, j), looks[k]), { guards }));
    for (const k of [0, 4, 5]) if (H[k]) { H[k].gun = true; H[k].dropOnDeath = 'rifle'; const b = H[k].body; if (b.weapon) b.weapon.parent?.remove(b.weapon); b.weapon = makeHunterWeapon('rifle'); b.weapon.position.set(0, -0.1, 0.02); b.bones[10]?.add(b.weapon); }
    let saved = 0, lost = 0, open = false, done = false;
    const status = () => O.set(open ? (done ? 'Get out through the fire exit' : 'Find the switch to open the exit door') : `Save at least one of the four family members (${saved} saved, ${lost} dead)`);
    O.set('Save at least one of the four family members', 'dir_sc_intro');
    const execute = (c) => {
      c.alive = false; lost++; const p = c.P.root.position.clone().add(new V(0, 1, 0));
      G.sound.bang?.(p); G.sound.painScream?.(p); G.blood?.spray?.(p, new V(0, 0.3, 1), 20, 1); G.blood?.pool?.(c.at.clone(), 1.2);
      c.P.pose = null; c.P.die(new V(Math.random() - 0.5, 0, Math.random() - 0.5), null, W);
      G.sound.say(lost === 4 ? 'dir_sc_fail' : 'dir_sc_dead'); status();
      if (lost === 4) setTimeout(() => G.player.hurt?.(999, null), 5000);
    };
    O.spots.push({ at: new V(), r: 0, live: () => false, act: () => {} });
    O.spots.push({ at: O.cell(58, 193.5), at3: new V(O.X(59.5), 1.3, O.Z(192.8)), r: 2.6, reach: 0.7, label: 'E — open the fire exit', live: () => open && !done,
      act: () => { done = true; G.sound.buzz?.(O.cell(58, 193)); W.openGate(); G.director.gate = true; O.lockExit = false; G.sound.say('dir_sc_switch'); status(); } });
    O.tick = () => {
      for (const c of fam) {
        if (!c.alive || c.saved) continue;
        const near = G.player.pos.distanceTo(c.at) < 16;
        if (near && c.guards.some((k) => H[k]?.alive && H[k].aware?.())) { execute(c); continue; }
        if (c.guards.every((k) => !H[k] || !H[k].alive)) { c.saved = true; saved++; G.sound.say('dir_sc_saved'); status(); }
      }
      if (!open && fam.every((c) => c.saved || !c.alive) && saved > 0) { open = true; O.mouth?.unlock(); for (const k of [7, 8]) O.wake(H[k], O.cell(k === 7 ? 30 : 50, k === 7 ? 186 : 190), false); G.sound.say('dir_sc_shark'); status(); }
      if (!O.cafeSaid && G.player.pos.distanceTo(O.cell(70, 140)) < 22) { O.cafeSaid = 1; G.sound.say('dir_sc_cafe'); }
    };
  },
  // Grounds for Assault. Hunters: 0-1 the entrance (machetes), 2-3 the pens, 4 the cave guard,
  // 5 the sniper (appears on his platform once the padlock is broken), 6-7 the restaurant.
  'grounds'(O, G) {
    const H = G.hunters, W = G.world, blade = () => ['machete', 'knife', 'shard'].some((k) => O.hasItem(k));
    O.lockExit = true; O.noCrowbars();
    const rope = O.gateRow(132, 48, 62, () => 'rope')[0];
    const lock = O.gateRow(24, 54, 68, () => 'chain')[0];
    for (const k of [0, 1]) if (H[k]) H[k].dropOnDeath = 'machete';
    G.kit.spawn('crowbar', new V(O.X(44), 0.04, O.Z(56.5)));
    const sniper = H[5]; O.hold(sniper);
    if (sniper) { sniper.gun = true; sniper.dropOnDeath = 'rifle'; const b = sniper.body; if (b.weapon) b.weapon.parent?.remove(b.weapon); b.weapon = makeHunterWeapon('rifle'); b.weapon.position.set(0, -0.1, 0.02); b.bones[10]?.add(b.weapon); }
    let phase = 0;
    O.set('Find a weapon and get past the rope-tied door', 'dir_ga_weapon');
    O.spots.push({ at: rope ? rope.at : new V(), r: rope ? Math.max(2.2, rope.len / 2 + 1.2) : 2, reach: 0.6, label: 'E — cut the rope', live: () => rope && !rope.open && blade(),
      act: () => { rope.unlock(); phase = 1; O.set('Make your way to the zoo pens', 'dir_ga_pens'); } });
    O.spots.push({ at: lock ? lock.at : new V(), r: lock ? Math.max(2.2, lock.len / 2 + 1.4) : 2, reach: 0.6, label: 'E — break the padlock', live: () => lock && !lock.open && O.hasItem('crowbar'),
      act: () => { lock.unlock(); G.sound.crunch?.(lock.at); phase = 3; O.wake(sniper, O.cell(50, 13)); O.set('Find a way into the restaurant at the top of the zoo', 'dir_ga_sniper'); } });
    O.tick = () => {
      if (phase === 1 && O.inCells(0, 93, 26, 126)) { phase = 2; O.set('Get past the padlocked gate'); }
      if (phase === 2 && lock && !lock.open && G.player.pos.distanceTo(lock.at) < 6 && !O.saidLock) { O.saidLock = 1; G.sound.say('dir_ga_lock'); }
      if (phase === 3 && O.inCells(0, 93, 0, 22)) { phase = 4; O.set('Go out the back of the restaurant to the exit'); }
      if (phase >= 3 && phase < 5 && [5, 6, 7].every((k) => !H[k] || !H[k].alive)) { phase = 5; W.openGate(); G.director.gate = true; O.lockExit = false; O.set('Go out the back of the restaurant to the exit', 'dir_ga_exit'); }
    };
  },
  // Fuelled By Hate (scene 5). Hunters by index: 0-2 containers, 3 the guard hut, 4-6 the core,
  // 7-9 arrive when the gasoline is taken (9 guards the crane), 10 rushes out when the crane clears the
  // path, 11-13 the crusher yard, 14 the last one at the exit.
  'fuelled'(O, G) {
    const { X, Z } = O, H = G.hunters, W = G.world, dead = (ks) => ks.every((k) => !H[k] || !H[k].alive);
    O.lockExit = true;
    const neck = O.gateRow(93, 125, 140, () => 'chain');
    const crane1 = O.gateRow(117, 36, 50, () => 'scrap');
    const crane2 = O.gateRow(143, 30, 64, () => 'scrap');
    for (const k of [3, 7, 8, 9, 10, 14]) O.hold(H[k]);
    // the gas can in the hangar
    const canAt = O.cell(180.5, 168), can = new THREE.Group();
    { const m = new THREE.MeshStandardMaterial({ color: 0xa81c14, roughness: 0.4, metalness: 0.3 }); const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.45, 0.18), m); b.position.y = 0.23; can.add(b);
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 8), new THREE.MeshStandardMaterial({ color: 0x222222 })); sp.position.set(0.12, 0.5, 0); sp.rotation.z = -0.5; can.add(sp);
      can.position.set(canAt.x, W.heightAt(canAt.x, canAt.z), canAt.z); O.mesh(can); }
    let phase = 0, carrying = false;
    O.set('Clear the area of hunters to open the gate');
    O.spots.push({ at: O.cell(88, 123), at3: new V(X(88), 1.4, Z(121.4)), r: 1.8, reach: 0.6, label: 'E — smash the fuse box', live: () => phase === 2,
      act: () => { phase = 3; G.sound.spark?.(O.cell(88, 121)); G.sound.thud?.(O.cell(88, 121), 1); O.wake(H[3], O.cell(104, 135), false); H[3]?.investigate?.(O.cell(89, 124)); O.set('Kill the hunter from the hut'); } });
    O.spots.push({ at: canAt, r: 1.8, reach: 0.6, label: 'E — pick up the gasoline', live: () => phase >= 4 && !carrying && can.visible,
      act: () => { carrying = true; can.visible = false; phase = Math.max(phase, 5); for (const k of [7, 8]) O.wake(H[k], O.cell(138, 153), false); O.wake(H[9], O.cell(58, 128), false);
        O.set('Head back with the gasoline to refuel the crane', 'dir_fh_gas'); } });
    O.spots.push({ at: O.cell(50, 129), at3: new V(X(50), 1.5, Z(127)), r: 3, reach: 0.9, label: 'E — refuel the crane and clear the path', live: () => carrying && phase === 5,
      act: () => { phase = 6; carrying = false; G.sound.buzz?.(O.cell(50, 124)); G.sound.thud?.(O.cell(42, 117), 2); for (const g of crane1) g.unlock(); O.wake(H[10], O.cell(42, 108));
        O.set('Find the crusher machine', 'dir_fh_crane'); } });
    O.spots.push({ at: O.cell(50, 138), at3: new V(X(52), 1.5, Z(139)), r: 3.2, reach: 0.9, label: 'E — use the crane to clear the path', live: () => phase === 8,
      act: () => { phase = 9; G.sound.buzz?.(O.cell(54, 148)); G.sound.thud?.(O.cell(47, 134), 2); for (const g of crane2) g.unlock(); O.wake(H[14], O.cell(22, 165)); W.openGate(); G.director.gate = true; O.lockExit = false;
        O.set('Find the double doors to get to the exit', 'dir_fh_exit'); } });
    O.tick = () => {
      if (phase === 0 && dead([0, 1, 2])) { phase = 1; for (const g of neck) g.unlock(); O.set('Find a way to the hut', 'dir_fh_gate'); }
      if (phase === 1 && G.player.pos.distanceTo(O.cell(100, 128)) < 14) { phase = 2; O.set('Find a way to lure out the hunter', 'dir_fh_hut'); }
      if (phase === 2 && G.player.noiseLvl > 9 && G.player.pos.distanceTo(O.cell(100, 128)) < 10) { O.spots[0].act(); }
      if (phase === 3 && H[3] && !H[3].alive) { phase = 4; O.set('Find the gasoline to fill the crane', 'dir_fh_fuel'); }
      if (phase === 6 && G.player.pos.distanceTo(O.cell(58, 86)) < 16) { phase = 7; O.set('Hunt down the hunters to open the gate', 'dir_fh_crusher'); }
      if (phase === 7 && dead([10, 11, 12, 13])) { phase = 8; O.set('Use the crane to unblock the path', 'dir_fh_crane2'); }
    };
  },
  // Born Again: follow the street, bag the Hood at the wall, then a fistfight in the basketball court
  // (the court's electric gates stay shut until he's dead), the car park, the mall, the chute.
  'born-again'(O, G) {
    const { X, Z } = O, H = G.hunters, W = G.world;
    const courtGates = [...O.gateCol(104, 100, 126, () => 'chain'), ...O.gateCol(105, 128, 152, () => 'chain')];
    const fighter = H[2]; O.hold(fighter);
    if (!G.kit.items.some((it) => it.kind === 'bag' && it.pos.distanceTo(O.cell(180, 60)) < 18)) G.kit.spawn('bag', new V(X(184), 0.04, Z(58)));
    O.lockExit = true;
    const mallGate = O.fenceLine('col', 58, 100, 172, 'chain'); // the electric gate from the car park into the mall
    let phase = 0; const said = {}; const once = (k, id) => { if (said[k]) return; said[k] = 1; G.sound.say(id); };
    O.set('Follow the street', 'dir_ba_street');
    O.tick = () => {
      if (phase === 0 && H[0] && (G.player.pos.distanceTo(H[0].pos) < 14 || !H[0].alive)) { phase = 1; O.set('Execute the hunter with the plastic bag', 'dir_ba_bag'); }
      if (phase === 1 && H[0] && !H[0].alive) { phase = 2; O.set('Get down into the basketball court', 'dir_ba_court'); }
      if (phase <= 2 && O.inCells(105, 160, 68, 117) && W.heightAt(G.player.pos.x, G.player.pos.z) < -1.2) { phase = 3; O.wake(fighter, O.cell(112, 74)); O.set('Beat up the hunter using your fists', 'dir_ba_fists'); }
      if (phase === 3 && fighter && !fighter.alive) { phase = 4; for (const g of courtGates) g.unlock(); O.set('Find a way to the car park', 'dir_ba_gate'); }
      if (phase === 4 && O.inCells(58, 102, 95, 150)) { phase = 5; O.set('Kill the Hoods in the car park', 'dir_ba_carpark'); }
      if (phase <= 5 && phase >= 4 && [3, 4].every((k) => !H[k]?.alive)) { phase = 6; for (const g of mallGate) g.unlock(); O.set('Find a way into the mall', 'dir_ba_mall'); }
      if (phase === 6 && O.inCells(0, 56, 100, 176)) { phase = 7; O.set('Kill all the hunters to open the chute door', 'dir_ba_chute'); }
      if (phase >= 6 && phase < 8 && [5, 6].every((k) => !H[k]?.alive)) { phase = 8; W.openGate(); G.director.gate = true; O.lockExit = false; O.set('Drop down the chute', 'dir_ba_open'); }
    };
  },
  // Doorway Into Hell: out of the chute and through a derelict house to the street; a padlocked gate
  // blocks the alley east; the crowbar is upstairs where the wall says so, with a Hood waiting; the
  // fight in the cellar opens the way out.
  'doorway'(O, G) {
    const { X, Z } = O, H = G.hunters, W = G.world;
    O.lockExit = true; O.noCrowbars();
    let lock = null; for (const g of O.gateCol(136, 30, 90, (a, b) => (a <= 71 && b >= 70 ? 'chain' : 'scrap'))) if (g.kind === 'chain') lock = g;
    const ambusher = H[4], fighter = H[6];
    O.hold(ambusher); O.hold(fighter); if (ambusher) ambusher.dropOnDeath = 'crowbar';
    let phase = 0; const said = {}; const once = (k, id) => { if (said[k]) return; said[k] = 1; G.sound.say(id); };
    O.set('Get to the street');
    O.spots.push({ at: lock ? lock.at : new V(), r: lock ? Math.max(2.2, lock.len / 2 + 1.2) : 2, reach: 0.6, label: 'E — break the padlock', live: () => lock && !lock.open && O.hasItem('crowbar'),
      act: () => { lock.unlock(); G.sound.crunch?.(lock.at); phase = Math.max(phase, 3); O.set('Get down into the cellar', 'dir_dh_broke'); } });
    O.tick = () => {
      if (phase === 0 && O.inCells(76, 104, 0, 154)) { phase = 1; O.set('Find something to break the PADLOCK', 'dir_dh_padlock'); }
      if (lock && !lock.open && G.player.pos.distanceTo(lock.at) < 7) once('gate', 'dir_dh_gate');
      if (ambusher?.dormant && G.player.pos.distanceTo(O.cell(66, 70)) < 4.5) { O.wake(ambusher, O.cell(70, 64)); once('amb', 'dir_dh_ambush'); }
      if (phase <= 2 && O.hasItem('crowbar')) { phase = 2; O.set('Use the CROWBAR to break the PADLOCK', 'dir_dh_crowbar'); }
      if (phase >= 3 && phase < 4 && O.inCells(196, 214, 67, 81)) { phase = 4; O.wake(fighter, O.cell(212, 70)); O.set('Win the fight in the cellar', 'dir_dh_fight'); }
      if (phase === 4 && fighter && !fighter.alive) { phase = 5; W.openGate(); G.director.gate = true; O.lockExit = false; O.set('Get out through the open door', 'dir_dh_out'); }
    };
  },
  // Road to Ruin: make for the derelict library; its cellar is padlocked (crowbar); inside, the wall
  // gives way at the back and the last Hoods come down from the alley; kill them and get out the back.
  'road-to-ruin'(O, G) {
    const H = G.hunters;
    O.lockExit = true;
    let lock = null; for (const g of O.gateCol(97, 56, 66, () => 'chain')) lock = lock || g;
    const hole = O.gateRow(45, 98, 101, () => 'scrap');
    if (H[4]) H[4].dropOnDeath = 'crowbar';
    let phase = 0;
    O.set('Make your way to the abandoned library');
    O.spots.push({ at: lock ? lock.at : new V(), r: lock ? Math.max(2.2, lock.len / 2 + 1.2) : 2, reach: 0.6, label: 'E — break the padlock', live: () => lock && !lock.open && O.hasItem('crowbar'),
      act: () => { lock.unlock(); G.sound.crunch?.(lock.at); phase = 2; O.set('Get through the cellar to the exit out the back', 'dir_rr_in'); } });
    O.tick = () => {
      if (phase === 0 && G.player.pos.distanceTo(O.cell(94, 56)) < 11) { phase = 1; O.set('Find a way into the library cellar', 'dir_rr_library'); }
      if (phase === 2 && O.inCells(98, 115, 46, 67)) { phase = 3; for (const g of hole) g.unlock(); O.lockExit = false; for (const k of [5, 6]) if (H[k]?.alive) H[k].investigate?.(G.player.pos.clone()); G.sound.say('dir_rr_back'); }
    };
  },
  // White Trash: kill the Skin on the yard gate; take the knife off the one that has it and cut the
  // rope gate; smash the trailer's toilet window to draw out the Skin with the nail gun; throw the
  // switch in the guard hut to open the electric gate, which brings the rest of them running.
  'white-trash'(O, G) {
    const { X, Z } = O, W = G.world, H = G.hunters;
    O.lockExit = true;
    // 1. the yard gate across the alley
    const yard = O.gate(X(64), X(73), Z(58) - 0.15, Z(58) + 0.15, 'chain');
    // 2. the junk line between the first area and the rest: rope gate in the main gap, the other gaps piled shut
    let rope = null;
    for (const [a, b] of O.runs(114, 60, 160)) { // the east gaps stay open: they lead round to the guard hut and the exit
      const g = O.gate(X(a), X(b + 1), Z(114) - 0.3, Z(115) + 0.3, a <= 108 && b >= 106 ? 'rope' : 'scrap');
      if (g.kind === 'rope') rope = g;
    }
    // the knife is on the Skin who patrols the middle of the first area
    const knifer = H[2]; if (knifer) knifer.dropOnDeath = 'knife';
    // 3. the trailer: its Skin sits inside, out of sight, until the window goes
    const tr = new V(X(92), 0, Z(134)), door = new V(X(95.5), 0, Z(132));
    const pooper = H[4];
    if (pooper) {
      pooper.dropOnDeath = 'nailgun'; pooper.dormant = true; pooper.pos.copy(tr); pooper.place();
      const b = pooper.body; if (b.weapon) b.weapon.parent?.remove(b.weapon); b.weapon = makeHunterWeapon('nailgun'); b.weapon.position.set(0, -0.1, 0.02); b.bones[10]?.add(b.weapon);
    }
    // 4. the guard hut with the gate switch
    const hut = O.hut = new V(X(O.hutCell?.[0] ?? 214), 0, Z(O.hutCell?.[1] ?? 128));
    let phase = 0, said = {};
    const sayOnce = (k, id) => { if (said[k]) return; said[k] = 1; G.sound.say(id); };
    O.set('Kill the hunter guarding the gate');
    setTimeout(() => sayOnce('guard', 'dir_wt_guard'), 9000);
    O.spots.push({ at: rope ? rope.at : new V(), at3: rope?.g.userData.lock, r: rope ? Math.max(2.2, rope.len / 2 + 1.2) : 2, reach: 0.5, label: 'E — cut the rope', live: () => phase === 1 && rope && !rope.open && O.hasItem('knife'),
      act: () => { rope.unlock(); G.sound.stab?.(rope.at, 0.6); phase = 2; O.set('Find a way into the trailer to get the nail gun', 'dir_wt_cut'); setTimeout(() => sayOnce('trailer', 'dir_wt_trailer'), 3500); } });
    O.spots.push({ at: new V(tr.x + 1.3, 0, tr.z + 2.7), at3: new V(tr.x + 1.3, 2.1, tr.z + 2.7), r: 2.4, reach: 0.7, label: 'E — smash the toilet window', live: () => pooper && pooper.dormant,
      act: () => { G.sound.glass?.(new V(tr.x + 1.3, 2.1, tr.z + 2.7)); wake(); } });
    O.spots.push({ at: new V(hut.x, 0, hut.z + 1.9), at3: new V(hut.x + 0.9, 1.3, hut.z + 1.34), r: 2.2, reach: 0.6, label: 'E — throw the gate switch', live: () => phase === 3,
      act: () => { phase = 4; G.sound.buzz?.(new V(hut.x, 1.3, hut.z)); W.openGate(); G.director.gate = true; O.lockExit = false;
        for (const h of H) if (h.alive && !h.dormant) h.investigate?.(G.player.pos.clone());
        O.set('Go back to the gate to get to the exit', 'dir_wt_switch'); } });
    const wake = () => {
      if (!pooper || !pooper.dormant) return; pooper.dormant = false; pooper.body.root.visible = true;
      pooper.pos.copy(door); pooper.place(); pooper.investigate?.(G.player.pos.clone()); pooper.susp = 0.8; pooper.say?.('hear');
    };
    O.tick = () => {
      if (phase === 0 && H[0] && !H[0].alive) { phase = 1; yard.unlock(); O.set('Find something to cut the rope on the gate', 'dir_wt_gate1'); setTimeout(() => sayOnce('rope', 'dir_wt_rope'), 4000); }
      if (phase === 1 && O.hasItem('knife')) sayOnce('knife', 'dir_wt_knife');
      if (phase === 2 && pooper && !pooper.dormant && !said.alarm && !pooper.alive) { said.alarm = 1; for (const k of [3, 5]) H[k]?.alive && H[k].investigate?.(door.clone()); }
      if (phase === 2 && O.hasItem('nailgun')) { phase = 3; O.set('Find and activate the switch to open the gate', 'dir_wt_nailgun'); }
      // a noisy fight round the trailer brings him out anyway
      if (pooper?.dormant && G.player.pos.distanceTo(tr) < 5 && (G.player.noiseLvl || 0) > 6) wake();
    };
  },
};
