import { useState, useCallback, useEffect } from 'react';
import { Search, Download, UserX, UserCheck, Trash2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { api } from '../services/adminApi';
import type { AdminUser } from '../types';
import { timeAgo, adherenceBg } from '../lib/utils';
import { toast } from 'sonner';

export function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [confirming, setConfirming] = useState<{ type: 'delete' | 'suspend' | 'unsuspend'; uid: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  // Debounce search reset page
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
    <div className="page-enter space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">All Users</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{total.toLocaleString()} total accounts</p>
        </div>
        <button
          id="users-export-btn"
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border border-border/60 text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
        >
          <Download size={13} />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          id="users-search"
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-card border border-border/60 rounded-xl text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
        />
      </div>

      {/* Table */}
      <div className="admin-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                {['User', 'Email Verified', 'Status', 'Joined', 'Last Active', 'Meds', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-secondary/60 rounded animate-pulse" style={{ width: `${60 + j * 10}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">No users found</td></tr>
              ) : (
                users.map(user => (
                  <tr
                    key={user.uid}
                    onClick={() => setSelectedUser(user)}
                    className="border-b border-border/30 hover:bg-secondary/30 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-primary">
                            {(user.displayName || user.email || 'U')[0].toUpperCase()}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-foreground truncate max-w-[120px]">
                          {user.displayName || user.email?.split('@')[0] || 'Unknown'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${user.emailVerified ? 'text-success bg-success/10 border-success/25' : 'text-muted-foreground bg-secondary border-border'}`}>
                        {user.emailVerified ? 'Verified' : 'Unverified'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${user.disabled ? 'text-destructive bg-destructive/10 border-destructive/25' : 'text-success bg-success/10 border-success/25'}`}>
                        {user.disabled ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{timeAgo(user.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{timeAgo(user.lastActivity)}</td>
                    <td className="px-4 py-3 text-xs text-foreground font-medium">{user.medicineCount ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button
                          id={`user-suspend-${user.uid}`}
                          onClick={() => setConfirming({ type: user.disabled ? 'unsuspend' : 'suspend', uid: user.uid })}
                          className="p-1.5 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
                          title={user.disabled ? 'Unsuspend' : 'Suspend'}
                        >
                          {user.disabled ? <UserCheck size={13} /> : <UserX size={13} />}
                        </button>
                        <button
                          id={`user-delete-${user.uid}`}
                          onClick={() => setConfirming({ type: 'delete', uid: user.uid })}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
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
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/40">
          <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded-lg hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed text-muted-foreground transition-colors">
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded-lg hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed text-muted-foreground transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* User detail slide-over */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={() => setSelectedUser(null)} />
          <div className="w-80 bg-card border-l border-border/50 h-full overflow-y-auto p-6 space-y-5 animate-slide-in">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">User Details</h3>
              <button onClick={() => setSelectedUser(null)} className="p-1.5 rounded-lg hover:bg-secondary/80 text-muted-foreground">
                <X size={14} />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/15 border-2 border-primary/20 flex items-center justify-center">
                <span className="text-lg font-bold text-primary">
                  {(selectedUser.displayName || selectedUser.email || 'U')[0].toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{selectedUser.displayName || 'No name'}</p>
                <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
              </div>
            </div>
            {[
              ['UID', selectedUser.uid.slice(0, 16) + '…'],
              ['Status', selectedUser.disabled ? 'Suspended' : 'Active'],
              ['Email Verified', selectedUser.emailVerified ? 'Yes' : 'No'],
              ['Joined', timeAgo(selectedUser.createdAt)],
              ['Last Sign In', timeAgo(selectedUser.lastSignIn)],
              ['Medications', selectedUser.medicineCount?.toString() ?? '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between items-center py-2 border-b border-border/40">
                <span className="text-xs text-muted-foreground">{k}</span>
                <span className="text-xs font-medium text-foreground">{v}</span>
              </div>
            ))}
            <div className="space-y-2 pt-2">
              <button
                onClick={() => { setSelectedUser(null); setConfirming({ type: selectedUser.disabled ? 'unsuspend' : 'suspend', uid: selectedUser.uid }); }}
                className="w-full py-2 rounded-xl text-xs font-medium border border-border/60 hover:bg-secondary/80 text-foreground transition-colors"
              >
                {selectedUser.disabled ? 'Unsuspend User' : 'Suspend User'}
              </button>
              <button
                onClick={() => { setSelectedUser(null); setConfirming({ type: 'delete', uid: selectedUser.uid }); }}
                className="w-full py-2 rounded-xl text-xs font-medium bg-destructive/10 border border-destructive/25 text-destructive hover:bg-destructive/20 transition-colors"
              >
                Delete User + Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-80 admin-card shadow-2xl border-border/60 space-y-4 animate-fade-in">
            <h3 className="text-sm font-semibold text-foreground">
              {confirming.type === 'delete' ? 'Delete User?' :
               confirming.type === 'suspend' ? 'Suspend User?' : 'Unsuspend User?'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {confirming.type === 'delete'
                ? 'This will permanently delete the user account and ALL their data (medications, reminders, dose logs). This cannot be undone.'
                : confirming.type === 'suspend'
                ? 'The user will be unable to sign in until unsuspended.'
                : 'The user will regain full access to their account.'}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirming(null)} disabled={actionLoading}
                className="flex-1 py-2 rounded-xl text-xs font-medium border border-border/60 text-muted-foreground hover:bg-secondary/80 transition-colors">
                Cancel
              </button>
              <button onClick={handleAction} disabled={actionLoading}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${confirming.type === 'delete' ? 'bg-destructive text-white hover:bg-destructive/90' : 'bg-primary text-white hover:bg-primary/90'}`}>
                {actionLoading ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
