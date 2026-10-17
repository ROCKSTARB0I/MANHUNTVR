// director.js — the voice in Cash's ear and the cameras he watches through.
// Runs the scene: intro, reactions with cooldowns, the kill quota that opens
// the gate, and the CCTV that sells you out to the hunters.
import * as THREE from '../vendor/three.module.js';

const V = THREE.Vector3;

export class Director {
  constructor(game) {
    this.game = game; this.cool = {}; this.kills = 0; this.idle = 0; this.gate = false; this.points = 0; this.spotted = 0;
    this.quota = game.hunters.length; // Manhunt kill box: every last one of them
    this.cams = game.world.cams.map((c, i) => this.makeCam(c, i));
  }

  line(id, cd = 8) {
    const t = this.game.time; if ((this.cool[id] || -1e9) > t) return;
    this.cool[id] = t + cd; this.game.sound.say(id);
  }
  // one of a family of lines (dir_kill_quiet, dir_kill_quiet_2, ...)
  any(base, cd = 8, n = 2) {
    const t = this.game.time; if ((this.cool[base] || -1e9) > t) return;
    this.cool[base] = t + cd;
    const k = 1 + Math.floor(Math.random() * n);
    this.game.sound.say(k === 1 ? base : `${base}_${k}`);
  }

  // after the opening tape (or a skip): last instruction, then the pen opens
  intro() {
    const S = this.game.sound, n = this.game.world.idx + 1;
    if (n === 1) { setTimeout(() => S.say('dir_intro_4'), 800); this.penT = setTimeout(() => { this.game.openPen(); S.say('dir_gate_open'); }, 9000); return; }
    setTimeout(() => { S.say(`dir_s${n}_1`); S.say(`dir_s${n}_2`); }, 800);
    this.penT = setTimeout(() => this.game.openPen(), 4000);
  }

  event(kind, arg) {
    const G = this.game;
    this.idle = 0;
    if (kind === 'pickup') { const m = { bag: 'dir_pickup_bag', shard: 'dir_pickup_shard', crowbar: 'dir_pickup_crowbar', bottle: 'dir_pickup_throw', brick: 'dir_pickup_throw' }; this.line(m[arg], 999); }
    if (kind === 'spotted') { this.spotted++; }
    if (kind === 'spotted') { this.any('dir_spotted', 25); if (Math.random() < 0.4) setTimeout(() => G.sound.say('cash_spotted'), 600); G.sound.stinger(); }
    if (kind === 'lost') { if (!G.hunters.some((h) => h.aware())) this.line('dir_lost', 30); }
    if (kind === 'distract') this.line('dir_distract', 30);
    if (kind === 'noise') this.line('dir_noise', 40);
    if (kind === 'hurt') this.line('dir_hurt', 40);
    if (kind === 'cctv') this.any('dir_cctv', 30);
  }

  onKill(h, cause) {
    const G = this.game;
    this.kills++;
    this.points += h.execLevel === 2 ? 3 : h.execLevel === 1 ? 2 : h.execLevel === 0 ? 1 : h.stealthStart ? 0.5 : 0;
    const took = G.time - (h.firstHit || G.time), stealth = h.stealthStart;
    setTimeout(() => {
      // he congratulates every takedown; executions are graded by how far you charged them
      if (cause === 'fall') { this.line('dir_end', 0); if (this.kills >= this.quota && !this.gate) { this.gate = true; G.world.openGate(); } return; }
      const lvl = h.execLevel;
      if (lvl === 2) this.any('dir_exec_red', 0, 3);
      else if (lvl === 1) this.any('dir_exec_green', 0, 3);
      else if (lvl === 0) this.any('dir_exec_grey', 0, 3);
      else if (!stealth) this.any('dir_kill_fight', 0, 2);
      else this.any('dir_kill_quiet', 0, 2);
      if (Math.random() < 0.35) G.sound.say(Math.random() < 0.5 ? 'cash_kill' : 'cash_kill_2');
      if (this.kills === this.quota - 1) this.line('dir_one_left', 999);
      if (this.kills >= this.quota && !this.gate) { this.gate = true; G.world.openGate(); this.line('dir_gate', 999); setTimeout(() => G.sound.say('cash_gate'), 9000); }
    }, 1400);
  }

  // the Director's 5 stars: brutality first, then speed; he hates clean and quick
  rating() {
    const per = this.points / Math.max(1, this.kills);           // 0..3
    const mins = this.game.time / 60;
    let s = per * 1.2 + (mins < 8 ? 1 : mins < 14 ? 0.5 : 0) + (this.spotted === 0 ? 0.5 : 0);
    return Math.max(1, Math.min(5, Math.round(s)));
  }

  // ------------------------------------------------------------ CCTV
  makeCam(c, i) {
    const g = new THREE.Group(); g.position.copy(c.p);
    const metal = new THREE.MeshStandardMaterial({ color: 0xbdbab2, roughness: 0.5, metalness: 0.3 });
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.35), metal); arm.position.z = 0.0;
    const head = new THREE.Group(); g.add(head);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.38), metal); body.position.z = 0.2; head.add(body);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.44), metal); hood.position.set(0, 0.08, 0.22); head.add(hood);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.03, 12), new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.05, metalness: 0.9 })); lens.rotation.x = Math.PI / 2; lens.position.z = 0.4; head.add(lens);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff1a10 })); led.position.set(0.05, 0.04, 0.39); head.add(led);
    head.rotation.x = 0.45; g.add(arm);
    this.game.scene.add(g);
    return { ...c, i, g, head, led, alive: true, see: 0, t: Math.random() * 6, reported: -99, p: c.p.clone() };
  }
  smash(c) {
    const G = this.game; if (!c.alive) return;
    c.alive = false; c.led.visible = false; c.head.rotation.x = 1.2; c.head.rotation.z = 0.6;
    G.sound.spark(c.p); G.noise(c.p, 8, 'player'); this.line('dir_cctv_smash', 30);
  }

  update(dt) {
    const G = this.game, P = G.player;
    // however they died, once they're all dead the gate opens
    if (!this.gate && G.hunters.length && G.hunters.every((h) => !h.alive)) { this.gate = true; this.kills = Math.max(this.kills, this.quota); G.world.openGate(); setTimeout(() => this.line('dir_gate', 999), 1600); }
    // CCTV sweeps and reports
    for (const c of this.cams) {
      if (!c.alive) continue;
      c.t += dt; const yaw = c.yaw + Math.sin(c.t * 0.35) * c.sweep;
      c.head.rotation.y = yaw;
      const fwd = new V(Math.sin(yaw), 0, Math.cos(yaw));
      const to = P.chest.clone().sub(c.p), d = to.length(); to.normalize();
      const flat = new V(to.x, 0, to.z).normalize();
      let sees = false;
      if (P.alive && d < 17 && flat.dot(fwd) > Math.cos(0.5) && (P.light > 0.12 || d < 5) && G.world.clear(c.p.clone().addScaledVector(to, 0.5), P.chest)) sees = true;
      c.see = sees ? c.see + dt : Math.max(0, c.see - dt * 0.5);
      c.led.material.color.set(sees ? (Math.sin(G.time * 20) > 0 ? 0xff2010 : 0x200000) : 0xff1a10);
      if (sees && Math.random() < dt * 2) G.sound.camBeep(c.p);
      if (c.see > 1.3 && G.time - c.reported > 20) {
        c.reported = G.time; c.see = 0;
        this.event('cctv');
        // the two nearest unaware hunters come to look
        const near = G.hunters.filter((h) => h.alive && !h.aware() && h.state !== 'bagged').sort((a, b) => a.pos.distanceTo(P.pos) - b.pos.distanceTo(P.pos)).slice(0, 2);
        near.forEach((h) => { h.susp = Math.max(h.susp, 0.7); h.investigate(P.pos.clone()); });
      }
    }
    // dead air
    this.idle += dt;
    if (P.moving || G.hunters.some((h) => h.aware())) this.idle = Math.min(this.idle, 20);
    if (this.idle > 75) { this.idle = 0; this.any('dir_idle', 60); }
    // holding still in the dark right next to a hunter
    if (P.light < 0.15 && G.hunters.some((h) => h.alive && !h.aware() && h.pos.distanceTo(P.pos) < 3)) this.line('dir_hidden', 60);
  }
}
