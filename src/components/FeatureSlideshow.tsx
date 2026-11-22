import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Users,
  Heart,
  Sparkles,
  Lightbulb,
  ArrowRight,
  Package,
} from "@/lib/icons";
import { aiApi } from "@/services/api";
import { NativeService } from "@/services/nativeService";
import { EDITORIAL_EASE, EditorialEyebrow } from "@/components/editorial/EditorialPrimitives";

interface SlideTheme {
  surface: string;
  border: string;
  accentBar: string;
  iconChip: string;
  dot: string;
  serifAccent: string;
  progressActive: string;
  progressDone: string;
  badge: string;
  cta: string;
  ctaChip: string;
  orbColor: string;
}

interface SlideItem {
  id: string;
  index: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  accentWord: string;
  to?: string;
  description: string;
  type: "feature" | "tip";
  theme: SlideTheme;
}

const SLIDES: SlideItem[] = [
  {
    id: "scan",
    index: "01",
    icon: Camera,
    label: "Quick",
    accentWord: "Scan",
    to: "/scan",
    description: "Identify pills, blister foils, and prescription slips instantly with Vision AI.",
    type: "feature",
    theme: {
      surface: "from-blue-100/80 via-sky-50/75 to-indigo-50/60 dark:from-blue-950/65 dark:via-[#141c2f] dark:to-indigo-950/45",
      border: "border-blue-500/30 hover:border-blue-500/50",
      accentBar: "bg-gradient-to-b from-blue-500 to-sky-500",
      iconChip: "bg-gradient-to-br from-blue-600 to-sky-500 text-white shadow-md shadow-blue-500/25",
      dot: "bg-blue-500",
      serifAccent: "text-blue-700 dark:text-sky-300",
      progressActive: "bg-blue-600 dark:bg-sky-400",
      progressDone: "bg-blue-500/40 dark:bg-sky-400/40",
      badge: "bg-blue-500/15 text-blue-700 dark:text-sky-300 border-blue-500/25",
      cta: "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/25",
      ctaChip: "bg-white text-blue-600",
      orbColor: "rgba(37, 99, 235, 0.22)",
    },
  },
  {
    id: "tip1",
    index: "02",
    icon: Lightbulb,
    label: "Clinical",
    accentWord: "Insight",
    description: "Taking oral medications with plain water instead of juice improves absorption consistency.",
    type: "tip",
    theme: {
      surface: "from-amber-100/80 via-orange-50/70 to-yellow-50/60 dark:from-amber-950/60 dark:via-[#231b12] dark:to-orange-950/45",
      border: "border-amber-500/35 hover:border-amber-500/55",
      accentBar: "bg-gradient-to-b from-amber-500 to-orange-500",
      iconChip: "bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/25",
      dot: "bg-amber-500",
      serifAccent: "text-amber-700 dark:text-amber-300",
      progressActive: "bg-amber-600 dark:bg-amber-400",
      progressDone: "bg-amber-500/40 dark:bg-amber-400/40",
      badge: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30",
      cta: "bg-amber-600 hover:bg-amber-700 text-white shadow-sm shadow-amber-600/25",
      ctaChip: "bg-white text-amber-600",
      orbColor: "rgba(245, 158, 11, 0.22)",
    },
  },
  {
    id: "family",
    index: "03",
    icon: Users,
    label: "Family",
    accentWord: "Hub",
    to: "/family",
    description: "Coordinate dependent profiles, refills, and live dose confirmations in one calm space.",
    type: "feature",
    theme: {
      surface: "from-sky-100/80 via-cyan-50/70 to-blue-50/60 dark:from-sky-950/65 dark:via-[#12202d] dark:to-blue-950/45",
      border: "border-sky-500/30 hover:border-sky-500/50",
      accentBar: "bg-gradient-to-b from-sky-500 to-cyan-500",
      iconChip: "bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/25",
      dot: "bg-sky-500",
      serifAccent: "text-sky-700 dark:text-sky-300",
      progressActive: "bg-sky-600 dark:bg-sky-400",
      progressDone: "bg-sky-500/40 dark:bg-sky-400/40",
      badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/25",
      cta: "bg-sky-600 hover:bg-sky-700 text-white shadow-sm shadow-sky-600/25",
      ctaChip: "bg-white text-sky-600",
      orbColor: "rgba(14, 165, 233, 0.22)",
    },
  },
  {
    id: "medvault",
    index: "04",
    icon: Package,
    label: "Med",
    accentWord: "Vault",
    to: "/medvault",
    description: "Track pill counts, projected run-out dates, and nearby licensed Uganda NDA pharmacies.",
    type: "feature",
    theme: {
      surface: "from-teal-100/80 via-emerald-50/70 to-cyan-50/60 dark:from-teal-950/65 dark:via-[#112423] dark:to-emerald-950/45",
      border: "border-teal-500/30 hover:border-teal-500/50",
      accentBar: "bg-gradient-to-b from-teal-500 to-emerald-500",
      iconChip: "bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-500/25",
      dot: "bg-teal-500",
      serifAccent: "text-teal-700 dark:text-teal-300",
      progressActive: "bg-teal-600 dark:bg-teal-400",
      progressDone: "bg-teal-500/40 dark:bg-teal-400/40",
      badge: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/25",
      cta: "bg-teal-600 hover:bg-teal-700 text-white shadow-sm shadow-teal-600/25",
      ctaChip: "bg-white text-teal-600",
      orbColor: "rgba(20, 184, 166, 0.22)",
    },
  },
  {
    id: "wellness",
    index: "05",
    icon: Heart,
    label: "Wellness",
    accentWord: "Journal",
    to: "/wellness",
    description: "Log daily mood, energy, and meals to uncover patterns alongside your active regimen.",
    type: "feature",
    theme: {
      surface: "from-rose-100/80 via-pink-50/70 to-orange-50/55 dark:from-rose-950/60 dark:via-[#26141d] dark:to-pink-950/45",
      border: "border-rose-500/30 hover:border-rose-500/50",
      accentBar: "bg-gradient-to-b from-rose-500 to-pink-500",
      iconChip: "bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-md shadow-rose-500/25",
      dot: "bg-rose-500",
      serifAccent: "text-rose-700 dark:text-rose-300",
      progressActive: "bg-rose-600 dark:bg-rose-400",
      progressDone: "bg-rose-500/40 dark:bg-rose-400/40",
      badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/25",
      cta: "bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-600/25",
      ctaChip: "bg-white text-rose-600",
      orbColor: "rgba(244, 63, 94, 0.2)",
    },
  },
  {
    id: "tip2",
    index: "06",
    icon: Sparkles,
    label: "Did you",
    accentWord: "know?",
    description: "Maintaining a 12-day adherence streak measurably improves treatment recovery outcomes.",
    type: "tip",
    theme: {
      surface: "from-violet-100/80 via-indigo-50/70 to-purple-50/60 dark:from-violet-950/65 dark:via-[#1b162d] dark:to-indigo-950/45",
      border: "border-violet-500/30 hover:border-violet-500/50",
      accentBar: "bg-gradient-to-b from-violet-500 to-indigo-500",
      iconChip: "bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/25",
      dot: "bg-violet-500",
      serifAccent: "text-violet-700 dark:text-violet-300",
      progressActive: "bg-violet-600 dark:bg-violet-400",
      progressDone: "bg-violet-500/40 dark:bg-violet-400/40",
      badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/25",
      cta: "bg-violet-600 hover:bg-violet-700 text-white shadow-sm shadow-violet-600/25",
      ctaChip: "bg-white text-violet-600",
      orbColor: "rgba(139, 92, 246, 0.22)",
    },
  },
];

export function FeatureSlideshow() {
  const navigate = useNavigate();
  const [slides, setSlides] = useState<SlideItem[]>(SLIDES);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const cachedData = (() => {
      try {
        const item = sessionStorage.getItem("dawa_health_discoveries");
        return item ? JSON.parse(item) : null;
      } catch {
        return null;
      }
    })();

    const applyTips = (data: { healthTip: string; didYouKnow: string }) => {
      setSlides((prev) =>
        prev.map((slide) => {
          if (slide.id === "tip1" && data.healthTip) {
            return { ...slide, description: data.healthTip };
          }
          if (slide.id === "tip2" && data.didYouKnow) {
            return { ...slide, description: data.didYouKnow };
          }
          return slide;
        })
      );
    };

    if (cachedData) {
      applyTips(cachedData);
      return;
    }

    const fetchTips = async () => {
      try {
        const data = await aiApi.getHealthDiscoveries();
        if (data) {
          applyTips(data);
          try {
            sessionStorage.setItem("dawa_health_discoveries", JSON.stringify(data));
          } catch (e) {
            console.error("Failed to save health tips to sessionStorage", e);
          }
        }
      } catch (error) {
        console.error("Failed to fetch health tips:", error);
      }
    };
    fetchTips();
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  }, [slides.length]);

  useEffect(() => {
    if (!isPaused) {
      timerRef.current = setInterval(nextSlide, 6000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, nextSlide]);

  const current = slides[currentIndex];
  const SlideIcon = current.icon;

  const handleDragEnd = (
    _event: unknown,
    info: { offset: { x: number }; velocity: { x: number } }
  ) => {
    if (info.offset.x < -45 || info.velocity.x < -300) {
      void NativeService.haptics.selection();
      nextSlide();
    } else if (info.offset.x > 45 || info.velocity.x > 300) {
      void NativeService.haptics.selection();
      prevSlide();
    }
  };

  const theme = current.theme;

  return (
    <div
      className={`editorial-bento relative w-full mb-8 overflow-hidden bg-gradient-to-br transition-colors duration-500 ${theme.surface} ${theme.border}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      {/* Left Semantic Color Accent Bar */}
      <div
        className={`absolute left-0 top-5 bottom-5 w-[3.5px] rounded-r-full transition-colors duration-500 ${theme.accentBar}`}
        aria-hidden="true"
      />

      {/* Soft Corner Color Luminescence */}
      <div
        className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl transition-all duration-500"
        style={{ background: `radial-gradient(circle, ${theme.orbColor}, transparent 70%)` }}
        aria-hidden="true"
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.16}
          onDragEnd={handleDragEnd}
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -14 }}
          transition={{ duration: 0.28, ease: EDITORIAL_EASE }}
          className="relative z-10 w-full p-6 sm:p-7 flex flex-col min-h-[14rem] justify-between cursor-grab active:cursor-grabbing select-none touch-pan-y"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-white/25 ${theme.iconChip}`}>
                  <SlideIcon size={18} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <EditorialEyebrow
                    index={current.index}
                    label={current.type === "tip" ? "Health Discovery" : "Featured Capability"}
                    dotColor={theme.dot}
                  />
                  <span className={`editorial-mono text-[9px] px-2.5 py-0.5 rounded-full border ${theme.badge}`}>
                    {current.type === "tip" ? "Clinical Tip" : "Explore"}
                  </span>
                </div>
              </div>

              <h3 className="editorial-display text-[26px] sm:text-[30px] font-medium text-foreground leading-[1.06]">
                {current.label}{" "}
                <em className={`editorial-serif text-[1.08em] font-normal ${theme.serifAccent}`}>
                  {current.accentWord}
                </em>
              </h3>
            </div>

            {/* Color-Tinted Hairline Progress Rail */}
            <div className="flex items-center gap-1.5 shrink-0 pt-1">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`View slide ${i + 1}`}
                  onClick={() => setCurrentIndex(i)}
                  className="py-1.5"
                >
                  <span className="block relative h-[3px] w-5 sm:w-6 rounded-full bg-foreground/15 overflow-hidden">
                    {i === currentIndex && (
                      <motion.span
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: isPaused ? 0 : 1 }}
                        transition={{ duration: isPaused ? 0 : 6, ease: "linear" }}
                        className={`absolute inset-0 origin-left ${theme.progressActive}`}
                      />
                    )}
                    {i < currentIndex && (
                      <span className={`absolute inset-0 ${theme.progressDone}`} />
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-5">
            <p className="text-[14px] text-foreground/80 leading-[1.58] max-w-xl">
              {current.description}
            </p>
            {current.to && (
              <button
                type="button"
                onPointerDown={() => void NativeService.haptics.tap()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (current.to) navigate(current.to);
                }}
                className={`btn-editorial-roll self-start sm:self-end h-9 pl-4 pr-1.5 text-[12.5px] font-medium shrink-0 ${theme.cta}`}
              >
                <span>Open</span>
                <span className={`roll-chip w-6 h-6 ${theme.ctaChip}`}>
                  <ArrowRight size={12} />
                </span>
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
