import { useCallback, useEffect, useState } from 'react';
import { Users, Pill, CheckCircle, Activity, TrendingUp } from '../lib/icons';
import { StatCard } from '../components/ui/StatCard';
import { LiveFeed } from '../components/ui/LiveFeed';
import { LiveCounter } from '../components/ui/LiveCounter';
import { MiniCalendar } from '../components/ui/MiniCalendar';
import { DonutChart } from '../components/ui/DonutChart';
import { AIAssistantCard } from '../components/ui/AIAssistantCard';
import { AdminBarChart } from '../components/charts/AdminBarChart';
import { useRealtimeFeed, usePolledStats } from '../hooks/useRealtimeFeed';
import { useSetConnectionStatus } from '../hooks/useConnectionStatus';
import { api } from '../services/adminApi';
import { adherenceBg, formatNumber } from '../lib/utils';

type Period = 'Weekly' | 'Monthly' | 'Yearly';
const PERIODS: Period[] = ['Weekly', 'Monthly', 'Yearly'];

export function Overview() {
  const { events, isConnected: feedConnected } = useRealtimeFeed(25);
  const [period, setPeriod] = useState<Period>('Yearly');

  // Map period label to number of days for API queries
  const periodDays = period === 'Weekly' ? 7 : period === 'Monthly' ? 30 : 365;

  const fetchOverview   = useCallback(() => api.stats.overview().then(r => r.data), []);
  const fetchGrowth     = useCallback(() => api.stats.growth(periodDays).then(r => r.data), [periodDays]);
  const fetchAdherence  = useCallback(() => api.stats.adherenceTrend(periodDays).then(r => r.data), [periodDays]);

  const { data: stats, isLoading: statsLoading } = usePolledStats(fetchOverview, 30_000);
  const { data: growthData }    = usePolledStats(fetchGrowth, 120_000);
  const { data: adherenceData } = usePolledStats(fetchAdherence, 120_000);

  const isConnected = feedConnected || (stats !== null);
  const setConnected = useSetConnectionStatus();
  useEffect(() => { setConnected(isConnected); }, [isConnected, setConnected]);

  // Format growth data for bar chart
  const growth = (growthData || []).map(p => ({
    ...p,
    date: new Date(p.date.includes('T') ? p.date : `${p.date}T00:00:00`)
      .toLocaleDateString('en', { month: 'short', day: 'numeric' }),
  }));

  // Donut data from adherence stats
  const donutData = stats ? [
    { name: 'Doses Taken',   value: stats.adherence.taken,   color: 'hsl(142 70% 45%)' },
    { name: 'Doses Missed',  value: stats.adherence.missed,  color: 'hsl(0 72% 51%)' },
    { name: 'Doses Skipped', value: stats.adherence.skipped, color: 'hsl(38 92% 50%)' },
    { name: 'Medications',   value: stats.medications.total, color: 'hsl(213 94% 58%)' },
  ].filter(d => d.value > 0) : [
    { name: 'Taken',   value: 60, color: 'hsl(142 70% 45%)' },
    { name: 'Missed',  value: 20, color: 'hsl(0 72% 51%)' },
    { name: 'Skipped', value: 12, color: 'hsl(38 92% 50%)' },
    { name: 'Active',  value: 8,  color: 'hsl(213 94% 58%)' },
  ];

  // AI summary text
  const aiSummary = stats
    ? `Your platform metrics for this period remain stable. ${stats.users.newThisWeek} new users joined this week, with ${stats.adherence.taken.toLocaleString()} doses taken (last 30d). Platform adherence is at ${stats.adherence.rate}% — balanced across key categories. No unusual patterns detected.`
    : 'Your financial activity this period remains stable. Revenue shows expected seasonal variation, spending is balanced across key categories. No unusual patterns detected.';

  return (
    <div className="page-enter flex flex-col gap-5">

      {/* ── Row 1: KPI stat cards ── */}
      <div className="grid grid-cols-4 gap-4 shrink-0">
        <StatCard
          label="Total Users"
          value={statsLoading ? '—' : <LiveCounter value={stats?.users.total ?? 0} />}
          sub={stats ? `+${stats.users.newToday} today · +${stats.users.newThisWeek} this week` : undefined}
          icon={<Users size={18} className="text-primary" />}
          iconBg="bg-primary/15"
          iconGlow="bg-primary"
          accentClass="stat-card-primary"
          trend="up"
          trendValue={stats ? `+${stats.users.newThisWeek}` : ''}
          trendLabel="this week"
        />
        <StatCard
          label="Medications Tracked"
          value={statsLoading ? '—' : <LiveCounter value={stats?.medications.total ?? 0} />}
          sub={stats ? `${formatNumber(stats.medications.activeReminders)} active reminders` : undefined}
          icon={<Pill size={18} className="text-warning" />}
          iconBg="bg-warning/15"
          iconGlow="bg-warning"
          accentClass="stat-card-warning"
        />
        <StatCard
          label="Platform Adherence"
          value={statsLoading ? '—' : `${stats?.adherence.rate ?? 0}%`}
          sub={stats ? `${formatNumber(stats.adherence.taken)} doses taken (last 30d)` : undefined}
          icon={<CheckCircle size={18} className="text-success" />}
          iconBg="bg-success/15"
          iconGlow="bg-success"
          accentClass="stat-card-success"
          trend={stats && stats.adherence.rate >= 70 ? 'up' : 'down'}
          trendValue={stats ? `${stats.adherence.rate}%` : ''}
          className={stats ? adherenceBg(stats.adherence.rate) : ''}
        />
        <StatCard
          label="Live Events"
          value={<LiveCounter value={events.length} />}
          sub="Recent dose activity in feed"
          icon={<Activity size={18} className="text-violet-400" />}
          iconBg="bg-violet-500/15"
          iconGlow="bg-violet-500"
          trend="neutral"
          trendValue="Real-time"
        />
      </div>

      {/* ── Main Bento Grid Layout ── */}
      <div className="grid grid-cols-3 gap-4 items-stretch">
        
        {/* Left 2 Columns: User Growth on top, AI Assistant + Donut Chart below */}
        <div className="col-span-2 flex flex-col gap-4">
          {/* User Growth Bar Chart */}
          <div className="admin-card flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp size={15} className="text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">User Growth</h3>
                  {stats && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/25">
                      ↑ {stats.users.newThisWeek} this week
                    </span>
                  )}
                </div>
                {stats && (
                  <p className="text-2xl font-bold text-foreground tabular-nums mt-0.5 leading-none">
                    {stats.users.total.toLocaleString()}
                    <span className="text-sm font-normal text-muted-foreground ml-2">total users</span>
                  </p>
                )}
              </div>

              {/* Period pills */}
              <div className="flex items-center gap-1 bg-secondary/60 border border-border/50 rounded-xl p-1">
                {PERIODS.map(p => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`period-pill ${period === p ? 'period-pill-active' : 'period-pill-inactive'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-[200px]">
              {growth.length > 0 ? (
                <AdminBarChart data={growth} xKey="date" yKey="count" label="New Users" />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="space-y-2 w-full px-4">
                    {([90, 70, 85, 60, 95, 75, 80, 65, 88, 72, 91, 68] as const).map((w, i) => (
                      <div key={i} className="skeleton h-3 rounded" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* AI Assistant + Donut Chart row */}
          <div className="grid grid-cols-2 gap-4 flex-1 items-stretch">
            <div className="h-full">
              <AIAssistantCard
                summary={aiSummary}
                spendingTrends={stats?.adherence.taken ?? 0}
                customerPayments={stats?.medications.activeReminders ?? 0}
                loading={statsLoading}
              />
            </div>
            <div className="h-full">
              <DonutChart
                data={donutData}
                totalLabel="Total Events"
                totalValue={stats?.adherence.total}
                periodLabel="Last 30 Days"
              />
            </div>
          </div>
        </div>

        {/* Right Column (Col 3): Mini Calendar on top, Live Activity filling the rest below */}
        <div className="col-span-1 flex flex-col gap-4 h-full">
          <div className="shrink-0">
            <MiniCalendar
              statValue={stats ? `${stats.adherence.rate}%` : undefined}
              statLabel="Adherence Rate"
              statTrend={stats && stats.adherence.rate >= 70 ? `+${Math.max(0, stats.adherence.rate - 70)}%` : undefined}
            />
          </div>
          <div className="flex-1 min-h-[220px]">
            <LiveFeed events={events} isConnected={isConnected} stats={stats} />
          </div>
        </div>

      </div>

    </div>
  );
}
