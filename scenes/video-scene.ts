import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { IScene, SceneContext } from '$lib/pixi/scene-types';
import { getContainScale } from '$lib/pixi/resize';

/**
 * VideoScene — renders a video URL as a full-bleed PixiJS Sprite.
 *
 * The native HTMLVideoElement owns playback; PixiJS re-uploads the video frame
 * to the GPU via its ticker every frame while playing — no separate RAF needed.
 *
 * Idle: paused at frame 0 (poster frame).
 * Play: video.play() — frame updates are driven by the Pixi ticker.
 * Pause: video.pause().
 * Seek: sets video.currentTime and force-refreshes the texture.
 */
export class VideoScene implements IScene {
  private readonly videoUrl: string;

  private ctx: SceneContext | null = null;
  private sceneRoot: Container | null = null;
  private sprite: Sprite | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private texture: Texture | null = null;

  constructor(videoUrl: string) {
    this.videoUrl = videoUrl;
  }

  // ── IScene lifecycle ──────────────────────────────────────────────────────

  async mount(ctx: SceneContext): Promise<void> {
    this.ctx = ctx;

    const root = new Container();
    this.sceneRoot = root;
    ctx.root.addChild(root);

    // Dark background shown while video loads / if load fails
    const bg = new Graphics()
      .rect(0, 0, ctx.designWidth, ctx.designHeight)
      .fill(0x0d1117);
    root.addChild(bg);

    if (this.videoUrl) {
      try {
        await this.initVideo(root, ctx.designWidth, ctx.designHeight);
      } catch (err) {
        console.warn('[VideoScene] Failed to load video:', this.videoUrl, err);
        this.addFallback(root, ctx.designWidth, ctx.designHeight);
      }
    } else {
      this.addFallback(root, ctx.designWidth, ctx.designHeight);
    }

    this.resize(ctx.app.renderer.width, ctx.app.renderer.height);
  }

  play(): void {
    this.videoEl?.play().catch(() => {/* autoplay policy — safe to swallow */});
  }

  pause(): void {
    this.videoEl?.pause();
  }

  seek(t: number): void {
    if (!this.videoEl) return;
    const clamped = Math.min(1, Math.max(0, t));
    const dur = this.videoEl.duration;
    if (Number.isFinite(dur) && dur > 0) {
      this.videoEl.currentTime = clamped * dur;
      // Force Pixi to re-upload the decoded frame on the next render tick
      if (this.texture?.source) {
        (this.texture.source as { needsUpdate?: boolean }).needsUpdate = true;
      }
    }
  }

  getProgress(): number {
    if (!this.videoEl) return 0;
    const dur = this.videoEl.duration;
    if (!Number.isFinite(dur) || dur <= 0) return 0;
    return Math.min(1, this.videoEl.currentTime / dur);
  }

  resize(width: number, height: number): void {
    if (!this.sceneRoot || !this.ctx) return;
    const fit = getContainScale(this.ctx.designWidth, this.ctx.designHeight, width, height);
    this.sceneRoot.scale.set(fit.scale);
    this.sceneRoot.position.set(fit.offsetX, fit.offsetY);
  }

  destroy(): void {
    if (this.videoEl) {
      this.videoEl.pause();
      this.videoEl.src = '';
      this.videoEl.load(); // triggers browser GC of video buffer
    }
    // Destroy texture WITHOUT destroying the source if it was created externally;
    // but since we own the videoEl, destroy both.
    this.texture?.destroy(true);
    this.sceneRoot?.destroy({ children: true });

    this.sceneRoot = null;
    this.sprite = null;
    this.videoEl = null;
    this.texture = null;
    this.ctx = null;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async initVideo(root: Container, designW: number, designH: number): Promise<void> {
    const video = document.createElement('video');
    video.src = this.videoUrl;
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    video.muted = false;
    video.autoplay = false;
    video.preload = 'auto';
    
    this.videoEl = video;

    // Wait until we have at least the first frame and metadata
    await new Promise<void>((resolve, reject) => {
      video.addEventListener('loadeddata', () => resolve(), { once: true });
      video.addEventListener('error', () =>
        reject(new Error(`HTMLVideoElement error for: ${this.videoUrl}`)), { once: true });
      video.load();
    });

    // Create a Pixi texture backed by the video element.
    // Texture.from(HTMLVideoElement) is supported in Pixi v8;
    // Pixi's ticker re-uploads each video frame automatically while playing.
    const texture = Texture.from(video);
    this.texture = texture;

    const sprite = new Sprite(texture);
    this.sprite = sprite;
    this.coverFit(sprite, designW, designH);
    root.addChild(sprite);

    // Start paused at frame 0
    video.pause();
    video.currentTime = 0;
  }

  private coverFit(sprite: Sprite, W: number, H: number): void {
    const texW = sprite.texture.width || W;
    const texH = sprite.texture.height || H;
    const scale = Math.max(W / texW, H / texH);
    sprite.scale.set(scale);
    sprite.anchor.set(0.5);
    sprite.position.set(W / 2, H / 2);
  }

  private addFallback(container: Container, W: number, H: number): void {
    container.addChild(new Graphics().rect(0, 0, W, H).fill({ color: 0x141b25 }));
  }
}

export function createVideoScene(videoUrl: string): VideoScene {
  return new VideoScene(videoUrl);
}
