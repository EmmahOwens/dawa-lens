import { useEffect, useState } from 'react';
import { Server, CheckCircle, AlertCircle, Clock, RefreshCw } from '../lib/icons';
import { api } from '../services/adminApi';
import type { AuditEntry } from '../types';
import { timeAgo } from '../lib/utils';

const ACTION_COLORS: Record<string, { text: string; badge: string }> = {
  DELETE_USER:             { text: 'text-destructive', badge: 'badge-destructive' },
  SUSPEND_USER:            { text: 'text-warning',     badge: 'badge-warning'     },
  UNSUSPEND_USER:          { text: 'text-success',     badge: 'badge-success'     },
  BROADCAST_NOTIFICATION:  { text: 'text-primary',     badge: 'badge-primary'     },
};

export function SystemHealth() {
  const [health, setHealth]       = useState<{ api: string; firestoreLatencyMs: number; timestamp: string } | null>(null);
  const [auditLog, setAuditLog]   = useState<AuditEntry[]>([]);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [loadingLog, setLoadingLog]       = useState(true);
  const [refreshing, setRefreshing]       = useState(false);

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
  const latencyColor = !health ? 'text-muted-foreground'
    : health.firestoreLatencyMs < 100 ? 'text-success'
    : health.firestoreLatencyMs < 300 ? 'text-warning'
    : 'text-destructive';

  return (
    <div className="page-enter flex flex-col gap-4 h-full">

      {/* Page header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shadow-inner">
            <Server size={18} className="text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground leading-tight">System Health</h2>
            <p className="text-xs text-muted-foreground mt-0.5">API status, Firestore latency, and admin audit trail</p>
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-secondary border border-border/60 text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all disabled:opacity-60"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Health cards */}
      <div className="grid grid-cols-3 gap-3 shrink-0">
        {/* API status */}
        <div className={`admin-card admin-card-hover flex items-center gap-4 relative overflow-hidden ${
          loadingHealth ? '' : isHealthy
            ? 'border-success/25 bg-success/5'
            : 'border-destructive/25 bg-destructive/5'
        }`}>
          <div className={`absolute -top-4 -right-4 w-16 h-16 rounded-full blur-2xl opacity-20 pointer-events-none ${isHealthy ? 'bg-success' : 'bg-destructive'}`} />
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isHealthy ? 'bg-success/15' : 'bg-destructive/15'}`}>
            {isHealthy
              ? <CheckCircle size={22} className="text-success" />
              : <AlertCircle size={22} className="text-destructive" />
            }
          </div>
          <div>
            {loadingHealth
              ? <div className="skeleton h-6 w-20 rounded mb-1" />
              : <p className={`text-lg font-bold ${isHealthy ? 'text-success' : 'text-destructive'}`}>
                  {isHealthy ? 'Healthy' : 'Degraded'}
                </p>
            }
            <p className="text-xs text-muted-foreground">API Status</p>
          </div>
        </div>

        {/* Firestore latency */}
        <div className="admin-card admin-card-hover flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Clock size={22} className="text-primary" />
          </div>
          <div>
            {loadingHealth
              ? <div className="skeleton h-6 w-16 rounded mb-1" />
              : <p className={`text-lg font-bold tabular-nums ${latencyColor}`}>
                  {health ? `${health.firestoreLatencyMs}ms` : '—'}
                </p>
            }
            <p className="text-xs text-muted-foreground">Firestore Latency</p>
          </div>
        </div>

        {/* Last checked */}
        <div className="admin-card admin-card-hover flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center shrink-0">
            <Server size={22} className="text-muted-foreground" />
          </div>
          <div>
            {loadingHealth
              ? <div className="skeleton h-6 w-24 rounded mb-1" />
              : <p className="text-sm font-bold text-foreground">
                  {health ? new Date(health.timestamp).toLocaleTimeString() : '—'}
                </p>
            }
            <p className="text-xs text-muted-foreground">Last Checked</p>
          </div>
        </div>
      </div>

      {/* Audit log */}
      <div className="admin-card flex flex-col flex-1 min-h-0 p-0 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border/50 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Server size={13} className="text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Admin Audit Log</h3>
          {!loadingLog && (
            <span className="badge badge-muted ml-auto">{auditLog.length} entries</span>
          )}
        </div>
        <div className="overflow-x-auto overflow-y-auto thin-scroll flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border/40">
                {['Action', 'Target UID', 'Timestamp', 'Details'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingLog ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/20">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <td key={j} className="px-5 py-3.5"><div className="skeleton h-3.5 rounded" style={{ width: `${50 + j * 15}%` }} /></td>
                    ))}
                  </tr>
                ))
              ) : auditLog.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                        <Server size={16} className="text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">No admin actions recorded yet</p>
                    </div>
                  </td>
                </tr>
              ) : (
                auditLog.map(entry => {
                  const style = ACTION_COLORS[entry.action] || { text: 'text-foreground', badge: 'badge-muted' };
                  return (
                    <tr key={entry.id} className="border-b border-border/20 hover:bg-secondary/30 transition-colors">
                      <td className="px-5 py-3">
                        <span className={`badge ${style.badge} font-mono text-[10px]`}>{entry.action}</span>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground font-mono">
                        {entry.targetUid ? entry.targetUid.slice(0, 12) + '…' : '—'}
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(entry.timestamp)}</td>
                      <td className="px-5 py-3 text-xs text-muted-foreground truncate max-w-xs">
                        {JSON.stringify(entry.metadata || {}).slice(0, 60)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
