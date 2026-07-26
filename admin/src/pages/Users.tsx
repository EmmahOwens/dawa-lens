import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Download, UserX, UserCheck, Trash2, ChevronLeft, ChevronRight, X, Users as UsersIcon } from '../lib/icons';
import { api } from '../services/adminApi';
import type { AdminUser } from '../types';
import { timeAgo, adherenceBg } from '../lib/utils';
import { toast } from 'sonner';

function PageHeader({ total, onExport, exporting }: { total: number; onExport: () => void; exporting: boolean }) {
  return (
    <div className="flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shadow-inner">
          <UsersIcon size={18} className="text-primary" />
        </div>
        <div>
          <h2 className="text-base font-bold text-foreground leading-tight">User Management</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total > 0 ? `${total.toLocaleString()} total accounts registered` : 'Loading accounts…'}
          </p>
        </div>
      </div>
      <button
        id="users-export-btn"
        onClick={onExport}
        disabled={exporting}
        className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-secondary border border-border/60 text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all duration-150"
      >
        <Download size={13} />
        {exporting ? 'Exporting…' : 'Export CSV'}
      </button>
    </div>
  );
}

export function Users() {
  const [searchParams] = useSearchParams();
  const [users, setUsers]           = useState<AdminUser[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState(() => searchParams.get('search') || '');
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [confirming, setConfirming] = useState<{ type: 'delete' | 'suspend' | 'unsuspend'; uid: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [exporting, setExporting]   = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.users.list(page, search);
      setUsers(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotal(res.pagination.total);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { setPage(1); }, [search]);

  const handleAction = async () => {
    if (!confirming) return;
    setActionLoading(true);
    try {
      if (confirming.type === 'delete') {
        await api.users.delete(confirming.uid);
        toast.success('User deleted successfully');
      } else {
        await api.users.update(confirming.uid, { disabled: confirming.type === 'suspend' });
        toast.success(confirming.type === 'suspend' ? 'User suspended' : 'User unsuspended');
      }
      setConfirming(null);
      setSelectedUser(null);
      loadUsers();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try { await api.export.usersCSV(); toast.success('CSV downloaded'); }
    catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  return (
    <div className="page-enter flex flex-col gap-4 h-full">
      <PageHeader total={total} onExport={handleExport} exporting={exporting} />

      {/* Quick stats strip */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        {[
          { label: 'Total Accounts', value: total.toLocaleString(), color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Active', value: loading ? '—' : users.filter(u => !u.disabled).length.toString(), color: 'text-success', bg: 'bg-success/10' },
          { label: 'Suspended', value: loading ? '—' : users.filter(u => u.disabled).length.toString(), color: 'text-destructive', bg: 'bg-destructive/10' },
          { label: 'Verified', value: loading ? '—' : users.filter(u => u.emailVerified).length.toString(), color: 'text-warning', bg: 'bg-warning/10' },
        ].map(s => (
          <div key={s.label} className="admin-card admin-card-hover flex items-center gap-3 py-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.bg}`}>
              <span className={`text-sm font-bold ${s.color}`}>#</span>
            </div>
            <div>
              <p className={`text-xl font-bold tabular-nums leading-none ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search bar */}
      <div className="relative shrink-0">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          id="users-search"
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full pl-10 pr-4 py-2.5 text-sm bg-card border border-border/60 rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
            <X size={13} />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="admin-card p-0 overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="overflow-x-auto overflow-y-auto thin-scroll flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border/60">
                {['User', 'Email Verified', 'Status', 'Joined', 'Last Active', 'Meds', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="skeleton h-4 rounded" style={{ width: `${50 + j * 8}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                        <UsersIcon size={16} className="text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">No users found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr
                    key={user.uid}
                    onClick={() => setSelectedUser(user)}
                    className="border-b border-border/20 hover:bg-secondary/40 transition-colors cursor-pointer group"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shrink-0">
                          <span className="text-[11px] font-bold text-primary">
                            {(user.displayName || user.email || 'U')[0].toUpperCase()}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-foreground truncate max-w-[130px]">
                          {user.displayName || user.email?.split('@')[0] || 'Unknown'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${user.emailVerified ? 'badge-success' : 'badge-muted'}`}>
                        {user.emailVerified ? '✓ Verified' : 'Unverified'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${user.disabled ? 'badge-destructive' : 'badge-success'}`}>
                        {user.disabled ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(user.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(user.lastActivity)}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-foreground">{user.medicineCount ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          id={`user-suspend-${user.uid}`}
                          onClick={() => setConfirming({ type: user.disabled ? 'unsuspend' : 'suspend', uid: user.uid })}
                          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
                          title={user.disabled ? 'Unsuspend' : 'Suspend'}
                        >
                          {user.disabled ? <UserCheck size={13} /> : <UserX size={13} />}
                        </button>
                        <button
                          id={`user-delete-${user.uid}`}
                          onClick={() => setConfirming({ type: 'delete', uid: user.uid })}
                          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete user"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/40 shrink-0">
          <span className="text-xs text-muted-foreground">
            Page <span className="font-medium text-foreground">{page}</span> of <span className="font-medium text-foreground">{totalPages}</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary/80 disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary/80 disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* User detail slide-over */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedUser(null)} />
          <div className="w-80 bg-card border-l border-border/50 h-full overflow-y-auto thin-scroll p-6 space-y-5 animate-slide-in-right">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">User Details</h3>
              <button onClick={() => setSelectedUser(null)} className="w-7 h-7 rounded-lg hover:bg-secondary/80 text-muted-foreground flex items-center justify-center transition-colors">
                <X size={14} />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 border-2 border-primary/20 flex items-center justify-center">
                <span className="text-xl font-bold text-primary">
                  {(selectedUser.displayName || selectedUser.email || 'U')[0].toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{selectedUser.displayName || 'No name'}</p>
                <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
              </div>
            </div>
            <div className="space-y-0.5">
              {[
                ['UID', selectedUser.uid.slice(0, 16) + '…'],
                ['Status', selectedUser.disabled ? 'Suspended' : 'Active'],
                ['Email Verified', selectedUser.emailVerified ? 'Yes' : 'No'],
                ['Joined', timeAgo(selectedUser.createdAt)],
                ['Last Sign In', timeAgo(selectedUser.lastSignIn)],
                ['Medications', selectedUser.medicineCount?.toString() ?? '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between items-center py-2.5 border-b border-border/30">
                  <span className="text-[11px] text-muted-foreground">{k}</span>
                  <span className="text-[11px] font-semibold text-foreground">{v}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2 pt-1">
              <button
                onClick={() => { setSelectedUser(null); setConfirming({ type: selectedUser.disabled ? 'unsuspend' : 'suspend', uid: selectedUser.uid }); }}
                className="w-full py-2.5 rounded-xl text-xs font-semibold border border-border/60 hover:bg-secondary/80 text-foreground transition-colors"
              >
                {selectedUser.disabled ? 'Unsuspend User' : 'Suspend User'}
              </button>
              <button
                onClick={() => { setSelectedUser(null); setConfirming({ type: 'delete', uid: selectedUser.uid }); }}
                className="w-full py-2.5 rounded-xl text-xs font-semibold bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20 transition-colors"
              >
                Delete User + Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-80 admin-card shadow-2xl border-border/60 space-y-4 fade-up-enter">
            <h3 className="text-sm font-bold text-foreground">
              {confirming.type === 'delete' ? '⚠️ Delete User?' :
               confirming.type === 'suspend' ? 'Suspend User?' : 'Unsuspend User?'}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {confirming.type === 'delete'
                ? 'This will permanently delete the user account and ALL their data (medications, reminders, dose logs). This cannot be undone.'
                : confirming.type === 'suspend'
                ? 'The user will be unable to sign in until unsuspended.'
                : 'The user will regain full access to their account.'}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirming(null)} disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl text-xs font-medium border border-border/60 text-muted-foreground hover:bg-secondary/80 transition-colors">
                Cancel
              </button>
              <button onClick={handleAction} disabled={actionLoading}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-colors ${confirming.type === 'delete' ? 'bg-destructive text-white hover:bg-destructive/90' : 'bg-primary text-white hover:bg-primary/90'}`}>
                {actionLoading ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
