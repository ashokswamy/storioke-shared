import type { SceneSfxControl } from '$lib/pixi/scene-types';

const CONTROLS: SceneSfxControl[] = [
	{ id: 'spatial', label: 'Spatial SFX' },
	{ id: 'short', label: 'Short Clip' }
];

export class CommonSfx {
	private audioCtx: AudioContext | null = null;
	private activeNodes: AudioScheduledSourceNode[] = [];

	getControls(): SceneSfxControl[] {
		return CONTROLS;
	}

	trigger(id: string): void {
		void this.triggerInternal(id);
	}

	stop(): void {
		for (const node of this.activeNodes) {
			try {
				node.stop();
			} catch {
				// Ignore nodes already ended.
			}
		}
		this.activeNodes = [];
	}

	destroy(): void {
		this.stop();
		if (this.audioCtx) {
			void this.audioCtx.close();
			this.audioCtx = null;
		}
	}

	private ensureAudioContext(): AudioContext | null {
		const AudioContextCtor =
			typeof globalThis !== 'undefined'
				? (globalThis.AudioContext ??
					(globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
				: undefined;
		if (!AudioContextCtor) return null;
		if (!this.audioCtx) {
			this.audioCtx = new AudioContextCtor();
		}
		return this.audioCtx;
	}

	private async triggerInternal(id: string): Promise<void> {
		const ctx = this.ensureAudioContext();
		if (!ctx) return;
		if (ctx.state !== 'running') {
			try {
				await ctx.resume();
			} catch {
				return;
			}
		}
		if (ctx.state !== 'running') return;

		if (id === 'spatial') {
			this.playSpatial(ctx);
			return;
		}
		if (id === 'short') {
			this.playShort(ctx);
		}
	}

	private playSpatial(ctx: AudioContext): void {
		this.stop();
		const now = ctx.currentTime;

		const outputGain = ctx.createGain();
		outputGain.gain.setValueAtTime(3.2, now);

		const panner = ctx.createPanner();
		panner.panningModel = 'HRTF';
		panner.distanceModel = 'inverse';
		panner.refDistance = 1;
		panner.maxDistance = 50;
		panner.rolloffFactor = 1;
		panner.positionX.setValueAtTime(-4, now);
		panner.positionY.setValueAtTime(0, now);
		panner.positionZ.setValueAtTime(2, now);
		panner.positionX.linearRampToValueAtTime(3.5, now + 2.8);
		panner.positionZ.linearRampToValueAtTime(1.2, now + 2.8);

		const compressor = ctx.createDynamicsCompressor();
		compressor.threshold.setValueAtTime(-30, now);
		compressor.knee.setValueAtTime(18, now);
		compressor.ratio.setValueAtTime(4, now);
		compressor.attack.setValueAtTime(0.01, now);
		compressor.release.setValueAtTime(0.3, now);

		const makeupGain = ctx.createGain();
		makeupGain.gain.setValueAtTime(2.0, now);

		outputGain.connect(panner);
		panner.connect(compressor);
		compressor.connect(makeupGain);
		makeupGain.connect(ctx.destination);

		const rumbleDuration = 3.2;
		const rumbleBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * rumbleDuration), ctx.sampleRate);
		const channel = rumbleBuffer.getChannelData(0);
		let brown = 0;
		for (let i = 0; i < channel.length; i += 1) {
			const white = Math.random() * 2 - 1;
			brown = (brown + 0.06 * white) / 1.03;
			channel[i] = brown * 0.8;
		}

		const rumbleSource = ctx.createBufferSource();
		rumbleSource.buffer = rumbleBuffer;
		const rumbleFilter = ctx.createBiquadFilter();
		rumbleFilter.type = 'lowpass';
		rumbleFilter.frequency.setValueAtTime(1400, now);
		rumbleFilter.frequency.exponentialRampToValueAtTime(240, now + rumbleDuration);
		const rumbleGain = ctx.createGain();
		rumbleGain.gain.setValueAtTime(0.0001, now);
		rumbleGain.gain.exponentialRampToValueAtTime(0.95, now + 0.08);
		rumbleGain.gain.exponentialRampToValueAtTime(0.42, now + 1.2);
		rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + rumbleDuration);
		rumbleSource.connect(rumbleFilter);
		rumbleFilter.connect(rumbleGain);
		rumbleGain.connect(outputGain);

		rumbleSource.start(now);
		rumbleSource.stop(now + rumbleDuration);
		rumbleSource.onended = () => this.removeNode(rumbleSource);
		this.activeNodes.push(rumbleSource);
	}

	private playShort(ctx: AudioContext): void {
		const oscillator = ctx.createOscillator();
		oscillator.type = 'triangle';
		oscillator.frequency.setValueAtTime(960, ctx.currentTime);
		oscillator.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.18);

		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0.001, ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.45, ctx.currentTime + 0.01);
		gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);

		oscillator.connect(gain);
		gain.connect(ctx.destination);
		oscillator.start();
		oscillator.stop(ctx.currentTime + 0.22);
		oscillator.onended = () => this.removeNode(oscillator);
		this.activeNodes.push(oscillator);
	}

	private removeNode(node: AudioScheduledSourceNode): void {
		this.activeNodes = this.activeNodes.filter((item) => item !== node);
	}
}
