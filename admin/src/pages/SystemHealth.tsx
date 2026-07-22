import { useEffect, useState } from 'react';
import { Server, CheckCircle, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { api } from '../services/adminApi';
import type { AuditEntry } from '../types';
import { timeAgo } from '../lib/utils';

const ACTION_COLORS: Record<string, string> = {
  DELETE_USER: 'text-destructive',
  SUSPEND_USER: 'text-warning',
  UNSUSPEND_USER: 'text-success',
  BROADCAST_NOTIFICATION: 'text-primary',
};

export function SystemHealth() {
  const [health, setHealth] = useState<{ api: string; firestoreLatencyMs: number; timestamp: string } | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [loadingLog, setLoadingLog] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = async () => {
    setLoadingHealth(true);
    try { const r = await api.system.health(); setHealth(r.data); }
    catch { setHealth(null); }
    finally { setLoadingHealth(false); }
  };

  const fetchLog = async () => {
    setLoadingLog(true);
    try { const r = await api.system.auditLog(50); setAuditLog(r.data); }
    catch { setAuditLog([]); }
    finally { setLoadingLog(false); }
  };

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchHealth(), fetchLog()]);
    setRefreshing(false);
  };

  useEffect(() => { fetchHealth(); fetchLog(); }, []);

  const isHealthy = health?.api === 'healthy';

  return (
    <div className="page-enter space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">System Health</h2>
          <p className="text-xs text-muted-foreground mt-0.5">API status, Firestore latency, and admin audit trail</p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-border/60 text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Health cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`admin-card flex items-center gap-4 ${isHealthy ? 'border-success/25 bg-success/5' : 'border-destructive/25 bg-destructive/5'}`}>
          {isHealthy
            ? <CheckCircle size={22} className="text-success" />
            : <AlertCircle size={22} className="text-destructive" />}
          <div>
            <p className="text-sm font-bold text-foreground">{loadingHealth ? '…' : isHealthy ? 'Healthy' : 'Degraded'}</p>
            <p className="text-xs text-muted-foreground">API Status</p>
          </div>
        </div>

        <div className="admin-card flex items-center gap-4">
          <Clock size={22} className="text-primary" />
          <div>
            <p className="text-sm font-bold text-foreground">
              {loadingHealth ? '…' : health ? `${health.firestoreLatencyMs}ms` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Firestore Latency</p>
          </div>
        </div>

        <div className="admin-card flex items-center gap-4">
          <Server size={22} className="text-muted-foreground" />
          <div>
            <p className="text-sm font-bold text-foreground">
              {health ? new Date(health.timestamp).toLocaleTimeString() : '—'}
            </p>
            <p className="text-xs text-muted-foreground">Last Checked</p>
          </div>
        </div>
      </div>

      {/* Audit log */}
      <div className="admin-card">
        <h3 className="text-sm font-semibold mb-4">Admin Audit Log</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40">
                {['Action', 'Target UID', 'Timestamp', 'Details'].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingLog ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/20">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j} className="px-3 py-3"><div className="h-3 bg-secondary/60 rounded animate-pulse w-3/4" /></td>
                    ))}
                  </tr>
                ))
              ) : auditLog.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground text-xs">No admin actions recorded yet</td></tr>
              ) : (
                auditLog.map(entry => (
                  <tr key={entry.id} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                    <td className="px-3 py-2.5">
                      <span className={`text-xs font-semibold font-mono ${ACTION_COLORS[entry.action] || 'text-foreground'}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono">
                      {entry.targetUid ? entry.targetUid.slice(0, 12) + '…' : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{timeAgo(entry.timestamp)}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {JSON.stringify(entry.metadata || {}).slice(0, 60)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
