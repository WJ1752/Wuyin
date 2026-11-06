type Track = 'town' | 'rift' | 'boss';
type Voice = {
  frequency: number;
  end?: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  noise?: boolean;
};
const SFX: Record<string, Voice[]> = {
  bow: [{ frequency: 1600, end: 280, duration: 0.12, type: 'triangle', noise: true }],
  crossbow: [{ frequency: 980, end: 100, duration: 0.08, type: 'sawtooth', noise: true }],
  hammer: [{ frequency: 85, end: 22, duration: 0.48, type: 'sine', gain: 0.65, noise: true }],
  whirlwind: [{ frequency: 550, end: 170, duration: 0.35, noise: true }],
  meteor: [{ frequency: 800, end: 40, duration: 0.65, noise: true }],
  ice: [1400, 2200, 3100].map((frequency) => ({
    frequency,
    duration: 0.3,
    type: 'triangle',
    gain: 0.16,
  })),
  lightning: [{ frequency: 2200, end: 70, duration: 0.16, type: 'sawtooth', noise: true }],
  bone: [{ frequency: 160, end: 35, duration: 0.27, noise: true }],
  critical: [
    { frequency: 140, end: 35, duration: 0.18, gain: 0.5 },
    { frequency: 840, duration: 0.09, type: 'triangle' },
  ],
  slash: [{ frequency: 900, end: 100, duration: 0.14, noise: true }],
  poison: [{ frequency: 240, end: 95, duration: 0.4, type: 'sine', noise: true }],
  arcane: [{ frequency: 440, end: 1600, duration: 0.26, type: 'sine' }],
  dash: [{ frequency: 220, end: 980, duration: 0.18, noise: true }],
  hit: [{ frequency: 110, end: 35, duration: 0.13, type: 'triangle' }],
  death: [{ frequency: 240, end: 25, duration: 0.6, type: 'sawtooth', gain: 0.15 }],
  primal: [440, 554.37, 659.25, 880].map((frequency, i) => ({
    frequency,
    duration: 2.8,
    type: 'sine',
    gain: 0.24,
    delay: i * 0.09,
  })),
  legendary: [587.33, 880, 1174.66].map((frequency, i) => ({
    frequency,
    duration: 1.5,
    type: 'triangle',
    gain: 0.18,
    delay: i * 0.1,
  })),
  pickup: [{ frequency: 550, end: 1100, duration: 0.16, type: 'sine' }],
  health: [{ frequency: 280, end: 760, duration: 0.24, type: 'sine' }],
  progress: [{ frequency: 440, end: 1320, duration: 0.32, type: 'triangle' }],
  pylon: [
    { frequency: 65.4, duration: 1.2, type: 'sawtooth', gain: 0.2 },
    { frequency: 130.8, duration: 1.5, type: 'triangle', gain: 0.25 },
    { frequency: 1568, duration: 0.7, noise: true, gain: 0.1 },
  ],
  equip: [
    { frequency: 920, end: 460, duration: 0.12, type: 'triangle' },
    { frequency: 1720, duration: 0.1, delay: 0.06, gain: 0.15 },
  ],
  forge: [{ frequency: 1400, end: 700, duration: 0.25, type: 'triangle', noise: true }],
  gamble: [
    { frequency: 380, end: 780, duration: 0.09, type: 'triangle' },
    { frequency: 960, duration: 0.18, delay: 0.09, type: 'sine' },
  ],
  upgrade: [261.63, 329.63, 392, 523.25].map((frequency, i) => ({
    frequency,
    duration: 0.8,
    delay: i * 0.08,
    type: 'sine',
    gain: 0.2,
  })),
  boss: [
    { frequency: 55, duration: 1.8, type: 'sawtooth', gain: 0.2 },
    { frequency: 58.27, duration: 1.8, type: 'sawtooth', gain: 0.15 },
  ],
  click: [{ frequency: 680, end: 400, duration: 0.06, type: 'triangle', gain: 0.18 }],
  victory: [392, 493.88, 587.33, 783.99].map((frequency, i) => ({
    frequency,
    duration: 1.8,
    delay: i * 0.16,
    type: 'triangle',
    gain: 0.22,
  })),
};
export const SOUND_NAMES = Object.keys(SFX);
const ALIASES: Record<string, string> = {
  attack: 'slash',
  shoot: 'bow',
  crit: 'critical',
  kill: 'bone',
  loot: 'pickup',
  set: 'legendary',
  fire: 'meteor',
  explosion: 'hammer',
  shield: 'arcane',
  heal: 'health',
  levelup: 'upgrade',
  defeat: 'death',
  goblin: 'gamble',
  cast: 'arcane',
  homing: 'bow',
  explosive: 'crossbow',
  multishot: 'crossbow',
  elemental: 'ice',
  dodge: 'dash',
  rain: 'bow',
  raven: 'whirlwind',
  vengeance: 'upgrade',
  frenzy: 'slash',
  bash: 'hammer',
  pull: 'whirlwind',
  warcry: 'pylon',
  charge: 'dash',
  berserker: 'boss',
  chain: 'lightning',
  orb: 'ice',
  teleport: 'dash',
  blackhole: 'arcane',
  nova: 'ice',
  archon: 'upgrade',
  spike: 'bone',
  siphon: 'health',
  scythe: 'slash',
  spear: 'bow',
  summon: 'bone',
  curse: 'poison',
  bloodstep: 'dash',
  army: 'boss',
  claw: 'slash',
  boomerang: 'whirlwind',
  fan: 'crossbow',
  vines: 'poison',
  shadowstep: 'dash',
  wolf: 'boss',
  hurt: 'hit',
  warning: 'boss',
};
export class SynthAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private musicBus?: GainNode;
  private reverb?: ConvolverNode;
  private timer?: number;
  private track: Track = 'town';
  private step = 0;
  private volume = 0.45;
  private muted = false;
  private musicVolume = 1;
  private sfxVolume = 1;
  private last = new Map<string, number>();
  async unlock() {
    if (!this.context) {
      const ctx = (this.context = new AudioContext());
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.ratio.value = 6;
      this.master.connect(compressor);
      compressor.connect(ctx.destination);
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 0.24;
      this.musicBus.connect(this.master);
      this.reverb = ctx.createConvolver();
      const impulse = ctx.createBuffer(2, ctx.sampleRate * 1.8, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const a = impulse.getChannelData(c);
        for (let i = 0; i < a.length; i++)
          a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / a.length, 3) * 0.45;
      }
      this.reverb.buffer = impulse;
      const wet = ctx.createGain();
      wet.gain.value = 0.22;
      this.reverb.connect(wet);
      wet.connect(this.master);
      this.sequence();
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }
  settings(volume: number, muted: boolean, musicVolume = 1, sfxVolume = 1) {
    this.volume = volume;
    this.muted = muted;
    this.musicVolume = musicVolume;
    this.sfxVolume = sfxVolume;
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(muted ? 0 : volume, this.context.currentTime, 0.08);
  }
  play(name: string) {
    if (!this.context || this.muted || this.context.state !== 'running') return;
    const key = ALIASES[name] ?? name;
    const voices = SFX[key];
    if (!voices) return;
    const now = this.context.currentTime;
    if (now - (this.last.get(key) ?? -100) < 0.055) return;
    this.last.set(key, now);
    voices.forEach((v) => this.voice(v, false));
  }
  setTrack(track: Track) {
    if (this.track === track) return;
    this.track = track;
    this.step = 0;
  }
  private voice(v: Voice, music: boolean) {
    const ctx = this.context;
    if (!ctx || !this.master) return;
    const relativeVolume = music ? this.musicVolume : this.sfxVolume;
    if (!relativeVolume) return;
    const t = ctx.currentTime + (v.delay ?? 0);
    const env = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = v.noise ? 'bandpass' : 'lowpass';
    filter.frequency.value = v.noise ? v.frequency : music ? 1300 : 6500;
    filter.Q.value = v.noise ? 0.7 : 0.3;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime((v.gain ?? 0.3) * relativeVolume, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + v.duration);
    filter.connect(env);
    env.connect(music ? this.musicBus! : this.master);
    if (this.reverb) env.connect(this.reverb);
    let source: OscillatorNode | AudioBufferSourceNode;
    if (v.noise) {
      source = ctx.createBufferSource();
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * v.duration), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let pink = 0;
      for (let i = 0; i < data.length; i++) {
        pink = 0.97 * pink + 0.03 * (Math.random() * 2 - 1);
        data[i] = pink * 6 + (Math.random() * 2 - 1) * 0.3;
      }
      source.buffer = buffer;
      if (v.end) filter.frequency.exponentialRampToValueAtTime(v.end, t + v.duration);
    } else {
      source = ctx.createOscillator();
      source.type = v.type ?? 'sine';
      source.frequency.setValueAtTime(v.frequency, t);
      if (v.end) source.frequency.exponentialRampToValueAtTime(v.end, t + v.duration);
    }
    source.connect(filter);
    source.start(t);
    source.stop(t + v.duration + 0.02);
    source.onended = () => {
      source.disconnect();
      env.disconnect();
      filter.disconnect();
    };
  }
  private sequence() {
    if (!this.context) return;
    if (this.context.state === 'running' && !document.hidden) {
      const notes =
        this.track === 'town'
          ? [110, 164.81, 220, 261.63, 220, 164.81, 130.81, 196]
          : this.track === 'rift'
            ? [73.42, 73.42, 110, 146.83, 73.42, 87.31, 130.81, 110]
            : [55, 55, 65.41, 55, 82.41, 73.42, 65.41, 61.74];
      const frequency = notes[this.step % notes.length];
      this.voice(
        {
          frequency,
          duration: this.track === 'town' ? 1.8 : 0.42,
          type: this.track === 'town' ? 'triangle' : 'sawtooth',
          gain: 0.22,
        },
        true,
      );
      if (this.step % 4 === 0) {
        this.voice({ frequency: frequency * 0.5, duration: 2.4, type: 'sine', gain: 0.3 }, true);
        this.voice({ frequency: frequency * 3, duration: 2.1, type: 'sine', gain: 0.06 }, true);
      }
      if (this.track !== 'town')
        this.voice(
          {
            frequency: this.step % 2 ? 2300 : 80,
            end: this.step % 2 ? 900 : 24,
            duration: 0.12,
            noise: this.step % 2 === 1,
            gain: 0.18,
          },
          true,
        );
      this.step++;
    }
    this.timer = window.setTimeout(
      () => this.sequence(),
      this.track === 'town' ? 480 : this.track === 'rift' ? 230 : 190,
    );
  }
  destroy() {
    window.clearTimeout(this.timer);
    void this.context?.close();
    this.context = undefined;
  }
}
export const audio = new SynthAudio();
