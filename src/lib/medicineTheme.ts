import React from "react";
import { Pill, Tablets, Droplets, Syringe } from "@/lib/icons";

export interface ColorTheme {
  name: string;
  label: string;
  value: string;
  gradient: string;
  bgGlow: string;
  bgLight: string;
  text: string;
  border: string;
  borderHover: string;
  accentBar: string;
  ring: string;
  shadowColor: string;
}

export const COLOR_THEMES: Record<string, ColorTheme> = {
  blue: {
    name: "blue",
    label: "Sky Blue",
    value: "bg-blue-500",
    gradient: "from-sky-500 to-blue-600",
    bgGlow: "from-sky-500/[0.08] via-blue-500/[0.03] to-transparent",
    bgLight: "bg-sky-500/10 dark:bg-sky-500/20",
    text: "text-sky-600 dark:text-sky-400",
    border: "border-sky-500/25 dark:border-sky-500/35",
    borderHover: "hover:border-sky-500/50 hover:shadow-sky-500/10",
    accentBar: "bg-sky-500",
    ring: "#0284c7",
    shadowColor: "sky-500/25",
  },
  green: {
    name: "green",
    label: "Emerald",
    value: "bg-emerald-500",
    gradient: "from-emerald-400 to-teal-600",
    bgGlow: "from-emerald-500/[0.08] via-teal-500/[0.03] to-transparent",
    bgLight: "bg-emerald-500/10 dark:bg-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/25 dark:border-emerald-500/35",
    borderHover: "hover:border-emerald-500/50 hover:shadow-emerald-500/10",
    accentBar: "bg-emerald-500",
    ring: "#059669",
    shadowColor: "emerald-500/25",
  },
  purple: {
    name: "purple",
    label: "Royal Violet",
    value: "bg-violet-500",
    gradient: "from-purple-500 to-indigo-600",
    bgGlow: "from-purple-500/[0.08] via-indigo-500/[0.03] to-transparent",
    bgLight: "bg-purple-500/10 dark:bg-purple-500/20",
    text: "text-purple-600 dark:text-purple-400",
    border: "border-purple-500/25 dark:border-purple-500/35",
    borderHover: "hover:border-purple-500/50 hover:shadow-purple-500/10",
    accentBar: "bg-purple-500",
    ring: "#7c3aed",
    shadowColor: "purple-500/25",
  },
  rose: {
    name: "rose",
    label: "Coral Rose",
    value: "bg-rose-500",
    gradient: "from-rose-500 to-pink-600",
    bgGlow: "from-rose-500/[0.08] via-pink-500/[0.03] to-transparent",
    bgLight: "bg-rose-500/10 dark:bg-rose-500/20",
    text: "text-rose-600 dark:text-rose-400",
    border: "border-rose-500/25 dark:border-rose-500/35",
    borderHover: "hover:border-rose-500/50 hover:shadow-rose-500/10",
    accentBar: "bg-rose-500",
    ring: "#e11d48",
    shadowColor: "rose-500/25",
  },
  amber: {
    name: "amber",
    label: "Warm Amber",
    value: "bg-amber-500",
    gradient: "from-amber-400 to-orange-500",
    bgGlow: "from-amber-500/[0.08] via-orange-500/[0.03] to-transparent",
    bgLight: "bg-amber-500/10 dark:bg-amber-500/20",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/25 dark:border-amber-500/35",
    borderHover: "hover:border-amber-500/50 hover:shadow-amber-500/10",
    accentBar: "bg-amber-500",
    ring: "#d97706",
    shadowColor: "amber-500/25",
  },
  teal: {
    name: "teal",
    label: "Fresh Teal",
    value: "bg-teal-500",
    gradient: "from-teal-400 to-cyan-600",
    bgGlow: "from-teal-500/[0.08] via-cyan-500/[0.03] to-transparent",
    bgLight: "bg-teal-500/10 dark:bg-teal-500/20",
    text: "text-teal-600 dark:text-teal-400",
    border: "border-teal-500/25 dark:border-teal-500/35",
    borderHover: "hover:border-teal-500/50 hover:shadow-teal-500/10",
    accentBar: "bg-teal-500",
    ring: "#0d9488",
    shadowColor: "teal-500/25",
  },
  indigo: {
    name: "indigo",
    label: "Deep Indigo",
    value: "bg-indigo-500",
    gradient: "from-indigo-500 to-blue-700",
    bgGlow: "from-indigo-500/[0.08] via-blue-500/[0.03] to-transparent",
    bgLight: "bg-indigo-500/10 dark:bg-indigo-500/20",
    text: "text-indigo-600 dark:text-indigo-400",
    border: "border-indigo-500/25 dark:border-indigo-500/35",
    borderHover: "hover:border-indigo-500/50 hover:shadow-indigo-500/10",
    accentBar: "bg-indigo-500",
    ring: "#4f46e5",
    shadowColor: "indigo-500/25",
  },
  fuchsia: {
    name: "fuchsia",
    label: "Berry Fuchsia",
    value: "bg-fuchsia-500",
    gradient: "from-fuchsia-500 to-rose-600",
    bgGlow: "from-fuchsia-500/[0.08] via-rose-500/[0.03] to-transparent",
    bgLight: "bg-fuchsia-500/10 dark:bg-fuchsia-500/20",
    text: "text-fuchsia-600 dark:text-fuchsia-400",
    border: "border-fuchsia-500/25 dark:border-fuchsia-500/35",
    borderHover: "hover:border-fuchsia-500/50 hover:shadow-fuchsia-500/10",
    accentBar: "bg-fuchsia-500",
    ring: "#c026d3",
    shadowColor: "fuchsia-500/25",
  },
};

export const COLOR_KEYS = Object.keys(COLOR_THEMES);

export const COLORS = COLOR_KEYS.map((k) => COLOR_THEMES[k]);

export const ICONS = [
  { name: "pill", icon: Pill },
  { name: "tablet", icon: Tablets },
  { name: "liquid", icon: Droplets },
  { name: "syringe", icon: Syringe },
];

export const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  pill: Pill,
  tablet: Tablets,
  liquid: Droplets,
  syringe: Syringe,
};

/**
 * Returns a stable, vibrant color theme for any medication.
 * If the user explicitly set a non-default color, it uses that.
 * If undefined or the default "blue", it deterministically hashes
 * the name + id across our 8 vibrant palettes so each medication card
 * gets a matching, attractive individual color identity across all pages.
 */
export function getMedicineTheme(med: { name?: string; id?: string; color?: string }): ColorTheme {
  if (med.color && med.color !== "blue" && COLOR_THEMES[med.color]) {
    return COLOR_THEMES[med.color];
  }
  let hash = 0;
  const seed = (med.name || "med") + (med.id || "");
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const pickedKey = COLOR_KEYS[Math.abs(hash) % COLOR_KEYS.length];
  return COLOR_THEMES[pickedKey] || COLOR_THEMES.blue;
}
