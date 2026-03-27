import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";

export default function AuthPage() {
  const navigate = useNavigate();
  const { setIsLoggedIn } = useApp();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }
    // Demo auth
    setIsLoggedIn(true);
    toast({ title: isLogin ? "Welcome back!" : "Account created!", description: "You're now signed in." });
    navigate("/");
  };

  return (
    <div className="px-4 pt-6 pb-4 min-h-screen flex flex-col">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
        <ArrowLeft size={16} /> Back
      </button>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock size={28} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{isLogin ? "Welcome Back" : "Create Account"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLogin ? "Sign in to sync your medication data" : "Start managing your medications safely"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <div className="relative mt-1.5">
              <Mail size={16} className="absolute left-3 top-3 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <div className="relative mt-1.5">
              <Lock size={16} className="absolute left-3 top-3 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-muted-foreground"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" size="lg">
            {isLogin ? "Sign In" : "Create Account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button onClick={() => setIsLogin(!isLogin)} className="text-primary font-medium hover:underline">
            {isLogin ? "Sign Up" : "Sign In"}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
