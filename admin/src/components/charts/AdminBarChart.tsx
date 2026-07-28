import { useId } from 'react';
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
  const val = payload[0].value;
  return (
    <div className="bg-[#0F1629]/95 border border-white/10 backdrop-blur-md rounded-xl px-3.5 py-2.5 shadow-2xl shadow-black/60 text-xs transition-all">
      <p className="text-muted-foreground/80 font-medium mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <p className="font-bold text-foreground text-sm tabular-nums">
          {val != null ? val.toLocaleString() : '0'}
        </p>
      </div>
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
  const gradientId = useId();

  // Guard against empty data
  if (!data || !data.length) return null;

  // Default highlight: bar with maximum value
  const autoHighlight = data.reduce(
    (maxIdx, d, i) => (((d[yKey] as number) || 0) > ((data[maxIdx][yKey] as number) || 0) ? i : maxIdx), 0
  );
  const hIdx = highlightIndex ?? autoHighlight;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 24, right: 8, left: -16, bottom: 0 }} barCategoryGap="22%">
        <defs>
          {/* Active bar capsule gradient (Electric Glowing Blue/Cyan) */}
          <linearGradient id={`activeGrad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={activeColor} stopOpacity={1} />
            <stop offset="100%" stopColor={activeColor} stopOpacity={0.45} />
          </linearGradient>

          {/* Inactive bar capsule gradient (Dark translucent sleek slate) */}
          <linearGradient id={`inactiveGrad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(224 24% 28%)" stopOpacity={0.8} />
            <stop offset="100%" stopColor="hsl(224 24% 14%)" stopOpacity={0.35} />
          </linearGradient>

          {/* Bar top glow filter */}
          <filter id={`barGlow-${gradientId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <CartesianGrid vertical={false} stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3 3" />

        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 10, fill: 'hsl(220 10% 55%)', fontFamily: 'Inter, sans-serif' }}
          axisLine={false}
          tickLine={false}
          dy={6}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'hsl(220 10% 55%)', fontFamily: 'Inter, sans-serif' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
        />

        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 10 }} />

        {/* Both top and bottom rounded for capsule/pill appearance as seen in reference design */}
        <Bar dataKey={yKey} radius={[8, 8, 8, 8]} maxBarSize={40} name={label}>
          {data.map((_, index) => {
            const isActive = index === hIdx;
            return (
              <Cell
                key={`cell-${index}`}
                fill={isActive ? `url(#activeGrad-${gradientId})` : `url(#inactiveGrad-${gradientId})`}
                filter={isActive ? `url(#barGlow-${gradientId})` : undefined}
                className="transition-all duration-300 hover:opacity-100 cursor-pointer"
              />
            );
          })}
          <LabelList
            dataKey={yKey}
            position="top"
            content={({ x, y, width, index }) => {
              if (index !== hIdx) return null;
              // Compute real % change vs previous bar
              const prev = hIdx > 0 ? (data[hIdx - 1][yKey] as number) : null;
              const curr = (data[hIdx][yKey] as number) || 0;
              const pct = prev != null && prev > 0
                ? `${curr >= prev ? '+' : ''}${Math.round(((curr - prev) / prev) * 100)}%`
                : null;
              if (!pct) return null;
              const labelW = 54;
              const isPositive = !pct.startsWith('-');
              return (
                <g className="animate-fade-in">
                  <rect
                    x={Number(x) + Number(width) / 2 - labelW / 2}
                    y={Number(y) - 30}
                    width={labelW}
                    height={22}
                    rx={7}
                    fill={isPositive ? '#2563EB' : '#DC2626'}
                    className="shadow-lg shadow-blue-500/20"
                  />
                  <text
                    x={Number(x) + Number(width) / 2}
                    y={Number(y) - 15}
                    textAnchor="middle"
                    fill="white"
                    fontSize={10}
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

