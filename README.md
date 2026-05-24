# storioke-shared

This repository contains the shared frontend logic and assets between **storioke-teller** and **storioke-ax**.

## Directory Structure

- `/pixi/` - Core PIXI.js application setups, scene managers, camera controls, and resize utilities.
- `/scenes/` - Implementations of different scene types (audio, image, video, three.js, and scene-registry).
- `/types/` - Shared TypeScript definitions for teller, story collections, icons, etc.

## Usage

This repository is integrated as a Git Submodule under `src/lib/storioke-shared` in both main repositories. Internal symbolic links are used within the `src/lib/` directory of those projects to route imports transparently.
