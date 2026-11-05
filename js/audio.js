// WebAudio-generated ambience & music – no external/copyrighted audio files.
const N = (n) => 440 * Math.pow(2, (n - 69) / 12);
const PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
const BASS = [45, 41, 36, 43];

export class Sound {
  constructor() { this.ctx = null; this.muted = false; }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.6;
    const comp = c.createDynamicsCompressor(); this.master.connect(comp); comp.connect(c.destination);
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0); let b = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; d[i] = w; }
    // brown-ish noise for waves
    this.brown = c.createBuffer(1, len, c.sampleRate); const e = this.brown.getChannelData(0);
    for (let i = 0; i < len; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; e[i] = b * 3.5; }
    // waves ambience
    this.waveBus = c.createGain(); this.waveBus.gain.value = 0; this.waveBus.connect(this.master);
    const src = c.createBufferSource(); src.buffer = this.brown; src.loop = true;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650;
    const swell = c.createGain(); swell.gain.value = 0.45;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.11; const lfoG = c.createGain(); lfoG.gain.value = 0.4;
    lfo.connect(lfoG); lfoG.connect(swell.gain); lfo.start();
    src.connect(lp); lp.connect(swell); swell.connect(this.waveBus); src.start();
    // music buses
    this.barBus = c.createGain(); this.barBus.gain.value = 0; this.barBus.connect(this.master);
    this.cafeBus = c.createGain(); this.cafeBus.gain.value = 0; this.cafeBus.connect(this.master);
    this.seqs = [
      { kind: 'edm', bpm: 124, step: 0, next: c.currentTime + 0.1, bus: this.barBus },
      { kind: 'acoustic', bpm: 80, step: 0, next: c.currentTime + 0.1, bus: this.cafeBus },
    ];
    this.timer = setInterval(() => this.schedule(), 25);
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.05); }
  setMix(waves, bar, cafe) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.waveBus.gain.setTargetAtTime(waves, t, 0.3);
    this.barBus.gain.setTargetAtTime(bar, t, 0.3);
    this.cafeBus.gain.setTargetAtTime(cafe, t, 0.3);
  }
  /** Beats elapsed on the bar sequencer (audio clock), so dancers stay locked to what you hear. */
  beat() { const c = this.ctx; if (!c || !this.seqs) return null; const s = this.seqs[0], sp = 60 / s.bpm / 4; return ((s.total || 0) - (s.next - c.currentTime) / sp) / 4; }
  schedule() {
    const c = this.ctx; if (!c || this.muted) { if (c) this.seqs.forEach(s => s.next = c.currentTime + 0.1); return; }
    for (const s of this.seqs) {
      const sp = 60 / s.bpm / 4;
      if (s.next < c.currentTime) s.next = c.currentTime + 0.05;
      while (s.next < c.currentTime + 0.12) {
        if (s.bus.gain.value > 0.005) this.play(s, s.step, s.next, sp);
        s.next += sp; s.step = (s.step + 1) % 256; s.total = (s.total || 0) + 1;
      }
    }
  }
  env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  kick(out, t, v = 1) { const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    this.env(g, t, 0.002, 0.9 * v, 0.28); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.35); }
  hat(out, t, v = 0.2, dec = 0.04) { const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = 'highpass'; f.frequency.value = 7000;
    this.env(g, t, 0.001, v, dec); s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + dec + 0.05); }
  snare(out, t, v = 0.35) { const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
    this.env(g, t, 0.001, v, 0.16); s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + 0.25); }
  tone(out, t, freq, type, v, a, dec, cutoff = 3000) { const c = this.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = type; o.frequency.value = freq; f.type = 'lowpass'; f.frequency.value = cutoff;
    this.env(g, t, a, v, dec); o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + a + dec + 0.05); }
  play(s, step, t, sp) {
    const o = s.bus, s16 = step % 16, bar = Math.floor(step / 16) % 4, ch = PROG[bar];
    if (s.kind === 'edm') {
      if (s16 % 4 === 0) this.kick(o, t);
      if (s16 % 4 === 2) this.hat(o, t, 0.22, 0.09);
      if (s16 === 4 || s16 === 12) this.snare(o, t, 0.35);
      if (s16 % 2 === 1) this.hat(o, t, 0.07);
      if (s16 % 4 === 2) this.tone(o, t, N(BASS[bar]), 'sawtooth', 0.22, 0.005, 0.18, 900);
      const arp = [0, 1, 2, 1, 0, 2, 1, 2]; if (s16 % 2 === 0) this.tone(o, t, N(ch[arp[(s16 / 2) | 0]] + 12), 'square', 0.045, 0.003, 0.12, 2500);
    } else {
      if (s16 === 0 || s16 === 8) this.kick(o, t, 0.35);
      if (s16 === 4 || s16 === 12) this.hat(o, t, 0.1, 0.12);
      const pat = [0, 1, 2, 1, 2, 1, 0, 2];
      if (s16 % 2 === 0) { const n = ch[pat[(s16 / 2) | 0]] + (s16 > 8 ? 12 : 0);
        this.tone(o, t, N(n), 'triangle', 0.13, 0.003, 0.6, 2200); this.tone(o, t, N(n) * 2.005, 'sine', 0.03, 0.003, 0.3); }
      if (s16 === 0) this.tone(o, t, N(BASS[bar]), 'triangle', 0.22, 0.005, 0.9, 500);
    }
  }
}
