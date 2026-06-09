import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar as CalendarIcon, User, UserSquare2, Loader2, ArrowRight } from "lucide-react";
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
    <div className="px-4 pt-12 pb-4 min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Background ambient light */}
      <div className="absolute top-0 left-0 w-full h-96 bg-primary/5 blur-[120px] rounded-full pointer-events-none -translate-y-1/2" />
      
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex-1 flex flex-col max-w-md mx-auto w-full mt-10 relative z-10"
        >
          <div className="bg-card/40 backdrop-blur-xl border border-border/60 shadow-2xl rounded-[2rem] p-8 pb-10">
            <div className="text-center mb-8">
              <div className="mb-6 relative">
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
                <img src="/logo.png" alt="Dawa Lens Logo" className="w-24 h-24 mx-auto object-contain relative z-10 drop-shadow-lg" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
                Complete Your Profile
              </h1>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                We just need a few details to personalize your experience and accurately check for drug interactions.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-foreground/90">Full Name</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User size={18} className="text-muted-foreground/70" />
                  </div>
                  <Input 
                    id="name" 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe" 
                    className="pl-11 h-12 bg-background/60 border-border/50 focus-visible:ring-primary/30 focus-visible:border-primary transition-all duration-200 rounded-xl" 
                    disabled={loading} 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dob" className="text-sm font-medium text-foreground/90">Date of Birth</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full h-12 pl-3.5 text-left font-normal bg-background/60 border-border/50 hover:bg-background/80 hover:text-foreground focus:ring-2 focus:ring-primary/30 transition-all duration-200 rounded-xl",
                        !dateOfBirth && "text-muted-foreground",
                        loading && "opacity-50 cursor-not-allowed"
                      )}
                      disabled={loading}
                    >
                      <CalendarIcon className="mr-3 h-[18px] w-[18px] text-muted-foreground/70" />
                      {dateOfBirth ? (
                        format(new Date(dateOfBirth), "MMMM d, yyyy")
                      ) : (
                        <span>Select your date of birth</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-border/50 shadow-xl rounded-xl" align="start">
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
                <p className="text-xs text-muted-foreground mt-1.5 flex items-center">
                  <span className="inline-block w-1 h-1 rounded-full bg-primary/50 mr-2"></span>
                  Used to calculate your age for dosage safety checks.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender" className="text-sm font-medium text-foreground/90">Gender</Label>
                <Select disabled={loading} value={gender} onValueChange={(val) => setGender(val as any)}>
                  <SelectTrigger className="h-12 bg-background/60 border-border/50 focus:ring-primary/30 transition-all duration-200 w-full rounded-xl">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/50 shadow-xl">
                    <SelectItem value="female" className="rounded-lg cursor-pointer">Female</SelectItem>
                    <SelectItem value="male" className="rounded-lg cursor-pointer">Male</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full mt-8 h-12 rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95" disabled={loading}>
                {loading ? (
                  <><Loader2 size={18} className="mr-2 animate-spin" /> Preparing...</>
                ) : (
                  <><span className="text-base font-semibold">Continue to Dashboard</span> <ArrowRight size={18} className="ml-2" /></>
                )}
              </Button>
            </form>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
