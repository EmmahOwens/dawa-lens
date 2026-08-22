/**
 * NativeAlarm — Capacitor plugin bridge for OS-level alarm scheduling.
 *
 * Android: AlarmManager.setAlarmClock — fires even in Doze mode and offline.
 *          Alarms are persisted to SharedPreferences and re-registered on
 *          device reboot via a BootReceiver + WorkManager.
 * iOS:     UNUserNotificationCenter — accurate calendar-based triggers.
 */
import { registerPlugin } from '@capacitor/core';

export interface AlarmNotification {
  /** Unique numeric ID. Must be stable across reschedule calls. */
  id: number;
  /** Notification title shown in the system tray. */
  title: string;
  /** Notification body text. */
  body: string;
  /** Unix timestamp in milliseconds when the alarm should fire. */
  triggerAtMillis: number;
  /** Optional JSON string payload passed back in notification extras. */
  extra?: string;
}

export interface NativeAlarmPlugin {
  /** Schedule (or reschedule) a full set of alarms in one call. */
  scheduleAlarms(options: { notifications: AlarmNotification[] }): Promise<void>;
  /** Cancel alarms. If remindersOnly is true, preserves short-term event alarms. */
  cancelAllAlarms(options?: { remindersOnly?: boolean }): Promise<void>;
  /** Cancel only recurring reminder alarms, preserving event and milestone alarms. */
  cancelReminderAlarms?(): Promise<void>;
  /** Returns whether native alarm scheduling is available on this platform. */
  isSupported(): Promise<{ supported: boolean }>;
  /** Request exemption from battery optimization to ensure alarms are reliable. */
  requestIgnoreBatteryOptimization(): Promise<void>;
  /** Directly open system battery optimization / app battery restriction settings. */
  openBatteryOptimizationSettings(): Promise<void>;
  /** Directly open OEM-specific Autostart settings screen (Xiaomi, Tecno, Oppo, Vivo, etc.). */
  openAutostartSettings(): Promise<void>;
  /** Returns whether battery optimizations are currently being ignored for this app. */
  isBatteryOptimizationIgnored(): Promise<{ ignored: boolean }>;
}

const NativeAlarm = registerPlugin<NativeAlarmPlugin>('NativeAlarm');

export { NativeAlarm };
