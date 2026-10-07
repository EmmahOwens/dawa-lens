import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle2,
  Loader2, ArrowRight, Activity, Wine,
  Coffee, GlassWater, Salad, Zap
} from "@/lib/icons";
import { useApp } from "@/contexts/AppContext";
import { checkConditionSafety } from "@/services/conditionInteractionService";
import { checkFdaMultiSafety, FdaMultiSafetyResult } from "@/services/openFdaClient";
import { checkInteractions } from "@/services/interactionChecker";
import { deduplicateMedicationList } from "@/services/clinicalInteractionsData";
import { ConditionSafetyCheck, ParsedInteraction } from "@/types/interactions";
import { MobileWatchdogResolveButton } from "./MobileWatchdogResolveButton";
import { buildSafetyConsultPrompt } from "@/lib/safetyPromptBuilder";
import MessageRenderer from "@/components/MessageRenderer";

export function InteractionsWidget() {
  const {
    medicines,
    userProfile,
    patients,
    selectedPatientId,
    openDawaGPTWithPrompt
  } = useApp();

  const [fdaSafety, setFdaSafety] = useState<FdaMultiSafetyResult | null>(null);
  const [interactions, setInteractions] = useState<ParsedInteraction[]>([]);
  const [conditionWarnings, setConditionWarnings] = useState<ConditionSafetyCheck[]>([]);
  const [loading, setLoading] = useState(false);

  // Determine active medication set based on selected patient context
  const activeMeds = selectedPatientId
    ? medicines.filter(m => m.patientId === selectedPatientId)
    : medicines;

  const currentPatient = selectedPatientId
    ? patients.find(p => p.id === selectedPatientId)
    : null;

  const medicinesKey = activeMeds.map(m => `${m.id || m.name}:${m.rxcui || ""}`).join("|");
  const conditionsKey = (currentPatient?.conditions || []).join("|");
  const allergiesKey = (currentPatient?.allergies || []).join("|");

  const patientCtx = React.useMemo(() => ({
    age: currentPatient?.age || undefined,
    gender: currentPatient?.gender || userProfile?.gender || undefined,
    conditions: currentPatient?.conditions || [],
    allergies: currentPatient?.allergies || [],
  }), [currentPatient?.age, currentPatient?.gender, userProfile?.gender, conditionsKey, allergiesKey]);

  useEffect(() => {
    let isMounted = true;

    async function evaluateSafety() {
      if (activeMeds.length === 0) {
        if (isMounted) {
          setFdaSafety(null);
          setInteractions([]);
          setConditionWarnings([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      const { distinctMedications } = deduplicateMedicationList(activeMeds);

      try {
        const [fdaRes, rxNavRes] = await Promise.allSettled([
          checkFdaMultiSafety(distinctMedications, patientCtx),
          distinctMedications.length >= 2 ? checkInteractions(distinctMedications) : Promise.resolve([] as ParsedInteraction[])
        ]);

        // Regional comorbidity & condition checks
        const localConditionAlerts = activeMeds.flatMap(med =>
          checkConditionSafety(med.name, med.genericName, patientCtx.conditions)
        );

        if (isMounted) {
          if (fdaRes.status === "fulfilled") {
            setFdaSafety(fdaRes.value);
          } else {
            console.warn("[InteractionsWidget] FDA safety check failed:", fdaRes.reason);
            setFdaSafety(null);
          }

          if (rxNavRes.status === "fulfilled") {
            setInteractions(rxNavRes.value);
          } else {
            setInteractions([]);
          }

          setConditionWarnings(localConditionAlerts);
        }
      } catch (err) {
        console.error("[InteractionsWidget] Failed to evaluate safety:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    evaluateSafety();

    return () => {
      isMounted = false;
    };
  }, [medicinesKey, selectedPatientId, conditionsKey, allergiesKey]);

  // Aggregate safety insights
  const duplicateTherapies = fdaSafety?.duplicateTherapies || [];
  const boxedWarnings = fdaSafety?.boxedWarnings || [];
  const contraindicationAlerts = fdaSafety?.contraindicationAlerts || [];
  const allergenAlerts = fdaSafety?.allergenAlerts || [];
  const highSeverityInteractions = interactions.filter(i => i.severity?.toLowerCase() === "high");

  const totalAlertsCount =
    duplicateTherapies.length +
    boxedWarnings.length +
    contraindicationAlerts.length +
    allergenAlerts.length +
    interactions.length +
    conditionWarnings.length;

  const isCritical =
    Boolean(fdaSafety?.hasCriticalAlert) ||
    boxedWarnings.length > 0 ||
    contraindicationAlerts.length > 0 ||
    highSeverityInteractions.length > 0;

  const isWarning = !isCritical && totalAlertsCount > 0;
  const isSecure = !isCritical && !isWarning && activeMeds.length >= 2;

  const handleAskDawaGPT = (query: string) => {
    openDawaGPTWithPrompt(query);
  };

  const handleConsultAllAlerts = () => {
    const prompt = buildSafetyConsultPrompt({
      medNames: activeMeds.map(m => m.name),
      fdaSafety,
      interactions,
    });
    openDawaGPTWithPrompt(prompt);
  };

  const dietaryItems = [
    { name: "Grapefruit", icon: Salad },
    { name: "Alcohol", icon: Wine },
    { name: "Dairy", icon: GlassWater },
    { name: "Caffeine", icon: Coffee },
  ];

  return (
    <div className="space-y-6">
      {/* ─── SECTION 1: GLOBAL WATCHDOG HERO ─── */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Global Watchdog
            </h4>
            {loading && <Loader2 size={12} className="text-primary animate-spin" />}
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                loading
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : isCritical
                  ? "bg-destructive/10 text-destructive border border-destructive/20"
                  : isWarning
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                  : isSecure
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-secondary text-muted-foreground border border-border"
              }`}
            >
              {loading
                ? "Analyzing"
                : isCritical
                ? "Critical"
                : isWarning
                ? "Alert Active"
                : isSecure
                ? "Secure"
                : "Standby"}
            </span>
          </div>
        </div>

        {/* Dynamic Watchdog Card */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="bg-card border border-border rounded-[18px] p-5 shadow-xs space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Activity size={18} className="animate-pulse" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Safety Audit in Progress
                  </p>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    Evaluating FDA classes & RxNav synergies...
                  </p>
                </div>
              </div>
              <div className="w-full bg-muted h-1 rounded-full overflow-hidden">
                <motion.div
                  className="bg-primary h-full w-1/2 rounded-full"
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            </motion.div>
          ) : isCritical ? (
            <motion.div
              key="critical"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-destructive/30 rounded-[18px] p-5 shadow-xs relative space-y-3.5"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive shrink-0">
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/20">
                      Critical Risk
                    </span>
                    <span className="text-[11px] font-medium text-destructive">
                      {totalAlertsCount} conflict{totalAlertsCount > 1 ? "s" : ""}
                    </span>
                  </div>
                  <h5 className="text-xs font-semibold text-foreground tracking-tight">
                    Severe Medication Conflict
                  </h5>
                  <p className="text-xs text-muted-foreground font-medium leading-relaxed mt-1">
                    {boxedWarnings.length > 0
                      ? `FDA Boxed Warning identified for ${boxedWarnings[0].drugName}.`
                      : contraindicationAlerts.length > 0
                      ? `Comorbidity contraindication detected with your health profile.`
                      : `High-risk drug interaction detected across active medications.`}
                  </p>
                </div>
              </div>

              <MobileWatchdogResolveButton
                onClick={handleConsultAllAlerts}
                conflictCount={totalAlertsCount}
                isCritical={true}
                label="Ask DawaGPT to Resolve"
              />
            </motion.div>
          ) : isWarning ? (
            <motion.div
              key="warning"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-amber-500/30 rounded-[18px] p-5 shadow-xs relative space-y-3.5"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      {duplicateTherapies.length > 0 ? "Duplicate Therapy" : "Safety Caution"}
                    </span>
                    <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      {totalAlertsCount} alert{totalAlertsCount > 1 ? "s" : ""}
                    </span>
                  </div>
                  <h5 className="text-xs font-semibold text-foreground tracking-tight">
                    {duplicateTherapies.length > 0
                      ? `${duplicateTherapies.length} Duplicate Class Alert${duplicateTherapies.length > 1 ? "s" : ""}`
                      : "Interaction Warning"}
                  </h5>
                  <p className="text-xs text-muted-foreground font-medium leading-relaxed mt-1">
                    {duplicateTherapies.length > 0
                      ? `Concurrent use of ${duplicateTherapies[0].drug1} + ${duplicateTherapies[0].drug2} increases pharmacological toxicity risk.`
                      : `Concurrent medications require caution and dosage spacing.`}
                  </p>
                </div>
              </div>

              <MobileWatchdogResolveButton
                onClick={handleConsultAllAlerts}
                conflictCount={totalAlertsCount}
                isCritical={false}
                label="Consult DawaGPT on Safety"
              />
            </motion.div>
          ) : isSecure ? (
            <motion.div
              key="secure"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-emerald-500/30 rounded-[18px] p-5 shadow-xs space-y-2"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Cabinet Secure
                  </p>
                  <p className="text-xs font-semibold text-foreground">
                    Zero Known Interactions
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                All {activeMeds.length} active medications cross-checked with openFDA and RxNav with no duplicate therapies or conflicts.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="single"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-[18px] p-5 shadow-xs space-y-2"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Single Medication
                  </p>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    {activeMeds.length === 1 ? activeMeds[0].name : "No active medicines"}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                Add 2 or more medicines to activate automated cross-drug synergy and duplicate class analysis.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ─── SECTION 2: DEFENSE MATRIX STATS ─── */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Defense Matrix
          </h4>
          <span className="text-[10px] font-medium text-muted-foreground">
            Live Pulse
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Duplicate Therapies */}
          <div
            className={`p-3.5 rounded-[16px] border bg-card transition-all ${
              duplicateTherapies.length > 0
                ? "border-amber-500/30 text-amber-600 dark:text-amber-400"
                : "border-border text-muted-foreground"
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Duplicates
            </p>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-semibold tracking-tight text-foreground">
                {duplicateTherapies.length}
              </span>
              <AlertTriangle size={14} className={duplicateTherapies.length > 0 ? "text-amber-500" : "opacity-30"} />
            </div>
          </div>

          {/* Drug Interactions */}
          <div
            className={`p-3.5 rounded-[16px] border bg-card transition-all ${
              interactions.length > 0
                ? "border-destructive/30 text-destructive"
                : "border-border text-muted-foreground"
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Conflicts
            </p>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-semibold tracking-tight text-foreground">
                {interactions.length}
              </span>
              <Zap size={14} className={interactions.length > 0 ? "text-destructive" : "opacity-30"} />
            </div>
          </div>

          {/* Boxed & Contraindications */}
          <div
            className={`p-3.5 rounded-[16px] border bg-card transition-all ${
              boxedWarnings.length > 0 || contraindicationAlerts.length > 0
                ? "border-destructive/30 text-destructive"
                : "border-border text-muted-foreground"
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Boxed / Contra
            </p>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-semibold tracking-tight text-foreground">
                {boxedWarnings.length + contraindicationAlerts.length}
              </span>
              <ShieldAlert size={14} className={boxedWarnings.length + contraindicationAlerts.length > 0 ? "text-destructive" : "opacity-30"} />
            </div>
          </div>

          {/* Monitored Medicines */}
          <div className="p-3.5 rounded-[16px] border bg-card border-border text-muted-foreground">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Active Meds
            </p>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-semibold tracking-tight text-foreground">
                {activeMeds.length}
              </span>
              <ShieldCheck size={14} className="text-primary" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 3: ACTIVE CONFLICT FEED ─── */}
      {totalAlertsCount > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Detected Alerts ({totalAlertsCount})
            </h4>
          </div>

          <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
            {/* Duplicate Therapies List */}
            {duplicateTherapies.map((dup, idx) => (
              <div
                key={`dup-item-${idx}`}
                className="p-3.5 rounded-[16px] bg-card border border-amber-500/20 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                    Duplicate Class
                  </span>
                  <button
                    onClick={() =>
                      handleAskDawaGPT(
                        `What should I do about the duplicate therapy between ${dup.drug1} and ${dup.drug2}? Both share the ${dup.sharedClass} class.`
                      )
                    }
                    className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 active:scale-95"
                  >
                    <span>Explain</span>
                    <ArrowRight size={11} />
                  </button>
                </div>
                <p className="text-xs font-semibold text-foreground">
                  {dup.drug1} + {dup.drug2}
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  EPC: {dup.sharedClass}
                </p>
              </div>
            ))}

            {/* Drug Interactions List */}
            {interactions.map((inter, idx) => (
              <div
                key={`inter-item-${idx}`}
                className={`p-3.5 rounded-[16px] bg-card border space-y-2 ${
                  inter.severity?.toLowerCase() === "high"
                    ? "border-destructive/30"
                    : "border-amber-500/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      inter.severity?.toLowerCase() === "high" 
                        ? "text-destructive bg-destructive/10 border border-destructive/20" 
                        : "text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20"
                    }`}
                  >
                    {inter.severity?.toLowerCase() === "high" ? "High Severity" : "Interaction"}
                  </span>
                  <button
                    onClick={() =>
                      handleAskDawaGPT(
                        `How does ${inter.drug1} interact with ${inter.drug2}, and how can I space or adjust them safely? Description: ${inter.description}`
                      )
                    }
                    className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 active:scale-95"
                  >
                    <span>Explain</span>
                    <ArrowRight size={11} />
                  </button>
                </div>
                <p className="text-xs font-semibold text-foreground">
                  {inter.drug1} + {inter.drug2}
                </p>
                <div className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed">
                  <MessageRenderer text={inter.description} className="text-[11px] text-muted-foreground" />
                </div>
              </div>
            ))}

            {/* Boxed Warnings */}
            {boxedWarnings.map((bw, idx) => (
              <div
                key={`bw-item-${idx}`}
                className="p-3.5 rounded-[16px] bg-card border border-destructive/30 space-y-1.5"
              >
                <span className="text-[10px] font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/20">
                  FDA Boxed Warning
                </span>
                <p className="text-xs font-semibold text-foreground">{bw.drugName}</p>
                <div className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed">
                  <MessageRenderer text={bw.warning} className="text-[11px] text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── SECTION 4: FOOD & LIFESTYLE QUICK RADAR ─── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Dietary Radar
          </h4>
          <span className="text-[10px] text-primary font-medium">
            Quick Cross-Check
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {dietaryItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                onClick={() => {
                  const names = activeMeds.map(m => m.name).join(", ");
                  handleAskDawaGPT(
                    `Does ${item.name} interact with my medications (${names || "cabinet"})? Are there dietary precautions I should follow?`
                  );
                }}
                className="p-3 rounded-[14px] bg-card hover:bg-secondary/60 border border-border flex items-center gap-2.5 transition-colors text-left active:scale-95"
              >
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Icon size={14} />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {item.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-medium">
                    Check
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
