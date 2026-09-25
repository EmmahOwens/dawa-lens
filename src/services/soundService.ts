/**
 * soundService.ts
 *
 * Central audio and notification sound management service for Dawa Lens.
 * Manages sound selection preferences for various notifications (medication reminders,
 * hydration, daily quotes, dose taken, dose skipped, missed dose alerts, refill alerts),
 * provides HTML5 audio playback for in-app preview/feedback, and drives Android
 * native notification channel creation with custom per-category WAV sounds.
 *
 * Architecture:
 *  - HTML5 Audio API  → foreground in-app sound previews / action feedback
 *  - getChannelIdForCategory() → deterministic, sound-hashed Android channel IDs
 *  - getAndroidSoundUri()      → android.resource:// URI used on notification channels
 *  - saveSoundPrefs()          → mirrors prefs to native SharedPreferences via NativeAlarm
 *                                so AlarmReceiver / MissedDoseWorker can use custom sounds
 *                                even when the app is killed or offline
 */

/** Android package name — must match applicationId in build.gradle */
const ANDROID_PACKAGE_NAME = "com.dawainnovation.lens";

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
const CHANNEL_ACTIVE_KEY = "dawa_active_channel_ids";

class SoundService {
  private currentAudio: HTMLAudioElement | null = null;
  private currentPlayingId: string | null = null;
  private listeners: Set<(prefs: SoundPreferences) => void> = new Set();
  private cachedPrefs: SoundPreferences | null = null;
  private retryListenerAttached = false;
  private pendingRetrySoundId: string | null = null;

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
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(
          new CustomEvent("dawa:sound-preferences-changed", { detail: { ...prefs } })
        );
      } catch { /* ignore */ }
    }
    this.saveSoundPrefsToNative();
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
   * Returns an android.resource:// URI for the given sound ID.
   * This URI is passed to NotificationChannel.setSound() on Android O+.
   * Returns empty string if "silent", "default" keyword if not found.
   */
  public getAndroidSoundUri(soundId: string): string {
    if (!soundId || soundId === "silent") return "";
    if (soundId === "default") return "default";
    const soundDef = AVAILABLE_SOUNDS.find((s) => s.id === soundId || s.filename === soundId);
    if (!soundDef) return "default";
    return `android.resource://${ANDROID_PACKAGE_NAME}/raw/${soundDef.androidResource}`;
  }

  /**
   * Returns the android.resource:// URI for the currently selected sound for a category.
   */
  public getAndroidSoundUriForCategory(category: SoundCategoryKey): string {
    const prefs = this.getPreferences();
    if (!prefs.enabled) return "";
    const soundId = prefs.categories[category] || DEFAULT_SOUND_PREFERENCES.categories[category];
    return this.getAndroidSoundUri(soundId);
  }

  /**
   * Returns a sound-hashed Android notification channel ID for a category.
   * Including the sound name forces Android to create a fresh channel (with the
   * new sound) when the user changes their preference — Android permanently locks
   * a channel's sound after first creation, so a new ID is required.
   *
   * Pattern: dawa_<category>_<resourceName>_v1
   */
  public getChannelIdForCategory(category: SoundCategoryKey): string {
    const prefs = this.getPreferences();
    if (!prefs.enabled) return `dawa_${category}_silent_v1`;
    const soundId = prefs.categories[category] || DEFAULT_SOUND_PREFERENCES.categories[category];
    if (!soundId || soundId === "silent") return `dawa_${category}_silent_v1`;
    if (soundId === "default") return `dawa_${category}_default_v1`;
    const soundDef = AVAILABLE_SOUNDS.find((s) => s.id === soundId);
    const resourceName = soundDef?.androidResource || "default";
    return `dawa_${category}_${resourceName}_v1`;
  }

  /**
   * Mirrors sound preferences to native Android SharedPreferences via NativeAlarm.saveSoundPrefs
   * (Option A). This enables AlarmReceiver and MissedDoseWorker to apply custom sounds when
   * the app is killed, backgrounded, or the device is offline. Also creates/updates per-category
   * channels with the correct sound URI and deletes any stale channels.
   */
  public async saveSoundPrefsToNative(): Promise<void> {
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;

      const { NativeAlarm } = await import("@/plugins/nativeAlarm");
      const prefs = this.getPreferences();

      // Build resource-name map for Kotlin SoundPrefsReader
      const categoryResourceMap: Record<string, string> = {};
      for (const cat of Object.keys(prefs.categories) as SoundCategoryKey[]) {
        const soundId = prefs.categories[cat];
        if (!prefs.enabled || soundId === "silent") {
          categoryResourceMap[cat] = "silent";
        } else if (soundId === "default") {
          categoryResourceMap[cat] = "default";
        } else {
          const soundDef = AVAILABLE_SOUNDS.find((s) => s.id === soundId);
          categoryResourceMap[cat] = soundDef?.androidResource || "default";
        }
      }

      // Read previous active channel IDs for cleanup
      let previousChannelIds: string[] = [];
      try {
        const raw = localStorage.getItem(CHANNEL_ACTIVE_KEY);
        if (raw) previousChannelIds = JSON.parse(raw);
      } catch { /* ignore */ }

      const activeChannelIds: string[] = [];
      for (const cat of Object.keys(prefs.categories) as SoundCategoryKey[]) {
        activeChannelIds.push(this.getChannelIdForCategory(cat));
      }

      // Identify stale channels to delete
      const staleChannelIds = previousChannelIds.filter((id) => !activeChannelIds.includes(id));

      // Persist active channels list
      try {
        localStorage.setItem(CHANNEL_ACTIVE_KEY, JSON.stringify(activeChannelIds));
      } catch { /* ignore */ }

      // Call Option-A bridge: native layer creates channels, writes SharedPreferences, deletes stale channels
      await (NativeAlarm as any).saveSoundPrefs({
        enabled: prefs.enabled,
        categories: JSON.stringify(categoryResourceMap),
        staleChannelIds: JSON.stringify(staleChannelIds),
      });
    } catch (e) {
      // Non-fatal: native layer falls back to system default sound
    }
  }

  /**
   * Play the configured sound for a category, with an automatic timed retry
   * if the first attempt is blocked by the browser autoplay policy
   * (NotAllowedError — common when the app is freshly opened from a notification tap).
   */
  public tryPlayForCategory(category: SoundCategoryKey, retryDelayMs = 600): void {
    this.playForCategory(category).then((played) => {
      if (!played) {
        setTimeout(() => this.playForCategory(category).catch(() => {}), retryDelayMs);
      }
    }).catch(() => {
      setTimeout(() => this.playForCategory(category).catch(() => {}), retryDelayMs);
    });
  }

  /**
   * Setup autoplay retry on user interaction if audio play is blocked by browser policy.
   */
  private setupAutoplayRetry(soundId: string, volumeOverride?: number): void {
    if (this.retryListenerAttached) return;
    this.retryListenerAttached = true;
    this.pendingRetrySoundId = soundId;

    const retryHandler = async () => {
      window.removeEventListener("click", retryHandler);
      window.removeEventListener("touchstart", retryHandler);
      window.removeEventListener("keydown", retryHandler);
      this.retryListenerAttached = false;

      if (this.pendingRetrySoundId) {
        const idToPlay = this.pendingRetrySoundId;
        this.pendingRetrySoundId = null;
        await this.playSound(idToPlay, volumeOverride);
      }
    };

    window.addEventListener("click", retryHandler, { once: true });
    window.addEventListener("touchstart", retryHandler, { once: true });
    window.addEventListener("keydown", retryHandler, { once: true });
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

      const baseUrl = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) || "/";
      const cleanBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
      const audioUrl = `${cleanBase}notification_sounds/${soundDef.filename}`;
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
      if (err.name === "NotAllowedError") {
        this.setupAutoplayRetry(soundId, volumeOverride);
      } else {
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

  /**
   * Get the sound string suitable for @capacitor/local-notifications.
   * Returns undefined for "default", "silent", or empty, ensuring Android
   * system default ringtone is used without seeking a nonexistent raw/default file.
   */
  public getCapacitorSound(category: SoundCategoryKey): string | undefined {
    const resource = this.getAndroidResourceForCategory(category);
    return resource && resource !== "default" && resource !== "silent" ? resource : undefined;
  }
}

export const soundService = new SoundService();
