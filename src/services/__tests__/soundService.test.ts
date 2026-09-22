import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  soundService,
  AVAILABLE_SOUNDS,
  SOUND_CATEGORIES,
  DEFAULT_SOUND_PREFERENCES,
} from "../soundService";

describe("soundService", () => {
  beforeEach(() => {
    localStorage.clear();
    soundService.resetToDefaults();
    vi.restoreAllMocks();
  });

  it("provides available sound definitions including all 10 sound files", () => {
    expect(AVAILABLE_SOUNDS).toHaveLength(10);
    const soundIds = AVAILABLE_SOUNDS.map((s) => s.id);
    expect(soundIds).toContain("bell");
    expect(soundIds).toContain("guitar");
    expect(soundIds).toContain("happy-bells");
    expect(soundIds).toContain("long-pop");
    expect(soundIds).toContain("positive");
    expect(soundIds).toContain("click");
    expect(soundIds).toContain("interface-back");
    expect(soundIds).toContain("interface-start");
    expect(soundIds).toContain("uplifting-flute");
    expect(soundIds).toContain("urgent-tone");

    // All android resources must have valid Android naming [a-z0-9_]
    AVAILABLE_SOUNDS.forEach((sound) => {
      expect(sound.androidResource).toMatch(/^[a-z0-9_]+$/);
    });
  });

  it("covers all required notification categories", () => {
    const categoryKeys = SOUND_CATEGORIES.map((c) => c.key);
    expect(categoryKeys).toContain("medication");
    expect(categoryKeys).toContain("hydration");
    expect(categoryKeys).toContain("quotes");
    expect(categoryKeys).toContain("taken");
    expect(categoryKeys).toContain("skipped");
    expect(categoryKeys).toContain("missed");
    expect(categoryKeys).toContain("refill");
  });

  it("loads default sound preferences correctly", () => {
    const prefs = soundService.getPreferences();
    expect(prefs.enabled).toBe(true);
    expect(prefs.volume).toBe(0.8);
    expect(prefs.categories.medication).toBe("interface-start");
    expect(prefs.categories.hydration).toBe("long-pop");
    expect(prefs.categories.quotes).toBe("uplifting-flute");
    expect(prefs.categories.taken).toBe("positive");
    expect(prefs.categories.skipped).toBe("interface-back");
    expect(prefs.categories.missed).toBe("urgent-tone");
    expect(prefs.categories.refill).toBe("guitar");
  });

  it("updates category sound and persists to localStorage", () => {
    soundService.setCategorySound("medication", "bell");
    expect(soundService.getPreferences().categories.medication).toBe("bell");

    // Check localStorage
    const saved = JSON.parse(localStorage.getItem("dawa_sound_preferences") || "{}");
    expect(saved.categories.medication).toBe("bell");
  });

  it("toggles enabled state and clamps volume correctly", () => {
    soundService.setEnabled(false);
    expect(soundService.getPreferences().enabled).toBe(false);

    soundService.setVolume(1.5); // clamps to 1.0
    expect(soundService.getPreferences().volume).toBe(1.0);

    soundService.setVolume(-0.5); // clamps to 0.0
    expect(soundService.getPreferences().volume).toBe(0.0);
  });

  it("returns appropriate Android resource name for categories", () => {
    expect(soundService.getAndroidResourceForCategory("missed")).toBe("mixkit_urgent_simple_tone_loop_2976");
    expect(soundService.getAndroidResourceForCategory("hydration")).toBe("mixkit_long_pop_2358");

    soundService.setCategorySound("hydration", "silent");
    expect(soundService.getAndroidResourceForCategory("hydration")).toBe("");

    soundService.setCategorySound("hydration", "default");
    expect(soundService.getAndroidResourceForCategory("hydration")).toBe("default");
  });

  it("resets preferences to original defaults", () => {
    soundService.setCategorySound("medication", "click");
    soundService.setEnabled(false);
    soundService.setVolume(0.2);

    const reset = soundService.resetToDefaults();
    expect(reset.enabled).toBe(true);
    expect(reset.volume).toBe(0.8);
    expect(reset.categories.medication).toBe("interface-start");
  });
});
