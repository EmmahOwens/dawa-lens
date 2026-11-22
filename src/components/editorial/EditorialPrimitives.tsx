import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const EDITORIAL_EASE = [0.16, 1, 0.3, 1] as const;
export const EDITORIAL_QUINT = [0.22, 1, 0.36, 1] as const;

export const editorialBlurRise = (delay = 0) => ({
  initial: { opacity: 0, y: 16, filter: "blur(5px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 0.65, delay, ease: EDITORIAL_EASE },
});

export const editorialFadeRise = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay, ease: EDITORIAL_EASE },
});

interface EditorialEyebrowProps {
  index?: string;
  label: string;
  dotColor?: string;
  onDark?: boolean;
  className?: string;
}

/**
 * Indexed monospace micro-label:
 * e.g. `01 / OVERVIEW` with an optional live status indicator dot.
 */
export function EditorialEyebrow({
  index,
  label,
  dotColor,
  onDark = false,
  className,
}: EditorialEyebrowProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 editorial-mono select-none",
        onDark ? "text-white/60" : "text-muted-foreground",
        className
      )}
    >
      {dotColor ? (
        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotColor)} aria-hidden="true" />
      ) : (
        <span
          className={cn(
            "h-px w-5 shrink-0",
            onDark ? "bg-white/35" : "bg-foreground/25"
          )}
          aria-hidden="true"
        />
      )}
      {index && (
        <span className={cn("editorial-tabular", onDark ? "text-white/45" : "text-foreground/45")}>
          {index}
        </span>
      )}
      {index && (
        <span className={onDark ? "text-white/25" : "text-foreground/25"} aria-hidden="true">
          /
        </span>
      )}
      <span>{label}</span>
    </div>
  );
}

interface EditorialSectionHeaderProps {
  index: string;
  label: string;
  title?: React.ReactNode;
  accent?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Architectural section heading pairing a mono index (`02 /`) with
 * crisp editorial grotesk + muted italic serif accent.
 */
export function EditorialSectionHeader({
  index,
  label,
  title,
  accent,
  action,
  className,
}: EditorialSectionHeaderProps) {
  return (
    <div className={cn("flex items-end justify-between gap-4 mb-4", className)}>
      <div className="min-w-0">
        <EditorialEyebrow index={index} label={label} className="mb-1.5" />
        {(title || accent) && (
          <h2 className="editorial-display text-[22px] sm:text-[26px] font-medium text-foreground leading-[1.08] tracking-[-0.03em]">
            {title}
            {accent && (
              <>
                {title ? " " : ""}
                <em className="editorial-serif text-[1.08em] text-muted-foreground font-normal not-italic sm:italic">
                  {accent}
                </em>
              </>
            )}
          </h2>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

interface EditorialMetricItem {
  label: string;
  value: React.ReactNode;
  unit?: string;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
}

interface EditorialMetricStripProps {
  items: EditorialMetricItem[];
  onDark?: boolean;
  className?: string;
}

/**
 * Hairline-divided tabular metric strip with light-weight display numerals.
 */
export function EditorialMetricStrip({
  items,
  onDark = false,
  className,
}: EditorialMetricStripProps) {
  const toneClass = (tone: EditorialMetricItem["tone"]) => {
    switch (tone) {
      case "primary":
        return onDark ? "text-sky-300" : "text-primary";
      case "success":
        return onDark ? "text-emerald-300" : "text-emerald-600 dark:text-emerald-400";
      case "warning":
        return onDark ? "text-amber-300" : "text-amber-600 dark:text-amber-400";
      case "danger":
        return onDark ? "text-rose-300" : "text-rose-600 dark:text-rose-400";
      default:
        return onDark ? "text-white" : "text-foreground";
    }
  };

  return (
    <div
      className={cn(
        "grid gap-y-4 divide-x",
        items.length === 2 && "grid-cols-2",
        items.length === 3 && "grid-cols-3",
        items.length >= 4 && "grid-cols-2 sm:grid-cols-4",
        onDark ? "divide-white/10" : "divide-border/75",
        className
      )}
    >
      {items.map((metric, idx) => (
        <div
          key={metric.label}
          className={cn(
            "min-w-0",
            idx > 0 ? "pl-4 sm:pl-6" : "pr-3 sm:pr-5",
            idx > 0 && idx < items.length - 1 && "pr-3 sm:pr-5"
          )}
        >
          <p
            className={cn(
              "editorial-mono text-[9.5px] sm:text-[10px] mb-1.5 truncate",
              onDark ? "text-white/50" : "text-muted-foreground"
            )}
          >
            {metric.label}
          </p>
          <div className="flex items-baseline gap-1 min-w-0">
            <span
              className={cn(
                "editorial-tabular text-[26px] sm:text-[34px] font-light tracking-[-0.03em] leading-none",
                toneClass(metric.tone)
              )}
            >
              {metric.value}
            </span>
            {metric.unit && (
              <span
                className={cn(
                  "text-[12px] font-normal",
                  onDark ? "text-white/55" : "text-muted-foreground"
                )}
              >
                {metric.unit}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

interface EditorialRevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export function EditorialReveal({
  children,
  delay = 0,
  className,
}: EditorialRevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: EDITORIAL_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
