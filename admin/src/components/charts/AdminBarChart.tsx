import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts';

interface AdminBarChartProps {
  data: Array<{ [key: string]: any }>;
  xKey: string;
  yKey: string;
  label?: string;
  activeColor?: string;
  inactiveColor?: string;
  /** Index of the bar to highlight (default: auto-highlights tallest) */
  highlightIndex?: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border/60 rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="text-muted-foreground mb-0.5">{label}</p>
      <p className="font-bold text-foreground tabular-nums">{payload[0].value?.toLocaleString()}</p>
    </div>
  );
}

export function AdminBarChart({
  data,
  xKey,
  yKey,
  label,
  activeColor = 'hsl(213 94% 58%)',
  inactiveColor = 'hsl(224 18% 18%)',
  highlightIndex,
}: AdminBarChartProps) {
  // BUG-04: Guard against empty data
  if (!data.length) return null;

  // Default highlight: bar with maximum value
  const autoHighlight = data.reduce(
    (maxIdx, d, i) => ((d[yKey] as number) > (data[maxIdx][yKey] as number) ? i : maxIdx), 0
  );
  const hIdx = highlightIndex ?? autoHighlight;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 16, right: 4, left: -8, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="hsl(224 16% 16%)" strokeDasharray="3 3" />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 10, fill: 'hsl(220 10% 52%)', fontFamily: 'Inter, sans-serif' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'hsl(220 10% 52%)', fontFamily: 'Inter, sans-serif' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 8 }} />
        <Bar dataKey={yKey} radius={[6, 6, 0, 0]} maxBarSize={44} name={label}>
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={index === hIdx ? activeColor : inactiveColor}
              opacity={index === hIdx ? 1 : 0.7}
            />
          ))}
          <LabelList
            dataKey={yKey}
            position="top"
            content={({ x, y, width, index }) => {
              if (index !== hIdx) return null;
              // BUG-03: Compute real % change vs previous bar
              const prev = hIdx > 0 ? (data[hIdx - 1][yKey] as number) : null;
              const curr = data[hIdx][yKey] as number;
              const pct = prev != null && prev > 0
                ? `${curr >= prev ? '+' : ''}${Math.round(((curr - prev) / prev) * 100)}%`
                : null;
              if (!pct) return null;
              const labelW = 48;
              return (
                <g>
                  <rect
                    x={Number(x) + Number(width) / 2 - labelW / 2}
                    y={Number(y) - 28}
                    width={labelW}
                    height={20}
                    rx={6}
                    fill={activeColor}
                    opacity={0.9}
                  />
                  <text
                    x={Number(x) + Number(width) / 2}
                    y={Number(y) - 14}
                    textAnchor="middle"
                    fill="white"
                    fontSize={9}
                    fontWeight={700}
                    fontFamily="Inter, sans-serif"
                  >
                    {pct}
                  </text>
                </g>
              );
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
