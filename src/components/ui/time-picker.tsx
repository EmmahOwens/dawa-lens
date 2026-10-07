import React, { useState, useEffect, useMemo, useRef } from "react";
import { Clock, ChevronUp, ChevronDown, Check, Sparkles } from "@/lib/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface TimePickerProps {
  value: string; // "HH:mm" in 24h format e.g. "08:30" or "14:15"
  onChange: (time: string) => void;
  className?: string;
  id?: string;
  disabled?: boolean;
  inline?: boolean;
  showPresets?: boolean;
}

const DEFAULT_PRESETS = [
  { label: "Morning", time: "08:00" },
  { label: "Noon", time: "12:00" },
  { label: "Evening", time: "18:00" },
  { label: "Night", time: "21:00" },
];

/**
 * Parses "HH:mm" (24h) into { hours12: 1-12, minutes: 0-59, period: "AM" | "PM" }
 */
function parseTime(timeStr: string) {
  if (!timeStr || !timeStr.includes(":")) {
    return { hours12: 8, minutes: 0, period: "AM" as const };
  }
  const [hStr, mStr] = timeStr.split(":");
  let hours = parseInt(hStr, 10);
  const minutes = parseInt(mStr, 10) || 0;
  if (isNaN(hours)) hours = 8;

  const period: "AM" | "PM" = hours >= 12 ? "PM" : "AM";
  let hours12 = hours % 12;
  if (hours12 === 0) hours12 = 12;

  return {
    hours12,
    minutes: Math.min(Math.max(minutes, 0), 59),
    period,
  };
}

/**
 * Formats 12h representation back to "HH:mm" 24h string
 */
function to24hString(hours12: number, minutes: number, period: "AM" | "PM"): string {
  let hours = hours12 % 12;
  if (period === "PM") hours += 12;
  const h = hours.toString().padStart(2, "0");
  const m = minutes.toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Apple-style Clock Face Visualizer
 */
function ClockFace({
  hours12,
  minutes,
  onSelectHour,
  onSelectMinute,
  mode,
}: {
  hours12: number;
  minutes: number;
  onSelectHour?: (h: number) => void;
  onSelectMinute?: (m: number) => void;
  mode: "hour" | "minute";
}) {
  const clockRef = useRef<HTMLDivElement>(null);

  // Hour hand angle (360 / 12 = 30 deg per hour + minute fraction)
  const hourAngle = (hours12 % 12) * 30 + (minutes / 60) * 30;
  // Minute hand angle (360 / 60 = 6 deg per minute)
  const minuteAngle = minutes * 6;

  const handleClockClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!clockRef.current) return;
    const rect = clockRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const x = e.clientX - centerX;
    const y = e.clientY - centerY;

    // Angle in degrees from top (12 o'clock)
    let angle = (Math.atan2(y, x) * 180) / Math.PI + 90;
    if (angle < 0) angle += 360;

    if (mode === "hour") {
      let h = Math.round(angle / 30);
      if (h === 0) h = 12;
      onSelectHour?.(h);
    } else {
      let m = Math.round(angle / 6);
      if (m === 60) m = 0;
      onSelectMinute?.(m);
    }
  };

  // Numbers 1 to 12
  const numbers = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  return (
    <div
      ref={clockRef}
      onClick={handleClockClick}
      className="relative w-44 h-44 rounded-full bg-secondary/40 border border-border flex items-center justify-center cursor-pointer select-none mx-auto transition-transform active:scale-98 shadow-inner"
    >
      {/* 12 Hour Number markers */}
      {numbers.map((num, i) => {
        const rad = ((i * 30 - 90) * Math.PI) / 180;
        const radius = 64; // px from center
        const x = Math.cos(rad) * radius;
        const y = Math.sin(rad) * radius;
        const isSelected = mode === "hour" && hours12 === num;

        return (
          <div
            key={num}
            style={{
              transform: `translate(${x}px, ${y}px)`,
            }}
            className={cn(
              "absolute w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold transition-colors pointer-events-none",
              isSelected
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {num}
          </div>
        );
      })}

      {/* Clock Center Pin */}
      <div className="w-2.5 h-2.5 rounded-full bg-primary z-20 shadow-xs" />

      {/* Hour Hand */}
      <div
        style={{
          transform: `rotate(${hourAngle}deg)`,
          transformOrigin: "50% 100%",
        }}
        className="absolute bottom-1/2 w-1 h-12 bg-foreground rounded-full z-10 pointer-events-none shadow-xs"
      />

      {/* Minute Hand */}
      <div
        style={{
          transform: `rotate(${minuteAngle}deg)`,
          transformOrigin: "50% 100%",
        }}
        className="absolute bottom-1/2 w-0.5 h-16 bg-primary rounded-full z-15 pointer-events-none shadow-xs"
      />
    </div>
  );
}

/**
 * AppleTimePickerCore
 * The interactive panel with segmented hour/minute drums, AM/PM toggle, and clock face.
 */
export function AppleTimePickerCore({
  value,
  onChange,
  onDone,
  showPresets = true,
}: {
  value: string;
  onChange: (time: string) => void;
  onDone?: () => void;
  showPresets?: boolean;
}) {
  const parsed = useMemo(() => parseTime(value), [value]);
  const [hours12, setHours12] = useState(parsed.hours12);
  const [minutes, setMinutes] = useState(parsed.minutes);
  const [period, setPeriod] = useState<"AM" | "PM">(parsed.period);
  const [activeTab, setActiveTab] = useState<"hour" | "minute">("hour");

  useEffect(() => {
    const p = parseTime(value);
    setHours12(p.hours12);
    setMinutes(p.minutes);
    setPeriod(p.period);
  }, [value]);

  const updateTime = (h: number, m: number, p: "AM" | "PM") => {
    setHours12(h);
    setMinutes(m);
    setPeriod(p);
    onChange(to24hString(h, m, p));
  };

  const incrementHour = (delta: number) => {
    let next = hours12 + delta;
    if (next > 12) next = 1;
    if (next < 1) next = 12;
    updateTime(next, minutes, period);
  };

  const incrementMinute = (delta: number) => {
    let next = minutes + delta;
    if (next >= 60) next = 0;
    if (next < 0) next = 55;
    updateTime(hours12, next, period);
  };

  return (
    <div className="space-y-4">
      {/* Time Display & Segmented Selector Bar */}
      <div className="flex items-center justify-center gap-2">
        {/* Hour Box */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => incrementHour(1)}
            aria-label="Increment hour"
            className="p-1 text-muted-foreground hover:text-foreground transition-transform active:scale-90"
          >
            <ChevronUp size={16} />
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("hour")}
            className={cn(
              "w-14 h-12 rounded-[14px] flex items-center justify-center text-2xl font-bold tracking-tight transition-all border",
              activeTab === "hour"
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "bg-secondary text-foreground border-border hover:bg-secondary/80"
            )}
          >
            {hours12.toString().padStart(2, "0")}
          </button>
          <button
            type="button"
            onClick={() => incrementHour(-1)}
            aria-label="Decrement hour"
            className="p-1 text-muted-foreground hover:text-foreground transition-transform active:scale-90"
          >
            <ChevronDown size={16} />
          </button>
        </div>

        {/* Separator Colon */}
        <span className="text-2xl font-bold text-muted-foreground mb-1">:</span>

        {/* Minute Box */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => incrementMinute(5)}
            aria-label="Increment minute"
            className="p-1 text-muted-foreground hover:text-foreground transition-transform active:scale-90"
          >
            <ChevronUp size={16} />
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("minute")}
            className={cn(
              "w-14 h-12 rounded-[14px] flex items-center justify-center text-2xl font-bold tracking-tight transition-all border",
              activeTab === "minute"
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "bg-secondary text-foreground border-border hover:bg-secondary/80"
            )}
          >
            {minutes.toString().padStart(2, "0")}
          </button>
          <button
            type="button"
            onClick={() => incrementMinute(-5)}
            aria-label="Decrement minute"
            className="p-1 text-muted-foreground hover:text-foreground transition-transform active:scale-90"
          >
            <ChevronDown size={16} />
          </button>
        </div>

        {/* AM / PM Segmented Pill Switcher */}
        <div className="flex flex-col gap-1 p-1 rounded-[14px] bg-secondary border border-border">
          <button
            type="button"
            onClick={() => updateTime(hours12, minutes, "AM")}
            className={cn(
              "px-3 py-1.5 rounded-[10px] text-xs font-bold transition-all",
              period === "AM"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            AM
          </button>
          <button
            type="button"
            onClick={() => updateTime(hours12, minutes, "PM")}
            className={cn(
              "px-3 py-1.5 rounded-[10px] text-xs font-bold transition-all",
              period === "PM"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            PM
          </button>
        </div>
      </div>

      {/* Interactive Apple Clock Dial */}
      <div className="pt-1">
        <ClockFace
          hours12={hours12}
          minutes={minutes}
          mode={activeTab}
          onSelectHour={(h) => {
            updateTime(h, minutes, period);
            setActiveTab("minute"); // Auto-advance to minute picking like Apple Watch
          }}
          onSelectMinute={(m) => {
            updateTime(hours12, m, period);
          }}
        />
      </div>

      {/* Quick Time Presets */}
      {showPresets && (
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          {DEFAULT_PRESETS.map((p) => {
            const isPresetActive = value === p.time;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  const parsedPreset = parseTime(p.time);
                  updateTime(parsedPreset.hours12, parsedPreset.minutes, parsedPreset.period);
                }}
                className={cn(
                  "py-1.5 px-1 rounded-full text-[10px] font-semibold transition-transform active:scale-95 border",
                  isPresetActive
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-secondary text-muted-foreground border-border hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Done Button */}
      {onDone && (
        <button
          type="button"
          onClick={onDone}
          className="w-full min-h-[40px] rounded-full bg-primary text-primary-foreground text-xs font-semibold tracking-tight transition-transform active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
        >
          <Check size={14} strokeWidth={2.5} />
          <span>Confirm Time</span>
        </button>
      )}
    </div>
  );
}

/**
 * AppleTimePicker
 * Drop-in replacement for `<input type="time">`.
 * Emits and accepts standard `"HH:mm"` 24h strings.
 */
export function AppleTimePicker({
  value,
  onChange,
  className,
  id,
  disabled = false,
  inline = false,
  showPresets = true,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => parseTime(value), [value]);

  const displayString = useMemo(() => {
    const h = parsed.hours12.toString().padStart(2, "0");
    const m = parsed.minutes.toString().padStart(2, "0");
    return `${h}:${m} ${parsed.period}`;
  }, [parsed]);

  if (inline) {
    return (
      <div className={cn("p-4 rounded-[20px] border border-border bg-card", className)}>
        <AppleTimePickerCore
          value={value}
          onChange={onChange}
          showPresets={showPresets}
        />
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={cn(
            "w-full h-11 px-4 rounded-full border border-border bg-card hover:bg-secondary/60 text-foreground transition-all flex items-center justify-between text-sm font-semibold tracking-tight active:scale-95 select-none focus:outline-hidden focus:ring-2 focus:ring-primary/20",
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Clock size={14} />
            </div>
            <span className="text-foreground">{displayString}</span>
          </div>

          <div className="px-2 py-0.5 rounded-full bg-secondary text-[11px] font-semibold text-muted-foreground border border-border">
            {value || "Set Time"}
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[280px] p-5 rounded-[20px] border-border bg-card/95 backdrop-blur-xl shadow-xl z-50"
      >
        <AppleTimePickerCore
          value={value}
          onChange={onChange}
          onDone={() => setOpen(false)}
          showPresets={showPresets}
        />
      </PopoverContent>
    </Popover>
  );
}

export { AppleTimePicker as TimePicker };
export default AppleTimePicker;
