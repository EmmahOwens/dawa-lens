import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Loader2, CheckCircle2, RefreshCw, User, Info, ShieldCheck, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/contexts/AppContext";
import { auth, db } from "@/lib/firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  AuthError
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import SuccessState from "@/components/SuccessState";
import ErrorDialog from "@/components/ErrorDialog";
import { notify } from "@/lib/notifications";
import { Switch } from "@/components/ui/switch";

type Stage = "form" | "awaiting-verification" | "forgot-password";

/** Creative Pill-shaped Password Strength Meter */
function PillStrengthMeter({ password }: { password: string }) {
  const getStrength = (p: string) => {
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  };

  const strength = getStrength(password);
  const colors = ["bg-muted", "bg-destructive", "bg-warning", "bg-blue-500", "bg-primary"];
  const labels = ["Empty", "Weak", "Fair", "Strong", "Very Strong"];
  
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
          Security Level
        </span>
        <span className={`text-[10px] font-bold uppercase transition-colors duration-300 ${strength > 0 ? 'text-' + colors[strength].split('-')[1] : 'text-muted-foreground'}`}>
          {labels[strength]}
        </span>
      </div>
      {/* The Capsule/Pill */}
      <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden border border-border/50 p-[1px]">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${(strength / 4) * 100}%` }}
          className={`h-full rounded-full transition-colors duration-500 ${colors[strength]}`}
        />
      </div>
    </div>
  );
}

export default function AuthPage() {
  const navigate = useNavigate();
  const { loginUser, rememberMe, setRememberMe } = useApp();

  const [isLogin, setIsLogin] = useState(true);
  const [stage, setStage] = useState<Stage>("form");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; description: string; type?: "critical" | "warning" | "error" }>({
    open: false,
    title: "",
    description: "",
  });

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (stage === "forgot-password") {
      handleForgotPassword();
      return;
    }

    if (!email.trim() || !password.trim()) {
      notify.warning("Missing Fields", "Please fill in all required fields.");
      return;
    }

    if (!validateEmail(email)) {
      notify.warning("Invalid Email", "Please enter a valid email address.");
      return;
    }

    if (!isLogin && !name.trim()) {
      notify.warning("Name Required", "Please enter your name to create an account.");
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        if (!user.emailVerified) {
          setStage("awaiting-verification");
          notify.info("Verification Required", "Please verify your email before signing in.");
        } else {
          setShowSuccess(true);
          loginUser(user.uid, user.email || "");
          setTimeout(() => navigate("/"), 2000);
        }
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Initialize Firestore Profile Immediately
        await setDoc(doc(db, "users", user.uid), {
          id: user.uid,
          name: name.trim(),
          email: email,
          createdAt: new Date().toISOString(),
          isProfessional: false
        });

        await sendEmailVerification(user, {
          url: `${window.location.origin}/`,
          handleCodeInApp: false,
        });
        
        setStage("awaiting-verification");
        notify.success("Account Created!", "A verification link has been sent to your email.");
      }
    } catch (err: any) {
      const error = err as AuthError;
      handleAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!validateEmail(email)) {
      notify.warning("Email Required", "Please enter your registered email address.");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      notify.success("Reset Email Sent", "Check your inbox for password reset instructions.");
      setStage("form");
    } catch (err: any) {
      notify.error("Reset Failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthError = (error: AuthError) => {
    if (error.code === "auth/user-not-found") {
      setErrorDialog({
        open: true,
        title: "Account Not Found",
        description: "We couldn't find an account with this email. Would you like to sign up instead?",
        type: "warning"
      });
    } else if (error.code === "auth/wrong-password") {
      notify.error("Incorrect Password", "Please check your password and try again.");
    } else if (error.code === "auth/email-already-in-use") {
      notify.error("Account Exists", "This email is already registered. Please sign in.");
      setIsLogin(true);
    } else if (error.code === "auth/too-many-requests") {
      setErrorDialog({
        open: true,
        title: "Security Lockout",
        description: "Too many failed attempts. Access is temporarily restricted for your safety.",
        type: "critical"
      });
    } else {
      notify.error("Authentication Error", error.message);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Proactively initialize/update profile in Firestore
      await setDoc(doc(db, "users", result.user.uid), {
        id: result.user.uid,
        name: result.user.displayName || "User",
        email: result.user.email,
        photoURL: result.user.photoURL,
        lastLogin: new Date().toISOString()
      }, { merge: true });

      setShowSuccess(true);
      loginUser(result.user.uid, result.user.email || "");
      setTimeout(() => navigate("/"), 1500);
    } catch (err: any) {
      notify.error("Google Sign In failed", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <AnimatePresence>
        {showSuccess && (
          <SuccessState 
            title="Welcome Back!" 
            subtitle="Successfully signed in. Preparing your health lens..." 
          />
        )}
      </AnimatePresence>

      <ErrorDialog 
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog(prev => ({ ...prev, open }))}
        title={errorDialog.title}
        description={errorDialog.description}
        type={errorDialog.type}
        actionText={errorDialog.type === "warning" ? "Switch to Sign Up" : "Try Again"}
        onAction={() => {
          if (errorDialog.type === "warning") {
            setIsLogin(false);
            setStage("form");
          }
        }}
      />

      {/* Left Panel: Branding (Desktop Only) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary/5">
        <div className="absolute inset-0 z-0">
          <img 
            src="/home/iammbayo/.gemini/antigravity/brain/97f9dd79-ac67-44c0-8f1a-673027f40f95/auth_sidebar_bg_1776767750838.png" 
            alt="Branding Background" 
            className="w-full h-full object-cover opacity-60 mix-blend-multiply"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
        </div>
        
        <div className="relative z-10 p-16 flex flex-col justify-between w-full">
          <div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-4 mb-12"
            >
              <div className="h-12 w-12 rounded-2xl bg-white shadow-xl shadow-primary/20 flex items-center justify-center p-2">
                <img src="/logo.png" alt="Dawa Lens" className="w-full h-full object-contain" />
              </div>
              <span className="text-2xl font-bold tracking-tight text-foreground">Dawa Lens</span>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-5xl font-black tracking-tight leading-[1.1] text-foreground mb-6">
                Precision Care,<br />Every Dose Matters.
              </h1>
              <p className="text-xl text-muted-foreground/80 max-w-md leading-relaxed">
                Empowering your medication journey with smart identification and reliable management.
              </p>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-2 gap-6"
          >
            {[
              { icon: ShieldCheck, title: "Secure Data", desc: "End-to-end encrypted logs" },
              { icon: Heart, title: "Personalized", desc: "Tailored to your health" },
            ].map((feature, i) => (
              <div key={i} className="p-6 rounded-3xl bg-white/40 backdrop-blur-md border border-white/40 shadow-sm">
                <feature.icon className="text-primary mb-3" size={24} />
                <h3 className="font-bold text-sm mb-1">{feature.title}</h3>
                <p className="text-[12px] text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Right Panel: Auth Forms */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-[400px] space-y-8">
          <div className="lg:hidden text-center mb-8">
            <img src="/logo.png" alt="Logo" className="w-16 h-16 mx-auto mb-4" />
          </div>

          <AnimatePresence mode="wait">
            {stage === "form" && (
              <motion.div
                key="auth-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="glass-card p-8 shadow-2xl shadow-primary/5"
              >
                <div className="mb-8">
                  <h2 className="text-3xl font-black tracking-tight mb-2">
                    {isLogin ? "Welcome Back" : "Start Journey"}
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    {isLogin ? "Continue where you left off." : "Create your personalized health lens today."}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {!isLogin && (
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-[11px] uppercase tracking-widest font-bold opacity-70">Full Name</Label>
                      <div className="relative">
                        <User size={18} className="absolute left-3 top-3 text-muted-foreground/60" />
                        <Input 
                          id="name" placeholder="John Doe" 
                          className="pl-10 h-12 rounded-xl bg-muted/50 border-transparent focus:bg-background transition-all"
                          value={name} onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-[11px] uppercase tracking-widest font-bold opacity-70">Email Address</Label>
                    <div className="relative">
                      <Mail size={18} className="absolute left-3 top-3 text-muted-foreground/60" />
                      <Input 
                        id="email" type="email" placeholder="you@example.com" 
                        className="pl-10 h-12 rounded-xl bg-muted/50 border-transparent focus:bg-background transition-all"
                        value={email} onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-[11px] uppercase tracking-widest font-bold opacity-70">Password</Label>
                      {isLogin && (
                        <button type="button" onClick={() => setStage("forgot-password")} className="text-[11px] font-bold text-primary hover:underline">
                          Forgot Password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock size={18} className="absolute left-3 top-3 text-muted-foreground/60" />
                      <Input 
                        id="password" type={showPassword ? "text" : "password"} 
                        placeholder="••••••••" 
                        className="pl-10 pr-10 h-12 rounded-xl bg-muted/50 border-transparent focus:bg-background transition-all"
                        value={password} onChange={(e) => setPassword(e.target.value)}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-muted-foreground/60 hover:text-primary transition-colors">
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {!isLogin && <PillStrengthMeter password={password} />}
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <Switch id="remember" checked={rememberMe} onCheckedChange={setRememberMe} />
                      <Label htmlFor="remember" className="text-xs font-medium cursor-pointer">Remember me</Label>
                    </div>
                  </div>

                  <Button type="submit" className="w-full h-12 rounded-2xl text-[15px] font-bold shadow-lg shadow-primary/20" disabled={loading}>
                    {loading ? <Loader2 className="animate-spin" /> : (isLogin ? "Sign In" : "Create Account")}
                  </Button>
                </form>

                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em] font-black"><span className="bg-background px-3 text-muted-foreground">Social Auth</span></div>
                </div>

                <Button variant="outline" className="w-full h-12 rounded-2xl gap-3 border-border/50 hover:bg-muted" onClick={handleGoogleSignIn} disabled={loading}>
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span className="text-sm font-bold">Sign in with Google</span>
                </Button>

                <p className="text-center text-[13px] text-muted-foreground mt-8 font-medium">
                  {isLogin ? "New to Dawa Lens?" : "Already have an account?"}{" "}
                  <button onClick={() => setIsLogin(!isLogin)} className="text-primary font-black hover:underline ml-1">
                    {isLogin ? "Create Account" : "Sign In"}
                  </button>
                </p>
              </motion.div>
            )}

            {stage === "forgot-password" && (
              <motion.div
                key="forgot-password"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="glass-card p-8"
              >
                <button onClick={() => setStage("form")} className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-primary transition-colors mb-6">
                  <ArrowLeft size={14} /> Back to Sign In
                </button>
                <div className="mb-8">
                  <h2 className="text-3xl font-black tracking-tight mb-2">Reset Password</h2>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Enter the email associated with your account and we'll send a link to reset your password.
                  </p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-[11px] uppercase tracking-widest font-bold opacity-70">Email Address</Label>
                    <div className="relative">
                      <Mail size={18} className="absolute left-3 top-3 text-muted-foreground/60" />
                      <Input 
                        id="email" type="email" placeholder="you@example.com" 
                        className="pl-10 h-12 rounded-xl bg-muted/50 border-transparent focus:bg-background transition-all"
                        value={email} onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-12 rounded-2xl font-bold" disabled={loading}>
                    {loading ? <Loader2 className="animate-spin" /> : "Send Reset Link"}
                  </Button>
                </form>
              </motion.div>
            )}

            {stage === "awaiting-verification" && (
              <motion.div
                key="verify"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
              >
                <div className="w-24 h-24 rounded-[2.5rem] bg-primary/10 flex items-center justify-center mx-auto mb-8 relative">
                   <motion.div 
                    animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 4, repeat: Infinity }}
                   >
                     <Mail size={42} className="text-primary" />
                   </motion.div>
                   <div className="absolute -top-1 -right-1 h-6 w-6 bg-primary text-white rounded-full flex items-center justify-center border-4 border-background">
                     <Info size={12} />
                   </div>
                </div>

                <h2 className="text-3xl font-black tracking-tight mb-3">Verify Identity</h2>
                <p className="text-muted-foreground text-sm leading-relaxed mb-8 px-4">
                  We've sent a secure link to <strong className="text-foreground">{email}</strong>. 
                  Please confirm your email to activate your Health Lens.
                </p>

                <div className="space-y-4">
                  <Button className="w-full h-12 rounded-2xl font-bold" onClick={() => window.location.reload()}>
                    <CheckCircle2 size={18} className="mr-2" /> I've Verified My Email
                  </Button>
                  <Button variant="outline" className="w-full h-12 rounded-2xl text-xs font-bold gap-2" onClick={() => {}} disabled={resending}>
                    {resending ? <Loader2 className="animate-spin h-3 w-3" /> : <RefreshCw size={14} />}
                    Resend Code
                  </Button>
                  <button onClick={() => setStage("form")} className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors">
                    Back to Form
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
