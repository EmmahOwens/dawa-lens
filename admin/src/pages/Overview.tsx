import { useCallback } from 'react';
import { Users, Pill, CheckCircle, Bot, TrendingUp, Activity } from 'lucide-react';
import { StatCard } from '../components/ui/StatCard';
import { LiveFeed } from '../components/ui/LiveFeed';
import { LiveCounter } from '../components/ui/LiveCounter';
import { AdminAreaChart } from '../components/charts/AreaChart';
import { AdminLineChart } from '../components/charts/LineChart';
import { useRealtimeFeed, usePolledStats } from '../hooks/useRealtimeFeed';
import { api } from '../services/adminApi';
import { adherenceBg, formatNumber } from '../lib/utils';

export function Overview() {
  const { events, isConnected } = useRealtimeFeed(25);

  const fetchOverview = useCallback(() => api.stats.overview().then(r => r.data), []);
  const fetchGrowth = useCallback(() => api.stats.growth(30).then(r => r.data), []);
  const fetchAdherence = useCallback(() => api.stats.adherenceTrend(30).then(r => r.data), []);

  const { data: stats, isLoading: statsLoading } = usePolledStats(fetchOverview, 30_000);
  const { data: growthData } = usePolledStats(fetchGrowth, 120_000);
  const { data: adherenceData } = usePolledStats(fetchAdherence, 120_000);

  // Format x-axis dates to short form (Jul 21)
  const growth = (growthData || []).map(p => ({
    ...p,
    date: new Date(p.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
  }));

  const adherence = (adherenceData || []).map(p => ({
    ...p,
    date: new Date(p.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
  }));

  return (
    <div className="page-enter space-y-6 h-full">
      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Users"
          value={statsLoading ? '—' : <LiveCounter value={stats?.users.total ?? 0} />}
          sub={stats ? `+${stats.users.newToday} today · +${stats.users.newThisWeek} this week` : undefined}
          icon={<Users size={18} className="text-primary" />}
          iconBg="bg-primary/10"
          trend="up"
          trendLabel={stats ? `${stats.users.newThisWeek} this week` : ''}
        />
        <StatCard
          label="Medications Tracked"
          value={statsLoading ? '—' : <LiveCounter value={stats?.medications.total ?? 0} />}
          sub={stats ? `${formatNumber(stats.medications.activeReminders)} active reminders` : undefined}
          icon={<Pill size={18} className="text-warning" />}
          iconBg="bg-warning/10"
        />
        <StatCard
          label="Platform Adherence"
          value={statsLoading ? '—' : `${stats?.adherence.rate ?? 0}%`}
          sub={stats ? `${formatNumber(stats.adherence.taken)} doses taken (last 30d)` : undefined}
          icon={<CheckCircle size={18} className="text-success" />}
          iconBg="bg-success/10"
          className={stats ? adherenceBg(stats.adherence.rate) : ''}
        />
        <StatCard
          label="Live Events"
          value={<LiveCounter value={events.length} />}
          sub="Recent dose activity in feed"
          icon={<Activity size={18} className="text-purple-400" />}
          iconBg="bg-purple-500/10"
        />
      </div>

      {/* Main content: Charts (left 3/4) + Live feed (right 1/4) */}
      <div className="grid grid-cols-4 gap-4" style={{ height: 'calc(100vh - 280px)' }}>
        {/* Charts column */}
        <div className="col-span-3 flex flex-col gap-4 min-h-0">
          {/* Row 1: User Growth + Adherence Trend */}
          <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
            <div className="admin-card flex flex-col min-h-0">
              <div className="flex items-center gap-2 mb-4 shrink-0">
                <TrendingUp size={15} className="text-primary" />
                <h3 className="text-sm font-semibold text-foreground">User Growth</h3>
                <span className="text-xs text-muted-foreground ml-auto">30 days</span>
              </div>
              <div className="flex-1 min-h-0">
                <AdminAreaChart data={growth} xKey="date" yKey="count" label="New Users" />
              </div>
            </div>

            <div className="admin-card flex flex-col min-h-0">
              <div className="flex items-center gap-2 mb-4 shrink-0">
                <CheckCircle size={15} className="text-success" />
                <h3 className="text-sm font-semibold text-foreground">Adherence Trend</h3>
                <span className="text-xs text-muted-foreground ml-auto">30 days</span>
              </div>
              <div className="flex-1 min-h-0">
                <AdminLineChart
                  data={adherence} xKey="date" yKey="rate"
                  color="hsl(142 71% 45%)" label="Adherence" suffix="%" />
              </div>
            </div>
          </div>

          {/* Row 2: Quick stats summary bar */}
          <div className="admin-card shrink-0">
            <div className="grid grid-cols-4 divide-x divide-border/50">
              {[
                { label: 'Doses Taken (30d)', value: stats?.adherence.taken ?? '—', color: 'text-success' },
                { label: 'Doses Missed (30d)', value: stats?.adherence.missed ?? '—', color: 'text-destructive' },
                { label: 'Doses Skipped (30d)', value: stats?.adherence.skipped ?? '—', color: 'text-warning' },
                { label: 'Total Events (30d)', value: stats?.adherence.total ?? '—', color: 'text-foreground' },
              ].map(({ label, value, color }) => (
                <div key={label} className="px-6 py-3 text-center">
                  <p className={`text-lg font-bold tabular-nums ${color}`}>
                    {typeof value === 'number' ? value.toLocaleString() : value}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live feed column */}
        <div className="col-span-1 min-h-0">
          <LiveFeed events={events} isConnected={isConnected} />
        </div>
      </div>
    </div>
  );
}
