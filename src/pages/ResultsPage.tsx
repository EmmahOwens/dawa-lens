import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, Search, AlertTriangle, ThumbsUp, ThumbsDown, FileText, Loader2, Pill, Sparkles, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useApp } from "@/contexts/AppContext";
import { identifyPill, PillMatch } from "@/services/pillIdService";
import { ShieldCheck, ShieldAlert, ShieldQuestion, CalendarClock, Flag, Bell as BellIcon } from "lucide-react";
import PremiumLoader from "@/components/PremiumLoader";

type MatchResult = {
  name: string;
  genericName?: string;
  confidence: number;
  recommendedDosage?: string;
};

export default function ResultsPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { addMedicine, userProfile, patients, selectedPatientId } = useApp();
  
  const state = location.state as any;
  const imageUrl = state?.imageUrl;
  const mode = state?.mode || "pill";

  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  
  // OCR & Analysis State
  const [loading, setLoading] = useState(true);
  const [aiMatches, setAiMatches] = useState<MatchResult[]>([]);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [animationComplete, setAnimationComplete] = useState(false);
  const [scanError, setScanError] = useState<{message: string; code?: string; fixUrl?: string} | null>(null);

  useEffect(() => {
    async function process() {
      setLoading(true);
      setScanError(null);
      try {
        let ageString = undefined;
        if (selectedPatientId) {
          const patient = patients.find(p => p.id === selectedPatientId);
          if (patient && patient.age) ageString = patient.age.toString();
        } else if (userProfile && userProfile.dateOfBirth) {
          const dob = new Date(userProfile.dateOfBirth);
          const ageDifMs = Date.now() - dob.getTime();
          const ageDate = new Date(ageDifMs);
          ageString = Math.abs(ageDate.getUTCFullYear() - 1970).toString();
        }

        if ((mode === "pill" || mode === "text") && imageUrl) {
          const res = await identifyPill(imageUrl, ageString);
          if (res.success) {
            setAiMatches(res.matches);
            setAiSummary((res as any).summary || "");
          }
        }
      } catch (e: any) {
        console.error(e);
        const code = e?.code as string | undefined;
        const errorMessages: Record<string, string> = {
          API_KEY_MISSING: 'Gemini API key is not configured. Add GEMINI_API_KEY to server/.env.',
          INVALID_API_KEY: 'The Gemini API key is invalid or expired. Check server/.env.',
          BILLING_DISABLED: 'Google Cloud Vision billing is not enabled on this GCP project.',
          RATE_LIMITED: 'AI rate limit reached. Please wait a moment and try again.',
          SAFETY_BLOCKED: 'The image was blocked by safety filters. Please try a clearer photo.',
        };
        if (code && code in errorMessages) {
          setScanError({ message: errorMessages[code], code, fixUrl: e?.fixUrl });
        } else {
          setScanError({ message: e?.message || 'An unknown error occurred during scan processing.', code });
        }
      }
      // AI processing is done, but we wait for the animation to finish
      setLoading(false);
    }
    process();
  }, [mode, imageUrl]);

  const highConfidence = aiMatches.filter((r) => r.confidence >= 0.7);
  const lowConfidence = aiMatches.filter((r) => r.confidence < 0.7);

  const handleConfirm = (result: Partial<MatchResult>) => {
    const finalName = result.name || "Unknown Medicine";
    setConfirmed(finalName);
    addMedicine({
      name: finalName,
      genericName: result.genericName || "",
      dosage: result.recommendedDosage || finalName.split(" ").pop() || "",
      imageUrl: imageUrl || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="px-4 pt-6 pb-4 min-h-screen">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground mb-8 hover:text-primary transition-colors group">
        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> {t("common.back")}
      </button>

      <h1 className="text-3xl font-black text-foreground mb-6 tracking-tighter flex items-center gap-3">
        {mode === "text" && <FileText size={28} className="text-primary" />}
        {mode === "pill" && <Pill size={28} className="text-primary" />}
        {t("scan.recognition_results", "Recognition Results")}
      </h1>

      {(!animationComplete || loading) && (
        <PremiumLoader onComplete={() => setAnimationComplete(true)} />
      )}

      {imageUrl && (
        <div className="mb-8 rounded-[2.5rem] overflow-hidden border-4 border-card shadow-2xl bg-black/5 flex items-center justify-center relative aspect-square max-h-[400px] mx-auto">
          <img src={imageUrl} alt="Captured scan" className="w-full h-full object-cover" />
          {(!animationComplete || loading) && (
            <motion.div 
               className="absolute top-0 left-0 w-full h-[15%] bg-gradient-to-b from-transparent to-primary/40 border-b-[3px] border-primary z-10 box-border"
               animate={{ y: [0, 340, 0] }}
               transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            />
          )}
        </div>
      )}

      <AnimatePresence>
        {saved && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(5px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/50 pointer-events-none"
          >
             <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="w-48 h-48 bg-card/90 backdrop-blur-3xl rounded-[3rem] border border-white/20 shadow-[0_0_50px_rgba(0,0,0,0.2)] flex flex-col items-center justify-center gap-5"
             >
                <div className="relative">
                  <motion.svg width="60" height="60" viewBox="0 0 50 50">
                    <motion.circle 
                      cx="25" cy="25" r="23" 
                      fill="transparent" stroke="hsl(var(--success))" strokeWidth="4" 
                      initial={{ strokeDasharray: "150", strokeDashoffset: "150" }}
                      animate={{ strokeDashoffset: 0 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                    <motion.path 
                      d="M14 26 L22 34 L38 16" 
                      fill="transparent" stroke="hsl(var(--success))" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }}
                    />
                  </motion.svg>
                </div>
                <p className="text-sm font-black uppercase tracking-widest text-success">Saved</p>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- SCAN ERROR BANNER --- */}
      {scanError && !loading && animationComplete && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-3xl border-2 border-destructive/30 bg-destructive/5 p-6"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle size={22} className="text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-black text-sm text-destructive uppercase tracking-tight mb-1">
                {scanError.code === 'API_KEY_MISSING' || scanError.code === 'INVALID_API_KEY'
                  ? 'API Key Not Configured'
                  : scanError.code === 'RATE_LIMITED'
                  ? 'Rate Limit Reached'
                  : scanError.code === 'SAFETY_BLOCKED'
                  ? 'Image Blocked'
                  : 'Scan Failed'}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">{scanError.message}</p>
              {(scanError.code === 'API_KEY_MISSING' || scanError.code === 'INVALID_API_KEY') && (
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-primary hover:underline"
                >
                  <Sparkles size={12} /> Get Free Gemini API Key →
                </a>
              )}
              {scanError.fixUrl && scanError.code !== 'API_KEY_MISSING' && scanError.code !== 'INVALID_API_KEY' && (
                <a
                  href={scanError.fixUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-primary hover:underline"
                >
                  <Sparkles size={12} /> Fix This →
                </a>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* --- ML MATCHES MODE (PILL & TEXT) --- */}
      {(mode === "pill" || mode === "text") && !loading && animationComplete && (
        <>
          {/* AI Summary from Gemini */}
          {aiSummary && !scanError && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 px-5 py-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-start gap-3"
            >
              <Sparkles size={16} className="text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/80 leading-relaxed font-medium italic">{aiSummary}</p>
            </motion.div>
          )}

          {highConfidence.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-4 flex items-center gap-2">
                <ThumbsUp size={14} className="text-success" /> {t("scan.high_confidence")}
              </h2>
              <div className="space-y-4">
                {highConfidence.map((r, idx) => (
                  <motion.div
                    key={r.name + idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -5 }}
                    className={`rounded-[2rem] border-2 p-6 transition-all ${confirmed === r.name ? "border-success bg-success/5 shadow-lg" : "border-border bg-card hover:border-primary/30 hover:shadow-xl"}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-black text-card-foreground leading-tight">{r.name}</h3>
                        {r.genericName && <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1 opacity-70">{r.genericName}</p>}
                        {r.recommendedDosage && <p className="text-xs font-bold text-primary mt-2">Recommended Dose: {r.recommendedDosage}</p>}
                      </div>
                      <div className="bg-success text-success-foreground rounded-full px-3 py-1 text-[11px] font-black shadow-lg">
                        {Math.round(r.confidence * 100)}% Match
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <Button className="rounded-full flex-1 h-12" onClick={() => handleConfirm(r)} disabled={!!confirmed}>
                          <Check size={18} className="mr-2" /> {t("common.save")}
                        </Button>
                        <Button 
                          variant="secondary" 
                          className="rounded-full flex-1 h-12" 
                          onClick={() => navigate("/reminders/new", { state: { medicineName: r.name, dose: r.recommendedDosage } })}
                        >
                          <Bell size={18} className="mr-2" /> Reminder
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        className="rounded-full w-full h-12"
                        onClick={() => navigate(`/medicine/${encodeURIComponent(r.name)}`)}
                      >
                         View Details & Safety <ArrowLeft size={16} className="rotate-180 ml-2" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
          {lowConfidence.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <ThumbsDown size={14} className="text-warning" /> {t("scan.low_confidence")}
              </h2>
              <div className="space-y-3">
                {lowConfidence.map((r) => (
                  <div key={r.name} className="rounded-xl border border-warning/30 bg-warning/5 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-card-foreground">{r.name}</p>
                      </div>
                      <span className="rounded-lg bg-warning/15 px-2 py-1 text-xs font-bold text-warning">
                        {Math.round(r.confidence * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/search?q=${encodeURIComponent(r.name)}`)}>
                        <Search size={14} className="mr-1" /> Verify
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}


      <div className="h-12" />
    </div>
  );
}
