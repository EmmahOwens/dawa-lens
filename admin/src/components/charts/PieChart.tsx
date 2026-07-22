import { PieChart as RePieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Slice { name: string; value: number }

const COLORS = [
  'hsl(210 100% 52%)',
  'hsl(142 71% 45%)',
  'hsl(38 92% 50%)',
  'hsl(0 72% 51%)',
  'hsl(270 60% 60%)',
  'hsl(180 60% 45%)',
];

interface AdminPieChartProps { data: Slice[] }

export function AdminPieChart({ data }: AdminPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RePieChart>
        <Pie
          data={data}
          cx="50%" cy="50%"
          innerRadius="55%" outerRadius="80%"
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: 'hsl(222 16% 10%)', border: '1px solid hsl(222 14% 18%)', borderRadius: 10, fontSize: 12 }}
          itemStyle={{ color: 'hsl(220 14% 96%)' }}
          formatter={(v: number, name: string) => [v.toLocaleString(), name]}
        />
        <Legend
          iconType="circle" iconSize={8}
          formatter={(v) => <span style={{ color: 'hsl(220 8% 55%)', fontSize: 11 }}>{v}</span>}
        />
      </RePieChart>
    </ResponsiveContainer>
  );
}
