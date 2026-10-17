// kit.js — the things Cash can pick up and what his hands do with them.
// Takedowns are physical: the shard and crowbar only hurt when their tip is
// moving fast enough through a body part; the bag goes over a head when your
// hand reaches it from behind, and only works while you keep hold and pull.
import * as THREE from '../vendor/three.module.js';
import { T } from './paint.js?v=3';

const V = THREE.Vector3;
const _a = new V(), _b = new V();

// Executions, Manhunt style: hold to charge GREY -> GREEN -> RED, release to
// commit, then act it out. Higher levels need more (real) strikes or a longer hold.
export const LEVELS = [
  { name: 'HASTY', color: 0x9c9c9c, css: '#9c9c9c' },
  { name: 'VIOLENT', color: 0x39c84a, css: '#39c84a' },
  { name: 'GRUESOME', color: 0xe2231a, css: '#e2231a' },
];
const CHARGE = [1.0, 2.2];                       // seconds to reach green, red
const NEED = { shard: [1, 3, 5], crowbar: [1, 2, 4], brick: [1, 3, 4], bottle: [1, 2, 3], bag: [2.0, 3.5, 5.5] };
export function levelOf(t) { return t >= CHARGE[1] ? 2 : t >= CHARGE[0] ? 1 : 0; }

const DEF = {
  bag: { tip: [0, 0, 0], speed: 0, rest: 0.04, throwable: false },
  shard: { tip: [0, 0, -0.15], speed: 1.4, rest: 0.015, throwable: true },
  crowbar: { tip: [0, 0.02, -0.58], speed: 2.6, rest: 0.02, throwable: true },
  bottle: { tip: [0, 0, -0.26], speed: 2.4, rest: 0.035, throwable: true },
  brick: { tip: [0, 0, -0.08], speed: 2.4, rest: 0.035, throwable: true },
  pills: { tip: [0, 0, 0], speed: 99, rest: 0.05, throwable: false },
};

function makeMesh(kind) {
  const g = new THREE.Group();
  if (kind === 'bag') {
    const geo = new THREE.SphereGeometry(0.11, 14, 10); const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = 1 + (Math.random() - 0.5) * 0.25; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 1.4 - 0.1, p.getZ(i) * k); }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xd8d6cf, roughness: 0.35, transparent: true, opacity: 0.82, side: THREE.DoubleSide }));
    g.add(m);
    const handles = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.006, 4, 10), m.material); handles.position.y = 0.04; g.add(handles);
  } else if (kind === 'shard') {
    const shape = new THREE.Shape(); shape.moveTo(-0.022, 0); shape.lineTo(0.026, 0.01); shape.lineTo(0.004, 0.17); shape.lineTo(-0.012, 0.12); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: false }); geo.translate(0, -0.02, -0.003); geo.rotateX(-Math.PI / 2);
    g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x9fc9b8, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.55 })));
    // a rag wrapped round the grip end
    const rag = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.06, 7), new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 1 })); rag.rotation.x = Math.PI / 2; rag.position.z = 0.0; g.add(rag);
  } else if (kind === 'crowbar') {
    const pts = [new V(0, 0, 0.1), new V(0, 0, -0.5), new V(0, 0.02, -0.56), new V(0, 0.06, -0.6), new V(0, 0.1, -0.6), new V(0, 0.12, -0.57)];
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.012, 6);
    g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x5c1612, roughness: 0.55, metalness: 0.6 })));
    const claw = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.006, 0.05), new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 })); claw.position.z = 0.12; claw.rotation.x = 0.3; g.add(claw);
  } else if (kind === 'bottle') {
    const prof = [[0, -0.27], [0.036, -0.27], [0.038, -0.25], [0.038, -0.1], [0.03, -0.07], [0.013, -0.04], [0.012, 0.02], [0.015, 0.03], [0, 0.03]].map(([r, y]) => new THREE.Vector2(r, y));
    const geo = new THREE.LatheGeometry(prof, 14); geo.rotateX(Math.PI / 2); geo.scale(1, 1, 1);
    g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1d4a20, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.8 })));
  } else if (kind === 'pills') { // painkillers: an orange pharmacy bottle with a white cap
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.07, 12), new THREE.MeshStandardMaterial({ color: 0xc8701c, roughness: 0.25, transparent: true, opacity: 0.85 }));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.02, 12), new THREE.MeshStandardMaterial({ color: 0xf0f0ea, roughness: 0.6 })); cap.position.y = 0.045;
    const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.0225, 0.0225, 0.035, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.9 }));
    g.add(b, cap, lab);
  } else if (kind === 'brick') {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.065, 0.2), new THREE.MeshStandardMaterial({ color: 0x7a3a2a, roughness: 1, map: T.concrete.map }));
    m.position.z = -0.06; g.add(m);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

class Item {
  constructor(kind, pos) {
    this.kind = kind; this.def = DEF[kind];
    this.mesh = makeMesh(kind); this.pos = pos.clone(); this.vel = new V(); this.spin = new V();
    this.hand = null; this.flying = false; this.gone = false; this.thrower = null;
    this.mesh.position.copy(pos); this.restPose();
    this.glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, color: 0xfff0d0, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.glint.scale.setScalar(0.16);
    this.tipPrev = new V(); this.tipVel = new V(); this.hitCool = 0;
  }
  restPose() { this.mesh.rotation.set(this.kind === 'bag' || this.kind === 'pills' ? 0 : -Math.PI / 2 + 0.05, Math.random() * 6.28, 0, 'YXZ'); if (this.kind === 'bag') this.mesh.scale.set(1, 0.4, 1); this.mesh.position.y = this.def.rest; }
  tip(out) { return this.mesh.localToWorld(out.set(...this.def.tip)); }
}

export class Kit {
  constructor(game) {
    this.game = game; this.items = []; this.struggle = null; this.exec = null; this.charge = null; this.firsts = new Set();
    // lock-on reticle that floats behind a target's head
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.strokeStyle = '#fff'; g.lineWidth = 10; g.beginPath(); g.arc(64, 64, 50, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 6; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; g.beginPath(); g.moveTo(64 + Math.cos(a) * 34, 64 + Math.sin(a) * 34); g.lineTo(64 + Math.cos(a) * 18, 64 + Math.sin(a) * 18); g.stroke(); }
    const tx = new THREE.CanvasTexture(c);
    this.mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthTest: false, opacity: 0.9 }));
    this.mark.renderOrder = 900; this.mark.scale.setScalar(0.22); this.mark.visible = false; game.scene.add(this.mark);
    this.fill = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow, transparent: true, depthTest: false, opacity: 0.6, blending: THREE.AdditiveBlending }));
    this.fill.renderOrder = 901; this.fill.visible = false; game.scene.add(this.fill);
    // the kill light: snaps on over an execution so you see everything
    this.killLight = new THREE.PointLight(0xfff0dc, 0, 5, 1.4); game.scene.add(this.killLight); this.killGlow = 0;
    this.lens = []; this.kills = 0;
    for (const s of game.world.items) this.spawn(s.kind, s.p);
  }
  spawn(kind, p) { const it = new Item(kind, p); this.game.scene.add(it.mesh); this.game.scene.add(it.glint); this.items.push(it); return it; }
  remove(it) { it.gone = true; it.mesh.parent?.remove(it.mesh); it.glint.parent?.remove(it.glint); if (it.hand) it.hand.item = null; this.items = this.items.filter((x) => x !== it); }
  clear() { this.killGlow = 0; this.killLight.intensity = 0; for (const s of this.lens) s.parent?.remove(s); this.lens = []; for (const it of [...this.items]) this.remove(it); this.struggle = null; this.exec = null; this.charge = null; this.mark.visible = this.fill.visible = false; }

  // ------------------------------------------------------------ holding
  grab(hand, it) {
    if (it.kind === 'pills') { // swallowed on the spot
      const P = this.game.player; P.hp = Math.min(100, P.hp + 45); this.remove(it); this.game.tookPills = true;
      this.game.sound.rustle(null, 0.3); this.game.sound.pills?.(); hand.haptic?.(0.5, 60); this.game.hud?.flash('heal'); return;
    }
    if (hand.item) this.drop(hand, new V());
    it.hand = hand; it.flying = false; hand.item = it;
    hand.obj.add(it.mesh); it.mesh.position.set(0, 0, 0); it.mesh.rotation.set(0, 0, 0); it.mesh.scale.set(1, 1, 1);
    if (it.kind === 'bag') { it.mesh.position.set(0, -0.04, -0.02); it.mesh.scale.set(1, 0.8, 1); }
    if (it.kind === 'brick') it.mesh.position.set(-0.03, 0, 0.02);
    it.glint.material.opacity = 0;
    it.mesh.updateMatrixWorld(true); it.tip(it.tipPrev);
    hand.haptic?.(0.4, 40);
    this.game.sound.rustle(null, it.kind === 'bag' ? 0.4 : 0.1);
    if (!this.firsts.has(it.kind)) { this.firsts.add(it.kind); this.game.director.event('pickup', it.kind); }
  }
  drop(hand, vel) {
    const it = hand.item; if (!it) return;
    hand.item = null; it.hand = null;
    it.mesh.updateMatrixWorld(true);
    const wp = it.mesh.getWorldPosition(new V()), wq = it.mesh.getWorldQuaternion(new THREE.Quaternion());
    this.game.scene.add(it.mesh); it.mesh.position.copy(wp); it.mesh.quaternion.copy(wq); it.mesh.scale.set(1, 1, 1);
    it.pos.copy(wp); it.vel.copy(vel); it.flying = true; it.thrower = vel.length() > 3 ? 'cash' : null; if (it.thrower) this.game.thrown = true;
    it.spin.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 12).multiplyScalar(Math.min(1, vel.length() / 5));
  }
  nearest(p, maxD, flat = false) {
    let best = null, bd = maxD;
    for (const it of this.items) { if (it.hand || it.flying) continue; const d = flat ? Math.hypot(it.pos.x - p.x, it.pos.z - p.z) : it.mesh.position.distanceTo(p); if (d < bd) { bd = d; best = it; } }
    return best;
  }

  // VR: grip edge picks up the nearest thing near the hand; release with speed throws it
  handInput(hand) {
    if (hand.grip && !hand.gripPrev && !hand.item) {
      let it = this.nearest(hand.pos, 0.22);
      if (!it) { const f = this.nearest(hand.pos, 0.32, true); if (f && hand.pos.y < f.pos.y + 0.55) it = f; }
      if (it) this.grab(hand, it);
    }
    if (!hand.grip && hand.gripPrev && hand.item && !(this.struggle && this.struggle.hand === hand)) {
      const v = hand.vel.clone(); const sp = v.length();
      this.drop(hand, sp > 1.4 ? v.multiplyScalar(1.35) : v.multiplyScalar(0.5));
    }
  }

  // desktop helpers
  // desktop: the nearest thing around Cash's feet, preferring what's in front of him
  pickInView(hand, eye, dir) {
    let best = null, bs = -1e9;
    const P = this.game.player, f = new V(dir.x, 0, dir.z).normalize();
    for (const it of this.items) {
      if (it.hand || it.flying) continue;
      const to = new V(it.pos.x - P.pos.x, 0, it.pos.z - P.pos.z), d = to.length(); if (d > 1.7) continue;
      const s = (d > 0.01 ? to.normalize().dot(f) : 1) * 0.6 - d; if (s > bs) { bs = s; best = it; }
    }
    if (best) this.grab(hand, best);
    return best;
  }
  throwFrom(hand, dir) { if (!hand.item || hand.item.kind === 'bag') return; this.drop(hand, dir.clone().multiplyScalar(10).add(new V(0, 2.2, 0))); this.game.sound.whoosh(null); }

  // ------------------------------------------------------------ violence
  update(dt) {
    const G = this.game;
    this.startCharges();
    for (const hand of G.hands) {
      const it = hand.item; if (!it) continue;
      it.mesh.updateMatrixWorld(true);
      const tip = it.tip(_a);
      it.tipVel.copy(tip).sub(it.tipPrev).divideScalar(Math.max(dt, 1e-3));
      // smooth so one jittery frame doesn't count as a swing
      it.tipSpeed = (it.tipSpeed || 0) * 0.5 + it.tipVel.length() * 0.5;
      it.tipPrev.copy(tip);
      it.hitCool -= dt;
      if (it.kind === 'bag') continue;
      if (this.charge && this.charge.hand === hand) continue;          // winding up, not swinging
      const need = this.exec && this.exec.hand === hand ? it.def.speed * 0.8 : it.def.speed;
      // desktop clicks play a swing; its striking moment counts as fast even when the hand rides Cash's arm (third person)
      const fast = it.tipSpeed >= need || (hand.desktop && hand === G.hands[0] && G.swingHot);
      if (it.hitCool > 0 || !fast) continue;
      // cameras
      if (it.kind === 'crowbar' || it.kind === 'brick') for (const c of G.director.cams) if (c.alive && tip.distanceTo(c.p) < 0.4) { G.director.smash(c); it.hitCool = 0.4; hand.haptic?.(1, 80); }
      for (const h of G.hunters) {
        if (!h.alive || h.pos.distanceTo(tip) > 2.2) continue;
        for (const part of h.parts()) {
          // desktop: the swing lands where you are looking (a short ray from the eye)
          const d = hand.desktop ? segDist(part.p, G.player.head, G.lookDir, it.kind === 'crowbar' ? 1.6 : 1.25) : tip.distanceTo(part.p);
          if (d > part.r + (hand.desktop ? 0.07 : 0.05)) continue;
          this.hit(hand, it, h, part, tip.clone());
          it.hitCool = hand.desktop ? 0.4 : it.kind === 'shard' ? 0.28 : 0.45; break;
        }
        if (it.hitCool > 0) break;
      }
    }
    if (this.struggle) this.updateStruggle(dt);
    if (this.exec) this.updateExec(dt);
    const busy = this.exec || this.struggle || this.charge;
    const tgt = this.exec?.h || this.struggle?.h || this.charge?.h;
    if (tgt) this.killLight.position.copy(tgt.eye(new V())).add(new V(0, 0.9, 0)).addScaledVector(G.player.pos.clone().sub(tgt.pos).setY(0).normalize(), 0.7);
    this.killGlow = busy ? Math.min(1, this.killGlow + dt * (this.charge ? 1.2 : 6)) : Math.max(0, this.killGlow - dt * 0.35);
    this.killLight.intensity = this.killGlow * (this.charge && !this.exec ? 2.5 : 9);
    for (const s of this.lens) { s.material.opacity -= dt * 0.18; s.position.y -= dt * 0.004; }
    this.lens = this.lens.filter((s) => { if (s.material.opacity > 0) return true; s.parent?.remove(s); return false; });
    this.updateCharge(dt);
    // things in the air
    for (const it of [...this.items]) {
      if (!it.flying) {
        if (!it.hand) { const t = G.time * 2 + it.pos.x; it.glint.position.copy(it.mesh.position).y += 0.06; it.glint.material.opacity = 0.25 + Math.max(0, Math.sin(t * 1.7)) * 0.45 * (1 - Math.min(1, G.player.pos.distanceTo(it.pos) / 14)); }
        continue;
      }
      const prev = it.pos.clone();
      it.vel.y -= 9.8 * dt; it.pos.addScaledVector(it.vel, dt);
      it.mesh.position.copy(it.pos); it.mesh.rotation.x += it.spin.x * dt; it.mesh.rotation.y += it.spin.y * dt; it.mesh.rotation.z += it.spin.z * dt;
      // hit a man's head?
      let hitMan = null;
      if (it.thrower) for (const h of G.hunters) if (h.alive && h.body.headPos(_b).distanceTo(it.pos) < 0.2) hitMan = h;
      const wall = !G.world.clear(prev, it.pos, false);
      if (hitMan || wall || it.pos.y <= it.def.rest) {
        if (wall) { it.pos.copy(prev); it.vel.x *= -0.25; it.vel.z *= -0.25; }
        this.impact(it, hitMan);
      }
    }
  }

  impact(it, man) {
    const G = this.game, p = it.pos.clone(), sp = it.vel.length();
    const nearCash = p.distanceTo(G.player.pos) < 4;
    if (man) { man.damage(18, 'head', it.vel.clone().normalize(), man.body.headPos(new V()), it.kind); man.stun = 1.2; }
    if (it.kind === 'bottle' && sp > 2.5) {
      G.sound.glass(p); G.noise(p, 15, nearCash ? 'player' : 'distract');
      this.remove(it); this.spawn('shard', new V(p.x, 0.015, p.z));
      return;
    }
    if (sp > 2) { if (it.kind === 'brick') G.sound.thud(p); else G.sound.clank(p); G.noise(p, it.kind === 'brick' ? 12 : 9, nearCash ? 'player' : 'distract'); }
    if (it.pos.y <= it.def.rest + 0.01) { it.flying = false; it.thrower = null; it.pos.y = it.def.rest; it.mesh.position.copy(it.pos); it.restPose(); it.mesh.position.x = it.pos.x; it.mesh.position.z = it.pos.z; }
    else { it.vel.multiplyScalar(0.3); }
  }

  hit(hand, it, h, part, at) {
    const G = this.game, dir = it.tipVel.clone().normalize();
    if (this.exec && this.exec.h === h) return this.execStrike(hand, it, h, part, at, dir);
    const unaware = !h.aware() && h.state !== 'bagged' && h.state !== 'executed';
    const sneak = unaware && h.behind(G.player.pos);
    let dmg = 0;
    if (it.kind === 'shard') {
      dmg = part.name === 'neck' || part.name === 'head' ? 55 : 30;
      if (sneak) dmg *= 1.9;
      G.sound.stab(at, 1); hand.haptic?.(1, 90);
    } else if (it.kind === 'crowbar') {
      dmg = part.name === 'head' ? 60 : 30;
      if (sneak && part.name === 'head') dmg = 110;
      if (part.name === 'head') G.sound.crunch(at); else G.sound.thud(at, 1.2);
      hand.haptic?.(1, 120);
    } else if (it.kind === 'bottle') {
      dmg = 28; G.sound.glass(at); hand.haptic?.(1, 100);
      // the bottle breaks in your hand: now you're holding the neck, jagged
      const hd = it.hand; this.remove(it); const s = this.spawn('shard', at); this.grab(hd, s);
    } else if (it.kind === 'brick') {
      dmg = part.name === 'head' ? 45 : 20; G.sound.thud(at, 1.4); hand.haptic?.(1, 110);
    }
    if (!h.hitsTaken) { h.hitsTaken = 0; h.firstHit = G.time; h.stealthStart = unaware; }
    h.hitsTaken++;
    const killed = h.damage(dmg, part.name, dir, at, it.kind);
    G.noise(at, it.kind === 'crowbar' ? 7 : 4, 'player');
    if (killed && it.kind === 'shard' && Math.random() < 0.5) { G.sound.glass(at); this.remove(it); } // snapped off in him
  }

  // ------------------------------------------------------------ the bag
  startBag(hand, it, h, level = 0) {
    const G = this.game;
    hand.item = null; it.hand = null;
    const headBone = h.body.bones[4];
    headBone.add(it.mesh); it.mesh.position.set(0, 0.12, 0.0); it.mesh.rotation.set(Math.PI, 0, 0); it.mesh.scale.set(1.25, 1.2, 1.25);
    h.state = 'bagged'; h.speed = 0; h.hitsTaken = (h.hitsTaken || 0) + 1; h.firstHit = G.time; h.stealthStart = true;
    this.struggle = { h, hand, it, t: 0, slip: 0, pulse: 0, need: NEED.bag[level], level };
    h.execLevel = level;
    G.sound.rustle(h.eye(new V()), 0.8); h.say('bagged');
  }
  updateStruggle(dt) {
    const G = this.game, S = this.struggle, h = S.h, hand = S.hand;
    if (!h.alive) { this.struggle = null; return; }
    const head = h.body.headPos(_b);
    const holding = hand.desktop ? hand.useHeld : hand.grip;
    const near = hand.desktop ? G.player.head.distanceTo(head) < 2.0 : hand.pos.distanceTo(head) < 0.65;
    if (holding && near) {
      S.slip = 0;
      // pulling (hand moving) chokes faster than just holding
      S.t += dt * (1 + Math.min(1.5, hand.vel.length() * 0.8));
    } else S.slip += dt;
    // the bag sucks in and out with his breathing, slower as he fades
    const br = Math.sin(G.time * (14 - S.t / S.need * 10)) * 0.08 * (1 - S.t / S.need);
    S.it.mesh.scale.set(1.18 + br, 1.2, 1.18 + br);
    S.pulse -= dt; if (S.pulse < 0) { S.pulse = 0.18; hand.haptic?.(0.5 + Math.random() * 0.5, 60); if (Math.random() < 0.4) G.sound.rustle(head, 0.15); if (Math.random() < 0.45) G.sound.grunt(head, 1 - S.t / S.need * 0.6, true); }
    h.body.anim.struggle = Math.max(0.2, 1 - S.t / (S.need * 1.2)); G.vhs.hot = Math.max(G.vhs.hot, 0.25 + S.level * 0.2);
    if (S.slip > 0.6) { // he tore free
      this.struggle = null;
      headBoneDrop(this, S.it, h);
      h.execLevel = null; h.state = 'hunt'; h.susp = 1; h.last.copy(G.player.pos); h.lostT = 0; h.stun = 0.6; h.say('spot'); G.director.event('spotted', h);
      return;
    }
    if (S.t >= S.need) {
      this.struggle = null; this.items = this.items.filter((x) => x !== S.it);
      const f = h.forward(new V()).multiplyScalar(0.8);
      h.kill(f, head.clone(), 'bag'); this.bloodyHands(hand, 0.02);
    }
  }

  // ------------------------------------------------------------ executions
  // a hunter Cash could execute with the thing in this hand right now
  candidate(hand) {
    const G = this.game, it = hand.item; if (!it || this.exec || this.struggle) return null;
    let best = null, bd = 1.6;
    for (const h of G.hunters) {
      if (!h.alive || h.aware() || h.state === 'bagged' || h.state === 'executed') continue;
      const d = h.pos.distanceTo(G.player.pos);
      if (d < bd && h.behind(G.player.pos)) { bd = d; best = h; }
    }
    return best;
  }
  held(hand) { return hand.desktop ? hand.useHeld : hand.trigger > 0.6; }
  startCharges() {
    if (this.charge || this.exec || this.struggle) return;
    for (const hand of this.game.hands) {
      const h = this.held(hand);
      if (h && !hand.latch && hand.item) { const c = this.candidate(hand); if (c) { this.charge = { h: c, hand, t: 0, lvl: -1 }; hand.latch = true; return; } }
      if (!h) hand.latch = false;
    }
  }
  updateCharge(dt) {
    const G = this.game, C = this.charge;
    // show the reticle on whoever is lockable, even before charging
    let target = C ? C.h : null;
    if (!target) for (const hand of G.hands) { const c = this.candidate(hand); if (c) { target = c; break; } }
    if (!target || this.exec || this.struggle) { this.mark.visible = this.fill.visible = false; G.execMeter = null; if (!target) this.charge = null; return; }
    const head = target.body.headPos(_b);
    this.mark.position.copy(head).y += 0.32; this.mark.visible = true; this.fill.position.copy(this.mark.position);
    if (!C) { this.mark.material.color.setHex(0xffffff); this.mark.material.opacity = 0.35 + Math.sin(G.time * 6) * 0.1; this.fill.visible = false; G.execMeter = { t: 0, lvl: -1 }; return; }
    // lost him? (he turned, walked off, or noticed)
    if (!target.alive || target.aware() || target.pos.distanceTo(G.player.pos) > 2.3 || !C.hand.item) { this.charge = null; return; }
    if (this.held(C.hand)) {
      C.t += dt; const lvl = levelOf(C.t);
      if (lvl !== C.lvl) { C.lvl = lvl; C.hand.haptic?.(0.3 + lvl * 0.35, 50); G.sound.lock?.(lvl); }
      const L = LEVELS[lvl]; this.mark.material.color.setHex(L.color); this.mark.material.opacity = 0.95;
      this.fill.material.color.setHex(L.color); this.fill.visible = true; this.fill.scale.setScalar(0.12 + Math.min(1, C.t / CHARGE[1]) * 0.25);
      this.mark.scale.setScalar(0.22 + Math.sin(G.time * (8 + lvl * 6)) * 0.015);
      G.execMeter = { t: Math.min(1, C.t / (CHARGE[1] + 0.3)), lvl };
    } else {
      this.charge = null; this.mark.visible = this.fill.visible = false; G.execMeter = null;
      this.startExec(C.hand, target, levelOf(C.t));
    }
  }
  startExec(hand, h, level) {
    const G = this.game, it = hand.item; if (!it) return;
    h.state = 'executed'; h.speed = 0; h.body.anim.speed = 0; h.execLevel = level;
    h.hitsTaken = 0; h.firstHit = G.time; h.stealthStart = true;
    G.vhs.hot = 0.4 + level * 0.3; hand.haptic?.(1, 120);
    G.sound.stinger(); this.killOn(h); G.sound.grunt(h.eye(new V()), 0.8, it.kind === 'bag');
    if (it.kind === 'bag') { this.startBag(hand, it, h, level); return; }
    this.exec = { h, hand, it, level, need: (NEED[it.kind] || [1, 2, 3])[level], done: 0, t: 0 };
    h.body.anim.struggle = 0.4;
  }
  execStrike(hand, it, h, part, at, dir) {
    const G = this.game, E = this.exec;
    E.done++; h.hitsTaken++;
    const last = E.done >= E.need;
    if (it.kind === 'shard') G.sound.stab(at, 1 + E.level * 0.3);
    else if (it.kind === 'crowbar') { if (part.name === 'head') G.sound.crunch(at); else G.sound.thud(at, 1.3); }
    else if (it.kind === 'bottle') { G.sound.glass(at); }
    else G.sound.thud(at, 1.5);
    hand.haptic?.(1, 110 + E.level * 30);
    G.vhs.hot = Math.min(1.2, G.vhs.hot + 0.25 + E.level * 0.1);
    h.body.wound(part.name === 'head' ? 'head' : part.name === 'neck' ? 'neck' : part.name === 'chest' ? 'chest' : 'spine', at, 1 + E.level * 0.3);
    G.blood.spray(at, dir, 45 + E.level * 35, 1.2 + E.level * 0.35);
    G.blood.spray(at, dir.clone().negate().add(new V(0, 0.6, 0)), 10 + E.level * 12, 0.8); // back-spatter toward Cash
    if (part.name === 'neck' || part.name === 'head') G.blood.splat(new V(h.pos.x + dir.x * 0.6, 0, h.pos.z + dir.z * 0.6), 0.4 + E.level * 0.2);
    G.sound.grunt(h.eye(new V()), 1 + E.level * 0.3);
    if (E.level === 2 || Math.random() < 0.3) this.lensBlood(2 + E.level * 2);
    this.bloodyHands(hand, 0.08 + E.level * 0.04);
    if (it.kind === 'bottle' && !last) { const hd = it.hand; this.remove(it); const s = this.spawn('shard', at); this.grab(hd, s); E.it = s; }
    if (!last) { h.body.anim.stagger = 1; if (Math.random() < 0.6) h.say('hurt'); return; }
    this.exec = null;
    h.kill(dir.clone().multiplyScalar(2.2 + E.level * 1.4), at, it.kind);
    G.blood.spray(at, dir, 60 + E.level * 50, 1.5 + E.level * 0.4); if (E.level === 2) { this.lensBlood(6); G.vhs.hot = 1.2; }
    if (it.kind === 'shard' && !it.gone && Math.random() < 0.5) { G.sound.glass(at); this.remove(it); }
  }
  killOn(h) { this.killGlow = Math.max(this.killGlow, 0.6); }
  // blood on the lens: a few drops stuck to the camera that slowly run and fade
  lensBlood(n) {
    const cam = this.game.camera; if (!cam) return;
    for (let k = 0; k < n; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.blood[Math.floor(Math.random() * 3)], color: 0xaa1010, transparent: true, opacity: 0.85, depthTest: false }));
      s.renderOrder = 1500; const r = 0.006 + Math.random() * 0.02; s.scale.set(r, r, 1);
      s.position.set((Math.random() - 0.5) * 0.16, (Math.random() - 0.5) * 0.1, -0.13); cam.add(s); this.lens.push(s);
    }
  }
  // Cash's hands get darker and redder with every kill
  bloodyHands(hand, k) {
    const m = hand.model?.mesh?.material; if (!m) return;
    hand.blood = Math.min(0.7, (hand.blood || 0) + k);
    m.color.setRGB(1 - hand.blood * 0.25, 1 - hand.blood * 0.75, 1 - hand.blood * 0.75);
  }
  updateExec(dt) {
    const G = this.game, E = this.exec, h = E.h;
    if (!h.alive) { this.exec = null; return; }
    E.t += dt;
    h.body.anim.struggle = 0.35 + Math.sin(G.time * 7) * 0.1;
    if (E.t > 8 + E.level * 2) { // took too long: he gets loose
      this.exec = null; h.execLevel = null; h.state = 'hunt'; h.susp = 1; h.last.copy(G.player.pos); h.lostT = 0; h.say('spot'); G.director.event('spotted', h);
    }
  }
}

function headBoneDrop(kit, it, h) {
  const wp = it.mesh.getWorldPosition(new V());
  it.mesh.parent.remove(it.mesh); kit.game.scene.add(it.mesh);
  it.pos.copy(wp); it.mesh.position.copy(wp); it.vel.set(0, 0.5, 0); it.flying = true; it.mesh.scale.set(1, 1, 1);
  if (!kit.items.includes(it)) kit.items.push(it);
}

function segDist(p, a, dir, len) {
  const t = Math.max(0, Math.min(len, _b.copy(p).sub(a).dot(dir)));
  return _b.copy(a).addScaledVector(dir, t).distanceTo(p);
}
