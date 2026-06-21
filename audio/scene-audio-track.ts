import { Howl } from 'howler';

export type SceneAudioTrackOptions = {
	src: string;
	preload?: boolean;
	volume?: number;
	html5?: boolean;
};

export class SceneAudioTrack {
	private readonly howl: Howl;
	private soundId: number | null = null;
	private pendingTime = 0;

	constructor(options: SceneAudioTrackOptions) {
		this.howl = new Howl({
			src: [options.src],
			preload: options.preload ?? true,
			volume: options.volume ?? 1,
			html5: options.html5
		});
	}

	play(time = this.pendingTime): void {
		const seekTime = Math.max(0, time);
		this.howl.stop();
		const soundId = this.howl.play();
		this.soundId = soundId;
		this.howl.seek(seekTime, soundId);
		this.pendingTime = seekTime;
	}

	pause(time?: number): void {
		if (typeof time === 'number') {
			this.pendingTime = Math.max(0, time);
		}
		this.howl.pause();
	}

	seek(time: number): void {
		const seekTime = Math.max(0, time);
		this.pendingTime = seekTime;
		this.howl.stop();
		this.soundId = null;
	}

	destroy(): void {
		this.howl.unload();
		this.soundId = null;
		this.pendingTime = 0;
	}
}
