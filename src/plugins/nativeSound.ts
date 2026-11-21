/**
 * NativeSound — Hardware-accelerated Android SoundPool audio feedback bridge.
 *
 * Preloads bundled `res/raw/mixkit_*.mp3` chimes into native AudioFlinger memory so UI
 * and adherence confirmations play in < 5ms without HTML5 `<audio>` decode lag,
 * autoplay blocks, or interrupting background music.
 */
import { registerPlugin } from "@capacitor/core";

export interface NativeSoundPlugin {
  preload(options: { resources: string[] }): Promise<{ loaded: number }>;
  play(options: { resource: string; volume?: number }): Promise<{ played: boolean }>;
  stop(): Promise<void>;
}

const NativeSound = registerPlugin<NativeSoundPlugin>("NativeSound");
export { NativeSound };
