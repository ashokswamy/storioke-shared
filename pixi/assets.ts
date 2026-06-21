import { Assets, Rectangle, Texture } from 'pixi.js';
import { getAssetProfile } from './runtime';

export type TextureMap = Record<string, Texture>;

interface AssetMetadata {
  width: number;
  height: number;
}

type AssetManifest = Record<string, AssetMetadata>;

const manifestPromises = new Map<string, Promise<AssetManifest>>();

function getProfilePath(path: string): { isProfiled: boolean; path: string; assetPath?: string; manifestPath?: string } {
  const marker = '/media/';
  const markerIndex = path.indexOf(marker);
  if (markerIndex < 0) return { isProfiled: false, path };

  const prefix = path.slice(0, markerIndex);
  const assetPath = path.slice(markerIndex + marker.length);
  return {
    isProfiled: true,
    path: `${prefix}/media/profiles/${getAssetProfile()}/${assetPath}`,
    assetPath,
    manifestPath: `${prefix}/media/profiles/manifest.json`
  };
}

function loadManifest(path: string): Promise<AssetManifest> {
  let promise = manifestPromises.get(path);
  if (!promise) {
    promise = fetch(path).then(async (response) => {
      if (!response.ok)
        throw new Error(`Failed to load asset profile manifest from ${path}: ${response.status} ${response.statusText}`);
      return (await response.json()) as AssetManifest;
    });
    manifestPromises.set(path, promise);
  }
  return promise;
}

async function loadProfiledTexture(path: string): Promise<Texture> {
  // In the Scene Builder dev environment, we load the raw asset directly from the local static folder
  // and bypass the profiled asset resolution.
  if (typeof window !== 'undefined' && (window as any).__STORIOKE_BUILDER__) {
    const devPath = path.replace('/media/', '/media/raw/');
    return Assets.load<Texture>(devPath);
  }

  const resolved = getProfilePath(path);
  if (!resolved.isProfiled) {
    return Assets.load<Texture>(path);
  }

  const [texture, manifest] = await Promise.all([
    Assets.load<Texture>(resolved.path),
    loadManifest(resolved.manifestPath!)
  ]);
  const metadata = manifest[resolved.assetPath!];
  if (!metadata) throw new Error(`Missing asset profile metadata for ${resolved.assetPath}`);

  // Set the source resolution so that Pixi treats the downscaled image
  // as if it has the logical dimensions of the original high-res image.
  texture.source.resolution = texture.source.pixelWidth / metadata.width;
  texture.source.update();

  return new Texture({
    source: texture.source,
    label: `${getAssetProfile()}:${resolved.assetPath}`
  });
}

export async function loadTextures(bundle: Record<string, string>): Promise<TextureMap> {
  const entries = Object.entries(bundle);
  const loaded = await Promise.all(
    entries.map(async ([key, path]) => [key, await loadProfiledTexture(path)] as const)
  );
  return Object.fromEntries(loaded);
}
