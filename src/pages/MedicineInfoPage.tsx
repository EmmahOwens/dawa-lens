import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, AlertTriangle, ExternalLink, Pill } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { useDrugData } from "@/hooks/useDrugData";

export default function MedicineInfoPage() {
  const { name } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = name || searchParams.get("q") || "";
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery);
  
  const { data: info, isLoading: searching, isError, error } = useDrugData(activeQuery);

  const handleSearch = () => {
    if (!searchInput.trim()) return;
    setActiveQuery(searchInput);
  };

  const sections = info
    ? [
        { title: "Uses", content: info.indications || "Not available" },
        { title: "Dosage", content: info.instructions || info.dosageForm || "Not available" },
        { title: "Warnings", content: info.warnings || "Not available" },
        { title: "Side Effects", content: info.sideEffects || "Not available" },
      ].filter(s => s.content && s.content !== "Not available")
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
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search medicine name..."
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={searching}>
          {searching ? "..." : "Search"}
        </Button>
      </div>

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-destructive mt-0.5 shrink-0" />
            <p className="text-xs text-destructive leading-relaxed">
              {error instanceof Error ? error.message : "Failed to load information."}
            </p>
          </div>
        </div>
      )}

      {info && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
            <h2 className="text-lg font-bold text-foreground">{info.name}</h2>
            {info.genericName && <p className="text-sm text-muted-foreground">Generic: {info.genericName}</p>}
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

      {!info && !searching && !isError && (
        <div className="text-center py-16">
          <Pill size={40} className="text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Enter a medicine name to look up information</p>
        </div>
      )}
    </div>
  );
}
