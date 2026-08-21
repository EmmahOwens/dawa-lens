import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert, ShieldCheck, AlertTriangle, CheckCircle2,
  Sparkles, Loader2, Bot, ArrowRight, Activity, Wine,
  Coffee, GlassWater, Salad, Info, Zap
} from "@/lib/icons";
import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";
import { checkConditionSafety } from "@/services/conditionInteractionService";
import { checkFdaMultiSafety, FdaMultiSafetyResult } from "@/services/openFdaClient";
import { checkInteractions } from "@/services/interactionChecker";
import { ConditionSafetyCheck, ParsedInteraction } from "@/types/interactions";

export function InteractionsWidget() {
  const { t } = useTranslation();
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
      const rxcuis = activeMeds.map(m => m.rxcui).filter((id): id is string => !!id);

      try {
        const [fdaRes, rxNavRes] = await Promise.allSettled([
          checkFdaMultiSafety(activeMeds, patientCtx),
          rxcuis.length >= 2 ? checkInteractions(rxcuis) : Promise.resolve([] as ParsedInteraction[])
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
    const medNames = activeMeds.map(m => m.name).join(", ");
    let query = `I have active safety alerts in my cabinet (${medNames}). `;
    if (duplicateTherapies.length > 0) {
      query += `Specifically, duplicate therapies detected: ${duplicateTherapies.map(d => `${d.drug1} + ${d.drug2} (${d.sharedClass})`).join("; ")}. `;
    }
    if (interactions.length > 0) {
      query += `Also drug interactions: ${interactions.map(i => `${i.drug1} + ${i.drug2}`).join("; ")}. `;
    }
    query += "Please advise on how I should manage this safely and whether I should space them out or talk to a doctor.";
    openDawaGPTWithPrompt(query);
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
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
              Global Watchdog
            </h4>
            {loading && <Loader2 size={11} className="text-primary animate-spin" />}
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${
                loading
                  ? "bg-primary animate-ping"
                  : isCritical
                  ? "bg-destructive animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.7)]"
                  : isWarning
                  ? "bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]"
                  : isSecure
                  ? "bg-success shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                  : "bg-muted-foreground/40"
              }`}
            />
            <span
              className={`text-[9px] font-black uppercase tracking-wider ${
                loading
                  ? "text-primary"
                  : isCritical
                  ? "text-destructive"
                  : isWarning
                  ? "text-amber-500"
                  : isSecure
                  ? "text-success"
                  : "text-muted-foreground"
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
              className="bg-primary/5 backdrop-blur-md border border-primary/20 rounded-[1.75rem] p-5 shadow-sm space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <Activity size={18} className="animate-pulse" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-foreground">
                    Safety Audit in Progress
                  </p>
                  <p className="text-[9px] text-muted-foreground font-semibold">
                    Evaluating FDA classes & RxNav synergies...
                  </p>
                </div>
              </div>
              <div className="w-full bg-primary/10 h-1 rounded-full overflow-hidden">
                <motion.div
                  className="bg-primary h-full w-1/2"
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
              whileHover={{ scale: 1.01 }}
              className="bg-destructive/10 backdrop-blur-md border-2 border-destructive/40 rounded-[1.75rem] p-5 shadow-sm relative overflow-hidden"
            >
              <div className="flex items-start gap-3.5 mb-3.5">
                <div className="w-9 h-9 rounded-2xl bg-destructive/20 border border-destructive/30 flex items-center justify-center text-destructive shrink-0">
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-destructive bg-destructive/20 px-2 py-0.5 rounded-full border border-destructive/30">
                      Critical Risk
                    </span>
                    <span className="text-[10px] font-bold text-destructive/80">
                      {totalAlertsCount} conflict{totalAlertsCount > 1 ? "s" : ""}
                    </span>
                  </div>
                  <h5 className="text-xs font-black text-foreground tracking-tight">
                    Severe Medication Conflict
                  </h5>
                  <p className="text-[11px] text-foreground/90 font-medium leading-snug mt-1">
                    {boxedWarnings.length > 0
                      ? `FDA Boxed Warning identified for ${boxedWarnings[0].drugName}.`
                      : contraindicationAlerts.length > 0
                      ? `Comorbidity contraindication detected with your health profile.`
                      : `High-risk drug interaction detected across active medications.`}
                  </p>
                </div>
              </div>

              <button
                onClick={handleConsultAllAlerts}
                className="w-full py-2 px-3 rounded-xl bg-destructive text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-destructive/90 transition-all active:scale-98 shadow-sm"
              >
                <Bot size={13} />
                Ask DawaGPT to Resolve
              </button>
            </motion.div>
          ) : isWarning ? (
            <motion.div
              key="warning"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.01 }}
              className="bg-amber-500/10 backdrop-blur-md border-2 border-amber-500/30 rounded-[1.75rem] p-5 shadow-sm relative overflow-hidden"
            >
              <div className="flex items-start gap-3.5 mb-3.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                      {duplicateTherapies.length > 0 ? "Duplicate Therapy" : "Safety Caution"}
                    </span>
                    <span className="text-[10px] font-bold text-amber-500/80">
                      {totalAlertsCount} alert{totalAlertsCount > 1 ? "s" : ""}
                    </span>
                  </div>
                  <h5 className="text-xs font-black text-foreground tracking-tight">
                    {duplicateTherapies.length > 0
                      ? `${duplicateTherapies.length} Duplicate Class Alert${duplicateTherapies.length > 1 ? "s" : ""}`
                      : "Interaction Warning"}
                  </h5>
                  <p className="text-[11px] text-foreground/90 font-medium leading-snug mt-1">
                    {duplicateTherapies.length > 0
                      ? `Concurrent use of ${duplicateTherapies[0].drug1} + ${duplicateTherapies[0].drug2} increases pharmacological toxicity risk.`
                      : `Concurrent medications require caution and dosage spacing.`}
                  </p>
                </div>
              </div>

              <button
                onClick={handleConsultAllAlerts}
                className="w-full py-2 px-3 rounded-xl bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-amber-600 transition-all active:scale-98 shadow-sm"
              >
                <Bot size={13} />
                Consult DawaGPT on Safety
              </button>
            </motion.div>
          ) : isSecure ? (
            <motion.div
              key="secure"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.01 }}
              className="bg-success/10 backdrop-blur-md border border-success/30 rounded-[1.75rem] p-5 shadow-sm"
            >
              <div className="flex items-center gap-3.5 mb-2">
                <div className="w-9 h-9 rounded-2xl bg-success/20 border border-success/30 flex items-center justify-center text-success shrink-0">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-success">
                    Cabinet 100% Secure
                  </p>
                  <p className="text-[11px] font-bold text-foreground">
                    Zero Known Interactions
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                All {activeMeds.length} active medications cross-checked with openFDA and RxNav with no duplicate therapies or conflicts.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="single"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.01 }}
              className="bg-background/40 backdrop-blur-md border border-border/60 rounded-[1.75rem] p-5 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-foreground">
                    Single Medication
                  </p>
                  <p className="text-[10px] text-muted-foreground font-semibold">
                    {activeMeds.length === 1 ? activeMeds[0].name : "No active medicines"}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground/80 font-medium leading-relaxed">
                Add 2 or more medicines to activate automated cross-drug synergy and duplicate class analysis.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ─── SECTION 2: DEFENSE MATRIX STATS ─── */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
            Defense Matrix
          </h4>
          <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">
            Live Pulse
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Duplicate Therapies */}
          <div
            className={`p-3.5 rounded-2xl border transition-all ${
              duplicateTherapies.length > 0
                ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                : "bg-background/40 border-border/50 text-muted-foreground"
            }`}
          >
            <p className="text-[9px] font-black uppercase tracking-wider opacity-70">
              Duplicates
            </p>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black tracking-tight text-foreground">
                {duplicateTherapies.length}
              </span>
              <AlertTriangle size={14} className={duplicateTherapies.length > 0 ? "text-amber-500" : "opacity-30"} />
            </div>
          </div>

          {/* Drug Interactions */}
          <div
            className={`p-3.5 rounded-2xl border transition-all ${
              interactions.length > 0
                ? "bg-destructive/10 border-destructive/30 text-destructive"
                : "bg-background/40 border-border/50 text-muted-foreground"
            }`}
          >
            <p className="text-[9px] font-black uppercase tracking-wider opacity-70">
              Drug Conflicts
            </p>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black tracking-tight text-foreground">
                {interactions.length}
              </span>
              <Zap size={14} className={interactions.length > 0 ? "text-destructive" : "opacity-30"} />
            </div>
          </div>

          {/* Boxed & Contraindications */}
          <div
            className={`p-3.5 rounded-2xl border transition-all ${
              boxedWarnings.length > 0 || contraindicationAlerts.length > 0
                ? "bg-destructive/10 border-destructive/30 text-destructive"
                : "bg-background/40 border-border/50 text-muted-foreground"
            }`}
          >
            <p className="text-[9px] font-black uppercase tracking-wider opacity-70">
              Boxed / Contra
            </p>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black tracking-tight text-foreground">
                {boxedWarnings.length + contraindicationAlerts.length}
              </span>
              <ShieldAlert size={14} className={boxedWarnings.length + contraindicationAlerts.length > 0 ? "text-destructive" : "opacity-30"} />
            </div>
          </div>

          {/* Monitored Medicines */}
          <div className="p-3.5 rounded-2xl border bg-background/40 border-border/50 text-muted-foreground">
            <p className="text-[9px] font-black uppercase tracking-wider opacity-70">
              Active Meds
            </p>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black tracking-tight text-foreground">
                {activeMeds.length}
              </span>
              <ShieldCheck size={14} className="text-primary/70" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── SECTION 3: ACTIVE CONFLICT FEED ─── */}
      {totalAlertsCount > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
              Detected Alerts ({totalAlertsCount})
            </h4>
          </div>

          <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1 no-scrollbar">
            {/* Duplicate Therapies List */}
            {duplicateTherapies.map((dup, idx) => (
              <motion.div
                key={`dup-item-${idx}`}
                whileHover={{ scale: 1.01 }}
                className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest text-amber-500">
                    Duplicate Class
                  </span>
                  <button
                    onClick={() =>
                      handleAskDawaGPT(
                        `What should I do about the duplicate therapy between ${dup.drug1} and ${dup.drug2}? Both share the ${dup.sharedClass} class.`
                      )
                    }
                    className="text-[9px] font-bold text-amber-600 hover:text-amber-500 flex items-center gap-1 hover:underline"
                  >
                    <span>Explain</span>
                    <ArrowRight size={10} />
                  </button>
                </div>
                <p className="text-[11px] font-bold text-foreground">
                  {dup.drug1} + {dup.drug2}
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  EPC: {dup.sharedClass}
                </p>
              </motion.div>
            ))}

            {/* Drug Interactions List */}
            {interactions.map((inter, idx) => (
              <motion.div
                key={`inter-item-${idx}`}
                whileHover={{ scale: 1.01 }}
                className={`p-3.5 rounded-2xl border space-y-2 ${
                  inter.severity?.toLowerCase() === "high"
                    ? "bg-destructive/5 border-destructive/20"
                    : "bg-amber-500/5 border-amber-500/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[9px] font-black uppercase tracking-widest ${
                      inter.severity?.toLowerCase() === "high" ? "text-destructive" : "text-amber-500"
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
                    className="text-[9px] font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    <span>Explain</span>
                    <ArrowRight size={10} />
                  </button>
                </div>
                <p className="text-[11px] font-bold text-foreground">
                  {inter.drug1} + {inter.drug2}
                </p>
                <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                  {inter.description}
                </p>
              </motion.div>
            ))}

            {/* Boxed Warnings */}
            {boxedWarnings.map((bw, idx) => (
              <div
                key={`bw-item-${idx}`}
                className="p-3.5 rounded-2xl bg-destructive/5 border border-destructive/20 space-y-1"
              >
                <span className="text-[9px] font-black uppercase tracking-widest text-destructive">
                  FDA Boxed Warning
                </span>
                <p className="text-[11px] font-bold text-foreground">{bw.drugName}</p>
                <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                  {bw.warning}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── SECTION 4: FOOD & LIFESTYLE QUICK RADAR ─── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
            Dietary Radar
          </h4>
          <span className="text-[9px] text-primary/80 font-bold uppercase tracking-wider">
            Quick Cross-Check
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {dietaryItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={idx}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  const names = activeMeds.map(m => m.name).join(", ");
                  handleAskDawaGPT(
                    `Does ${item.name} interact with my medications (${names || "cabinet"})? Are there dietary precautions I should follow?`
                  );
                }}
                className="p-3 rounded-2xl bg-background/40 hover:bg-primary/5 border border-border/50 hover:border-primary/30 flex items-center gap-2.5 transition-all text-left group"
              >
                <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                  <Icon size={14} />
                </div>
                <div className="overflow-hidden">
                  <p className="text-[10px] font-black text-foreground uppercase tracking-tight truncate">
                    {item.name}
                  </p>
                  <p className="text-[8px] text-muted-foreground font-semibold uppercase tracking-wider">
                    Check
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
