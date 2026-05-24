import { Container } from 'pixi.js';
import type { Application } from 'pixi.js';
import type { IScene, SceneContext, SceneSfxControl, StageMode } from './scene-types';
import { DESIGN_HEIGHT, DESIGN_WIDTH } from './app';

export class SceneManager {
  private readonly app: Application;
  private readonly mode: StageMode;
  private readonly root: Container;
  private activeScene: IScene | null = null;

  constructor(app: Application, mode: StageMode) {
    this.app = app;
    this.mode = mode;
    this.root = new Container();
    this.app.stage.addChild(this.root);
  }

  async mount(scene: IScene): Promise<void> {
    if (this.activeScene) {
      this.activeScene.destroy();
      this.root.removeChildren();
    }

    const ctx: SceneContext = {
      app: this.app,
      root: this.root,
      mode: this.mode,
      designWidth: DESIGN_WIDTH,
      designHeight: DESIGN_HEIGHT
    };

    this.activeScene = scene;
    await scene.mount(ctx);
  }

  play(): void {
    this.activeScene?.play();
  }

  pause(): void {
    this.activeScene?.pause();
  }

  seek(progress: number): void {
    this.activeScene?.seek(progress);
  }

  getProgress(): number {
    if (!this.activeScene) return 0;
    return this.activeScene.getProgress();
  }

  getSfxControls(): SceneSfxControl[] {
    if (!this.activeScene?.getSfxControls) return [];
    return this.activeScene.getSfxControls();
  }

  triggerSfx(id: string): void {
    this.activeScene?.triggerSfx?.(id);
  }

  playSpatialSfx(): void {
    if (this.activeScene?.triggerSfx) {
      this.activeScene.triggerSfx('spatial');
      return;
    }
    this.activeScene?.playSpatialSfx?.();
  }

  playShortSfx(): void {
    if (this.activeScene?.triggerSfx) {
      this.activeScene.triggerSfx('short');
      return;
    }
    this.activeScene?.playShortSfx?.();
  }

  stopSfx(): void {
    this.activeScene?.stopSfx?.();
  }

  resize(width: number, height: number): void {
    this.app.renderer.resize(width, height);
    this.activeScene?.resize(width, height);
  }

  destroy(): void {
    this.activeScene?.destroy();
    this.activeScene = null;
    this.root.destroy({ children: true });
  }
}
