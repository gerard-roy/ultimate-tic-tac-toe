/** Every sound is synthesized with the Web Audio API. There are no audio files. */
import type { Player } from './rules';

export interface Levels {
  master: number;
  effects: number;
  room: number;
  muted: boolean;
}

// C major pentatonic, by pane number.
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19];
const BASE = 523.25; // C5 for Cobalt; Amber plays an octave below

const freq = (step: number, octave = 0) => BASE * Math.pow(2, step / 12 + octave);

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private fx: GainNode | null = null;
  private room: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private noise: AudioBuffer | null = null;
  private levels: Levels;

  constructor(levels: Levels) {
    this.levels = { ...levels };
  }

  /** Sound starts on the first tap. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.connect(ctx.destination);
      this.fx = ctx.createGain();
      this.room = ctx.createGain();

      // One shared reverb on every effect: a decaying noise impulse.
      const len = Math.floor(ctx.sampleRate * 1.8);
      const impulse = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = impulse;
      const wet = ctx.createGain();
      wet.gain.value = 0.32;
      this.fx.connect(this.master);
      this.fx.connect(this.reverb);
      this.reverb.connect(wet);
      wet.connect(this.master);

      const n = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const nd = n.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      this.noise = n;

      // Room tone: filtered noise at 4% volume.
      const tone = ctx.createBufferSource();
      tone.buffer = n;
      tone.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 320;
      tone.connect(lp);
      lp.connect(this.room);
      this.room.connect(this.master);
      tone.start();
      this.apply();
    } catch {
      this.ctx = null;
    }
  }

  setLevels(levels: Levels): void {
    this.levels = { ...levels };
    this.apply();
  }

  private apply(): void {
    if (!this.ctx || !this.master || !this.fx || !this.room) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.levels.muted ? 0 : this.levels.master, t, 0.02);
    this.fx.gain.setTargetAtTime(this.levels.effects, t, 0.02);
    this.room.gain.setTargetAtTime(0.04 * this.levels.room, t, 0.05);
  }

  private tone(f: number, at: number, dur: number, peak: number, type: OscillatorType = 'sine'): void {
    const ctx = this.ctx;
    if (!ctx || !this.fx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g);
    g.connect(this.fx);
    o.start(at);
    o.stop(at + dur + 0.02);
  }

  private burst(at: number, dur: number, peak: number, hz: number, type: BiquadFilterType = 'bandpass'): void {
    const ctx = this.ctx;
    if (!ctx || !this.fx || !this.noise) return;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = hz;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.fx);
    s.start(at, Math.random());
    s.stop(at + dur + 0.02);
  }

  /** A glass tap: a sine tone with a short noise burst, 90ms. */
  mark(pane: number, player: Player): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const f = freq(SCALE[pane], player === 'amber' ? -1 : 0);
    this.tone(f, t, 0.09, 0.4);
    this.tone(f * 2.76, t, 0.05, 0.08);
    this.burst(t, 0.03, 0.18, 5200);
  }

  /** Three notes of the same scale as a soft bell chord, 900ms. */
  panelWon(player: Player): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.25;
    const oct = player === 'amber' ? -1 : 0;
    [0, 4, 7].forEach((s, i) => {
      this.tone(freq(s, oct), t + i * 0.03, 0.9, 0.22);
      this.tone(freq(s, oct) * 2.01, t + i * 0.03, 0.5, 0.06);
    });
  }

  /** Five notes rising with a long tail, 2.5s. A loss plays them falling and quieter. */
  gameOver(kind: 'win' | 'loss' | 'draw'): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.3;
    const steps = kind === 'win' ? [0, 4, 7, 12, 16] : kind === 'loss' ? [16, 12, 7, 4, 0] : [7, 4, 7, 4, 0];
    const peak = kind === 'win' ? 0.26 : 0.13;
    steps.forEach((s, i) => {
      const at = t + i * 0.22;
      const dur = 2.5 - i * 0.22;
      this.tone(freq(s, -1), at, dur, peak);
      this.tone(freq(s, 0), at, dur * 0.6, peak * 0.3);
    });
  }

  /** A dull knock, 60ms. */
  knock(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(110, t, 0.06, 0.3, 'triangle');
    this.burst(t, 0.04, 0.12, 300, 'lowpass');
  }
}
