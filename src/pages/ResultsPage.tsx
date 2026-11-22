import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Search,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Bell,
  Info,
  ShieldAlert,
} from "@/lib/icons";
import { useTranslation } from "react-i18next";
import { useApp } from "@/contexts/AppContext";
import { identifyPill, PillMatch } from "@/services/pillIdService";
import PremiumLoader from "@/components/PremiumLoader";
import FdaBoxedWarningBadge from "@/components/fda/FdaBoxedWarningBadge";
import {
  EDITORIAL_EASE,
  EditorialEyebrow,
  EditorialSectionHeader,
} from "@/components/editorial/EditorialPrimitives";

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

  const [loading, setLoading] = useState(true);
  const [aiMatches, setAiMatches] = useState<MatchResult[]>([]);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [animationComplete, setAnimationComplete] = useState(false);
  const [scanError, setScanError] = useState<{
    message: string;
    code?: string;
    fixUrl?: string;
  } | null>(null);

  useEffect(() => {
    async function process() {
      setLoading(true);
      setScanError(null);
      try {
        let ageString: string | undefined = undefined;
        if (selectedPatientId) {
          const patient = patients.find((p) => p.id === selectedPatientId);
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
          API_KEY_MISSING:
            "Gemini API key is not configured. Add GEMINI_API_KEY to your Render environment.",
          GEMINI_KEY_MISSING:
            "Gemini API key is not configured. Add GEMINI_API_KEY to your Render environment.",
          GEMINI_KEY_2_MISSING:
            "Gemini API key is not configured. Add GEMINI_API_KEY to your Render environment.",
          INVALID_API_KEY:
            "The Gemini API key is invalid or expired. Check your Render environment.",
          BILLING_DISABLED: "Google Cloud billing is not enabled on this GCP project.",
          RATE_LIMITED: "AI rate limit reached. Please wait a moment and try again.",
          SAFETY_BLOCKED:
            "The image was blocked by safety filters. Please try a clearer photo.",
          NO_INPUT_DETECTED:
            "No medication label or image detected. Please make sure the medication is facing the camera.",
        };
        if (code && code in errorMessages) {
          setScanError({ message: errorMessages[code], code, fixUrl: err.fixUrl });
        } else {
          setScanError({
            message: err.message || "An unknown error occurred during scan processing.",
            code,
          });
        }
      }
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
      dosage: "",
      imageUrl: imageUrl || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="w-full pt-2 sm:pt-4 pb-10">
      {/* Top Back Navigation */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 editorial-mono text-[10px] text-muted-foreground hover:text-foreground mb-5 transition-colors group"
      >
        <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
        <span>{t("common.back")}</span>
      </button>

      {/* Editorial Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EDITORIAL_EASE }}
        className="mb-7 space-y-2"
      >
        <EditorialEyebrow
          index="01"
          label="Optical Clinical Dossier"
          dotColor="bg-primary"
        />
        <h1 className="editorial-display text-[32px] sm:text-[40px] font-medium text-foreground leading-[1.02]">
          {t("scan.recognition_results", "Recognition")}{" "}
          <em className="editorial-serif text-[1.08em] text-muted-foreground font-normal">
            results.
          </em>
        </h1>
      </motion.div>

      {(!animationComplete || loading) && (
        <PremiumLoader onComplete={() => setAnimationComplete(true)} />
      )}

      {/* Inset Captured Specimen Frame */}
      {imageUrl && (
        <div className="mb-8 editorial-card p-2.5 max-w-md mx-auto">
          <div className="rounded-[18px] overflow-hidden bg-black flex items-center justify-center relative aspect-square">
            <img
              src={imageUrl}
              alt="Captured medication scan"
              className="w-full h-full object-cover"
            />
            <div className="editorial-grain" aria-hidden="true" />
            {(!animationComplete || loading) && (
              <motion.div
                className="absolute top-0 left-0 w-full h-[14%] bg-gradient-to-b from-transparent to-primary/40 border-b-2 border-primary z-10"
                animate={{ y: [0, 300, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              />
            )}
          </div>
        </div>
      )}

      {/* Saved Confirmation Modal */}
      <AnimatePresence>
        {saved && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-md pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="editorial-card w-48 h-48 flex flex-col items-center justify-center gap-4"
            >
              <motion.svg width="52" height="52" viewBox="0 0 50 50">
                <motion.circle
                  cx="25"
                  cy="25"
                  r="23"
                  fill="transparent"
                  stroke="hsl(var(--success))"
                  strokeWidth="2.5"
                  initial={{ strokeDasharray: "150", strokeDashoffset: "150" }}
                  animate={{ strokeDashoffset: 0 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
                <motion.path
                  d="M14 26 L22 34 L38 16"
                  fill="transparent"
                  stroke="hsl(var(--success))"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.4, delay: 0.25, ease: "easeOut" }}
                />
              </motion.svg>
              <p className="editorial-mono text-[10.5px] text-emerald-600 dark:text-emerald-400">
                Saved to Cabinet
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scan Error Banner */}
      {scanError && !loading && animationComplete && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 editorial-card border-destructive/35 bg-destructive/[0.04] p-5"
        >
          <div className="flex items-start gap-3.5">
            <AlertTriangle size={19} className="text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1.5">
              <p className="editorial-mono text-[10.5px] text-destructive">
                {scanError.code === "API_KEY_MISSING" ||
                scanError.code === "INVALID_API_KEY" ||
                scanError.code === "GEMINI_KEY_MISSING" ||
                scanError.code === "GEMINI_KEY_2_MISSING"
                  ? "API Key Not Configured"
                  : scanError.code === "RATE_LIMITED"
                    ? "Rate Limit Reached"
                    : scanError.code === "SAFETY_BLOCKED"
                      ? "Image Blocked"
                      : "Scan Failed"}
              </p>
              <p className="text-[13.5px] text-muted-foreground leading-relaxed">
                {scanError.message}
              </p>
              {(scanError.code === "API_KEY_MISSING" ||
                scanError.code === "INVALID_API_KEY" ||
                scanError.code === "GEMINI_KEY_MISSING" ||
                scanError.code === "GEMINI_KEY_2_MISSING") && (
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 pt-1 text-[13px] font-medium text-primary hover:underline"
                >
                  <Sparkles size={13} /> Get Free Gemini API Key →
                </a>
              )}
              {scanError.fixUrl &&
                scanError.code !== "API_KEY_MISSING" &&
                scanError.code !== "INVALID_API_KEY" && (
                  <a
                    href={scanError.fixUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 pt-1 text-[13px] font-medium text-primary hover:underline"
                  >
                    <Sparkles size={13} /> Fix This →
                  </a>
                )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ML Matches */}
      {mode === "text" && !loading && animationComplete && (
        <>
          {aiSummary && !scanError && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EDITORIAL_EASE }}
              className="mb-7 editorial-glass rounded-[22px] p-5 sm:p-6 flex items-start gap-3.5"
            >
              <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <Sparkles size={15} />
              </div>
              <div className="text-[13.5px] text-foreground/85 leading-[1.6]">
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
              <EditorialSectionHeader
                index="02"
                label={t("scan.high_confidence")}
                title="Verified"
                accent="matches"
                action={
                  <span className="inline-flex items-center gap-1.5 editorial-mono text-[9.5px] text-emerald-600 dark:text-emerald-400">
                    <ThumbsUp size={12} /> {highConfidence.length} Found
                  </span>
                }
              />

              <div className="space-y-4">
                {highConfidence.map((r, idx) => {
                  const hasReminder = reminders.some(
                    (rem) => rem.medicineName.toLowerCase() === r.name.toLowerCase()
                  );
                  return (
                    <motion.div
                      key={r.name + idx}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.06, duration: 0.5, ease: EDITORIAL_EASE }}
                      className={`editorial-card p-6 ${
                        confirmed === r.name ? "border-primary bg-primary/[0.03]" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h3 className="editorial-display text-[22px] sm:text-[24px] font-medium text-foreground leading-tight">
                              {r.name}
                            </h3>
                            {r.ndcValidated && (
                              <span className="inline-flex items-center gap-1 editorial-mono text-[9.5px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                                <Check size={10} /> NDC Verified
                              </span>
                            )}
                            {r.unverifiedNotice && (
                              <span className="inline-flex items-center gap-1 editorial-mono text-[9.5px] text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-full border border-sky-500/20">
                                <Check size={10} /> {r.unverifiedNotice}
                              </span>
                            )}
                            {r.deaSchedule && (
                              <span className="inline-flex items-center gap-1 editorial-mono text-[9.5px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                                <ShieldAlert size={10} /> {r.deaSchedule}
                              </span>
                            )}
                          </div>
                          {r.genericName && (
                            <p className="editorial-mono text-[10px] text-muted-foreground mt-1">
                              {r.genericName}
                            </p>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <p className="editorial-tabular text-[24px] font-light text-emerald-600 dark:text-emerald-400 leading-none">
                            {Math.round(r.confidence * 100)}%
                          </p>
                          <p className="editorial-mono text-[8.5px] text-muted-foreground mt-1">
                            Match
                          </p>
                        </div>
                      </div>

                      <div className="mb-4 rounded-2xl bg-amber-500/[0.06] border border-amber-500/20 p-3.5 flex items-start gap-2.5">
                        <ShieldAlert size={15} className="text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-[12px] text-amber-700 dark:text-amber-300 leading-relaxed">
                          <strong className="font-semibold">Unverified match:</strong> Confirm
                          dosage on physical packaging or with a licensed pharmacist.
                        </p>
                      </div>

                      {r.boxedWarning && (
                        <div className="mb-4">
                          <FdaBoxedWarningBadge warning={r.boxedWarning} drugName={r.name} />
                        </div>
                      )}

                      {r.indications && (
                        <div className="mb-5 rounded-2xl bg-secondary/60 border border-border/70 p-4 flex items-start gap-3">
                          <Info size={15} className="text-primary shrink-0 mt-0.5" />
                          <div>
                            <p className="editorial-mono text-[9.5px] text-foreground mb-1">
                              Typical Clinical Use
                            </p>
                            <p className="text-[13px] text-muted-foreground leading-relaxed">
                              {r.indications}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col gap-2.5 pt-2 border-t border-border/60">
                        <div className="grid grid-cols-2 gap-2.5 pt-2">
                          <button
                            type="button"
                            className="rounded-full h-11 text-[13px] font-medium bg-foreground text-background hover:opacity-90 transition-opacity active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-45"
                            onClick={() => handleConfirm(r)}
                            disabled={!!confirmed}
                          >
                            <Check size={15} /> {t("common.save")}
                          </button>
                          <button
                            type="button"
                            className="rounded-full h-11 text-[13px] font-medium border border-border bg-card hover:bg-secondary text-foreground transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
                            onClick={() => {
                              const existing = reminders.find(
                                (rem) => rem.medicineName.toLowerCase() === r.name.toLowerCase()
                              );
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
                                    icon: existing.icon,
                                  },
                                });
                              } else {
                                navigate("/reminders/new", {
                                  state: { medicineName: r.name, dose: "" },
                                });
                              }
                            }}
                          >
                            <Bell size={14} />
                            {hasReminder ? "Edit Reminder" : "Set Reminder"}
                          </button>
                        </div>

                        <button
                          type="button"
                          className="btn-editorial-roll w-full h-10 px-4 bg-secondary/70 hover:bg-secondary border border-border/70 text-[12.5px] font-medium text-foreground justify-between"
                          onClick={() => navigate(`/medicine/${encodeURIComponent(r.name)}`)}
                        >
                          <span>View Clinical Monograph &amp; Safety</span>
                          <span className="roll-chip w-6 h-6 bg-card border border-border text-foreground">
                            <ArrowRight size={12} />
                          </span>
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {lowConfidence.length > 0 && (
            <div className="mb-6">
              <EditorialSectionHeader
                index="03"
                label={t("scan.low_confidence")}
                title="Possible"
                accent="matches"
                action={
                  <span className="inline-flex items-center gap-1.5 editorial-mono text-[9.5px] text-amber-600 dark:text-amber-400">
                    <ThumbsDown size={12} /> Needs Review
                  </span>
                }
              />
              <div className="space-y-3">
                {lowConfidence.map((r) => (
                  <div
                    key={r.name}
                    className="editorial-card border-amber-500/30 p-5 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-[15px] truncate">{r.name}</p>
                      <p className="editorial-mono text-[9.5px] text-amber-600 dark:text-amber-400 mt-1 editorial-tabular">
                        {Math.round(r.confidence * 100)}% Confidence
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-full h-9 px-4 text-[12.5px] font-medium border border-border bg-secondary/70 hover:bg-secondary text-foreground active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
                      onClick={() => navigate(`/search?q=${encodeURIComponent(r.name)}`)}
                    >
                      <Search size={13} /> Verify
                    </button>
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
