/**
 * quotesService.ts — Engagement notifications beyond medication reminders.
 * All notifications use both Capacitor LocalNotifications (allowWhileIdle) AND
 * NativeAlarm (AlarmManager.setExactAndAllowWhileIdle) for offline reliability.
 *
 * Quotes rotation is powered by a deterministic, calendar-day rotation engine
 * that seamlessly loops through all 10,000 unique quotes across 27.4 years
 * without skipping, drifting, or repeating.
 */

import {
  LocalNotifications,
  LocalNotificationSchema,
} from "@capacitor/local-notifications";
import { NativeAlarm, AlarmNotification } from "@/plugins/nativeAlarm";
import { notify } from "@/lib/notifications";
import { soundService } from "@/services/soundService";
import { Capacitor } from "@capacitor/core";
import type { DoseLog, Reminder, WellnessLog } from "@/contexts/AppContext";
import {
  addDays,
  startOfDay,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
  isAfter,
  subDays,
  getDay,
  parseISO,
} from "date-fns";

import {
  HEALTH_QUOTES,
  ENCOURAGEMENT_QUOTES,
  ADHERENCE_QUOTES,
  WELLNESS_QUOTES,
  MINDFULNESS_QUOTES,
  LIFESTYLE_QUOTES,
  INSPIRATION_QUOTES,
  getHealthQuoteAt,
} from "@/data/quotesData";
import {
  HYDRATION_MESSAGES,
  EVENING_CHECKIN_MESSAGES,
  WEEKLY_SUMMARY_MESSAGES,
  WELLNESS_NUDGE_MESSAGES,
  MOVEMENT_MESSAGES,
  MINDFULNESS_MESSAGES,
  NUTRITION_MESSAGES,
  EYE_REST_MESSAGES,
  OUTDOOR_RESET_MESSAGES,
  WIND_DOWN_MESSAGES,
} from "@/data/engagementQuotes";

export {
  HEALTH_QUOTES,
  ENCOURAGEMENT_QUOTES,
  ADHERENCE_QUOTES,
  WELLNESS_QUOTES,
  MINDFULNESS_QUOTES,
  LIFESTYLE_QUOTES,
  INSPIRATION_QUOTES,
  getHealthQuoteAt,
  HYDRATION_MESSAGES,
  EVENING_CHECKIN_MESSAGES,
  WEEKLY_SUMMARY_MESSAGES,
  WELLNESS_NUDGE_MESSAGES,
  MOVEMENT_MESSAGES,
  MINDFULNESS_MESSAGES,
  NUTRITION_MESSAGES,
  EYE_REST_MESSAGES,
  OUTDOOR_RESET_MESSAGES,
  WIND_DOWN_MESSAGES,
};

// ─── Channel IDs ────────────────────────────────────────────────────────────
const CHANNEL_QUOTES    = "dawa_quotes_v2";
const CHANNEL_WELLNESS  = "dawa_wellness_v2";
const CHANNEL_HYDRATION = "dawa_hydration_v2";
const CHANNEL_STREAKS   = "dawa_streaks_v2";

// ─── localStorage keys ───────────────────────────────────────────────────────
const ENGAGEMENT_LOCAL_IDS_KEY = "dawa_engagement_local_ids";

// ─── Utility ─────────────────────────────────────────────────────────────────
const stringToHash = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  // Clamp within positive 32-bit signed int range [1, 2147483646]
  const val = Math.abs(hash % 2147483647);
  return val === 0 ? 1 : val;
};

function setTime(date: Date, h: number, m: number, s = 0, ms = 0): Date {
  let d = setHours(new Date(date), h);
  d = setMinutes(d, m);
  d = setSeconds(d, s);
  d = setMilliseconds(d, ms);
  return d;
}

// ─── Create Android notification channels ────────────────────────────────────
async function createEngagementChannels(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (Capacitor.getPlatform() !== "android") return;
  try {
    const quotesResource = soundService.getAndroidResourceForCategory("quotes");
    const hydrationResource = soundService.getAndroidResourceForCategory("hydration");
    const takenResource = soundService.getAndroidResourceForCategory("taken");

    const quotesSound = quotesResource !== "default" && quotesResource !== "silent" ? quotesResource : undefined;
    const hydrationSound = hydrationResource !== "default" && hydrationResource !== "silent" ? hydrationResource : undefined;
    const takenSound = takenResource !== "default" && takenResource !== "silent" ? takenResource : undefined;

    const quotesChannelId = soundService.getChannelIdForCategory("quotes");
    const hydrationChannelId = soundService.getChannelIdForCategory("hydration");
    const takenChannelId = soundService.getChannelIdForCategory("taken");

    // Dynamic sound-hashed channels
    await LocalNotifications.createChannel({ id: quotesChannelId,    name: "Daily Health Quotes",       description: "Motivational health quotes to keep you inspired",   importance: 3, vibration: false, sound: quotesSound });
    await LocalNotifications.createChannel({ id: hydrationChannelId, name: "Hydration Reminders",       description: "Stay hydrated throughout the day",                  importance: 3, vibration: false, sound: hydrationSound });
    await LocalNotifications.createChannel({ id: takenChannelId,     name: "Achievements & Streaks",    description: "Celebrate your medication adherence milestones",    importance: 4, vibration: true,  sound: takenSound });

    // Legacy fallback channels (importance: 3 for hydration so sounds play)
    await LocalNotifications.createChannel({ id: CHANNEL_QUOTES,    name: "Daily Health Quotes",       description: "Motivational health quotes to keep you inspired",   importance: 3, vibration: false, sound: quotesSound });
    await LocalNotifications.createChannel({ id: CHANNEL_WELLNESS,  name: "Wellness Reminders",        description: "Evening check-ins and wellness log nudges",         importance: 3, vibration: false, sound: quotesSound });
    await LocalNotifications.createChannel({ id: CHANNEL_HYDRATION, name: "Hydration Reminders",       description: "Stay hydrated throughout the day",                  importance: 3, vibration: false, sound: hydrationSound });
    await LocalNotifications.createChannel({ id: CHANNEL_STREAKS,   name: "Achievements & Streaks",    description: "Celebrate your medication adherence milestones",    importance: 4, vibration: true,  sound: takenSound });
  } catch (err) {
    console.warn("[quotesService] Failed to create engagement channels:", err);
  }
}

// ─── Cancel previously scheduled engagement notifications ────────────────────
async function cancelPreviousEngagementNotifs(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const raw = localStorage.getItem(ENGAGEMENT_LOCAL_IDS_KEY);
    if (!raw) return;
    const ids: number[] = JSON.parse(raw);
    if (ids.length > 0) {
      await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
    }
  } catch (err) {
    console.warn("[quotesService] Failed to cancel old engagement notifs:", err);
  }
}

function saveEngagementIds(ids: number[]): void {
  try { localStorage.setItem(ENGAGEMENT_LOCAL_IDS_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
}

async function scheduleNotif(
  localNotifs: LocalNotificationSchema[],
  alarmNotifs: AlarmNotification[]
): Promise<void> {
  if (localNotifs.length > 0) {
    try {
      await LocalNotifications.schedule({ notifications: localNotifs });
    } catch (e) {
      console.warn("[quotesService] LocalNotifications.schedule failed (non-fatal):", e);
    }
  }
  if (alarmNotifs.length > 0) {
    try {
      await NativeAlarm.scheduleAlarms({ notifications: alarmNotifs });
    } catch (e) {
      console.warn("[quotesService] NativeAlarm failed (non-fatal):", e);
    }
  }
}

// ─── 10,000 Health Quotes Deterministic Rotation Engine ──────────────────────
// Anchor date: January 1, 2026 (local calendar day).
const ANCHOR_YEAR = 2026;
const ANCHOR_MONTH = 0; // January
const ANCHOR_DAY = 1;
const ANCHOR_UTC = Date.UTC(ANCHOR_YEAR, ANCHOR_MONTH, ANCHOR_DAY);

/**
 * Computes a deterministic, collision-free index in [0, HEALTH_QUOTES.length - 1]
 * for any given calendar date. Guaranteed to cycle through all 10,000 quotes
 * sequentially across 10,000 consecutive days (27.4 years) before repeating.
 */
export function getQuoteIndexForDate(date: Date = new Date()): number {
  if (!HEALTH_QUOTES || HEALTH_QUOTES.length === 0) return 0;
  const d = new Date(date);
  const localDayUtc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const dayOffset = Math.round((localDayUtc - ANCHOR_UTC) / 86400000);
  // Double-modulo to safely handle negative offsets, clock changes, or leap adjustments
  return ((dayOffset % HEALTH_QUOTES.length) + HEALTH_QUOTES.length) % HEALTH_QUOTES.length;
}

export function getDailyQuote(date: Date = new Date()): string {
  const index = getQuoteIndexForDate(date);
  return getHealthQuoteAt(index) || HEALTH_QUOTES[index] || "💊 Stay consistent with your health journey.";
}

export function getQuoteForDayOffset(dayOffset: number, baseDate: Date = new Date()): string {
  const targetDate = addDays(baseDate, dayOffset);
  return getDailyQuote(targetDate);
}

const recentEncouragementIndices: number[] = [];

export function getEncouragementQuote(): string {
  if (!ENCOURAGEMENT_QUOTES || ENCOURAGEMENT_QUOTES.length === 0) {
    return "💊 Dose logged! Consistency is your superpower.";
  }
  if (ENCOURAGEMENT_QUOTES.length <= 1) {
    return ENCOURAGEMENT_QUOTES[0];
  }
  // Anti-repetition sliding window: remembers recently selected quotes
  const maxHistory = Math.min(30, Math.floor(ENCOURAGEMENT_QUOTES.length / 3));
  let index = Math.floor(Math.random() * ENCOURAGEMENT_QUOTES.length);
  let attempts = 0;
  while (recentEncouragementIndices.includes(index) && attempts < 15) {
    index = Math.floor(Math.random() * ENCOURAGEMENT_QUOTES.length);
    attempts++;
  }
  recentEncouragementIndices.push(index);
  if (recentEncouragementIndices.length > maxHistory) {
    recentEncouragementIndices.shift();
  }
  return ENCOURAGEMENT_QUOTES[index] as string;
}

// ─── 1. Daily Quote Notifications ────────────────────────────────────────────

async function scheduleDailyQuoteNotifications(
  localBatch: LocalNotificationSchema[],
  alarmBatch: AlarmNotification[],
  ids: number[]
): Promise<void> {
  const now = new Date();
  for (let i = 0; i < 30; i++) {
    const fireDate = setTime(startOfDay(addDays(now, i)), 9, 0);
    if (fireDate <= now) continue;
    const quote = getQuoteForDayOffset(i, now);
    const dateKey = startOfDay(addDays(now, i)).toISOString();
    const id = stringToHash("dawa_daily_quote_" + dateKey);
    localBatch.push({
      id,
      title: "🌟 Daily Health Quote",
      body: quote,
      schedule: { at: fireDate, allowWhileIdle: true },
      channelId: soundService.getChannelIdForCategory("quotes"),
      sound: soundService.getCapacitorSound("quotes"),
      extra: { type: "daily_quote", route: "/", soundName: soundService.getAndroidResourceForCategory("quotes") },
    });
    alarmBatch.push({
      id,
      title: "🌟 Daily Health Quote",
      body: quote,
      triggerAtMillis: fireDate.getTime(),
      extra: JSON.stringify({ type: "daily_quote" }),
    });
    ids.push(id);
  }
}

// ─── 2. Post-Dose Encouragement ───────────────────────────────────────────────

export async function schedulePostDoseEncouragementNotification(medicineName: string): Promise<void> {
  const quote = getEncouragementQuote();

  // 1. Deliver visual in-app toast notification immediately
  notify.success(`💊 ${medicineName} — Logged!`, quote);

  // 2. Schedule persistent background notification
  if (!Capacitor.isNativePlatform()) return;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return;
    await createEngagementChannels();
    const fireAt = new Date(Date.now() + 1000);
    const id = stringToHash("dawa_encouragement_" + medicineName + fireAt.getTime().toString());
    await LocalNotifications.schedule({
      notifications: [{
        id,
        title: `💊 ${medicineName} — Logged!`,
        body: quote,
        schedule: { at: fireAt, allowWhileIdle: true },
        channelId: soundService.getChannelIdForCategory("taken"),
        sound: soundService.getCapacitorSound("taken"),
        extra: { type: "encouragement", route: "/", soundName: soundService.getAndroidResourceForCategory("taken") }
      }]
    });
    try {
      await NativeAlarm.scheduleAlarms({
        notifications: [{
          id,
          title: `💊 ${medicineName} — Logged!`,
          body: quote,
          triggerAtMillis: fireAt.getTime(),
          extra: JSON.stringify({ type: "encouragement" })
        }]
      });
    } catch (e) {
      console.warn("[quotesService] NativeAlarm encouragement failed (non-fatal):", e);
    }
  } catch (err) {
    console.warn("[quotesService] schedulePostDoseEncouragementNotification failed:", err);
  }
}

// ─── 3. Evening Check-In ─────────────────────────────────────────────────────

/**
 * Returns a calendar-day rotating evening check-in quote.
 * Seamlessly cycles across 50 unique messages so evening reminders never feel repetitive.
 */
export function getEveningCheckInQuote(date: Date = new Date()): string {
  if (!EVENING_CHECKIN_MESSAGES || EVENING_CHECKIN_MESSAGES.length === 0) {
    return "🌙 Have you logged all your medications today? A quick check keeps your health on track.";
  }
  const d = new Date(date);
  const localDayUtc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const dayOffset = Math.round((localDayUtc - ANCHOR_UTC) / 86400000);
  const index = ((dayOffset % EVENING_CHECKIN_MESSAGES.length) + EVENING_CHECKIN_MESSAGES.length) % EVENING_CHECKIN_MESSAGES.length;
  return EVENING_CHECKIN_MESSAGES[index] ?? EVENING_CHECKIN_MESSAGES[0];
}

async function scheduleEveningCheckIns(
  reminders: Reminder[],
  localBatch: LocalNotificationSchema[],
  alarmBatch: AlarmNotification[],
  ids: number[]
): Promise<void> {
  if (!reminders.some((r) => r.enabled)) return;
  const now = new Date();
  for (let i = 0; i < 30; i++) {
    const fireDate = setTime(startOfDay(addDays(now, i)), 20, 0);
    if (fireDate <= now) continue;
    const dateKey = startOfDay(addDays(now, i)).toISOString();
    const id = stringToHash("dawa_evening_checkin_" + dateKey);
    const body = getEveningCheckInQuote(fireDate);
    localBatch.push({ id, title: "🌙 Evening Check-In", body, schedule: { at: fireDate, allowWhileIdle: true }, channelId: soundService.getChannelIdForCategory("quotes"), sound: soundService.getCapacitorSound("quotes"), extra: { type: "evening_checkin", route: "/", soundName: soundService.getAndroidResourceForCategory("quotes") } });
    alarmBatch.push({ id, title: "🌙 Evening Check-In", body, triggerAtMillis: fireDate.getTime(), extra: JSON.stringify({ type: "evening_checkin" }) });
    ids.push(id);
  }
}

// ─── 4. Hydration Reminders ──────────────────────────────────────────────────

/**
 * Computes a deterministic, non-repeating hydration quote based on calendar date
 * and daily time slot. Guarantees that all 6 hydration reminders per day are completely
 * distinct and loops across 120+ unique quotes over 20 consecutive days before wrapping.
 */
export function getHydrationQuote(date: Date = new Date(), hourSlotIndex: number = 0): string {
  if (!HYDRATION_MESSAGES || HYDRATION_MESSAGES.length === 0) {
    return "💧 Time to hydrate! A glass of water now keeps fatigue away.";
  }
  const d = new Date(date);
  const localDayUtc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const dayOffset = Math.round((localDayUtc - ANCHOR_UTC) / 86400000);
  const slot = dayOffset * 6 + hourSlotIndex;
  const index = ((slot % HYDRATION_MESSAGES.length) + HYDRATION_MESSAGES.length) % HYDRATION_MESSAGES.length;
  return HYDRATION_MESSAGES[index] ?? HYDRATION_MESSAGES[0];
}

export async function scheduleHydrationReminders(
  localBatch: LocalNotificationSchema[],
  alarmBatch: AlarmNotification[],
  ids: number[]
): Promise<void> {
  const now = new Date();
  const hydrationHours = [8, 10, 12, 14, 16, 18];
  for (let i = 0; i < 7; i++) {
    for (let hIdx = 0; hIdx < hydrationHours.length; hIdx++) {
      const hour = hydrationHours[hIdx];
      const fireDate = setTime(startOfDay(addDays(now, i)), hour, 0);
      if (fireDate <= now) continue;
      const dateKey = `${startOfDay(addDays(now, i)).toISOString()}_${hour}`;
      const id = stringToHash("dawa_hydration_" + dateKey);
      const body = getHydrationQuote(fireDate, hIdx);
      localBatch.push({ id, title: "💧 Hydration Reminder", body, schedule: { at: fireDate, allowWhileIdle: true }, channelId: soundService.getChannelIdForCategory("hydration"), sound: soundService.getCapacitorSound("hydration"), extra: { type: "hydration", route: "/", soundName: soundService.getAndroidResourceForCategory("hydration") } });
      alarmBatch.push({ id, title: "💧 Hydration Reminder", body, triggerAtMillis: fireDate.getTime(), extra: JSON.stringify({ type: "hydration" }) });
      ids.push(id);
    }
  }
}

// ─── 4b. Expanded Daily Health & Wellness Reminders ──────────────────────────

/**
 * Returns a calendar-day rotating movement and posture stretch quote.
 */
export function getMovementQuote(date: Date = new Date()): string {
  if (!MOVEMENT_MESSAGES || MOVEMENT_MESSAGES.length === 0) {
    return "🚶 Time to move! Stand up, stretch, and get your blood circulating.";
  }
  const d = new Date(date);
  const localDayUtc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const dayOffset = Math.round((localDayUtc - ANCHOR_UTC) / 86400000);
  const index = ((dayOffset % MOVEMENT_MESSAGES.length) + MOVEMENT_MESSAGES.length) % MOVEMENT_MESSAGES.length;
  return MOVEMENT_MESSAGES[index] ?? MOVEMENT_MESSAGES[0];
}

/**
 * Returns a calendar-day rotating mindful breath and stress reset quote.
 */
export function getMindfulnessQuote(date: Date = new Date()): string {
  if (!MINDFULNESS_MESSAGES || MINDFULNESS_MESSAGES.length === 0) {
    return "🧘 Mindful pause: Close your eyes, drop your shoulders, and take three deep breaths.";
  }
  const d = new Date(date);
  const localDayUtc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const dayOffset = Math.round((localDayUtc - ANCHOR_UTC) / 86400000);
  const index = ((dayOffset % MINDFULNESS_MESSAGES.length) + MINDFULNESS_MESSAGES.length) % MINDFULNESS_MESSAGES.length;
  return MINDFULNESS_MESSAGES[index] ?? MINDFULNESS_MESSAGES[0];
}

/**
 * Returns a calendar-day rotating balanced nutrition & meal fueling quote.
 */
export function getNutritionQuote(date: Date = new Date()): string {
  if (!NUTRITION_MESSAGES || NUTRITION_MESSAGES.length === 0) {
    return "🥗 Fuel your body: Nourish your cells with wholesome, colorful foods today.";
  }
  const d = new Date(date);
  const localDayUtc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const dayOffset = Math.round((localDayUtc - ANCHOR_UTC) / 86400000);
  const index = ((dayOffset % NUTRITION_MESSAGES.length) + NUTRITION_MESSAGES.length) % NUTRITION_MESSAGES.length;
  return NUTRITION_MESSAGES[index] ?? NUTRITION_MESSAGES[0];
}

/**
 * Returns a calendar-day rotating 20-20-20 eye rest & screen break quote.
 */
export function getEyeRestQuote(date: Date = new Date()): string {
  if (!EYE_REST_MESSAGES || EYE_REST_MESSAGES.length === 0) {
    return "👁️ 20-20-20 Eye break: Look 20 feet away for 20 seconds to ease digital eye strain.";
  }
  const d = new Date(date);
  const localDayUtc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const dayOffset = Math.round((localDayUtc - ANCHOR_UTC) / 86400000);
  const index = ((dayOffset % EYE_REST_MESSAGES.length) + EYE_REST_MESSAGES.length) % EYE_REST_MESSAGES.length;
  return EYE_REST_MESSAGES[index] ?? EYE_REST_MESSAGES[0];
}

/**
 * Returns a calendar-day rotating sunlight and fresh air reset quote.
 */
export function getOutdoorResetQuote(date: Date = new Date()): string {
  if (!OUTDOOR_RESET_MESSAGES || OUTDOOR_RESET_MESSAGES.length === 0) {
    return "☀️ Daylight pause: Step outside or open a window for fresh air and natural sunlight.";
  }
  const d = new Date(date);
  const localDayUtc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const dayOffset = Math.round((localDayUtc - ANCHOR_UTC) / 86400000);
  const index = ((dayOffset % OUTDOOR_RESET_MESSAGES.length) + OUTDOOR_RESET_MESSAGES.length) % OUTDOOR_RESET_MESSAGES.length;
  return OUTDOOR_RESET_MESSAGES[index] ?? OUTDOOR_RESET_MESSAGES[0];
}

/**
 * Returns a calendar-day rotating wind-down and sleep hygiene quote.
 */
export function getWindDownQuote(date: Date = new Date()): string {
  if (!WIND_DOWN_MESSAGES || WIND_DOWN_MESSAGES.length === 0) {
    return "🌙 Wind-down time: Dim screens, relax your muscles, and prepare for restorative sleep.";
  }
  const d = new Date(date);
  const localDayUtc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const dayOffset = Math.round((localDayUtc - ANCHOR_UTC) / 86400000);
  const index = ((dayOffset % WIND_DOWN_MESSAGES.length) + WIND_DOWN_MESSAGES.length) % WIND_DOWN_MESSAGES.length;
  return WIND_DOWN_MESSAGES[index] ?? WIND_DOWN_MESSAGES[0];
}

/**
 * Schedules rich, holistic daily health & wellness reminders across 7 days.
 * Instead of only sending hydration reminders, this scheduler rotates across:
 * - 08:00: Morning Hydration & Wake-Up (type: "hydration")
 * - 10:00: Posture & Movement Break / Daylight Pause (type: "movement" | "outdoor_reset")
 * - 12:00: Balanced Fuel & Nutrition Pause (type: "nutrition")
 * - 14:00: 20-20-20 Eye Rest Break (type: "eye_rest")
 * - 16:00: Mindful Breath & Stress Reset (type: "mindfulness")
 * - 18:00: Evening Hydration / Posture & Movement Break (type: "hydration" | "movement")
 * - 21:30: Wind-Down & Sleep Preparation (type: "wind_down")
 */
export async function scheduleDailyWellnessReminders(
  localBatch: LocalNotificationSchema[],
  alarmBatch: AlarmNotification[],
  ids: number[]
): Promise<void> {
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const dayStart = startOfDay(addDays(now, i));
    const dayIndex = i;

    const slots = [
      {
        hour: 8,
        minute: 0,
        type: "hydration",
        title: "💧 Morning Hydration",
        getBody: (d: Date) => getHydrationQuote(d, 0),
        channel: soundService.getChannelIdForCategory("hydration"),
        sound: soundService.getCapacitorSound("hydration"),
        soundRes: soundService.getAndroidResourceForCategory("hydration"),
        route: "/",
      },
      {
        hour: 10,
        minute: 0,
        type: dayIndex % 2 === 0 ? "movement" : "outdoor_reset",
        title: dayIndex % 2 === 0 ? "🚶 Posture & Movement Break" : "☀️ Daylight & Fresh Air Pause",
        getBody: (d: Date) => (dayIndex % 2 === 0 ? getMovementQuote(d) : getOutdoorResetQuote(d)),
        channel: soundService.getChannelIdForCategory("quotes"),
        sound: soundService.getCapacitorSound("quotes"),
        soundRes: soundService.getAndroidResourceForCategory("quotes"),
        route: "/wellness",
      },
      {
        hour: 12,
        minute: 0,
        type: "nutrition",
        title: "🥗 Balanced Fuel & Nutrition",
        getBody: (d: Date) => getNutritionQuote(d),
        channel: soundService.getChannelIdForCategory("quotes"),
        sound: soundService.getCapacitorSound("quotes"),
        soundRes: soundService.getAndroidResourceForCategory("quotes"),
        route: "/wellness",
      },
      {
        hour: 14,
        minute: 0,
        type: "eye_rest",
        title: "👁️ 20-20-20 Eye Rest Break",
        getBody: (d: Date) => getEyeRestQuote(d),
        channel: soundService.getChannelIdForCategory("quotes"),
        sound: soundService.getCapacitorSound("quotes"),
        soundRes: soundService.getAndroidResourceForCategory("quotes"),
        route: "/wellness",
      },
      {
        hour: 16,
        minute: 0,
        type: "mindfulness",
        title: "🧘 Mindful Breath & Stress Reset",
        getBody: (d: Date) => getMindfulnessQuote(d),
        channel: soundService.getChannelIdForCategory("quotes"),
        sound: soundService.getCapacitorSound("quotes"),
        soundRes: soundService.getAndroidResourceForCategory("quotes"),
        route: "/wellness",
      },
      {
        hour: 18,
        minute: 0,
        type: dayIndex % 2 === 0 ? "hydration" : "movement",
        title: dayIndex % 2 === 0 ? "💧 Evening Hydration" : "🚶 Movement & Posture Break",
        getBody: (d: Date) => (dayIndex % 2 === 0 ? getHydrationQuote(d, 5) : getMovementQuote(d)),
        channel: dayIndex % 2 === 0 ? soundService.getChannelIdForCategory("hydration") : soundService.getChannelIdForCategory("quotes"),
        sound: dayIndex % 2 === 0 ? soundService.getCapacitorSound("hydration") : soundService.getCapacitorSound("quotes"),
        soundRes: dayIndex % 2 === 0 ? soundService.getAndroidResourceForCategory("hydration") : soundService.getAndroidResourceForCategory("quotes"),
        route: dayIndex % 2 === 0 ? "/" : "/wellness",
      },
      {
        hour: 21,
        minute: 30,
        type: "wind_down",
        title: "🌙 Wind-Down & Sleep Preparation",
        getBody: (d: Date) => getWindDownQuote(d),
        channel: soundService.getChannelIdForCategory("quotes"),
        sound: soundService.getCapacitorSound("quotes"),
        soundRes: soundService.getAndroidResourceForCategory("quotes"),
        route: "/wellness",
      },
    ];

    for (const slot of slots) {
      const fireDate = setTime(dayStart, slot.hour, slot.minute);
      if (fireDate <= now) continue;
      const dateKey = `${dayStart.toISOString()}_${slot.hour}_${slot.minute}_${slot.type}`;
      const id = stringToHash("dawa_wellness_" + dateKey);
      const body = slot.getBody(fireDate);

      localBatch.push({
        id,
        title: slot.title,
        body,
        schedule: { at: fireDate, allowWhileIdle: true },
        channelId: slot.channel,
        sound: slot.sound,
        extra: {
          type: slot.type,
          route: slot.route,
          soundName: slot.soundRes,
        },
      });

      alarmBatch.push({
        id,
        title: slot.title,
        body,
        triggerAtMillis: fireDate.getTime(),
        extra: JSON.stringify({ type: slot.type, route: slot.route }),
      });

      ids.push(id);
    }
  }
}

// ─── 5. Weekly Adherence Summary ─────────────────────────────────────────────

/**
 * Returns a weekly adherence summary quote that rotates across 24 distinct messages.
 */
export function getWeeklySummaryQuote(weekOffset: number = 0, date: Date = new Date()): string {
  if (!WEEKLY_SUMMARY_MESSAGES || WEEKLY_SUMMARY_MESSAGES.length === 0) {
    return "📊 How did you do with your medications this week? Tap to see your adherence report and keep up the momentum!";
  }
  const d = new Date(date);
  const localDayUtc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const weekIndex = Math.floor(localDayUtc / (86400000 * 7)) + weekOffset;
  const index = ((weekIndex % WEEKLY_SUMMARY_MESSAGES.length) + WEEKLY_SUMMARY_MESSAGES.length) % WEEKLY_SUMMARY_MESSAGES.length;
  return WEEKLY_SUMMARY_MESSAGES[index] ?? WEEKLY_SUMMARY_MESSAGES[0];
}

async function scheduleWeeklyAdherenceSummary(
  localBatch: LocalNotificationSchema[],
  alarmBatch: AlarmNotification[],
  ids: number[]
): Promise<void> {
  const now = new Date();
  let daysUntilSunday = (7 - getDay(now)) % 7;
  if (daysUntilSunday === 0) daysUntilSunday = 7;
  for (let week = 0; week < 8; week++) {
    const fireDate = setTime(startOfDay(addDays(now, daysUntilSunday + week * 7)), 20, 0);
    if (fireDate <= now) continue;
    const dateKey = startOfDay(addDays(now, daysUntilSunday + week * 7)).toISOString();
    const id = stringToHash("dawa_weekly_summary_" + dateKey);
    const body = getWeeklySummaryQuote(week, fireDate);
    localBatch.push({ id, title: "📊 Your Weekly Health Summary", body, schedule: { at: fireDate, allowWhileIdle: true }, channelId: soundService.getChannelIdForCategory("quotes"), sound: soundService.getCapacitorSound("quotes"), extra: { type: "weekly_summary", route: "/history", soundName: soundService.getAndroidResourceForCategory("quotes") } });
    alarmBatch.push({ id, title: "📊 Your Weekly Health Summary", body, triggerAtMillis: fireDate.getTime(), extra: JSON.stringify({ type: "weekly_summary" }) });
    ids.push(id);
  }
}

// ─── 6. Streak Notifications ─────────────────────────────────────────────────

export function computeCurrentStreak(doseLogs: DoseLog[], reminders: Reminder[]): number {
  const activeReminders = reminders.filter((r) => r.enabled && !r.patientId);
  if (activeReminders.length === 0) return 0;
  const today = startOfDay(new Date());
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const dayStart = startOfDay(subDays(today, i));
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const allTaken = activeReminders.every((r) =>
      doseLogs.some((log) => log.reminderId === r.id && log.action === "taken" && isAfter(parseISO(log.actionTime), dayStart) && !isAfter(parseISO(log.actionTime), dayEnd))
    );
    if (!allTaken) { if (i > 0) break; } else { streak++; }
  }
  return streak;
}

export async function scheduleStreakNotification(streak: number): Promise<void> {
  const MILESTONES = [3, 7, 14, 30, 60, 90, 180, 365];
  if (!MILESTONES.includes(streak)) return;
  const todayKey = new Date().toDateString();
  const dedupeKey = `dawa_streak_${streak}_${todayKey}`;
  if (localStorage.getItem(dedupeKey)) return;

  const streakMessages: Record<number, string> = {
    3: `🔥 3-Day Streak! You have taken every dose for 3 days in a row. Keep the momentum going!`,
    7: `🔥 7-Day Streak! One full week of perfect medication adherence. You are on fire!`,
    14: `🏆 2-Week Streak! 14 days of consistent medication. This is incredible dedication!`,
    30: `🌟 30-Day Streak! A full month of perfect adherence! You are a health champion!`,
    60: `💎 60-Day Streak! Two months of consistent medication — extraordinary commitment!`,
    90: `👑 90-Day Streak! 3 months of perfect adherence. You are a legend!`,
    180: `🚀 180-Day Streak! Half a year of consistent health management. Phenomenal!`,
    365: `🎉 365-Day Streak! One full year of perfect adherence — you are an inspiration!`,
  };
  const body = streakMessages[streak] ?? `🔥 ${streak}-Day Streak! Amazing consistency with your medication!`;

  // Visual in-app toast
  notify.success(`🔥 ${streak}-Day Medication Streak!`, body);
  localStorage.setItem(dedupeKey, "1");

  if (!Capacitor.isNativePlatform()) return;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return;
    await createEngagementChannels();
    const fireAt = new Date(Date.now() + 1000);
    const id = stringToHash("dawa_streak_notif_" + streak + "_" + todayKey);
    await LocalNotifications.schedule({
      notifications: [{
        id,
        title: `🔥 ${streak}-Day Medication Streak!`,
        body,
        schedule: { at: fireAt, allowWhileIdle: true },
        channelId: soundService.getChannelIdForCategory("taken"),
        sound: soundService.getCapacitorSound("taken"),
        extra: { type: "streak", streak, route: "/history", soundName: soundService.getAndroidResourceForCategory("taken") }
      }]
    });
    try {
      await NativeAlarm.scheduleAlarms({
        notifications: [{
          id,
          title: `🔥 ${streak}-Day Medication Streak!`,
          body,
          triggerAtMillis: fireAt.getTime(),
          extra: JSON.stringify({ type: "streak", streak })
        }]
      });
    } catch (e) {
      console.warn("[quotesService] NativeAlarm streak failed (non-fatal):", e);
    }
  } catch (err) {
    console.warn("[quotesService] scheduleStreakNotification failed:", err);
  }
}

// ─── 7. Wellness Log Nudge ───────────────────────────────────────────────────

/**
 * Returns a calendar-day rotating wellness nudge message.
 */
export function getWellnessNudgeQuote(date: Date = new Date()): string {
  if (!WELLNESS_NUDGE_MESSAGES || WELLNESS_NUDGE_MESSAGES.length === 0) {
    return "🩺 It has been a few days since your last wellness log. How are you feeling? Log a symptom or mood update to stay on top of your health.";
  }
  const d = new Date(date);
  const localDayUtc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const dayOffset = Math.round((localDayUtc - ANCHOR_UTC) / 86400000);
  const index = ((dayOffset % WELLNESS_NUDGE_MESSAGES.length) + WELLNESS_NUDGE_MESSAGES.length) % WELLNESS_NUDGE_MESSAGES.length;
  return WELLNESS_NUDGE_MESSAGES[index] ?? WELLNESS_NUDGE_MESSAGES[0];
}

async function scheduleWellnessNudge(wellnessLogs: WellnessLog[]): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const todayKey = new Date().toDateString();
  const dedupeKey = `dawa_wellness_nudge_${todayKey}`;
  if (localStorage.getItem(dedupeKey)) return;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return;
    const hasRecentLog = wellnessLogs.some((log) => isAfter(parseISO(log.timestamp), subDays(new Date(), 3)));
    if (hasRecentLog) return;
    await createEngagementChannels();
    const fireAt = new Date(Date.now() + 2000);
    const id = stringToHash("dawa_wellness_nudge_" + todayKey);
    const body = getWellnessNudgeQuote(fireAt);
    await LocalNotifications.schedule({ notifications: [{ id, title: "🩺 Wellness Check-In", body, schedule: { at: fireDateSafe(fireAt), allowWhileIdle: true }, channelId: soundService.getChannelIdForCategory("quotes"), sound: soundService.getCapacitorSound("quotes"), extra: { type: "wellness_nudge", route: "/wellness", soundName: soundService.getAndroidResourceForCategory("quotes") } }] });
    try { await NativeAlarm.scheduleAlarms({ notifications: [{ id, title: "🩺 Wellness Check-In", body, triggerAtMillis: fireAt.getTime(), extra: JSON.stringify({ type: "wellness_nudge" }) }] }); }
    catch (e) { console.warn("[quotesService] NativeAlarm wellness nudge failed (non-fatal):", e); }
    localStorage.setItem(dedupeKey, "1");
  } catch (err) { console.warn("[quotesService] scheduleWellnessNudge failed:", err); }
}

function fireDateSafe(d: Date): Date {
  return d;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function scheduleEngagementNotifications(
  doseLogs: DoseLog[],
  reminders: Reminder[],
  wellnessLogs: WellnessLog[]
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return;
    await createEngagementChannels();
    await cancelPreviousEngagementNotifs();
    const localBatch: LocalNotificationSchema[] = [];
    const alarmBatch: AlarmNotification[] = [];
    const ids: number[] = [];
    await scheduleDailyQuoteNotifications(localBatch, alarmBatch, ids);
    await scheduleEveningCheckIns(reminders, localBatch, alarmBatch, ids);
    await scheduleDailyWellnessReminders(localBatch, alarmBatch, ids);
    await scheduleWeeklyAdherenceSummary(localBatch, alarmBatch, ids);
    await scheduleNotif(localBatch, alarmBatch);
    saveEngagementIds(ids);
    await scheduleWellnessNudge(wellnessLogs);
    console.log(`[quotesService] Scheduled ${localBatch.length} engagement notifications + ${alarmBatch.length} native alarms.`);
  } catch (err) { console.warn("[quotesService] scheduleEngagementNotifications failed:", err); }
}
