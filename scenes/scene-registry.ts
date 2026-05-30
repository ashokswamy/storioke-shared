import type { CanvasSceneAsset } from '$lib/types/teller';
import type { IScene } from '$lib/pixi/scene-types';
import { createReasonScene } from './reason';
import { createThreeScene } from './three-scene';
import { createVideoScene } from './video-scene';
import { createAudioScene } from './audio-scene';
import { createImageScene } from './image-scene';

/**
 * Scene Registry — maps CanvasSceneAsset.sceneId → IScene factory.
 *
 * Generic scene IDs (resolved from story.defaults.*SceneId):
 *   pixi-image-card  — renders asset.imageUrl with Ken-Burns effect
 *   pixi-audio       — renders asset.audioUrl with optional cover art (asset.imageUrl)
 *   pixi-video       — renders asset.videoUrl as a full-bleed video
 *   pixi-overlay     — overlay compositor (falls back to ReasonScene)
 *   pixi-reason      — animated PixiJS primitives scene (no asset URL needed)
 *
 * These are synthesized on-the-fly by StoryMediaViewer from prefetch.images /
 * prefetch.audio / prefetch.video + story.defaults.*SceneId — no
 * assetsIndex.canvasScenes entry is required.
 */
const REGISTRY: Record<string, (asset: CanvasSceneAsset) => IScene> = {
  // ── Generic pixi scenes (used via story.defaults.*SceneId) ─────────────────
  'pixi-image-card':     (asset) => createImageScene(asset.imageUrl ?? '', asset.durationSec),
  'pixi-image-sequence': (asset) => createImageScene(asset.imageUrl ?? '', asset.durationSec),
  'pixi-audio':          (asset) => createAudioScene(asset.audioUrl ?? '', asset.imageUrl, asset.label),
  'pixi-video':          (asset) => createVideoScene(asset.videoUrl ?? ''),
  'pixi-overlay':        (_asset) => createReasonScene(),   // placeholder
  'pixi-reason':         (_asset) => createReasonScene(),
  'pixi-cinematic':      (_asset) => createReasonScene(),   // placeholder — swap for CinematicScene
  'pixi-minimal':        (_asset) => createReasonScene(),   // placeholder — swap for MinimalScene

  // ── Three.js scenes ────────────────────────────────────────────────────────
  'three-cube':    (asset) => createThreeScene(asset.label, asset.durationSec),

  // ── Legacy cs- prefixed aliases (backwards compat) ─────────────────────────
  'cs-pixi-reason':     (_asset) => createReasonScene(),
  'cs-pixi-image-card': (asset) => createImageScene(asset.imageUrl ?? '', asset.durationSec),
  'cs-pixi-video':      (asset) => createVideoScene(asset.videoUrl ?? ''),
  'cs-pixi-audio':      (asset) => createAudioScene(asset.audioUrl ?? '', asset.imageUrl, asset.label),
  'cs-three-cube':      (asset) => createThreeScene(asset.label, asset.durationSec),
};

/**
 * Resolve a CanvasSceneAsset to a live IScene instance.
 * Falls back to ReasonScene if the sceneId is not registered.
 */
export function createSceneFromAsset(asset: CanvasSceneAsset): IScene {
  const factory = REGISTRY[asset.sceneId];
  if (!factory) {
    console.warn(`[SceneRegistry] Unknown sceneId: "${asset.sceneId}" — falling back to ReasonScene`);
    return createReasonScene();
  }
  return factory(asset);
}

/** Tracks plugin URLs that have already been loaded to avoid duplicate imports. */
const _loadedPlugins = new Set<string>();

/**
 * Dynamically load a remote scene plugin by URL (once per sceneId).
 *
 * The plugin module may export a `scenes` record of factory functions that
 * will be merged into the in-memory REGISTRY, making them available to
 * `createSceneFromAsset` for the lifetime of this page.
 *
 * If the sceneId is already registered (built-in or previously loaded),
 * or the URL has already been fetched, this is a fast no-op.
 *
 * @param sceneId  - Registry key (used as dedup key alongside URL)
 * @param pluginUrl - Absolute URL of the JS plugin module to import()
 */
export async function ensurePluginLoaded(sceneId: string, pluginUrl: string): Promise<void> {
  // Fast path: already in registry or URL already loaded
  if (REGISTRY[sceneId] || _loadedPlugins.has(pluginUrl)) return;

  try {
    _loadedPlugins.add(pluginUrl);
    const mod = await import(/* @vite-ignore */ pluginUrl);
    // Plugin may export a `scenes` map of { [sceneId]: factory }
    if (mod?.scenes && typeof mod.scenes === 'object') {
      for (const [id, factory] of Object.entries(mod.scenes)) {
        if (typeof factory === 'function' && !REGISTRY[id]) {
          REGISTRY[id] = factory as (asset: CanvasSceneAsset) => IScene;
        }
      }
    }
    console.log(`[SceneRegistry] Plugin loaded: "${sceneId}" from ${pluginUrl}`);
  } catch (err) {
    _loadedPlugins.delete(pluginUrl); // allow retry on next call
    console.warn(`[SceneRegistry] Failed to load plugin "${sceneId}" from ${pluginUrl}:`, err);
    // Non-fatal — createSceneFromAsset will fall back to ReasonScene
  }
}
