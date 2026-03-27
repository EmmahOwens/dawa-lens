import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, AlertTriangle, ExternalLink, Pill } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type DrugInfo = {
  name: string;
  genericName: string;
  uses: string;
  warnings: string;
  sideEffects: string;
  dosage: string;
  source: string;
};

const demoInfo: DrugInfo = {
  name: "Ibuprofen 200mg",
  genericName: "Ibuprofen",
  uses: "Used to reduce fever and treat pain or inflammation. Common for headaches, toothaches, back pain, arthritis, menstrual cramps, and minor injuries.",
  warnings: "Do not use if you have had an allergic reaction to aspirin or any other NSAID. May increase risk of heart attack or stroke with long-term use.",
  sideEffects: "Stomach pain, nausea, vomiting, headache, dizziness, drowsiness. Serious: stomach bleeding, kidney problems, allergic reactions.",
  dosage: "Adults: 200-400mg every 4-6 hours as needed. Maximum 1200mg per day unless directed by a doctor.",
  source: "FDA / DailyMed",
};

export default function MedicineInfoPage() {
  const { name } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(name || searchParams.get("q") || "");
  const [info, setInfo] = useState<DrugInfo | null>(name ? demoInfo : null);
  const [searching, setSearching] = useState(false);

  const handleSearch = () => {
    if (!query.trim()) return;
    setSearching(true);
    // Simulated lookup
    setTimeout(() => {
      setInfo({ ...demoInfo, name: query, genericName: query.split(" ")[0] });
      setSearching(false);
    }, 800);
  };

  const sections = info
    ? [
        { title: "Uses", content: info.uses },
        { title: "Dosage", content: info.dosage },
        { title: "Warnings", content: info.warnings },
        { title: "Side Effects", content: info.sideEffects },
      ]
    : [];

  return (
    <div className="px-4 pt-6 pb-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <ArrowLeft size={16} /> Back
      </button>

      <h1 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
        <Pill size={20} className="text-primary" />
        Medicine Info
      </h1>

      {/* Search bar */}
      <div className="flex gap-2 mb-6">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search medicine name..."
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={searching}>
          {searching ? "..." : "Search"}
        </Button>
      </div>

      {info && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
            <h2 className="text-lg font-bold text-foreground">{info.name}</h2>
            <p className="text-sm text-muted-foreground">Generic: {info.genericName}</p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <ExternalLink size={12} /> Source: {info.source}
            </p>
          </div>

          {sections.map((s) => (
            <div key={s.title} className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.content}</p>
            </div>
          ))}

          <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-warning mt-0.5 shrink-0" />
              <p className="text-xs text-warning-foreground leading-relaxed">
                This information is for reference only. Always consult a healthcare professional before starting, changing, or stopping any medication.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {!info && !searching && (
        <div className="text-center py-16">
          <Pill size={40} className="text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Enter a medicine name to look up information</p>
        </div>
      )}
    </div>
  );
}
