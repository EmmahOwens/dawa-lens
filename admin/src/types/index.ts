export interface OverviewStats {
  users: { total: number; newToday: number; newThisWeek: number };
  medications: { total: number; activeReminders: number };
  adherence: { rate: number; taken: number; missed: number; skipped: number; total: number };
}

export interface GrowthPoint {
  date: string;
  count: number;
}

export interface AdherencePoint {
  date: string;
  rate: number | null;
  taken: number;
  total: number;
}

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  disabled: boolean;
  createdAt: string;
  lastSignIn: string;
  emailVerified: boolean;
  customClaims: Record<string, unknown>;
  medicineCount?: number;
  lastActivity?: string | null;
}

export interface HeatmapCell {
  day: string;
  dayIndex: number;
  hour: number;
  count: number;
}

export interface DoseBreakdown {
  taken: number;
  missed: number;
  skipped: number;
  total: number;
}

export interface TopMedication {
  name: string;
  count: number;
}

export interface CategoryBreakdown {
  category: string;
  count: number;
}

export interface AuditEntry {
  id: string;
  adminUid: string;
  action: string;
  targetUid: string | null;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface FeedEvent {
  id: string;
  type: 'dose_taken' | 'dose_missed' | 'dose_skipped' | 'scan' | 'ai_chat' | 'new_user';
  userId: string;
  medicineName?: string;
  status?: string;
  createdAt: string;
  label: string;
}

export interface NotificationBroadcast {
  title: string;
  body: string;
  segment: 'all' | 'inactive_7d' | 'inactive_30d';
}
