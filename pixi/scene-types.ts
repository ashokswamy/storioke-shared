import type { Application, Container } from 'pixi.js';

export type StageMode = 'preview' | 'preview-hd' | 'renderer';

export interface SceneContext {
  app: Application;
  root: Container;
  mode: StageMode;
  designWidth: number;
  designHeight: number;
  resourceBaseUrl: string;
}

export interface SceneDesignSize {
  width: number;
  height: number;
}

export interface SceneSfxControl {
  id: string;
  label: string;
}

export interface IScene {
  mount(ctx: SceneContext): Promise<void> | void;
  play(): void;
  pause(): void;
  seek(t: number): void;
  getProgress(): number;
  getSfxControls?(): SceneSfxControl[];
  triggerSfx?(id: string): void;
  playSpatialSfx?(): void;
  playShortSfx?(): void;
  stopSfx?(): void;
  resize(w: number, h: number): void;
  destroy(): void;
  getDesignSize?(): SceneDesignSize;
}
