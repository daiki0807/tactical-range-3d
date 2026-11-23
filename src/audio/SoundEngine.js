/**
 * Procedural Web Audio API Realistic Firearm Sound Engine
 * Synthesizes multi-layered gunshots, indoor range convolution reverb,
 * suppressor acoustics, brass shell casing clinks, reloads, bolt cycles,
 * and metallic steel target impacts.
 */
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.reverbNode = null;
    this.reverbGain = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.volume = 0.85;
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

    // Master chain: DynamicsCompressor -> Soft Clipper -> MasterGain -> Destination
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-10, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(14, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(8, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.001, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.12, this.ctx.currentTime);

    this.shaper = this.ctx.createWaveShaper();
    this.shaper.curve = this._makeSaturationCurve(22);
    this.shaper.oversample = '2x';

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);

    this.compressor.connect(this.shaper);
    this.shaper.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // Pre-generate 2 seconds of white noise
    this.noiseBuffer = this._createNoiseBuffer(2.0);

    // Create procedural Indoor Tactical Range Impulse Response Reverb
    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = this._createRangeImpulseResponse(1.65, 2.8);

    this.reverbFilter = this.ctx.createBiquadFilter();
    this.reverbFilter.type = 'lowpass';
    this.reverbFilter.frequency.setValueAtTime(2800, this.ctx.currentTime);

    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.setValueAtTime(0.42, this.ctx.currentTime);

    this.reverbNode.connect(this.reverbFilter);
    this.reverbFilter.connect(this.reverbGain);
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

  _makeSaturationCurve(amount) {
    const samples = 1024;
    const curve = new Float32Array(samples);
    const k = amount;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  _createNoiseBuffer(durationSec) {
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * durationSec);
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  _createRangeImpulseResponse(duration, decay) {
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const impulse = this.ctx.createBuffer(2, length, sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const channelData = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const t = i / length;
        // Simulate concrete range early reflections + smooth tail
        let env = Math.pow(1 - t, decay);
        // Add subtle concrete slap-back reflection bursts at ~28ms, ~62ms, ~110ms
        const ms = (i / sampleRate) * 1000;
        if (Math.abs(ms - 28) < 3 || Math.abs(ms - 62) < 4 || Math.abs(ms - 112) < 5) {
          env *= 1.65;
        }
        channelData[i] = (Math.random() * 2 - 1) * env;
      }
    }
    return impulse;
  }

  /**
   * Play realistic multi-layered gunshot
   */
  playGunshot(profile, suppressed = false) {
    this.init();
    const now = this.ctx.currentTime;
    const jitter = 0.96 + Math.random() * 0.08; // Natural shot-to-shot micro-variation

    // 1. Mechanical Bolt / Hammer Transient
    this._playMechanicalSnap(now, suppressed ? 0.55 : 0.32, jitter);

    if (suppressed) {
      // --- SUPPRESSED ACOUSTICS ---
      // Sharp compressed gas puff ("pfft")
      const puffSrc = this.ctx.createBufferSource();
      puffSrc.buffer = this.noiseBuffer;
      const puffFilter = this.ctx.createBiquadFilter();
      puffFilter.type = 'bandpass';
      puffFilter.frequency.setValueAtTime(1400 * jitter, now);
      puffFilter.frequency.exponentialRampToValueAtTime(380, now + 0.075);
      puffFilter.Q.setValueAtTime(1.4, now);

      const puffGain = this.ctx.createGain();
      puffGain.gain.setValueAtTime(0.001, now);
      puffGain.gain.linearRampToValueAtTime(0.55 * profile.crackGain, now + 0.002);
      puffGain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

      puffSrc.connect(puffFilter);
      puffFilter.connect(puffGain);
      puffGain.connect(this.compressor);

      // Subtle damped sub-thump
      const subOsc = this.ctx.createOscillator();
      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(profile.punchFreq * 0.9 * jitter, now);
      subOsc.frequency.exponentialRampToValueAtTime(48, now + 0.055);
      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.35 * profile.punchGain, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      subOsc.connect(subGain);
      subGain.connect(this.compressor);

      // Small reverb send
      const revSend = this.ctx.createGain();
      revSend.gain.setValueAtTime(0.18, now);
      puffGain.connect(revSend);
      revSend.connect(this.reverbNode);

      puffSrc.start(now, Math.random() * 0.5, 0.12);
      subOsc.start(now);
      subOsc.stop(now + 0.07);
    } else {
      // --- UNSUPPRESSED FULL MUZZLE BLAST ---
      // Layer A: Sub-bass chest punch (pressure wave)
      const punchOsc = this.ctx.createOscillator();
      punchOsc.type = 'sine';
      punchOsc.frequency.setValueAtTime(profile.punchFreq * jitter, now);
      punchOsc.frequency.exponentialRampToValueAtTime(profile.punchEndFreq, now + 0.095);

      const punchGain = this.ctx.createGain();
      punchGain.gain.setValueAtTime(0.001, now);
      punchGain.gain.linearRampToValueAtTime(profile.punchGain, now + 0.002);
      punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

      punchOsc.connect(punchGain);
      punchGain.connect(this.compressor);
      punchOsc.start(now);
      punchOsc.stop(now + 0.14);

      // Layer B: High-energy supersonic crack
      const crackSrc = this.ctx.createBufferSource();
      crackSrc.buffer = this.noiseBuffer;

      const crackFilter = this.ctx.createBiquadFilter();
      crackFilter.type = 'bandpass';
      crackFilter.frequency.setValueAtTime(profile.crackFreq * jitter, now);
      crackFilter.frequency.exponentialRampToValueAtTime(320, now + profile.crackDecay);
      crackFilter.Q.setValueAtTime(profile.crackQ, now);

      const crackGain = this.ctx.createGain();
      crackGain.gain.setValueAtTime(0.001, now);
      crackGain.gain.linearRampToValueAtTime(profile.crackGain, now + 0.0012);
      crackGain.gain.exponentialRampToValueAtTime(0.001, now + profile.crackDecay);

      crackSrc.connect(crackFilter);
      crackFilter.connect(crackGain);
      crackGain.connect(this.compressor);
      crackSrc.start(now, Math.random() * 0.8, profile.crackDecay + 0.04);

      // Layer C: Mid-low explosive body boom
      const bodySrc = this.ctx.createBufferSource();
      bodySrc.buffer = this.noiseBuffer;

      const bodyFilter = this.ctx.createBiquadFilter();
      bodyFilter.type = 'lowpass';
      bodyFilter.frequency.setValueAtTime(profile.bodyFreq * 2.2 * jitter, now);
      bodyFilter.frequency.exponentialRampToValueAtTime(140, now + profile.bodyDecay);

      const bodyGain = this.ctx.createGain();
      bodyGain.gain.setValueAtTime(0.001, now);
      bodyGain.gain.linearRampToValueAtTime(0.95 * profile.punchGain, now + 0.003);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, now + profile.bodyDecay);

      bodySrc.connect(bodyFilter);
      bodyFilter.connect(bodyGain);
      bodyGain.connect(this.compressor);

      // Send body + crack into Indoor Range Reverb
      const revSend = this.ctx.createGain();
      revSend.gain.setValueAtTime(profile.reverbSend, now);
      bodyGain.connect(revSend);
      crackGain.connect(revSend);
      revSend.connect(this.reverbNode);

      bodySrc.start(now, Math.random() * 0.8, profile.bodyDecay + 0.05);
    }
  }

  _playMechanicalSnap(time, gainLevel, jitter) {
    const snapSrc = this.ctx.createBufferSource();
    snapSrc.buffer = this.noiseBuffer;

    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(3400 * jitter, time);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainLevel, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.018);

    snapSrc.connect(hp);
    hp.connect(g);
    g.connect(this.compressor);
    snapSrc.start(time, Math.random() * 0.5, 0.025);
  }

  /**
   * Metallic brass casing hitting concrete floor (2-3 bounces)
   */
  playShellCasing(pitchMult = 1.0) {
    if (!this.ctx) return;
    const baseDelay = 0.28 + Math.random() * 0.14;
    const bounces = [0, 0.11 + Math.random() * 0.04, 0.19 + Math.random() * 0.04];

    bounces.forEach((offset, idx) => {
      const t = this.ctx.currentTime + baseDelay + offset;
      const vol = (0.065 / (idx + 1)) * (0.85 + Math.random() * 0.3);
      const baseFreq = (4200 + Math.random() * 900) * pitchMult;

      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(baseFreq, t);
      osc2.frequency.setValueAtTime(baseFreq * 1.41, t);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.001);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);

      osc1.connect(g);
      osc2.connect(g);
      g.connect(this.compressor);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.05);
      osc2.stop(t + 0.05);
    });
  }

  /**
   * Dry fire empty magazine click
   */
  playDryFire() {
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2200, now);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.016);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    osc.connect(g);
    g.connect(this.compressor);
    osc.start(now);
    osc.stop(now + 0.025);
  }

  /**
   * Reload sequence: mag out -> mag in -> slide/bolt rack
   */
  playReload(durationSec = 1.6) {
    this.init();
    const now = this.ctx.currentTime;

    // 1. Mag release & slide out
    this._playMetallicClick(now + 0.12, 950, 0.22);
    this._playMetallicClick(now + 0.22, 620, 0.16);

    // 2. Fresh mag snap in
    const insertTime = now + durationSec * 0.56;
    this._playMetallicClick(insertTime, 480, 0.32);
    this._playMetallicClick(insertTime + 0.05, 1350, 0.28);

    // 3. Slide / bolt rack double clack
    const rackTime = now + durationSec * 0.80;
    this._playMetallicClick(rackTime, 1650, 0.3);
    this._playMetallicClick(rackTime + 0.11, 2100, 0.36);
  }

  /**
   * Bolt-action sniper rifle cycle sound
   */
  playBoltCycle() {
    this.init();
    const now = this.ctx.currentTime;
    this._playMetallicClick(now + 0.18, 1700, 0.24); // lift
    this._playMetallicClick(now + 0.30, 1200, 0.28); // pull back
    this._playMetallicClick(now + 0.52, 1500, 0.28); // push forward
    this._playMetallicClick(now + 0.64, 2200, 0.26); // lock down
  }

  _playMetallicClick(time, freq, vol) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(freq, time);
    bp.Q.setValueAtTime(3.2, time);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.045);

    src.connect(bp);
    bp.connect(g);
    g.connect(this.compressor);
    src.start(time, Math.random() * 0.5, 0.05);
  }

  /**
   * Satisfying steel gong / plate "PING!"
   */
  playSteelHit(distance = 25) {
    if (!this.ctx) return;
    const delay = Math.min(0.18, distance / 340);
    const t = this.ctx.currentTime + delay;
    const base = 1180 + Math.random() * 180;
    const ratios = [1.0, 1.52, 2.34, 3.18];

    ratios.forEach((r, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(base * r, t);

      const g = this.ctx.createGain();
      const amp = 0.24 / (i + 1);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(amp, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42 - i * 0.07);

      osc.connect(g);
      g.connect(this.compressor);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  /**
   * Paper silhouette impact punch
   */
  playPaperHit(distance = 15) {
    if (!this.ctx) return;
    const delay = Math.min(0.12, distance / 340);
    const t = this.ctx.currentTime + delay;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(750, t);
    bp.Q.setValueAtTime(1.5, t);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

    src.connect(bp);
    bp.connect(g);
    g.connect(this.compressor);
    src.start(t, Math.random() * 0.5, 0.04);
  }
}
