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
    icon: Sparkles,
    glowColor: "rgba(0, 102, 204, 0.45)",
    accentHex: "#0066cc",
    iconColor: "text-[#0066cc] dark:text-[#2997ff]",
  },
  {
    category: "Smart Vision",
    title: "Snap. Identify. Learn.",
    subtitle: "Identify any pill or medication packaging instantly using our advanced AI vision engine.",
    image: "/assets/onboarding/step-2-scan.webp",
    icon: Search,
    glowColor: "rgba(2, 132, 199, 0.45)",
    accentHex: "#0284c7",
    iconColor: "text-sky-600 dark:text-sky-400",
  },
  {
    category: "Verified Safety",
    title: "Verified Clinical Data",
    subtitle: "Get authoritative guidance on side effects, dosages, and certified medical literature.",
    image: "/assets/onboarding/step-3-safety.webp",
    icon: ShieldCheck,
    glowColor: "rgba(37, 99, 235, 0.45)",
    accentHex: "#2563eb",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  {
    category: "Interaction Guard",
    title: "Interaction Shield",
    subtitle: "We proactively check for adverse drug-drug and food-drug conflicts in real time.",
    image: "/assets/onboarding/step-4-interactions.webp",
    icon: Zap,
    glowColor: "rgba(245, 158, 11, 0.45)",
    accentHex: "#f59e0b",
    iconColor: "text-amber-500 dark:text-amber-400",
  },
  {
    category: "Adherence",
    title: "Never Miss a Dose",
    subtitle: "Intelligent, gentle reminders adapted seamlessly to your personal daily routine.",
    image: "/assets/onboarding/step-5-reminders.webp",
    icon: Bell,
    glowColor: "rgba(236, 72, 153, 0.45)",
    accentHex: "#ec4899",
    iconColor: "text-pink-500 dark:text-pink-400",
  },
  {
    category: "Family Hub",
    title: "Care for Your Family",
    subtitle: "Safely coordinate prescriptions, profiles, and reminders for your entire household.",
    image: "/assets/onboarding/step-6-family.webp",
    icon: Users,
    glowColor: "rgba(139, 92, 246, 0.45)",
    accentHex: "#8b5cf6",
    iconColor: "text-purple-500 dark:text-purple-400",
  },
  {
    category: "Regulatory Guidance",
    title: "Clear Medical Guidance",
    subtitle: "Access verified national formulary listings and localized emergency poison hotline contacts.",
    image: "/assets/onboarding/step-7-guidance.webp",
    icon: Globe,
    glowColor: "rgba(16, 185, 129, 0.45)",
    accentHex: "#10b981",
    iconColor: "text-emerald-500 dark:text-emerald-400",
  },
  {
    category: "Ready",
    title: "Ready to Begin?",
    subtitle: "Join thousands taking control of their medication safety with precision intelligence.",
    image: "/assets/onboarding/step-8-ready.webp",
    icon: Rocket,
    glowColor: "rgba(0, 113, 227, 0.5)",
    accentHex: "#0071e3",
    iconColor: "text-[#0071e3] dark:text-[#2997ff]",
  }
];

export default function WelcomePage() {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  const { setHasSeenWelcome } = useApp();

  // Preload onboarding images for instant transitions
  useEffect(() => {
    ONBOARDING_STEPS.forEach((s) => {
      const img = new Image();
      img.src = s.image;
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
    <div className="h-[100dvh] min-h-[100dvh] flex flex-col bg-background relative overflow-hidden">
      {/* Dynamic Atmospheric Multi-Hue Radial Glow */}
      <motion.div
        key={`glow-${currentStep}`}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.45, scale: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] sm:w-[460px] sm:h-[460px] rounded-full blur-3xl z-0"
        style={{ background: step.glowColor }}
      />
      {/* Secondary Soft Ambient Tint */}
      <div className="pointer-events-none absolute bottom-0 inset-x-0 h-64 bg-gradient-to-t from-[#0066cc]/5 via-transparent to-transparent z-0" />

      {/* Header (Logo & Skip) */}
      <div className="relative z-20 flex items-center justify-between p-5 sm:p-6 shrink-0 border-b border-border/40 backdrop-blur-md bg-background/70">
        <motion.div 
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-[12px] bg-white/90 dark:bg-[#272729]/90 border border-[#0066cc]/20 dark:border-[#2997ff]/30 shadow-sm flex items-center justify-center p-1.5">
            <img src={LOGO_BASE64} alt="Dawa Lens Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="font-bold text-foreground tracking-tight text-lg leading-tight block">Dawa Lens</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#0066cc] dark:text-[#2997ff]">Clinical Suite</span>
          </div>
        </motion.div>
        <button 
          className="text-xs font-semibold text-[#0066cc] dark:text-[#2997ff] hover:text-[#0071e3] px-3.5 py-1.5 rounded-full bg-[#0066cc]/10 dark:bg-[#2997ff]/15 hover:bg-[#0066cc]/15 transition-all"
          onClick={handleFinish}
        >
          Skip Intro
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10 w-full max-w-md mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="w-full flex flex-col items-center"
          >
            {/* Step Category Pill Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold mb-6 border backdrop-blur-md transition-colors duration-300 shadow-sm"
              style={{ 
                backgroundColor: `${step.accentHex}15`, 
                color: step.accentHex, 
                borderColor: `${step.accentHex}30` 
              }}
            >
              <Icon size={14} />
              <span>Step {currentStep + 1} of 8 • {step.category}</span>
            </motion.div>

            {/* Onboarding Visual Showcase Card */}
            <motion.div 
              className="relative w-64 h-64 sm:w-72 sm:h-72 mb-7 rounded-[32px] bg-white/80 dark:bg-[#272729]/80 border border-white/60 dark:border-white/10 shadow-[0_20px_50px_rgba(0,102,204,0.12)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden flex items-center justify-center backdrop-blur-md"
              initial={{ scale: 0.94 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              <img
                src={step.image}
                alt={step.title}
                className="w-full h-full object-cover select-none"
                draggable={false}
              />
              {/* Floating Dynamic Icon Badge */}
              <div 
                className="absolute bottom-4 right-4 w-12 h-12 rounded-2xl bg-white/95 dark:bg-[#1d1d1f]/95 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-lg flex items-center justify-center transition-all duration-300"
                style={{ boxShadow: `0 8px 24px ${step.glowColor}` }}
              >
                <Icon size={22} className={step.iconColor} />
              </div>
            </motion.div>

            {/* Typography */}
            <div className="text-center space-y-2.5 w-full">
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-[-0.022em] leading-tight">
                {step.title}
              </h1>
              <p className="text-[17px] text-muted-foreground font-normal leading-relaxed px-2">
                {step.subtitle}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer (Navigation & Progress) */}
      <div className="relative z-20 px-6 pb-8 sm:pb-10 pt-4 w-full max-w-md mx-auto flex flex-col items-center gap-6 shrink-0">
        
        {/* Segmented Progress Bar */}
        <div className="w-full flex gap-1.5 h-1.5 px-2">
          {ONBOARDING_STEPS.map((s, i) => (
            <div key={i} className="flex-1 h-full rounded-full bg-muted/60 overflow-hidden relative">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  i < currentStep 
                    ? "bg-[#0066cc]/40 dark:bg-[#2997ff]/40" 
                    : i === currentStep 
                      ? "bg-[#0066cc] dark:bg-[#2997ff] shadow-[0_0_8px_rgba(0,102,204,0.7)]" 
                      : "bg-transparent"
                }`}
              />
            </div>
          ))}
        </div>

        {/* Action Button - Apple Action Blue Pill */}
        <button
          onClick={handleNext}
          className="w-full h-12 rounded-full text-base font-semibold bg-gradient-to-r from-[#0066cc] to-[#0071e3] hover:from-[#005bb5] hover:to-[#0066cc] text-white shadow-[0_4px_16px_rgba(0,102,204,0.35)] dark:shadow-[0_4px_16px_rgba(41,151,255,0.25)] hover:shadow-[0_6px_20px_rgba(0,102,204,0.45)] transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
        >
          {currentStep === ONBOARDING_STEPS.length - 1 ? (
            <>
              Get Started <Rocket size={18} />
            </>
          ) : (
            <>
              Continue <ChevronRight size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
