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
}

const TICK_STYLE = { fontSize: 10, fill: 'hsl(220 8% 55%)' };

export function AdminAreaChart({ data, xKey, yKey, color = 'hsl(210 100% 52%)', label = '' }: AdminAreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ReAreaChart data={data} margin={{ top: 8, right: 4, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id={`area-${yKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.18} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 14% 18%)" vertical={false} />
        <XAxis dataKey={xKey} tick={TICK_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: 'hsl(222 16% 10%)', border: '1px solid hsl(222 14% 18%)', borderRadius: 10, fontSize: 12 }}
          labelStyle={{ color: 'hsl(220 14% 96%)', fontWeight: 600 }}
          itemStyle={{ color: color }}
          formatter={(v: number) => [v, label]}
        />
        <Area type="monotone" dataKey={yKey} stroke={color} strokeWidth={2}
          fill={`url(#area-${yKey})`} dot={false} activeDot={{ r: 4, fill: color }} />
      </ReAreaChart>
    </ResponsiveContainer>
  );
}
