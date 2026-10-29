import { useState, useEffect, useMemo, useCallback } from "react";
import { isSameDay } from "date-fns";
import { usePatientScope } from "@/hooks/usePatientScope";
import { toDate } from "@/lib/utils";
import type { WellnessLog } from "@/contexts/AppContext";

export const MOOD_THEME_STORAGE_KEY = "dawa_adaptive_mood_theme";
export const MOOD_THEME_CHANGED_EVENT = "dawa:mood-theme-changed";
export const MOOD_THEME_PREVIEW_EVENT = "dawa:mood-theme-preview";

export type MoodLevel = 1 | 2 | 3 | 4 | 5;

export interface MoodThemeInfo {
  val: MoodLevel;
  emoji: string;
  label: string;
  themeName: string;
  swatchClass: string;
}

export const MOOD_THEME_META: Record<MoodLevel, MoodThemeInfo> = {
  1: {
    val: 1,
    emoji: "😔",
    label: "Low",
    themeName: "Calming Indigo",
    swatchClass: "bg-indigo-500",
  },
  2: {
    val: 2,
    emoji: "😕",
    label: "Meh",
    themeName: "Gentle Teal",
    swatchClass: "bg-cyan-600",
  },
  3: {
    val: 3,
    emoji: "😐",
    label: "Okay",
    themeName: "Action Blue",
    swatchClass: "bg-sky-600",
  },
  4: {
    val: 4,
    emoji: "🙂",
    label: "Good",
    themeName: "Vitality Emerald",
    swatchClass: "bg-emerald-600",
  },
  5: {
    val: 5,
    emoji: "🤩",
    label: "Great",
    themeName: "Radiant Violet",
    swatchClass: "bg-violet-600",
  },
};

export function isValidMoodLevel(val: unknown): val is MoodLevel {
  const num = Number(val);
  return Number.isInteger(num) && num >= 1 && num <= 5;
}

export function getMoodThemeEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(MOOD_THEME_STORAGE_KEY);
    if (raw === null) return true; // Enabled by default
    return raw === "true";
  } catch {
    return true;
  }
}

export function setMoodThemePreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(MOOD_THEME_STORAGE_KEY, String(enabled));
  } catch {
    // ignore storage errors
  }
  window.dispatchEvent(
    new CustomEvent(MOOD_THEME_CHANGED_EVENT, { detail: { enabled } })
  );
}

export function dispatchMoodPreview(mood: number | null): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(MOOD_THEME_PREVIEW_EVENT, {
      detail: { mood: isValidMoodLevel(mood) ? mood : null },
    })
  );
}

export function applyMoodThemeToDom(
  mood: number | null,
  enabled: boolean
): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (enabled && isValidMoodLevel(mood)) {
    root.setAttribute("data-mood", String(mood));
  } else {
    root.removeAttribute("data-mood");
  }
}

export function getLatestTodayMood(
  wellnessLogs: WellnessLog[],
  referenceDate: Date = new Date()
): MoodLevel | null {
  const todaySymptomLogs = wellnessLogs
    .filter(
      (l) =>
        l.type === "symptom" &&
        isSameDay(toDate(l.timestamp), referenceDate) &&
        isValidMoodLevel(l.data?.mood)
    )
    .sort(
      (a, b) => toDate(b.timestamp).getTime() - toDate(a.timestamp).getTime()
    );

  if (todaySymptomLogs.length === 0) return null;
  const moodVal = Number(todaySymptomLogs[0].data?.mood);
  return isValidMoodLevel(moodVal) ? moodVal : null;
}

/**
 * Resolves the active patient's logged mood for today and synchronizes
 * `document.documentElement[data-mood]` when Adaptive Mood Theme is enabled.
 */
export function useMoodTheme() {
  const { scopedWellnessLogs } = usePatientScope();
  const [moodThemeEnabled, setMoodThemeEnabledState] = useState<boolean>(() =>
    getMoodThemeEnabled()
  );
  const [previewMood, setPreviewMood] = useState<MoodLevel | null>(null);

  const latestTodayMood = useMemo(
    () => getLatestTodayMood(scopedWellnessLogs),
    [scopedWellnessLogs]
  );

  useEffect(() => {
    const onPreferenceChange = (e: Event) => {
      const custom = e as CustomEvent<{ enabled?: boolean }>;
      if (typeof custom.detail?.enabled === "boolean") {
        setMoodThemeEnabledState(custom.detail.enabled);
      } else {
        setMoodThemeEnabledState(getMoodThemeEnabled());
      }
    };

    const onPreviewChange = (e: Event) => {
      const custom = e as CustomEvent<{ mood?: MoodLevel | null }>;
      setPreviewMood(custom.detail?.mood ?? null);
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === MOOD_THEME_STORAGE_KEY) {
        setMoodThemeEnabledState(getMoodThemeEnabled());
      }
    };

    window.addEventListener(MOOD_THEME_CHANGED_EVENT, onPreferenceChange);
    window.addEventListener(MOOD_THEME_PREVIEW_EVENT, onPreviewChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(MOOD_THEME_CHANGED_EVENT, onPreferenceChange);
      window.removeEventListener(MOOD_THEME_PREVIEW_EVENT, onPreviewChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const activeMood: MoodLevel | null = previewMood ?? latestTodayMood;

  useEffect(() => {
    applyMoodThemeToDom(activeMood, moodThemeEnabled);
  }, [activeMood, moodThemeEnabled]);

  const setMoodThemeEnabled = useCallback((enabled: boolean) => {
    setMoodThemeEnabledState(enabled);
    setMoodThemePreference(enabled);
  }, []);

  return {
    moodThemeEnabled,
    setMoodThemeEnabled,
    latestTodayMood,
    activeMood,
    moodMeta: activeMood ? MOOD_THEME_META[activeMood] : null,
  };
}
