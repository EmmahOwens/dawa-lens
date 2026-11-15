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

  const moodLabel = !hasPRO ? "No Data" : avgMood >= 3.5 ? "Positive" : avgMood >= 2.5 ? "Neutral" : "Low";
  const energyLabel = !hasPRO ? "No Data" : avgEnergy >= 3.5 ? "High" : avgEnergy >= 2.5 ? "Moderate" : "Low";

  // Derive medicines actually logged in the past 7 days
  const doseLogsLast7 = useMemo(() => {
    return doseLogs.filter((l: any) => {
      const d = new Date(l.scheduledTime || l.actionTime);
      return last7.some((day) => isSameDay(d, day));
    });
  }, [doseLogs, last7]);

  const dailyAdherence = useMemo(() => {
    return last7.map((day) => {
      const dayLogs = doseLogsLast7.filter((l: any) => {
        const d = new Date(l.scheduledTime || l.actionTime);
        return isSameDay(d, day);
      });
      const hasTaken = dayLogs.some((l: any) => l.status !== "skipped" && l.status !== "missed");
      const hasMissed = dayLogs.some((l: any) => l.status === "skipped" || l.status === "missed");
      return {
        label: format(day, "EEE"),
        dateLabel: format(day, "d"),
        state: dayLogs.length === 0 ? "empty" : hasTaken ? "taken" : hasMissed ? "missed" : "empty",
      };
    });
  }, [last7, doseLogsLast7]);

  const doseCountByMedicine = useMemo(() => {
    const map: Record<string, number> = {};
    doseLogsLast7.forEach((l: any) => {
      const key = (l.medicineName || "").toLowerCase().trim();
      if (key) {
        map[key] = (map[key] || 0) + 1;
      }
    });
    return map;
  }, [doseLogsLast7]);

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

  // Adherence gauge styling
  const clampedScore = Math.min(100, Math.max(0, adherenceScore));
  const gaugeRadius = 28;
  const gaugeCircumference = 2 * Math.PI * gaugeRadius;
  const gaugeOffset = gaugeCircumference * (1 - clampedScore / 100);
  const adherenceColor = clampedScore >= 80 ? "#059669" : clampedScore >= 50 ? "#0066cc" : "#d97706";
  const adherenceLabel = clampedScore >= 80 ? "Optimal" : clampedScore >= 50 ? "Moderate" : "Needs Focus";
  const periodStart = format(last7[0], "MMM d");
  const periodEnd = format(last7[last7.length - 1], "MMM d, yyyy");

  return (
    <div id="medical-report-content" className="w-[800px] mx-auto text-slate-900 bg-slate-100/60 p-0 font-sans print:bg-white print:p-0">
      {/* =========================================================================
          PAGE 1: Patient Overview, AI Executive Summary & Medication Regimen
          ========================================================================= */}
      <div className="pdf-page bg-white w-[800px] min-h-[1120px] mb-6 flex flex-col justify-between border border-slate-200 box-border overflow-hidden print:border-none print:m-0 print:mb-0">
        <div>
          {/* Top Clinical Accent Bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#0052a3] via-[#0066cc] to-[#38bdf8]" />

          <div className="px-10 pt-8 pb-6 space-y-6">
            {/* Report Header */}
            <div className="pdf-block flex flex-row justify-between items-start border-b border-slate-200 pb-5">
              <div className="flex items-center gap-3.5">
                <div className="bg-[#0066cc] p-2.5 rounded-xl shrink-0">
                  <Stethoscope className="text-white" size={26} />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-[26px] font-extrabold text-slate-900 tracking-tight leading-none">
                      Care Report
                    </h1>
                    <span className="px-2.5 py-0.5 bg-[#eff6ff] text-[#0052a3] text-[10px] font-bold uppercase tracking-wider rounded-md border border-[#bfdbfe] inline-block">
                      Clinical Summary
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-500 mt-1.5">
                    Medication Adherence &amp; Patient-Reported Outcomes • Dawa Lens AI
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1.5 text-right">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">
                  <Calendar size={12} className="text-[#0066cc]" />
                  <span>{format(new Date(), "MMM d, yyyy")}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                  <span>Window: {periodStart} – {periodEnd}</span>
                  <span className="text-slate-300">|</span>
                  <span className="inline-flex items-center gap-1 font-mono text-slate-600 font-semibold">
                    <FileText size={11} className="text-slate-400" />
                    DL-{refCode}
                  </span>
                </div>
              </div>
            </div>

            {/* Patient Overview & Adherence Hero Card */}
            <div className="pdf-block bg-[#f8fafc] rounded-2xl p-5 border border-slate-200 flex flex-row items-stretch justify-between gap-5">
              {/* Left Column: Demographics + 7-Day Adherence Strip */}
              <div className="flex-1 min-w-0 flex flex-col justify-between gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-slate-400 mb-1 flex items-center gap-1.5">
                      <User size={11} className="text-[#0066cc]" /> Patient Profile
                    </p>
                    <h2 className="text-xl font-extrabold text-slate-900 leading-tight">
                      {patientName}
                    </h2>
                    <div className="text-xs text-slate-600 font-medium mt-1 flex items-center gap-2">
                      <span className="capitalize">{patientGender || "N/A"}</span>
                      <span className="text-slate-300">•</span>
                      <span>{patientAge || "N/A"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-700">
                      <ShieldCheck size={12} />
                      Active Care
                    </span>
                  </div>
                </div>

                {/* 7-Day Daily Adherence Strip */}
                <div className="bg-white rounded-xl border border-slate-200/80 px-3.5 py-2.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      7-Day Dose Activity
                    </p>
                    <p className="text-[11px] font-semibold text-slate-600 mt-0.5">
                      {doseLogsLast7.length} {doseLogsLast7.length === 1 ? "log" : "logs"} recorded
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {dailyAdherence.map((day, idx) => {
                      const badgeBg =
                        day.state === "taken"
                          ? "bg-emerald-500 text-white border-emerald-600"
                          : day.state === "missed"
                            ? "bg-amber-400 text-slate-900 border-amber-500"
                            : "bg-slate-100 text-slate-400 border-slate-200";
                      return (
                        <div key={idx} className="flex flex-col items-center gap-1">
                          <span className="text-[9px] font-bold uppercase text-slate-400">
                            {day.label.slice(0, 2)}
                          </span>
                          <span
                            className={`w-6 h-6 rounded-md border text-[10px] font-bold flex items-center justify-center ${badgeBg}`}
                          >
                            {day.dateLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Column: Adherence Gauge Card */}
              <div className="w-[238px] shrink-0 bg-white p-4 rounded-xl border border-slate-200 flex flex-row items-center gap-3.5">
                <div className="shrink-0 w-[72px] h-[72px]">
                  <svg width="72" height="72" viewBox="0 0 72 72">
                    <circle
                      cx="36"
                      cy="36"
                      r={gaugeRadius}
                      stroke="#f1f5f9"
                      strokeWidth="6.5"
                      fill="none"
                    />
                    <circle
                      cx="36"
                      cy="36"
                      r={gaugeRadius}
                      stroke={adherenceColor}
                      strokeWidth="6.5"
                      fill="none"
                      strokeDasharray={gaugeCircumference}
                      strokeDashoffset={gaugeOffset}
                      strokeLinecap="round"
                      transform="rotate(-90 36 36)"
                    />
                    <text
                      x="36"
                      y="41"
                      textAnchor="middle"
                      fontSize="15"
                      fontWeight="800"
                      fill="#0f172a"
                      fontFamily="system-ui, -apple-system, sans-serif"
                    >
                      {adherenceScore}%
                    </text>
                  </svg>
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-extrabold text-slate-900">Adherence</p>
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border"
                    style={{
                      color: adherenceColor,
                      backgroundColor: clampedScore >= 80 ? "#ecfdf5" : clampedScore >= 50 ? "#eff6ff" : "#fffbeb",
                      borderColor: clampedScore >= 80 ? "#a7f3d0" : clampedScore >= 50 ? "#bfdbfe" : "#fde68a",
                    }}
                  >
                    {adherenceLabel}
                  </span>
                  <p className="text-[11px] text-slate-500 font-medium leading-snug pt-0.5">
                    {doseLogs.length} total doses logged
                  </p>
                </div>
              </div>
            </div>

            {/* AI Clinical Assessment: Executive Summary (Print-Friendly Callout) */}
            {insights?.summary && (
              <div className="pdf-block bg-gradient-to-br from-[#eff6ff] to-[#f8fafc] rounded-2xl p-5 border border-[#bfdbfe] border-l-4 border-l-[#0066cc] relative overflow-hidden">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <Brain size={15} className="text-[#0066cc]" />
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#0052a3]">
                      Clinical Executive Summary
                    </p>
                  </div>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold text-[#0052a3] bg-white border border-[#bfdbfe]">
                    AI Clinical Assessment
                  </span>
                </div>
                <div className="text-[13px] font-medium text-slate-800 leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="font-bold text-slate-950">{children}</strong>,
                      b: ({ children }) => <b className="font-bold text-slate-950">{children}</b>,
                    }}
                  >
                    {cleanMarkdown(insights.summary)}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* Section: Medications & Dosage Patterns */}
            <div className="pdf-block space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2.5">
                  <div className="bg-amber-50 p-1.5 rounded-lg border border-amber-200/80 text-amber-700">
                    <Pill size={15} />
                  </div>
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-[0.12em]">
                    Medication Regimen &amp; Dosage Patterns
                  </h3>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">
                  {medicinesForReport.length} Active {medicinesForReport.length === 1 ? "Medication" : "Medications"}
                </span>
              </div>

              {/* Medications List */}
              {medicinesForReport.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {medicinesForReport.slice(0, 6).map((med: any) => {
                    const medKey = (med.name || "").toLowerCase().trim();
                    const medCount = doseCountByMedicine[medKey] || 0;
                    return (
                      <div
                        key={med.id}
                        className="p-3.5 rounded-xl bg-[#f8fafc] border border-slate-200 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{med.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {med.genericName && (
                              <p className="text-[10px] font-semibold text-[#0066cc] truncate">{med.genericName}</p>
                            )}
                            {medCount > 0 && (
                              <span className="text-[10px] font-semibold text-slate-500">
                                {med.genericName ? "• " : ""}
                                {medCount}x logged (7d)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-white rounded-lg border border-slate-200 shrink-0">
                          <Clock size={11} className="text-slate-400" />
                          <span className="text-[11px] font-bold text-slate-700">{med.dosage || "Standard"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-slate-50 rounded-xl p-4 border border-dashed border-slate-200 text-center">
                  <p className="text-slate-500 font-semibold text-xs">
                    No active medication logs recorded in the past 7 days.
                  </p>
                </div>
              )}

              {/* Dosage Patterns Breakdown */}
              {insights?.dosagePatterns && (
                <div className="p-4 rounded-xl bg-white border border-slate-200">
                  <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-[0.14em] mb-1.5 flex items-center gap-1.5">
                    <Activity size={12} className="text-[#0066cc]" /> Adherence &amp; Timing Analysis
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
        </div>

        {/* Page 1 Running Footer */}
        <div className="px-10 py-4 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between text-[10px] text-slate-500 font-medium">
          <span>Dawa Lens • Clinical Care Report • REF: DL-{refCode}</span>
          <span className="font-bold text-slate-700">Page 1 of 2</span>
        </div>
      </div>

      {/* =========================================================================
          PAGE 2: Outcomes, Symptoms, Lifestyle Analysis & Clinical Action Plan
          ========================================================================= */}
      <div className="pdf-page bg-white w-[800px] min-h-[1120px] mb-6 flex flex-col justify-between border border-slate-200 box-border overflow-hidden print:border-none print:m-0 print:mb-0">
        <div>
          {/* Top Clinical Accent Bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#0052a3] via-[#0066cc] to-[#38bdf8]" />

          <div className="px-10 pt-8 pb-6 space-y-6">
            {/* Page 2 Header Banner */}
            <div className="pdf-block flex items-center justify-between border-b border-slate-200 pb-3.5 text-xs">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold">
                <div className="bg-rose-50 p-1.5 rounded-lg border border-rose-200/70 text-rose-600">
                  <Heart size={13} />
                </div>
                <span className="uppercase tracking-[0.1em] text-[11px]">
                  Patient Reported Outcomes &amp; Action Plan
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                <span>
                  Patient: <strong className="text-slate-800 font-bold">{patientName}</strong>
                </span>
                <span className="text-slate-300">•</span>
                <span className="font-mono text-slate-600 font-semibold">DL-{refCode}</span>
              </div>
            </div>

            {/* Section: Patient Reported Outcomes */}
            <div className="pdf-block space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {[
                  {
                    label: "Avg Mood",
                    value: hasPRO ? avgMood.toFixed(1) : "—",
                    max: hasPRO ? "/5" : "",
                    status: moodLabel,
                    icon: Smile,
                    accent: "border-t-rose-500",
                    iconClass: "text-rose-600 bg-rose-50",
                  },
                  {
                    label: "Avg Energy",
                    value: hasPRO ? avgEnergy.toFixed(1) : "—",
                    max: hasPRO ? "/5" : "",
                    status: energyLabel,
                    icon: Zap,
                    accent: "border-t-amber-500",
                    iconClass: "text-amber-600 bg-amber-50",
                  },
                  {
                    label: "Days Tracked",
                    value: daysWithData,
                    max: "/7",
                    status: "Consistency",
                    icon: Calendar,
                    accent: "border-t-[#0066cc]",
                    iconClass: "text-[#0066cc] bg-[#eff6ff]",
                  },
                  {
                    label: "Total Entries",
                    value: logsLast7.length,
                    max: "",
                    status: "Check-ins",
                    icon: Activity,
                    accent: "border-t-emerald-500",
                    iconClass: "text-emerald-600 bg-emerald-50",
                  },
                ].map((stat, i) => {
                  const IconComp = stat.icon;
                  return (
                    <div
                      key={i}
                      className={`bg-[#f8fafc] p-3.5 rounded-xl border border-slate-200 border-t-2 ${stat.accent} flex flex-col justify-between`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          {stat.label}
                        </p>
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center ${stat.iconClass}`}>
                          <IconComp size={13} />
                        </div>
                      </div>
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-2xl font-extrabold text-slate-900 leading-none">{stat.value}</span>
                        {stat.max && <span className="text-[11px] font-bold text-slate-400">{stat.max}</span>}
                      </div>
                      <div className="mt-2.5">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-white border border-slate-200 text-slate-700">
                          {stat.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Primary Symptoms & Lifestyle Correlation */}
              {(topSymptoms.length > 0 || insights?.lifestyleAnalysis) && (
                <div className="flex flex-row gap-3.5">
                  {topSymptoms.length > 0 && (
                    <div className="flex-1 bg-[#f8fafc] rounded-xl p-4 border border-slate-200">
                      <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-[0.14em] mb-2.5 flex items-center gap-1.5">
                        <TrendingUp size={12} className="text-rose-500" /> Primary Symptom Frequency
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {topSymptoms.map(([name, count]) => (
                          <div
                            key={name}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-lg border border-rose-200/80 text-xs"
                          >
                            <span className="font-bold text-slate-800 text-[11px]">{name}</span>
                            <span className="px-1.5 py-0.5 rounded bg-rose-50 text-[10px] font-bold text-rose-700">
                              {count}x
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {insights?.lifestyleAnalysis && (
                    <div className="flex-1 bg-[#f8fafc] rounded-xl p-4 border border-slate-200">
                      <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-[0.14em] mb-2 flex items-center gap-1.5">
                        <Brain size={12} className="text-[#0066cc]" /> Lifestyle &amp; Environment
                      </p>
                      <div className="text-[11.5px] text-slate-700 font-medium leading-relaxed">
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
              )}
            </div>

            {/* Section: Observed Patterns */}
            {insights?.insights && insights.insights.length > 0 && (
              <div className="pdf-block space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <div className="bg-emerald-50 p-1 rounded-md border border-emerald-200/80 text-emerald-600">
                    <ShieldCheck size={14} />
                  </div>
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-[0.12em]">
                    Observed Clinical Patterns
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {insights.insights.slice(0, 4).map((insight: string, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 bg-[#f8fafc] p-3.5 rounded-xl border border-slate-200"
                    >
                      <div className="bg-emerald-100 text-emerald-700 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5">
                        <ShieldCheck size={11} />
                      </div>
                      <div className="text-[11.5px] font-medium text-slate-700 leading-snug">
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
              <div className="pdf-block bg-[#fffbeb] rounded-2xl p-5 border border-[#fde68a] border-l-4 border-l-[#d97706] space-y-3">
                <p className="text-[11px] font-extrabold text-amber-800 uppercase tracking-[0.14em] flex items-center gap-1.5">
                  <AlertCircle size={14} className="text-[#d97706]" /> Priority Clinical Action Items
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
                          fontWeight="800"
                          fill="#ffffff"
                          fontFamily="system-ui, -apple-system, sans-serif"
                        >
                          {idx + 1}
                        </text>
                      </svg>
                      <div className="text-xs font-semibold text-slate-900 leading-snug">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => <span className="m-0">{children}</span>,
                            strong: ({ children }) => <strong className="font-extrabold text-slate-950">{children}</strong>,
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
        </div>

        {/* Report Security & Compliance Footer */}
        <div className="pdf-block px-10 py-5 border-t border-slate-200 bg-slate-50/70 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-full border border-slate-200">
              <ShieldCheck size={12} className="text-[#0066cc]" />
              <span className="text-[9px] font-extrabold text-slate-600 uppercase tracking-wider">
                Confidential Patient Summary
              </span>
            </div>
            <div className="flex items-center gap-2 text-[9px] font-extrabold text-slate-400 tracking-wider">
              <span>DAWA LENS</span>
              <span>•</span>
              <span>CLINICAL INTELLIGENCE</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed font-normal">
            This report was generated by the Dawa Lens AI clinical engine from self-reported dosage logs and symptom trackers.
            <span className="text-slate-700 font-semibold ml-1">
              Always consult a registered healthcare provider before modifying any prescribed regimen.
            </span>
          </p>
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium pt-0.5">
            <span>Dawa Lens Health Summary • REF: DL-{refCode}</span>
            <span className="font-bold text-slate-700">Page 2 of 2</span>
          </div>
        </div>
      </div>
    </div>
  );
};
