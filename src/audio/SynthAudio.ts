import type { Element, SkillDef } from '../core/types';

type Track = 'town' | 'rift' | 'boss' | 'ending';
type Voice = {
  frequency: number;
  end?: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  noise?: boolean;
  attack?: number;
};
const SFX: Record<string, Voice[]> = {
  bow: [
    { frequency: 1470, end: 720, duration: 0.1, noise: true, gain: 0.25 },
    { frequency: 112, end: 76, duration: 0.074, type: 'triangle', gain: 0.16 },
  ],
  crossbow: [
    { frequency: 810, end: 380, duration: 0.1, noise: true, gain: 0.25 },
    { frequency: 163, end: 81, duration: 0.09, type: 'triangle', gain: 0.23 },
  ],
  hammer: [
    { frequency: 87, end: 30, duration: 0.38, gain: 0.45 },
    { frequency: 430, end: 118, duration: 0.31, noise: true, gain: 0.28 },
  ],
  whirlwind: [
    { frequency: 450, end: 1180, duration: 0.39, noise: true, gain: 0.27, attack: 0.12 },
    { frequency: 91, end: 52, duration: 0.39, gain: 0.22 },
  ],
  meteor: [
    { frequency: 470, end: 120, duration: 0.54, noise: true, gain: 0.36, attack: 0.11 },
    { frequency: 82, end: 40, duration: 0.4, gain: 0.31, delay: 0.14 },
  ],
  ice: [1400, 2200, 3100].map((frequency) => ({
    frequency,
    duration: 0.3,
    type: 'triangle',
    gain: 0.16,
  })),
  lightning: [
    { frequency: 2800, end: 260, duration: 0.14, noise: true, gain: 0.25 },
    { frequency: 1240, end: 125, duration: 0.2, type: 'triangle', gain: 0.16 },
  ],
  bone: [
    { frequency: 680, end: 360, duration: 0.12, noise: true, gain: 0.27 },
    { frequency: 152, end: 54, duration: 0.2, type: 'triangle', gain: 0.26 },
  ],
  critical: [
    { frequency: 140, end: 35, duration: 0.18, gain: 0.5 },
    { frequency: 840, duration: 0.09, type: 'triangle' },
  ],
  slash: [{ frequency: 1220, end: 320, duration: 0.15, noise: true, gain: 0.32 }],
  poison: [{ frequency: 660, end: 145, duration: 0.37, noise: true, gain: 0.29, attack: 0.054 }],
  arcane: [
    { frequency: 245, end: 455, duration: 0.37, type: 'triangle', gain: 0.32, attack: 0.055 },
    { frequency: 736, end: 920, duration: 0.46, gain: 0.14, delay: 0.06, attack: 0.09 },
  ],
  dash: [{ frequency: 940, end: 280, duration: 0.23, noise: true, gain: 0.29, attack: 0.039 }],
  hit: [{ frequency: 110, end: 35, duration: 0.13, type: 'triangle' }],
  death: [{ frequency: 240, end: 25, duration: 0.6, type: 'sawtooth', gain: 0.15 }],
  primal: [294, 440, 587, 740].map((frequency, i) => ({
    frequency,
    duration: 1.45,
    type: 'sine',
    gain: 0.24,
    delay: i * 0.09,
  })),
  legendary: [392, 588, 785].map((frequency, i) => ({
    frequency,
    duration: 1.1,
    type: 'triangle',
    gain: 0.18,
    delay: i * 0.1,
  })),
  set: [294, 349, 523].map((frequency, i) => ({
    frequency,
    duration: 0.8,
    gain: 0.19,
    delay: i * 0.08,
  })),
  pickup: [{ frequency: 670, end: 460, duration: 0.12, noise: true, gain: 0.15 }],
  coin: [
    { frequency: 1172, duration: 0.15, gain: 0.16 },
    { frequency: 1733, duration: 0.11, gain: 0.07, delay: 0.035 },
  ],
  rare: [{ frequency: 466, duration: 0.35, type: 'triangle', gain: 0.19 }],
  epic: [415, 611].map((frequency, i) => ({
    frequency,
    duration: 0.44,
    gain: 0.2,
    delay: i * 0.07,
  })),
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
    { frequency: 54, end: 37, duration: 1.3, type: 'triangle', gain: 0.34, attack: 0.07 },
    { frequency: 79, end: 57, duration: 1.06, noise: true, gain: 0.22, attack: 0.18 },
  ],
  warning: [
    { frequency: 294, end: 253, duration: 0.2, type: 'triangle', gain: 0.23 },
    { frequency: 311, end: 196, duration: 0.26, type: 'triangle', gain: 0.22, delay: 0.1 },
  ],
  elite: [{ frequency: 165, end: 126, duration: 0.55, type: 'triangle', gain: 0.2, attack: 0.09 }],
  impact: [{ frequency: 176, end: 85, duration: 0.12, noise: true, gain: 0.21 }],
  fall: [{ frequency: 320, end: 92, duration: 0.17, noise: true, gain: 0.14 }],
  ward: [
    { frequency: 248, end: 201, duration: 0.31, type: 'triangle', gain: 0.2 },
    { frequency: 615, duration: 0.68, gain: 0.13, delay: 0.07 },
  ],
  gate: [
    { frequency: 240, end: 495, duration: 0.65, noise: true, gain: 0.2, attack: 0.16 },
    { frequency: 147, end: 220, duration: 0.6, type: 'triangle', gain: 0.19, attack: 0.18 },
  ],
  footstep: [{ frequency: 430, end: 252, duration: 0.085, noise: true, gain: 0.1 }],
  folio: [{ frequency: 1110, end: 630, duration: 0.18, noise: true, gain: 0.13 }],
  click: [{ frequency: 420, end: 240, duration: 0.06, type: 'triangle', gain: 0.16 }],
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
  berserker: 'ward',
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
  army: 'bone',
  claw: 'slash',
  boomerang: 'whirlwind',
  fan: 'crossbow',
  vines: 'poison',
  shadowstep: 'dash',
  wolf: 'whirlwind',
  hurt: 'hit',
};

const elementalCue: Record<Element, string> = {
  physical: 'slash',
  fire: 'meteor',
  ice: 'ice',
  lightning: 'lightning',
  arcane: 'arcane',
  poison: 'poison',
};

export function skillSound(skill: Pick<SkillDef, 'effect' | 'element' | 'kind'>) {
  if (skill.kind === 'movement') return 'dash';
  if (skill.kind === 'defense') return 'ward';
  const effect = ALIASES[skill.effect] ?? skill.effect;
  return Object.hasOwn(SFX, effect) ? effect : elementalCue[skill.element];
}

const score = {
  town: {
    beat: 520,
    melody: [57, 64, 60, 0, 55, 62, 57, 0, 53, 60, 57, 0, 52, 59, 55, 0],
    bass: [38, 43, 41, 40],
  },
  rift: {
    beat: 290,
    melody: [50, 0, 57, 0, 48, 0, 55, 0, 46, 0, 53, 0, 45, 0, 52, 0],
    bass: [38, 36, 34, 33],
  },
  boss: {
    beat: 236,
    melody: [43, 0, 46, 43, 44, 0, 46, 44, 41, 0, 46, 41, 43, 0, 49, 46],
    bass: [31, 32, 29, 31],
  },
  ending: {
    beat: 550,
    melody: [57, 64, 69, 0, 60, 67, 71, 0, 62, 65, 69, 0, 64, 69, 74, 0],
    bass: [38, 41, 43, 38],
  },
} as const;
const frequencyFor = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const cooldowns: Record<string, number> = {
  footstep: 0.31,
  warning: 0.34,
  impact: 0.13,
  fall: 0.18,
  coin: 0.12,
  progress: 0.22,
  hurt: 0.17,
  hit: 0.17,
};
export class SynthAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private musicBus?: GainNode;
  private reverb?: ConvolverNode;
  private noiseBuffer?: AudioBuffer;
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
      this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
      const noise = this.noiseBuffer.getChannelData(0);
      let pink = 0;
      for (let i = 0; i < noise.length; i++) {
        const white = Math.random() * 2 - 1;
        pink = 0.965 * pink + white * 0.035;
        noise[i] = pink * 4.4 + white * 0.22;
      }
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
    if (now - (this.last.get(key) ?? -100) < (cooldowns[key] ?? 0.085)) return;
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
    env.gain.exponentialRampToValueAtTime(
      (v.gain ?? 0.3) * relativeVolume,
      t + (v.attack ?? 0.008),
    );
    env.gain.exponentialRampToValueAtTime(0.0001, t + v.duration);
    filter.connect(env);
    env.connect(music ? this.musicBus! : this.master);
    if (this.reverb) env.connect(this.reverb);
    let source: OscillatorNode | AudioBufferSourceNode;
    if (v.noise && this.noiseBuffer) {
      const grain = ctx.createBufferSource();
      grain.buffer = this.noiseBuffer;
      source = grain;
      if (v.end) filter.frequency.exponentialRampToValueAtTime(v.end, t + v.duration);
      grain.start(t, Math.random() * Math.max(0, this.noiseBuffer.duration - v.duration - 0.03));
    } else {
      source = ctx.createOscillator();
      source.type = v.type ?? 'sine';
      source.frequency.setValueAtTime(v.frequency, t);
      if (v.end) source.frequency.exponentialRampToValueAtTime(v.end, t + v.duration);
      source.start(t);
    }
    source.connect(filter);
    source.stop(t + v.duration + 0.02);
    source.onended = () => {
      source.disconnect();
      env.disconnect();
      filter.disconnect();
    };
  }
  private sequence() {
    if (!this.context) return;
    const { beat, melody, bass } = score[this.track];
    if (this.context.state === 'running' && !document.hidden) {
      const phrase = this.step % melody.length;
      const note = melody[phrase];
      const pulse = this.track === 'rift' || this.track === 'boss';
      const low = frequencyFor(bass[Math.floor(phrase / 4)]);
      if (note) {
        const tone = frequencyFor(note);
        this.voice(
          {
            frequency: tone,
            duration: pulse ? 0.49 : 1.45,
            type: 'triangle',
            gain: pulse ? 0.12 : 0.18,
            attack: 0.024,
          },
          true,
        );
        if (!pulse) this.voice({ frequency: tone * 2.008, duration: 0.64, gain: 0.045 }, true);
      }
      if (phrase % 4 === 0) {
        this.voice({ frequency: low, duration: 2.3, gain: 0.23, attack: 0.22 }, true);
        this.voice(
          { frequency: low * 1.502, duration: 2, type: 'triangle', gain: 0.075, attack: 0.38 },
          true,
        );
      }
      if (phrase % 8 === 0)
        this.voice(
          {
            frequency: 440,
            end: 260,
            duration: 3.2,
            noise: true,
            gain: pulse ? 0.08 : 0.07,
            attack: 0.46,
          },
          true,
        );
      if (pulse && (phrase % 4 === 0 || phrase % 4 === 3))
        this.voice(
          { frequency: this.track === 'boss' ? 91 : 72, end: 38, duration: 0.26, gain: 0.2 },
          true,
        );
      this.step++;
    }
    this.timer = window.setTimeout(() => this.sequence(), beat);
  }
  destroy() {
    window.clearTimeout(this.timer);
    void this.context?.close();
    this.context = undefined;
    this.noiseBuffer = undefined;
    this.last.clear();
  }
}
export const audio = new SynthAudio();
