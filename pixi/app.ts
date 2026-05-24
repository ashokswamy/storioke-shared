import { Application } from 'pixi.js';
import type { StageMode } from './scene-types';

export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;

export const PREVIEW_WIDTH = 640;
export const PREVIEW_HEIGHT = 360;

export function getStageSize(mode: StageMode): { width: number; height: number } {
  if (mode === 'renderer' || mode === 'ax') {
    return { width: DESIGN_WIDTH, height: DESIGN_HEIGHT };
  }
  return { width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT };
}

export async function createPixiApp(
  host: HTMLElement,
  mode: StageMode
): Promise<{ app: Application; width: number; height: number }> {
  const app = new Application();
  const { width, height } = getStageSize(mode);

  await app.init({
    width,
    height,
    background: '#0f1318',
    antialias: true,
    autoDensity: true,
    resolution: Math.max(1, window.devicePixelRatio || 1)
  });

  host.appendChild(app.canvas);
  return { app, width, height };
}
