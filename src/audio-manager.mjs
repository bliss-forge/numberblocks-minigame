import { VOICE } from "./audio-manifest.mjs";

const SFX = Object.freeze({
  key: { notes: [659.25], duration: 0.07, gain: 0.035, wave: "sine" },
  pop: {
    notes: [392.0, 523.25],
    duration: 0.12,
    gain: 0.06,
    wave: "triangle"
  },
  win: {
    notes: [523.25, 659.25, 783.99, 1046.5],
    duration: 0.22,
    gain: 0.08,
    wave: "sine"
  },
  wrong: {
    notes: [440.0, 392.0],
    duration: 0.16,
    gain: 0.04,
    wave: "sine"
  },
  door: {
    notes: [987.77, 783.99],
    duration: 0.24,
    gain: 0.06,
    wave: "sine"
  },
  bell: {
    notes: [659.25, 659.25, 880.0],
    duration: 0.12,
    gain: 0.05,
    wave: "triangle"
  },
  jingle: {
    notes: [523.25, 587.33, 659.25, 783.99, 659.25],
    duration: 0.14,
    gain: 0.06,
    wave: "triangle"
  },
  // 기관사 게임의 경적 — 낮은 2음 "빵-빵". 연타해도 짧아서 겹침이 순하다.
  horn: {
    notes: [311.13, 233.08],
    duration: 0.3,
    gain: 0.07,
    wave: "triangle"
  }
});

const DEFAULT_VOICE_TIMEOUT_MS = 12_000;

export class AudioManager {
  constructor({
    createAudio = src => new Audio(src),
    storage,
    audioContextFactory = () =>
      new (window.AudioContext || window.webkitAudioContext)(),
    logger = console,
    setTimer = (callback, delay) => setTimeout(callback, delay),
    clearTimer = timer => clearTimeout(timer),
    voiceTimeoutMs = DEFAULT_VOICE_TIMEOUT_MS
  } = {}) {
    this.createAudio = createAudio;
    this.audioContextFactory = audioContextFactory;
    this.logger = logger;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.voiceTimeoutMs = voiceTimeoutMs;
    this.context = null;
    this.epoch = 0;
    this.current = null;
    this.voicePlaying = false;
    this.warned = new Set();
    this.muted = false;
    this.engine = null;

    try {
      this.storage = storage === undefined ? globalThis.localStorage : storage;
      this.muted =
        this.storage?.getItem("numberblocks-muted") === "true";
    } catch (error) {
      this.storage = storage ?? null;
      this.warnOnce("storage:get", error);
    }
  }

  warnOnce(src, error) {
    if (this.warned.has(src)) return;
    this.warned.add(src);
    this.logger.warn(`Audio skipped: ${src}`, error);
  }

  // Resolves with how playback ended: "ended" | "error" | "cancelled" |
  // "skipped". Chained follow-ups should run only after "ended"/"error" —
  // never after "cancelled", which means something newer took over.
  playFile(src, epoch = this.epoch) {
    if (this.muted || !src || epoch !== this.epoch) {
      return Promise.resolve("skipped");
    }

    return new Promise(resolve => {
      let audio;
      try {
        audio = this.createAudio(src);
      } catch (error) {
        this.warnOnce(src, error);
        resolve("error");
        return;
      }

      let finished = false;
      let watchdog = null;
      const playback = {
        audio,
        finish: (status = "ended") => {
          if (finished) return;
          finished = true;
          if (watchdog !== null) {
            this.clearTimer(watchdog);
            watchdog = null;
          }
          audio.onended = null;
          audio.onerror = null;
          if (this.current === playback) {
            this.current = null;
            this.voicePlaying = false;
          }
          resolve(status);
        }
      };

      // Starting a new file supersedes whatever is playing; never leave an
      // orphaned <audio> running untracked underneath the new one.
      if (this.current) {
        const previous = this.current;
        try {
          previous.audio.pause();
        } catch (error) {
          this.warnOnce(previous.audio.src, error);
        }
        previous.finish("cancelled");
      }
      this.current = playback;
      this.voicePlaying = true;
      audio.volume = 0.88;
      audio.onended = () => playback.finish("ended");
      audio.onerror = error => {
        this.warnOnce(src, error);
        playback.finish("error");
      };
      watchdog = this.setTimer(() => {
        if (finished) return;
        this.warnOnce(src, new Error("Voice playback timed out"));
        try {
          audio.pause();
        } catch (error) {
          this.warnOnce(src, error);
        } finally {
          playback.finish("error");
        }
      }, this.voiceTimeoutMs);

      let playResult;
      try {
        playResult = audio.play();
      } catch (error) {
        this.warnOnce(src, error);
        playback.finish("error");
        return;
      }
      Promise.resolve(playResult).catch(error => {
        this.warnOnce(src, error);
        playback.finish("error");
      });
    });
  }

  async playVoice(key, language = "ko") {
    const epoch = this.epoch;
    await this.playFile(VOICE[key]?.[language], epoch);
  }

  // 상태를 돌려준다 — 호출부가 "밀렸는지"를 알아야 후속 음성을 이을지 판단할 수
  // 있다. 반환이 없던 동안 지하철 폴백 경로가 취소를 모르고 후속을 이어 도착
  // 멜로디를 눌러 껐다(심층 검토 P1-6). 실음원 경로는 이미 상태를 보고 있었다.
  async playPrompt(key) {
    const epoch = this.epoch;
    const entry = VOICE[key];
    const first = await this.playFile(entry?.ko, epoch);
    // 한국어가 다른 낭독에 밀렸으면 영어를 잇지 않는다 — 이으면 새로 시작한
    // 안내를 영어가 덮어써서 정작 들려줘야 할 문장이 잘린다.
    if (first === "cancelled") return "cancelled";
    if (entry?.en) return await this.playFile(entry.en, epoch);
    return first;
  }

  async playAnswer(number) {
    const epoch = this.epoch;
    const entry = VOICE[`number-${number}`];
    await this.playFile(entry?.ko, epoch);
    await this.playFile(entry?.en, epoch);
  }

  cancel() {
    this.epoch += 1;
    const playback = this.current;
    if (!playback) return;

    try {
      playback.audio.pause();
    } catch (error) {
      this.warnOnce(playback.audio.src, error);
    } finally {
      playback.finish("cancelled");
      if (this.current === playback) this.current = null;
    }
  }

  playSfx(name) {
    const preset = SFX[name];
    if (this.muted || !preset) return;

    if (!this.context) {
      try {
        this.context = this.audioContextFactory();
        if (!this.context) throw new Error("AudioContext unavailable");
      } catch (error) {
        this.context = null;
        this.warnOnce("sfx:context", error);
        return;
      }
    }

    try {
      if (
        this.context.state === "suspended" &&
        typeof this.context.resume === "function"
      ) {
        try {
          const resumeResult = this.context.resume();
          Promise.resolve(resumeResult).catch(error => {
            this.warnOnce("sfx:resume", error);
          });
        } catch (error) {
          this.warnOnce("sfx:resume", error);
        }
      }

      const now = this.context.currentTime;
      const ducking = this.voicePlaying ? 0.55 : 1;

      preset.notes.forEach((frequency, index) => {
        const start = now + index * 0.08;
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();

        oscillator.type = preset.wave;
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(
          preset.gain * ducking,
          start + 0.005
        );
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          start + preset.duration
        );
        oscillator.connect(gain);
        gain.connect(this.context.destination);
        oscillator.start(start);
        oscillator.stop(start + preset.duration + 0.02);
      });
    } catch (error) {
      this.warnOnce(`sfx:${name}`, error);
    }
  }

  // ── 주행음 — 새 에셋 없이 WebAudio 합성 ─────────────────────────────────
  // 노이즈(레일 구름소리) + 저역 험(차체 울림) 두 층. 속도 비율(0~1.67,
  // 부스터 포함)이 필터 컷오프·게인을 밀어 "밟는 맛"이 소리로 난다.
  // 게인 램프 0.4s — 즉시 변속이 아니라 가속의 변화가 들리게(협회 관찰 보고).

  startEngine() {
    if (this.muted || this.engine) return;
    if (!this.context) {
      try {
        this.context = this.audioContextFactory();
        if (!this.context) throw new Error("AudioContext unavailable");
      } catch (error) {
        this.context = null;
        this.warnOnce("engine:context", error);
        return;
      }
    }
    try {
      if (this.context.state === "suspended") {
        Promise.resolve(this.context.resume?.()).catch(() => {});
      }
      const context = this.context;
      const seconds = 2;
      const buffer = context.createBuffer(
        1, context.sampleRate * seconds, context.sampleRate);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < channel.length; i += 1) {
        channel[i] = Math.random() * 2 - 1;
      }
      const noise = context.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 140;
      filter.Q.value = 0.6;
      const noiseGain = context.createGain();
      noiseGain.gain.value = 0.0001;
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(context.destination);
      noise.start();

      const hum = context.createOscillator();
      hum.type = "sine";
      hum.frequency.value = 46;
      const humGain = context.createGain();
      humGain.gain.value = 0.0001;
      hum.connect(humGain);
      humGain.connect(context.destination);
      hum.start();

      this.engine = { noise, filter, noiseGain, hum, humGain };
    } catch (error) {
      this.engine = null;
      this.warnOnce("engine:start", error);
    }
  }

  setEngineSpeed(ratio) {
    if (!this.engine) return;
    try {
      const context = this.context;
      const clamped = Math.max(0, Math.min(1.7, Number.isFinite(ratio) ? ratio : 0));
      const now = context.currentTime;
      const at = now + 0.4;
      // 정지 = 무음. 저속은 낮게 웅웅, 고속은 컷오프가 열리며 쏴아 커진다.
      // 매번 cancel 후 현재값에서 다시 램프 — 미래에 남은 이전 램프가 나중에
      // 되살아나는 것(정지 후 유령 소리)을 원천 차단한다.
      const level = clamped === 0 ? 0.0001 : 0.008 + clamped * 0.03;
      const retarget = (param, target) => {
        param.cancelScheduledValues(now);
        param.setValueAtTime(param.value, now);
        param.linearRampToValueAtTime(target, at);
      };
      retarget(this.engine.noiseGain.gain, this.muted ? 0.0001 : level);
      retarget(this.engine.filter.frequency, 140 + clamped * 720);
      retarget(this.engine.humGain.gain,
        this.muted || clamped === 0 ? 0.0001 : 0.004 + clamped * 0.014);
      retarget(this.engine.hum.frequency, 46 + clamped * 34);
    } catch (error) {
      this.warnOnce("engine:speed", error);
    }
  }

  stopEngine() {
    if (!this.engine) return;
    try {
      const { noise, hum, noiseGain, humGain } = this.engine;
      const at = this.context.currentTime;
      for (const param of [noiseGain.gain, humGain.gain]) {
        param.cancelScheduledValues(at);
        param.setValueAtTime(param.value, at);
        param.linearRampToValueAtTime(0.0001, at + 0.25);
      }
      noise.stop(at + 0.35);
      hum.stop(at + 0.35);
    } catch (error) {
      this.warnOnce("engine:stop", error);
    }
    this.engine = null;
  }

  toggleMuted() {
    this.muted = !this.muted;
    if (this.muted) this.cancel();
    if (this.muted) this.stopEngine();
    try {
      this.storage?.setItem("numberblocks-muted", String(this.muted));
    } catch (error) {
      this.warnOnce("storage:set", error);
    }
    return this.muted;
  }
}
