import { Container, Graphics, Text } from 'pixi.js';
import gsap from 'gsap';
import type { IScene, SceneContext } from '$lib/pixi/scene-types';
import { createParallaxCamera } from '$lib/pixi/camera';
import { getContainScale } from '$lib/pixi/resize';

/**
 * A self-contained built-in scene that animates a card + title with a
 * parallax camera pan. Requires no external asset URLs — uses PixiJS
 * primitives only. This is the default scene used in StagePreview.
 */
export class ReasonScene implements IScene {
  private ctx: SceneContext | null = null;
  private timeline: gsap.core.Timeline | null = null;
  private sceneRoot: Container | null = null;

  private readonly layers = {
    background: new Container(),
    mid: new Container(),
    foreground: new Container(),
    text: new Container(),
    fx: new Container()
  };

  private readonly camera = createParallaxCamera();
  private cameraState = { x: 0 };

  async mount(ctx: SceneContext): Promise<void> {
    this.ctx = ctx;

    const root = new Container();
    this.sceneRoot = root;
    ctx.root.addChild(root);

    root.addChild(
      this.layers.background,
      this.layers.mid,
      this.layers.foreground,
      this.layers.text,
      this.layers.fx
    );

    this.layers.mid.addChild(this.camera.camera);
    this.buildSceneGraph(ctx.designWidth, ctx.designHeight);
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
    const clamped = Math.min(1, Math.max(0, t));
    this.timeline.pause();
    this.timeline.progress(clamped);
  }

  getProgress(): number {
    if (!this.timeline) return 0;
    return this.timeline.progress();
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
    if (this.sceneRoot) {
      this.sceneRoot.destroy({ children: true });
    }
    this.sceneRoot = null;
    this.ctx = null;
    this.cameraState = { x: 0 };
  }

  private buildSceneGraph(W: number, H: number): void {
    const { background, foreground, text } = this.layers;

    // Dark background fill
    const bg = new Graphics().rect(0, 0, W, H).fill(0x0d1117);
    background.addChild(bg);

    // Subtle grid overlay on background
    const grid = new Graphics();
    for (let x = 0; x < W; x += 80) {
      grid.moveTo(x, 0).lineTo(x, H);
    }
    for (let y = 0; y < H; y += 80) {
      grid.moveTo(0, y).lineTo(W, y);
    }
    grid.stroke({ color: 0x1e293b, width: 1 });
    background.addChild(grid);

    // Card on mid (camera) layer
    const cardW = 820;
    const cardH = 480;
    const cardX = (W - cardW) / 2;
    const cardY = (H - cardH) / 2;
    const card = new Graphics()
      .roundRect(cardX, cardY, cardW, cardH, 28)
      .fill({ color: 0x1a2332, alpha: 0.95 });
    // Card border
    card.roundRect(cardX, cardY, cardW, cardH, 28).stroke({ color: 0x334155, width: 2 });
    this.camera.mid.addChild(card);

    // Accent bar on fg (moves faster)
    const accent = new Graphics()
      .rect(cardX, cardY + cardH - 8, cardW, 8)
      .fill(0xf2c14e);
    this.camera.fg.addChild(accent);

    // Glowing dot cluster (decorative fx layer)
    const fx = new Graphics();
    const dots = [
      { x: 180, y: 160, r: 60, c: 0x3b82f6 },
      { x: W - 200, y: H - 180, r: 80, c: 0x8b5cf6 },
      { x: W / 2, y: 80, r: 40, c: 0xf2c14e }
    ];
    for (const d of dots) {
      fx.circle(d.x, d.y, d.r).fill({ color: d.c, alpha: 0.12 });
    }
    this.layers.fx.addChild(fx);
    this.layers.fx.alpha = 0;

    // Title text
    const title = new Text({
      text: 'Storioke',
      style: {
        fill: 0xf1f5f9,
        fontSize: 92,
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontWeight: '700',
        letterSpacing: 2
      }
    });
    title.position.set(cardX + 60, cardY + 80);
    title.alpha = 0;

    // Subtitle
    const subtitle = new Text({
      text: 'Scene Preview',
      style: {
        fill: 0x94a3b8,
        fontSize: 44,
        fontFamily: '"Helvetica Neue", Arial, sans-serif',
        fontWeight: '300',
        letterSpacing: 4
      }
    });
    subtitle.position.set(cardX + 62, cardY + 210);
    subtitle.alpha = 0;

    // Tag
    const tag = new Text({
      text: 'PIXI · GSAP · PARALLAX',
      style: {
        fill: 0xf2c14e,
        fontSize: 22,
        fontFamily: '"Helvetica Neue", Arial, sans-serif',
        fontWeight: '600',
        letterSpacing: 6
      }
    });
    tag.position.set(cardX + 62, cardY + 340);
    tag.alpha = 0;

    text.addChild(title, subtitle, tag);

    foreground.alpha = 0.9;
  }

  private buildTimeline(): void {
    const [title, subtitle, tag] = this.layers.text.children;
    const timeline = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });

    timeline
      // Fade in mid (card) layer
      .fromTo(this.layers.mid, { alpha: 0 }, { alpha: 1, duration: 0.8 }, 0)
      // Title slides up and fades in
      .fromTo(title, { alpha: 0, y: '+=40' }, { alpha: 1, y: '-=40', duration: 0.7 }, 0.3)
      // Subtitle follows
      .fromTo(subtitle, { alpha: 0, y: '+=28' }, { alpha: 1, y: '-=28', duration: 0.7 }, 0.55)
      // Tag line
      .fromTo(tag, { alpha: 0, y: '+=20' }, { alpha: 1, y: '-=20', duration: 0.6 }, 0.8)
      // Parallax camera pan
      .to(
        this.cameraState,
        {
          x: -200,
          duration: 2.8,
          ease: 'sine.inOut',
          onUpdate: () => this.camera.setX(this.cameraState.x)
        },
        0.2
      )
      // Glow dots fade in
      .to(this.layers.fx, { alpha: 0.7, duration: 0.8 }, 2.0);

    this.timeline = timeline;
  }
}

export function createReasonScene(): ReasonScene {
  return new ReasonScene();
}
