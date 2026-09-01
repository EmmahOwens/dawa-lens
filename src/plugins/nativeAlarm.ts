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

export interface DeviceOemInfo {
  manufacturer: string;
  brand: string;
  model: string;
  isTranssion: boolean;
  isXiaomi: boolean;
  isSamsung: boolean;
  isHuawei: boolean;
  isOppoRealme: boolean;
  isOnePlus: boolean;
  isVivo: boolean;
  isAsus: boolean;
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
  /** Returns whether the OS is currently ignoring battery optimizations for this app. */
  isBatteryOptimizationIgnored(): Promise<{ ignored: boolean }>;
  /** Request exemption from battery optimization to ensure alarms are reliable. */
  requestIgnoreBatteryOptimization(): Promise<void>;
  /** Directly open system battery optimization / app battery restriction settings. */
  openBatteryOptimizationSettings(): Promise<void>;
  /** Directly open OEM-specific Autostart settings screen (Xiaomi, Tecno, Oppo, Vivo, etc.). */
  openAutostartSettings(): Promise<void>;
  /** Check if exact alarm scheduling is allowed by the OS (Android 12+). */
  canScheduleExactAlarms(): Promise<{ canSchedule: boolean }>;
  /** Open exact alarm system permission settings (Android 12+). */
  openExactAlarmSettings(): Promise<void>;
  /** Returns comprehensive system permission statuses for offline notification resilience. */
  checkAllPermissions(): Promise<{
    batteryIgnored: boolean;
    exactAlarmCanSchedule: boolean;
    notificationsEnabled: boolean;
    isFullyCompliant: boolean;
  }>;
  /** Returns detailed hardware manufacturer and OEM brand profiling. */
  getDeviceOemInfo?(): Promise<DeviceOemInfo>;
  /** Starts the persistent foreground adherence guardian service. */
  startGuardianService?(): Promise<{ running: boolean }>;
  /** Stops the persistent foreground adherence guardian service. */
  stopGuardianService?(): Promise<{ running: boolean }>;
  /** Returns whether the adherence guardian service is currently running. */
  isGuardianServiceRunning?(): Promise<{ running: boolean }>;
  /** Opens the system App Details / App Info screen directly. */
  openAppInfoSettings?(): Promise<void>;
}

const NativeAlarm = registerPlugin<NativeAlarmPlugin>('NativeAlarm');

export { NativeAlarm };

