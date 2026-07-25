import { useState } from 'react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { ShieldCheck, Mail, Lock, AlertCircle, Loader2, Eye, EyeOff } from '../lib/icons';

interface AdminLoginProps { onAccessDenied?: () => void }

export function AdminLogin({ onAccessDenied: _ }: AdminLoginProps) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const token = await cred.user.getIdTokenResult(true);
      if (token.claims.admin !== true) {
        await signOut(auth);
        setError('Access denied. This account does not have admin privileges.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed';
      if (msg.includes('invalid-credential') || msg.includes('wrong-password') || msg.includes('user-not-found')) {
        setError('Invalid email or password.');
      } else if (msg.includes('too-many-requests')) {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background admin-grid-bg overflow-hidden relative">
      {/* Animated background orbs */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-primary/8 rounded-full blur-3xl pointer-events-none animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-60 h-60 bg-violet-500/6 rounded-full blur-3xl pointer-events-none animate-float" style={{ animationDelay: '1.5s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/4 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm px-4">
        {/* Logo lockup */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-5">
            <div className="absolute inset-0 rounded-2xl bg-primary blur-xl opacity-30 scale-110" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-2xl shadow-primary/30">
              <ShieldCheck size={30} className="text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Dawa Lens</h1>
          <p className="text-sm text-muted-foreground mt-1">Admin Console</p>
        </div>

        {/* Card */}
        <div className="glass-card p-6 shadow-2xl shadow-black/40">
          <h2 className="text-sm font-bold text-foreground mb-1">Welcome back</h2>
          <p className="text-xs text-muted-foreground mb-6">Sign in with your admin credentials</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 text-sm bg-secondary/60 border border-border/60 rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
                  placeholder="admin@example.com"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  id="admin-password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-10 py-3 text-sm bg-secondary/60 border border-border/60 rounded-xl text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-destructive/10 border border-destructive/25 animate-fade-in">
                <AlertCircle size={14} className="text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive leading-relaxed">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              id="admin-signin-btn"
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 active:scale-[0.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary/25 mt-2"
            >
              {loading
                ? <><Loader2 size={14} className="animate-spin" /> Signing in…</>
                : 'Sign In to Admin Console'
              }
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-muted-foreground/40 mt-6">
          Internal use only · Dawa Lens Admin Console
        </p>
      </div>
    </div>
  );
}
