import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface DonutItem {
  name: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutItem[];
  totalLabel?: string;
  totalValue?: string | number;
  periodLabel?: string;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="bg-card border border-border/60 rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="font-semibold text-foreground">{item.name}</p>
      <p className="text-muted-foreground">{item.value.toLocaleString()}</p>
    </div>
  );
}

export function DonutChart({ data, totalLabel = 'Total', totalValue, periodLabel }: DonutChartProps) {
  // BUG-07: Use segment sum for percentage calculation (not the external totalValue)
  const segmentSum = data.reduce((s, d) => s + d.value, 0);
  // BUG-19: Use totalValue only for the center display; show '—' when 0
  const centerValue = totalValue ?? segmentSum;
  const centerNum = typeof centerValue === 'number' ? centerValue : 0;
  const displayTotal = centerNum > 0 ? centerNum.toLocaleString() : '—';

  return (
    <div className="admin-card flex flex-col h-full overflow-hidden p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h3 className="text-sm font-semibold text-foreground">Activity Breakdown</h3>
        {periodLabel && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-xl bg-secondary border border-border/60 text-muted-foreground">
            {periodLabel}
          </span>
        )}
      </div>

      {/* Chart — fixed 160px so legend always shows below */}
      <div className="relative shrink-0" style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="45%"
              outerRadius="70%"
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-xl font-bold text-foreground tabular-nums leading-none">{displayTotal}</p>
          <p className="text-[10px] text-muted-foreground mt-1 text-center">{totalLabel}</p>
        </div>
      </div>

      {/* Legend / key — always visible below the chart */}
      <div className="mt-3 space-y-1.5 shrink-0">
        {data.map((item) => {
          // BUG-07: Always divide by segmentSum so legend %s add to 100%
          const pct = segmentSum > 0 ? Math.round((item.value / segmentSum) * 100) : 0;
          return (
            <div key={item.name} className="flex items-center justify-between py-0.5">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[11px] text-muted-foreground truncate">{item.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-[10px] text-muted-foreground/60">{pct}%</span>
                <span className="text-[11px] font-semibold text-foreground tabular-nums w-6 text-right">
                  {item.value.toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

