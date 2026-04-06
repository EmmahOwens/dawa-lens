import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Search, AlertTriangle, ThumbsUp, ThumbsDown, ScanBarcode, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useApp } from "@/contexts/AppContext";
import { extractTextFromImage } from "@/services/visionService";
import { resolveBarcodeToDrugName } from "@/services/barcodeResolver";
import { identifyPill, PillMatch } from "@/services/pillIdService";
import { verifyScratchCode, VerificationResult } from "@/services/fakeMedService";
import { ShieldCheck, ShieldAlert, ShieldQuestion, CalendarClock, Flag } from "lucide-react";

type MatchResult = {
  name: string;
  genericName?: string;
  confidence: number;
};

export default function ResultsPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { addMedicine } = useApp();
  
  const state = location.state as any;
  const imageUrl = state?.imageUrl;
  const mode = state?.mode || "pill";
  const barcode = state?.barcode;

  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  
  // OCR & Barcode State
  const [loading, setLoading] = useState(true);
  const [extractedText, setExtractedText] = useState("");
  const [resolvedBarcodeDrug, setResolvedBarcodeDrug] = useState<string | null>(null);
  const [aiMatches, setAiMatches] = useState<MatchResult[]>([]);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  useEffect(() => {
    async function process() {
      setLoading(true);
      try {
        if (mode === "pill" && imageUrl) {
          const res = await identifyPill(imageUrl);
          if (res.success) {
            setAiMatches(res.matches);
          }
        } else if (mode === "text" && imageUrl) {
          const text = await extractTextFromImage(imageUrl);
          setExtractedText(text);
        } else if (mode === "barcode" && barcode) {
          const drugName = await resolveBarcodeToDrugName(barcode);
          setResolvedBarcodeDrug(drugName);
        } else if (mode === "verify" && imageUrl) {
          // In a real app, we'd OCR the image to find the code. 
          // For the prototype, we simulate finding the 'authentic' code from our mock DB.
          const res = await verifyScratchCode("1234567890"); 
          setVerificationResult(res);
        }
      } catch (e) {
        console.error(e);
        if (mode === "text") setExtractedText("Failed to extract text. Please try again.");
      }
      setLoading(false);
    }
    process();
  }, [mode, imageUrl, barcode]);

  const highConfidence = aiMatches.filter((r) => r.confidence >= 0.7);
  const lowConfidence = aiMatches.filter((r) => r.confidence < 0.7);

  const handleConfirm = (result: Partial<MatchResult>) => {
    const finalName = result.name || "Unknown Medicine";
    setConfirmed(finalName);
    addMedicine({
      name: finalName,
      genericName: result.genericName || "",
      dosage: finalName.split(" ").pop() || "",
      imageUrl: imageUrl || undefined,
    });
    setSaved(true);
  };

  return (
    <div className="px-4 pt-6 pb-4 min-h-screen">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <ArrowLeft size={16} /> Back to Scanner
      </button>

      <h1 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
        {mode === "text" && <FileText size={20} className="text-primary" />}
        {mode === "barcode" && <ScanBarcode size={20} className="text-primary" />}
        Recognition Results
      </h1>

      {imageUrl && mode !== "barcode" && (
        <div className="mb-6 rounded-xl overflow-hidden border border-border bg-black/5 flex items-center justify-center relative">
          <img src={imageUrl} alt="Captured scan" className="w-full max-h-[300px] object-contain" />
          {loading && (
             <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center">
                <Loader2 size={32} className="animate-spin text-primary mb-2" />
                <span className="text-sm font-medium">{t("scan.ai_loading")}</span>
             </div>
          )}
        </div>
      )}

      {saved && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-xl bg-success/10 border border-success/30 p-4 flex items-center gap-3"
        >
          <Check size={18} className="text-success" />
          <p className="text-sm text-success font-medium">{t("common.success")}!</p>
        </motion.div>
      )}

      {/* --- PILL ML MODE --- */}
      {mode === "pill" && !loading && (
        <>
          {highConfidence.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <ThumbsUp size={14} className="text-success" /> {t("scan.high_confidence")}
              </h2>
              <div className="space-y-3">
                {highConfidence.map((r, idx) => (
                  <motion.div
                    key={r.name + idx}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`rounded-xl border p-4 ${confirmed === r.name ? "border-success bg-success/5" : "border-border bg-card"}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-card-foreground">{r.name}</p>
                        {r.genericName && <p className="text-xs text-muted-foreground mt-0.5">{r.genericName}</p>}
                      </div>
                      <span className="rounded-lg bg-success/15 px-2 py-1 text-xs font-bold text-success">
                        {Math.round(r.confidence * 100)}%
                      </span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" onClick={() => handleConfirm(r)} disabled={!!confirmed}>
                        <Check size={14} className="mr-1" /> {t("common.save")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/medicine/${encodeURIComponent(r.name)}`)}
                      >
                        {t("nav.remind")}
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

      {/* --- TEXT OCR MODE --- */}
      {mode === "text" && !loading && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-primary/30 bg-primary/5">
             <h3 className="font-semibold text-sm mb-2 text-primary">Extracted Text</h3>
             <p className="text-sm leading-relaxed whitespace-pre-wrap font-mono text-muted-foreground bg-background p-3 rounded-lg border">
                {extractedText || "No readable text found."}
             </p>
          </div>
          
          <div className="flex flex-col gap-2">
             <p className="text-xs text-muted-foreground mb-1">
                Found the medication name in the text above? Search for it directly to verify.
             </p>
             <div className="flex gap-2">
               <Button className="w-full" onClick={() => navigate(`/search?q=${encodeURIComponent(extractedText.split(" ")[0] || "")}`)}>
                  Search Primary Word
               </Button>
               <Button variant="outline" className="w-full" onClick={() => navigate('/search')}>
                  Manual Search
               </Button>
             </div>
          </div>
        </div>
      )}

      {/* --- BARCODE MODE --- */}
      {mode === "barcode" && !loading && (
        <div className="space-y-4">
          <div className="p-6 rounded-xl border border-border bg-card text-center flex flex-col items-center">
             <ScanBarcode size={48} className="text-muted-foreground/30 mb-4" />
             <h3 className="font-semibold text-lg">{barcode}</h3>
             <p className="text-xs text-muted-foreground mt-1 tracking-wider uppercase">Scanned Code</p>
          </div>

          {resolvedBarcodeDrug ? (
             <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-xl border border-success/30 bg-success/5 pt-4">
                <span className="text-xs font-bold text-success uppercase tracking-wider block mb-1">Drug Identified</span>
                <h3 className="text-xl font-bold text-foreground mb-4">{resolvedBarcodeDrug}</h3>
                
                <div className="flex gap-3 mt-4">
                   <Button onClick={() => handleConfirm({ name: resolvedBarcodeDrug, genericName: "" })} disabled={!!confirmed}>
                      <Check size={16} className="mr-2" /> Save to Profile
                   </Button>
                   <Button variant="outline" onClick={() => navigate(`/medicine/${encodeURIComponent(resolvedBarcodeDrug)}`)}>
                      View Details
                   </Button>
                </div>
             </motion.div>
          ) : (
             <div className="p-4 rounded-xl border border-warning/30 bg-warning/5">
                <div className="flex items-start gap-2 text-warning">
                   <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                   <div>
                     <p className="font-semibold text-sm">Unknown Barcode</p>
                     <p className="text-xs opacity-90 mt-1">
                       We couldn't immediately resolve this barcode to a registered FDA drug. 
                     </p>
                     <Button className="mt-3" size="sm" variant="outline" onClick={() => navigate('/search')}>
                        Search Manually
                     </Button>
                   </div>
                </div>
             </div>
          )}
        </div>
      )}

      {/* --- VERIFICATION MODE --- */}
      {mode === "verify" && !loading && verificationResult && (
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`p-6 rounded-2xl border-2 flex flex-col items-center text-center ${
              verificationResult.status === "authentic" ? "border-success/40 bg-success/5" :
              verificationResult.status === "fake" ? "border-destructive/40 bg-destructive/5" :
              "border-warning/40 bg-warning/5"
            }`}
          >
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
              verificationResult.status === "authentic" ? "bg-success/20 text-success" :
              verificationResult.status === "fake" ? "bg-destructive/20 text-destructive" :
              "bg-warning/20 text-warning"
            }`}>
              {verificationResult.status === "authentic" && <ShieldCheck size={32} />}
              {verificationResult.status === "fake" && <ShieldAlert size={32} />}
              {verificationResult.status === "expired" && <CalendarClock size={32} />}
              {verificationResult.status === "unknown" && <ShieldQuestion size={32} />}
            </div>

            <h2 className="text-xl font-bold mb-2 uppercase tracking-wide">
              {verificationResult.status === "authentic" ? "Medication Authentic" : 
               verificationResult.status === "fake" ? "Counterfeit Alert!" :
               "Check Failed"}
            </h2>
            
            <p className="text-sm text-foreground/80 leading-relaxed mb-6 px-4">
              {verificationResult.message}
            </p>

            {verificationResult.drugName && (
              <div className="w-full bg-background/50 rounded-xl p-4 border border-border/50 text-left mb-6">
                <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Medicine</p>
                    <p className="text-sm font-semibold">{verificationResult.drugName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Manufacturer</p>
                    <p className="text-sm font-semibold">{verificationResult.manufacturer || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Batch</p>
                    <p className="text-sm font-semibold">{verificationResult.batchNumber || "Unknown"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Expires</p>
                    <p className="text-sm font-semibold">{verificationResult.expiryDate || "Unknown"}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 w-full">
              {verificationResult.status === "authentic" && (
                <Button onClick={() => handleConfirm({ name: verificationResult.drugName })} className="w-full">
                  <Check size={16} className="mr-2" /> {t("common.save")}
                </Button>
              )}
              {verificationResult.status === "fake" && (
                <Button variant="destructive" className="w-full">
                  <Flag size={16} className="mr-2" /> Report to Authorities
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate(-1)} className="w-full">
                Scan Another
              </Button>
            </div>
          </motion.div>

          <div className="p-4 rounded-xl border bg-muted/20">
             <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">How this works</h4>
             <p className="text-[11px] text-muted-foreground leading-relaxed">
               Dawa Lens verifies the unique 10-12 digit scratch code against the National Drug Authority (NDA) and regional anti-counterfeit registries. 
               Always ensure the scratch panel was intact before you revealed the code.
             </p>
          </div>
        </div>
      )}

    </div>
  );
}
