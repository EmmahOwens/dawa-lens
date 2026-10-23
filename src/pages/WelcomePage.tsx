import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LOGO_BASE64 } from "@/lib/logoBase64";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronRight, 
  Search, 
  ShieldCheck, 
  Zap, 
  Bell, 
  Users, 
  Globe, 
  Rocket,
  Sparkles
} from "@/lib/icons";
import { useApp } from "@/contexts/AppContext";

const ONBOARDING_STEPS = [
  {
    category: "Welcome",
    title: "Karibu Dawa Lens",
    subtitle: "Your intelligent companion for medication safety, dose management, and health clarity.",
    image: "/assets/onboarding/step-1-welcome.webp",
    imageSm: "/assets/onboarding/step-1-welcome-sm.webp",
    objectPosition: "object-[center_28%] sm:object-[center_25%]",
    icon: Sparkles,
    glowColor: "rgba(0, 102, 204, 0.45)",
    accentHex: "#38bdf8",
    iconColor: "text-sky-400",
  },
  {
    category: "Smart Vision",
    title: "Snap. Identify. Learn.",
    subtitle: "Identify any pill or medication packaging instantly using our advanced AI vision engine.",
    image: "/assets/onboarding/step-2-scan.webp",
    imageSm: "/assets/onboarding/step-2-scan-sm.webp",
    objectPosition: "object-[center_40%] sm:object-center",
    icon: Search,
    glowColor: "rgba(2, 132, 199, 0.45)",
    accentHex: "#2dd4bf",
    iconColor: "text-teal-400",
  },
  {
    category: "Verified Safety",
    title: "Verified Clinical Data",
    subtitle: "Get authoritative guidance on side effects, dosages, and certified medical literature.",
    image: "/assets/onboarding/step-3-safety.webp",
    imageSm: "/assets/onboarding/step-3-safety-sm.webp",
    objectPosition: "object-[center_35%] sm:object-center",
    icon: ShieldCheck,
    glowColor: "rgba(37, 99, 235, 0.45)",
    accentHex: "#60a5fa",
    iconColor: "text-blue-400",
  },
  {
    category: "Interaction Guard",
    title: "Interaction Shield",
    subtitle: "We proactively check for adverse drug-drug and food-drug conflicts in real time.",
    image: "/assets/onboarding/step-4-interactions.webp",
    imageSm: "/assets/onboarding/step-4-interactions-sm.webp",
    objectPosition: "object-[center_42%] sm:object-center",
    icon: Zap,
    glowColor: "rgba(245, 158, 11, 0.45)",
    accentHex: "#fbbf24",
    iconColor: "text-amber-400",
  },
  {
    category: "Adherence",
    title: "Never Miss a Dose",
    subtitle: "Intelligent, gentle reminders adapted seamlessly to your personal daily routine.",
    image: "/assets/onboarding/step-5-reminders.webp",
    imageSm: "/assets/onboarding/step-5-reminders-sm.webp",
    objectPosition: "object-[center_28%] sm:object-[center_25%]",
    icon: Bell,
    glowColor: "rgba(236, 72, 153, 0.45)",
    accentHex: "#f472b6",
    iconColor: "text-pink-400",
  },
  {
    category: "Family Hub",
    title: "Care for Your Family",
    subtitle: "Safely coordinate prescriptions, profiles, and reminders for your entire household.",
    image: "/assets/onboarding/step-6-family.webp",
    imageSm: "/assets/onboarding/step-6-family-sm.webp",
    objectPosition: "object-[center_30%] sm:object-[center_28%]",
    icon: Users,
    glowColor: "rgba(139, 92, 246, 0.45)",
    accentHex: "#c084fc",
    iconColor: "text-purple-400",
  },
  {
    category: "Regulatory Guidance",
    title: "Clear Medical Guidance",
    subtitle: "Access verified national formulary listings and localized emergency poison hotline contacts.",
    image: "/assets/onboarding/step-7-guidance.webp",
    imageSm: "/assets/onboarding/step-7-guidance-sm.webp",
    objectPosition: "object-[center_38%] sm:object-center",
    icon: Globe,
    glowColor: "rgba(16, 185, 129, 0.45)",
    accentHex: "#34d399",
    iconColor: "text-emerald-400",
  },
  {
    category: "Ready",
    title: "Ready to Begin?",
    subtitle: "Join thousands taking control of their medication safety with precision intelligence.",
    image: "/assets/onboarding/step-8-ready.webp",
    imageSm: "/assets/onboarding/step-8-ready-sm.webp",
    objectPosition: "object-[center_35%] sm:object-center",
    icon: Rocket,
    glowColor: "rgba(0, 113, 227, 0.5)",
    accentHex: "#38bdf8",
    iconColor: "text-sky-400",
  }
];

export default function WelcomePage() {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  const { setHasSeenWelcome } = useApp();

  // Preload responsive onboarding images for instant transitions across all screen sizes
  useEffect(() => {
    const isSmallScreen = typeof window !== "undefined" && window.innerWidth < 640;
    ONBOARDING_STEPS.forEach((s) => {
      const img = new Image();
      img.src = isSmallScreen ? s.imageSm : s.image;
    });
  }, []);

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = () => {
    setHasSeenWelcome(true);
    navigate("/auth");
  };

  const step = ONBOARDING_STEPS[currentStep];
  const Icon = step.icon;

  return (
    <div className="relative h-[100dvh] min-h-[100dvh] w-full flex flex-col justify-between overflow-hidden bg-slate-950 select-none">
      {/* Full-Screen Responsive Background Image Layer */}
      <AnimatePresence mode="sync">
        <motion.div
          key={`bg-${currentStep}`}
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 z-0 w-full h-full overflow-hidden"
        >
          {/* Ambient Blurred Backdrop for Ultrawide / Landscape Screens */}
          <img
            src={step.imageSm}
            alt=""
            aria-hidden="true"
            className="hidden lg:block absolute inset-0 w-full h-full object-cover scale-110 blur-3xl opacity-55 pointer-events-none"
            draggable={false}
          />

          {/* Primary Full-Bleed Responsive Illustration */}
          <picture className="block w-full h-full">
            <source media="(max-width: 639px)" srcSet={step.imageSm} type="image/webp" />
            <source media="(min-width: 640px)" srcSet={step.image} type="image/webp" />
            <img
              src={step.image}
              srcSet={`${step.imageSm} 640w, ${step.image} 1024w`}
              sizes="100vw"
              alt={step.title}
              fetchPriority="high"
              decoding="async"
              draggable={false}
              className={`w-full h-full object-cover ${step.objectPosition} pointer-events-none transition-transform duration-700`}
            />
          </picture>

          {/* Top Scrim for Header Legibility */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 sm:h-40 bg-gradient-to-b from-black/70 via-black/30 to-transparent" />

          {/* Bottom Scrim for Foreground Typography & Controls Legibility */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[72%] sm:h-[68%] bg-gradient-to-t from-slate-950 via-slate-950/85 to-transparent" />

          {/* Subtle Dynamic Accent Glow at Bottom */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-72 opacity-35 blur-3xl transition-colors duration-700"
            style={{ background: `radial-gradient(circle at 50% 100%, ${step.glowColor}, transparent 70%)` }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Top Header (Logo & Skip) */}
      <header className="relative z-20 flex items-center justify-between px-5 py-4 sm:px-8 sm:py-6 w-full max-w-6xl mx-auto shrink-0">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[12px] bg-white/15 backdrop-blur-md border border-white/25 shadow-lg flex items-center justify-center p-1.5">
            <img src={LOGO_BASE64} alt="Dawa Lens Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="font-bold text-white tracking-tight text-lg sm:text-xl leading-tight block drop-shadow-sm">
              Dawa Lens
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-300 block">
              Clinical Suite
            </span>
          </div>
        </motion.div>

        <button
          className="text-xs sm:text-sm font-semibold text-white/90 hover:text-white px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 transition-all active:scale-95 shadow-sm"
          onClick={handleFinish}
        >
          Skip Intro
        </button>
      </header>

      {/* Foreground Content & Controls Area */}
      <div className="relative z-20 w-full max-w-xl mx-auto px-6 pb-8 sm:pb-12 pt-6 flex flex-col justify-end shrink-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="w-full flex flex-col items-center text-center mb-7 sm:mb-8"
          >
            {/* Step Category Pill & Floating Icon Badge */}
            <div className="flex items-center gap-2.5 mb-4 sm:mb-5">
              <div
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/15 backdrop-blur-xl border border-white/25 flex items-center justify-center shadow-lg"
                style={{ boxShadow: `0 6px 20px ${step.glowColor}` }}
              >
                <Icon size={18} className={step.iconColor} />
              </div>
              <div
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border backdrop-blur-xl shadow-sm"
                style={{
                  backgroundColor: "rgba(15, 23, 42, 0.55)",
                  color: step.accentHex,
                  borderColor: `${step.accentHex}45`,
                }}
              >
                <span>Step {currentStep + 1} of {ONBOARDING_STEPS.length} • {step.category}</span>
              </div>
            </div>

            {/* Foreground Typography */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-[-0.025em] leading-[1.12] drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)] mb-3">
              {step.title}
            </h1>
            <p className="text-base sm:text-lg md:text-[19px] text-white/85 font-normal leading-relaxed max-w-md mx-auto drop-shadow-[0_1px_6px_rgba(0,0,0,0.45)]">
              {step.subtitle}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Navigation & Progress Controls */}
        <div className="w-full flex flex-col items-center gap-5">
          {/* Segmented Progress Bar */}
          <div className="w-full flex gap-1.5 h-1.5 px-1">
            {ONBOARDING_STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to step ${i + 1}`}
                onClick={() => setCurrentStep(i)}
                className="flex-1 h-full rounded-full bg-white/20 overflow-hidden relative cursor-pointer focus:outline-none"
              >
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    i < currentStep
                      ? "bg-white/60"
                      : i === currentStep
                        ? "bg-[#2997ff] shadow-[0_0_10px_rgba(41,151,255,0.9)]"
                        : "bg-transparent"
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Action Button */}
          <button
            onClick={handleNext}
            className="w-full h-12 sm:h-14 rounded-full text-base sm:text-lg font-semibold bg-gradient-to-r from-[#0066cc] to-[#0071e3] hover:from-[#005bb5] hover:to-[#0066cc] text-white shadow-[0_8px_28px_rgba(0,113,227,0.45)] hover:shadow-[0_10px_32px_rgba(0,113,227,0.6)] border border-white/15 transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {currentStep === ONBOARDING_STEPS.length - 1 ? (
              <>
                Get Started <Rocket size={19} />
              </>
            ) : (
              <>
                Continue <ChevronRight size={19} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
