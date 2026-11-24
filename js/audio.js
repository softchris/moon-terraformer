// Audio: Kenney sci-fi sound effects + a procedurally generated ambient theme (WebAudio, no music files).
const DIR = 'sounds/Audio/';

// logical name -> { file(s), volume, rate }
const SFX = {
  add:       { f: ['forceField_000'], v: 0.28, r: [1.5, 1.7] },
  connect:   { f: ['laserSmall_001', 'laserSmall_002'], v: 0.16, r: [0.7, 0.8] },
  remove:    { f: ['slime_000'], v: 0.3, r: [0.9, 1.1] },
  click:     { f: ['laserRetro_000'], v: 0.12, r: [1.3, 1.5] },
  step:      { f: ['laserRetro_001', 'laserRetro_002'], v: 0.12, r: [1.6, 2.0] },
  error:     { f: ['impactMetal_000'], v: 0.35, r: [0.6, 0.7] },
  fail:      { f: ['impactMetal_002'], v: 0.35, r: [0.5, 0.6] },
  success:   { f: ['forceField_003'], v: 0.5, r: [1.0, 1.0] },
  touchdown: { f: ['impactMetal_001'], v: 0.45, r: [0.45, 0.5] },
  thud:      { f: ['impactMetal_001', 'impactMetal_003', 'impactMetal_004'], v: 0.42, r: [0.55, 0.8] },
  door:      { f: ['doorOpen_000'], v: 0.4, r: [0.8, 0.9] },
  power:     { f: ['forceField_001'], v: 0.5, r: [0.6, 0.6] },
  deploy:    { f: ['doorOpen_001', 'doorOpen_002'], v: 0.3, r: [1.2, 1.4] },
  ping:      { f: ['laserLarge_000', 'laserLarge_001', 'laserLarge_002'], v: 0.14, r: [1.4, 2.0] },
};
const LOOPS = {
  hum:    { f: 'computerNoise_001', v: 0.1 },
  scan:   { f: 'engineCircular_001', v: 0.16 },
};

const rnd = (a, b) => a + Math.random() * (b - a);
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

class AudioEngine {
  constructor() {
    this.ctx = null; this.buffers = new Map(); this.muted = false; this.mood = 'hub'; this.loops = new Map(); this.started = false;
    try { this.muted = localStorage.getItem('moon.muted') === '1'; } catch { /* ignore */ }
  }

  /* ───────── setup (must follow a user gesture) ───────── */
  start() {
    if (this.started) { this.ctx.state === 'suspended' && this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.started = true; const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 1; this.master.connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0; this.musicBus.connect(this.master);

    // shared reverb from generated noise
    this.reverb = ctx.createConvolver(); this.reverb.buffer = this.impulse(5.5, 2.4);
    this.revGain = ctx.createGain(); this.revGain.gain.value = 0.85; this.reverb.connect(this.revGain).connect(this.musicBus);

    // music chain: voices -> filter -> (dry + reverb + delay)
    this.filter = ctx.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 1600; this.filter.Q.value = 0.4;
    this.filter.connect(this.musicBus); this.filter.connect(this.reverb);
    this.delay = ctx.createDelay(2); this.delay.delayTime.value = 0.9;
    const fb = ctx.createGain(); fb.gain.value = 0.3; const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 1900;
    this.delay.connect(dl).connect(fb).connect(this.delay); dl.connect(this.reverb); dl.connect(this.musicBus);
    this.bellBus = ctx.createGain(); this.bellBus.gain.value = 0.5; this.bellBus.connect(this.delay); this.bellBus.connect(this.reverb); this.bellBus.connect(this.musicBus);

    // slow cutoff movement
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.045; lg.gain.value = 450;
    lfo.connect(lg).connect(this.filter.frequency); lfo.start();

    this.loadSfx();
    this.beginMusic();
    this.setMood(this.mood);
  }
  impulse(sec, decay) {
    const ctx = this.ctx, n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  async loadSfx() {
    const names = new Set([...Object.values(SFX).flatMap((s) => s.f), ...Object.values(LOOPS).map((l) => l.f)]);
    await Promise.all([...names].map(async (n) => {
      try { const r = await fetch(`${DIR}${n}.ogg`); this.buffers.set(n, await this.ctx.decodeAudioData(await r.arrayBuffer())); }
      catch { /* unsupported format or missing: stay silent */ }
    }));
  }

  /* ───────── sfx ───────── */
  sfx(name, opts = {}) {
    if (!this.started || this.muted) return;
    const d = SFX[name]; if (!d) return;
    const buf = this.buffers.get(d.f[(Math.random() * d.f.length) | 0]); if (!buf) return;
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
    src.buffer = buf; src.playbackRate.value = (opts.rate ?? rnd(d.r[0], d.r[1]));
    g.gain.value = d.v * (opts.vol ?? 1);
    src.connect(g).connect(this.sfxBus); src.start(this.ctx.currentTime + (opts.delay || 0));
  }
  // Smooth synthesized rocket rumble: brown noise through a low-pass plus a faint hiss. No looped sample, so no pulsing.
  rumble(fadeIn = 1.5) {
    if (!this.started || this.loops.has('engine')) return;
    const ctx = this.ctx, n = ctx.sampleRate * 4, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    // crossfade the loop seam
    const x = 4000; for (let i = 0; i < x; i++) { const t = i / x; d[i] = d[i] * t + d[n - x + i] * (1 - t); }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.loopStart = 0; src.loopEnd = (n - x) / ctx.sampleRate;
    const low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 260; low.Q.value = 0.3;
    const hiss = ctx.createBiquadFilter(); hiss.type = 'bandpass'; hiss.frequency.value = 1400; hiss.Q.value = 0.4;
    const gl = ctx.createGain(), gh = ctx.createGain(), g = ctx.createGain();
    gl.gain.value = 1.0; gh.gain.value = 0.05; g.gain.value = 0;
    g.gain.setTargetAtTime(0.55, ctx.currentTime, fadeIn / 3);
    src.connect(low).connect(gl).connect(g); src.connect(hiss).connect(gh).connect(g); g.connect(this.sfxBus);
    src.start(); this.loops.set('engine', { src, g });
  }
  loop(name, fadeIn = 0.8) {
    if (name === 'engine') return this.rumble(fadeIn);
    if (!this.started || this.loops.has(name)) return;
    const d = LOOPS[name], buf = d && this.buffers.get(d.f); if (!buf) return;
    const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
    src.buffer = buf; src.loop = true; g.gain.value = 0; g.gain.setTargetAtTime(d.v, this.ctx.currentTime, fadeIn / 3);
    src.connect(g).connect(this.sfxBus); src.start();
    this.loops.set(name, { src, g });
  }
  stopLoop(name, fadeOut = 1) {
    const l = this.loops.get(name); if (!l) return;
    this.loops.delete(name);
    l.g.gain.setTargetAtTime(0, this.ctx.currentTime, fadeOut / 3);
    setTimeout(() => { try { l.src.stop(); } catch { /* ignore */ } }, fadeOut * 1000 + 300);
  }

  /* ───────── mute / mood ───────── */
  setMuted(m) {
    this.muted = m; try { localStorage.setItem('moon.muted', m ? '1' : '0'); } catch { /* ignore */ }
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.1);
    return m;
  }
  toggleMute() { return this.setMuted(!this.muted); }
  setMood(mood) {
    this.mood = mood; if (!this.started) return;
    const t = this.ctx.currentTime;
    const m = { hub: [0.5, 1500, 0.22], editor: [0.3, 1000, 0], cutscene: [0.6, 2400, 0.4], intro: [0.45, 1400, 0.15] }[mood] || [0.5, 1700, 0.5];
    this.musicBus.gain.setTargetAtTime(m[0], t, 1.5);
    this.filter.frequency.setTargetAtTime(m[1], t, 2);
    this.bellProb = m[2];
  }

  /* ───────── generative music ───────── */
  beginMusic() {
    // Slow progression in D lydian: Dmaj9 → Bm9 → Gmaj7#11 → Asus2add9
    this.chords = [
      { root: 38, notes: [50, 54, 57, 61, 64] },
      { root: 35, notes: [47, 50, 54, 57, 61] },
      { root: 43, notes: [47, 50, 54, 61, 62] },
      { root: 45, notes: [52, 55, 59, 62, 64] },
    ];
    this.scale = [62, 66, 69, 74, 78, 81]; // D F# A, wide and consonant
    this.ci = 0; this.bellProb = 0.5;
    this.nextChord = this.ctx.currentTime + 0.1; this.nextBell = this.ctx.currentTime + 3;
    this.timer = setInterval(() => this.tick(), 400);
    this.tick();
  }
  tick() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime, CH = 15;
    while (this.nextChord < now + 2) { this.chord(this.chords[this.ci++ % 4], this.nextChord, CH); this.nextChord += CH - 3; }
    while (this.nextBell < now + 2) {
      if (Math.random() < this.bellProb) this.bell(this.scale[(Math.random() * this.scale.length) | 0], this.nextBell);
      this.nextBell += rnd(6, 13);
    }
  }
  chord(c, t, dur) {
    const ctx = this.ctx;
    const voice = (midi, vol, type, det) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = mtof(midi); o.detune.value = det;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 5); g.gain.setValueAtTime(vol, t + dur - 4); g.gain.linearRampToValueAtTime(0, t + dur + 3);
      o.connect(g).connect(this.filter); o.start(t); o.stop(t + dur + 3.2);
    };
    for (const n of c.notes) {
      voice(n, 0.035, 'sawtooth', -7); voice(n, 0.035, 'sawtooth', 7); voice(n + 12, 0.012, 'sine', 0);
    }
    // sub drone
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = mtof(c.root - 12);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 4); g.gain.setValueAtTime(0.16, t + dur - 3); g.gain.linearRampToValueAtTime(0, t + dur + 2.5);
    o.connect(g).connect(this.musicBus); o.start(t); o.stop(t + dur + 3);
  }
  bell(midi, t) {
    const ctx = this.ctx, f = mtof(midi), g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0008, t + 5);
    for (const [mul, vol, type] of [[1, 1, 'sine'], [2.01, 0.28, 'sine'], [3.99, 0.1, 'triangle']]) {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = f * mul; og.gain.value = vol;
      o.connect(og).connect(g); o.start(t); o.stop(t + 5.2);
    }
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) { pan.pan.value = rnd(-0.6, 0.6); g.connect(pan).connect(this.bellBus); } else g.connect(this.bellBus);
  }
}

export const audio = new AudioEngine();
