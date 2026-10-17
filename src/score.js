// score.js — the soundtrack, played live. One aging mono/poly-style synth
// (detuned saws and squares into a resonant filter), grimy synthesized drums,
// metal, all pushed through distortion and an 8-bit crusher. Low repeating
// Carpenter-style loops in A minor. It moves between states in real time:
//   theme   — menu and the opening tape
//   hiding  — a faint drone and a sub-bass throb, like held breath
//   suspect — a ticking clock, metal clangs, a rising synth line
//   pursuit — driving industrial drums, bass ostinato, piercing stabs
//   combat  — all of it, plus mechanical noise and frantic percussion
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const A1 = 33, C2 = 36, D2 = 38, E2 = 40, F1 = 29, G1 = 31;
// layer mix per state: [sub, bass, arp, tick, clang, kick, snare, hat, stab, noise, pad]
const MIX = {
  silent:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  theme:   [0.5, 0.8, 0.0, 0.0, 0.15, 0.25, 0.0, 0.25, 0.0, 0.0, 0.7],
  hiding:  [0.9, 0.0, 0.0, 0.0, 0.08, 0.0, 0.0, 0.0, 0.0, 0.0, 0.45],
  suspect: [0.6, 0.35, 0.7, 0.8, 0.6, 0.0, 0.0, 0.15, 0.0, 0.0, 0.4],
  pursuit: [0.4, 1.0, 0.25, 0.3, 0.5, 1.0, 0.9, 0.7, 0.8, 0.15, 0.2],
  combat:  [0.4, 1.0, 0.4, 0.5, 0.9, 1.0, 1.0, 1.0, 1.0, 0.8, 0.1],
};
const BPM = { silent: 60, theme: 92, hiding: 60, suspect: 96, pursuit: 138, combat: 150 };
// sixteen-step bass ostinato per bar, cycling chords
const BASS = [
  [A1, 0, A1, 0, A1, A1, 0, A1, 0, A1, A1, 0, C2, 0, A1, 0],
  [A1, 0, A1, 0, A1, A1, 0, A1, 0, A1, A1, 0, G1, 0, A1, 0],
  [F1, 0, F1, 0, F1, F1, 0, F1, 0, F1, F1, 0, G1, 0, F1, 0],
  [E2 - 12, 0, E2 - 12, 0, E2 - 12, E2 - 12, 0, E2 - 12, 0, E2 - 12, E2 - 12, 0, G1, 0, A1, 0],
];
const ROOT = [A1, A1, F1, E2 - 12];

export class Score {
  constructor(sound) { this.s = sound; this.state = 'silent'; this.on = false; }

  start() {
    const S = this.s, C = S.ctx; if (this.on || !C) return; this.on = true;
    this.out = C.createGain(); this.out.gain.value = 0.26;
    // the grime: soft clip -> 8-bit-ish crush -> lo-fi lowpass
    const dist = C.createWaveShaper(); dist.curve = curve((x) => Math.tanh(x * 2.6)); dist.oversample = '2x';
    const crush = C.createWaveShaper(); crush.curve = curve((x) => Math.round(x * 24) / 24);
    const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200; lp.Q.value = 0.4;
    this.bus = C.createGain(); this.bus.connect(dist); dist.connect(crush); crush.connect(lp); lp.connect(this.out); this.out.connect(S.master);
    this.state = 'silent'; this.layers = MIX.silent.map((v) => { const g = C.createGain(); g.gain.value = v; g.connect(this.bus); return g; });
    this.sustained();
    this.step = 0; this.bar = 0; this.next = C.currentTime + 0.1; this.arpUp = 0;
    this.timer = setInterval(() => this.schedule(), 25);
  }
  stop() { if (!this.on) return; clearInterval(this.timer); this.on = false; this.out.gain.setTargetAtTime(0, this.s.ctx.currentTime, 0.3); }

  set(state) {
    if (!this.on || state === this.state || !MIX[state]) return;
    this.state = state; const t = this.s.ctx.currentTime;
    const fast = state === 'pursuit' || state === 'combat';
    MIX[state].forEach((v, i) => this.layers[i].gain.setTargetAtTime(v, t, fast ? 0.08 : 0.9));
    if (fast) this.stab(t + 0.01, 1.2); // the moment you're seen
  }

  // drone pad + sub throb run continuously; the sub pulses with the beat in schedule()
  sustained() {
    const C = this.s.ctx;
    const padF = C.createBiquadFilter(); padF.type = 'lowpass'; padF.frequency.value = 600; padF.Q.value = 2;
    for (const [n, d] of [[A1 + 12, -6], [A1 + 12, 7], [E2, 3], [C2 + 12, -4]]) {
      const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(n); o.detune.value = d; o.connect(padF); o.start();
    }
    const lfo = C.createOscillator(), lg = C.createGain(); lfo.frequency.value = 0.04; lg.gain.value = 350; lfo.connect(lg); lg.connect(padF.frequency); lfo.start();
    const pg = C.createGain(); pg.gain.value = 0.07; padF.connect(pg); pg.connect(this.layers[10]);
    this.sub = C.createOscillator(); this.sub.type = 'sine'; this.sub.frequency.value = NOTE(A1 - 12) * 1.0;
    this.subG = C.createGain(); this.subG.gain.value = 0; this.sub.connect(this.subG); this.subG.connect(this.layers[0]); this.sub.start();
  }

  schedule() {
    const C = this.s.ctx;
    while (this.next < C.currentTime + 0.12) {
      this.play(this.step, this.next);
      this.next += 60 / BPM[this.state] / 4;
      this.step = (this.step + 1) % 16; if (this.step === 0) this.bar = (this.bar + 1) % 4;
    }
  }

  play(st, t) {
    const L = this.layers, m = MIX[this.state], bar = this.bar;
    // sub throb on every beat (slow breathing when hiding)
    if (st % 4 === 0 && m[0] > 0) { const g = this.subG.gain; g.cancelScheduledValues(t); g.setValueAtTime(0.0001, t); g.linearRampToValueAtTime(0.5, t + 0.04); g.exponentialRampToValueAtTime(0.0001, t + 0.5); this.sub.frequency.setValueAtTime(NOTE(ROOT[bar] - 12), t); }
    // bass ostinato
    const b = BASS[bar][st]; if (b && m[1] > 0) this.mono(L[1], NOTE(b), t, 0.18, 0.5);
    // rising synth line: up an arpeggio, a semitone higher every bar
    if (m[2] > 0 && st % 2 === 0) { const arp = [0, 3, 7, 10, 12, 15, 19, 22]; const n = ROOT[bar] + 36 + arp[(st / 2) % 8] + this.arpUp; this.lead(L[2], NOTE(n), t, 0.16); if (st === 14) this.arpUp = (this.arpUp + 1) % 6; }
    // the clock: tick ... tock
    if (m[3] > 0 && st % 4 === 0) this.tick(L[3], t, st % 8 === 0 ? 4200 : 2800);
    // metal: random clangs, more often when it's bad
    if (m[4] > 0 && Math.random() < (this.state === 'combat' ? 0.25 : this.state === 'suspect' ? 0.09 : 0.03)) this.clang(L[4], t);
    // drums
    if (m[5] > 0 && (st % 4 === 0 || (this.state === 'combat' && st % 8 === 6) || (this.state === 'pursuit' && st === 10))) this.kick(L[5], t);
    if (m[6] > 0 && (st === 4 || st === 12 || (this.state === 'combat' && (st === 14 || st === 15)))) this.snare(L[6], t);
    if (m[7] > 0 && st % 2 === 1) this.hat(L[7], t, this.state === 'theme' ? 0.15 : 0.3);
    if (m[7] > 0 && this.state === 'combat') this.hat(L[7], t, 0.18);
    // stabs at bar starts in pursuit/combat
    if (m[8] > 0 && st === 0) this.stab(t, 1);
    if (m[8] > 0 && this.state === 'combat' && st === 8) this.stab(t, 0.8);
    // mechanical noise bursts
    if (m[9] > 0 && Math.random() < 0.35) this.s.burst(L[9], { t: t - this.s.ctx.currentTime, dur: 0.08, f: 300 + Math.random() * 3000, q: 6, gain: 0.25, attack: 0.002 });
  }

  // ---- instruments
  mono(out, f, t, dur, gain) { // the Mono/Poly bass: two detuned saws + a square sub through a plucked resonant filter
    const C = this.s.ctx, fl = C.createBiquadFilter(), g = C.createGain();
    fl.type = 'lowpass'; fl.Q.value = 8; fl.frequency.setValueAtTime(1400, t); fl.frequency.exponentialRampToValueAtTime(160, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.4);
    for (const [type, mul, det] of [['sawtooth', 1, -8], ['sawtooth', 1, 9], ['square', 0.5, 0]]) { const o = C.createOscillator(); o.type = type; o.frequency.value = f * mul; o.detune.value = det; o.connect(fl); o.start(t); o.stop(t + dur * 1.5); }
    fl.connect(g); g.connect(out);
  }
  lead(out, f, t, dur) {
    const C = this.s.ctx, o = C.createOscillator(), fl = C.createBiquadFilter(), g = C.createGain();
    o.type = 'square'; o.frequency.value = f; fl.type = 'bandpass'; fl.frequency.value = f * 2; fl.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  stab(t, k) { // piercing chord stab: A minor with a flat second on top
    const C = this.s.ctx, g = C.createGain(), fl = C.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = 300;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2 * k, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    for (const n of [57, 60, 64, 70]) { const o = C.createOscillator(); o.type = 'sawtooth'; o.frequency.value = NOTE(n); o.detune.value = (Math.random() - 0.5) * 20; o.connect(fl); o.start(t); o.stop(t + 0.5); }
    fl.connect(g); g.connect(this.layers[8]);
  }
  tick(out, t, f) { this.s.burst(out, { t: t - this.s.ctx.currentTime, dur: 0.025, f, q: 12, gain: 0.35, attack: 0.001 }); }
  hat(out, t, gain) { this.s.burst(out, { t: t - this.s.ctx.currentTime, dur: 0.03, f: 8000, type: 'highpass', q: 0.5, gain, attack: 0.001 }); }
  kick(out, t) {
    const C = this.s.ctx, o = C.createOscillator(), g = C.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.32);
    this.s.burst(out, { t: t - C.currentTime, dur: 0.02, f: 2500, q: 1, gain: 0.25, attack: 0.001 }); // beater click
  }
  snare(out, t) { // a dirty sampled-sounding snare: tone + crushed noise
    const C = this.s.ctx; this.s.burst(out, { t: t - C.currentTime, dur: 0.18, f: 1800, q: 0.7, gain: 0.6, attack: 0.001 });
    this.s.tone(out, { t: t - C.currentTime, f: 210, f2: 150, dur: 0.08, type: 'triangle', gain: 0.35, attack: 0.001 });
  }
  clang(out, t) { // inharmonic metal partials, like hitting a pipe
    const C = this.s.ctx, base = 200 + Math.random() * 500, g = C.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9 + Math.random());
    for (const r of [1, 1.47, 2.09, 2.76, 3.9]) { const o = C.createOscillator(); o.type = 'square'; o.frequency.value = base * r; o.connect(g); o.start(t); o.stop(t + 2); }
    const bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = base * 2; bp.Q.value = 3; g.connect(bp); bp.connect(out);
  }
}

function curve(f) { const n = 2048, c = new Float32Array(n); for (let i = 0; i < n; i++) c[i] = f(i / (n - 1) * 2 - 1); return c; }
