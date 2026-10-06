import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LOGO_BASE64 } from "@/lib/logoBase64";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar as CalendarIcon, User, Loader2, ArrowRight } from "@/lib/icons";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
          <div className="bg-card border border-border rounded-[18px] p-6 sm:p-8">
            <div className="text-center mb-6 sm:mb-8">
              <div className="mb-4">
                <img src={LOGO_BASE64} alt="Dawa Lens Logo" className="w-16 h-16 sm:w-20 sm:h-20 mx-auto object-contain" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.022em] text-foreground">
                Complete Your Profile
              </h1>
              <p className="text-[15px] text-muted-foreground mt-2 leading-relaxed">
                We just need a few details to personalize your experience and accurately check for drug interactions.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-semibold text-foreground uppercase tracking-wider">Full Name</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User size={16} className="text-muted-foreground" />
                  </div>
                  <Input 
                    id="name" 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe" 
                    className="pl-10 h-11 bg-card border-border rounded-full text-sm" 
                    disabled={loading} 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dob" className="text-xs font-semibold text-foreground uppercase tracking-wider">Date of Birth</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full h-11 pl-4 text-left font-normal bg-card border-border hover:bg-muted text-foreground transition-all rounded-full text-sm",
                        !dateOfBirth && "text-muted-foreground",
                        loading && "opacity-50 cursor-not-allowed"
                      )}
                      disabled={loading}
                    >
                      <CalendarIcon className="mr-2.5 h-4 w-4 text-muted-foreground" />
                      {dateOfBirth ? (
                        format(new Date(dateOfBirth), "MMMM d, yyyy")
                      ) : (
                        <span>Select your date of birth</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-border rounded-[18px]" align="start">
                    <Calendar
                      mode="single"
                      selected={dateOfBirth ? new Date(dateOfBirth) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const offset = date.getTimezoneOffset();
                          const localDate = new Date(date.getTime() - (offset*60*1000));
                          setDateOfBirth(localDate.toISOString().split('T')[0]);
                        } else {
                          setDateOfBirth("");
                        }
                      }}
                      disabled={(date) =>
                        date > new Date() || date < new Date("1900-01-01")
                      }
                      initialFocus
                      captionLayout="dropdown-buttons"
                      fromYear={1900}
                      toYear={new Date().getFullYear()}
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Used to calculate your age for dosage safety checks.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender" className="text-xs font-semibold text-foreground uppercase tracking-wider">Gender</Label>
                <Select disabled={loading} value={gender} onValueChange={(val) => setGender(val as any)}>
                  <SelectTrigger className="h-11 bg-card border-border w-full rounded-full text-sm px-4">
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
                className="w-full mt-6 h-12 rounded-full text-base font-semibold bg-[#0066cc] dark:bg-[#0071e3] text-white hover:opacity-95 transition-transform active:scale-95 flex items-center justify-center gap-2" 
                disabled={loading}
              >
                {loading ? (
                  <><Loader2 size={18} className="animate-spin" /> Preparing...</>
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
