import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";

const ONBOARDING_STEPS = [
  {
    title: "Karibu Dawa Lens",
    subtitle: "Your intelligent companion for medication safety and health clarity.",
    icon: Sparkles,
    color: "rgba(99, 102, 241, 0.4)", // Indigo glow
    iconColor: "text-indigo-500",
  },
  {
    title: "Snap. Identify. Learn.",
    subtitle: "Identify any pill or medication instantly using our AI vision technology.",
    icon: Search,
    color: "rgba(20, 184, 166, 0.4)", // Teal glow
    iconColor: "text-teal-500",
  },
  {
    title: "Verified Safety Data",
    subtitle: "Get detailed information on side effects, dosages, and verified health data.",
    icon: ShieldCheck,
    color: "rgba(59, 130, 246, 0.4)", // Blue glow
    iconColor: "text-blue-500",
  },
  {
    title: "Interaction Shield",
    subtitle: "We automatically check for dangerous conflicts between your medications.",
    icon: Zap,
    color: "rgba(239, 68, 68, 0.4)", // Red glow
    iconColor: "text-red-500",
  },
  {
    title: "Never Miss a Dose",
    subtitle: "Smart, gentle reminders tailored perfectly to your daily routine.",
    icon: Bell,
    color: "rgba(236, 72, 153, 0.4)", // Pink glow
    iconColor: "text-pink-500",
  },
  {
    title: "Care for Your Family",
    subtitle: "Manage medications and health profiles for your entire household.",
    icon: Users,
    color: "rgba(139, 92, 246, 0.4)", // Violet glow
    iconColor: "text-violet-500",
  },
  {
    title: "Clear Medical Guidance",
    subtitle: "Clear, reliable medical information and safety warnings at your fingertips.",
    icon: Globe,
    color: "rgba(16, 185, 129, 0.4)", // Emerald glow
    iconColor: "text-emerald-500",
  },
  {
    title: "Ready to Begin?",
    subtitle: "Join thousands of users managing their health with smarter medicine tools.",
    icon: Rocket,
    color: "rgba(124, 58, 237, 0.4)", // Purple glow
    iconColor: "text-purple-500",
  }
];

export default function WelcomePage() {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  const { setHasSeenWelcome } = useApp();

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
      {/* Header (Logo & Skip) */}
      <div className="relative z-20 flex items-center justify-between p-5 sm:p-6 shrink-0 border-b border-border/40">
        <motion.div 
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2.5"
        >
          <img src={LOGO_BASE64} alt="Dawa Lens Logo" className="w-8 h-8 object-contain" />
          <span className="font-bold text-foreground tracking-tight text-lg">Dawa Lens</span>
        </motion.div>
        <button 
          className="text-xs font-semibold text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full hover:bg-secondary transition-colors"
          onClick={handleFinish}
        >
          Skip
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
            {/* Apple Icon Capsule */}
            <motion.div 
              className="relative w-28 h-28 sm:w-32 sm:h-32 mb-8 rounded-[24px] bg-[#f5f5f7] dark:bg-[#272729] border border-border flex items-center justify-center"
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <Icon size={48} className={step.iconColor} />
            </motion.div>

            {/* Typography */}
            <div className="text-center space-y-3 w-full">
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-[-0.022em] leading-tight">
                {step.title}
              </h1>
              <p className="text-[17px] text-muted-foreground font-normal leading-relaxed px-4">
                {step.subtitle}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer (Navigation & Progress) */}
      <div className="relative z-20 px-6 pb-8 sm:pb-10 pt-4 w-full max-w-md mx-auto flex flex-col items-center gap-6 shrink-0">
        
        {/* Segmented Progress Bar */}
        <div className="w-full flex gap-1.5 h-1 px-4">
          {ONBOARDING_STEPS.map((_, i) => (
            <div key={i} className="flex-1 h-full rounded-full bg-muted/60 overflow-hidden relative">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  i <= currentStep ? "bg-[#0066cc] dark:bg-[#2997ff]" : "bg-transparent"
                }`}
              />
            </div>
          ))}
        </div>

        {/* Action Button - Apple Action Blue Pill */}
        <button
          onClick={handleNext}
          className="w-full h-12 rounded-full text-base font-semibold transition-transform active:scale-95 bg-[#0066cc] dark:bg-[#0071e3] text-white hover:opacity-95 flex items-center justify-center gap-2"
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
