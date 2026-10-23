import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LOGO_BASE64 } from "@/lib/logoBase64";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar as CalendarIcon, User, Loader2, ArrowRight } from "@/lib/icons";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppleDatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/contexts/AppContext";
import { notify } from "@/lib/notifications";
import SuccessState from "@/components/SuccessState";
import { auth } from "@/lib/firebase";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { completeOnboarding, userProfile } = useApp();

  const currentUser = auth.currentUser;
  
  // Try to default to profile name or auth display name if available
  const [name, setName] = useState(userProfile?.name || currentUser?.displayName || "");
  const [dateOfBirth, setDateOfBirth] = useState(userProfile?.dateOfBirth || "");
  const [gender, setGender] = useState<"male" | "female" | "">(userProfile?.gender || "");
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !dateOfBirth || !gender) {
      notify.warning("Missing Info", "Please fill in all profile details.");
      return;
    }

    setLoading(true);
    try {
      await completeOnboarding({ 
        name, 
        dateOfBirth, 
        gender: gender as "male" | "female" 
      });
      setShowSuccess(true);
      setTimeout(() => navigate("/"), 2000);
    } catch (err: any) {
      notify.error("Profile Update Failed", err.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 pt-8 pb-10 min-h-[100dvh] flex flex-col bg-background relative overflow-y-auto no-scrollbar">
      {/* Atmospheric Ambient Medical Lens Glows */}
      <div className="pointer-events-none absolute -top-20 -left-20 w-80 h-80 rounded-full bg-[#0066cc]/10 dark:bg-[#2997ff]/15 blur-3xl z-0" />
      <div className="pointer-events-none absolute bottom-10 -right-20 w-96 h-96 rounded-full bg-[#0071e3]/10 dark:bg-[#0066cc]/15 blur-3xl z-0" />

      <AnimatePresence>
        {showSuccess && (
          <SuccessState 
            title="Profile Ready!" 
            subtitle="Your personalized health experience is now active." 
          />
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        <motion.div
          key="onboarding"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 flex flex-col max-w-md mx-auto w-full mt-4 sm:mt-8 relative z-10"
        >
          <div className="bg-card/95 backdrop-blur-xl border border-border/80 rounded-[24px] p-7 sm:p-9 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.25)] relative overflow-hidden">
            {/* Top Subtle Gradient Accent Line */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#0066cc] via-[#0071e3] to-[#2997ff]" />

            <div className="text-center mb-6 sm:mb-8">
              {/* Step 2 Pill Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#0066cc]/10 text-[#0066cc] dark:bg-[#2997ff]/15 dark:text-[#2997ff] border border-[#0066cc]/20 mb-4 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0066cc] dark:bg-[#2997ff] animate-pulse" />
                Step 2 of 2 • Profile Setup
              </div>

              <div className="mb-4">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[22px] bg-white/90 dark:bg-[#272729]/90 border border-[#0066cc]/20 dark:border-[#2997ff]/30 shadow-md shadow-[#0066cc]/10 flex items-center justify-center p-3.5 mx-auto">
                  <img src={LOGO_BASE64} alt="Dawa Lens Logo" className="w-full h-full object-contain" />
                </div>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.022em] text-foreground">
                Complete Your Profile
              </h1>
              <p className="text-[15px] text-muted-foreground mt-2 leading-relaxed">
                We need a few details to personalize your experience and accurately check for dosage and drug interactions.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-semibold text-foreground uppercase tracking-wider">Full Name</Label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User size={16} className="text-muted-foreground group-focus-within:text-[#0066cc] dark:group-focus-within:text-[#2997ff] transition-colors" />
                  </div>
                  <Input 
                    id="name" 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe" 
                    className="pl-10 h-11 bg-secondary/40 focus:bg-card border-border focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 rounded-full text-sm transition-all" 
                    disabled={loading} 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dob" className="text-xs font-semibold text-foreground uppercase tracking-wider">Date of Birth</Label>
                <AppleDatePicker
                  id="dob"
                  value={dateOfBirth ? new Date(dateOfBirth) : undefined}
                  onChange={(date, dateStr) => {
                    setDateOfBirth(dateStr || "");
                  }}
                  disabled={(date) =>
                    date > new Date() || date < new Date("1900-01-01")
                  }
                  fromYear={1900}
                  toYear={new Date().getFullYear()}
                  placeholder="Select your date of birth"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Used to calibrate your age for verified dosage and clinical safety checks.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender" className="text-xs font-semibold text-foreground uppercase tracking-wider">Gender</Label>
                <Select disabled={loading} value={gender} onValueChange={(val) => setGender(val as any)}>
                  <SelectTrigger className="h-11 bg-secondary/40 focus:bg-card border-border focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 w-full rounded-full text-sm px-4 transition-all">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-border">
                    <SelectItem value="female" className="rounded-lg cursor-pointer">Female</SelectItem>
                    <SelectItem value="male" className="rounded-lg cursor-pointer">Male</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <button 
                type="submit" 
                className="w-full mt-6 h-12 rounded-full text-base font-semibold bg-gradient-to-r from-[#0066cc] to-[#0071e3] hover:from-[#005bb5] hover:to-[#0066cc] text-white shadow-[0_4px_16px_rgba(0,102,204,0.35)] dark:shadow-[0_4px_16px_rgba(41,151,255,0.25)] hover:shadow-[0_6px_20px_rgba(0,102,204,0.45)] transition-all duration-200 active:scale-95 flex items-center justify-center gap-2" 
                disabled={loading}
              >
                {loading ? (
                  <><Loader2 size={18} className="animate-spin" /> Preparing Health Lens...</>
                ) : (
                  <>Continue to Dashboard <ArrowRight size={18} /></>
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
