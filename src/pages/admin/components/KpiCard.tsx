import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type Props = {
  label: string;
  value: string | number;
  icon: string;
  trend?: string;
  trendLabel?: string;
  trendUp?: boolean;
  valueColor?: string;
  accentColor?: string;
  className?: string;
  children?: ReactNode;
};

export function KpiCard({
  label, value, icon, trend, trendLabel, trendUp, valueColor, accentColor = "#0a84ff", className, children,
}: Props) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d1320] p-5",
        "transition-all duration-200 hover:-translate-y-0.5 hover:border-white/[0.12]",
        className
      )}
      style={{ "--accent": accentColor } as React.CSSProperties}
    >
      {/* Radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(ellipse at top left, color-mix(in srgb, ${accentColor} 8%, transparent), transparent 65%)` }}
      />

      <div className="relative">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-[#6e7585]">
            {label}
          </span>
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg text-sm"
            style={{ background: `color-mix(in srgb, ${accentColor} 14%, transparent)`, color: accentColor }}
          >
            {icon}
          </div>
        </div>

        <div
          className="mb-2 font-['Syne'] text-3xl font-extrabold leading-none tracking-tighter"
          style={{ color: valueColor }}
        >
          {value}
        </div>

        {(trend || trendLabel) && (
          <div className="flex items-center gap-1.5 text-[11px] font-medium">
            {trend && (
              <span style={{ color: trendUp ? "#30d158" : "#ff453a" }}>{trend}</span>
            )}
            {trendLabel && <span className="text-[#6e7585]">{trendLabel}</span>}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
