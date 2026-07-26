import { useState, useEffect } from 'react';
import { Bell, Send, Users, Clock, CheckCircle, AlertCircle } from '../lib/icons';
import { api } from '../services/adminApi';
import type { AuditEntry } from '../types';
import { timeAgo } from '../lib/utils';
import { toast } from 'sonner';

const SEGMENTS = [
  { value: 'all',         label: 'All Users',          description: 'Send to all registered users', color: 'border-primary/40 bg-primary/5' },
  { value: 'inactive_7d', label: 'Inactive 7+ Days',   description: "Users who haven't been active in over a week", color: 'border-warning/40 bg-warning/5' },
  { value: 'inactive_30d', label: 'Inactive 30+ Days', description: "Users who haven't been active in over a month", color: 'border-destructive/40 bg-destructive/5' },
] as const;

export function Notifications() {
  const [title, setTitle]   = useState('');
  const [body, setBody]     = useState('');
  const [segment, setSegment] = useState<'all' | 'inactive_7d' | 'inactive_30d'>('all');
  const [sending, setSending] = useState(false);
  const [result, setResult]   = useState<{ successCount: number; failureCount: number; totalTargeted: number } | null>(null);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    api.notifications.history().then(r => setHistory(r.data)).catch(() => {});
  }, []);

  const handleSend = async () => {
    setConfirmOpen(false);
    setSending(true);
    setResult(null);
    try {
      const r = await api.notifications.broadcast({ title, body, segment });
      setResult(r.data);
      toast.success(`Sent to ${r.data.successCount} users`);
      setTitle(''); setBody('');
      api.notifications.history().then(hist => setHistory(hist.data)).catch(() => {});
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const selectedSegment = SEGMENTS.find(s => s.value === segment)!;

  return (
    <div className="page-enter flex flex-col gap-4 h-full">

      {/* Page header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shadow-inner">
            <Bell size={18} className="text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground leading-tight">Notifications</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Broadcast push notifications to user segments via FCM</p>
          </div>
        </div>
        {history.length > 0 && (
          <span className="badge badge-muted">
            <Clock size={9} /> {history.length} sent
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
        {/* Compose panel */}
        <div className="admin-card flex flex-col gap-4 overflow-y-auto thin-scroll">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bell size={13} className="text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Compose Notification</h3>
          </div>

          {/* Target Segment */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target Segment</label>
            <div className="space-y-2">
              {SEGMENTS.map(s => (
                <label
                  key={s.value}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all duration-150 ${
                    segment === s.value
                      ? s.color
                      : 'border-border/50 hover:border-border bg-secondary/30'
                  }`}
                >
                  <input
                    type="radio" name="segment" value={s.value}
                    checked={segment === s.value}
                    onChange={() => setSegment(s.value)}
                    className="mt-0.5 accent-primary shrink-0"
                  />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{s.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{s.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notification Title</label>
            <input
              id="notif-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Time to take your medication!"
              maxLength={100}
              className="w-full px-3.5 py-2.5 text-sm bg-secondary/60 border border-border/60 rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
            />
            <p className="text-[10px] text-muted-foreground text-right">{title.length}/100</p>
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Message Body</label>
            <textarea
              id="notif-body"
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="e.g. Don't forget to log your dose in Dawa Lens."
              maxLength={256}
              rows={3}
              className="w-full px-3.5 py-2.5 text-sm bg-secondary/60 border border-border/60 rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all resize-none"
            />
            <p className="text-[10px] text-muted-foreground text-right">{body.length}/256</p>
          </div>

          <button
            id="notif-send-btn"
            onClick={() => setConfirmOpen(true)}
            disabled={!title.trim() || !body.trim() || sending}
            className="w-full py-3 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
          >
            {sending
              ? <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending…</>
              : <><Send size={14} /> Send Notification</>
            }
          </button>

          {/* Result */}
          {result && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-success/10 border border-success/25 animate-fade-in">
              <CheckCircle size={16} className="text-success shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-success">Broadcast sent successfully</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {result.successCount} delivered · {result.failureCount} failed · {result.totalTargeted} targeted
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Preview + History */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* Phone preview */}
          <div className="admin-card shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bell size={13} className="text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Preview</h3>
              <span className="text-[10px] text-muted-foreground ml-auto bg-secondary border border-border/60 px-2 py-0.5 rounded-full">
                {selectedSegment.label}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-secondary/60 border border-border/50">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shrink-0 shadow-lg shadow-primary/30">
                  <Bell size={15} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-foreground truncate">{title || 'Notification Title'}</p>
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">now</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                    {body || 'Your message body will appear here.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* History */}
          <div className="admin-card flex flex-col flex-1 min-h-0">
            <div className="flex items-center gap-2 mb-4 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
                <Clock size={13} className="text-muted-foreground" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Recent Broadcasts</h3>
              {history.length > 0 && (
                <span className="badge badge-muted ml-auto">{history.length}</span>
              )}
            </div>
            <div className="overflow-y-auto thin-scroll flex-1 space-y-2">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-24 gap-2">
                  <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center">
                    <Bell size={14} className="text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">No notifications sent yet</p>
                </div>
              ) : history.map(entry => (
                <div key={entry.id} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 border border-border/40 hover:border-border/70 transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Users size={11} className="text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {(entry.metadata?.title as string) || 'Broadcast'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {timeAgo(entry.timestamp)} · {(entry.metadata?.successCount as number) ?? 0} delivered
                    </p>
                  </div>
                  <CheckCircle size={12} className="text-success shrink-0 mt-1" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Confirm dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-80 admin-card shadow-2xl border-border/60 space-y-4 fade-up-enter">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-warning/15 flex items-center justify-center">
                <AlertCircle size={16} className="text-warning" />
              </div>
              <h3 className="text-sm font-bold text-foreground">Confirm Broadcast</h3>
            </div>
            <div className="p-3 rounded-xl bg-secondary/60 border border-border/40 space-y-1">
              <p className="text-xs text-muted-foreground">Sending <strong className="text-foreground">"{title}"</strong></p>
              <p className="text-xs text-muted-foreground">To: <strong className="text-foreground">{selectedSegment.label}</strong></p>
            </div>
            <p className="text-[11px] text-muted-foreground">This action cannot be undone. All targeted users will receive a push notification.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-medium border border-border/60 text-muted-foreground hover:bg-secondary/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
              >
                Send Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
