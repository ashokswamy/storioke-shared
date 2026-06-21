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
    // 1. Try standard dynamic import first
    const module = await import(/* @vite-ignore */ url);
    
    if (module && typeof module.createScene === 'function') {
      registerScene(sceneId, module.createScene);
      return;
    }
    throw new Error("Module does not export a 'createScene' function");
  } catch (err) {
    console.warn(`[SceneRegistry] Standard import failed for ${url}, trying Blob fallback...`, err);
    
    try {
      // 2. Fallback: Fetch the script and load it as a Blob URL
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch script: ${response.statusText}`);
      const scriptText = await response.text();
      
      const blob = new Blob([scriptText], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      
      const module = await import(/* @vite-ignore */ blobUrl);
      URL.revokeObjectURL(blobUrl); // Clean up
      
      if (module && typeof module.createScene === 'function') {
        registerScene(sceneId, module.createScene);
        return;
      }
      throw new Error("Blob module does not export a 'createScene' function");
    } catch (fallbackErr) {
      console.error(`[SceneRegistry] Failed to load dynamic plugin from ${url} (both standard and Blob methods):`, fallbackErr);
      throw fallbackErr;
    }
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



