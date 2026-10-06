import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, Check, Search, AlertTriangle, ThumbsUp, ThumbsDown, FileText, Loader2, Sparkles, Bell, Info } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useApp } from "@/contexts/AppContext";
import { identifyPill, PillMatch } from "@/services/pillIdService";
import { ShieldCheck, ShieldAlert, ShieldQuestion, CalendarClock, Flag, Bell as BellIcon } from "@/lib/icons";
import PremiumLoader from "@/components/PremiumLoader";
import FdaBoxedWarningBadge from "@/components/fda/FdaBoxedWarningBadge";

type MatchResult = PillMatch;

export default function ResultsPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { addMedicine, userProfile, patients, selectedPatientId, reminders } = useApp();
  
  const state = location.state as { imageUrl?: string; mode?: string } | null;
  const imageUrl = state?.imageUrl;
  const mode = state?.mode || "text";

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
        let ageString: string | undefined = undefined;
        if (selectedPatientId) {
          const patient = patients.find(p => p.id === selectedPatientId);
          if (patient && patient.age) ageString = patient.age.toString();
        } else if (userProfile && userProfile.dateOfBirth) {
          const dob = new Date(userProfile.dateOfBirth);
          const ageDifMs = Date.now() - dob.getTime();
          const ageDate = new Date(ageDifMs);
          ageString = Math.abs(ageDate.getUTCFullYear() - 1970).toString();
        }

        if (mode === "text" && imageUrl) {
          const res = await identifyPill(imageUrl, ageString);
          if (res.success) {
            setAiMatches(res.matches);
            setAiSummary((res as { summary?: string }).summary || "");
          }
        }
      } catch (e: unknown) {
        console.error(e);
        const err = e as { code?: string; message?: string; fixUrl?: string };
        const code = err.code;
        const errorMessages: Record<string, string> = {
          API_KEY_MISSING: 'Gemini API key is not configured. Add GEMINI_API_KEY to your Render environment.',
          GEMINI_KEY_MISSING: 'Gemini API key is not configured. Add GEMINI_API_KEY to your Render environment.',
          GEMINI_KEY_2_MISSING: 'Gemini API key is not configured. Add GEMINI_API_KEY to your Render environment.',
          INVALID_API_KEY: 'The Gemini API key is invalid or expired. Check your Render environment.',
          BILLING_DISABLED: 'Google Cloud billing is not enabled on this GCP project.',
          RATE_LIMITED: 'AI rate limit reached. Please wait a moment and try again.',
          SAFETY_BLOCKED: 'The image was blocked by safety filters. Please try a clearer photo.',
          NO_INPUT_DETECTED: 'No medication label or image detected. Please make sure the medication is facing the camera.',
        };
        if (code && code in errorMessages) {
          setScanError({ message: errorMessages[code], code, fixUrl: err.fixUrl });
        } else {
          setScanError({ message: err.message || 'An unknown error occurred during scan processing.', code });
        }
      }
      // AI processing is done, but we wait for the animation to finish
      setLoading(false);
    }
    process();
  }, [mode, imageUrl, patients, selectedPatientId, userProfile]);

  const highConfidence = aiMatches.filter((r) => r.confidence >= 0.7);
  const lowConfidence = aiMatches.filter((r) => r.confidence < 0.7);

  const handleConfirm = (result: Partial<MatchResult>) => {
    const finalName = result.name || "Unknown Medicine";
    setConfirmed(finalName);
    addMedicine({
      name: finalName,
      genericName: result.genericName || "",
      dosage: "", // Dose must be entered and confirmed by user or pharmacist
      imageUrl: imageUrl || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="w-full pt-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground mb-8 hover:text-primary transition-colors group">
        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> {t("common.back")}
      </button>

      <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-6 tracking-[-0.022em] flex items-center gap-2.5">
        <FileText size={24} className="text-[#0066cc] dark:text-[#2997ff]" />
        {t("scan.recognition_results", "Recognition Results")}
      </h1>

      {(!animationComplete || loading) && (
        <PremiumLoader onComplete={() => setAnimationComplete(true)} />
      )}

      {imageUrl && (
        <div className="mb-8 rounded-[18px] overflow-hidden border border-border bg-card flex items-center justify-center relative aspect-square max-h-[360px] mx-auto">
          <img src={imageUrl} alt="Captured scan" className="w-full h-full object-cover" />
          {(!animationComplete || loading) && (
            <motion.div 
               className="absolute top-0 left-0 w-full h-[15%] bg-gradient-to-b from-transparent to-primary/40 border-b-[2px] border-primary z-10 box-border"
               animate={{ y: [0, 300, 0] }}
               transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            />
          )}
        </div>
      )}

      <AnimatePresence>
        {saved && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-md pointer-events-none"
          >
             <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-44 h-44 bg-card rounded-[22px] border border-border flex flex-col items-center justify-center gap-4"
             >
                <div className="relative">
                  <motion.svg width="56" height="56" viewBox="0 0 50 50">
                    <motion.circle 
                      cx="25" cy="25" r="23" 
                      fill="transparent" stroke="hsl(var(--success))" strokeWidth="3" 
                      initial={{ strokeDasharray: "150", strokeDashoffset: "150" }}
                      animate={{ strokeDashoffset: 0 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                    <motion.path 
                      d="M14 26 L22 34 L38 16" 
                      fill="transparent" stroke="hsl(var(--success))" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }}
                    />
                  </motion.svg>
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-success">Saved</p>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- SCAN ERROR BANNER --- */}
      {scanError && !loading && animationComplete && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-[18px] border border-destructive/30 bg-destructive/5 p-5"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-sm text-destructive uppercase tracking-tight mb-1">
                {scanError.code === 'API_KEY_MISSING' || scanError.code === 'INVALID_API_KEY' || scanError.code === 'GEMINI_KEY_MISSING' || scanError.code === 'GEMINI_KEY_2_MISSING'
                  ? 'API Key Not Configured'
                  : scanError.code === 'RATE_LIMITED'
                  ? 'Rate Limit Reached'
                  : scanError.code === 'SAFETY_BLOCKED'
                  ? 'Image Blocked'
                  : 'Scan Failed'}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">{scanError.message}</p>
              {(scanError.code === 'API_KEY_MISSING' || scanError.code === 'INVALID_API_KEY' || scanError.code === 'GEMINI_KEY_MISSING' || scanError.code === 'GEMINI_KEY_2_MISSING') && (
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2.5 text-xs font-semibold text-[#0066cc] dark:text-[#2997ff] hover:underline"
                >
                  <Sparkles size={12} /> Get Free Gemini API Key →
                </a>
              )}
              {scanError.fixUrl && scanError.code !== 'API_KEY_MISSING' && scanError.code !== 'INVALID_API_KEY' && (
                <a
                  href={scanError.fixUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2.5 text-xs font-semibold text-[#0066cc] dark:text-[#2997ff] hover:underline"
                >
                  <Sparkles size={12} /> Fix This →
                </a>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* --- ML MATCHES (TEXT SCAN) --- */}
      {mode === "text" && !loading && animationComplete && (
        <>
          {/* AI Summary from Gemini */}
          {aiSummary && !scanError && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 px-5 py-4 rounded-[18px] bg-card border border-border flex items-start gap-3"
            >
              <Sparkles size={16} className="text-[#0066cc] dark:text-[#2997ff] shrink-0 mt-0.5" />
              <div className="text-xs text-foreground/80 leading-relaxed font-medium">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  }}
                >
                  {aiSummary}
                </ReactMarkdown>
              </div>
            </motion.div>
          )}

          {highConfidence.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                <ThumbsUp size={14} className="text-success" /> {t("scan.high_confidence")}
              </h2>
              <div className="space-y-4">
                {highConfidence.map((r, idx) => (
                  <motion.div
                    key={r.name + idx}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-[18px] border p-5 transition-all ${confirmed === r.name ? "border-[#0066cc] dark:border-[#2997ff] bg-primary/5" : "border-border bg-card hover:border-foreground/20"}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-lg font-bold text-card-foreground leading-tight">{r.name}</h3>
                          {r.ndcValidated && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                              <Check size={11} /> NDC Verified
                            </span>
                          )}
                          {r.deaSchedule && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                              <ShieldAlert size={11} /> {r.deaSchedule}
                            </span>
                          )}
                        </div>
                        {r.genericName && <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-0.5">{r.genericName}</p>}
                        <div className="mt-2 rounded-[11px] bg-amber-500/10 border border-amber-500/20 p-2.5 flex items-start gap-2">
                          <ShieldAlert size={14} className="text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-tight">
                            <strong className="font-semibold">Unverified match:</strong> Confirm dosage on physical packaging or with a pharmacist.
                          </p>
                        </div>
                      </div>
                      <div className="bg-success/15 text-success border border-success/20 rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0">
                        {Math.round(r.confidence * 100)}% Match
                      </div>
                    </div>

                    {/* FDA Boxed Warning if present */}
                    {r.boxedWarning && (
                      <div className="mb-3">
                        <FdaBoxedWarningBadge warning={r.boxedWarning} drugName={r.name} />
                      </div>
                    )}

                    {/* Indications / Typical Use Confirmation Prompt */}
                    {r.indications && (
                      <div className="mb-4 rounded-[11px] bg-muted/40 border border-border p-3 flex items-start gap-2.5">
                        <Info size={15} className="text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[11px] font-bold text-foreground">Typical Clinical Use:</p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{r.indications}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col gap-2 pt-2">
                      <div className="flex gap-2">
                        <button 
                          className="rounded-full flex-1 h-11 text-xs font-semibold bg-[#0066cc] dark:bg-[#0071e3] text-white hover:opacity-95 transition-transform active:scale-95 flex items-center justify-center gap-1.5" 
                          onClick={() => handleConfirm(r)} 
                          disabled={!!confirmed}
                        >
                          <Check size={16} /> {t("common.save")}
                        </button>
                        <button 
                          className="rounded-full flex-1 h-11 text-xs font-semibold border border-border bg-card hover:bg-secondary text-foreground transition-transform active:scale-95 flex items-center justify-center gap-1.5"
                          onClick={() => {
                            const existing = reminders.find(rem => rem.medicineName.toLowerCase() === r.name.toLowerCase());
                            if (existing) {
                              navigate("/reminders/new", { 
                                state: { 
                                  editId: existing.id, 
                                  medicineId: existing.medicineId,
                                  medicineName: existing.medicineName,
                                  dose: existing.dose, 
                                  time: existing.time, 
                                  repeat: existing.repeatSchedule, 
                                  repeatDays: existing.repeatDays,
                                  notes: existing.notes,
                                  color: existing.color,
                                  icon: existing.icon
                                } 
                              });
                            } else {
                              navigate("/reminders/new", { state: { medicineName: r.name, dose: "" } });
                            }
                          }}
                        >
                          <Bell size={15} /> 
                          {reminders.some(rem => rem.medicineName.toLowerCase() === r.name.toLowerCase()) ? "Edit Reminder" : "Reminder"}
                        </button>
                      </div>
                      <button
                        className="rounded-full w-full h-10 text-xs font-medium border border-border bg-secondary/50 hover:bg-secondary text-foreground transition-transform active:scale-95 flex items-center justify-center gap-1.5"
                        onClick={() => navigate(`/medicine/${encodeURIComponent(r.name)}`)}
                      >
                         View Details & Safety <ArrowLeft size={14} className="rotate-180" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
          {lowConfidence.length > 0 && (
            <div className="mb-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <ThumbsDown size={14} className="text-warning" /> {t("scan.low_confidence")}
              </h2>
              <div className="space-y-3">
                {lowConfidence.map((r) => (
                  <div key={r.name} className="rounded-[18px] border border-warning/30 bg-warning/5 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-foreground text-sm">{r.name}</p>
                      </div>
                      <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-semibold text-warning">
                        {Math.round(r.confidence * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <button 
                        className="rounded-full h-8 px-3.5 text-xs font-semibold border border-border bg-card hover:bg-secondary text-foreground active:scale-95 transition-transform flex items-center gap-1.5"
                        onClick={() => navigate(`/search?q=${encodeURIComponent(r.name)}`)}
                      >
                        <Search size={13} /> Verify
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
