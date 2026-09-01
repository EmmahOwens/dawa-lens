/**
 * NativeAlarm — Capacitor plugin bridge for authoritative OS-level alarm scheduling.
 *
 * Android: NativeRecurrenceEngine sets a single exact next alarm per active reminder
 *          using AlarmManager.setExactAndAllowWhileIdle (with graceful degraded fallback
 *          to setAndAllowWhileIdle when exact alarm permission is absent).
 *          Alarms survive cold boot & Direct Boot via NativeRecurrenceStore in Device-Protected Storage.
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

export interface AuthoritativeReminderConfig {
  id: string;
  medicineName: string;
  dose: string;
  time: string;
  repeatSchedule: "daily" | "weekly" | "custom" | "once";
  repeatDays?: number[];
  enabled: boolean;
  createdAt?: number;
  patientId?: string | null;
  patientName?: string | null;
}

export interface ReadinessCheckResult {
  notificationsEnabled: boolean;
  channelBlocked: boolean;
  exactAlarmCanSchedule: boolean;
  batteryIgnored: boolean;
  status: "ready_exact" | "degraded_inexact" | "notifications_paused";
  isFullyCompliant: boolean;
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
  /** Authoritatively schedule active reminders: computes single next exact alarm and commits to Device-Protected storage. */
  scheduleAuthoritativeReminders(options: {
    reminders: AuthoritativeReminderConfig[];
  }): Promise<{
    success: boolean;
    exactGranted: boolean;
    degradedMode: boolean;
    scheduledCount: number;
  }>;

  /** Schedule one-off or milestone event notifications (refills, streaks, quotes). */
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

  /** Directly open Android Notification Settings for this app. */
  openNotificationSettings(): Promise<void>;

  /** Returns comprehensive system permission statuses for offline notification resilience. */
  checkAllPermissions(): Promise<ReadinessCheckResult>;

  /** Returns readiness evaluation: ready_exact, degraded_inexact, or notifications_paused. */
  checkReadiness(): Promise<ReadinessCheckResult>;

  /** Returns detailed hardware manufacturer and OEM brand profiling. */
  getDeviceOemInfo?(): Promise<DeviceOemInfo>;

  /** Optional adherence monitoring foreground service (user opt-in only). */
  startGuardianService?(): Promise<{ running: boolean }>;
  stopGuardianService?(): Promise<{ running: boolean }>;
  isGuardianServiceRunning?(): Promise<{ running: boolean }>;

  /** Opens the system App Details / App Info screen directly. */
  openAppInfoSettings?(): Promise<void>;
}

const NativeAlarm = registerPlugin<NativeAlarmPlugin>('NativeAlarm');

export { NativeAlarm };
