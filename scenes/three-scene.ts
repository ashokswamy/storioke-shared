import * as THREE from 'three';
import type { IScene, SceneContext } from '$lib/pixi/scene-types';
import { PREVIEW_WIDTH, PREVIEW_HEIGHT } from '$lib/pixi/app';

/**
 * ThreeScene — a Three.js rotating cube rendered onto a standalone <canvas>
 * element that is appended alongside the PixiJS canvas in the host div.
 * Implements IScene so it integrates with SceneManager play/pause/seek controls.
 */
export class ThreeScene implements IScene {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene3: THREE.Scene | null = null;
  private camera3: THREE.PerspectiveCamera | null = null;
  private cube: THREE.Mesh | null = null;
  private pointLight: THREE.PointLight | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private hostParent: HTMLElement | null = null;
  private rafId = 0;

  // Playback state
  private elapsed = 0;
  private lastTimestamp = 0;
  private isPlaying = false;
  private readonly durationSec: number;
  private readonly label: string;

  constructor(label = 'Three.js Scene', durationSec = 10) {
    this.label = label;
    this.durationSec = durationSec;
  }

  async mount(ctx: SceneContext): Promise<void> {
    // Derive the host element from ctx.root's parent (the canvasHost div)
    const pixiCanvas = ctx.app.canvas as HTMLCanvasElement;
    const host = pixiCanvas.parentElement;
    if (!host) throw new Error('ThreeScene: cannot find host element');
    this.hostParent = host;

    const W = PREVIEW_WIDTH;   // always use logical CSS pixels
    const H = PREVIEW_HEIGHT;

    // Create a Three.js canvas overlaid on top of the PixiJS canvas.
    // z-index: 10 ensures it sits above the Pixi canvas in the stacking context.
    const canvas = document.createElement('canvas');
    canvas.style.cssText = [
      'position: absolute',
      'top: 0',
      'left: 0',
      'width: 100%',
      'height: 100%',
      'z-index: 10',
      'pointer-events: none',
    ].join(';');
    host.style.position = 'relative';
    host.appendChild(canvas);
    this.canvas = canvas;

    // Three.js setup: setSize(logical) + setPixelRatio → Three.js handles the
    // physical buffer scaling internally (640×360 CSS → 1280×720 px on 2× display).
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.max(1, window.devicePixelRatio || 1));
    renderer.setSize(W, H);
    renderer.setClearColor(0x0d1117, 1);
    this.renderer = renderer;

    const scene3 = new THREE.Scene();
    this.scene3 = scene3;

    const camera3 = new THREE.PerspectiveCamera(55, W / H, 0.1, 100);
    camera3.position.set(0, 0, 5);
    this.camera3 = camera3;

    // Ambient + point light
    scene3.add(new THREE.AmbientLight(0x334155, 1.0));
    const pointLight = new THREE.PointLight(0x60a5fa, 120, 20);
    pointLight.position.set(4, 6, 5);
    scene3.add(pointLight);
    this.pointLight = pointLight;

    // Accent light
    const accentLight = new THREE.PointLight(0xf2c14e, 60, 20);
    accentLight.position.set(-4, -3, 3);
    scene3.add(accentLight);

    // Cube
    const geo = new THREE.BoxGeometry(2, 2, 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1e3a5f,
      metalness: 0.4,
      roughness: 0.4,
    });
    const cube = new THREE.Mesh(geo, mat);
    scene3.add(cube);
    this.cube = cube;

    // Wireframe overlay
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, wireframe: true, transparent: true, opacity: 0.25 });
    scene3.add(new THREE.Mesh(geo, wireMat));

    // Background grid plane
    const gridHelper = new THREE.GridHelper(14, 14, 0x1e293b, 0x1e293b);
    gridHelper.position.y = -2.5;
    scene3.add(gridHelper);

    // Label sprite overlay on the PixiJS canvas (not three) — just render first frame
    this.seek(0);
  }

  play(): void {
    // If already at the end, restart from the beginning
    if (this.elapsed >= this.durationSec) {
      this.elapsed = 0;
    }
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastTimestamp = performance.now();
    this.tick();
  }

  pause(): void {
    this.isPlaying = false;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    // Render one still frame at current position
    this.renderFrame();
  }

  seek(t: number): void {
    const clamped = Math.min(1, Math.max(0, t));
    this.elapsed = clamped * this.durationSec;
    this.renderFrame();
  }

  getProgress(): number {
    return this.durationSec > 0 ? Math.min(1, this.elapsed / this.durationSec) : 0;
  }

  resize(w: number, h: number): void {
    if (!this.renderer || !this.canvas || !this.camera3) return;
    // Keep the Three.js renderer in sync with the logical preview size
    const lw = Math.min(w, PREVIEW_WIDTH);
    const lh = Math.min(h, PREVIEW_HEIGHT);
    this.renderer.setSize(lw, lh);
    this.camera3.aspect = lw / lh;
    this.camera3.updateProjectionMatrix();
    this.renderFrame();
  }

  destroy(): void {
    this.isPlaying = false;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.canvas?.remove();
    this.renderer?.dispose();
    this.renderer = null;
    this.scene3 = null;
    this.camera3 = null;
    this.cube = null;
    this.canvas = null;
    this.hostParent = null;
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private tick(): void {
    if (!this.isPlaying) return;
    const now = performance.now();
    const delta = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;
    this.elapsed = Math.min(this.elapsed + delta, this.durationSec);

    this.renderFrame();

    if (this.elapsed < this.durationSec) {
      this.rafId = requestAnimationFrame(() => this.tick());
    } else {
      this.isPlaying = false;
    }
  }

  private renderFrame(): void {
    if (!this.renderer || !this.scene3 || !this.camera3 || !this.cube) return;

    const t = this.elapsed;
    // Cube rotation driven by elapsed time
    this.cube.rotation.x = t * 0.5;
    this.cube.rotation.y = t * 0.8;

    // Gentle camera bob
    this.camera3.position.y = Math.sin(t * 0.3) * 0.4;
    this.camera3.lookAt(0, 0, 0);

    // Point light orbit
    if (this.pointLight) {
      this.pointLight.position.x = Math.cos(t * 0.6) * 5;
      this.pointLight.position.z = Math.sin(t * 0.6) * 5;
    }

    this.renderer.render(this.scene3, this.camera3);
  }
}

export function createThreeScene(label?: string, durationSec?: number): ThreeScene {
  return new ThreeScene(label, durationSec);
}
