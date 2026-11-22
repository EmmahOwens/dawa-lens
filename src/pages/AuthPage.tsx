import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LOGO_BASE64 } from "@/lib/logoBase64";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  RefreshCw,
  User,
  ShieldCheck,
} from "@/lib/icons";
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
  AuthError,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import SuccessState from "@/components/SuccessState";
import ErrorDialog from "@/components/ErrorDialog";
import { notify } from "@/lib/notifications";
import { Switch } from "@/components/ui/switch";
import { EDITORIAL_EASE, EditorialEyebrow } from "@/components/editorial/EditorialPrimitives";

type Stage = "form" | "awaiting-verification" | "forgot-password";

/** Precision 4-segment Password Strength Meter */
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
  const labels = ["Empty", "Weak", "Fair", "Strong", "Very Strong"];
  const barTones = [
    "bg-border",
    "bg-destructive",
    "bg-amber-500",
    "bg-primary",
    "bg-emerald-500",
  ];
  const textTones = [
    "text-muted-foreground",
    "text-destructive",
    "text-amber-600 dark:text-amber-400",
    "text-primary",
    "text-emerald-600 dark:text-emerald-400",
  ];

  return (
    <div className="pt-2 space-y-2">
      <div className="flex items-center justify-between px-0.5">
        <span className="editorial-mono text-[9.5px] text-muted-foreground">
          Password Strength
        </span>
        <span className={`editorial-mono text-[9.5px] transition-colors ${textTones[strength]}`}>
          {labels[strength]}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {[1, 2, 3, 4].map((segment) => (
          <div
            key={segment}
            className="h-1 rounded-full bg-secondary overflow-hidden"
          >
            <motion.div
              initial={false}
              animate={{ scaleX: strength >= segment ? 1 : 0 }}
              transition={{ duration: 0.3, ease: EDITORIAL_EASE }}
              className={`h-full w-full origin-left rounded-full ${barTones[strength]}`}
            />
          </div>
        ))}
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
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    type?: "critical" | "warning" | "error";
  }>({
    open: false,
    title: "",
    description: "",
  });

  const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

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

        await setDoc(doc(db, "users", user.uid), {
          id: user.uid,
          name: name.trim(),
          email: email,
          createdAt: new Date().toISOString(),
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

  const handleResendVerification = async () => {
    if (!auth.currentUser) return;
    setResending(true);
    try {
      await sendEmailVerification(auth.currentUser, {
        url: `${window.location.origin}/`,
        handleCodeInApp: false,
      });
      notify.success("Verification Sent", "A fresh verification link has been emailed.");
    } catch (err: unknown) {
      notify.error("Unable to Resend", (err as Error).message);
    } finally {
      setResending(false);
    }
  };

  const handleAuthError = (error: AuthError) => {
    if (error.code === "auth/user-not-found") {
      setErrorDialog({
        open: true,
        title: "Account Not Found",
        description:
          "We couldn't find an account with this email. Would you like to sign up instead?",
        type: "warning",
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
        description:
          "Too many failed attempts. Access is temporarily restricted for your safety.",
        type: "critical",
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

      await setDoc(
        doc(db, "users", result.user.uid),
        {
          id: result.user.uid,
          name: result.user.displayName || "User",
          email: result.user.email,
          photoURL: result.user.photoURL,
          lastLogin: new Date().toISOString(),
        },
        { merge: true }
      );

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
    <div className="min-h-[100dvh] lg:h-[100dvh] lg:overflow-hidden flex bg-background text-foreground">
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
        onOpenChange={(open) => setErrorDialog((prev) => ({ ...prev, open }))}
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

      {/* Left Panel: Inset Photographic Editorial Canvas (Desktop) */}
      <div className="hidden lg:flex lg:w-[52%] p-4 xl:p-5 shrink-0">
        <div className="relative w-full h-full rounded-[30px] overflow-hidden editorial-panel-dark flex flex-col justify-between p-10 xl:p-14">
          {/* Curated Local Photography Backdrop */}
          <img
            src="/assets/readme/vision-scanner-hero.jpg"
            alt="Dawa Lens visual medication identification"
            className="absolute inset-0 w-full h-full object-cover object-top opacity-45 scale-[1.02]"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#07090d] via-[#07090d]/90 to-[#07090d]/35" />
          <div className="editorial-grain" aria-hidden="true" />

          {/* Top Bar: Wordmark + Live Clinical Index */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: EDITORIAL_EASE }}
            className="relative z-10 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="editorial-glass-dark w-10 h-10 rounded-full flex items-center justify-center p-2">
                <img src={LOGO_BASE64} alt="Dawa Lens" className="w-full h-full object-contain" />
              </div>
              <div className="leading-none">
                <span className="text-[16px] font-medium tracking-[-0.02em] text-white block">
                  Dawa Lens<sup className="text-[9px] text-white/50 ml-0.5">®</sup>
                </span>
                <span className="editorial-mono text-[9px] text-white/55 mt-1 block">
                  Clinical Intelligence
                </span>
              </div>
            </div>

            <div className="editorial-glass-dark rounded-full px-3.5 py-1.5 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="editorial-mono text-[9.5px] text-white/80">
                NDA Uganda · Offline Ready
              </span>
            </div>
          </motion.div>

          {/* Bottom-Anchored Editorial Statement + Proof Strip */}
          <div className="relative z-10 space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.7, delay: 0.12, ease: EDITORIAL_EASE }}
            >
              <EditorialEyebrow
                index="01"
                label="Verified Medication Safety"
                onDark
                className="mb-4"
              />
              <h1 className="editorial-display text-[clamp(40px,3.8vw,60px)] font-medium text-white leading-[0.98] tracking-[-0.04em] mb-4">
                Precision care.
                <br />
                Every dose{" "}
                <em className="editorial-serif text-[1.08em] text-white/70 font-normal">
                  matters.
                </em>
              </h1>
              <p className="text-[15px] text-white/75 max-w-md leading-[1.6] font-normal">
                Identify loose tablets, check interactions against everyday Ugandan meals, and keep
                your family&apos;s schedules synchronized — online or completely offline.
              </p>
            </motion.div>

            {/* Hairline Proof Strip */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.25, ease: EDITORIAL_EASE }}
              className="grid grid-cols-3 divide-x divide-white/15 pt-6 border-t border-white/15"
            >
              <div className="pr-4">
                <p className="editorial-tabular text-[22px] font-light text-white tracking-[-0.03em]">
                  1,800+
                </p>
                <p className="editorial-mono text-[9px] text-white/50 mt-1">
                  NDA Pharmacies
                </p>
              </div>
              <div className="px-4">
                <p className="editorial-tabular text-[22px] font-light text-white tracking-[-0.03em]">
                  &lt; 1ms
                </p>
                <p className="editorial-mono text-[9px] text-white/50 mt-1">
                  Offline Drug Search
                </p>
              </div>
              <div className="pl-4">
                <p className="editorial-tabular text-[22px] font-light text-white tracking-[-0.03em]">
                  EN · LG · SW
                </p>
                <p className="editorial-mono text-[9px] text-white/50 mt-1">
                  DawaGPT Support
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Right Panel: Serene Editorial Authentication Studio */}
      <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto no-scrollbar px-5 py-8 sm:px-10 lg:px-14">
        <div className="w-full max-w-[420px] space-y-6">
          {/* Mobile Brand Header */}
          <div className="lg:hidden flex items-center justify-between pb-4 border-b border-border/70">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-secondary border border-border/80 flex items-center justify-center p-2">
                <img src={LOGO_BASE64} alt="Dawa Lens" className="w-full h-full object-contain" />
              </div>
              <div>
                <span className="text-[17px] font-semibold tracking-[-0.025em] text-foreground block leading-none">
                  Dawa Lens
                </span>
                <span className="editorial-mono text-[9px] text-muted-foreground mt-1 block">
                  Clinical Suite
                </span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 editorial-mono text-[9px] text-emerald-600 dark:text-emerald-400">
              <ShieldCheck size={12} /> Encrypted
            </span>
          </div>

          <AnimatePresence mode="wait">
            {stage === "form" && (
              <motion.div
                key="auth-form"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4, ease: EDITORIAL_EASE }}
                className="space-y-6"
              >
                {/* Segmented Mode Switcher */}
                <div className="editorial-segment-rail w-full grid grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setIsLogin(true)}
                    className={`py-2.5 rounded-full text-[13px] font-medium transition-all ${
                      isLogin
                        ? "editorial-segment-active"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLogin(false)}
                    className={`py-2.5 rounded-full text-[13px] font-medium transition-all ${
                      !isLogin
                        ? "editorial-segment-active"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                {/* Editorial Heading */}
                <div className="space-y-1.5">
                  <EditorialEyebrow
                    index={isLogin ? "01" : "02"}
                    label={isLogin ? "Member Access" : "New Clinical Profile"}
                    dotColor="bg-primary"
                  />
                  <h2 className="editorial-display text-[32px] sm:text-[36px] font-medium tracking-[-0.035em] text-foreground pt-1">
                    {isLogin ? (
                      <>
                        Welcome{" "}
                        <em className="editorial-serif text-[1.08em] text-muted-foreground font-normal">
                          back.
                        </em>
                      </>
                    ) : (
                      <>
                        Begin your{" "}
                        <em className="editorial-serif text-[1.08em] text-muted-foreground font-normal">
                          care lens.
                        </em>
                      </>
                    )}
                  </h2>
                  <p className="text-[14px] text-muted-foreground leading-relaxed">
                    {isLogin
                      ? "Sign in to access your active cabinet, reminders, and safety alerts."
                      : "Create a private account to track prescriptions and family schedules."}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {!isLogin && (
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="name"
                        className="editorial-mono text-[10px] text-muted-foreground pl-1"
                      >
                        Full Name
                      </Label>
                      <div className="relative group">
                        <User
                          size={15}
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors"
                        />
                        <Input
                          id="name"
                          placeholder="e.g. Sarah Nakato"
                          className="pl-11 h-12 rounded-2xl bg-secondary/50 focus:bg-card border-border/80 focus:border-primary text-[14.5px] transition-colors"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label
                      htmlFor="email"
                      className="editorial-mono text-[10px] text-muted-foreground pl-1"
                    >
                      Email Address
                    </Label>
                    <div className="relative group">
                      <Mail
                        size={15}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors"
                      />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        className="pl-11 h-12 rounded-2xl bg-secondary/50 focus:bg-card border-border/80 focus:border-primary text-[14.5px] transition-colors"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-1">
                      <Label
                        htmlFor="password"
                        className="editorial-mono text-[10px] text-muted-foreground"
                      >
                        Password
                      </Label>
                      {isLogin && (
                        <button
                          type="button"
                          onClick={() => setStage("forgot-password")}
                          className="text-[12px] font-medium text-primary hover:underline transition-colors"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative group">
                      <Lock
                        size={15}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors"
                      />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="pl-11 pr-11 h-12 rounded-2xl bg-secondary/50 focus:bg-card border-border/80 focus:border-primary text-[14.5px] transition-colors"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {!isLogin && <PillStrengthMeter password={password} />}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2.5">
                      <Switch
                        id="remember"
                        checked={rememberMe}
                        onCheckedChange={setRememberMe}
                      />
                      <Label
                        htmlFor="remember"
                        className="text-[13px] font-normal text-muted-foreground cursor-pointer"
                      >
                        Keep me signed in on this device
                      </Label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-editorial-roll w-full h-12 pl-6 pr-2.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20 text-[14.5px] font-medium justify-between mt-2 disabled:opacity-50"
                  >
                    <span>
                      {loading ? "Authenticating..." : isLogin ? "Sign In" : "Create Account"}
                    </span>
                    <span className="roll-chip w-8 h-8 bg-white text-primary">
                      {loading ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <ArrowRight size={14} />
                      )}
                    </span>
                  </button>
                </form>

                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/75" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-background px-3 editorial-mono text-[9.5px] text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full h-12 rounded-full border border-border/90 bg-card hover:bg-secondary/70 text-foreground text-[14px] font-medium flex items-center justify-center gap-2.5 transition-colors active:scale-[0.98] disabled:opacity-50"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
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
                  </svg>
                  <span>Sign in with Google</span>
                </button>
              </motion.div>
            )}

            {stage === "forgot-password" && (
              <motion.div
                key="forgot-password"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4, ease: EDITORIAL_EASE }}
                className="editorial-card p-7 sm:p-8 space-y-6"
              >
                <button
                  type="button"
                  onClick={() => setStage("form")}
                  className="inline-flex items-center gap-1.5 editorial-mono text-[10px] text-primary hover:opacity-80 transition-opacity"
                >
                  <ArrowLeft size={13} /> Back to Sign In
                </button>

                <div className="space-y-1.5">
                  <h2 className="editorial-display text-[30px] font-medium tracking-[-0.03em] text-foreground">
                    Reset{" "}
                    <em className="editorial-serif text-[1.08em] text-muted-foreground font-normal">
                      password.
                    </em>
                  </h2>
                  <p className="text-[14px] text-muted-foreground leading-relaxed">
                    Enter your registered email and we will send a secure link to restore access.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="reset-email"
                      className="editorial-mono text-[10px] text-muted-foreground pl-1"
                    >
                      Email Address
                    </Label>
                    <div className="relative group">
                      <Mail
                        size={15}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors"
                      />
                      <Input
                        id="reset-email"
                        type="email"
                        placeholder="you@example.com"
                        className="pl-11 h-12 rounded-2xl bg-secondary/50 focus:bg-card border-border/80 focus:border-primary text-[14.5px]"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-editorial-roll w-full h-12 pl-6 pr-2.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20 text-[14.5px] font-medium justify-between"
                  >
                    <span>{loading ? "Sending Link..." : "Send Reset Link"}</span>
                    <span className="roll-chip w-8 h-8 bg-white text-primary">
                      {loading ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : (
                        <ArrowRight size={14} />
                      )}
                    </span>
                  </button>
                </form>
              </motion.div>
            )}

            {stage === "awaiting-verification" && (
              <motion.div
                key="verify"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EDITORIAL_EASE }}
                className="editorial-card p-7 sm:p-8 text-center space-y-6"
              >
                <div className="w-16 h-16 rounded-2xl bg-secondary border border-border/80 flex items-center justify-center mx-auto text-primary">
                  <Mail size={26} />
                </div>

                <div className="space-y-2">
                  <EditorialEyebrow
                    index="02"
                    label="Email Verification"
                    dotColor="bg-primary"
                    className="justify-center"
                  />
                  <h2 className="editorial-display text-[30px] font-medium tracking-[-0.03em] text-foreground">
                    Verify your{" "}
                    <em className="editorial-serif text-[1.08em] text-muted-foreground font-normal">
                      identity.
                    </em>
                  </h2>
                  <p className="text-[14px] text-muted-foreground leading-relaxed px-2">
                    We sent a verification link to{" "}
                    <strong className="text-foreground font-medium">{email}</strong>. Confirm your
                    inbox to activate your clinical suite.
                  </p>
                </div>

                <div className="space-y-2.5 pt-2">
                  <button
                    type="button"
                    className="w-full h-12 rounded-full text-[14.5px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    onClick={() => window.location.reload()}
                  >
                    <CheckCircle2 size={16} /> I&apos;ve Verified My Email
                  </button>
                  <button
                    type="button"
                    className="w-full h-11 rounded-full text-[13px] font-medium border border-border bg-card hover:bg-secondary text-foreground transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
                    onClick={handleResendVerification}
                    disabled={resending}
                  >
                    {resending ? (
                      <Loader2 className="animate-spin h-3.5 w-3.5" />
                    ) : (
                      <RefreshCw size={14} />
                    )}
                    Resend Verification Email
                  </button>
                  <button
                    type="button"
                    onClick={() => setStage("form")}
                    className="editorial-mono text-[10px] text-primary hover:underline pt-2 block mx-auto"
                  >
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
