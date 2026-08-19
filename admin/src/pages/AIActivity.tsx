import { Bot, Scan, MessageSquare, TrendingUp, Activity } from '../lib/icons';
import { AdminBarChart } from '../components/charts/AdminBarChart';

// AI Activity page — shows placeholder charts since AI usage logging
// is tracked at the server level. This page is structured and ready
// to receive real data once server-side AI usage logging is added.

const MOCK_SCAN_DATA = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() - (13 - i));
  return {
    date: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
    scans: Math.floor(Math.random() * 40 + 5),
    success: Math.floor(Math.random() * 30 + 5),
    failed: Math.floor(Math.random() * 8),
  };
});

const KPI_CARDS = [
  { label: 'Total Scans (30d)', value: '1,240', icon: Scan, color: 'text-primary', bg: 'bg-primary/15', glow: 'bg-primary' },
  { label: 'Success Rate', value: '87%', icon: TrendingUp, color: 'text-success', bg: 'bg-success/15', glow: 'bg-success' },
  { label: 'GPT Conversations', value: '3,891', icon: MessageSquare, color: 'text-violet-400', bg: 'bg-violet-500/15', glow: 'bg-violet-500' },
  { label: 'Avg Response (ms)', value: '1,240', icon: Bot, color: 'text-warning', bg: 'bg-warning/15', glow: 'bg-warning' },
];

export function AIActivity() {
  return (
    <div className="page-enter flex flex-col gap-4 h-full">

      {/* Page header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center shadow-inner">
            <Bot size={18} className="text-violet-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground leading-tight">AI Activity</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Pill scan and DawaGPT usage analytics</p>
          </div>
        </div>
        <span className="badge badge-primary text-[10px] px-2.5 py-1 animate-pulse">
          <Activity size={9} /> Demo Data
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        {KPI_CARDS.map(({ label, value, icon: Icon, color, bg, glow }) => (
          <div key={label} className="admin-card admin-card-hover flex flex-col gap-3 relative overflow-hidden">
            <div className={`absolute -top-4 -right-4 w-16 h-16 rounded-full blur-2xl opacity-25 pointer-events-none ${glow}`} />
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner ${bg}`}>
              <Icon size={18} className={color} />
            </div>
            <div>
              <p className={`text-2xl font-bold tabular-nums leading-none ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
        <div className="admin-card flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Scan size={14} className="text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Daily Scan Volume</h3>
            <span className="text-xs text-muted-foreground ml-auto">14 days</span>
          </div>
          <div className="flex-1 min-h-0">
            <AdminBarChart data={MOCK_SCAN_DATA} xKey="date" yKey="scans" label="Scans" />
          </div>
        </div>

        <div className="admin-card flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center">
              <TrendingUp size={14} className="text-success" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Successful Identifications</h3>
            <span className="text-xs text-muted-foreground ml-auto">14 days</span>
          </div>
          <div className="flex-1 min-h-0">
            <AdminBarChart data={MOCK_SCAN_DATA} xKey="date" yKey="success" activeColor="hsl(142 71% 45%)" label="Success" />
          </div>
        </div>
      </div>

      {/* Info notice */}
      <div className="flex items-center gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5 shrink-0">
        <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
          <Bot size={12} className="text-primary" />
        </div>
        <p className="text-xs text-primary/90 leading-relaxed">
          <strong>Note:</strong> Real-time AI usage metrics require server-side usage logging in the Express AI routes.
          The charts above show illustrative data. Connect them to <code className="bg-primary/10 px-1 py-0.5 rounded text-[10px]">/api/v1/admin/ai-usage</code> once logging is implemented.
        </p>
      </div>
    </div>
  );
}
