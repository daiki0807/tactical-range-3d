/**
 * Ultra-Realistic 5-Phase Procedural Firearm Ballistics Sound Engine
 * Models real-world gunpowder acoustics:
 *  1. Microsecond N-wave ballistic shockwave / supersonic crack
 *  2. Asymmetrically saturated pink/brown noise propellant detonation (no synthy sine sweeps)
 *  3. Dual-stage mechanical action (unlock snap + slide/bolt slam return into battery)
 *  4. Stereo indoor concrete range early slap-back reflections
 *  5. Deep 50m concrete tunnel diffused reverb tail
 */
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.reverbNode = null;
    this.earlyRefNode = null;
    this.whiteBuffer = null;
    this.pinkBuffer = null;
    this.brownBuffer = null;
    this.muted = false;
    this.volume = 0.88;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();

    // Master Limiter + Warm Analog Tape/Air Saturation
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-6, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(10, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.0005, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.09, this.ctx.currentTime);

    this.shaper = this.ctx.createWaveShaper();
    this.shaper.curve = this._makeAsymmetricClipCurve(3.6);
    this.shaper.oversample = '4x';

    // Subtle body warmth EQ
    this.lowShelf = this.ctx.createBiquadFilter();
    this.lowShelf.type = 'lowshelf';
    this.lowShelf.frequency.setValueAtTime(115, this.ctx.currentTime);
    this.lowShelf.gain.setValueAtTime(4.5, this.ctx.currentTime);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);

    this.shaper.connect(this.lowShelf);
    this.lowShelf.connect(this.compressor);
    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // Pre-generate White, Pink, and Brown noise buffers (2.5 seconds each)
    this.whiteBuffer = this._createNoiseBuffer(2.5, 'white');
    this.pinkBuffer = this._createNoiseBuffer(2.5, 'pink');
    this.brownBuffer = this._createNoiseBuffer(2.5, 'brown');

    // Stereo Concrete Range Convolution Reverb (Long Tail + Distinct Early Slap-back)
    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = this._createConcreteRangeIR(1.95);

    this.reverbLP = this.ctx.createBiquadFilter();
    this.reverbLP.type = 'lowpass';
    this.reverbLP.frequency.setValueAtTime(2400, this.ctx.currentTime);

    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.setValueAtTime(0.62, this.ctx.currentTime);

    this.reverbNode.connect(this.reverbLP);
    this.reverbLP.connect(this.reverbGain);
    this.reverbGain.connect(this.compressor);
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && !this.muted) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
    }
  }

  _makeAsymmetricClipCurve(drive) {
    const n = 2048;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      // Asymmetric soft-hard clipping mimics real acoustic overpressure waves
      const y = x >= 0 ? Math.tanh(x * drive) : Math.tanh(x * drive * 0.85);
      curve[i] = y;
    }
    return curve;
  }

  _createNoiseBuffer(durationSec, type = 'white') {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * durationSec);
    const buffer = this.ctx.createBuffer(2, len, sr);

    for (let ch = 0; ch < 2; ch++) {
      const out = buffer.getChannelData(ch);
      if (type === 'white') {
        for (let i = 0; i < len; i++) out[i] = Math.random() * 2 - 1;
      } else if (type === 'pink') {
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.96900 * b2 + w * 0.1538520;
          b3 = 0.86650 * b3 + w * 0.3104856;
          b4 = 0.55000 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.0168980;
          out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.14;
          b6 = w * 0.115926;
        }
      } else {
        // Brown noise (heavy low-frequency propellant rumble)
        let last = 0;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          last = (last + 0.045 * w) / 1.045;
          out[i] = last * 3.8;
        }
      }
    }
    return buffer;
  }

  _createConcreteRangeIR(duration) {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * duration);
    const ir = this.ctx.createBuffer(2, len, sr);

    // Distinct early reflections (walls, ceiling, shooting bench, 25m/50m backstop)
    const reflections = [
      { ms: 9, gain: 0.9, pan: -0.3 },
      { ms: 16, gain: 0.85, pan: 0.35 },
      { ms: 29, gain: 0.72, pan: -0.5 },
      { ms: 48, gain: 0.65, pan: 0.45 },
      { ms: 84, gain: 0.55, pan: -0.2 },
      { ms: 145, gain: 0.45, pan: 0.15 }, // 25m bounce
      { ms: 265, gain: 0.32, pan: 0.0 },  // 50m backstop slap-back
    ];

    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // Exponentially decaying diffused hall tail
        const env = Math.pow(1 - t, 2.7) * 0.55;
        data[i] = (Math.random() * 2 - 1) * env;
      }

      // Inject crisp stereo early reflections
      reflections.forEach((r) => {
        const idx = Math.floor((r.ms / 1000) * sr) + (ch === 1 ? Math.floor(r.pan * 22) : 0);
        const sideGain = ch === 0 ? (1 - Math.max(0, r.pan)) : (1 + Math.min(0, r.pan));
        for (let k = 0; k < 95 && idx + k < len; k++) {
          if (idx + k >= 0) {
            const tapEnv = Math.exp(-k / 26);
            data[idx + k] += (Math.random() * 2 - 1) * r.gain * sideGain * tapEnv;
          }
        }
      });
    }
    return ir;
  }

  /**
   * Play realistic 5-phase gunshot
   */
  playGunshot(profile, suppressed = false) {
    this.init();
    const now = this.ctx.currentTime;
    const jitter = 0.95 + Math.random() * 0.10;
    const power = profile.punchGain; // scales from ~0.72 (SMG) to ~1.55 (.338 Sniper)

    // --- PHASE 3A: Mechanical Firing Pin / Bolt Unlock (t = 0) ---
    this._playActionClack(now, suppressed ? 0.62 : 0.34, 3200 * jitter, 0.016);

    if (suppressed) {
      // === REALISTIC SUPPRESSED ACOUSTICS ===
      // 1. High-pressure baffle gas release ("tssss-pfft")
      const gas = this.ctx.createBufferSource();
      gas.buffer = this.whiteBuffer;
      const gasBP = this.ctx.createBiquadFilter();
      gasBP.type = 'bandpass';
      gasBP.frequency.setValueAtTime(2200 * jitter, now);
      gasBP.frequency.exponentialRampToValueAtTime(520, now + 0.065);
      gasBP.Q.setValueAtTime(1.1, now);

      const gasGain = this.ctx.createGain();
      gasGain.gain.setValueAtTime(0.001, now);
      gasGain.gain.linearRampToValueAtTime(0.65 * power, now + 0.0015);
      gasGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

      gas.connect(gasBP);
      gasBP.connect(gasGain);
      gasGain.connect(this.shaper);
      gas.start(now, Math.random() * 1.2, 0.1);

      // 2. Tight pressurized suppressor chamber thump (filtered brown noise, NOT sine)
      const thump = this.ctx.createBufferSource();
      thump.buffer = this.brownBuffer;
      const thumpLP = this.ctx.createBiquadFilter();
      thumpLP.type = 'lowpass';
      thumpLP.frequency.setValueAtTime(280 * jitter, now);
      thumpLP.frequency.exponentialRampToValueAtTime(75, now + 0.065);

      const thumpGain = this.ctx.createGain();
      thumpGain.gain.setValueAtTime(0.001, now);
      thumpGain.gain.linearRampToValueAtTime(0.9 * power, now + 0.002);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.072);

      thump.connect(thumpLP);
      thumpLP.connect(thumpGain);
      thumpGain.connect(this.shaper);
      thump.start(now, Math.random() * 1.2, 0.09);

      // 3. Prominent bolt/slide slamming back into battery (~52ms later)
      this._playActionClack(now + 0.052, 0.52, 2350 * jitter, 0.022);

      // Light room reflection
      const revSend = this.ctx.createGain();
      revSend.gain.setValueAtTime(0.22, now);
      gasGain.connect(revSend);
      revSend.connect(this.reverbNode);
      return;
    }

    // === UNSUPPRESSED FULL BALLISTIC DETONATION ===

    // --- PHASE 1: Supersonic Crack / N-Wave Shockwave (0 - 14ms) ---
    // Instantaneous broadband snap that gives real firearms their sharp "CRACK!"
    const crack = this.ctx.createBufferSource();
    crack.buffer = this.whiteBuffer;

    const crackHP = this.ctx.createBiquadFilter();
    crackHP.type = 'highpass';
    crackHP.frequency.setValueAtTime(950 * jitter, now);

    const crackPeak = this.ctx.createBiquadFilter();
    crackPeak.type = 'peaking';
    crackPeak.frequency.setValueAtTime(profile.crackFreq * jitter, now);
    crackPeak.Q.setValueAtTime(1.1, now);
    crackPeak.gain.setValueAtTime(7.5, now);

    const crackGain = this.ctx.createGain();
    crackGain.gain.setValueAtTime(0.001, now);
    crackGain.gain.linearRampToValueAtTime(1.45 * profile.crackGain, now + 0.0008);
    crackGain.gain.exponentialRampToValueAtTime(0.28 * profile.crackGain, now + 0.016);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + profile.crackDecay * 0.95);

    crack.connect(crackHP);
    crackHP.connect(crackPeak);
    crackPeak.connect(crackGain);
    crackGain.connect(this.shaper);
    crack.start(now, Math.random() * 1.4, profile.crackDecay + 0.04);

    // --- PHASE 2A: Mid-Range Gunpowder Bark (Pink Noise) ---
    const bark = this.ctx.createBufferSource();
    bark.buffer = this.pinkBuffer;

    const barkFilter = this.ctx.createBiquadFilter();
    barkFilter.type = 'bandpass';
    barkFilter.frequency.setValueAtTime(profile.bodyFreq * 2.1 * jitter, now);
    barkFilter.frequency.exponentialRampToValueAtTime(profile.bodyFreq * 0.45, now + profile.bodyDecay);
    barkFilter.Q.setValueAtTime(0.65, now);

    const barkGain = this.ctx.createGain();
    barkGain.gain.setValueAtTime(0.001, now);
    barkGain.gain.linearRampToValueAtTime(1.65 * power, now + 0.002);
    barkGain.gain.exponentialRampToValueAtTime(0.001, now + profile.bodyDecay * 1.15);

    bark.connect(barkFilter);
    barkFilter.connect(barkGain);
    barkGain.connect(this.shaper);
    bark.start(now, Math.random() * 1.4, profile.bodyDecay * 1.2 + 0.05);

    // --- PHASE 2B: Chest-Thumping Low-End Blast Wave (Brown Noise, NOT synthetic sine) ---
    const blast = this.ctx.createBufferSource();
    blast.buffer = this.brownBuffer;

    const blastLP = this.ctx.createBiquadFilter();
    blastLP.type = 'lowpass';
    blastLP.frequency.setValueAtTime(Math.max(240, profile.punchFreq * 2.6) * jitter, now);
    blastLP.frequency.exponentialRampToValueAtTime(52, now + profile.bodyDecay * 1.25);

    const blastGain = this.ctx.createGain();
    blastGain.gain.setValueAtTime(0.001, now);
    blastGain.gain.linearRampToValueAtTime(2.1 * power, now + 0.0025);
    blastGain.gain.exponentialRampToValueAtTime(0.001, now + profile.bodyDecay * 1.35);

    blast.connect(blastLP);
    blastLP.connect(blastGain);
    blastGain.connect(this.shaper);
    blast.start(now, Math.random() * 1.4, profile.bodyDecay * 1.4 + 0.05);

    // --- PHASE 3B: Slide / Bolt Carrier Returning to Battery (~58ms later) ---
    this._playActionClack(now + 0.058, 0.24, 2400 * jitter, 0.02);

    // --- PHASE 4 & 5: Indoor Concrete Tunnel Slap-back & Reverb Tail ---
    const revSend = this.ctx.createGain();
    revSend.gain.setValueAtTime(profile.reverbSend * 0.92, now);
    crackGain.connect(revSend);
    barkGain.connect(revSend);
    blastGain.connect(revSend);
    revSend.connect(this.reverbNode);
  }

  _playActionClack(time, gainLevel, freq, duration) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.whiteBuffer;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(freq, time);
    bp.Q.setValueAtTime(2.6, time);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(gainLevel, time + 0.0015);
    g.gain.exponentialRampToValueAtTime(0.001, time + duration);

    src.connect(bp);
    bp.connect(g);
    g.connect(this.compressor);
    src.start(time, Math.random() * 1.2, duration + 0.01);
  }

  /**
   * Realistic Brass Shell Casing Clinking on Concrete (3 bounces with harmonic ring)
   */
  playShellCasing(pitchMult = 1.0) {
    if (!this.ctx) return;
    const baseDelay = 0.26 + Math.random() * 0.14;
    const bounces = [
      { offset: 0, amp: 0.075 },
      { offset: 0.11 + Math.random() * 0.04, amp: 0.048 },
      { offset: 0.18 + Math.random() * 0.04, amp: 0.024 },
    ];

    bounces.forEach((b) => {
      const t = this.ctx.currentTime + baseDelay + b.offset;
      const f = (4600 + Math.random() * 850) * pitchMult;
      const partials = [1.0, 1.38, 2.12];

      partials.forEach((p, idx) => {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f * p, t);

        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(b.amp / (idx + 1), t + 0.001);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.048 - idx * 0.01);

        osc.connect(g);
        g.connect(this.compressor);
        osc.start(t);
        osc.stop(t + 0.055);
      });
    });
  }

  /**
   * Dry fire empty chamber metallic click
   */
  playDryFire() {
    this.init();
    const now = this.ctx.currentTime;
    this._playActionClack(now, 0.42, 2600, 0.018);
    this._playActionClack(now + 0.008, 0.22, 1100, 0.022);
  }

  /**
   * Realistic multi-step reload acoustics (mag release -> drop -> mag slap -> bolt release)
   */
  playReload(durationSec = 1.6) {
    this.init();
    const now = this.ctx.currentTime;

    // 1. Mag catch press + mag slide out
    this._playActionClack(now + 0.10, 0.30, 1450, 0.025);
    this._playActionClack(now + 0.22, 0.22, 720, 0.055);

    // 2. Fresh mag seated firmly
    const ins = now + durationSec * 0.54;
    this._playActionClack(ins, 0.44, 520, 0.045);
    this._playActionClack(ins + 0.045, 0.36, 1750, 0.028);

    // 3. Heavy metallic slide/bolt rack (pull + release slam)
    const rack = now + durationSec * 0.78;
    this._playActionClack(rack, 0.38, 1950, 0.035);
    this._playActionClack(rack + 0.12, 0.48, 2550, 0.038);
  }

  /**
   * Bolt-action rifle manual bolt cycle (lift -> pull -> eject -> push -> lock)
   */
  playBoltCycle() {
    this.init();
    const now = this.ctx.currentTime;
    this._playActionClack(now + 0.16, 0.32, 2100, 0.025);
    this._playActionClack(now + 0.28, 0.38, 1350, 0.055);
    this._playActionClack(now + 0.50, 0.38, 1600, 0.055);
    this._playActionClack(now + 0.64, 0.42, 2650, 0.028);
  }

  /**
   * Authentic AR500 Steel Target Impact (bullet jacket splat + ringing metallic gong)
   */
  playSteelHit(distance = 25) {
    if (!this.ctx) return;
    const delay = Math.min(0.16, distance / 340);
    const t = this.ctx.currentTime + delay;

    // Initial lead-on-steel splat transient
    this._playActionClack(t, 0.38, 3800, 0.018);

    // Inharmonic steel plate ring partials
    const base = 1120 + Math.random() * 190;
    const partials = [1.0, 1.54, 2.38, 3.21, 4.15];
    partials.forEach((ratio, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(base * ratio, t);

      const g = this.ctx.createGain();
      const amp = 0.26 / (idx + 1);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(amp, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.52 - idx * 0.08);

      osc.connect(g);
      g.connect(this.compressor);
      osc.start(t);
      osc.stop(t + 0.56);
    });
  }

  /**
   * Crisp paper/cardboard target punch
   */
  playPaperHit(distance = 15) {
    if (!this.ctx) return;
    const delay = Math.min(0.11, distance / 340);
    const t = this.ctx.currentTime + delay;
    this._playActionClack(t, 0.20, 880, 0.028);
  }
}
