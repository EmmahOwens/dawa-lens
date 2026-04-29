import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, AlertTriangle, ExternalLink, Pill, ShieldAlert, Bell } from "lucide-react";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useApp } from "@/contexts/AppContext";
import { getRxCUI, checkInteractions } from "@/services/interactionChecker";
import { ParsedInteraction } from "@/types/interactions";
import { useDrugData } from "@/hooks/useDrugData";
import { useTranslation } from "react-i18next";

export default function MedicineInfoPage() {
  const { name } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = name || searchParams.get("q") || "";
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery);
  const { t } = useTranslation();
  
  const { data: info, isLoading: searching, isError, error } = useDrugData(activeQuery);
  const { medicines, reminders } = useApp();
  const [interactions, setInteractions] = useState<ParsedInteraction[]>([]);

  useEffect(() => {
    async function checkCurrentDrug() {
      if (!info?.name) {
        setInteractions([]);
        return;
      }
      
      const targetRxcui = await getRxCUI(info.name);
      if (!targetRxcui) return;

      const savedRxcuis = medicines.map(m => m.rxcui).filter((id): id is string => !!id);
      if (savedRxcuis.length === 0) return;

      const allRxcuis = [...savedRxcuis, targetRxcui];
      const results = await checkInteractions(allRxcuis);
      const preExisting = await checkInteractions(savedRxcuis);
      
      const newInteractions = results.filter(r => 
        !preExisting.some(pre => (pre.drug1 === r.drug1 && pre.drug2 === r.drug2) || (pre.drug1 === r.drug2 && pre.drug2 === r.drug1))
      );
      
      setInteractions(newInteractions);
    }
    checkCurrentDrug();
  }, [info?.name, medicines]);

  const handleSearch = () => {
    if (!searchInput.trim()) return;
    setActiveQuery(searchInput);
  };

  const sections = info
    ? [
        { title: t("medicine_info.uses"), content: info.indications || t("medicine_info.not_available") },
        { title: t("medicine_info.dosage"), content: info.instructions || info.dosageForm || t("medicine_info.not_available") },
        { title: t("medicine_info.warnings"), content: info.warnings || t("medicine_info.not_available") },
        { title: t("medicine_info.side_effects"), content: info.sideEffects || t("medicine_info.not_available") },
      ].filter(s => s.content && s.content !== t("medicine_info.not_available"))
    : [];

  return (
    <div className="px-4 pt-4 pb-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <ArrowLeft size={16} /> {t("common.back")}
      </button>

      <h1 className="text-xl font-bold text-foreground mb-3 flex items-center gap-2">
        <Pill size={20} className="text-primary" />
        {t("medicine_info.title")}
      </h1>

      {/* Search bar */}
      <div className="flex gap-2 mb-4">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t("medicine_info.search_placeholder")}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={searching}>
          {searching ? "..." : t("common.search")}
        </Button>
      </div>

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-destructive mt-0.5 shrink-0" />
            <p className="text-xs text-destructive leading-relaxed">
              {error instanceof Error ? error.message : t("medicine_info.failed_load")}
            </p>
          </div>
        </div>
      )}

      {info && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          
          {interactions.length > 0 && (
            <div className="space-y-2 mb-2">
              {interactions.map((interaction, i) => (
                <Alert key={i} variant="destructive" className="bg-destructive/10 border-destructive">
                  <ShieldAlert className="h-5 w-5" />
                  <AlertTitle>{t("medicine_info.severe_warning")}</AlertTitle>
                  <AlertDescription className="text-sm mt-1 leading-relaxed">
                    <strong>{interaction.drug1}</strong> and <strong>{interaction.drug2}</strong>: {interaction.description}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          <div className="rounded-xl bg-primary/10 border border-primary/20 p-3">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">{info.name}</h2>
                {info.genericName && <p className="text-sm text-muted-foreground">{t("medicine_info.generic")}: {info.genericName}</p>}
              </div>
              <Button 
                size="sm" 
                variant="secondary"
                onClick={() => {
                  const existing = reminders.find(rem => rem.medicineName.toLowerCase() === info.name.toLowerCase());
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
                    navigate("/reminders/new", { state: { medicineName: info.name } });
                  }
                }}
                className="rounded-xl shadow-sm border border-primary/20"
              >
                <Bell size={14} className="mr-1.5" /> 
                {reminders.some(rem => rem.medicineName.toLowerCase() === info.name.toLowerCase()) ? "Edit Reminder" : "Reminder"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <ExternalLink size={12} /> {t("medicine_info.source")}: {info.source}
            </p>
          </div>

          {sections.map((s) => (
            <div key={s.title} className="rounded-xl border border-border bg-card p-3">
              <h3 className="text-sm font-semibold text-foreground mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.content}</p>
            </div>
          ))}

          <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 font-medium">
            <div className="flex items-start gap-2 text-warning">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <p className="text-xs leading-relaxed">
                {t("dashboard.disclaimer")}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {!info && !searching && !isError && (
        <div className="text-center py-16">
          <Pill size={40} className="text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{t("medicine_info.enter_name")}</p>
        </div>
      )}
    </div>
  );
}
