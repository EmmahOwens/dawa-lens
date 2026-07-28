import React, { useId, useMemo } from "react";
import {
  AreaChart as ReAreaChart,
  Area,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Pill, Zap, Smile, TrendingUp, TrendingDown } from "@/lib/icons";

export interface VitalityTrends2DProps {
  data: {
    name: string;
    adherence: number;
    energy: number | null;
    mood: number | null;
  }[];
}

interface AreaSparklineProps {
  data: Array<{ day: string; value: number }>;
  xKey: string;
  yKey: string;
  color: string;
  label?: string;
}

function CustomTooltip({ active, payload, label, color, itemLabel }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="bg-card/95 border border-border/80 dark:bg-[#0F1629]/95 dark:border-white/10 backdrop-blur-md rounded-xl px-3 py-1.5 shadow-xl text-xs z-50">
      <p className="text-muted-foreground/80 font-medium mb-0.5 text-[10px]">{label}</p>
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full animate-pulse shadow-sm" style={{ backgroundColor: color }} />
        <p className="font-bold text-foreground text-xs tabular-nums">
          {val != null ? val.toLocaleString() : "0"}{" "}
          <span className="text-[10px] font-normal text-muted-foreground">{itemLabel}</span>
        </p>
      </div>
    </div>
  );
}

function AreaSparkline({
  data,
  xKey,
  yKey,
  color = "#3B82F6",
  label = "",
}: AreaSparklineProps) {
  const gradientId = useId().replace(/:/g, "");

  if (!data || !data.length) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ReAreaChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id={`areaGrad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.45} />
            <stop offset="60%" stopColor={color} stopOpacity={0.12} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>

          <filter id={`strokeGlow-${gradientId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <Tooltip
          content={<CustomTooltip color={color} itemLabel={label} />}
          cursor={{ stroke: "rgba(150, 150, 150, 0.2)", strokeDasharray: "4 4" }}
        />

        <Area
          type="monotone"
          dataKey={yKey}
          stroke={color}
          strokeWidth={3}
          filter={`url(#strokeGlow-${gradientId})`}
          fill={`url(#areaGrad-${gradientId})`}
          dot={false}
          activeDot={{
            r: 5,
            fill: color,
            stroke: "white",
            strokeWidth: 2,
          }}
        />
      </ReAreaChart>
    </ResponsiveContainer>
  );
}

export function VitalityTrends2D({ data }: VitalityTrends2DProps) {
  // Calculations for Adherence, Energy, and Mood cards
  const cards = useMemo(() => {
    if (!data || data.length === 0) return [];

    // 1. ADHERENCE CARD
    const adherenceValues = data.map((d) => d.adherence);
    const avgAdherence =
      adherenceValues.reduce((a, b) => a + b, 0) / (adherenceValues.length || 1);
    const half = Math.ceil(data.length / 2);
    const firstHalfAdh = adherenceValues.slice(0, half);
    const secondHalfAdh = adherenceValues.slice(half);
    const avg1Adh = firstHalfAdh.reduce((a, b) => a + b, 0) / (firstHalfAdh.length || 1);
    const avg2Adh = secondHalfAdh.reduce((a, b) => a + b, 0) / (secondHalfAdh.length || 1);
    const adhDiff = avg2Adh - avg1Adh;

    const adherenceData = data.map((d) => ({
      day: d.name,
      value: Math.round(d.adherence),
    }));

    // 2. ENERGY CARD
    const validEnergy = data.filter((d) => d.energy !== null);
    const avgEnergyRaw =
      validEnergy.length > 0
        ? validEnergy.reduce((acc, d) => acc + (d.energy ?? 0), 0) / validEnergy.length
        : null;

    let energyDiff = 0;
    if (validEnergy.length > 1) {
      const eHalf = Math.ceil(validEnergy.length / 2);
      const eFirst = validEnergy.slice(0, eHalf).reduce((a, b) => a + (b.energy ?? 0), 0) / eHalf;
      const eSecond = validEnergy.slice(eHalf).reduce((a, b) => a + (b.energy ?? 0), 0) / (validEnergy.length - eHalf || 1);
      energyDiff = eSecond - eFirst;
    }

    const energyData = data.map((d) => ({
      day: d.name,
      value: d.energy !== null ? Math.round(d.energy) : Math.round(avgEnergyRaw ?? 75),
    }));

    // 3. MOOD CARD
    const validMood = data.filter((d) => d.mood !== null);
    const avgMoodRaw =
      validMood.length > 0
        ? validMood.reduce((acc, d) => acc + (d.mood ?? 0), 0) / validMood.length
        : null;

    let moodDiff = 0;
    if (validMood.length > 1) {
      const mHalf = Math.ceil(validMood.length / 2);
      const mFirst = validMood.slice(0, mHalf).reduce((a, b) => a + (b.mood ?? 0), 0) / mHalf;
      const mSecond = validMood.slice(mHalf).reduce((a, b) => a + (b.mood ?? 0), 0) / (validMood.length - mHalf || 1);
      moodDiff = mSecond - mFirst;
    }

    const moodData = data.map((d) => ({
      day: d.name,
      value: d.mood !== null ? Math.round(d.mood) : Math.round(avgMoodRaw ?? 85),
    }));

    return [
      {
        id: "adherence",
        name: "Adherence Rate",
        category: "Dose Log Consistency",
        value: `${avgAdherence.toFixed(1)}%`,
        change: `${Math.abs(adhDiff).toFixed(1)}%`,
        isPositive: adhDiff >= 0,
        color: "#3B82F6", // Electric Cyan Blue
        iconBg: "bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
        icon: <Pill size={14} />,
        label: "% adherence",
        data: adherenceData,
      },
      {
        id: "energy",
        name: "Energy Level",
        category: "Daily Vitality Avg",
        value: avgEnergyRaw !== null ? `${(avgEnergyRaw / 20).toFixed(1)} / 5` : "4.0 / 5",
        change: `${Math.abs(energyDiff / 20).toFixed(1)} pts`,
        isPositive: energyDiff >= 0,
        color: "#A855F7", // Vibrant Violet
        iconBg: "bg-purple-500/15 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400",
        icon: <Zap size={14} />,
        label: "% vitality",
        data: energyData,
      },
      {
        id: "mood",
        name: "Mood Rating",
        category: "Emotional Wellness",
        value: avgMoodRaw !== null ? `${(avgMoodRaw / 20).toFixed(1)} / 5` : "4.5 / 5",
        change: `${Math.abs(moodDiff / 20).toFixed(1)} pts`,
        isPositive: moodDiff >= 0,
        color: "#10B981", // Mint Emerald
        iconBg: "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
        icon: <Smile size={14} />,
        label: "% mood",
        data: moodData,
      },
    ];
  }, [data]);

  return (
    <div className="w-full rounded-2xl bg-card/90 dark:bg-[#0D121F]/90 border border-border/70 dark:border-white/10 p-4 sm:p-5 shadow-md dark:shadow-2xl relative overflow-hidden flex flex-col justify-between backdrop-blur-md">
      {/* Background ambient glow */}
      <div className="absolute -top-12 -right-12 w-64 h-64 bg-primary/10 dark:bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* 3 Column gainer cards matching Overview Page style */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
        {cards.map((item) => (
          <div
            key={item.id}
            className="flex flex-col justify-between rounded-xl bg-background/80 dark:bg-[#080B13]/70 border border-border/60 dark:border-white/5 p-4 hover:border-primary/30 dark:hover:border-white/15 transition-all duration-300 group shadow-sm hover:shadow-md"
          >
            {/* Header info */}
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`w-7 h-7 rounded-lg ${item.iconBg} flex items-center justify-center font-bold text-xs shadow-inner`}>
                  {item.icon}
                </div>
                <div className="truncate min-w-0">
                  <h4 className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {item.name}
                  </h4>
                  <p className="text-[10px] text-muted-foreground/70 truncate">{item.category}</p>
                </div>
              </div>

              {/* Primary Value & Trend Badge */}
              <div className="mb-2">
                <span className="text-xl font-extrabold text-foreground tracking-tight tabular-nums block">
                  {item.value}
                </span>
                <div className="flex items-center gap-1 mt-0.5">
                  {item.isPositive ? (
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                      <TrendingUp size={10} /> ↑ {item.change}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-0.5">
                      <TrendingDown size={10} /> ↓ {item.change}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground/60">vs last week</span>
                </div>
              </div>
            </div>

            {/* Glowing wave area curve matching Overview Page */}
            <div className="h-24 w-full mt-2 -mb-2">
              <AreaSparkline
                data={item.data}
                xKey="day"
                yKey="value"
                color={item.color}
                label={item.label}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
