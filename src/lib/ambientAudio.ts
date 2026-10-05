"use client";

class AmbientAudioEngine {
  private ctx: AudioContext | null = null;
  private isRunning: boolean = false;
  private isMuted: boolean = false;
  private volume: number = 0.5;

  private masterGain: GainNode | null = null;
  private fireGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private crackleTimer: number | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      const savedMute = window.localStorage.getItem("campfire-ambient-muted");
      const savedVol = window.localStorage.getItem("campfire-ambient-vol");
      if (savedMute !== null) this.isMuted = savedMute === "true";
      if (savedVol !== null) this.volume = parseFloat(savedVol) || 0.5;
    }
  }

  private initContext() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.isMuted ? 0 : this.volume;
    this.masterGain.connect(this.ctx.destination);

    this.fireGain = this.ctx.createGain();
    this.fireGain.gain.value = 0.65;
    this.fireGain.connect(this.masterGain);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.25;
    this.windGain.connect(this.masterGain);
  }

  public async start() {
    if (typeof window === "undefined") return;
    this.initContext();
    if (!this.ctx) return;

    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch (err) {
        console.warn("AudioContext resume failed:", err);
      }
    }

    if (this.isRunning) return;
    this.isRunning = true;

    this.startHiss();
    this.startNightWind();
    this.scheduleCrackles();
  }

  private startHiss() {
    if (!this.ctx || !this.fireGain) return;

    // Buffer of pink-ish noise for the fire hiss
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 850;
    filter.Q.value = 1.2;

    whiteNoise.connect(filter);
    filter.connect(this.fireGain);
    whiteNoise.start(0);
  }

  private startNightWind() {
    if (!this.ctx || !this.windGain) return;

    // Low gentle wind rumble
    const bufferSize = this.ctx.sampleRate * 3;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let last = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (last + 0.02 * white) / 1.02;
      last = output[i];
      output[i] *= 1.2;
    }

    const windSource = this.ctx.createBufferSource();
    windSource.buffer = noiseBuffer;
    windSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 180;

    windSource.connect(filter);
    filter.connect(this.windGain);
    windSource.start(0);
  }

  private scheduleCrackles = () => {
    if (!this.isRunning) return;

    const playCrackle = () => {
      if (!this.ctx || !this.fireGain || this.isMuted) return;

      const now = this.ctx.currentTime;
      const isBigPop = Math.random() < 0.22;

      const osc = this.ctx.createOscillator();
      const popGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // Sharp fast impulse
      osc.type = "triangle";
      osc.frequency.setValueAtTime(isBigPop ? 300 + Math.random() * 500 : 1200 + Math.random() * 1800, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + (isBigPop ? 0.08 : 0.025));

      filter.type = "bandpass";
      filter.frequency.value = isBigPop ? 800 : 2400;
      filter.Q.value = 3;

      const baseVol = isBigPop ? 0.45 : 0.2;
      popGain.gain.setValueAtTime(baseVol * Math.random(), now);
      popGain.gain.exponentialRampToValueAtTime(0.0001, now + (isBigPop ? 0.09 : 0.03));

      osc.connect(filter);
      filter.connect(popGain);
      popGain.connect(this.fireGain);

      osc.start(now);
      osc.stop(now + (isBigPop ? 0.1 : 0.04));
    };

    // Play 1-3 micro pops
    const burstCount = Math.floor(1 + Math.random() * 3);
    for (let i = 0; i < burstCount; i++) {
      setTimeout(playCrackle, i * (20 + Math.random() * 80));
    }

    const nextDelay = 120 + Math.random() * 450;
    this.crackleTimer = window.setTimeout(this.scheduleCrackles, nextDelay);
  };

  public playStokeSound() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(380, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.5);

    filter.type = "lowpass";
    filter.frequency.value = 500;

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.6);
  }

  public playMessageSound() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.resume();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.45);
  }

  public playTestChime() {
    if (!this.ctx) this.initContext();
    if (!this.ctx) return;
    this.resume();

    const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
    const now = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);

      gain.gain.setValueAtTime(0.18, now + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.1 + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.45);
    });
  }

  public resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("campfire-ambient-muted", String(muted));
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(
        muted ? 0 : this.volume,
        this.ctx.currentTime
      );
    }
    if (!muted) {
      this.start();
    }
  }

  public getMuted() {
    return this.isMuted;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (typeof window !== "undefined") {
      window.localStorage.setItem("campfire-ambient-vol", String(this.volume));
    }
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public getVolume() {
    return this.volume;
  }

  public stop() {
    this.isRunning = false;
    if (this.crackleTimer) {
      clearTimeout(this.crackleTimer);
      this.crackleTimer = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export const ambientAudio = new AmbientAudioEngine();
