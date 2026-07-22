import {
  LineChart as ReLineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

interface AdminLineChartProps {
  data: Array<Record<string, unknown>>;
  xKey: string;
  yKey: string;
  color?: string;
  label?: string;
  suffix?: string;
  connectNulls?: boolean;
}

const TICK_STYLE = { fontSize: 10, fill: 'hsl(220 8% 55%)' };

export function AdminLineChart({
  data,
  xKey,
  yKey,
  color = 'hsl(142 71% 45%)',
  label = '',
  suffix = '',
  connectNulls = true,
}: AdminLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ReLineChart data={data} margin={{ top: 8, right: 4, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 14% 18%)" vertical={false} />
        <XAxis dataKey={xKey} tick={TICK_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: 'hsl(222 16% 10%)', border: '1px solid hsl(222 14% 18%)', borderRadius: 10, fontSize: 12 }}
          labelStyle={{ color: 'hsl(220 14% 96%)', fontWeight: 600 }}
          itemStyle={{ color }}
          formatter={(v: number) => [v != null ? `${v}${suffix}` : '–', label]}
        />
        <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2}
          dot={false} activeDot={{ r: 4, fill: color }} connectNulls={connectNulls} />
      </ReLineChart>
    </ResponsiveContainer>
  );
}
