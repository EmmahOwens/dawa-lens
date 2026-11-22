import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LOGO_BASE64 } from "@/lib/logoBase64";
import { motion, AnimatePresence } from "framer-motion";
import { User, Loader2, ArrowRight, ShieldCheck } from "@/lib/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppleDatePicker } from "@/components/ui/date-picker";
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
import { EDITORIAL_EASE, EditorialEyebrow } from "@/components/editorial/EditorialPrimitives";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { completeOnboarding, userProfile } = useApp();

  const currentUser = auth.currentUser;

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
        gender: gender as "male" | "female",
      });
      setShowSuccess(true);
      setTimeout(() => navigate("/"), 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Please try again.";
      notify.error("Profile Update Failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col justify-center bg-background text-foreground px-5 py-10 sm:py-14 overflow-y-auto no-scrollbar">
      <AnimatePresence>
        {showSuccess && (
          <SuccessState
            title="Profile Ready!"
            subtitle="Your personalized health experience is now active."
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EDITORIAL_EASE }}
        className="w-full max-w-[460px] mx-auto space-y-6"
      >
        {/* Minimal Brand & Step Bar */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-secondary border border-border/80 flex items-center justify-center p-1.5">
              <img src={LOGO_BASE64} alt="Dawa Lens" className="w-full h-full object-contain" />
            </div>
            <span className="text-[15px] font-semibold tracking-[-0.02em] text-foreground">
              Dawa Lens
            </span>
          </div>
          <EditorialEyebrow index="02 / 02" label="Profile Setup" dotColor="bg-primary" />
        </div>

        {/* Hairline Progress Bar */}
        <div className="grid grid-cols-2 gap-2 px-1">
          <div className="h-[2px] rounded-full bg-foreground/30" />
          <div className="h-[2px] rounded-full bg-primary" />
        </div>

        {/* Architectural Intake Surface */}
        <div className="editorial-card p-7 sm:p-9 space-y-7">
          <div className="space-y-2">
            <h1 className="editorial-display text-[32px] sm:text-[38px] font-medium tracking-[-0.035em] text-foreground leading-[1.02]">
              Personalize your{" "}
              <em className="editorial-serif text-[1.08em] text-muted-foreground font-normal">
                clinical lens.
              </em>
            </h1>
            <p className="text-[14.5px] text-muted-foreground leading-[1.58]">
              A few essential details calibrate age-appropriate dosage checks and interaction alerts
              across your medicine cabinet.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="name"
                className="editorial-mono text-[10px] text-muted-foreground pl-1"
              >
                Full Name
              </Label>
              <div className="relative group">
                <User
                  size={15}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none"
                />
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sarah Nakato"
                  className="pl-11 h-12 bg-secondary/50 focus:bg-card border-border/80 focus:border-primary rounded-2xl text-[14.5px] transition-colors"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="dob"
                className="editorial-mono text-[10px] text-muted-foreground pl-1"
              >
                Date of Birth
              </Label>
              <AppleDatePicker
                id="dob"
                value={dateOfBirth ? new Date(dateOfBirth) : undefined}
                onChange={(_date, dateStr) => {
                  setDateOfBirth(dateStr || "");
                }}
                disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                fromYear={1900}
                toYear={new Date().getFullYear()}
                placeholder="Select your date of birth"
              />
              <p className="text-[12px] text-muted-foreground pl-1">
                Calibrates pediatric, adult, and geriatric clinical safety checks.
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="gender"
                className="editorial-mono text-[10px] text-muted-foreground pl-1"
              >
                Biological Sex
              </Label>
              <Select
                disabled={loading}
                value={gender}
                onValueChange={(val) => setGender(val as "male" | "female")}
              >
                <SelectTrigger className="h-12 bg-secondary/50 focus:bg-card border-border/80 focus:border-primary w-full rounded-2xl text-[14.5px] px-4 transition-colors">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-border">
                  <SelectItem value="female" className="rounded-lg cursor-pointer">
                    Female
                  </SelectItem>
                  <SelectItem value="male" className="rounded-lg cursor-pointer">
                    Male
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="btn-editorial-roll w-full h-12 sm:h-[52px] pl-6 pr-2.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20 text-[14.5px] font-medium justify-between disabled:opacity-50"
              >
                <span>{loading ? "Preparing Health Lens..." : "Continue to Dashboard"}</span>
                <span className="roll-chip w-8 h-8 bg-white text-primary">
                  {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ArrowRight size={14} />
                  )}
                </span>
              </button>
            </div>
          </form>

          {/* Privacy Footnote */}
          <div className="flex items-center gap-2.5 pt-4 border-t border-border/70 text-[12px] text-muted-foreground">
            <ShieldCheck size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Personal details are stripped before any AI consultation leaves your device.</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
