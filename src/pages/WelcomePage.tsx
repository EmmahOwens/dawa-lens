import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { LOGO_BASE64 } from "@/lib/logoBase64";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Search,
  ShieldCheck,
  Zap,
  Bell,
  Users,
  Globe,
  Sparkles,
} from "@/lib/icons";
import { useApp } from "@/contexts/AppContext";
import { EDITORIAL_EASE, EditorialEyebrow } from "@/components/editorial/EditorialPrimitives";

interface WelcomeStep {
  index: string;
  category: string;
  headline: string;
  accent: string;
  subtitle: string;
  image: string;
  imageSm: string;
  objectPosition: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  meta: string;
}

const ONBOARDING_STEPS: WelcomeStep[] = [
  {
    index: "01",
    category: "Welcome",
    headline: "Karibu,",
    accent: "Dawa Lens.",
    subtitle:
      "A personal pharmacist in your pocket — built for patients and families across East Africa.",
    image: "/assets/onboarding/step-1-welcome.webp",
    imageSm: "/assets/onboarding/step-1-welcome-sm.webp",
    objectPosition: "object-[center_26%] sm:object-[center_24%]",
    icon: Sparkles,
    meta: "Offline-first · EN / LG / SW",
  },
  {
    index: "02",
    category: "Optical Vision",
    headline: "Snap. Identify.",
    accent: "Know.",
    subtitle:
      "Point your camera at any loose capsule, blister strip, or paper envelope to decode strength and usage in seconds.",
    image: "/assets/onboarding/step-2-scan.webp",
    imageSm: "/assets/onboarding/step-2-scan-sm.webp",
    objectPosition: "object-[center_26%] sm:object-[center_24%]",
    icon: Search,
    meta: "On-device OCR · Sub-ms Rust search",
  },
  {
    index: "03",
    category: "Verified Safety",
    headline: "Clinical data,",
    accent: "verified.",
    subtitle:
      "Authoritative guidance on dosages, side effects, and FDA boxed warnings cross-checked against essential medicine registries.",
    image: "/assets/onboarding/step-3-safety.webp",
    imageSm: "/assets/onboarding/step-3-safety-sm.webp",
    objectPosition: "object-[center_34%] sm:object-[center_30%]",
    icon: ShieldCheck,
    meta: "EMLU · NIH RxNorm · OpenFDA",
  },
  {
    index: "04",
    category: "Interaction Guard",
    headline: "Meal & drug",
    accent: "shield.",
    subtitle:
      "Proactively flags drug-drug conflicts alongside everyday Ugandan meals — from calcium-rich mukene to potassium-rich matooke.",
    image: "/assets/onboarding/step-4-interactions.webp",
    imageSm: "/assets/onboarding/step-4-interactions-sm.webp",
    objectPosition: "object-[center_28%] sm:object-[center_25%]",
    icon: Zap,
    meta: "Real-time clinical & dietary matrix",
  },
  {
    index: "05",
    category: "Adherence",
    headline: "Never miss",
    accent: "a dose.",
    subtitle:
      "Calm, battery-resilient reminders engineered for real Android devices, with instant Take, Snooze, and Skip actions.",
    image: "/assets/onboarding/step-5-reminders.webp",
    imageSm: "/assets/onboarding/step-5-reminders-sm.webp",
    objectPosition: "object-[center_28%] sm:object-[center_25%]",
    icon: Bell,
    meta: "Exact native alarm watchdog",
  },
  {
    index: "06",
    category: "Family Hub",
    headline: "Care for",
    accent: "everyone.",
    subtitle:
      "Coordinate prescriptions, stock counts, and live dose confirmations for aging parents and children from one place.",
    image: "/assets/onboarding/step-6-family.webp",
    imageSm: "/assets/onboarding/step-6-family-sm.webp",
    objectPosition: "object-[center_30%] sm:object-[center_28%]",
    icon: Users,
    meta: "Shared caregiver sync · PDF reports",
  },
  {
    index: "07",
    category: "NDA Registry",
    headline: "Verified local",
    accent: "pharmacies.",
    subtitle:
      "Locate 1,800+ licensed Uganda National Drug Authority pharmacies by proximity — even when mobile data drops.",
    image: "/assets/onboarding/step-7-guidance.webp",
    imageSm: "/assets/onboarding/step-7-guidance-sm.webp",
    objectPosition: "object-[center_30%] sm:object-[center_28%]",
    icon: Globe,
    meta: "1,800+ NDA licensed pharmacies",
  },
  {
    index: "08",
    category: "Ready",
    headline: "Clarity for",
    accent: "every dose.",
    subtitle:
      "Begin your personalized clinical lens in under a minute — private, offline-capable, and built around your daily routine.",
    image: "/assets/onboarding/step-8-ready.webp",
    imageSm: "/assets/onboarding/step-8-ready-sm.webp",
    objectPosition: "object-[center_28%] sm:object-[center_26%]",
    icon: Sparkles,
    meta: "Private · Encrypted local persistence",
  },
];

export default function WelcomePage() {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  const { setHasSeenWelcome } = useApp();

  // Preload responsive onboarding images for zero-flash transitions
  useEffect(() => {
    const isSmallScreen = typeof window !== "undefined" && window.innerWidth < 640;
    ONBOARDING_STEPS.forEach((s) => {
      const img = new Image();
      img.src = isSmallScreen ? s.imageSm : s.image;
    });
  }, []);

  const handleFinish = useCallback(() => {
    setHasSeenWelcome(true);
    navigate("/auth");
  }, [navigate, setHasSeenWelcome]);

  const handleNext = useCallback(() => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      handleFinish();
    }
  }, [currentStep, handleFinish]);

  const handlePrev = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  // Keyboard navigation on desktop
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleNext, handlePrev]);

  const step = ONBOARDING_STEPS[currentStep];
  const StepIcon = step.icon;
  const isLast = currentStep === ONBOARDING_STEPS.length - 1;

  return (
    <div className="relative h-[100dvh] min-h-[100dvh] w-full bg-[#091529] sm:p-4 md:p-5 overflow-hidden select-none">
      {/* Inset-Frame Photographic Stage */}
      <div className="relative h-full w-full sm:rounded-[28px] md:rounded-[34px] overflow-hidden bg-[#0c1b36] sm:border sm:border-sky-200/15 flex flex-col justify-between">
        {/* Background Photographic Media Layer with Settle-Zoom */}
        <AnimatePresence mode="sync">
          <motion.div
            key={`bg-${currentStep}`}
            initial={{ opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: EDITORIAL_EASE }}
            className="absolute inset-0 z-0 w-full h-full overflow-hidden"
          >
            <img
              src={step.imageSm}
              alt=""
              aria-hidden="true"
              className="hidden lg:block absolute inset-0 w-full h-full object-cover scale-110 blur-3xl opacity-45 pointer-events-none"
              draggable={false}
            />

            <picture className="block w-full h-full">
              <source media="(max-width: 639px)" srcSet={step.imageSm} type="image/webp" />
              <source media="(min-width: 640px)" srcSet={step.image} type="image/webp" />
              <img
                src={step.image}
                srcSet={`${step.imageSm} 640w, ${step.image} 1024w`}
                sizes="100vw"
                alt={`${step.headline} ${step.accent}`}
                fetchPriority="high"
                decoding="async"
                draggable={false}
                className={`w-full h-full object-cover ${step.objectPosition} pointer-events-none`}
              />
            </picture>

            {/* Directional edge-blend scrims (no flat black wash, no neon blobs) */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[#060709]/80 via-[#060709]/35 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[74%] sm:h-[66%] bg-gradient-to-t from-[#060709] via-[#060709]/85 to-transparent" />
            <div className="pointer-events-none hidden md:block absolute inset-y-0 left-0 w-[55%] bg-gradient-to-r from-[#060709]/70 via-[#060709]/25 to-transparent" />

            {/* Subtle static SVG film grain */}
            <div className="editorial-grain" aria-hidden="true" />
          </motion.div>
        </AnimatePresence>

        {/* Top Editorial Navigation Bar (Wordmark · Step Index · Skip Pill) */}
        <header className="relative z-20 flex items-center justify-between px-5 sm:px-8 md:px-12 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 w-full shrink-0">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EDITORIAL_EASE }}
            className="flex items-center gap-3"
          >
            <div className="editorial-glass-dark w-10 h-10 rounded-full flex items-center justify-center p-2">
              <img
                src={LOGO_BASE64}
                alt="Dawa Lens"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="leading-none">
              <span className="font-medium text-white tracking-[-0.025em] text-[16px] sm:text-[17px] block">
                Dawa Lens<sup className="text-[9px] text-white/50 ml-0.5">®</sup>
              </span>
              <span className="editorial-mono text-[9px] text-white/55 mt-1 block">
                Clinical Suite
              </span>
            </div>
          </motion.div>

          {/* Center Mono Counter (Desktop) */}
          <div className="hidden md:flex items-center gap-3 editorial-glass-dark rounded-full px-4 py-2">
            <span className="editorial-mono text-[10px] text-white/90 editorial-tabular">
              {step.index} / 0{ONBOARDING_STEPS.length}
            </span>
            <span className="h-3 w-px bg-white/20" aria-hidden="true" />
            <span className="editorial-mono text-[10px] text-white/60">
              {step.category}
            </span>
          </div>

          <button
            type="button"
            onClick={handleFinish}
            className="editorial-glass-dark rounded-full px-4 sm:px-5 h-9 sm:h-10 text-[12.5px] sm:text-[13px] font-medium text-white/85 hover:text-white hover:bg-white/10 transition-colors active:scale-95"
          >
            Skip Intro
          </button>
        </header>

        {/* Bottom-Anchored Editorial Stage */}
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.14}
          onDragEnd={(_, info) => {
            if (info.offset.x < -55) handleNext();
            else if (info.offset.x > 55) handlePrev();
          }}
          className="relative z-20 w-full px-5 sm:px-8 md:px-12 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-6 shrink-0"
        >
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-7 md:gap-12">
            {/* Left Column: Editorial Headline & Subcopy */}
            <div className="max-w-xl">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
                  transition={{ duration: 0.5, ease: EDITORIAL_EASE }}
                >
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="editorial-glass-dark w-8 h-8 rounded-full inline-flex items-center justify-center text-white/90">
                      <StepIcon size={14} />
                    </span>
                    <EditorialEyebrow
                      index={`${step.index} of 0${ONBOARDING_STEPS.length}`}
                      label={step.category}
                      onDark
                    />
                  </div>

                  <h1 className="editorial-display text-[clamp(38px,7.5vw,76px)] font-medium text-white leading-[0.96] tracking-[-0.04em] mb-4 drop-shadow-[0_12px_32px_rgba(0,0,0,0.45)]">
                    <span className="block">{step.headline}</span>
                    <em className="editorial-serif text-[1.08em] text-white/70 font-normal block">
                      {step.accent}
                    </em>
                  </h1>

                  <p className="text-[14.5px] sm:text-[16px] text-white/80 font-normal leading-[1.58] max-w-[30rem] drop-shadow-[0_2px_14px_rgba(0,0,0,0.55)]">
                    {step.subtitle}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Right Column: Controls, Meta Strip & Hairline Progress */}
            <div className="w-full md:w-[360px] shrink-0 flex flex-col gap-4">
              {/* Quiet metadata line */}
              <div className="flex items-center justify-between text-white/55">
                <span className="editorial-mono text-[10px] truncate">{step.meta}</span>
                <span className="editorial-mono text-[10px] editorial-tabular text-white/45 md:hidden">
                  {step.index} / 0{ONBOARDING_STEPS.length}
                </span>
              </div>

              {/* Hairline Segmented Progress Rail */}
              <div className="w-full flex gap-1.5" role="tablist" aria-label="Onboarding steps">
                {ONBOARDING_STEPS.map((s, i) => (
                  <button
                    key={s.index}
                    type="button"
                    role="tab"
                    aria-selected={i === currentStep}
                    aria-label={`Go to step ${i + 1}: ${s.category}`}
                    onClick={() => setCurrentStep(i)}
                    className="flex-1 py-2 group focus:outline-none"
                  >
                    <span className="block h-[2px] w-full rounded-full bg-white/20 overflow-hidden">
                      <span
                        className={`block h-full rounded-full transition-all duration-500 ease-out-expo ${
                          i < currentStep
                            ? "w-full bg-white/55"
                            : i === currentStep
                              ? "w-full bg-white"
                              : "w-0 bg-transparent"
                        }`}
                      />
                    </span>
                  </button>
                ))}
              </div>

              {/* Action Pill Row */}
              <div className="flex items-center gap-2.5">
                {currentStep > 0 && (
                  <button
                    type="button"
                    onClick={handlePrev}
                    aria-label="Previous step"
                    className="editorial-glass-dark h-12 w-12 rounded-full inline-flex items-center justify-center text-white/85 hover:text-white hover:bg-white/10 transition-colors active:scale-95 shrink-0"
                  >
                    <ArrowLeft size={16} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleNext}
                  className="btn-editorial-roll flex-1 h-12 sm:h-[52px] pl-6 pr-2.5 bg-white hover:bg-white/95 text-[#0d2244] text-[14.5px] font-medium justify-between shadow-[0_12px_32px_rgba(9,21,41,0.4)]"
                >
                  <span>{isLast ? "Get Started" : "Continue"}</span>
                  <span className="roll-chip w-8 h-8 bg-[#0066cc] text-white">
                    <ArrowRight size={14} />
                  </span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
