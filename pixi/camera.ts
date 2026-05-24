import { Container } from 'pixi.js';

export interface CameraRig {
  camera: Container;
  bg: Container;
  mid: Container;
  fg: Container;
  setX: (x: number) => void;
}

export function createParallaxCamera(): CameraRig {
  const camera = new Container();
  const bg = new Container();
  const mid = new Container();
  const fg = new Container();

  camera.addChild(bg, mid, fg);

  return {
    camera,
    bg,
    mid,
    fg,
    setX(x: number) {
      bg.x = x * 0.3;
      mid.x = x * 0.6;
      fg.x = x;
    }
  };
}
