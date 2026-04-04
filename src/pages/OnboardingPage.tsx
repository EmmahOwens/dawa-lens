import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, User, UserSquare2, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { completeOnboarding, userProfile } = useApp();
  const { toast } = useToast();

  const currentUser = auth.currentUser;
  
  // Try to default to profile name or auth display name if available
  const [name, setName] = useState(userProfile?.name || currentUser?.displayName || "");
  const [dateOfBirth, setDateOfBirth] = useState(userProfile?.dateOfBirth || "");
  const [gender, setGender] = useState<"male" | "female" | "">(userProfile?.gender || "");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !dateOfBirth || !gender) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await completeOnboarding({ 
        name, 
        dateOfBirth, 
        gender: gender as "male" | "female" 
      });
      toast({ title: "Profile completed successfully!" });
      navigate("/");
    } catch (err: any) {
      toast({
        title: "Failed to update profile",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 pt-12 pb-4 min-h-screen flex flex-col bg-background">
      <AnimatePresence mode="wait">
        <motion.div
          key="onboarding"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 flex flex-col max-w-sm mx-auto w-full mt-10"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <UserSquare2 size={28} className="text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Complete Your Profile</h1>
            <p className="text-sm text-muted-foreground mt-2">
              We just need a few details to personalize your Dawa Lens experience and calculate interactions accurately.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <div className="relative mt-1.5 border border-border rounded-md shadow-sm focus-within:ring-1 focus-within:ring-ring focus-within:border-ring">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User size={16} className="text-muted-foreground" />
                </div>
                <Input 
                  id="name" 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe" 
                  className="pl-10 w-full border-none shadow-none focus-visible:ring-0 rounded-md" 
                  disabled={loading} 
                />
              </div>
            </div>

            <div>
              <Label htmlFor="dob">Date of Birth</Label>
              <div className="relative mt-1.5 border border-border rounded-md shadow-sm focus-within:ring-1 focus-within:ring-ring focus-within:border-ring overflow-hidden">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10 bg-background/0">
                  <Calendar size={16} className="text-muted-foreground" />
                </div>
                <Input 
                  id="dob" 
                  type="date" 
                  value={dateOfBirth} 
                  max={new Date().toISOString().split("T")[0]} // Prevents future dates
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="pl-10 w-full bg-background border-none shadow-none focus-visible:ring-0 pt-0 pb-0 min-h-10 text-foreground" 
                  disabled={loading} 
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Used to automatically calculate your age for dosage safety checks.
              </p>
            </div>

            <div>
              <Label htmlFor="gender">Gender</Label>
              <div className="mt-1.5">
                <Select disabled={loading} value={gender} onValueChange={(val) => setGender(val as any)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit" className="w-full mt-6" size="lg" disabled={loading}>
              {loading ? (
                <><Loader2 size={16} className="mr-2 animate-spin" /> Saving...</>
              ) : (
                <>Continue to Dashboard <ArrowRight size={16} className="ml-2" /></>
              )}
            </Button>
          </form>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
