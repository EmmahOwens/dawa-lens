import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Search, AlertTriangle, ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";
import { useState } from "react";

type MatchResult = {
  name: string;
  genericName: string;
  confidence: number;
};

// Simulated results for demo
const demoResults: MatchResult[] = [
  { name: "Ibuprofen 200mg", genericName: "Ibuprofen", confidence: 0.92 },
  { name: "Acetaminophen 500mg", genericName: "Paracetamol", confidence: 0.74 },
  { name: "Aspirin 325mg", genericName: "Acetylsalicylic acid", confidence: 0.45 },
];

export default function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { addMedicine } = useApp();
  const imageUrl = (location.state as any)?.imageUrl;
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const highConfidence = demoResults.filter((r) => r.confidence >= 0.7);
  const lowConfidence = demoResults.filter((r) => r.confidence < 0.7);

  const handleConfirm = (result: MatchResult) => {
    setConfirmed(result.name);
    addMedicine({
      name: result.name,
      genericName: result.genericName,
      dosage: result.name.split(" ").pop() || "",
      imageUrl,
    });
    setSaved(true);
  };

  return (
    <div className="px-4 pt-6 pb-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <ArrowLeft size={16} /> Back
      </button>

      <h1 className="text-xl font-bold text-foreground mb-4">Recognition Results</h1>

      {imageUrl && (
        <div className="mb-6 rounded-xl overflow-hidden border border-border">
          <img src={imageUrl} alt="Captured pill" className="w-full h-48 object-cover" />
        </div>
      )}

      {saved && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-xl bg-success/10 border border-success/30 p-4 flex items-center gap-3"
        >
          <Check size={18} className="text-success" />
          <p className="text-sm text-success font-medium">Medicine saved successfully!</p>
        </motion.div>
      )}

      {/* High confidence matches */}
      {highConfidence.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <ThumbsUp size={14} className="text-success" /> High Confidence Matches
          </h2>
          <div className="space-y-3">
            {highConfidence.map((r) => (
              <motion.div
                key={r.name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className={`rounded-xl border p-4 ${confirmed === r.name ? "border-success bg-success/5" : "border-border bg-card"}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-card-foreground">{r.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{r.genericName}</p>
                  </div>
                  <span className="rounded-lg bg-success/15 px-2 py-1 text-xs font-bold text-success">
                    {Math.round(r.confidence * 100)}%
                  </span>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" onClick={() => handleConfirm(r)} disabled={!!confirmed}>
                    <Check size={14} className="mr-1" /> Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/medicine/${encodeURIComponent(r.name)}`)}
                  >
                    View Details
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Low confidence - triggers online search */}
      {lowConfidence.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <ThumbsDown size={14} className="text-warning" /> Low Confidence – Needs Verification
          </h2>
          <div className="space-y-3">
            {lowConfidence.map((r) => (
              <div key={r.name} className="rounded-xl border border-warning/30 bg-warning/5 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-card-foreground">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.genericName}</p>
                  </div>
                  <span className="rounded-lg bg-warning/15 px-2 py-1 text-xs font-bold text-warning">
                    {Math.round(r.confidence * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/search?q=${encodeURIComponent(r.name)}`)}
                  >
                    <Search size={14} className="mr-1" /> Online Lookup
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleConfirm(r)} disabled={!!confirmed}>
                    Still Confirm
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} className="text-warning mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Recognition accuracy improves with user corrections. If none of these results match, use the online search to find the correct medicine.
          </p>
        </div>
      </div>
    </div>
  );
}
