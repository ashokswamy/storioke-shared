import { Container, Graphics, Sprite, Text, Assets, Texture } from 'pixi.js';
import type { IScene, SceneContext } from '$lib/pixi/scene-types';
import { getContainScale } from '$lib/pixi/resize';

/* ────────────────────────────────────────────────────────────────────────────
   AudioScene — Renders a frequency-spectrum visualiser in PixiJS backed by
   the Web Audio API.

   Idle (paused): cover image + flat bars + pulse ring at rest.
   Play: analyser feeds live frequency data → animated bars + pulsing ring.
   Seek: sets audio.currentTime; analyser auto-decays when paused.
   Controls: play() / pause() / seek(t) / getProgress() as per IScene contract.
──────────────────────────────────────────────────────────────────────────── */

const N_BARS = 80;   // visualiser bar count
const BAR_GAP = 2;   // px gap between bars

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export class AudioScene implements IScene {
  private readonly audioUrl: string;
  private readonly coverUrl: string;
  private readonly label: string;

  private ctx: SceneContext | null = null;
  private sceneRoot: Container | null = null;

  // Audio
  private audioEl: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  // Uint8Array for getByteFrequencyData — typed as any to sidestep
  // the ArrayBuffer vs ArrayBufferLike variance in strict tsconfig targets.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private freqData: any = null;

  // Pixi display objects
  private pulseRing: Graphics | null = null;
  private barsGraphics: Graphics | null = null;
  private timeText: Text | null = null;

  // Pixi ticker callback (arrow fn stored for removal)
  private tickerFn: (() => void) | null = null;

  constructor(audioUrl: string, coverUrl = '', label = '') {
    this.audioUrl = audioUrl;
    this.coverUrl = coverUrl;
    this.label = label;
  }

  // ── IScene lifecycle ────────────────────────────────────────────────────────

  async mount(ctx: SceneContext): Promise<void> {
    this.ctx = ctx;
    const W = ctx.designWidth;
    const H = ctx.designHeight;

    const root = new Container();
    this.sceneRoot = root;
    ctx.root.addChild(root);

    // ── Background ───────────────────────────────────────────────────────────
    root.addChild(new Graphics().rect(0, 0, W, H).fill(0x0d1117));

    // Optional dimmed cover art
    if (this.coverUrl) {
      try {
        const texture: Texture = await Assets.load(this.coverUrl);
        const sprite = new Sprite(texture);
        const scale = Math.max(W / texture.width, H / texture.height);
        sprite.scale.set(scale);
        sprite.anchor.set(0.5);
        sprite.position.set(W / 2, H / 2);
        sprite.alpha = 0.18;
        root.addChild(sprite);
      } catch { /* no cover — continue with dark bg */ }
    }

    // Dark vignette overlay
    root.addChild(new Graphics().rect(0, 0, W, H).fill({ color: 0x000000, alpha: 0.55 }));

    // ── Title ────────────────────────────────────────────────────────────────
    const title = new Text({
      text: this.label || 'Audio',
      style: {
        fill: 0xf1f5f9,
        fontSize: 72,
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontWeight: '700',
      },
    });
    title.anchor.set(0.5, 0);
    title.position.set(W / 2, 64);
    root.addChild(title);

    const badge = new Text({
      text: '♫  audio scene',
      style: {
        fill: 0x60a5fa,
        fontSize: 30,
        fontFamily: '"Helvetica Neue", Arial, sans-serif',
        letterSpacing: 6,
      },
    });
    badge.anchor.set(0.5, 0);
    badge.position.set(W / 2, 164);
    root.addChild(badge);

    // ── Pulse ring (centre) ──────────────────────────────────────────────────
    const pulse = new Graphics();
    pulse.position.set(W / 2, H * 0.38);
    this.pulseRing = pulse;
    root.addChild(pulse);

    // Initial static ring draw
    this.drawRing(pulse, 0);

    // ── Visualiser bars ──────────────────────────────────────────────────────
    const bars = new Graphics();
    this.barsGraphics = bars;
    root.addChild(bars);

    // ── Time display ─────────────────────────────────────────────────────────
    const timeText = new Text({
      text: '0:00 / 0:00',
      style: {
        fill: 0x94a3b8,
        fontSize: 38,
        fontFamily: '"Helvetica Neue", Arial, sans-serif',
      },
    });
    timeText.anchor.set(0.5);
    timeText.position.set(W / 2, H - 80);
    this.timeText = timeText;
    root.addChild(timeText);

    // ── Web Audio API setup ──────────────────────────────────────────────────
    await this.initAudio();

    this.resize(ctx.app.renderer.width, ctx.app.renderer.height);

    // ── Ticker: visualisation update ─────────────────────────────────────────
    const fn = () => this.drawFrame();
    this.tickerFn = fn;
    ctx.app.ticker.add(fn);
  }

  play(): void {
    // Resume AudioContext (required by browser autoplay policy)
    if (this.audioCtx?.state === 'suspended') {
      this.audioCtx.resume();
    }
    this.audioEl?.play().catch(() => { /* autoplay policy — swallow */ });
  }

  pause(): void {
    this.audioEl?.pause();
  }

  seek(t: number): void {
    if (!this.audioEl) return;
    const clamped = Math.min(1, Math.max(0, t));
    const dur = this.audioEl.duration;
    if (Number.isFinite(dur) && dur > 0) {
      this.audioEl.currentTime = clamped * dur;
    }
  }

  getProgress(): number {
    if (!this.audioEl) return 0;
    const dur = this.audioEl.duration;
    if (!Number.isFinite(dur) || dur <= 0) return 0;
    return Math.min(1, this.audioEl.currentTime / dur);
  }

  resize(width: number, height: number): void {
    if (!this.sceneRoot || !this.ctx) return;
    const fit = getContainScale(this.ctx.designWidth, this.ctx.designHeight, width, height);
    this.sceneRoot.scale.set(fit.scale);
    this.sceneRoot.position.set(fit.offsetX, fit.offsetY);
  }

  destroy(): void {
    // Remove ticker BEFORE nulling ctx
    if (this.tickerFn && this.ctx?.app.ticker) {
      this.ctx.app.ticker.remove(this.tickerFn);
    }
    this.tickerFn = null;

    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.src = '';
      this.audioEl.load();
    }
    this.audioCtx?.close();

    this.sceneRoot?.destroy({ children: true });
    this.sceneRoot = null;
    this.pulseRing = null;
    this.barsGraphics = null;
    this.timeText = null;
    this.audioEl = null;
    this.audioCtx = null;
    this.analyser = null;
    this.freqData = null;
    this.ctx = null;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async initAudio(): Promise<void> {
    const audio = document.createElement('audio');
    audio.src = this.audioUrl;
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.loop = false;
    
    this.audioEl = audio;

    // Web Audio API — create once; AudioContext is lazy until play() resumes it
    const audioCtx = new AudioContext();
    this.audioCtx = audioCtx;

    const source = audioCtx.createMediaElementSource(audio);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;             // 128 frequency bins
    analyser.smoothingTimeConstant = 0.82;
    source.connect(analyser);
    analyser.connect(audioCtx.destination);

    this.analyser = analyser;
    this.freqData = new Uint8Array(analyser.frequencyBinCount); // 128 values
  }

  private drawFrame(): void {
    if (!this.ctx || !this.analyser || !this.freqData) return;

    const W = this.ctx.designWidth;
    const H = this.ctx.designHeight;
    const isPaused = this.audioEl?.paused ?? true;

    // Update frequency data
    if (!isPaused) {
      this.analyser.getByteFrequencyData(this.freqData);
    } else {
      // Decay bars smoothly toward zero while paused
      for (let i = 0; i < this.freqData.length; i++) {
        if (this.freqData[i] > 0) this.freqData[i] = Math.max(0, this.freqData[i] - 5);
      }
    }

    // Average level for the pulse ring
    let sum = 0;
    for (let i = 0; i < this.freqData.length; i++) sum += this.freqData[i];
    const avg = sum / (this.freqData.length * 255); // 0..1

    // ── Pulse ring ─────────────────────────────────────────────────────────
    if (this.pulseRing) this.drawRing(this.pulseRing, avg);

    // ── Frequency bars ─────────────────────────────────────────────────────
    if (this.barsGraphics) {
      const g = this.barsGraphics;
      g.clear();

      const numBars = Math.min(N_BARS, this.freqData.length);
      const totalW = W - 240;
      const barW = totalW / numBars - BAR_GAP;
      const baseY = H * 0.75;
      const maxBarH = H * 0.42;

      for (let i = 0; i < numBars; i++) {
        // Mirror left/right around centre for symmetry
        const idx = i < numBars / 2 ? i * 2 : (numBars - 1 - i) * 2;
        const value = (this.freqData[Math.min(idx, this.freqData.length - 1)] ?? 0) / 255;
        const barH = Math.max(3, value * maxBarH);

        // Blue → purple → gold gradient per bar value
        let color: number;
        if (value > 0.72) color = 0xf2c14e;        // gold
        else if (value > 0.45) color = 0x8b5cf6;   // purple
        else if (value > 0.12) color = 0x3b82f6;   // blue
        else color = 0x1e3a5f;                      // dark navy (floor)

        const x = 120 + i * (barW + BAR_GAP);
        // Bar
        g.rect(x, baseY - barH, barW, barH).fill(color);
        // Faint reflection below baseline
        g.rect(x, baseY + 1, barW, barH * 0.28).fill({ color, alpha: 0.18 });
      }
    }

    // ── Time text ──────────────────────────────────────────────────────────
    if (this.timeText && this.audioEl) {
      this.timeText.text = `${formatTime(this.audioEl.currentTime)}  /  ${formatTime(this.audioEl.duration)}`;
    }
  }

  private drawRing(g: Graphics, level: number): void {
    g.clear();
    const baseR = 120;
    const pulse = 1 + level * 0.4; // 1.0 → 1.4× based on audio level

    // Outer glow (faint, larger)
    g.circle(0, 0, (baseR + 20) * pulse).fill({ color: 0x3b82f6, alpha: 0.07 * (1 + level) });
    // Middle ring
    g.circle(0, 0, baseR * pulse).stroke({ color: 0x3b82f6, width: 3, alpha: 0.5 + level * 0.5 });
    // Inner ring (accent)
    g.circle(0, 0, (baseR - 30) * pulse).stroke({ color: 0x8b5cf6, width: 2, alpha: 0.4 + level * 0.5 });
    // Music note dot at centre
    g.circle(0, 0, 12).fill({ color: 0x60a5fa, alpha: 0.8 + level * 0.2 });
  }
}

export function createAudioScene(audioUrl: string, coverUrl?: string, label?: string): AudioScene {
  return new AudioScene(audioUrl, coverUrl, label);
}
