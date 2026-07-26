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
  const total = totalValue ?? data.reduce((s, d) => s + d.value, 0);
  const displayTotal = typeof total === 'number' ? total.toLocaleString() : total;

  return (
    <div className="admin-card flex flex-col h-full overflow-hidden p-4 sm:p-5 min-h-[260px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <h3 className="text-sm font-semibold text-foreground">Activity Breakdown</h3>
        {periodLabel && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-xl bg-secondary border border-border/60 text-muted-foreground">
            {periodLabel}
          </span>
        )}
      </div>

      {/* Chart */}
      <div className="relative flex-1 flex items-center justify-center" style={{ minHeight: 120 }}>
        <ResponsiveContainer width="100%" height="100%" minHeight={120}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="50%"
              outerRadius="75%"
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
          <p className="text-lg font-bold text-foreground tabular-nums leading-none">{displayTotal}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">{totalLabel}</p>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2 space-y-1 shrink-0">
        {data.map((item) => (
          <div key={item.name} className="flex items-center justify-between py-0.5">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[11px] text-muted-foreground truncate">{item.name}</span>
            </div>
            <span className="text-[11px] font-medium text-foreground tabular-nums shrink-0 ml-2">
              {item.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

