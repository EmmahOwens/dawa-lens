import { PieChart as RePieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Slice { name: string; value: number }

const COLORS = [
  '#F59E0B', // Amber Gold
  '#8B5CF6', // Neon Purple
  '#06B6D4', // Vibrant Cyan
  '#10B981', // Emerald Mint
  '#EC4899', // Pink
  '#3B82F6', // Electric Blue
];

interface AdminPieChartProps { data: Slice[] }

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="bg-[#0F1629]/95 border border-white/10 backdrop-blur-md rounded-xl px-3.5 py-2.5 shadow-2xl shadow-black/60 text-xs">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.payload?.fill || item.fill }} />
        <p className="font-semibold text-foreground">{item.name}</p>
      </div>
      <p className="text-muted-foreground tabular-nums font-mono text-xs pl-4">
        {item.value != null ? item.value.toLocaleString() : '0'}
      </p>
    </div>
  );
}

export function AdminPieChart({ data }: AdminPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RePieChart>
        <Pie
          data={data}
          cx="50%" cy="50%"
          innerRadius="55%" outerRadius="80%"
          paddingAngle={4}
          dataKey="value"
          strokeWidth={0}
          cornerRadius={6}
        >
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={COLORS[i % COLORS.length]}
              className="transition-transform duration-200 hover:scale-[1.03] origin-center cursor-pointer"
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(v) => <span style={{ color: 'hsl(220 10% 65%)', fontSize: 11, fontWeight: 500 }}>{v}</span>}
        />
      </RePieChart>
    </ResponsiveContainer>
  );
}

