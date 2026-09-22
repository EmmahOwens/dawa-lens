/**
 * soundService.ts
 *
 * Central audio and notification sound management service for Dawa Lens.
 * Manages sound selection preferences for various notifications (medication reminders,
 * hydration, daily quotes, dose taken, dose skipped, missed dose alerts, refill alerts),
 * provides HTML5 audio playback for in-app preview/feedback, and provides Android
 * raw resource names for native notification channels.
 */

export interface SoundDefinition {
  id: string;
  name: string;
  filename: string;
  androidResource: string;
  description: string;
  categoryTag: string;
}

export const AVAILABLE_SOUNDS: SoundDefinition[] = [
  {
    id: "bell",
    name: "Gentle Bell",
    filename: "mixkit-bell-notification-933.wav",
    androidResource: "mixkit_bell_notification_933",
    description: "Crisp and clear gentle bell chime",
    categoryTag: "Chime",
  },
  {
    id: "guitar",
    name: "Acoustic Strum",
    filename: "mixkit-guitar-notification-alert-2320.wav",
    androidResource: "mixkit_guitar_notification_alert_2320",
    description: "Warm and melodic acoustic guitar alert",
    categoryTag: "Melodic",
  },
  {
    id: "happy-bells",
    name: "Happy Bells",
    filename: "mixkit-happy-bells-notification-937.wav",
    androidResource: "mixkit_happy_bells_notification_937",
    description: "Cheerful, uplifting harmonic bells",
    categoryTag: "Chime",
  },
  {
    id: "long-pop",
    name: "Soft Bubble Pop",
    filename: "mixkit-long-pop-2358.wav",
    androidResource: "mixkit_long_pop_2358",
    description: "Gentle water droplet and bubble pop",
    categoryTag: "Minimal",
  },
  {
    id: "positive",
    name: "Positive Ding",
    filename: "mixkit-positive-notification-951.wav",
    androidResource: "mixkit_positive_notification_951",
    description: "Upbeat and affirmative celebratory chime",
    categoryTag: "Affirmation",
  },
  {
    id: "click",
    name: "Crisp Click",
    filename: "mixkit-sci-fi-click-900.wav",
    androidResource: "mixkit_sci_fi_click_900",
    description: "Subtle, modern haptic-style click",
    categoryTag: "Minimal",
  },
  {
    id: "interface-back",
    name: "Modern Tap",
    filename: "mixkit-software-interface-back-2575.wav",
    androidResource: "mixkit_software_interface_back_2575",
    description: "Soft tactile interface tap",
    categoryTag: "Minimal",
  },
  {
    id: "interface-start",
    name: "Digital Harmony",
    filename: "mixkit-software-interface-start-2574.wav",
    androidResource: "mixkit_software_interface_start_2574",
    description: "Smooth, futuristic startup chime",
    categoryTag: "Melodic",
  },
  {
    id: "uplifting-flute",
    name: "Uplifting Flute",
    filename: "mixkit-uplifting-flute-notification-2317.wav",
    androidResource: "mixkit_uplifting_flute_notification_2317",
    description: "Soothing and inspiring wooden flute note",
    categoryTag: "Wellness",
  },
  {
    id: "urgent-tone",
    name: "Urgent Alert",
    filename: "mixkit-urgent-simple-tone-loop-2976.wav",
    androidResource: "mixkit_urgent_simple_tone_loop_2976",
    description: "Distinct high-priority alert tone",
    categoryTag: "High Priority",
  },
];

export type SoundCategoryKey =
  | "medication"
  | "hydration"
  | "quotes"
  | "taken"
  | "skipped"
  | "missed"
  | "refill";

export interface SoundCategoryMeta {
  key: SoundCategoryKey;
  label: string;
  description: string;
  iconName: string;
  defaultSoundId: string;
}

export const SOUND_CATEGORIES: SoundCategoryMeta[] = [
  {
    key: "medication",
    label: "Medication Reminders",
    description: "Scheduled dose alarms and take-medication notifications",
    iconName: "Pill",
    defaultSoundId: "interface-start",
  },
  {
    key: "hydration",
    label: "Hydration Reminders",
    description: "Daytime drink-water nudges to maintain hydration",
    iconName: "Droplets",
    defaultSoundId: "long-pop",
  },
  {
    key: "quotes",
    label: "Daily Quotes & Wellness",
    description: "Morning health inspiration and evening wellness nudges",
    iconName: "Sparkles",
    defaultSoundId: "uplifting-flute",
  },
  {
    key: "taken",
    label: "Dose Taken Feedback",
    description: "Audio celebration when you log a medication dose as taken",
    iconName: "CheckCircle2",
    defaultSoundId: "positive",
  },
  {
    key: "skipped",
    label: "Dose Skipped Feedback",
    description: "Subtle audio cue when a scheduled dose is skipped",
    iconName: "SkipForward",
    defaultSoundId: "interface-back",
  },
  {
    key: "missed",
    label: "Missed Dose Alert",
    description: "High-priority warning when a scheduled dose window has elapsed",
    iconName: "AlertTriangle",
    defaultSoundId: "urgent-tone",
  },
  {
    key: "refill",
    label: "Refill Alerts",
    description: "Reminders when a prescription supply is running low",
    iconName: "Package",
    defaultSoundId: "guitar",
  },
];

export interface SoundPreferences {
  enabled: boolean;
  volume: number; // 0 to 1
  categories: Record<SoundCategoryKey, string>;
}

export const DEFAULT_SOUND_PREFERENCES: SoundPreferences = {
  enabled: true,
  volume: 0.8,
  categories: {
    medication: "interface-start",
    hydration: "long-pop",
    quotes: "uplifting-flute",
    taken: "positive",
    skipped: "interface-back",
    missed: "urgent-tone",
    refill: "guitar",
  },
};

const STORAGE_KEY = "dawa_sound_preferences";

class SoundService {
  private currentAudio: HTMLAudioElement | null = null;
  private currentPlayingId: string | null = null;
  private listeners: Set<(prefs: SoundPreferences) => void> = new Set();
  private cachedPrefs: SoundPreferences | null = null;

  constructor() {
    this.cachedPrefs = this.loadPreferences();
  }

  /**
   * Load stored preferences or return defaults.
   */
  public getPreferences(): SoundPreferences {
    if (this.cachedPrefs) return this.cachedPrefs;
    this.cachedPrefs = this.loadPreferences();
    return this.cachedPrefs;
  }

  private loadPreferences(): SoundPreferences {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        return { ...DEFAULT_SOUND_PREFERENCES };
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SOUND_PREFERENCES };
      const parsed = JSON.parse(raw);
      return {
        enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_SOUND_PREFERENCES.enabled,
        volume: typeof parsed.volume === "number" ? Math.max(0, Math.min(1, parsed.volume)) : DEFAULT_SOUND_PREFERENCES.volume,
        categories: {
          ...DEFAULT_SOUND_PREFERENCES.categories,
          ...(parsed.categories || {}),
        },
      };
    } catch (e) {
      console.warn("[SoundService] Failed to load preferences from localStorage:", e);
      return { ...DEFAULT_SOUND_PREFERENCES };
    }
  }

  /**
   * Save user sound preferences.
   */
  public savePreferences(prefs: SoundPreferences): void {
    this.cachedPrefs = { ...prefs };
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      }
    } catch (e) {
      console.warn("[SoundService] Failed to save preferences to localStorage:", e);
    }
    this.notifyListeners();
  }

  /**
   * Reset all sound preferences back to original defaults.
   */
  public resetToDefaults(): SoundPreferences {
    const defaults = { ...DEFAULT_SOUND_PREFERENCES };
    this.savePreferences(defaults);
    return defaults;
  }

  /**
   * Update sound for a specific category.
   */
  public setCategorySound(category: SoundCategoryKey, soundId: string): void {
    const prefs = this.getPreferences();
    const updated: SoundPreferences = {
      ...prefs,
      categories: {
        ...prefs.categories,
        [category]: soundId,
      },
    };
    this.savePreferences(updated);
  }

  /**
   * Toggle master sound enabled state.
   */
  public setEnabled(enabled: boolean): void {
    const prefs = this.getPreferences();
    this.savePreferences({ ...prefs, enabled });
  }

  /**
   * Update master sound volume (0.0 - 1.0).
   */
  public setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    const prefs = this.getPreferences();
    this.savePreferences({ ...prefs, volume: clamped });
    if (this.currentAudio) {
      this.currentAudio.volume = clamped;
    }
  }

  /**
   * Subscribe to preference changes.
   */
  public subscribe(listener: (prefs: SoundPreferences) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    if (!this.cachedPrefs) return;
    for (const listener of this.listeners) {
      try {
        listener(this.cachedPrefs);
      } catch (e) {
        console.warn("[SoundService] Listener error:", e);
      }
    }
  }

  /**
   * Stop any sound currently playing.
   */
  public stopSound(): void {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {
        // ignore
      }
      this.currentAudio = null;
    }
    this.currentPlayingId = null;
  }

  /**
   * Check which sound id is currently playing (if any).
   */
  public getCurrentlyPlayingId(): string | null {
    return this.currentPlayingId;
  }

  /**
   * Play a specific sound by its id or filename.
   */
  public async playSound(soundId: string, volumeOverride?: number): Promise<boolean> {
    const prefs = this.getPreferences();
    if (!prefs.enabled && volumeOverride === undefined) {
      return false;
    }

    if (soundId === "silent") {
      this.stopSound();
      return true;
    }

    // Resolve sound definition
    let soundDef = AVAILABLE_SOUNDS.find((s) => s.id === soundId);
    if (!soundDef && soundId === "default") {
      // Use Gentle Bell as fallback for default web preview
      soundDef = AVAILABLE_SOUNDS[0];
    }
    if (!soundDef) {
      soundDef = AVAILABLE_SOUNDS.find((s) => s.filename === soundId);
    }
    if (!soundDef) {
      console.warn(`[SoundService] Unknown sound ID: "${soundId}"`);
      return false;
    }

    this.stopSound();

    try {
      if (typeof window === "undefined" || typeof Audio === "undefined") {
        return false;
      }

      const audioUrl = `/notification_sounds/${soundDef.filename}`;
      const audio = new Audio(audioUrl);
      const targetVolume = volumeOverride !== undefined ? volumeOverride : prefs.volume;
      audio.volume = Math.max(0, Math.min(1, targetVolume));

      this.currentAudio = audio;
      this.currentPlayingId = soundId;

      audio.onended = () => {
        if (this.currentAudio === audio) {
          this.currentAudio = null;
          this.currentPlayingId = null;
          this.notifyListeners();
        }
      };

      audio.onerror = (e) => {
        console.warn(`[SoundService] Failed to play audio (${audioUrl}):`, e);
        if (this.currentAudio === audio) {
          this.currentAudio = null;
          this.currentPlayingId = null;
          this.notifyListeners();
        }
      };

      await audio.play();
      this.notifyListeners();
      return true;
    } catch (err: any) {
      // Autoplay or permissions issue in browser
      if (err.name !== "NotAllowedError") {
        console.warn("[SoundService] Audio playback rejected:", err);
      }
      this.currentPlayingId = null;
      this.notifyListeners();
      return false;
    }
  }

  /**
   * Play the configured sound for a given notification category.
   */
  public async playForCategory(category: SoundCategoryKey): Promise<boolean> {
    const prefs = this.getPreferences();
    if (!prefs.enabled) return false;

    const soundId = prefs.categories[category] || DEFAULT_SOUND_PREFERENCES.categories[category];
    if (!soundId || soundId === "silent") return false;

    return this.playSound(soundId);
  }

  /**
   * Get the Android raw resource name (without extension) for a given category.
   * Returns 'default' if system default, or empty string if silent.
   */
  public getAndroidResourceForCategory(category: SoundCategoryKey): string {
    const prefs = this.getPreferences();
    if (!prefs.enabled) return "";

    const soundId = prefs.categories[category] || DEFAULT_SOUND_PREFERENCES.categories[category];
    if (soundId === "silent") return "";
    if (soundId === "default") return "default";

    const soundDef = AVAILABLE_SOUNDS.find((s) => s.id === soundId);
    return soundDef?.androidResource || "default";
  }
}

export const soundService = new SoundService();
