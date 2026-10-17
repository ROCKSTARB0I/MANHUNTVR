// objectives.js — a scene's own goals, as in the game: gates that open when a job
// is done, things to fetch, switches to throw. Each scene script places its gates
// (solid until opened, so hunters' paths respect them too), gives the Director his
// instructions and sets the line of objective text on the HUD.
import * as THREE from '../vendor/three.module.js';
import { PLANS } from './plans.js?v=23';
import { makeHunterWeapon } from './body.js?v=23';
import { T } from './paint.js?v=23';

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
    gt.unlock = () => { if (gt.open) return; gt.open = true; this.unbox(b); this.G.sound.rattle?.(gt.at); };
    this.gates = this.gates || []; this.gates.push(gt);
    return gt;
  }
  // the reachable runs of cells along row j (between i0 and i1), for closing every gap in a junk line
  runs(j, i0, i1) {
    const W = this.G.world, out = []; let cur = null;
    for (let i = i0; i <= i1; i++) { const ok = W.reach(this.X(i + 0.5), this.Z(j + 0.5)); if (ok && !cur) cur = [i, i]; else if (ok) cur[1] = i; else if (cur) { out.push(cur); cur = null; } }
    if (cur) out.push(cur); return out;
  }
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
