import { useEffect, useState } from 'react';
import { Pill } from 'lucide-react';
import { AdminBarChart } from '../components/charts/BarChart';
import { AdminPieChart } from '../components/charts/PieChart';
import { api } from '../services/adminApi';

export function Medications() {
  const [data, setData] = useState<{ topMedications: { name: string; count: number }[]; categoryBreakdown: { category: string; count: number }[]; totalTracked: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.medications.top().then(r => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const barData = (data?.topMedications || []).slice(0, 15).map(m => ({ name: m.name, count: m.count }));
  const pieData = (data?.categoryBreakdown || []).slice(0, 6).map(c => ({ name: c.category, value: c.count }));

  return (
    <div className="page-enter space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Medication Analytics</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {data ? `${data.totalTracked.toLocaleString()} total medications tracked across all users` : 'Loading…'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4" style={{ height: 'calc(100vh - 200px)' }}>
        {/* Top medications - horizontal bar */}
        <div className="col-span-2 admin-card flex flex-col min-h-0">
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <Pill size={14} className="text-primary" />
            <h3 className="text-sm font-semibold">Top 15 Most Tracked Medications</h3>
          </div>
          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
            ) : (
              <AdminBarChart data={barData} xKey="name" yKey="count" label="Users" horizontal />
            )}
          </div>
        </div>

        {/* Category breakdown pie */}
        <div className="admin-card flex flex-col min-h-0">
          <h3 className="text-sm font-semibold mb-4 shrink-0">By Category</h3>
          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
            ) : pieData.length > 0 ? (
              <AdminPieChart data={pieData} />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No categories found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
