import { useId } from 'react';
import {
  BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface AdminBarChartProps {
  data: Array<Record<string, unknown>>;
  xKey: string;
  yKey: string;
  color?: string;
  label?: string;
  horizontal?: boolean;
}

function CustomTooltip({ active, payload, label, color, itemLabel }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="bg-[#0F1629]/95 border border-white/10 backdrop-blur-md rounded-xl px-3.5 py-2.5 shadow-2xl shadow-black/60 text-xs">
      <p className="text-muted-foreground/80 font-medium mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: color }} />
        <p className="font-bold text-foreground text-sm tabular-nums">
          {val != null ? val.toLocaleString() : '0'} <span className="text-xs font-normal text-muted-foreground">{itemLabel}</span>
        </p>
      </div>
    </div>
  );
}

export function AdminBarChart({ data, xKey, yKey, color = '#3B82F6', label = '', horizontal = false }: AdminBarChartProps) {
  const gradientId = useId();

  if (!data || !data.length) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ReBarChart
        data={data}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 12, right: 12, left: horizontal ? 80 : -14, bottom: 0 }}
      >
        <defs>
          <linearGradient id={`barGrad-${gradientId}`} x1="0" y1="0" x2={horizontal ? "1" : "0"} y2={horizontal ? "0" : "1"}>
            <stop offset="0%" stopColor={color} stopOpacity={1} />
            <stop offset="100%" stopColor={color} stopOpacity={0.4} />
          </linearGradient>
          <filter id={`glow-${gradientId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255, 255, 255, 0.05)"
          vertical={!horizontal}
          horizontal={horizontal}
        />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(220 10% 55%)' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey={xKey} tick={{ fontSize: 11, fill: 'hsl(220 10% 65%)' }} axisLine={false} tickLine={false} width={80} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: 'hsl(220 10% 55%)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'hsl(220 10% 55%)' }} axisLine={false} tickLine={false} />
          </>
        )}
        <Tooltip content={<CustomTooltip color={color} itemLabel={label} />} cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 8 }} />
        <Bar dataKey={yKey} radius={horizontal ? [0, 8, 8, 0] : [8, 8, 8, 8]} maxBarSize={36}>
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={`url(#barGrad-${gradientId})`}
              filter={`url(#glow-${gradientId})`}
              className="transition-opacity duration-200 hover:opacity-100 cursor-pointer"
            />
          ))}
        </Bar>
      </ReBarChart>
    </ResponsiveContainer>
  );
}

