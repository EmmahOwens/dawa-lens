import { useId } from 'react';
import {
  AreaChart as ReAreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

interface AdminAreaChartProps {
  data: Array<Record<string, unknown>>;
  xKey: string;
  yKey: string;
  color?: string;
  label?: string;
  showGrid?: boolean;
  showAxes?: boolean;
}

function CustomTooltip({ active, payload, label, color, itemLabel }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="bg-[#0F1629]/95 border border-white/10 backdrop-blur-md rounded-xl px-3.5 py-2.5 shadow-2xl shadow-black/60 text-xs">
      <p className="text-muted-foreground/80 font-medium mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full animate-pulse shadow-sm" style={{ backgroundColor: color }} />
        <p className="font-bold text-foreground text-sm tabular-nums">
          {val != null ? val.toLocaleString() : '0'} <span className="text-xs font-normal text-muted-foreground">{itemLabel}</span>
        </p>
      </div>
    </div>
  );
}

export function AdminAreaChart({
  data,
  xKey,
  yKey,
  color = '#3B82F6',
  label = '',
  showGrid = true,
  showAxes = true,
}: AdminAreaChartProps) {
  const gradientId = useId();

  if (!data || !data.length) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ReAreaChart data={data} margin={{ top: 12, right: 8, left: showAxes ? -14 : 0, bottom: 0 }}>
        <defs>
          {/* Luminous Area Gradient */}
          <linearGradient id={`areaGrad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.45} />
            <stop offset="60%" stopColor={color} stopOpacity={0.12} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>

          {/* Neon Stroke Glow Filter */}
          <filter id={`strokeGlow-${gradientId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />}
        
        {showAxes && (
          <>
            <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: 'hsl(220 10% 55%)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'hsl(220 10% 55%)' }} axisLine={false} tickLine={false} />
          </>
        )}

        <Tooltip content={<CustomTooltip color={color} itemLabel={label} />} cursor={{ stroke: 'rgba(255, 255, 255, 0.15)', strokeDasharray: '4 4' }} />

        <Area
          type="monotone"
          dataKey={yKey}
          stroke={color}
          strokeWidth={3}
          filter={`url(#strokeGlow-${gradientId})`}
          fill={`url(#areaGrad-${gradientId})`}
          dot={false}
          activeDot={{
            r: 6,
            fill: color,
            stroke: 'white',
            strokeWidth: 2.5,
            className: 'shadow-lg shadow-blue-500/50',
          }}
        />
      </ReAreaChart>
    </ResponsiveContainer>
  );
}

