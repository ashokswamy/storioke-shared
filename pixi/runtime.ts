import type { StageMode } from './scene-types';

export type AssetProfile = StageMode;

let currentStageMode: StageMode = 'renderer';

export function setStageMode(mode: StageMode): void {
  currentStageMode = mode;
}

export function getStageMode(): StageMode {
  if (typeof window !== 'undefined' && (window as any).__STORIOKE_MODE__) {
    return (window as any).__STORIOKE_MODE__ as StageMode;
  }
  return currentStageMode;
}

export function getAssetProfile(): AssetProfile {
  if (typeof window !== 'undefined' && (window as any).__STORIOKE_MODE__) {
    return (window as any).__STORIOKE_MODE__ as AssetProfile;
  }
  return currentStageMode;
}

export interface AssetProfileCache<T> {
  get(): T | undefined;
  set(value: T): T;
}

export function createAssetProfileCache<T>(): AssetProfileCache<T> {
  const map = new Map<AssetProfile, T>();
  return {
    get(): T | undefined {
      return map.get(getAssetProfile());
    },
    set(value: T): T {
      map.set(getAssetProfile(), value);
      return value;
    }
  };
}
