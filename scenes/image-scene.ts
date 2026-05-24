import { Container, Graphics, Sprite, Assets, Texture } from 'pixi.js';
import gsap from 'gsap';
import type { IScene, SceneContext } from '$lib/pixi/scene-types';
import { getContainScale } from '$lib/pixi/resize';

/**
 * ImageScene — renders a single image as a full-bleed PixiJS sprite.
 *
 * Idle/paused: image is shown statically, letterboxed to the canvas.
 * Play: a GSAP Ken Burns zoom animates (scale 1.0 → 1.06) over durationSec,
 *       then holds at the end.
 */
export class ImageScene implements IScene {
  private readonly imageUrl: string;
  private readonly durationSec: number;

  private ctx: SceneContext | null = null;
  private sceneRoot: Container | null = null;
  private imageContainer: Container | null = null;
  private sprite: Sprite | null = null;
  private timeline: gsap.core.Timeline | null = null;
  private zoomState = { scale: 1.0, alpha: 1.0 };

  constructor(imageUrl: string, durationSec = 30) {
    this.imageUrl = imageUrl;
    this.durationSec = durationSec;
  }

  async mount(ctx: SceneContext): Promise<void> {
    this.ctx = ctx;

    const root = new Container();
    this.sceneRoot = root;
    ctx.root.addChild(root);

    // Dark fallback background
    const bg = new Graphics()
      .rect(0, 0, ctx.designWidth, ctx.designHeight)
      .fill(0x0d1117);
    root.addChild(bg);

    // Image layer
    const imageContainer = new Container();
    this.imageContainer = imageContainer;
    root.addChild(imageContainer);

    if (this.imageUrl) {
      try {
        const texture: Texture = await Assets.load(this.imageUrl);
        const sprite = new Sprite(texture);
        this.sprite = sprite;

        // Cover-fit: scale to fill the design canvas
        this.fitSpriteToDesign(sprite, ctx.designWidth, ctx.designHeight);
        imageContainer.addChild(sprite);
      } catch {
        // Failed to load image — fallback remains (dark bg)
        this.addFallbackGradient(imageContainer, ctx.designWidth, ctx.designHeight);
      }
    } else {
      this.addFallbackGradient(imageContainer, ctx.designWidth, ctx.designHeight);
    }

    this.buildTimeline();
    this.resize(ctx.app.renderer.width, ctx.app.renderer.height);
    this.pause();
    this.seek(0);
  }

  play(): void {
    this.timeline?.play();
  }

  pause(): void {
    this.timeline?.pause();
  }

  seek(t: number): void {
    if (!this.timeline) return;
    this.timeline.pause();
    this.timeline.progress(Math.min(1, Math.max(0, t)));
  }

  getProgress(): number {
    return this.timeline?.progress() ?? 0;
  }

  resize(width: number, height: number): void {
    if (!this.sceneRoot || !this.ctx) return;
    const fit = getContainScale(this.ctx.designWidth, this.ctx.designHeight, width, height);
    this.sceneRoot.scale.set(fit.scale);
    this.sceneRoot.position.set(fit.offsetX, fit.offsetY);
  }

  destroy(): void {
    this.timeline?.kill();
    this.timeline = null;
    this.sceneRoot?.destroy({ children: true });
    this.sceneRoot = null;
    this.imageContainer = null;
    this.sprite = null;
    this.ctx = null;
    this.zoomState = { scale: 1.0, alpha: 1.0 };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private fitSpriteToDesign(sprite: Sprite, designW: number, designH: number): void {
    const texW = sprite.texture.width;
    const texH = sprite.texture.height;

    // Cover scale — fill the entire design canvas
    const scale = Math.max(designW / texW, designH / texH);
    sprite.scale.set(scale);

    // Centre the (potentially oversized) sprite
    sprite.anchor.set(0.5);
    sprite.position.set(designW / 2, designH / 2);
  }

  private addFallbackGradient(container: Container, W: number, H: number): void {
    // Subtle two-tone gradient fallback using layered Graphics
    const g = new Graphics();
    g.rect(0, 0, W, H).fill({ color: 0x141b25 });
    g.rect(0, H * 0.6, W, H * 0.4).fill({ color: 0x0a1018, alpha: 0.6 });
    container.addChild(g);
  }

  private buildTimeline(): void {
    if (!this.imageContainer) return;

    const container = this.imageContainer;
    this.zoomState = { scale: 1.0, alpha: 1.0 };
    container.scale.set(1.0);

    const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });

    tl
      // Ken Burns: slow zoom in over the full durationSec
      .to(
        this.zoomState,
        {
          scale: 1.06,
          duration: this.durationSec,
          ease: 'power1.inOut',
          onUpdate: () => {
            container.scale.set(this.zoomState.scale);
            // Keep centred during zoom
            if (this.ctx) {
              const offset = ((this.zoomState.scale - 1) / 2) * this.ctx.designWidth;
              container.pivot.set(offset * 0.5, 0);
            }
          }
        },
        0
      );

    this.timeline = tl;
  }
}

export function createImageScene(imageUrl: string, durationSec?: number): ImageScene {
  return new ImageScene(imageUrl, durationSec);
}
