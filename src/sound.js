// sound.js — everything you hear, synthesized in WebAudio at runtime, plus the
// voice player: recorded vo/<id>.mp3 if Nathan has made one, else speech.
import { LINE, VOICES } from './lines.js?v=44';
import { Score } from './score.js?v=44';

export class Sound {
  constructor() { this.ctx = null; this.vo = {}; this.queue = []; this.speaking = null; this.listener = null; this.subs = () => {}; this.voiceOn = {}; this.pulse = {}; }
  // how open a speaker's mouth should be right now (0..1)
  mouth(who) {
    const s = this.voiceOn[who]; if (!s) return 0;
    if (s.an) { s.an.getFloatTimeDomainData(s.buf); let e = 0; for (const x of s.buf) e += x * x; return Math.min(1, Math.sqrt(e / s.buf.length) * 9); }
    const t = performance.now() / 1000, p = this.pulse[who] || 0; this.pulse[who] = p * 0.9;
    return Math.max(0, 0.25 + Math.sin(t * 17) * 0.22 + Math.sin(t * 7.3) * 0.18 + p * 0.4);
  }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = C.createGain(); this.master.gain.value = 0.9; this.master.connect(C.destination);
    this.sfx = C.createGain(); this.sfx.connect(this.master);
    this.amb = C.createGain(); this.amb.gain.value = 0.5; this.amb.connect(this.master);
    // shared noise buffer
    const n = C.sampleRate * 2, buf = C.createBuffer(1, n, C.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // brown noise for rumble
    const bb = C.createBuffer(1, n, C.sampleRate), bd = bb.getChannelData(0); let last = 0;
    for (let i = 0; i < n; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; bd[i] = last * 3.5; }
    this.brown = bb;
    this.ambience();
    this.heart = { next: 0, rate: 0 };
    this.score = new Score(this); this.score.start();
    this.preloadVO(Object.keys(LINE)); this.sample('sfx/hint.wav', 0); // warm the hint sound
  }

  now() { return this.ctx ? this.ctx.currentTime : 0; }
  src(buf, loop = false) { const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = loop; return s; }
  // spatial output node at a world position
  at(p) {
    if (!this.ctx) return null; // audio not started yet (before the first click): stay silent, don't throw
    const C = this.ctx, pn = C.createPanner();
    pn.panningModel = 'HRTF'; pn.distanceModel = 'inverse'; pn.refDistance = 1.2; pn.rolloffFactor = 1.3; pn.maxDistance = 60;
    if (pn.positionX) { pn.positionX.value = p.x; pn.positionY.value = p.y; pn.positionZ.value = p.z; } else pn.setPosition(p.x, p.y, p.z);
    pn.connect(this.sfx); return pn;
  }
  ear(pos, fwd, upv) {
    if (!this.ctx) return; const L = this.ctx.listener;
    if (L.positionX) { L.positionX.value = pos.x; L.positionY.value = pos.y; L.positionZ.value = pos.z; L.forwardX.value = fwd.x; L.forwardY.value = fwd.y; L.forwardZ.value = fwd.z; L.upX.value = upv.x; L.upY.value = upv.y; L.upZ.value = upv.z; }
    else { L.setPosition(pos.x, pos.y, pos.z); L.setOrientation(fwd.x, fwd.y, fwd.z, upv.x, upv.y, upv.z); }
  }

  // filtered noise burst
  burst(out, { dur = 0.1, f = 1000, q = 1, type = 'bandpass', gain = 0.5, attack = 0.003, decay = null, sweep = null, t = 0, buf = null } = {}) {
    if (!this.ctx || !out) return;
    const C = this.ctx, s = this.src(buf || this.noise), fl = C.createBiquadFilter(), g = C.createGain(), t0 = this.now() + t;
    fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    if (sweep) fl.frequency.exponentialRampToValueAtTime(sweep, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (decay ?? dur));
    s.connect(fl); fl.connect(g); g.connect(out);
    s.start(t0, Math.random() * 1.5); s.stop(t0 + (decay ?? dur) + 0.05);
  }
  tone(out, { f = 200, f2 = null, dur = 0.2, type = 'sine', gain = 0.3, t = 0, attack = 0.005 } = {}) {
    if (!this.ctx || !out) return;
    const C = this.ctx, o = C.createOscillator(), g = C.createGain(), t0 = this.now() + t;
    o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + 0.05);
  }

  // ------------------------------------------------------------ ambience
  ambience() {
    const C = this.ctx;
    // city rumble
    const r = this.src(this.brown, true), lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 160;
    const g = C.createGain(); g.gain.value = 0.35; r.connect(lp); lp.connect(g); g.connect(this.amb); r.start();
    // wind through the wire
    const w = this.src(this.noise, true), bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 4;
    const wg = C.createGain(); wg.gain.value = 0.03; w.connect(bp); bp.connect(wg); wg.connect(this.amb); w.start();
    const lfo = C.createOscillator(), lg = C.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 300; lfo.connect(lg); lg.connect(bp.frequency); lfo.start();
    // the drone: two detuned low saws through a slow filter — the score
    const dg = C.createGain(); dg.gain.value = 0.015; const df = C.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 220; df.Q.value = 6;
    for (const f of [41.2, 41.6, 61.7]) { const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(df); o.start(); }
    const l2 = C.createOscillator(), l2g = C.createGain(); l2.frequency.value = 0.05; l2g.gain.value = 120; l2.connect(l2g); l2g.connect(df.frequency); l2.start();
    df.connect(dg); dg.connect(this.amb); this.drone = dg; this.droneF = df;
    // distant sirens and dogs, now and then
    const later = () => { setTimeout(() => { if (Math.random() < 0.5) this.siren(); else this.dog(); later(); }, 14000 + Math.random() * 22000); };
    later();
  }
  siren() {
    const C = this.ctx, o = C.createOscillator(), g = C.createGain(), lp = C.createBiquadFilter(), t0 = this.now();
    lp.type = 'lowpass'; lp.frequency.value = 900; o.type = 'triangle';
    for (let k = 0; k < 8; k++) { o.frequency.setValueAtTime(620, t0 + k * 1.1); o.frequency.linearRampToValueAtTime(950, t0 + k * 1.1 + 0.55); o.frequency.linearRampToValueAtTime(620, t0 + k * 1.1 + 1.1); }
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.012, t0 + 3); g.gain.linearRampToValueAtTime(0.0001, t0 + 8.8);
    o.connect(lp); lp.connect(g); g.connect(this.amb); o.start(t0); o.stop(t0 + 9);
  }
  dog() { for (let k = 0; k < 3 + Math.random() * 3; k++) this.burst(this.amb, { t: k * 0.45, dur: 0.12, f: 500, q: 3, gain: 0.03, sweep: 300 }); }
  tension(level) { // 0 calm .. 1 hunted: opens the drone filter and speeds the heart
    if (!this.ctx) return; const t = this.now();
    this.droneF.frequency.setTargetAtTime(200 + level * 900, t, 0.8);
    this.drone.gain.setTargetAtTime(0.012 + level * 0.02, t, 0.8);
    this.heart.rate = level;
  }
  tick(dt) {
    if (!this.ctx) return;
    const h = this.heart; if (h.rate < 0.15) return;
    h.next -= dt;
    if (h.next <= 0) { h.next = 60 / (70 + h.rate * 80); const g = 0.12 + h.rate * 0.3; this.tone(this.sfx, { f: 58, f2: 40, dur: 0.14, gain: g }); this.tone(this.sfx, { f: 52, f2: 38, dur: 0.14, gain: g * 0.7, t: 0.17 }); }
  }

  // ------------------------------------------------------------ effects
  step(p, kind = 'walk', surface = 'asphalt', who = 'npc') {
    if (!this.ctx) return; const out = who === 'me' ? this.sfx : this.at(p);
    const loud = kind === 'run' ? 0.5 : kind === 'sneak' ? 0.06 : 0.22;
    const f = surface === 'gravel' ? 2400 : surface === 'metal' ? 1800 : 900;
    this.burst(out, { dur: 0.07, f, q: 0.8, gain: loud * (who === 'me' ? 0.35 : 1), decay: 0.09 });
    this.burst(out, { dur: 0.05, f: 180, q: 1, type: 'lowpass', gain: loud * 0.8 * (who === 'me' ? 0.4 : 1) });
    if (surface === 'gravel') this.burst(out, { dur: 0.12, f: 4000, q: 2, gain: loud * 0.3, t: 0.02 });
  }
  glass(p) { const o = this.at(p); this.burst(o, { dur: 0.5, f: 5200, q: 2, gain: 0.7, decay: 0.45 }); for (let k = 0; k < 7; k++) this.tone(o, { f: 2500 + Math.random() * 4000, dur: 0.15 + Math.random() * 0.3, gain: 0.08, t: Math.random() * 0.15, type: 'triangle' }); }
  thud(p, big = 1) { const o = this.at(p); this.burst(o, { dur: 0.15, f: 140, type: 'lowpass', gain: 0.6 * big }); this.burst(o, { dur: 0.06, f: 1200, gain: 0.15 * big }); }
  clank(p) { const o = this.at(p); this.tone(o, { f: 820, dur: 0.6, type: 'triangle', gain: 0.18 }); this.tone(o, { f: 1290, dur: 0.4, type: 'triangle', gain: 0.1 }); this.burst(o, { dur: 0.05, f: 3000, gain: 0.3 }); }
  whoosh(p) { this.burst(p ? this.at(p) : this.sfx, { dur: 0.22, f: 600, sweep: 1800, q: 2, gain: 0.25, attack: 0.08 }); }
  stab(p, deep = 1) { const o = this.at(p); this.burst(o, { dur: 0.12, f: 320, q: 3, gain: 0.5 * deep, sweep: 160 }); this.burst(o, { dur: 0.25, f: 700, q: 6, gain: 0.12 * deep, t: 0.05, sweep: 300 }); }
  crunch(p) { const o = this.at(p); this.burst(o, { dur: 0.18, f: 260, type: 'lowpass', gain: 0.9 }); for (let k = 0; k < 5; k++) this.burst(o, { dur: 0.03, f: 1800 + k * 300, q: 4, gain: 0.25, t: k * 0.015 }); }
  rustle(p, dur = 0.4) { const o = p ? this.at(p) : this.sfx; for (let k = 0; k < dur * 30; k++) this.burst(o, { dur: 0.02, f: 5000 + Math.random() * 3000, q: 1.5, gain: 0.04 + Math.random() * 0.05, t: k / 30 + Math.random() * 0.02 }); }
  gurgle(p) { const o = this.at(p); for (let k = 0; k < 8; k++) this.tone(o, { f: 90 + Math.random() * 60, f2: 60, dur: 0.12, type: 'sawtooth', gain: 0.05, t: k * 0.13 }); this.burst(o, { dur: 0.9, f: 400, q: 8, gain: 0.08, sweep: 200 }); }
  hurt() { this.burst(this.sfx, { dur: 0.2, f: 180, type: 'lowpass', gain: 0.8 }); this.tone(this.sfx, { f: 3000, dur: 1.2, gain: 0.03 }); }
  camBeep(p) { this.tone(this.at(p), { f: 1800, dur: 0.08, type: 'square', gain: 0.04 }); }
  spark(p) { const o = this.at(p); this.burst(o, { dur: 0.3, f: 6000, q: 0.7, gain: 0.3 }); this.tone(o, { f: 120, dur: 0.4, type: 'square', gain: 0.05 }); }
  stinger() { // a hit of the score when something big happens
    if (!this.ctx) return; const C = this.ctx, t0 = this.now();
    for (const f of [55, 82.4, 116.5]) { const o = C.createOscillator(), g = C.createGain(); o.type = 'sawtooth'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2); o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + 2.3); }
    this.burst(this.master, { dur: 1.6, f: 3000, q: 0.5, gain: 0.08, attack: 0.01, sweep: 400 });
  }
  lock(lvl) { // the execution meter ticking up a level
    const f = [520, 780, 1170][lvl] || 520;
    this.tone(this.sfx, { f, dur: 0.12, type: 'square', gain: 0.05 }); this.tone(this.sfx, { f: f * 1.5, dur: 0.1, type: 'square', gain: 0.03, t: 0.05 });
    if (lvl === 2) this.burst(this.sfx, { dur: 0.4, f: 200, type: 'lowpass', gain: 0.25 });
  }
  pills() { for (let k = 0; k < 6; k++) this.tone(this.sfx, { f: 2400 + Math.random() * 1500, dur: 0.05, type: 'triangle', gain: 0.04, t: k * 0.04 + Math.random() * 0.02 }); }
  knock(p) { // two raps of the knuckles: a dull thump and a hard click
    for (const [t, g] of [[0, 1], [0.17, 0.85]]) {
      this.burst(this.sfx, { t, dur: 0.07, f: 220, type: 'lowpass', gain: 0.9 * g, attack: 0.001 });
      this.burst(this.sfx, { t, dur: 0.035, f: 1600, q: 3, gain: 0.55 * g, attack: 0.001 });
      this.tone(this.sfx, { t, f: 180, f2: 120, dur: 0.06, type: 'triangle', gain: 0.35 * g, attack: 0.001 });
    }
  }
  // a man's grunt: a buzzy voice through two formants, pitch falling. muffled = through a plastic bag
  grunt(p, pain = 1, muffled = false, pitch = 1) {
    if (!this.ctx) return;
    const C = this.ctx, out = p ? this.at(p) : this.sfx, t0 = this.now(), dur = 0.18 + Math.random() * 0.25 * pain;
    const o = C.createOscillator(); o.type = 'sawtooth'; const f0 = (95 + Math.random() * 45 + pain * 20) * pitch;
    o.frequency.setValueAtTime(f0 * 1.25, t0); o.frequency.exponentialRampToValueAtTime(f0 * 0.75, t0 + dur);
    const vib = C.createOscillator(), vg = C.createGain(); vib.frequency.value = 18 + Math.random() * 10; vg.gain.value = 6 * pain; vib.connect(vg); vg.connect(o.frequency);
    const mix = C.createGain(); mix.gain.value = 0;
    for (const [f, q, a] of [[600 + Math.random() * 200, 5, 1], [1150 + Math.random() * 250, 7, 0.6], [2500, 6, 0.25]]) { const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * (muffled ? 0.7 : 1); bp.Q.value = q; const g = C.createGain(); g.gain.value = a; o.connect(bp); bp.connect(g); g.connect(mix); }
    const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = muffled ? 650 : 4000;
    mix.gain.setValueAtTime(0.0001, t0); mix.gain.exponentialRampToValueAtTime(0.5 * Math.min(1.4, pain), t0 + 0.02); mix.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    mix.connect(lp); lp.connect(out); o.start(t0); vib.start(t0); o.stop(t0 + dur + 0.05); vib.stop(t0 + dur + 0.05);
    this.burst(out, { dur: dur * 0.8, f: muffled ? 500 : 1400, q: 1, gain: 0.08 * pain, attack: 0.01 }); // breath
  }
  // a man screaming in pain: a strained, cracking voice through "aah" formants. muffled = through a
  // hand clamped over his mouth or a bag: the sound is trapped, low, and comes out in sobbing pushes
  painScream(p, pain = 1, muffled = false) {
    if (!this.ctx) return;
    const C = this.ctx, out = p ? this.at(p) : this.sfx, t0 = this.now(), dur = (muffled ? 0.5 : 0.55) + Math.random() * 0.5 * pain;
    const o = C.createOscillator(); o.type = 'sawtooth';
    const f0 = (muffled ? 150 : 210) + Math.random() * 70 + pain * 30;
    o.frequency.setValueAtTime(f0 * 0.8, t0); o.frequency.linearRampToValueAtTime(f0 * 1.35, t0 + dur * 0.25); o.frequency.exponentialRampToValueAtTime(f0 * 0.7, t0 + dur);
    if (!muffled && Math.random() < 0.6) o.frequency.setValueAtTime(f0 * 1.9, t0 + dur * (0.3 + Math.random() * 0.2)); // the voice cracks
    // strain: fast irregular jitter on the pitch
    const j = C.createOscillator(), jg = C.createGain(); j.type = 'square'; j.frequency.value = 9 + Math.random() * 14; jg.gain.value = f0 * 0.06 * pain; j.connect(jg); jg.connect(o.frequency);
    const mix = C.createGain(); mix.gain.value = 0;
    const F = muffled ? [[300, 4, 1], [700, 5, 0.4], [1300, 6, 0.1]] : [[780, 5, 1], [1180, 6, 0.8], [2600, 7, 0.35], [3400, 8, 0.15]];
    for (const [f, q, a] of F) { const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * (0.9 + Math.random() * 0.2); bp.Q.value = q; const g = C.createGain(); g.gain.value = a; o.connect(bp); bp.connect(g); g.connect(mix); }
    const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = muffled ? 520 : 5200;
    const env = C.createGain(); env.gain.setValueAtTime(0.0001, t0); env.gain.exponentialRampToValueAtTime(0.42 * Math.min(1.5, pain) * (muffled ? 1.4 : 1), t0 + 0.04); env.gain.setValueAtTime(0.42 * Math.min(1.5, pain), t0 + dur * 0.6); env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    if (muffled) { // pushes of air against the hand: amplitude pulses
      const am = C.createOscillator(), ag = C.createGain(); am.frequency.value = 5 + Math.random() * 3; ag.gain.value = 0.5; am.connect(ag); ag.connect(mix.gain); am.start(t0); am.stop(t0 + dur + 0.05);
    }
    mix.connect(lp); lp.connect(env); env.connect(out); o.start(t0); j.start(t0); o.stop(t0 + dur + 0.05); j.stop(t0 + dur + 0.05);
    this.burst(out, { dur: dur * 0.9, f: muffled ? 400 : 2200, q: 0.7, gain: (muffled ? 0.12 : 0.1) * pain, attack: 0.02 }); // breath and spit
  }
  // Cash putting his weight behind it
  effort(p, k = 1) { this.grunt(p, 0.6 * k, false, 0.72); }
  // the tape chewing: a hiss of static, crackle and mains hum, not placed in the world
  tapeStatic(dur = 0.25, gain = 0.12) {
    if (!this.ctx) return;
    this.burst(this.sfx, { dur, f: 4500, q: 0.4, gain, attack: 0.002 });
    this.burst(this.sfx, { dur: dur * 0.7, f: 900, q: 0.5, gain: gain * 0.5, attack: 0.002, t: 0.01 });
    for (let k = 0; k < 6; k++) this.burst(this.sfx, { dur: 0.006, f: 2500 + Math.random() * 4000, q: 2, gain: gain * 1.4, t: Math.random() * dur });
    this.tone(this.sfx, { f: 60, dur, type: 'square', gain: gain * 0.12 });
  }
  // Piggsy's chainsaw: an engine buzz that follows him and revs when he's after you
  sawLoop() {
    if (!this.ctx) return null;
    const C = this.ctx, o = C.createOscillator(), o2 = C.createOscillator(), n = this.src(this.noise, true), bp = C.createBiquadFilter(), g = C.createGain(), pn = C.createPanner();
    o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = 70; o2.frequency.value = 141; bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1;
    pn.panningModel = 'HRTF'; pn.refDistance = 2; pn.rolloffFactor = 1.1; g.gain.value = 0;
    const lfo = C.createOscillator(), lg = C.createGain(); lfo.frequency.value = 24; lg.gain.value = 18; lfo.connect(lg); lg.connect(o.frequency);
    o.connect(bp); o2.connect(bp); n.connect(bp); bp.connect(g); g.connect(pn); pn.connect(this.sfx); o.start(); o2.start(); n.start(); lfo.start();
    let dead = false;
    return (p, rev, stop) => {
      if (dead) return; if (stop) { dead = true; g.gain.setTargetAtTime(0, this.now(), 0.3); return; }
      if (pn.positionX) { pn.positionX.value = p.x; pn.positionY.value = p.y; pn.positionZ.value = p.z; }
      g.gain.setTargetAtTime(0.05 + rev * 0.12, this.now(), 0.1); o.frequency.setTargetAtTime(60 + rev * 60, this.now(), 0.15); bp.frequency.setTargetAtTime(700 + rev * 1400, this.now(), 0.15);
    };
  }
  pig(at, id) {
    if (!this.ctx) return; const now = this.now();
    if (this.pigT && now - this.pigT < 1.2) return; this.pigT = now;
    const out = at ? this.at(at) : this.sfx, squeal = id === 'piggsy_2';
    for (let k = 0; k < (squeal ? 1 : 3); k++) {
      const C = this.ctx, o = C.createOscillator(), g = C.createGain(), bp = C.createBiquadFilter(), t0 = now + k * 0.28;
      o.type = 'sawtooth'; bp.type = 'bandpass'; bp.Q.value = 4;
      if (squeal) { o.frequency.setValueAtTime(500, t0); o.frequency.exponentialRampToValueAtTime(1400, t0 + 0.35); o.frequency.exponentialRampToValueAtTime(900, t0 + 0.9); bp.frequency.value = 1800; }
      else { o.frequency.setValueAtTime(110 + Math.random() * 30, t0); o.frequency.exponentialRampToValueAtTime(70, t0 + 0.22); bp.frequency.value = 500; }
      const vib = C.createOscillator(), vg = C.createGain(); vib.frequency.value = squeal ? 30 : 45; vg.gain.value = squeal ? 80 : 25; vib.connect(vg); vg.connect(o.frequency);
      const dur = squeal ? 1.0 : 0.25;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(squeal ? 0.5 : 0.6, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(bp); bp.connect(g); g.connect(out); o.start(t0); vib.start(t0); o.stop(t0 + dur + 0.05); vib.stop(t0 + dur + 0.05);
      this.burst(out, { t: t0 - now, dur: dur * 0.7, f: squeal ? 2500 : 300, q: 1, gain: 0.15, attack: 0.01 });
    }
  }
  bang(p) { // a rifle shot: crack, body, room tail
    const o = p ? this.at(p) : this.sfx;
    this.burst(o, { dur: 0.05, f: 3000, q: 0.5, gain: 1.0, attack: 0.001 });
    this.burst(o, { dur: 0.25, f: 220, type: 'lowpass', gain: 1.2, attack: 0.001 });
    this.burst(o, { dur: 0.9, f: 700, q: 0.4, gain: 0.12, attack: 0.02, t: 0.05 });
  }
  click() { this.tone(this.sfx, { f: 1800, dur: 0.03, type: 'square', gain: 0.08 }); }
  nail(p) { // pneumatic nailer: a hard air thwack and the clack of the driver
    if (!this.ctx) return; const o = p ? this.at(p) : this.sfx;
    this.burst(o, { dur: 0.06, f: 1400, q: 0.7, gain: 0.7, attack: 0.001 });
    this.burst(o, { dur: 0.12, f: 400, type: 'lowpass', gain: 0.6, attack: 0.001 });
    this.tone(o, { f: 2600, dur: 0.02, type: 'square', gain: 0.06 });
  }
  rattle(p) { // a chain-link gate shaken and dragged open
    if (!this.ctx) return; const o = p ? this.at(p) : this.sfx;
    for (let k = 0; k < 6; k++) this.burst(o, { t: k * 0.07, dur: 0.06, f: 2400 + Math.random() * 1600, q: 3, gain: 0.25, attack: 0.002 });
    this.burst(o, { t: 0.1, dur: 0.6, f: 300, q: 0.6, gain: 0.25, attack: 0.05 });
  }
  buzz(p) { // the electric lock letting go
    if (!this.ctx) return; const o = p ? this.at(p) : this.sfx;
    this.tone(o, { f: 120, dur: 0.6, type: 'sawtooth', gain: 0.12 }); this.burst(o, { t: 0.55, dur: 0.08, f: 900, q: 1, gain: 0.5, attack: 0.001 });
  }
  // play a sound file from the game folder (cached after the first load)
  sample(url, gain = 1) {
    if (!this.ctx) return; this.samples = this.samples || {};
    if (!this.samples[url]) this.samples[url] = fetch(url).then((r) => r.arrayBuffer()).then((b) => this.ctx.decodeAudioData(b)).catch(() => null);
    this.samples[url].then((buf) => { if (!buf) return; const s = this.src(buf), g = this.ctx.createGain(); g.gain.value = gain; s.connect(g); g.connect(this.sfx); s.start(); });
  }
  // flies: a thin, wavering buzz that follows the nearest swarm
  buzzLoop() {
    const C = this.ctx, o = C.createOscillator(), o2 = C.createOscillator(), g = C.createGain(), bp = C.createBiquadFilter(), pn = C.createPanner();
    o.type = 'sawtooth'; o.frequency.value = 205; o2.type = 'sawtooth'; o2.frequency.value = 211; bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 2;
    const lfo = C.createOscillator(), lg = C.createGain(); lfo.frequency.value = 7; lg.gain.value = 30; lfo.connect(lg); lg.connect(o.frequency); lfo.start();
    pn.panningModel = 'HRTF'; pn.refDistance = 0.8; pn.rolloffFactor = 1.6; g.gain.value = 0;
    o.connect(bp); o2.connect(bp); bp.connect(g); g.connect(pn); pn.connect(this.sfx); o.start(); o2.start();
    let dead = false;
    return (p, level, stop) => { if (dead) return; if (stop) { dead = true; g.gain.setTargetAtTime(0, this.now(), 0.2); return; } if (pn.positionX) { pn.positionX.value = p.x; pn.positionY.value = p.y; pn.positionZ.value = p.z; } g.gain.setTargetAtTime(level * 0.05 * (0.7 + Math.random() * 0.3), this.now(), 0.08); };
  }
  // fluorescent tubes: a 100 Hz mains hum with a crackle now and then
  humLoop() {
    const C = this.ctx, o = C.createOscillator(), g = C.createGain(), lp = C.createBiquadFilter();
    o.type = 'square'; o.frequency.value = 100; lp.type = 'lowpass'; lp.frequency.value = 400; g.gain.value = 0.006;
    o.connect(lp); lp.connect(g); g.connect(this.amb); o.start();
    return (stop) => { if (stop) g.gain.setTargetAtTime(0, this.now(), 0.2); };
  }
  drip(p) { const o = this.at(p); const f = 900 + Math.random() * 900; this.tone(o, { f, f2: f * 2.2, dur: 0.06, type: 'sine', gain: 0.12 }); this.burst(o, { dur: 0.02, f: 3000, q: 4, gain: 0.04, t: 0.01 }); }
  squeak(p) { const o = this.at(p); for (let k = 0; k < 2 + Math.random() * 3; k++) this.tone(o, { f: 3200 + Math.random() * 1500, f2: 2600, dur: 0.05 + Math.random() * 0.05, type: 'sine', gain: 0.05, t: k * 0.09 }); this.burst(o, { dur: 0.2, f: 5000, q: 2, gain: 0.02, t: 0.05 }); }
  scream() { // someone, far off, somewhere in the building
    const C = this.ctx, o = C.createOscillator(), g = C.createGain(), bp = C.createBiquadFilter(), lp = C.createBiquadFilter(), t0 = this.now();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(380, t0); o.frequency.linearRampToValueAtTime(620, t0 + 0.5); o.frequency.linearRampToValueAtTime(300, t0 + 1.8);
    const vib = C.createOscillator(), vg = C.createGain(); vib.frequency.value = 6; vg.gain.value = 20; vib.connect(vg); vg.connect(o.frequency);
    bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 3; lp.type = 'lowpass'; lp.frequency.value = 1400;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.03, t0 + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.9);
    o.connect(bp); bp.connect(lp); lp.connect(g); g.connect(this.amb); o.start(t0); vib.start(t0); o.stop(t0 + 2); vib.stop(t0 + 2);
  }
  radio() { this.burst(this.sfx, { dur: 0.06, f: 2500, q: 0.6, gain: 0.12 }); this.burst(this.sfx, { dur: 0.35, f: 1800, q: 1, gain: 0.025, t: 0.05 }); }

  // ------------------------------------------------------------ voices
  // say(id, {at}) — queued per speaker so the Director never talks over himself
  say(id, opts = {}) {
    const L = LINE[id]; if (!L) return;
    if (L.who === 'PIGGSY') { this.pig(opts.at, id); return; } // no words: snorts and squeals
    const who = L.who, isDir = who === 'DIRECTOR';
    if (!isDir && this.speaking && !this.speaking.isDir && !opts.force) { if (performance.now() - this.speaking.t < 1500) return; }
    this.queue.push({ L, opts, isDir });
    if (!this.busy) this.next();
  }
  async next() {
    const it = this.queue.shift(); if (!it) { this.busy = false; this.speaking = null; return; }
    this.busy = true; this.speaking = { isDir: it.isDir, t: performance.now() };
    const { L, opts } = it;
    this.subs(L, true);
    if (it.isDir && this.ctx) this.radio();
    const done = () => { this.subs(L, false); delete this.voiceOn[L.who]; setTimeout(() => this.next(), 250); };
    const buf = await this.loadVO(L.id);
    if (buf && this.ctx) {
      const s = this.src(buf); let out = opts.at ? this.at(opts.at) : this.sfx;
      if (it.isDir) { // earpiece: bandpass and a touch of grit
        const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 0.7;
        const ws = this.ctx.createWaveShaper(); const c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 2.2); } ws.curve = c;
        s.connect(bp); bp.connect(ws); ws.connect(this.sfx);
      } else s.connect(out);
      const an = this.ctx.createAnalyser(); an.fftSize = 512; s.connect(an); this.voiceOn[L.who] = { an, buf: new Float32Array(512) };
      s.onended = done; s.start(); return;
    }
    if ('speechSynthesis' in window) {
      const v = VOICES[L.who];
      // speak sentence by sentence: browsers drop long utterances partway through
      const parts = L.text.match(/[^.!?]+[.!?]*\s*/g) || [L.text];
      const pick = castVoice(L.who);
      let ended = false; const fin = () => { if (!ended) { ended = true; done(); } };
      const say = (i) => {
        if (i >= parts.length) { fin(); return; }
        const u = new SpeechSynthesisUtterance(parts[i].trim());
        u.pitch = v.pitch; u.rate = v.rate; u.volume = it.isDir ? 0.95 : 0.8;
        if (pick) { u.voice = pick.voice; u.pitch = pick.pitch; u.rate = pick.rate; }
        let next = false; const go = () => { if (!next) { next = true; say(i + 1); } };
        u.onend = go; u.onerror = go; setTimeout(go, 2500 + parts[i].length * 110); // safety net if onend never fires
        u.onstart = () => { this.voiceOn[L.who] = {}; }; u.onboundary = () => { this.pulse[L.who] = 1; };
        speechSynthesis.speak(u);
      };
      say(0);
    } else setTimeout(done, 1200 + L.text.length * 60);
  }
  // Nathan's own recording (vo/<id>.mp3) wins; otherwise the shipped voice (vo/<id>.m4a).
  // Speech synthesis is only the last resort: the Quest browser has no voices.
  loadVO(id) {
    if (!(id in this.vo)) this.vo[id] = (async () => {
      for (const ext of ['mp3', 'm4a']) {
        try {
          const r = await fetch(`vo/${id}.${ext}`);
          if (r.ok && this.ctx) return await this.ctx.decodeAudioData(await r.arrayBuffer());
        } catch (e) {}
      }
      return null;
    })();
    return this.vo[id];
  }
  preloadVO(ids) { let i = 0; const next = () => { if (i < ids.length) { this.loadVO(ids[i++]).finally(next); } }; for (let k = 0; k < 4; k++) next(); }
  idle() { return !this.busy && !this.queue.length; }
  hush() { this.queue.length = 0; if ('speechSynthesis' in window) speechSynthesis.cancel(); }
}

// ------------------------------------------------------------ casting
// Speech voices stand in until Nathan's recordings exist. Only plain male
// English voices; never the macOS novelty voices (Cellos, Organ, Good News...)
// that sing their lines.
const NOVELTY = /bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|albert|junior|grandma|grandpa/i;
const FEMALE = /samantha|karen|kathy|moira|tessa|flo\b|flo |sandy|shelley|victoria|fiona|zira|susan|serena|martha|catherine|allison|ava|joanna|kate|female|woman|google us english|google uk english female/i;
const CAST = {
  NEWS: { prefer: [/^fred/i, /reed \(english \(united states/i, /aaron/i, /alex/i], lang: /en-us/i, pitch: 1.0, rate: 1.02 },
  // a calm, educated British voice in your ear
  DIRECTOR: { prefer: [/^daniel/i, /arthur/i, /reed \(english \(united kingdom/i, /google uk english male/i, /oliver/i, /george/i, /rocko \(english \(united kingdom/i], lang: /en-gb/i, pitch: 0.92, rate: 0.9 },
  // a tired American man
  CASH: { prefer: [/reed \(english \(united states/i, /aaron/i, /alex/i, /tom/i, /rocko \(english \(united states/i, /eddy \(english \(united states/i, /fred/i], lang: /en-us/i, pitch: 0.85, rate: 0.95 },
  HUNTER_A: { prefer: [/rocko \(english \(united states/i, /ralph/i, /eddy \(english \(united states/i, /fred/i], lang: /en-us/i, pitch: 0.9, rate: 1.05 },
  HUNTER_B: { prefer: [/ralph/i, /rocko \(english \(united kingdom/i, /fred/i], lang: /en/i, pitch: 0.8, rate: 0.95 },
  HUNTER_C: { prefer: [/eddy \(english \(united states/i, /eddy/i, /rocko/i, /reed/i], lang: /en-us/i, pitch: 1.05, rate: 1.12 },
};
const castCache = {};
function castVoice(who) {
  if (castCache[who]) return castCache[who];
  const all = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang) && !NOVELTY.test(v.name));
  if (!all.length) return null;
  const c = CAST[who] || CAST.HUNTER_A, male = all.filter((v) => !FEMALE.test(v.name));
  let voice = null;
  for (const re of c.prefer) { voice = male.find((v) => re.test(v.name)); if (voice) break; }
  // unknown platform (Quest): any non-female voice in the right accent, else any; drop the pitch a touch so it reads as a man
  let pitch = c.pitch;
  if (!voice) { voice = male.find((v) => c.lang.test(v.lang)) || male[0] || all[0]; pitch = Math.min(pitch, 0.82); }
  return (castCache[who] = { voice, pitch, rate: c.rate });
}
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { for (const k in castCache) delete castCache[k]; };
