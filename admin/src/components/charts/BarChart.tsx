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

const TICK_STYLE = { fontSize: 10, fill: 'hsl(220 8% 55%)' };

export function AdminBarChart({ data, xKey, yKey, color = 'hsl(210 100% 52%)', label = '', horizontal = false }: AdminBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ReBarChart
        data={data}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 8, right: 4, left: horizontal ? 80 : -10, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222 14% 18%)" vertical={!horizontal} horizontal={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={TICK_STYLE} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey={xKey} tick={{ ...TICK_STYLE, fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={TICK_STYLE} axisLine={false} tickLine={false} />
            <YAxis tick={TICK_STYLE} axisLine={false} tickLine={false} />
          </>
        )}
        <Tooltip
          contentStyle={{ background: 'hsl(222 16% 10%)', border: '1px solid hsl(222 14% 18%)', borderRadius: 10, fontSize: 12 }}
          labelStyle={{ color: 'hsl(220 14% 96%)', fontWeight: 600 }}
          itemStyle={{ color }}
          formatter={(v: number) => [v, label]}
        />
        <Bar dataKey={yKey} radius={[4, 4, 0, 0]} maxBarSize={40}>
          {data.map((_, i) => (
            <Cell key={i} fill={color} fillOpacity={0.85} />
          ))}
        </Bar>
      </ReBarChart>
    </ResponsiveContainer>
  );
}
