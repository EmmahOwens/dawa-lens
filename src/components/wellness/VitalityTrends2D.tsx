import React, { useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface VitalityTrends2DProps {
  data: {
    name: string;
    adherence: number;
    energy: number | null;
    mood: number | null;
  }[];
}
// Dimensions of SVG coordinates (viewBox space)
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
  const getX = React.useCallback((idx: number) => {
    return paddingLeft + idx * (chartWidth / (data.length - 1));
  }, [data.length]);

  // Y coordinate mappers (Dual-Axis)
  // Left Axis: Adherence % (0 - 100)
  const getAdherenceY = React.useCallback((val: number) => {
    return viewHeight - paddingBottom - (val / 100) * chartHeight;
  }, []);

  // Right Axis: Wellness rating (mapped from 0-100 to 1-5 scale)
  const getWellnessY = React.useCallback((val: number | null) => {
    if (val === null) return 0;
    // Map 0-100 back to 1-5 for positioning if the parent scales it by 20
    // If it's already 1-5, we'd use (val-1)/4.
    // Given ReportPage.tsx: energy = (sumEnergy / dayWellnessLogs.length) * 20;
    // It seems the value passed is 0-100.
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

  // Data processing
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

  // Generate Adherence Area Path
  const adherenceAreaPath = useMemo(() => {
    if (adherencePoints.length === 0) return "";
    const linePath = makeSmoothPath(adherencePoints);
    const bottomY = viewHeight - paddingBottom;
    return `${linePath} L ${adherencePoints[adherencePoints.length - 1].x} ${bottomY} L ${adherencePoints[0].x} ${bottomY} Z`;
  }, [adherencePoints]);

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

  // Animation variants for floating dots
  const floatingVariant = {
    animate: (i: number) => ({
      y: [0, -4, 0],
      transition: {
        duration: 2 + Math.sin(i) * 0.5,
        repeat: Infinity,
        ease: "easeInOut",
      },
    }),
  };

  const pulseVariant = {
    animate: {
      scale: [1, 1.5, 1],
      opacity: [0.5, 0, 0.5],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: "easeOut",
      },
    },
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={containerRef}
        className="relative w-full aspect-[600/250] min-h-[180px] select-none"
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
          className="block cursor-crosshair overflow-visible"
        >
          <defs>
            <linearGradient id="adherenceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.0} />
            </linearGradient>

            <linearGradient id="shimmerGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="white" stopOpacity="0" />
              <stop offset="50%" stopColor="white" stopOpacity="0.2" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
              <animateTransform
                attributeName="transform"
                type="translate"
                from="-1 0"
                to="1 0"
                dur="3s"
                repeatCount="indefinite"
              />
            </linearGradient>

            <mask id="adherenceMask">
              {adherenceAreaPath && (
                <path d={adherenceAreaPath} fill="white" />
              )}
            </mask>

            <filter id="glow-adherence" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-energy" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-mood" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid Lines */}
          {[0, 25, 50, 75, 100].map((percent) => {
            const y = getAdherenceY(percent);
            return (
              <g key={percent}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={viewWidth - paddingRight}
                  y2={y}
                  className="stroke-border/40"
                  strokeWidth={1}
                  strokeDasharray="4 6"
                />
                <text
                  x={paddingLeft - 10}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-muted-foreground/60 text-[9px] font-bold font-sans"
                >
                  {percent}%
                </text>
              </g>
            );
          })}

          {[1, 2, 3, 4, 5].map((rating) => {
            const y = getWellnessY(rating * 20); // Mapping 1-5 to the 0-100 space used in mapper
            return (
              <text
                key={rating}
                x={viewWidth - paddingRight + 12}
                y={y + 3}
                textAnchor="start"
                className="fill-muted-foreground/60 text-[9px] font-bold font-sans"
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
                {day.name.split(" ")[1] || day.name}
              </text>
            );
          })}

          {/* Adherence Area with Shimmer */}
          <AnimatePresence>
            {visibleLines.adherence && adherenceAreaPath && (
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <path d={adherenceAreaPath} fill="url(#adherenceGrad)" />
                <rect
                  x={paddingLeft}
                  y={paddingTop}
                  width={chartWidth}
                  height={chartHeight}
                  fill="url(#shimmerGrad)"
                  mask="url(#adherenceMask)"
                />
              </motion.g>
            )}
          </AnimatePresence>

          {/* Active Snap Line */}
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
                className="stroke-border/80"
                strokeWidth={1.5}
                strokeDasharray="3 3"
              />
            )}
          </AnimatePresence>

          {/* Trend Lines */}
          <AnimatePresence>
            {visibleLines.adherence && adherencePoints.length > 0 && (
              <motion.path
                d={makeSmoothPath(adherencePoints)}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                strokeLinecap="round"
                filter="url(#glow-adherence)"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
            )}

            {visibleLines.energy && energyPoints.length > 0 && (
              <motion.path
                d={makeSmoothPath(energyPoints)}
                fill="none"
                stroke="#10b981"
                strokeWidth={2.5}
                strokeDasharray="6 4"
                strokeLinecap="round"
                filter="url(#glow-energy)"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
              />
            )}

            {visibleLines.mood && moodPoints.length > 0 && (
              <motion.path
                d={makeSmoothPath(moodPoints)}
                fill="none"
                stroke="#6366f1"
                strokeWidth={2.5}
                strokeDasharray="2 4"
                strokeLinecap="round"
                filter="url(#glow-mood)"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.2, ease: "easeOut", delay: 0.4 }}
              />
            )}
          </AnimatePresence>

          {/* Dots and Pulsing Today */}
          {data.map((day, idx) => {
            const x = getX(idx);
            const isHovered = hoveredIdx === idx;
            const isToday = idx === data.length - 1;

            const adhY = getAdherenceY(day.adherence);
            const energyY = day.energy !== null ? getWellnessY(day.energy) : null;
            const moodY = day.mood !== null ? getWellnessY(day.mood) : null;

            return (
              <g key={idx} className="pointer-events-none">
                {/* Adherence */}
                {visibleLines.adherence && (
                  <motion.g custom={idx} variants={floatingVariant} animate="animate">
                    {isToday && (
                      <motion.circle
                        cx={x}
                        cy={adhY}
                        r={8}
                        className="fill-primary"
                        variants={pulseVariant}
                        animate="animate"
                      />
                    )}
                    <circle
                      cx={x}
                      cy={adhY}
                      r={isHovered ? 6 : 3.5}
                      className="fill-background stroke-primary transition-all duration-200"
                      strokeWidth={isHovered ? 2.5 : 1.5}
                    />
                  </motion.g>
                )}

                {/* Energy */}
                {visibleLines.energy && energyY !== null && (
                  <motion.g custom={idx + 1} variants={floatingVariant} animate="animate">
                    {isToday && (
                      <motion.circle
                        cx={x}
                        cy={energyY}
                        r={8}
                        className="fill-emerald-500"
                        variants={pulseVariant}
                        animate="animate"
                      />
                    )}
                    <circle
                      cx={x}
                      cy={energyY}
                      r={isHovered ? 6 : 3.5}
                      className="fill-background stroke-emerald-500 transition-all duration-200"
                      strokeWidth={isHovered ? 2.5 : 1.5}
                    />
                  </motion.g>
                )}

                {/* Mood */}
                {visibleLines.mood && moodY !== null && (
                  <motion.g custom={idx + 2} variants={floatingVariant} animate="animate">
                    {isToday && (
                      <motion.circle
                        cx={x}
                        cy={moodY}
                        r={8}
                        className="fill-indigo-500"
                        variants={pulseVariant}
                        animate="animate"
                      />
                    )}
                    <circle
                      cx={x}
                      cy={moodY}
                      r={isHovered ? 6 : 3.5}
                      className="fill-background stroke-indigo-500 transition-all duration-200"
                      strokeWidth={isHovered ? 2.5 : 1.5}
                    />
                  </motion.g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip */}
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
              className="z-30 bg-card/90 backdrop-blur-md border border-border px-3 py-2.5 rounded-2xl shadow-xl flex flex-col gap-1 min-w-[130px]"
            >
              <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest border-b border-border/50 pb-1 mb-1">
                {currentHoveredData.name}
              </p>

              <div className="flex items-center gap-2 justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 in-block h-2 rounded-full bg-primary" />
                  <span className="text-[10px] font-bold text-muted-foreground">Adherence</span>
                </span>
                <span className="text-[11px] font-extrabold text-foreground">
                  {currentHoveredData.adherence}%
                </span>
              </div>

              {currentHoveredData.energy !== null && (
                <div className="flex items-center gap-2 justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 in-block h-2 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-bold text-muted-foreground">Energy</span>
                  </span>
                  <span className="text-[11px] font-extrabold text-foreground">
                    {(currentHoveredData.energy / 20).toFixed(1)}/5
                  </span>
                </div>
              )}

              {currentHoveredData.mood !== null && (
                <div className="flex items-center gap-2 justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 in-block h-2 rounded-full bg-indigo-500" />
                    <span className="text-[10px] font-bold text-muted-foreground">Mood</span>
                  </span>
                  <span className="text-[11px] font-extrabold text-foreground">
                    {(currentHoveredData.mood / 20).toFixed(1)}/5
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Interactive Legend */}
      <div className="flex justify-center gap-4 flex-wrap">
        <button
          onClick={() => setVisibleLines(v => ({ ...v, adherence: !v.adherence }))}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border ${
            visibleLines.adherence
              ? "bg-primary/10 border-primary/20"
              : "bg-accent/50 border-transparent opacity-50"
          }`}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-primary" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Adherence
          </span>
        </button>
        <button
          onClick={() => setVisibleLines(v => ({ ...v, energy: !v.energy }))}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border ${
            visibleLines.energy
              ? "bg-emerald-500/10 border-emerald-500/20"
              : "bg-accent/50 border-transparent opacity-50"
          }`}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-success" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Energy
          </span>
        </button>
        <button
          onClick={() => setVisibleLines(v => ({ ...v, mood: !v.mood }))}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border ${
            visibleLines.mood
              ? "bg-indigo-500/10 border-indigo-500/20"
              : "bg-accent/50 border-transparent opacity-50"
          }`}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Mood
          </span>
        </button>
      </div>
    </div>
  );
}
