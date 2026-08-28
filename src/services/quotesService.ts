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
import { Capacitor } from "@capacitor/core";
import { DoseLog, Reminder, WellnessLog } from "@/contexts/AppContext";
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
} from "@/data/quotesData";

export {
  HEALTH_QUOTES,
  ENCOURAGEMENT_QUOTES,
  ADHERENCE_QUOTES,
  WELLNESS_QUOTES,
  MINDFULNESS_QUOTES,
  LIFESTYLE_QUOTES,
  INSPIRATION_QUOTES,
};

// ─── Channel IDs ────────────────────────────────────────────────────────────
export const CHANNEL_QUOTES    = "dawa_quotes_v2";
export const CHANNEL_WELLNESS  = "dawa_wellness_v2";
export const CHANNEL_HYDRATION = "dawa_hydration_v2";
export const CHANNEL_STREAKS   = "dawa_streaks_v2";

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
export async function createEngagementChannels(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (Capacitor.getPlatform() !== "android") return;
  try {
    await LocalNotifications.createChannel({ id: CHANNEL_QUOTES,    name: "Daily Health Quotes",       description: "Motivational health quotes to keep you inspired",   importance: 3, vibration: false, sound: "default" });
    await LocalNotifications.createChannel({ id: CHANNEL_WELLNESS,  name: "Wellness Reminders",        description: "Evening check-ins and wellness log nudges",         importance: 3, vibration: false, sound: "default" });
    await LocalNotifications.createChannel({ id: CHANNEL_HYDRATION, name: "Hydration Reminders",       description: "Stay hydrated throughout the day",                  importance: 2, vibration: false, sound: "default" });
    await LocalNotifications.createChannel({ id: CHANNEL_STREAKS,   name: "Achievements & Streaks",    description: "Celebrate your medication adherence milestones",    importance: 4, vibration: true,  sound: "default" });
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
  return HEALTH_QUOTES[index] ?? HEALTH_QUOTES[0] ?? "💊 Stay consistent with your health journey.";
}

export function getQuoteForDayOffset(dayOffset: number, baseDate: Date = new Date()): string {
  const targetDate = addDays(baseDate, dayOffset);
  return getDailyQuote(targetDate);
}

export function getEncouragementQuote(): string {
  if (!ENCOURAGEMENT_QUOTES || ENCOURAGEMENT_QUOTES.length === 0) {
    return "💊 Dose logged! Consistency is your superpower.";
  }
  const index = Math.floor(Math.random() * ENCOURAGEMENT_QUOTES.length);
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
      channelId: CHANNEL_QUOTES,
      sound: "default",
      extra: { type: "daily_quote", route: "/" },
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
        channelId: CHANNEL_QUOTES,
        sound: "default",
        extra: { type: "encouragement", route: "/" }
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
    const body = "Have you logged all your medications today? A quick check keeps your health on track.";
    localBatch.push({ id, title: "🌙 Evening Check-In", body, schedule: { at: fireDate, allowWhileIdle: true }, channelId: CHANNEL_WELLNESS, sound: "default", extra: { type: "evening_checkin", route: "/" } });
    alarmBatch.push({ id, title: "🌙 Evening Check-In", body, triggerAtMillis: fireDate.getTime(), extra: JSON.stringify({ type: "evening_checkin" }) });
    ids.push(id);
  }
}

// ─── 4. Hydration Reminders ──────────────────────────────────────────────────

const HYDRATION_MESSAGES: readonly string[] = [
  "💧 Time to hydrate! A glass of water now keeps fatigue away.",
  "💧 Drink up! Staying hydrated supports your medication and your health.",
  "💧 Water break! Hydration keeps your kidneys happy and your energy high.",
  "💧 Your body is about 60% water — keep it that way. Drink up!",
  "💧 Sip some water! It helps your medication absorb better.",
  "💧 Quick water break! Your brain and body both need it.",
  "💧 Stay hydrated! Even mild dehydration affects focus and mood.",
];

async function scheduleHydrationReminders(
  localBatch: LocalNotificationSchema[],
  alarmBatch: AlarmNotification[],
  ids: number[]
): Promise<void> {
  const now = new Date();
  const hydrationHours = [8, 10, 12, 14, 16, 18];
  for (let i = 0; i < 7; i++) {
    for (const hour of hydrationHours) {
      const fireDate = setTime(startOfDay(addDays(now, i)), hour, 0);
      if (fireDate <= now) continue;
      const dateKey = `${startOfDay(addDays(now, i)).toISOString()}_${hour}`;
      const id = stringToHash("dawa_hydration_" + dateKey);
      const body = HYDRATION_MESSAGES[Math.floor(Math.random() * HYDRATION_MESSAGES.length)] as string;
      localBatch.push({ id, title: "💧 Hydration Reminder", body, schedule: { at: fireDate, allowWhileIdle: true }, channelId: CHANNEL_HYDRATION, sound: "default", extra: { type: "hydration", route: "/" } });
      alarmBatch.push({ id, title: "💧 Hydration Reminder", body, triggerAtMillis: fireDate.getTime(), extra: JSON.stringify({ type: "hydration" }) });
      ids.push(id);
    }
  }
}

// ─── 5. Weekly Adherence Summary ─────────────────────────────────────────────

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
    const body = "How did you do with your medications this week? Tap to see your adherence report and keep up the momentum!";
    localBatch.push({ id, title: "📊 Your Weekly Health Summary", body, schedule: { at: fireDate, allowWhileIdle: true }, channelId: CHANNEL_QUOTES, sound: "default", extra: { type: "weekly_summary", route: "/history" } });
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
        channelId: CHANNEL_STREAKS,
        sound: "default",
        extra: { type: "streak", streak, route: "/history" }
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

export async function scheduleWellnessNudge(wellnessLogs: WellnessLog[]): Promise<void> {
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
    const body = "It has been a few days since your last wellness log. How are you feeling? Log a symptom or mood update to stay on top of your health.";
    await LocalNotifications.schedule({ notifications: [{ id, title: "\uD83E\uDE7A Wellness Check-In", body, schedule: { at: fireDateSafe(fireAt), allowWhileIdle: true }, channelId: CHANNEL_WELLNESS, sound: "default", extra: { type: "wellness_nudge", route: "/wellness" } }] });
    try { await NativeAlarm.scheduleAlarms({ notifications: [{ id, title: "\uD83E\uDE7A Wellness Check-In", body, triggerAtMillis: fireAt.getTime(), extra: JSON.stringify({ type: "wellness_nudge" }) }] }); }
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
    await scheduleHydrationReminders(localBatch, alarmBatch, ids);
    await scheduleWeeklyAdherenceSummary(localBatch, alarmBatch, ids);
    await scheduleNotif(localBatch, alarmBatch);
    saveEngagementIds(ids);
    await scheduleWellnessNudge(wellnessLogs);
    const streak = computeCurrentStreak(doseLogs, reminders);
    if (streak > 0) await scheduleStreakNotification(streak);
    console.log(`[quotesService] Scheduled ${localBatch.length} engagement notifications + ${alarmBatch.length} native alarms.`);
  } catch (err) { console.warn("[quotesService] scheduleEngagementNotifications failed:", err); }
}
