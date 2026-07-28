import React, { useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Activity } from "@/lib/icons";

export interface VitalityTrends2DProps {
  data: {
    name: string;
    adherence: number;
    energy: number | null;
    mood: number | null;
  }[];
}

const viewWidth = 600;
const viewHeight = 250;
const paddingLeft = 50;
const paddingRight = 50;
const paddingTop = 30;
const paddingBottom = 40;

const chartWidth = viewWidth - paddingLeft - paddingRight;
const chartHeight = viewHeight - paddingTop - paddingBottom;

export function VitalityTrends2D({ data }: VitalityTrends2DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [visibleLines, setVisibleLines] = useState({ adherence: true, energy: true, mood: true });

  // X coordinate mapper
  const getX = React.useCallback(
    (idx: number) => {
      const total = data.length > 1 ? data.length - 1 : 1;
      return paddingLeft + idx * (chartWidth / total);
    },
    [data.length]
  );

  // Left Axis Y mapper: Adherence % (0 - 100)
  const getAdherenceY = React.useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    return viewHeight - paddingBottom - (clamped / 100) * chartHeight;
  }, []);

  // Right Axis Y mapper: Wellness rating (1 - 5 stars mapped from 0-100 score)
  const getWellnessY = React.useCallback((val: number | null) => {
    if (val === null) return 0;
    const rating = val / 20; // 0-100 -> 0-5
    const clampedRating = Math.max(1, Math.min(5, rating));
    return viewHeight - paddingBottom - ((clampedRating - 1) / 4) * chartHeight;
  }, []);

  // Generate Bezier path string for smooth curves
  const makeSmoothPath = (points: { x: number; y: number }[]) => {
    if (points.length === 0) return "";
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      const controlX1 = curr.x + (next.x - curr.x) * 0.4;
      const controlY1 = curr.y;
      const controlX2 = next.x - (next.x - curr.x) * 0.4;
      const controlY2 = next.y;
      path += ` C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${next.x} ${next.y}`;
    }
    return path;
  };

  // Points calculation
  const adherencePoints = useMemo(() => {
    return data.map((d, i) => ({ x: getX(i), y: getAdherenceY(d.adherence) }));
  }, [data, getX, getAdherenceY]);

  const energyPoints = useMemo(() => {
    return data
      .map((d, i) => (d.energy !== null ? { x: getX(i), y: getWellnessY(d.energy) } : null))
      .filter((p): p is { x: number; y: number } => p !== null);
  }, [data, getX, getWellnessY]);

  const moodPoints = useMemo(() => {
    return data
      .map((d, i) => (d.mood !== null ? { x: getX(i), y: getWellnessY(d.mood) } : null))
      .filter((p): p is { x: number; y: number } => p !== null);
  }, [data, getX, getWellnessY]);

  // Area paths
  const adherenceAreaPath = useMemo(() => {
    if (adherencePoints.length === 0) return "";
    const linePath = makeSmoothPath(adherencePoints);
    const bottomY = viewHeight - paddingBottom;
    return `${linePath} L ${adherencePoints[adherencePoints.length - 1].x} ${bottomY} L ${adherencePoints[0].x} ${bottomY} Z`;
  }, [adherencePoints]);

  const energyAreaPath = useMemo(() => {
    if (energyPoints.length === 0) return "";
    const linePath = makeSmoothPath(energyPoints);
    const bottomY = viewHeight - paddingBottom;
    return `${linePath} L ${energyPoints[energyPoints.length - 1].x} ${bottomY} L ${energyPoints[0].x} ${bottomY} Z`;
  }, [energyPoints]);

  const moodAreaPath = useMemo(() => {
    if (moodPoints.length === 0) return "";
    const linePath = makeSmoothPath(moodPoints);
    const bottomY = viewHeight - paddingBottom;
    return `${linePath} L ${moodPoints[moodPoints.length - 1].x} ${bottomY} L ${moodPoints[0].x} ${bottomY} Z`;
  }, [moodPoints]);

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const viewBoxX = (clientX / rect.width) * viewWidth;

    let closestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < data.length; i++) {
      const diff = Math.abs(viewBoxX - getX(i));
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }

    setHoveredIdx(closestIdx);
    const snapX = (getX(closestIdx) / viewWidth) * rect.width;
    const tooltipY = Math.max(10, clientY - 80);
    setTooltipPos({ x: snapX, y: tooltipY });
  };

  const handlePointerLeave = () => {
    setHoveredIdx(null);
  };

  const currentHoveredData = hoveredIdx !== null ? data[hoveredIdx] : null;
  const isNoData = data.every((d) => d.energy === null && d.mood === null && d.adherence === 100);

  return (
    <div className="w-full rounded-2xl bg-card/90 dark:bg-[#0D121F]/90 border border-border/70 dark:border-white/10 p-5 shadow-lg dark:shadow-2xl relative overflow-hidden flex flex-col gap-4 backdrop-blur-md">
      {/* Background ambient lighting */}
      <div className="absolute -top-12 -right-12 w-64 h-64 bg-primary/10 dark:bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between relative z-10">
        <h3 className="text-sm sm:text-base font-bold text-foreground tracking-wide flex items-center gap-2">
          <TrendingUp size={16} className="text-primary" /> VITALITY TRENDS
        </h3>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 bg-muted/50 dark:bg-white/5 border border-border/50 dark:border-white/10 px-2.5 py-1 rounded-full">
          7-Day Snapshot
        </span>
      </div>

      <div className="relative w-full aspect-[600/250] min-h-[200px] select-none z-10">
        {isNoData && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-accent/5 z-20 rounded-2xl border border-dashed border-border/50 backdrop-blur-xs">
            <Activity size={28} className="text-muted-foreground/40 mb-2" />
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
              No activity data yet
            </p>
            <p className="text-[8px] font-bold text-muted-foreground/40 mt-0.5 uppercase tracking-tighter">
              Log your wellness in the Wellness Hub
            </p>
          </div>
        )}

        <svg
          ref={containerRef as any}
          width="100%"
          height="100%"
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          className="block cursor-crosshair overflow-visible"
        >
          <defs>
            {/* Adherence Neon Gradient */}
            <linearGradient id="adherenceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
              <stop offset="60%" stopColor="#3B82F6" stopOpacity={0.08} />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.0} />
            </linearGradient>

            {/* Energy Neon Gradient */}
            <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
              <stop offset="60%" stopColor="#10B981" stopOpacity={0.06} />
              <stop offset="100%" stopColor="#10B981" stopOpacity={0.0} />
            </linearGradient>

            {/* Mood Neon Gradient */}
            <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A855F7" stopOpacity={0.3} />
              <stop offset="60%" stopColor="#A855F7" stopOpacity={0.06} />
              <stop offset="100%" stopColor="#A855F7" stopOpacity={0.0} />
            </linearGradient>

            {/* Shimmer effect across area */}
            <linearGradient id="shimmerGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="white" stopOpacity="0" />
              <stop offset="50%" stopColor="white" stopOpacity="0.18" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
              <animateTransform
                attributeName="transform"
                type="translate"
                from="-1 0"
                to="1 0"
                dur="4s"
                repeatCount="indefinite"
              />
            </linearGradient>

            {/* Neon Glow Filters */}
            <filter id="glow-adherence" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="glow-energy" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="glow-mood" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Glowing Horizontal Grid Lines */}
          {[0, 25, 50, 75, 100].map((percent) => {
            const y = getAdherenceY(percent);
            return (
              <g key={percent}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={viewWidth - paddingRight}
                  y2={y}
                  className="stroke-border/40 dark:stroke-white/10"
                  strokeWidth={1}
                  strokeDasharray="4 6"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-muted-foreground/70 text-[9px] font-bold font-sans"
                >
                  {percent}%
                </text>
              </g>
            );
          })}

          {/* Right Y-Axis Star Ratings (1★ - 5★) */}
          {[1, 2, 3, 4, 5].map((rating) => {
            const y = getWellnessY(rating * 20);
            return (
              <text
                key={rating}
                x={viewWidth - paddingRight + 12}
                y={y + 3}
                textAnchor="start"
                className="fill-muted-foreground/70 text-[9px] font-bold font-sans"
              >
                {rating}★
              </text>
            );
          })}

          {/* X-Axis Labels */}
          {data.map((day, idx) => {
            const x = getX(idx);
            const y = viewHeight - paddingBottom + 18;
            const isToday = idx === data.length - 1;
            return (
              <text
                key={idx}
                x={x}
                y={y}
                textAnchor="middle"
                className={`text-[9px] font-sans transition-all duration-200 ${
                  isToday
                    ? "fill-primary font-black scale-105"
                    : hoveredIdx === idx
                    ? "fill-foreground font-bold"
                    : "fill-muted-foreground font-semibold"
                }`}
              >
                {day.name?.split(" ")[1] || day.name || "Day"}
              </text>
            );
          })}

          {/* Adherence Gradient Area */}
          <AnimatePresence>
            {visibleLines.adherence && adherenceAreaPath && (
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <path d={adherenceAreaPath} fill="url(#adherenceGrad)" />
              </motion.g>
            )}
          </AnimatePresence>

          {/* Energy Gradient Area */}
          <AnimatePresence>
            {visibleLines.energy && energyAreaPath && (
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <path d={energyAreaPath} fill="url(#energyGrad)" />
              </motion.g>
            )}
          </AnimatePresence>

          {/* Mood Gradient Area */}
          <AnimatePresence>
            {visibleLines.mood && moodAreaPath && (
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <path d={moodAreaPath} fill="url(#moodGrad)" />
              </motion.g>
            )}
          </AnimatePresence>

          {/* Active Hover Snap Line */}
          <AnimatePresence>
            {hoveredIdx !== null && (
              <motion.line
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                x1={getX(hoveredIdx)}
                y1={paddingTop - 5}
                x2={getX(hoveredIdx)}
                y2={viewHeight - paddingBottom + 5}
                className="stroke-primary/50 dark:stroke-white/30"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
            )}
          </AnimatePresence>

          {/* Neon Smooth Trend Lines on the Same Canvas */}
          {visibleLines.adherence && adherencePoints.length > 0 && (
            <path
              d={makeSmoothPath(adherencePoints)}
              fill="none"
              stroke="#3B82F6"
              strokeWidth={3}
              filter="url(#glow-adherence)"
              strokeLinecap="round"
              className="transition-opacity duration-300"
            />
          )}

          {visibleLines.energy && energyPoints.length > 0 && (
            <path
              d={makeSmoothPath(energyPoints)}
              fill="none"
              stroke="#10B981"
              strokeWidth={2.5}
              filter="url(#glow-energy)"
              strokeLinecap="round"
              className="transition-opacity duration-300"
            />
          )}

          {visibleLines.mood && moodPoints.length > 0 && (
            <path
              d={makeSmoothPath(moodPoints)}
              fill="none"
              stroke="#A855F7"
              strokeWidth={2.5}
              filter="url(#glow-mood)"
              strokeLinecap="round"
              className="transition-opacity duration-300"
            />
          )}

          {/* Data Points and Pulsing Dots */}
          {data.map((day, idx) => {
            const x = getX(idx);
            const isHovered = hoveredIdx === idx;
            const isToday = idx === data.length - 1;

            const adhY = getAdherenceY(day.adherence);
            const energyY = day.energy !== null ? getWellnessY(day.energy) : null;
            const moodY = day.mood !== null ? getWellnessY(day.mood) : null;

            return (
              <g key={idx} className="pointer-events-none">
                {/* Adherence Dot */}
                {visibleLines.adherence && (
                  <g>
                    {isToday && (
                      <motion.circle
                        cx={x}
                        cy={adhY}
                        fill="#3B82F6"
                        initial={{ r: 3.5, opacity: 0.6 }}
                        animate={{
                          r: [3.5, 9, 3.5],
                          opacity: [0.6, 0, 0.6],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeOut",
                        }}
                      />
                    )}
                    <circle
                      cx={x}
                      cy={adhY}
                      r={isHovered ? 6 : 3.5}
                      className="fill-background stroke-blue-500 transition-all duration-200"
                      strokeWidth={isHovered ? 2.5 : 1.5}
                    />
                  </g>
                )}

                {/* Energy Dot */}
                {visibleLines.energy && energyY !== null && (
                  <g>
                    {isToday && (
                      <motion.circle
                        cx={x}
                        cy={energyY}
                        fill="#10B981"
                        initial={{ r: 3.5, opacity: 0.6 }}
                        animate={{
                          r: [3.5, 9, 3.5],
                          opacity: [0.6, 0, 0.6],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeOut",
                        }}
                      />
                    )}
                    <circle
                      cx={x}
                      cy={energyY}
                      r={isHovered ? 6 : 3.5}
                      className="fill-background stroke-emerald-500 transition-all duration-200"
                      strokeWidth={isHovered ? 2.5 : 1.5}
                    />
                  </g>
                )}

                {/* Mood Dot */}
                {visibleLines.mood && moodY !== null && (
                  <g>
                    {isToday && (
                      <motion.circle
                        cx={x}
                        cy={moodY}
                        fill="#A855F7"
                        initial={{ r: 3.5, opacity: 0.6 }}
                        animate={{
                          r: [3.5, 9, 3.5],
                          opacity: [0.6, 0, 0.6],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeOut",
                        }}
                      />
                    )}
                    <circle
                      cx={x}
                      cy={moodY}
                      r={isHovered ? 6 : 3.5}
                      className="fill-background stroke-purple-500 transition-all duration-200"
                      strokeWidth={isHovered ? 2.5 : 1.5}
                    />
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Glassmorphic Hover Tooltip */}
        <AnimatePresence>
          {hoveredIdx !== null && currentHoveredData && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              style={{
                position: "absolute",
                left: tooltipPos.x,
                top: tooltipPos.y,
                transform: "translate(-50%, -100%)",
                pointerEvents: "none",
              }}
              className="z-30 bg-card/95 dark:bg-[#0F1629]/95 border border-border/80 dark:border-white/15 backdrop-blur-md px-3 py-2.5 rounded-2xl shadow-xl flex flex-col gap-1 min-w-[130px]"
            >
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest border-b border-border/50 pb-1 mb-1">
                {currentHoveredData.name}
              </p>

              {visibleLines.adherence && (
                <div className="flex items-center gap-2 justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shadow-sm" />
                    <span className="text-[10px] font-bold text-muted-foreground">Adherence</span>
                  </span>
                  <span className="text-[11px] font-extrabold text-foreground tabular-nums">
                    {Math.round(currentHoveredData.adherence)}%
                  </span>
                </div>
              )}

              {visibleLines.energy && currentHoveredData.energy !== null && (
                <div className="flex items-center gap-2 justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm" />
                    <span className="text-[10px] font-bold text-muted-foreground">Energy</span>
                  </span>
                  <span className="text-[11px] font-extrabold text-foreground tabular-nums">
                    {(currentHoveredData.energy / 20).toFixed(1)}/5
                  </span>
                </div>
              )}

              {visibleLines.mood && currentHoveredData.mood !== null && (
                <div className="flex items-center gap-2 justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500 shadow-sm" />
                    <span className="text-[10px] font-bold text-muted-foreground">Mood</span>
                  </span>
                  <span className="text-[11px] font-extrabold text-foreground tabular-nums">
                    {(currentHoveredData.mood / 20).toFixed(1)}/5
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Interactive Neon Legend Pills */}
      <div className="flex justify-center gap-3 sm:gap-4 flex-wrap z-10 mt-1">
        <button
          onClick={() => setVisibleLines((v) => ({ ...v, adherence: !v.adherence }))}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border cursor-pointer ${
            visibleLines.adherence
              ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 shadow-sm"
              : "bg-muted/40 border-transparent opacity-40 text-muted-foreground"
          }`}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-xs" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Adherence</span>
        </button>

        <button
          onClick={() => setVisibleLines((v) => ({ ...v, energy: !v.energy }))}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border cursor-pointer ${
            visibleLines.energy
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-sm"
              : "bg-muted/40 border-transparent opacity-40 text-muted-foreground"
          }`}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Energy</span>
        </button>

        <button
          onClick={() => setVisibleLines((v) => ({ ...v, mood: !v.mood }))}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border cursor-pointer ${
            visibleLines.mood
              ? "bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400 shadow-sm"
              : "bg-muted/40 border-transparent opacity-40 text-muted-foreground"
          }`}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-xs" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Mood</span>
        </button>
      </div>
    </div>
  );
}
