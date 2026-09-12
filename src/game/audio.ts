// Procedural WebAudio SFX — zero assets, synthesized at runtime.
type Osc = OscillatorType;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;

  constructor() {
    try {
      const v = localStorage.getItem("typulse.muted")
        ?? localStorage.getItem("clackwave.muted")
        ?? localStorage.getItem("neontype.muted");
      this.muted = v === "1";
    } catch { /* private mode */ }
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    comp.connect(this.ctx.destination);
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(comp);
  }

  setMuted(m: boolean) {
    this.muted = m;
    try { localStorage.setItem("typulse.muted", m ? "1" : "0"); } catch { /* noop */ }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
  }

  private get ready(): boolean { return !!this.ctx && !!this.master; }
  private now(): number { return this.ctx!.currentTime; }

  private tone(freq: number, dur: number, type: Osc, vol: number, opts: { slide?: number; delay?: number; lpf?: number } = {}) {
    if (!this.ready) return;
    const t0 = this.now() + (opts.delay ?? 0);
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slide), t0 + dur);
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    let node: AudioNode = o;
    if (opts.lpf) {
      const f = this.ctx!.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = opts.lpf;
      o.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(this.master!);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, vol: number, opts: { lpfFrom?: number; lpfTo?: number; delay?: number } = {}) {
    if (!this.ready) return;
    if (!this.noiseBuf) {
      const len = this.ctx!.sampleRate;
      const buf = this.ctx!.createBuffer(1, len, this.ctx!.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    }
    const t0 = this.now() + (opts.delay ?? 0);
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx!.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(opts.lpfFrom ?? 3000, t0);
    if (opts.lpfTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, opts.lpfTo), t0 + dur);
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master!);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  /** Keystroke tick — pitch climbs with progress within the word. */
  tick(step: number) {
    const f = 620 + step * 55 + Math.random() * 40;
    this.tone(f, 0.05, "square", 0.11, { lpf: 2400 });
  }

  /** Word cleared — two-note chime whose pitch rises with the combo tier. */
  complete(tier: number) {
    const k = 1 + Math.min(tier, 8) * 0.075;
    this.tone(660 * k, 0.09, "triangle", 0.22);
    this.tone(990 * k, 0.13, "triangle", 0.2, { delay: 0.055 });
    this.noise(0.12, 0.06, { lpfFrom: 7000, lpfTo: 2500 });
  }

  error() {
    this.tone(130, 0.11, "sawtooth", 0.16, { slide: 80, lpf: 900 });
  }

  explode() {
    this.noise(0.4, 0.32, { lpfFrom: 1400, lpfTo: 90 });
    this.tone(220, 0.38, "sine", 0.3, { slide: 40 });
  }

  ui() { this.tone(840, 0.05, "sine", 0.14); }

  multiplier() {
    this.tone(523, 0.08, "square", 0.1, { lpf: 2600 });
    this.tone(659, 0.08, "square", 0.1, { delay: 0.06, lpf: 2600 });
    this.tone(880, 0.12, "square", 0.12, { delay: 0.12, lpf: 3200 });
  }

  gameOver() {
    this.explode();
    this.tone(392, 0.22, "triangle", 0.2, { delay: 0.12 });
    this.tone(311, 0.22, "triangle", 0.2, { delay: 0.3 });
    this.tone(233, 0.42, "triangle", 0.22, { delay: 0.48, slide: 110 });
  }
}

export const sfx = new AudioEngine();
