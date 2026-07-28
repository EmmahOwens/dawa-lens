import { ArrowUpRight, TrendingUp, TrendingDown } from 'lucide-react';
import { AdminAreaChart } from './AreaChart';

interface GainerItem {
  id: string;
  name: string;
  category: string;
  value: string;
  change: string;
  isPositive: boolean;
  color: string;
  iconBg: string;
  data: Array<{ day: string; value: number }>;
}

const MOCK_GAINERS: GainerItem[] = [
  {
    id: '1',
    name: 'Metformin HCl',
    category: 'Top Adherence Rate',
    value: '98.4%',
    change: '2.4%',
    isPositive: true,
    color: '#3B82F6', // Electric Cyan Blue
    iconBg: 'bg-blue-500/20 text-blue-400',
    data: [
      { day: 'W1', value: 65 },
      { day: 'W2', value: 72 },
      { day: 'W3', value: 95 },
      { day: 'W4', value: 88 },
      { day: 'W5', value: 94 },
      { day: 'W6', value: 78 },
      { day: 'W7', value: 85 },
    ],
  },
  {
    id: '2',
    name: 'Amoxicillin 500mg',
    category: 'Active Prescriptions',
    value: '1,420',
    change: '31%',
    isPositive: true,
    color: '#A855F7', // Vibrant Violet
    iconBg: 'bg-purple-500/20 text-purple-400',
    data: [
      { day: 'W1', value: 30 },
      { day: 'W2', value: 45 },
      { day: 'W3', value: 80 },
      { day: 'W4', value: 60 },
      { day: 'W5', value: 75 },
      { day: 'W6', value: 92 },
      { day: 'W7', value: 110 },
    ],
  },
  {
    id: '3',
    name: 'Lisinopril 10mg',
    category: 'Scanner Accuracy',
    value: '99.1%',
    change: '14%',
    isPositive: true,
    color: '#10B981', // Mint Emerald
    iconBg: 'bg-emerald-500/20 text-emerald-400',
    data: [
      { day: 'W1', value: 40 },
      { day: 'W2', value: 52 },
      { day: 'W3', value: 61 },
      { day: 'W4', value: 70 },
      { day: 'W5', value: 68 },
      { day: 'W6', value: 85 },
      { day: 'W7', value: 105 },
    ],
  },
];

export function QuarterlyTopGainers() {
  return (
    <div className="admin-card bg-[#0D121F]/90 border border-white/10 p-5 shadow-2xl relative overflow-hidden flex flex-col justify-between">
      {/* Background ambient lighting */}
      <div className="absolute -top-12 -right-12 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-5 relative z-10">
        <div>
          <h3 className="text-base font-bold text-foreground tracking-wide flex items-center gap-2">
            Top Performing Category Trends
          </h3>
          <p className="text-xs text-muted-foreground/80 mt-0.5">Real-time adherence & interaction performance</p>
        </div>
        <button
          className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all cursor-pointer shadow-sm"
          title="Expand category view"
        >
          <ArrowUpRight size={16} />
        </button>
      </div>

      {/* 3 Column gainers cards matching Image 1 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
        {MOCK_GAINERS.map((item) => (
          <div
            key={item.id}
            className="flex flex-col justify-between rounded-xl bg-[#080B13]/70 border border-white/5 p-4 hover:border-white/15 transition-all duration-300 group"
          >
            {/* Header info */}
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`w-7 h-7 rounded-lg ${item.iconBg} flex items-center justify-center font-bold text-xs shadow-inner`}>
                  {item.name.charAt(0)}
                </div>
                <div className="truncate min-w-0">
                  <h4 className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {item.name}
                  </h4>
                  <p className="text-[10px] text-muted-foreground/70 truncate">{item.category}</p>
                </div>
              </div>

              {/* Value and % badge */}
              <div className="mb-2">
                <span className="text-xl font-extrabold text-foreground tracking-tight tabular-nums block">
                  {item.value}
                </span>
                <div className="flex items-center gap-1 mt-0.5">
                  {item.isPositive ? (
                    <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-0.5">
                      <TrendingUp size={10} /> ↑ {item.change}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-rose-400 flex items-center gap-0.5">
                      <TrendingDown size={10} /> ↓ {item.change}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground/60">vs last month</span>
                </div>
              </div>
            </div>

            {/* Glowing wave area curve matching Image 1 */}
            <div className="h-24 w-full mt-2 -mb-2">
              <AdminAreaChart
                data={item.data}
                xKey="day"
                yKey="value"
                color={item.color}
                showGrid={false}
                showAxes={false}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
