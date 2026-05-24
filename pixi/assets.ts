import { Assets, Texture } from 'pixi.js';

export type TextureMap = Record<string, Texture>;

export async function loadTextures(bundle: Record<string, string>): Promise<TextureMap> {
  const entries = Object.entries(bundle);
  const loaded = await Promise.all(
    entries.map(async ([key, path]) => [key, await Assets.load(path)] as const)
  );
  return Object.fromEntries(loaded);
}
