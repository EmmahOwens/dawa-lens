import { useMemo } from "react";
import { format, subDays, isSameDay } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { 
  Activity, 
  User, 
  Calendar, 
  ShieldCheck, 
  Pill, 
  Brain, 
  Heart, 
  AlertCircle,
  FileText,
  Clock,
  TrendingUp,
  Stethoscope,
  Smile,
  Zap,
} from "@/lib/icons";

interface MedicalReportContentProps {
  patientName: string;
  patientGender: string;
  patientAge: string;
  adherenceScore: number;
  doseLogs: any[];
  medicines: any[];
  insights: any;
  wellnessLogs?: any[];
}

function cleanMarkdown(text?: string): string {
  if (!text) return "";
  return text
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .trim();
}

export const MedicalReportContent = ({
  patientName,
  patientGender,
  patientAge,
  adherenceScore,
  doseLogs,
  medicines,
  insights,
  wellnessLogs = [],
}: MedicalReportContentProps) => {
  // Stable reference code
  const refCode = useMemo(() => {
    let hash = 0;
    const str = `${patientName}-${adherenceScore}-${doseLogs.length}`;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36).substring(0, 6).toUpperCase().padEnd(6, "X");
  }, [patientName, adherenceScore, doseLogs.length]);

  // Compute PROs from wellnessLogs
  const last7 = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => subDays(new Date(), 6 - i));
  }, []);

  const symptomLogs = useMemo(() => {
    return wellnessLogs.filter((l: any) => l.type === "symptom");
  }, [wellnessLogs]);

  const logsLast7 = useMemo(() => {
    return symptomLogs.filter((l: any) => {
      const d = new Date(l.timestamp);
      return last7.some((day) => isSameDay(d, day));
    });
  }, [symptomLogs, last7]);

  const hasPRO = logsLast7.length > 0;
  const avgMood = hasPRO
    ? logsLast7.reduce((acc: number, l: any) => acc + (Number(l.data?.mood) || 0), 0) / logsLast7.length
    : 0;
  const avgEnergy = hasPRO
    ? logsLast7.reduce((acc: number, l: any) => acc + (Number(l.data?.energy) || 0), 0) / logsLast7.length
    : 0;

  const symptomCount: Record<string, number> = {};
  logsLast7.forEach((l: any) => {
    const syms = l.data?.symptoms as string[] | undefined;
    if (syms) {
      syms.forEach((s: string) => {
        symptomCount[s] = (symptomCount[s] || 0) + 1;
      });
    }
  });

  const topSymptoms = Object.entries(symptomCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const daysWithData = last7.filter((day) =>
    symptomLogs.some((l: any) => isSameDay(new Date(l.timestamp), day))
  ).length;

  const moodLabel = avgMood >= 3.5 ? "Positive" : avgMood >= 2.5 ? "Neutral" : "Low";
  const energyLabel = avgEnergy >= 3.5 ? "High" : avgEnergy >= 2.5 ? "Moderate" : "Low";

  // Derive medicines actually logged in the past 7 days
  const doseLogsLast7 = useMemo(() => {
    return doseLogs.filter((l: any) => {
      const d = new Date(l.scheduledTime || l.actionTime);
      return last7.some((day) => isSameDay(d, day));
    });
  }, [doseLogs, last7]);

  const loggedMedicineNames = useMemo(() => {
    return new Set(doseLogsLast7.map((l: any) => (l.medicineName || "").toLowerCase().trim()));
  }, [doseLogsLast7]);

  const medicinesLogged = useMemo(() => {
    return medicines.filter((m: any) =>
      loggedMedicineNames.has((m.name || "").toLowerCase().trim())
    );
  }, [medicines, loggedMedicineNames]);

  const medicinesForReport: any[] = useMemo(() => {
    if (medicinesLogged.length > 0) return medicinesLogged;
    return doseLogsLast7.reduce((acc: any[], l: any) => {
      const name = (l.medicineName || "").trim();
      if (name && !acc.find((m: any) => m.name === name)) {
        acc.push({ id: l.reminderId || name, name, dosage: l.dose || "" });
      }
      return acc;
    }, []);
  }, [medicinesLogged, doseLogsLast7]);

  // Radius for adherence gauge
  const gaugeRadius = 26;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const gaugeOffset = gaugeCircumference * (1 - Math.min(100, Math.max(0, adherenceScore)) / 100);

  return (
    <div id="medical-report-content" className="w-[800px] mx-auto text-slate-900 bg-slate-100/60 p-0 font-sans print:bg-white print:p-0">
      {/* =========================================================================
          PAGE 1: Patient Overview, AI Executive Summary & Medication Regimen
          ========================================================================= */}
      <div className="pdf-page bg-white w-[800px] min-h-[1120px] p-10 mb-6 shadow-sm flex flex-col justify-between border border-slate-200/80 box-border print:shadow-none print:border-none print:m-0 print:mb-0">
        <div className="space-y-6">
          {/* Report Header */}
          <div className="pdf-block flex flex-row justify-between items-start border-b-2 border-blue-600 pb-5">
            <div className="flex items-center gap-3.5">
              <div className="bg-blue-600 p-2.5 rounded-2xl shadow-md shadow-blue-200 shrink-0 mt-0.5">
                <Stethoscope className="text-white" size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-normal mb-1">
                  Care Report
                </h1>
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider rounded-md border border-blue-100 leading-normal inline-block">
                    Clinical Summary
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    v1.2 • Dawa Lens AI
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end text-xs pt-1">
              <div className="flex items-center gap-1.5 text-slate-600 font-bold mb-1">
                <Calendar size={13} className="text-blue-600" />
                <span>{format(new Date(), "MMMM do, yyyy")}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
                <FileText size={12} />
                <span>REF: DL-{refCode}</span>
              </div>
            </div>
          </div>

          {/* Patient Overview Card */}
          <div className="pdf-block bg-slate-50/90 rounded-2xl p-6 border border-slate-200/80 flex flex-row items-center justify-between gap-6 relative overflow-hidden">
            {/* Left Column: Demographics and Status */}
            <div className="flex-1 min-w-0 space-y-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] font-black text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <User size={12} className="text-blue-500" /> Patient Information
                </p>
                <h2 className="text-2xl font-black text-slate-900 leading-snug py-0.5">
                  {patientName}
                </h2>
                <div className="text-xs text-slate-600 font-semibold mt-1 flex items-center gap-2">
                  <span className="capitalize">{patientGender || "N/A"}</span>
                  <span className="text-slate-300 font-bold">•</span>
                  <span>{patientAge || "N/A"}</span>
                </div>
              </div>

              <div className="flex flex-row gap-3 pt-1">
                <div className="bg-white px-4 py-2.5 rounded-xl border border-slate-100 shadow-2xs flex-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Status</p>
                  <div className="flex items-center gap-1.5 text-emerald-600">
                    <ShieldCheck size={14} />
                    <span className="text-xs font-bold">Active Care</span>
                  </div>
                </div>
                <div className="bg-white px-4 py-2.5 rounded-xl border border-slate-100 shadow-2xs flex-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Provider</p>
                  <div className="flex items-center gap-1.5 text-blue-600">
                    <Activity size={14} />
                    <span className="text-xs font-bold">Dawa Lens</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Adherence Gauge */}
            <div className="w-[260px] shrink-0">
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-row items-center gap-4">
                {/* SVG Gauge with native SVG text to prevent html2canvas alignment offset */}
                <div className="shrink-0 w-[68px] h-[68px]">
                  <svg width="68" height="68" viewBox="0 0 68 68">
                    <circle
                      cx="34"
                      cy="34"
                      r={gaugeRadius}
                      stroke="#f1f5f9"
                      strokeWidth="6"
                      fill="none"
                    />
                    <circle
                      cx="34"
                      cy="34"
                      r={gaugeRadius}
                      stroke="#2563eb"
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray={gaugeCircumference}
                      strokeDashoffset={gaugeOffset}
                      strokeLinecap="round"
                      transform="rotate(-90 34 34)"
                    />
                    <text
                      x="34"
                      y="40"
                      textAnchor="middle"
                      fontSize="15"
                      fontWeight="900"
                      fill="#0f172a"
                      fontFamily="system-ui, -apple-system, sans-serif"
                    >
                      {adherenceScore}%
                    </text>
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-900">Adherence Score</p>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-snug">
                    {doseLogs.length} doses logged in past 7 days.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* AI Clinical Assessment: Executive Summary */}
          {insights?.summary && (
            <div className="pdf-block bg-indigo-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
              <Brain className="absolute -bottom-6 -right-6 opacity-10" size={140} />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200">
                    Clinical Executive Summary
                  </p>
                  <span className="inline-block h-[20px] leading-[20px] px-2.5 rounded-full text-[10px] font-bold text-white bg-white/20 text-center">
                    AI Assessment
                  </span>
                </div>
                <div className="text-[13px] font-medium leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="font-black text-white">{children}</strong>,
                      b: ({ children }) => <b className="font-black text-white">{children}</b>,
                    }}
                  >
                    {cleanMarkdown(insights.summary)}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          )}

          {/* Section: Medications & Dosage Patterns */}
          <div className="pdf-block space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-2">
              <div className="bg-amber-50 p-1.5 rounded-lg border border-amber-100 text-amber-600">
                <Pill size={16} />
              </div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Medication Regimen & Dosage Patterns
              </h3>
            </div>

            {/* Medications List */}
            {medicinesForReport.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {medicinesForReport.slice(0, 4).map((med: any) => (
                  <div key={med.id} className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-900 truncate">{med.name}</p>
                      {med.genericName && (
                        <p className="text-[10px] font-bold text-blue-600/80 italic truncate">{med.genericName}</p>
                      )}
                    </div>
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-white rounded-lg border border-slate-200/60 shrink-0">
                      <Clock size={11} className="text-slate-400" />
                      <span className="text-[11px] font-bold text-slate-700">{med.dosage || "Standard"}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-50 rounded-xl p-4 border border-dashed border-slate-200 text-center">
                <p className="text-slate-400 font-bold text-xs">No active medication logs recorded in the past 7 days.</p>
              </div>
            )}

            {/* Dosage Patterns Breakdown */}
            {insights?.dosagePatterns && (
              <div className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <Activity size={12} className="text-blue-500" /> Adherence & Timing Analysis
                </p>
                <div className="text-xs text-slate-700 font-medium leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="font-bold text-slate-900">{children}</strong>,
                      ul: ({ children }) => <ul className="list-disc ml-4 space-y-1 my-1">{children}</ul>,
                      li: ({ children }) => <li className="text-[11px] leading-relaxed">{children}</li>,
                    }}
                  >
                    {cleanMarkdown(insights.dosagePatterns)}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Page 1 Running Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
          <span>Care Report • Clinical Summary</span>
          <span className="font-bold text-slate-500">Page 1 of 2</span>
        </div>
      </div>

      {/* =========================================================================
          PAGE 2: Outcomes, Symptoms, Lifestyle Analysis & Clinical Action Plan
          ========================================================================= */}
      <div className="pdf-page bg-white w-[800px] min-h-[1120px] p-10 mb-6 shadow-sm flex flex-col justify-between border border-slate-200/80 box-border print:shadow-none print:border-none print:m-0 print:mb-0">
        <div className="space-y-6">
          {/* Page 2 Header Banner */}
          <div className="pdf-block flex items-center justify-between border-b border-slate-100 pb-3 text-xs">
            <div className="flex items-center gap-2 text-slate-700 font-bold">
              <Heart size={14} className="text-rose-500" />
              <span>Patient Reported Outcomes & Clinical Action Plan</span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              Patient: <strong className="text-slate-700 font-bold">{patientName}</strong>
            </span>
          </div>

          {/* Section: Patient Reported Outcomes */}
          <div className="pdf-block space-y-3.5">
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Avg Mood", value: avgMood.toFixed(1), max: "/5", status: moodLabel, icon: Smile, color: "rose" },
                { label: "Avg Energy", value: avgEnergy.toFixed(1), max: "/5", status: energyLabel, icon: Zap, color: "amber" },
                { label: "Days Tracked", value: daysWithData, max: "/7", status: "Consistency", icon: Calendar, color: "blue" },
                { label: "Total Entries", value: logsLast7.length, max: "", status: "Check-ins", icon: Activity, color: "slate" },
              ].map((stat, i) => (
                <div key={i} className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70 text-center">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
                  <div className="flex items-baseline justify-center gap-0.5">
                    <span className="text-xl font-black text-slate-900">{stat.value}</span>
                    <span className="text-[10px] font-bold text-slate-400">{stat.max}</span>
                  </div>
                  <div className="mt-2 inline-block h-[18px] leading-[18px] px-2.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-white border border-slate-200 text-slate-700 text-center">
                    {stat.status}
                  </div>
                </div>
              ))}
            </div>

            {/* Primary Symptoms & Lifestyle Correlation */}
            <div className="flex flex-row gap-3.5">
              {topSymptoms.length > 0 && (
                <div className="flex-1 bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <TrendingUp size={11} className="text-rose-500" /> Primary Symptom Analysis
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {topSymptoms.map(([name, count]) => (
                      <div key={name} className="inline-block h-[24px] leading-[24px] px-3 bg-white rounded-full border border-slate-200 text-xs text-center">
                        <span className="font-bold text-slate-800 text-[11px]">{name}</span>
                        <span className="mx-1.5 text-slate-300 font-normal">|</span>
                        <span className="text-[10px] font-semibold text-slate-500">{count}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {insights?.lifestyleAnalysis && (
                <div className="flex-1 bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/70">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                    <Brain size={11} className="text-indigo-500" /> Lifestyle & Environment
                  </p>
                  <div className="text-[11px] text-slate-700 font-medium leading-relaxed">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                        strong: ({ children }) => <strong className="font-bold text-slate-900">{children}</strong>,
                      }}
                    >
                      {cleanMarkdown(insights.lifestyleAnalysis)}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section: Observed Patterns */}
          {insights?.insights && insights.insights.length > 0 && (
            <div className="pdf-block space-y-2.5">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5">
                <ShieldCheck size={14} className="text-emerald-500" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Observed Clinical Patterns
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {insights.insights.slice(0, 4).map((insight: string, idx: number) => (
                  <div key={idx} className="flex items-start gap-2.5 bg-slate-50/60 p-3 rounded-xl border border-slate-200/60">
                    <div className="bg-emerald-100 text-emerald-700 w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5">
                      <ShieldCheck size={9} />
                    </div>
                    <div className="text-[11px] font-semibold text-slate-700 leading-snug">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <span className="m-0">{children}</span>,
                          strong: ({ children }) => <strong className="font-bold text-slate-900">{children}</strong>,
                        }}
                      >
                        {cleanMarkdown(insight)}
                      </ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Priority Action Items */}
          {insights?.actionItems && insights.actionItems.length > 0 && (
            <div className="pdf-block bg-amber-50/80 rounded-2xl p-5 border border-amber-200/70 space-y-3">
              <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-1.5">
                <AlertCircle size={13} /> Priority Clinical Action Items
              </p>
              <ul className="space-y-2.5">
                {insights.actionItems.slice(0, 3).map((action: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-3">
                    <svg width="22" height="22" viewBox="0 0 22 22" className="shrink-0 mt-0.5">
                      <circle cx="11" cy="11" r="10" fill="#d97706" />
                      <text
                        x="11"
                        y="15"
                        textAnchor="middle"
                        fontSize="11"
                        fontWeight="900"
                        fill="#ffffff"
                        fontFamily="system-ui, -apple-system, sans-serif"
                      >
                        {idx + 1}
                      </text>
                    </svg>
                    <div className="text-xs font-bold text-slate-900 leading-snug">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => <span className="m-0">{children}</span>,
                          strong: ({ children }) => <strong className="font-black text-slate-900">{children}</strong>,
                        }}
                      >
                        {cleanMarkdown(action)}
                      </ReactMarkdown>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Report Security & Compliance Footer */}
        <div className="pdf-block pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-full border border-slate-200/60">
              <ShieldCheck size={12} className="text-blue-600" />
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Encrypted & Confidential</span>
            </div>
            <div className="flex items-center gap-3 text-[9px] font-black text-slate-400 tracking-wider">
              <span>DAWA LENS</span>
              <span>•</span>
              <span>AI CLINICAL INTELLIGENCE</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed font-normal">
            This report was securely generated by the Dawa Lens AI clinical engine. Insights are derived from self-reported dosage logs and symptom trackers. 
            <span className="text-slate-700 font-semibold ml-1">Always consult a registered healthcare provider before modifying any prescribed regimen.</span>
          </p>
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium pt-1">
            <span>Dawa Lens Health Summary</span>
            <span className="font-bold text-slate-500">Page 2 of 2</span>
          </div>
        </div>
      </div>
    </div>
  );
};
