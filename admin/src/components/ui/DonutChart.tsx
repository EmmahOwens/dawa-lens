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

// Preset vibrant neon color palette matching the reference image
const NEON_COLORS = [
  '#F59E0B', // Amber Gold
  '#8B5CF6', // Neon Purple
  '#06B6D4', // Vibrant Cyan
  '#10B981', // Emerald Mint
  '#EC4899', // Pink
  '#3B82F6', // Electric Blue
];

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="bg-[#0F1629]/95 border border-white/10 backdrop-blur-md rounded-xl px-3.5 py-2.5 shadow-2xl shadow-black/60 text-xs">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.payload?.color || item.fill }} />
        <p className="font-semibold text-foreground">{item.name}</p>
      </div>
      <p className="text-muted-foreground tabular-nums font-mono text-xs pl-4">
        {item.value != null ? item.value.toLocaleString() : '0'} events
      </p>
    </div>
  );
}

export function DonutChart({ data, totalLabel = 'Total', totalValue, periodLabel }: DonutChartProps) {
  const segmentSum = data.reduce((s, d) => s + d.value, 0);
  const centerValue = totalValue ?? segmentSum;
  const centerNum = typeof centerValue === 'number' ? centerValue : 0;
  const displayTotal = centerNum > 0 ? centerNum.toLocaleString() : '—';

  // Calculate percentage of top category for central badge accent like "38.6%" in Image 2
  const topSegment = data.length > 0 ? Math.max(...data.map(d => d.value)) : 0;
  const topPct = segmentSum > 0 ? ((topSegment / segmentSum) * 100).toFixed(1) : '0';

  return (
    <div className="admin-card flex flex-col h-full overflow-hidden p-4 sm:p-5 relative bg-[#0D121F]/90 border border-white/10 shadow-xl">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0 relative z-10">
        <h3 className="text-sm font-semibold text-foreground tracking-wide">Activity Breakdown</h3>
        {periodLabel && (
          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-muted-foreground shadow-sm">
            {periodLabel}
          </span>
        )}
      </div>

      {/* Chart container */}
      <div className="relative shrink-0 flex items-center justify-center my-1" style={{ height: 170 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="78%"
              paddingAngle={4}
              dataKey="value"
              strokeWidth={0}
              cornerRadius={6}
            >
              {data.map((entry, index) => {
                const color = entry.color || NEON_COLORS[index % NEON_COLORS.length];
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={color}
                    className="transition-all duration-300 hover:scale-[1.03] origin-center cursor-pointer drop-shadow-md"
                  />
                );
              })}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Central Glass Badge matching Image 2 "Income Breakdown" */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
          <div className="w-20 h-20 rounded-full bg-[#0A0E1A]/90 border border-white/15 backdrop-blur-md shadow-2xl flex flex-col items-center justify-center p-1 text-center">
            <span className="text-sm font-extrabold text-foreground tabular-nums leading-tight">
              {topPct}%
            </span>
            <span className="text-[9px] font-medium text-muted-foreground/80 leading-none mt-0.5 truncate max-w-[60px]">
              {totalLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Legend / breakdown listing */}
      <div className="mt-3 space-y-1.5 shrink-0 relative z-10">
        {data.map((item, index) => {
          const color = item.color || NEON_COLORS[index % NEON_COLORS.length];
          const pct = segmentSum > 0 ? Math.round((item.value / segmentSum) * 100) : 0;
          return (
            <div
              key={item.name}
              className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs text-muted-foreground truncate font-medium">{item.name}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-2">
                <span className="text-[11px] font-medium text-muted-foreground/70">{pct}%</span>
                <span className="text-xs font-bold text-foreground tabular-nums w-8 text-right font-mono">
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


