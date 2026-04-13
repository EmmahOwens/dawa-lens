import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronRight, 
  ChevronLeft, 
  Search, 
  ShieldCheck, 
  Zap, 
  Bell, 
  Users, 
  Globe, 
  Rocket,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";

const ONBOARDING_STEPS = [
  {
    title: "Karibu Dawa Lens",
    subtitle: "Your intelligent companion for medication safety and health clarity.",
    emoji: "👋",
    color: "from-indigo-500/20 to-purple-500/20",
    icon: null
  },
  {
    title: "Snap. Identify. Learn.",
    subtitle: "Identify any pill or medication instantly using our AI vision technology.",
    emoji: "🔍",
    color: "from-teal-500/20 to-cyan-500/20",
    icon: Search
  },
  {
    title: "Verified Safety Data",
    subtitle: "Get detailed information on side effects, dosages, and verified health data.",
    emoji: "🛡️",
    color: "from-blue-500/20 to-indigo-500/20",
    icon: ShieldCheck
  },
  {
    title: "Interaction Shield",
    subtitle: "We automatically check for dangerous conflicts between your medications.",
    emoji: "⚡",
    color: "from-orange-500/20 to-red-500/20",
    icon: Zap
  },
  {
    title: "Never Miss a Dose",
    subtitle: "Smart, gentle reminders tailored perfectly to your daily routine.",
    emoji: "⏰",
    color: "from-rose-500/20 to-pink-500/20",
    icon: Bell
  },
  {
    title: "Care for Your Family",
    subtitle: "Manage medications and health profiles for your entire household.",
    emoji: "👨‍👩‍👧‍👦",
    color: "from-violet-500/20 to-purple-500/20",
    icon: Users
  },
  {
    title: "Speaks Your Language",
    subtitle: "Clear medical information available in Swahili and other local languages.",
    emoji: "🌍",
    color: "from-emerald-500/20 to-teal-500/20",
    icon: Globe
  },
  {
    title: "Ready to Begin?",
    subtitle: "Join thousands of users managing their health with smarter medicine tools.",
    emoji: "🚀",
    color: "from-purple-600/30 to-indigo-600/30",
    icon: Rocket
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

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(s => s - 1);
    }
  };

  const handleFinish = () => {
    setHasSeenWelcome(true);
    navigate("/auth");
  };

  const step = ONBOARDING_STEPS[currentStep];
  const Icon = step.icon;

  return (
    <div className={`min-h-screen flex flex-col bg-gradient-to-br ${step.color} transition-colors duration-700 ease-in-out overflow-hidden`}>
      {/* Skip Button */}
      <div className="absolute top-6 right-6 z-20">
        <Button 
          variant="ghost" 
          className="text-muted-foreground hover:text-foreground font-medium"
          onClick={handleFinish}
        >
          Skip
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full max-w-sm text-center flex flex-col items-center"
          >
            {/* Animated Emoji/Icon Container */}
            <motion.div
              initial={{ scale: 0.5, rotate: -10 }}
              animate={{ 
                scale: 1, 
                rotate: 0,
                y: [0, -10, 0] 
              }}
              transition={{ 
                scale: { type: "spring", bounce: 0.5 },
                y: { duration: 3, repeat: Infinity, ease: "easeInOut" }
              }}
              className="relative mb-12"
            >
              <div className="w-48 h-48 rounded-2xl bg-white/40 backdrop-blur-xl flex items-center justify-center shadow-2xl border border-white/50 relative overflow-hidden group">
                <span className="text-8xl select-none filter drop-shadow-lg">
                  {step.emoji}
                </span>
                
                {/* Secondary floating elements centered around gravity */}
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 opacity-10"
                >
                  {Icon && <Icon className="absolute top-4 right-4 w-12 h-12" />}
                </motion.div>
              </div>
              
              {/* Decorative rings */}
              <div className="absolute -inset-4 border-2 border-white/20 rounded-3xl animate-pulse" />
              <div className="absolute -inset-8 border border-white/10 rounded-[2.5rem] animate-pulse delay-75" />
            </motion.div>

            {/* Text Content */}
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-4xl font-bold text-foreground mb-4 tracking-tight leading-tight"
            >
              {step.title}
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-lg text-muted-foreground leading-relaxed px-4 font-medium opacity-80"
            >
              {step.subtitle}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer Navigation */}
      <div className="px-6 py-12 flex flex-col items-center gap-8">
        {/* Step Indicators */}
        <div className="flex gap-2">
          {ONBOARDING_STEPS.map((_, i) => (
            <motion.div
              key={i}
              animate={{
                width: i === currentStep ? 24 : 8,
                backgroundColor: i === currentStep ? "hsl(var(--primary))" : "hsl(var(--muted-foreground)/0.3)"
              }}
              className="h-2 rounded-full transition-colors duration-300"
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="w-full max-w-sm flex items-center gap-4">
          {currentStep > 0 && (
            <Button
              variant="outline"
              size="lg"
              className="h-14 w-14 rounded-full p-0 flex-shrink-0 bg-white/20 hover:bg-white/40 border-white/30"
              onClick={handleBack}
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
          )}

          <Button
            size="lg"
            className={`h-14 rounded-xl text-lg font-bold flex-1 shadow-lg shadow-primary/20 transition-all active:scale-[0.98] ${currentStep === 0 ? "w-full" : ""}`}
            onClick={handleNext}
          >
            {currentStep === ONBOARDING_STEPS.length - 1 ? (
              <span className="flex items-center gap-2">
                Get Started <Rocket className="w-5 h-5" />
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Next <ChevronRight className="w-5 h-5" />
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
