import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LOGO_BASE64 } from "@/lib/logoBase64";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, Loader2, CheckCircle2, RefreshCw, User, Info, ShieldCheck, Heart } from "@/lib/icons";
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
          createdAt: new Date().toISOString()
        });

        await sendEmailVerification(user, {
          url: `${window.location.origin}/`,
          handleCodeInApp: false,
        });
        
        setStage("awaiting-verification");
        notify.success("Account Created!", "A verification link has been sent to your email.");
      }
    } catch (err: unknown) {
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
    } catch (err: unknown) {
      notify.error("Reset Failed", (err as Error).message);
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
    } catch (err: unknown) {
      notify.error("Google Sign In failed", (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] min-h-[100dvh] overflow-hidden flex bg-background">
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
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#f5f5f7] dark:bg-[#161617] border-r border-border">
        <div className="relative z-10 p-16 flex flex-col justify-between w-full">
          <div>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-3.5 mb-14"
            >
              <div className="h-11 w-11 rounded-[14px] bg-card border border-border flex items-center justify-center p-2">
                <img src={LOGO_BASE64} alt="Dawa Lens" className="w-full h-full object-contain" />
              </div>
              <span className="text-xl font-bold tracking-tight text-foreground">Dawa Lens</span>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
            >
              <h1 className="text-4xl lg:text-5xl font-bold tracking-[-0.022em] leading-[1.1] text-foreground mb-6">
                Precision Care.<br />Every Dose Matters.
              </h1>
              <p className="text-lg text-muted-foreground max-w-md leading-relaxed font-normal">
                Empowering your medication journey with smart identification and verified clinical safety.
              </p>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-2 gap-4"
          >
            {[
              { icon: ShieldCheck, title: "Secure Data", desc: "Private on-device health vaults" },
              { icon: Heart, title: "Personalized", desc: "Tailored to your prescriptions" },
            ].map((feature, i) => (
              <div key={i} className="p-5 rounded-[18px] bg-card border border-border">
                <feature.icon className="text-[#0066cc] dark:text-[#2997ff] mb-2.5" size={22} />
                <h3 className="font-bold text-sm text-foreground mb-0.5">{feature.title}</h3>
                <p className="text-xs text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Right Panel: Auth Forms */}
      <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto no-scrollbar px-4 py-8 sm:p-8 lg:py-12">
        <div className="w-full max-w-[400px] space-y-6">
          <div className="lg:hidden text-center mb-6">
            <img src={LOGO_BASE64} alt="Logo" className="w-14 h-14 mx-auto mb-2.5" />
            <h2 className="text-xl font-bold tracking-tight text-foreground">Dawa Lens</h2>
          </div>

          <AnimatePresence mode="wait">
            {stage === "form" && (
              <motion.div
                key="auth-form"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="rounded-[18px] border border-border bg-card p-6 sm:p-8"
              >
                <div className="mb-6">
                  <h2 className="text-2xl sm:text-3xl font-bold tracking-[-0.022em] text-foreground mb-1.5">
                    {isLogin ? "Welcome Back" : "Create Account"}
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    {isLogin ? "Continue where you left off." : "Create your personalized health lens today."}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {!isLogin && (
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-xs font-semibold text-foreground uppercase tracking-wider">Full Name</Label>
                      <div className="relative">
                        <User size={16} className="absolute left-3.5 top-3.5 text-muted-foreground" />
                        <Input 
                          id="name" placeholder="John Doe" 
                          className="pl-10 h-11 rounded-full bg-card border-border text-sm"
                          value={name} onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold text-foreground uppercase tracking-wider">Email Address</Label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-3.5 text-muted-foreground" />
                      <Input 
                        id="email" type="email" placeholder="you@example.com" 
                        className="pl-10 h-11 rounded-full bg-card border-border text-sm"
                        value={email} onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-xs font-semibold text-foreground uppercase tracking-wider">Password</Label>
                      {isLogin && (
                        <button type="button" onClick={() => setStage("forgot-password")} className="text-xs font-medium text-[#0066cc] dark:text-[#2997ff] hover:underline">
                          Forgot Password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-3.5 text-muted-foreground" />
                      <Input 
                        id="password" type={showPassword ? "text" : "password"} 
                        placeholder="••••••••" 
                        className="pl-10 pr-10 h-11 rounded-full bg-card border-border text-sm"
                        value={password} onChange={(e) => setPassword(e.target.value)}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-3.5 text-muted-foreground hover:text-foreground transition-colors">
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {!isLogin && <PillStrengthMeter password={password} />}
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <Switch id="remember" checked={rememberMe} onCheckedChange={setRememberMe} />
                      <Label htmlFor="remember" className="text-xs font-medium text-muted-foreground cursor-pointer">Remember me</Label>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    className="w-full h-11 rounded-full text-sm font-semibold bg-[#0066cc] dark:bg-[#0071e3] text-white hover:opacity-95 transition-transform active:scale-95 flex items-center justify-center gap-2" 
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="animate-spin size-4" /> : (isLogin ? "Sign In" : "Create Account")}
                  </button>
                </form>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-wider font-semibold"><span className="bg-card px-2.5 text-muted-foreground">Or</span></div>
                </div>

                <button 
                  type="button" 
                  className="w-full h-11 rounded-full border border-border bg-card hover:bg-secondary text-foreground text-sm font-semibold flex items-center justify-center gap-2.5 transition-transform active:scale-95" 
                  onClick={handleGoogleSignIn} 
                  disabled={loading}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span>Sign in with Google</span>
                </button>

                <p className="text-center text-xs text-muted-foreground mt-6 font-normal">
                  {isLogin ? "New to Dawa Lens?" : "Already have an account?"}{" "}
                  <button onClick={() => setIsLogin(!isLogin)} className="text-[#0066cc] dark:text-[#2997ff] font-semibold hover:underline ml-1">
                    {isLogin ? "Create Account" : "Sign In"}
                  </button>
                </p>
              </motion.div>
            )}

            {stage === "forgot-password" && (
              <motion.div
                key="forgot-password"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="rounded-[18px] border border-border bg-card p-6 sm:p-8"
              >
                <button onClick={() => setStage("form")} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-6">
                  <ArrowLeft size={14} /> Back to Sign In
                </button>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold tracking-[-0.022em] text-foreground mb-1.5">Reset Password</h2>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Enter the email associated with your account and we'll send a link to reset your password.
                  </p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold text-foreground uppercase tracking-wider">Email Address</Label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-3.5 text-muted-foreground" />
                      <Input 
                        id="email" type="email" placeholder="you@example.com" 
                        className="pl-10 h-11 rounded-full bg-card border-border text-sm"
                        value={email} onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    className="w-full h-11 rounded-full text-sm font-semibold bg-[#0066cc] dark:bg-[#0071e3] text-white hover:opacity-95 transition-transform active:scale-95 flex items-center justify-center gap-2" 
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="animate-spin size-4" /> : "Send Reset Link"}
                  </button>
                </form>
              </motion.div>
            )}

            {stage === "awaiting-verification" && (
              <motion.div
                key="verify"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-[18px] border border-border bg-card p-6 sm:p-8 text-center"
              >
                <div className="w-20 h-20 rounded-[20px] bg-secondary border border-border flex items-center justify-center mx-auto mb-6 relative">
                  <Mail size={32} className="text-[#0066cc] dark:text-[#2997ff]" />
                </div>

                <h2 className="text-2xl font-bold tracking-[-0.022em] text-foreground mb-2">Verify Identity</h2>
                <p className="text-muted-foreground text-sm leading-relaxed mb-6 px-2">
                  We've sent a secure link to <strong className="text-foreground">{email}</strong>. 
                  Please confirm your email to activate your Health Lens.
                </p>

                <div className="space-y-3">
                  <button 
                    className="w-full h-11 rounded-full text-sm font-semibold bg-[#0066cc] dark:bg-[#0071e3] text-white hover:opacity-95 transition-transform active:scale-95 flex items-center justify-center gap-2" 
                    onClick={() => window.location.reload()}
                  >
                    <CheckCircle2 size={16} /> I've Verified My Email
                  </button>
                  <button 
                    className="w-full h-11 rounded-full text-xs font-semibold border border-border bg-card hover:bg-secondary text-foreground transition-transform active:scale-95 flex items-center justify-center gap-2" 
                    onClick={() => {}} 
                    disabled={resending}
                  >
                    {resending ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <RefreshCw size={14} />}
                    Resend Code
                  </button>
                  <button onClick={() => setStage("form")} className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors pt-2">
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
