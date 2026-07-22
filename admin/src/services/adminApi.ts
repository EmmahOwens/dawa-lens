import { getAdminToken } from '../hooks/useAdminAuth';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAdminToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface ApiResponse<T> { status: string; data: T }

// ── Stats ─────────────────────────────────────────────────────────────────────
export const api = {
  stats: {
    overview: () => request<ApiResponse<import('../types').OverviewStats>>('/admin/stats/overview'),
    growth: (days = 30) => request<ApiResponse<import('../types').GrowthPoint[]>>(`/admin/stats/growth?days=${days}`),
    adherenceTrend: (days = 30) => request<ApiResponse<import('../types').AdherencePoint[]>>(`/admin/stats/adherence-trend?days=${days}`),
  },

  // ── Users ───────────────────────────────────────────────────────────────────
  users: {
    list: (page = 1, search = '') =>
      request<ApiResponse<import('../types').AdminUser[]> & { pagination: Record<string, number> }>(
        `/admin/users?page=${page}&search=${encodeURIComponent(search)}`
      ),
    get: (uid: string) => request<ApiResponse<import('../types').AdminUser>>(`/admin/users/${uid}`),
    update: (uid: string, data: { disabled: boolean }) =>
      request<ApiResponse<void>>(`/admin/users/${uid}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (uid: string) =>
      request<ApiResponse<void>>(`/admin/users/${uid}`, { method: 'DELETE' }),
  },

  // ── Dose Logs ────────────────────────────────────────────────────────────────
  doseLogs: {
    aggregate: (days = 30) =>
      request<ApiResponse<{
        heatmap: import('../types').HeatmapCell[];
        breakdown: import('../types').DoseBreakdown;
        adherenceRate: number;
        periodDays: number;
      }>>(`/admin/dose-logs/aggregate?days=${days}`),
  },

  // ── Medications ──────────────────────────────────────────────────────────────
  medications: {
    top: () =>
      request<ApiResponse<{
        topMedications: import('../types').TopMedication[];
        categoryBreakdown: import('../types').CategoryBreakdown[];
        totalTracked: number;
      }>>('/admin/medications/top'),
  },

  // ── System ───────────────────────────────────────────────────────────────────
  system: {
    health: () => request<ApiResponse<{ api: string; firestoreLatencyMs: number; timestamp: string }>>('/admin/system/health'),
    auditLog: (limit = 50) => request<ApiResponse<import('../types').AuditEntry[]>>(`/admin/system/audit-log?limit=${limit}`),
  },

  // ── Notifications ────────────────────────────────────────────────────────────
  notifications: {
    broadcast: (data: import('../types').NotificationBroadcast) =>
      request<ApiResponse<{ successCount: number; failureCount: number; totalTargeted: number }>>(
        '/admin/notifications/broadcast', { method: 'POST', body: JSON.stringify(data) }
      ),
    history: () => request<ApiResponse<import('../types').AuditEntry[]>>('/admin/notifications/history'),
  },

  // ── Exports (browser download) ────────────────────────────────────────────────
  export: {
    usersCSV: async () => {
      const token = await getAdminToken();
      const res = await fetch(`${BASE}/admin/export/users.csv`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'dawa-lens-users.csv'; a.click();
      URL.revokeObjectURL(url);
    },
    adherenceCSV: async (days = 30) => {
      const token = await getAdminToken();
      const res = await fetch(`${BASE}/admin/export/adherence.csv?days=${days}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'dawa-lens-adherence.csv'; a.click();
      URL.revokeObjectURL(url);
    },
    reportPDF: async () => {
      const token = await getAdminToken();
      const res = await fetch(`${BASE}/admin/export/report.pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'dawa-lens-report.pdf'; a.click();
      URL.revokeObjectURL(url);
    },
  },
};
