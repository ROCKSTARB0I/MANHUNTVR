// objectives.js — a scene's own goals, as in the game: gates that open when a job
// is done, things to fetch, switches to throw. Each scene script places its gates
// (solid until opened, so hunters' paths respect them too), gives the Director his
// instructions and sets the line of objective text on the HUD.
import * as THREE from '../vendor/three.module.js';
import { PLANS } from './plans.js?v=26';
import { makeHunterWeapon } from './body.js?v=26';
import { T } from './paint.js?v=26';

const V = THREE.Vector3;

export class Objectives {
  constructor(G) {
    this.G = G; this.text = ''; this.lockExit = false; this.parts = []; this.boxes = []; this.spots = []; this.tick = null;
    const def = G.world.def, P = PLANS[def.plan];
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
    if (kind === 'scrap') {
      const m = W.mats.pscrap || W.mat('oscrap', { color: 0x4a4038, roughness: 0.8 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(len + 0.4, 3.4, 1.2), m); b.position.y = 1.7; b.castShadow = true; g.add(b);
    } else {
      const panel = new THREE.Group(); panel.position.x = -len / 2; g.add(panel); // hinged at one end
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.6), W.mat('ochain', { map: T.chain || null, color: 0x8a8a84, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.6 }));
      mesh.position.set(len / 2, 1.4, 0); panel.add(mesh);
      for (const y2 of [0.12, 2.7]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 6), metal); r.rotation.z = Math.PI / 2; r.position.set(len / 2, y2, 0); panel.add(r); }
      for (const x of [0, len]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.9, 8), metal); p.position.set(x, 1.45, 0); panel.add(p); }
      if (kind === 'rope') { // rope wound round the gate and the post, knotted
        const rope = W.mat('orope', { color: 0x8a7448, roughness: 1 });
        for (let k = 0; k < 5; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 5, 12), rope); t.position.set(len - 0.02, 1.0 + k * 0.07, 0); t.rotation.set(Math.PI / 2, 0, k * 0.4); panel.add(t); }
        g.userData.lock = new V(cx + (alongX ? len / 2 : 0), y + 1.15, cz + (alongX ? 0 : len / 2));
      } else { const lk = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.05), W.mat('olock', { color: 0x9a9a92, metalness: 0.9, roughness: 0.3 })); lk.position.set(len - 0.05, 1.2, 0.05); panel.add(lk); }
      g.userData.panel = panel;
    }
    this.mesh(g);
    const b = this.box({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0: 0, y1: 3.4, see: kind !== 'scrap' });
    const gt = { g, b, kind, open: false, swing: 0, at: new V(cx, y, cz), len };
    gt.unlock = () => { if (gt.open) return; gt.open = true; this.unbox(b); if (kind === 'scrap') { g.visible = false; this.G.sound.thud?.(gt.at, 1.5); } else this.G.sound.rattle?.(gt.at); };
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
  cell(i, j) { return new V(this.X(i), 0, this.Z(j)); }
  inCells(i0, i1, j0, j1) { const P = this.G.player.pos, i = P.x / this.m + (this.X(0) / -this.m), j = P.z / this.m + (this.Z(0) / -this.m); return i >= i0 && i <= i1 && j >= j0 && j <= j1; }
  // a hunter kept out of sight until the scene calls him in
  hold(h) { if (!h) return; h.dormant = true; h.body.root.visible = false; }
  wake(h, at, charge = true) {
    if (!h || !h.dormant) return; h.dormant = false; h.body.root.visible = true; if (at) { h.pos.copy(at); h.place(); }
    const P = this.G.player.pos.clone(); h.investigate?.(P); if (charge) { h.susp = 1.4; h.last?.copy(P); } h.say?.('spot');
  }
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
    let phase = 0; const said = {}; const once = (k, id) => { if (said[k]) return; said[k] = 1; G.sound.say(id); };
    O.set('Follow the street');
    O.tick = () => {
      if (phase === 0 && H[0] && (G.player.pos.distanceTo(H[0].pos) < 14 || !H[0].alive)) { phase = 1; O.set('Execute the hunter with the plastic bag', 'dir_ba_bag'); }
      if (phase === 1 && H[0] && !H[0].alive) { phase = 2; O.set('Get down into the basketball court', 'dir_ba_court'); }
      if (phase <= 2 && O.inCells(105, 160, 68, 117) && W.heightAt(G.player.pos.x, G.player.pos.z) < -1.2) { phase = 3; O.wake(fighter, O.cell(112, 74)); O.set('Beat up the hunter using your fists', 'dir_ba_fists'); }
      if (phase === 3 && fighter && !fighter.alive) { phase = 4; for (const g of courtGates) g.unlock(); O.set('Find a way to the car park', 'dir_ba_gate'); }
      if (phase === 4 && O.inCells(58, 102, 95, 150)) { phase = 5; O.set('Kill the Hoods in the car park', 'dir_ba_carpark'); }
      if (phase === 5 && H[3] && H[4] && !H[3].alive && !H[4].alive) { phase = 6; O.set('Find a way into the mall', 'dir_ba_mall'); }
      if (phase === 6 && O.inCells(0, 56, 100, 176)) { phase = 7; O.set('Kill all the hunters to open the chute door', 'dir_ba_chute'); }
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
