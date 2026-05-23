/**
 * NativeAlarm — Capacitor plugin bridge for OS-level alarm scheduling.
 *
 * Android: AlarmManager.setExactAndAllowWhileIdle — fires even in Doze mode.
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
  /** Cancel every alarm previously registered through this plugin. */
  cancelAllAlarms(): Promise<void>;
  /** Returns whether native alarm scheduling is available on this platform. */
  isSupported(): Promise<{ supported: boolean }>;
}

const NativeAlarm = registerPlugin<NativeAlarmPlugin>('NativeAlarm');

export { NativeAlarm };
