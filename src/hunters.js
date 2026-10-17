// hunters.js — the men paid to kill Josh. They see by the light you stand in,
// hear what you do, investigate, search, hunt in packs, and talk while they do it.
import * as THREE from '../vendor/three.module.js';
import { Person, BONE, SKIN_TONES } from './body.js?v=1';
import { T } from './paint.js?v=1';

const V = THREE.Vector3;
const GANGS = [
  { g: 'A', mask: 'hockey', weapon: 'bat', top: [0.32, 0.12, 0.10], legs: [0.16, 0.2, 0.3] },
  { g: 'B', mask: 'skull', weapon: 'machete', top: [0.08, 0.08, 0.09], legs: [0.1, 0.1, 0.11] },
  { g: 'C', mask: 'knit', weapon: 'pipe', top: [0.22, 0.24, 0.17], legs: [0.24, 0.22, 0.18] },
];
const NAMES = ['Ricky', 'Dwayne', 'Lonnie', 'Cutter', 'Moss', 'Tully', 'Boone', 'Vic'];
const _a = new V(), _b = new V(), _c = new V();

export class Hunter {
  constructor(game, idx, route) {
    this.game = game; this.idx = idx; this.name = NAMES[idx % NAMES.length];
    const G = this.gang = GANGS[idx % 3];
    this.body = new Person({ mask: G.mask, weapon: G.weapon, top: G.top, legs: G.legs, skin: SKIN_TONES[(idx * 3 + 1) % SKIN_TONES.length], bulk: 0.95 + (idx % 3) * 0.08 });
    game.scene.add(this.body.root);
    this.route = route; this.wp = 0;
    this.pos = new V(route[0][0], 0, route[0][1]); this.yaw = 0; this.speed = 0;
    this.state = 'patrol'; this.susp = 0; this.hp = 100; this.alive = true;
    this.path = []; this.pathT = 0; this.goal = new V(); this.last = new V();
    this.timer = 0; this.lostT = 0; this.lookT = 0; this.talkT = 8 + Math.random() * 20; this.atkT = 0;
    this.seen = 0; this.heardAt = -9; this.foundBodies = new Set();
    this.stepPh = 0;
    // flashlight on every other hunter
    if (idx % 2 === 0) {
      const torch = new THREE.SpotLight(0xfff2d8, 14, 16, 0.38, 0.5, 1.6);
      const beam = new THREE.Mesh(new THREE.ConeGeometry(1.6, 7, 16, 1, true), new THREE.MeshBasicMaterial({ map: T.beam, color: 0xfff2d0, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      beam.geometry.translate(0, -3.5, 0); beam.geometry.rotateX(-Math.PI / 2); // cone along +Z from apex
      // apex at origin pointing +Z in hand space; attach to left hand
      const holder = new THREE.Group(); holder.position.set(0, -0.08, 0.02);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.6 }));
      tube.rotation.x = Math.PI / 2; holder.add(tube); holder.add(beam);
      this.body.bones[BONE.handL].add(holder);
      torch.position.set(0, 0, 0); holder.add(torch); torch.target.position.set(0, 0, 4); holder.add(torch.target);
      holder.rotation.x = 1.25; // undo the raised forearm so the beam points ahead and a little down
      this.torch = torch; this.beam = beam; this.body.anim.hold = 0;
    }
    this.place();
  }

  place() { this.body.root.position.copy(this.pos); this.body.root.rotation.y = this.yaw; }
  forward(out = new V()) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  eye(out = new V()) { return out.copy(this.pos).setY(this.body.anim.crouch ? 1.2 : 1.62); }
  aware() { return this.state === 'hunt' || this.state === 'attack'; }
  say(kind) { if (this.alive) this.game.sound.say(`h${this.gang.g}_${kind}`, { at: this.eye(_c).clone() }); }

  // ------------------------------------------------------------ senses
  // how strongly does this hunter see Josh right now (0..~1.5)?
  look(dt) {
    const P = this.game.player; if (!P.alive) return 0;
    const eye = this.eye(_a), tgt = _b.copy(P.chest);
    const d = eye.distanceTo(tgt); if (d > 26) return 0;
    const f = this.forward(_c), dir = tgt.clone().sub(eye).setY(0).normalize();
    const cos = f.dot(dir), fov = this.aware() ? Math.cos(1.25) : this.state === 'patrol' ? Math.cos(0.95) : Math.cos(1.1);
    if (cos < fov && d > 1.0) return 0;
    if (!this.game.world.clear(eye, tgt) && !this.game.world.clear(eye, P.head)) return 0;
    let vis = P.light * (P.crouch ? 0.55 : 1) + P.moveVis;
    if (d < 3.5) vis += 0.6 * (1 - d / 3.5);
    if (cos < Math.cos(0.5)) vis *= 0.6; // peripheral
    return Math.max(0, vis) * Math.max(0, 1.25 - d / 22);
  }

  hear(n) {
    if (!this.alive || this.state === 'bagged') return;
    const d = this.pos.distanceTo(n.p); let r = n.r;
    if (!this.game.world.clear(this.eye(_a), _b.copy(n.p).setY(1.0))) r *= 0.55;
    if (d > r) return;
    const k = 1 - d / r;
    if (this.state === 'hunt') { if (n.kind === 'player') this.last.copy(n.p); return; }
    this.susp = Math.min(0.95, this.susp + (n.kind === 'player' ? 0.35 + k * 0.5 : 0.6));
    if (this.susp > 0.25) {
      this.investigate(n.p);
      if (this.game.time - this.heardAt > 6) { this.say('hear'); this.heardAt = this.game.time; }
      if (n.kind === 'distract') this.game.director.event('distract', this);
    }
  }

  investigate(p) { this.state = 'investigate'; this.goal.copy(p); this.goPath(p); this.timer = 6 + Math.random() * 3; }
  goPath(p) { this.path = this.game.world.path(this.pos, p); this.pathT = 0; }

  // ------------------------------------------------------------ think
  update(dt, t) {
    const A = this.body.anim;
    if (!this.alive) { this.body.animate(dt, t); return; }
    if (this.state === 'bagged') { A.speed = 0; A.struggle = Math.min(1, A.struggle + dt * 4); this.body.animate(dt, t); return; }
    A.struggle = Math.max(0, A.struggle - dt * 3);
    if (this.stun > 0) { this.stun -= dt; A.speed = 0; this.body.animate(dt, t); this.place(); return; }
    const P = this.game.player;
    const v = this.look(dt);
    this.seen = v;
    if (v > 0.06) {
      const gain = v * dt * (this.state === 'patrol' ? 1.6 : 2.4);
      this.susp = Math.min(1.5, this.susp + gain);
      if (this.susp > 0.35 && this.state === 'patrol') { this.investigate(P.pos); this.say('suspect'); }
      if (this.state === 'investigate' || this.state === 'search') this.goal.copy(P.pos);
      if (this.susp >= 1 && !this.aware()) this.spot();
      if (this.aware()) { this.last.copy(P.pos); this.lostT = 0; }
    } else if (!this.aware()) this.susp = Math.max(0, this.susp - dt * 0.08);

    // dead friends
    for (const h of this.game.hunters) {
      if (h.alive || this.foundBodies.has(h) || this.aware()) continue;
      const d = this.pos.distanceTo(h.pos); if (d > 13) continue;
      const fc = this.forward(_c).dot(_b.copy(h.pos).sub(this.pos).normalize());
      if (fc < 0.4 || !this.game.world.clear(this.eye(_a), _b.copy(h.pos).setY(0.4))) continue;
      this.foundBodies.add(h); this.say('body'); this.susp = Math.max(this.susp, 0.9); this.investigate(h.pos);
      this.searchUntil = t + 25;
    }

    let speed = 0, lookAround = 0;
    switch (this.state) {
      case 'patrol': {
        const w = this.route[this.wp]; this.goal.set(w[0], 0, w[1]);
        if (this.pos.distanceTo(this.goal) < 0.6) { this.wp = (this.wp + 1) % this.route.length; this.lookT = Math.random() < 0.35 ? 2.5 : 0; }
        if (this.lookT > 0) { this.lookT -= dt; lookAround = 1; }
        else { speed = 1.15; this.steerTo(this.goal, dt); }
        this.talkT -= dt; if (this.talkT < 0) { this.talkT = 18 + Math.random() * 25; if (this.pos.distanceTo(P.pos) < 22) this.say('idle_' + (1 + Math.floor(Math.random() * 3))); }
        break;
      }
      case 'investigate': {
        if (this.pos.distanceTo(this.goal) > 1.0) { speed = this.susp > 0.6 ? 1.9 : 1.4; this.followPath(dt); }
        else { lookAround = 1; this.timer -= dt; if (this.timer < 0) { this.state = 'search'; this.timer = 10 + Math.random() * 6; this.say('search'); this.pickSearch(); } }
        break;
      }
      case 'search': {
        this.timer -= dt;
        if (this.pos.distanceTo(this.goal) > 0.8) { speed = 1.5; this.followPath(dt); }
        else { lookAround = 1; this.lookT -= dt; if (this.lookT < 0) this.pickSearch(); }
        if (this.timer < 0 && !(this.searchUntil > t)) { this.state = 'patrol'; this.susp = 0.1; this.say('giveup'); this.goPath(this.nearestRoute()); }
        break;
      }
      case 'hunt': {
        this.lostT += v > 0.04 ? -this.lostT : dt;
        const d = this.pos.distanceTo(P.pos);
        if (this.lostT > 6) { this.state = 'search'; this.timer = 16; this.goal.copy(this.last); this.goPath(this.last); this.say('lost'); this.game.director.event('lost', this); break; }
        this.pathT -= dt;
        const tgt = this.lostT > 0.5 ? this.last : P.pos;
        if (this.pathT < 0) { this.goPath(tgt); this.pathT = 0.5; }
        if (d < 1.55 && this.lostT < 0.5) { this.state = 'attack'; this.atkT = 0; A.swing = 0; this.hitDone = false; break; }
        speed = d > 4 ? 3.3 : 2.4; this.followPath(dt);
        this.talkT -= dt; if (this.talkT < 0) { this.talkT = 6 + Math.random() * 6; this.say('chase'); }
        break;
      }
      case 'attack': {
        this.atkT += dt; A.swing = Math.min(1, this.atkT / 0.95);
        this.face(P.pos, dt * 2);
        if (!this.hitDone && A.swing > 0.55) {
          this.hitDone = true; this.game.sound.whoosh(this.eye(_a));
          const d = this.pos.distanceTo(P.pos), f = this.forward(_c).dot(_b.copy(P.pos).sub(this.pos).setY(0).normalize());
          if (d < 1.9 && f > 0.4 && P.alive) { P.hurt(20 + Math.random() * 10, this); this.say('hit'); }
        }
        if (this.atkT > 1.25) { A.swing = -1; this.state = 'hunt'; this.pathT = 0; }
        break;
      }
    }
    // slow head-turn scan while standing
    if (lookAround) { A.look = Math.sin(t * 0.9 + this.idx) * 1.0; this.yaw += Math.sin(t * 0.5 + this.idx * 2) * dt * 0.5; }
    else A.look *= 0.9;
    A.lookV = this.aware() ? -0.05 : 0.12; A.alert = this.aware() ? 1 : this.state === 'patrol' ? 0 : 0.5;
    A.hold = this.torch ? 1 : 0;
    if (this.torch) this.torch.intensity = 14;
    // move
    this.speed += (speed - this.speed) * Math.min(1, dt * 5);
    if (this.speed > 0.05) {
      const f = this.forward(_c);
      this.pos.addScaledVector(f, this.speed * dt);
      // keep apart from other hunters and from Josh's body
      for (const h of this.game.hunters) if (h !== this && h.alive) { const d = this.pos.distanceTo(h.pos); if (d < 0.7 && d > 1e-4) this.pos.addScaledVector(_b.copy(this.pos).sub(h.pos).normalize(), (0.7 - d) * 0.5); }
      const dp = this.pos.distanceTo(P.pos); if (dp < 0.55) this.pos.addScaledVector(_b.copy(this.pos).sub(P.pos).setY(0).normalize(), 0.55 - dp);
      this.game.world.collide(this.pos, 0.3);
      // footsteps
      this.stepPh += this.speed * dt / (this.speed > 2.5 ? 0.85 : 0.7);
      if (this.stepPh > 1) { this.stepPh = 0; this.game.sound.step(this.pos, this.speed > 2.5 ? 'run' : 'walk'); }
    }
    A.speed = this.speed;
    this.place();
    this.body.animate(dt, t);
  }

  spot() {
    this.state = 'hunt'; this.susp = 1; this.lostT = 0; this.last.copy(this.game.player.pos); this.pathT = 0;
    this.say('spot'); this.game.director.event('spotted', this);
    // shout brings friends within earshot
    this.game.noise(this.pos, 16, 'shout', this);
  }

  pickSearch() {
    const W = this.game.world;
    for (let k = 0; k < 12; k++) {
      const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 6;
      const p = new V(this.last.x + Math.cos(a) * r, 0, this.last.z + Math.sin(a) * r);
      const [i, j] = W.cellOf(p.x, p.z); if (!W.walkable(i, j)) continue;
      this.goal.copy(p); this.goPath(p); this.lookT = 2 + Math.random() * 2; return;
    }
    this.lookT = 2;
  }
  nearestRoute() { let best = 0, bd = 1e9; this.route.forEach((w, i) => { const d = Math.hypot(w[0] - this.pos.x, w[1] - this.pos.z); if (d < bd) { bd = d; best = i; } }); this.wp = best; return new V(this.route[best][0], 0, this.route[best][1]); }

  steerTo(p, dt, rate = 4) {
    const want = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
    let d = want - this.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += Math.max(-rate * dt, Math.min(rate * dt, d));
    return Math.abs(d);
  }
  face(p, k) { this.steerTo(p, k, 1); }
  followPath(dt) {
    while (this.path.length && Math.hypot(this.path[0][0] - this.pos.x, this.path[0][1] - this.pos.z) < 0.5) this.path.shift();
    const w = this.path[0] || [this.goal.x, this.goal.z];
    this.steerTo(_b.set(w[0], 0, w[1]), dt, 5);
  }

  // ------------------------------------------------------------ violence
  // body hit spheres in world space
  parts() {
    const b = this.body; b.root.updateMatrixWorld(true);
    return [
      { name: 'head', bone: 'head', p: b.headPos(new V()), r: 0.13 },
      { name: 'neck', bone: 'neck', p: b.bonePos('neck', new V()).add(new V(0, 0.05, 0)), r: 0.08 },
      { name: 'chest', bone: 'chest', p: b.bonePos('chest', new V()).add(new V(0, 0.05, 0)), r: 0.19 },
      { name: 'gut', bone: 'spine', p: b.bonePos('spine', new V()), r: 0.17 },
    ];
  }
  // is Josh behind this man (for executions)?
  behind(p) { const f = this.forward(_c), d = _b.copy(p).sub(this.pos).setY(0).normalize(); return f.dot(d) < -0.15; }

  damage(n, part, dir, at, cause) {
    if (!this.alive) return false;
    this.hp -= n;
    this.body.wound(part === 'head' ? 'head' : part === 'neck' ? 'neck' : part === 'chest' ? 'chest' : 'spine', at, n > 50 ? 1.6 : 1);
    this.game.blood.spray(at, dir, n > 50 ? 70 : 30, part === 'neck' ? 1.4 : 1);
    if (this.hp <= 0) { this.kill(dir.clone().multiplyScalar(n > 60 ? 3.2 : 1.8), at, cause); return true; }
    this.say('hurt'); this.body.anim.stagger = 1; this.stun = 0.45;
    if (!this.aware()) { this.susp = 1; this.state = 'hunt'; this.last.copy(this.game.player.pos); this.lostT = 0; this.game.noise(this.pos, 12, 'shout', this); }
    return false;
  }
  kill(impulse, at, cause) {
    if (!this.alive) return;
    this.alive = false; this.state = 'dead'; this.hp = 0;
    if (this.torch) { this.torch.intensity = 0; this.beam.visible = false; }
    if (this.body.weapon) { const w = this.body.weapon; w.parent.remove(w); }
    this.body.anim.struggle = 0; this.body.anim.swing = -1;
    this.body.die(impulse, at, this.game.world);
    this.game.sound.gurgle(this.eye(_a)); this.say('die');
    this.game.blood.pool(this.pos.clone(), 1.1 + Math.random() * 0.5);
    this.game.onKill(this, cause);
  }
}

export function spawnHunters(game) {
  return game.world.routes.map((r, i) => new Hunter(game, i, r));
}
