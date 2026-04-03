import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Loader2, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";

type Stage = "form" | "awaiting-verification";

export default function AuthPage() {
  const navigate = useNavigate();
  const { loginUser } = useApp();
  const { toast } = useToast();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [stage, setStage] = useState<Stage>("form");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        if (!user.emailVerified) {
          setStage("awaiting-verification");
        } else {
          loginUser(user.uid, user.email || "");
          toast({ title: "Welcome back!", description: `Signed in as ${user.email}` });
          navigate("/");
        }
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await sendEmailVerification(user);
        
        setStage("awaiting-verification");
      }
    } catch (err: any) {
      toast({
        title: isLogin ? "Sign in failed" : "Registration failed",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        toast({ title: "New verification link generated!" });
      } else {
        toast({ title: "Error", description: "Not logged in, please sign in first.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Failed to resend", description: err.message, variant: "destructive" });
    } finally {
      setResending(false);
    }
  };

  const checkVerificationAndSignIn = async () => {
    if (auth.currentUser) {
      // Reload user to get latest verification status
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        loginUser(auth.currentUser.uid, auth.currentUser.email || "");
        toast({ title: "Welcome!", description: "Your email has been verified." });
        navigate("/");
      } else {
        toast({ title: "Still not verified", description: "Please check your inbox.", variant: "destructive" });
      }
    } else {
      setStage("form");
      setIsLogin(true);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      // Google emails are pre-verified. 
      loginUser(result.user.uid, result.user.email || "");
      toast({ title: "Welcome!", description: `Signed in as ${result.user.email}` });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Google Sign In failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="px-4 pt-6 pb-4 min-h-screen flex flex-col">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
        <ArrowLeft size={16} /> Back
      </button>

      <AnimatePresence mode="wait">
        {stage === "form" && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
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
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com" className="pl-10" disabled={loading} />
                </div>
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative mt-1.5">
                  <Lock size={16} className="absolute left-3 top-3 text-muted-foreground" />
                  <Input id="password" type={showPassword ? "text" : "password"} value={password}
                    onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                    className="pl-10 pr-10" disabled={loading} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-muted-foreground">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading
                  ? <><Loader2 size={16} className="mr-2 animate-spin" /> Please wait...</>
                  : isLogin ? "Sign In" : "Create Account"}
              </Button>
            </form>

            <div className="relative mt-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-muted-foreground/20" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <Button 
              variant="outline" 
              type="button" 
              className="w-full mt-4" 
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
                <path d="M1 1h22v22H1z" fill="none" />
              </svg>
              Google
            </Button>

            <p className="text-center text-sm text-muted-foreground mt-6">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
              <button onClick={() => setIsLogin(!isLogin)} className="text-primary font-medium hover:underline">
                {isLogin ? "Sign Up" : "Sign In"}
              </button>
            </p>
          </motion.div>
        )}

        {stage === "awaiting-verification" && (
          <motion.div
            key="verify"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full text-center"
          >
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Mail size={36} className="text-primary" />
            </div>

            <h1 className="text-2xl font-bold text-foreground">Check Your Email</h1>
            <p className="text-sm text-muted-foreground mt-2 mb-6 leading-relaxed">
              We sent a verification link to <strong className="text-foreground">{email}</strong>.
              Click the link in that email to activate your account.
            </p>

            <div className="space-y-3">
              <Button className="w-full" onClick={checkVerificationAndSignIn}>
                <CheckCircle2 size={16} className="mr-2" /> I've Verified — Sign In
              </Button>
              <Button variant="outline" className="w-full" onClick={handleResend} disabled={resending}>
                {resending
                  ? <><Loader2 size={14} className="mr-2 animate-spin" /> Resending...</>
                  : <><RefreshCw size={14} className="mr-2" /> Resend Verification Link</>}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
