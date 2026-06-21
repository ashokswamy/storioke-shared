# storioke-renderer

This repository contains the shared frontend rendering logic and assets across the Storioke ecosystem (**storioke-teller**, **storioke-ax**, and **storioke-scene-builder**).

## Directory Structure

- `/pixi/` - Core PIXI.js application setups, scene managers, camera controls, and resize utilities.
- `/scenes/` - Base interfaces and registries for the dynamic scene plugin system. (Note: Custom scene implementations live in the respective application/server repos).
- `/types/` - Shared TypeScript definitions for teller, story collections, icons, etc.
- `/audio/` - Shared audio handling utilities.

## Usage

This repository is integrated as a Git Submodule under `src/lib/storioke-renderer` in the main applications.

Instead of using symlinks, the applications are configured with path aliases in their `svelte.config.js` or `vite.config.ts`, mapping `@storioke-renderer` to the submodule directory. This allows for clean, native imports such as:

```typescript
import { SceneManager } from '@storioke-renderer/pixi/scene-manager';
```
