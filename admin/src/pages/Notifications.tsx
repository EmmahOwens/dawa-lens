import { useState, useEffect } from 'react';
import { Bell, Send, Users, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../services/adminApi';
import type { AuditEntry } from '../types';
import { timeAgo } from '../lib/utils';
import { toast } from 'sonner';

const SEGMENTS = [
  { value: 'all', label: 'All Users', description: 'Send to all registered users' },
  { value: 'inactive_7d', label: 'Inactive 7+ Days', description: 'Users who haven\'t been active in over a week' },
  { value: 'inactive_30d', label: 'Inactive 30+ Days', description: 'Users who haven\'t been active in over a month' },
] as const;

export function Notifications() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [segment, setSegment] = useState<'all' | 'inactive_7d' | 'inactive_30d'>('all');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ successCount: number; failureCount: number; totalTargeted: number } | null>(null);
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
      // Refresh history
      api.notifications.history().then(r => setHistory(r.data)).catch(() => {});
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const selectedSegment = SEGMENTS.find(s => s.value === segment)!;

  return (
    <div className="page-enter space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Send push notifications to user segments via FCM</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Compose */}
        <div className="admin-card space-y-4">
          <div className="flex items-center gap-2">
            <Bell size={14} className="text-primary" />
            <h3 className="text-sm font-semibold">Compose Notification</h3>
          </div>

          {/* Segment */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Target Segment</label>
            <div className="space-y-2">
              {SEGMENTS.map(s => (
                <label key={s.value} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${segment === s.value ? 'border-primary/40 bg-primary/5' : 'border-border/50 hover:border-border'}`}>
                  <input type="radio" name="segment" value={s.value} checked={segment === s.value}
                    onChange={() => setSegment(s.value)} className="mt-0.5 accent-primary" />
                  <div>
                    <p className="text-xs font-medium text-foreground">{s.label}</p>
                    <p className="text-[10px] text-muted-foreground">{s.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Notification Title</label>
            <input
              id="notif-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Time to take your medication!"
              maxLength={100}
              className="w-full px-3 py-2.5 text-sm bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Message Body</label>
            <textarea
              id="notif-body"
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="e.g. Don't forget to log your dose in Dawa Lens."
              maxLength={256}
              rows={3}
              className="w-full px-3 py-2.5 text-sm bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all resize-none"
            />
            <p className="text-[10px] text-muted-foreground text-right">{body.length}/256</p>
          </div>

          <button
            id="notif-send-btn"
            onClick={() => setConfirmOpen(true)}
            disabled={!title.trim() || !body.trim() || sending}
            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {sending ? <><span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending…</> : <><Send size={13} /> Send Notification</>}
          </button>

          {/* Result */}
          {result && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-success/10 border border-success/25">
              <CheckCircle size={14} className="text-success shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-success">Sent successfully</p>
                <p className="text-muted-foreground mt-0.5">
                  ✅ {result.successCount} delivered · ❌ {result.failureCount} failed · {result.totalTargeted} targeted
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Preview + History */}
        <div className="space-y-4">
          {/* Preview */}
          <div className="admin-card">
            <h3 className="text-sm font-semibold mb-4">Preview</h3>
            <div className="p-4 rounded-2xl bg-secondary border border-border/50">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                  <Bell size={14} className="text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{title || 'Notification Title'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{body || 'Your message body will appear here.'}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <Users size={10} className="text-muted-foreground/60" />
                    <p className="text-[10px] text-muted-foreground/60">{selectedSegment.label}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* History */}
          <div className="admin-card flex-1">
            <h3 className="text-sm font-semibold mb-4">Recent Broadcasts</h3>
            <div className="space-y-2">
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No notifications sent yet</p>
              ) : history.map(entry => (
                <div key={entry.id} className="flex items-start gap-2.5 p-3 rounded-xl bg-secondary/40 border border-border/40">
                  <Clock size={12} className="text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {(entry.metadata?.title as string) || 'Broadcast'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {timeAgo(entry.timestamp)} · {(entry.metadata?.successCount as number) ?? 0} delivered
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Confirm dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-80 admin-card shadow-2xl border-border/60 space-y-4 animate-fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-warning" />
              <h3 className="text-sm font-semibold">Confirm Broadcast</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Send "<strong className="text-foreground">{title}</strong>" to <strong className="text-foreground">{selectedSegment.label}</strong>?
              This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmOpen(false)} className="flex-1 py-2 rounded-xl text-xs font-medium border border-border/60 text-muted-foreground hover:bg-secondary/80">Cancel</button>
              <button onClick={handleSend} className="flex-1 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary/90">Send Now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
