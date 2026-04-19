import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";
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
    title: "Speaks Your Language",
    subtitle: "Clear medical information available in Swahili and other local languages.",
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
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden selection:bg-primary/20">
      {/* Dynamic Background Glow Orbs */}
      <motion.div 
        className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] rounded-full blur-[100px] opacity-50 pointer-events-none"
        animate={{ backgroundColor: step.color }}
        transition={{ duration: 1, ease: "easeInOut" }}
      />
      <motion.div 
        className="absolute bottom-[-10%] right-[-10%] w-[70vw] h-[70vw] max-w-[700px] max-h-[700px] rounded-full blur-[120px] opacity-40 pointer-events-none"
        animate={{ backgroundColor: step.color }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
      />

      {/* Header (Skip Button) */}
      <div className="relative z-20 flex justify-end p-6">
        <Button 
          variant="ghost" 
          className="text-muted-foreground/60 hover:text-foreground font-semibold tracking-wide"
          onClick={handleFinish}
        >
          Skip
        </Button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10 w-full max-w-md mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="w-full flex flex-col items-center"
          >
            {/* Frosted Glass Icon Container */}
            <motion.div 
              className="relative w-40 h-40 mb-10 rounded-[2.5rem] bg-card/40 border border-border/50 backdrop-blur-2xl shadow-2xl flex items-center justify-center group"
              initial={{ y: 20 }}
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-[2.5rem] pointer-events-none" />
              <Icon strokeWidth={1.5} className={`w-20 h-20 ${step.iconColor} drop-shadow-xl`} />
              
              {/* Inner Glow corresponding to step color */}
              <motion.div 
                className="absolute inset-0 rounded-[2.5rem] blur-xl -z-10 opacity-40"
                animate={{ backgroundColor: step.color }}
              />
            </motion.div>

            {/* Typography */}
            <div className="text-center space-y-4 w-full">
              <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tighter leading-tight drop-shadow-sm">
                {step.title}
              </h1>
              <p className="text-[15px] md:text-base text-muted-foreground/80 font-medium leading-relaxed px-2">
                {step.subtitle}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer (Navigation & Progress) */}
      <div className="relative z-20 px-6 pb-12 pt-8 w-full max-w-md mx-auto flex flex-col items-center gap-10">
        
        {/* Segmented Progress Bar */}
        <div className="w-full flex gap-1.5 h-1.5 px-4">
          {ONBOARDING_STEPS.map((_, i) => (
            <div key={i} className="flex-1 h-full rounded-full bg-muted/40 overflow-hidden relative">
              <motion.div 
                className="absolute inset-0 bg-primary origin-left"
                initial={{ scaleX: 0 }}
                animate={{ 
                  scaleX: i < currentStep ? 1 : i === currentStep ? 1 : 0,
                  opacity: i === currentStep ? [0.5, 1] : 1
                }}
                transition={{ 
                  scaleX: { duration: 0.4, ease: "easeOut" },
                  opacity: i === currentStep ? { duration: 1, repeat: Infinity, repeatType: "reverse" } : { duration: 0 }
                }}
              />
            </div>
          ))}
        </div>

        {/* Action Button */}
        <Button
          onClick={handleNext}
          className="w-full h-14 rounded-2xl text-[17px] font-bold shadow-xl shadow-primary/20 active:scale-[0.98] transition-all bg-primary/90 hover:bg-primary backdrop-blur-sm group"
        >
          {currentStep === ONBOARDING_STEPS.length - 1 ? (
            <span className="flex items-center justify-center w-full gap-2">
              Get Started <Rocket className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </span>
          ) : (
            <span className="flex items-center justify-center w-full gap-2">
              Continue <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
