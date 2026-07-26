import { useEffect, useState } from 'react';
import { Pill, BarChart3 } from '../lib/icons';
import { AdminBarChart } from '../components/charts/BarChart';
import { AdminPieChart } from '../components/charts/PieChart';
import { api } from '../services/adminApi';
import { toast } from 'sonner';

export function Medications() {
  const [data, setData] = useState<{
    topMedications: { name: string; count: number }[];
    categoryBreakdown: { category: string; count: number }[];
    totalTracked: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.medications.top()
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => { toast.error('Failed to load medication data'); setLoading(false); });
  }, []);

  const barData = (data?.topMedications || []).slice(0, 15).map(m => ({ name: m.name, count: m.count }));
  const pieData = (data?.categoryBreakdown || []).slice(0, 6).map(c => ({ name: c.category, value: c.count }));

  return (
    <div className="page-enter flex flex-col gap-4 h-full">

      {/* Page header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-warning/15 flex items-center justify-center shadow-inner">
            <Pill size={18} className="text-warning" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground leading-tight">Medication Analytics</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {loading ? 'Loading medication data…' : `${(data?.totalTracked ?? 0).toLocaleString()} medications tracked across all users`}
            </p>
          </div>
        </div>
      </div>

      {/* Quick summary strip */}
      <div className="grid grid-cols-3 gap-3 shrink-0">
        {[
          {
            label: 'Total Tracked',
            value: loading ? '—' : (data?.totalTracked ?? 0).toLocaleString(),
            color: 'text-warning',
            bg: 'bg-warning/10',
          },
          {
            label: 'Unique Medications',
            value: loading ? '—' : (data?.topMedications?.length ?? 0).toLocaleString(),
            color: 'text-primary',
            bg: 'bg-primary/10',
          },
          {
            label: 'Categories',
            value: loading ? '—' : (data?.categoryBreakdown?.length ?? 0).toLocaleString(),
            color: 'text-violet-400',
            bg: 'bg-violet-500/10',
          },
        ].map(s => (
          <div key={s.label} className="admin-card admin-card-hover flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.bg}`}>
              <Pill size={14} className={s.color} />
            </div>
            <div>
              <p className={`text-xl font-bold tabular-nums leading-none ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
        {/* Top medications - bar chart */}
        <div className="col-span-2 admin-card flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 size={14} className="text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Top 15 Most Tracked Medications</h3>
          </div>
          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="flex items-end justify-center gap-2 h-full pb-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="skeleton flex-1 rounded-t" style={{ height: `${30 + Math.random() * 60}%` }} />
                ))}
              </div>
            ) : (
              <AdminBarChart data={barData} xKey="name" yKey="count" label="Users" horizontal />
            )}
          </div>
        </div>

        {/* Category breakdown */}
        <div className="admin-card flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Pill size={14} className="text-violet-400" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">By Category</h3>
          </div>
          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-28 h-28 rounded-full skeleton" />
              </div>
            ) : pieData.length > 0 ? (
              <AdminPieChart data={pieData} />
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-muted-foreground">No categories found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
