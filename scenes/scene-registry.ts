import type { CanvasSceneAsset } from '../types/teller';
import type { IScene } from '../pixi/scene-types';

const REGISTRY: Record<string, (asset: CanvasSceneAsset) => IScene> = {};

/**
 * Register a scene factory dynamically.
 */
export function registerScene(sceneId: string, factory: (asset: CanvasSceneAsset) => IScene): void {
  REGISTRY[sceneId] = factory;
  console.log(`[SceneRegistry] Dynamically registered scene factory for: "${sceneId}"`);
}

/**
 * Check if a scene factory is already registered.
 */
export function hasScene(sceneId: string): boolean {
  return !!REGISTRY[sceneId];
}

/**
 * Dynamically fetches and imports an ES module from a URL, then registers its factory.
 */
export async function ensurePluginLoaded(sceneId: string, url: string): Promise<void> {
  if (hasScene(sceneId)) return;

  try {
    // Import the ES module from the remote URL dynamically
    const module = await import(/* @vite-ignore */ url);
    
    if (module && typeof module.createScene === 'function') {
      registerScene(sceneId, module.createScene);
    } else {
      throw new Error("Module does not export a 'createScene' function");
    }
  } catch (err) {
    console.error(`[SceneRegistry] Failed to load dynamic plugin from ${url}:`, err);
    throw err;
  }
}

/**
 * Resolve a CanvasSceneAsset to a live IScene instance.
 * Throws an error if the sceneId plugin has not been loaded.
 */
export function createSceneFromAsset(asset: CanvasSceneAsset): IScene {
  const factory = REGISTRY[asset.sceneId];
  if (!factory) {
    throw new Error(`[SceneRegistry] Unknown sceneId: "${asset.sceneId}" — has the plugin been loaded?`);
  }
  return factory(asset);
}
