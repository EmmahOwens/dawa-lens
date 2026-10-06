import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, AlertTriangle, ExternalLink, Pill, ShieldAlert, Bell } from "@/lib/icons";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useApp } from "@/contexts/AppContext";
import { getRxCUI, checkInteractions } from "@/services/interactionChecker";
import { ParsedInteraction } from "@/types/interactions";
import { useDrugData } from "@/hooks/useDrugData";
import { useTranslation } from "react-i18next";
import { getFdaDrugProfile, FdaDrugProfile } from "@/services/openFdaClient";
import FdaSafetyOverviewCard from "@/components/fda/FdaSafetyOverviewCard";

export default function MedicineInfoPage() {
  const { name } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQuery = name || searchParams.get("q") || "";
  const [searchInput, setSearchInput] = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery);
  const { t } = useTranslation();
  
  const { data: info, isLoading: searching, isError, error } = useDrugData(activeQuery);
  const { medicines, reminders, userProfile, patients, selectedPatientId } = useApp();
  const [interactions, setInteractions] = useState<ParsedInteraction[]>([]);
  const [fdaProfile, setFdaProfile] = useState<FdaDrugProfile | null>(null);
  const [fdaLoading, setFdaLoading] = useState(false);

  useEffect(() => {
    async function loadFda() {
      if (!activeQuery || !activeQuery.trim()) {
        setFdaProfile(null);
        return;
      }
      setFdaLoading(true);
      try {
        const currentPatient = selectedPatientId ? patients.find(p => p.id === selectedPatientId) : null;
        const profile = await getFdaDrugProfile(activeQuery, {
          age: currentPatient?.age || undefined,
          gender: currentPatient?.gender || userProfile?.gender || undefined,
          conditions: currentPatient?.conditions || [],
          allergies: currentPatient?.allergies || [],
        });
        setFdaProfile(profile);
      } catch (err) {
        console.warn('Failed to load FDA profile:', err);
      } finally {
        setFdaLoading(false);
      }
    }
    loadFda();
  }, [activeQuery, selectedPatientId, patients, userProfile]);

  useEffect(() => {
    async function checkCurrentDrug() {
      if (!info?.name && !fdaProfile?.resolvedName) {
        setInteractions([]);
        return;
      }
      const targetDrug =
        fdaProfile?.resolvedName ||
        fdaProfile?.label?.brandName ||
        fdaProfile?.brandSynonyms?.[0] ||
        fdaProfile?.brandName ||
        info?.name ||
        fdaProfile?.rxcui;
      if (!targetDrug) return;

      const savedMeds = medicines.map(m => m.name || m.genericName || m.rxcui).filter((id): id is string => !!id);
      if (savedMeds.length === 0) return;

      const allMeds = [...savedMeds, targetDrug];
      const results = await checkInteractions(allMeds);
      const preExisting = await checkInteractions(savedMeds);
      
      const newInteractions = results.filter(r => 
        !preExisting.some(pre => (pre.drug1 === r.drug1 && pre.drug2 === r.drug2) || (pre.drug1 === r.drug2 && pre.drug2 === r.drug1))
      );
      
      setInteractions(newInteractions);
    }
    checkCurrentDrug();
  }, [info?.name, fdaProfile, medicines]);

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
    <div className="w-full pt-2">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <ArrowLeft size={16} /> {t("common.back")}
      </button>

      <h1 className="text-2xl font-bold tracking-[-0.022em] text-foreground mb-4 flex items-center gap-2">
        <Pill size={22} className="text-[#0066cc] dark:text-[#2997ff]" />
        {t("medicine_info.title")}
      </h1>

      {/* Apple Search pill */}
      <div className="flex gap-2 mb-6">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t("medicine_info.search_placeholder")}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="rounded-full h-11 px-4 bg-card border-border text-sm"
        />
        <button 
          onClick={handleSearch} 
          disabled={searching}
          className="rounded-full h-11 px-5 text-sm font-semibold bg-[#0066cc] dark:bg-[#0071e3] text-white hover:opacity-95 transition-transform active:scale-95 shrink-0"
        >
          {searching ? "..." : t("common.search")}
        </button>
      </div>

      {isError && (
        <div className="rounded-[18px] border border-destructive/30 bg-destructive/10 p-4 mb-4">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-destructive mt-0.5 shrink-0" />
            <p className="text-xs text-destructive leading-relaxed">
              {error instanceof Error ? error.message : t("medicine_info.failed_load")}
            </p>
          </div>
        </div>
      )}

      {info && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          
          {interactions.length > 0 && (
            <div className="space-y-2 mb-2">
              {interactions.map((interaction, i) => (
                <Alert key={i} variant="destructive" className="rounded-[18px] bg-destructive/10 border-destructive">
                  <ShieldAlert className="h-5 w-5" />
                  <AlertTitle>{t("medicine_info.severe_warning")}</AlertTitle>
                  <AlertDescription className="text-sm mt-1 leading-relaxed">
                    <strong>{interaction.drug1}</strong> and <strong>{interaction.drug2}</strong>: {interaction.description}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {/* Hero Drug Card - Near-Black Tile 1 / Parchment */}
          <div className="rounded-[18px] bg-[#f5f5f7] dark:bg-[#272729] border border-border p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-[-0.015em] text-foreground">{info.name}</h2>
                {info.genericName && <p className="text-sm text-muted-foreground mt-0.5">{t("medicine_info.generic")}: {info.genericName}</p>}
              </div>
              <button 
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
                className="rounded-full h-9 px-4 text-xs font-semibold bg-card border border-border hover:bg-secondary text-foreground transition-transform active:scale-95 flex items-center gap-1.5 shrink-0"
              >
                <Bell size={13} /> 
                {reminders.some(rem => rem.medicineName.toLowerCase() === info.name.toLowerCase()) ? "Edit Reminder" : "Reminder"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <ExternalLink size={12} /> {t("medicine_info.source")}: {info.source}
            </p>
          </div>

          {/* openFDA Clinical Safety Overview Card */}
          <FdaSafetyOverviewCard profile={fdaProfile} isLoading={fdaLoading} />

          {sections.map((s) => (
            <div key={s.title} className="rounded-[18px] border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-1.5">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.content}</p>
            </div>
          ))}

          <div className="rounded-[18px] border border-warning/30 bg-warning/10 p-4 font-medium">
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
