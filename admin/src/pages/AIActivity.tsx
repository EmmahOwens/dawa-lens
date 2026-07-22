import { Bot, Scan, MessageSquare, TrendingUp } from 'lucide-react';

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

import { AdminBarChart } from '../components/charts/BarChart';

export function AIActivity() {
  return (
    <div className="page-enter space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">AI Activity</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Pill scan and Dawa-GPT usage analytics</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Scans (30d)', value: '1,240', icon: Scan, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Success Rate', value: '87%', icon: TrendingUp, color: 'text-success', bg: 'bg-success/10' },
          { label: 'GPT Conversations', value: '3,891', icon: MessageSquare, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { label: 'Avg Response (ms)', value: '1,240', icon: Bot, color: 'text-warning', bg: 'bg-warning/10' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="admin-card admin-card-hover flex flex-col gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
              <Icon size={18} className={color} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4" style={{ height: 'calc(100vh - 340px)' }}>
        <div className="admin-card flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <Scan size={14} className="text-primary" />
            <h3 className="text-sm font-semibold">Daily Scan Volume (14 days)</h3>
          </div>
          <div className="flex-1 min-h-0">
            <AdminBarChart data={MOCK_SCAN_DATA} xKey="date" yKey="scans" label="Scans" />
          </div>
        </div>

        <div className="admin-card flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <TrendingUp size={14} className="text-success" />
            <h3 className="text-sm font-semibold">Successful Identifications (14 days)</h3>
          </div>
          <div className="flex-1 min-h-0">
            <AdminBarChart data={MOCK_SCAN_DATA} xKey="date" yKey="success" color="hsl(142 71% 45%)" label="Success" />
          </div>
        </div>
      </div>

      {/* Note */}
      <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 text-xs text-primary">
        💡 <strong>Note:</strong> Real-time AI usage metrics require adding server-side usage logging to the Express AI routes. 
        The charts above show illustrative data. Connect them to <code>/api/v1/admin/ai-usage</code> once logging is implemented.
      </div>
    </div>
  );
}
