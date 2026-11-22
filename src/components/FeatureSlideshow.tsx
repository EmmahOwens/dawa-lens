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

interface SlideItem {
  id: string;
  index: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  accentWord: string;
  to?: string;
  description: string;
  type: "feature" | "tip";
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
  },
  {
    id: "tip1",
    index: "02",
    icon: Lightbulb,
    label: "Clinical",
    accentWord: "Insight",
    description: "Taking oral medications with plain water instead of juice improves absorption consistency.",
    type: "tip",
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
  },
  {
    id: "tip2",
    index: "06",
    icon: Sparkles,
    label: "Did you",
    accentWord: "know?",
    description: "Maintaining a 12-day adherence streak measurably improves treatment recovery outcomes.",
    type: "tip",
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

  return (
    <div
      className="editorial-card relative w-full mb-8 overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
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
          className="relative w-full p-6 sm:p-7 flex flex-col min-h-[13.5rem] justify-between cursor-grab active:cursor-grabbing select-none touch-pan-y"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-secondary border border-border/80 text-foreground flex items-center justify-center shrink-0">
                  <SlideIcon size={17} />
                </div>
                <EditorialEyebrow
                  index={current.index}
                  label={current.type === "tip" ? "Health Discovery" : "Featured Capability"}
                  dotColor={current.type === "tip" ? "bg-amber-500" : "bg-primary"}
                />
              </div>

              <h3 className="editorial-display text-[24px] sm:text-[28px] font-medium text-foreground leading-[1.06]">
                {current.label}{" "}
                <em className="editorial-serif text-[1.08em] text-muted-foreground font-normal">
                  {current.accentWord}
                </em>
              </h3>
            </div>

            {/* Minimal Hairline Progress Rail */}
            <div className="flex items-center gap-1.5 shrink-0 pt-1">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`View slide ${i + 1}`}
                  onClick={() => setCurrentIndex(i)}
                  className="py-1.5"
                >
                  <span className="block relative h-[2px] w-5 sm:w-6 rounded-full bg-border overflow-hidden">
                    {i === currentIndex && (
                      <motion.span
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: isPaused ? 0 : 1 }}
                        transition={{ duration: isPaused ? 0 : 6, ease: "linear" }}
                        className="absolute inset-0 origin-left bg-foreground"
                      />
                    )}
                    {i < currentIndex && (
                      <span className="absolute inset-0 bg-foreground/45" />
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-4">
            <p className="text-[14px] text-muted-foreground leading-[1.58] max-w-xl">
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
                className="btn-editorial-roll self-start sm:self-end h-9 pl-4 pr-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20 text-[12.5px] font-medium shrink-0"
              >
                <span>Open</span>
                <span className="roll-chip w-6 h-6 bg-white text-primary">
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
