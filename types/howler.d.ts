declare module 'howler' {
	export class Howl {
		constructor(options: { src: string[]; preload?: boolean; volume?: number; html5?: boolean });
		play(id?: number): number;
		pause(id?: number): void;
		stop(id?: number): void;
		playing(id?: number): boolean;
		seek(): number;
		seek(position: number, id?: number): number;
		unload(): null;
	}
}
