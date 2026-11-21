/**
 * NativeHaptics — Direct Android LRA View.performHapticFeedback / VibrationEffect bridge.
 *
 * Routes micro-interactions directly to Android's hardware haptic feedback constants
 * (CLOCK_TICK, CONTEXT_CLICK, SEGMENT_TICK, CONFIRM, REJECT, GESTURE_START/END)
 * in a single sub-ms call while respecting system Touch Feedback preferences.
 */
import { registerPlugin } from "@capacitor/core";

export interface NativeHapticsPlugin {
  impact(options: { style?: "light" | "medium" | "heavy" }): Promise<void>;
  selection(): Promise<void>;
  gesture(options: { phase?: "start" | "end" }): Promise<void>;
  notification(options: { type?: "success" | "warning" | "error" }): Promise<void>;
}

const NativeHaptics = registerPlugin<NativeHapticsPlugin>("NativeHaptics");
export { NativeHaptics };
