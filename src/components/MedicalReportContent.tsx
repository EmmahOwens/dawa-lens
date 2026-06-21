import { format, subDays, isSameDay } from "date-fns";
import ReactMarkdown from "react-markdown";
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
  Stethoscope
} from "lucide-react";

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
  // Compute PROs from wellnessLogs
  const last7 = Array.from({ length: 7 }).map((_, i) => subDays(new Date(), 6 - i));
  const symptomLogs = wellnessLogs.filter((l: any) => l.type === "symptom");
  const logsLast7 = symptomLogs.filter((l: any) => {
    const d = new Date(l.timestamp);
    return last7.some(day => isSameDay(d, day));
  });

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
    if (syms) syms.forEach((s: string) => { symptomCount[s] = (symptomCount[s] || 0) + 1; });
  });
  const topSymptoms = Object.entries(symptomCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const daysWithData = last7.filter(day =>
    symptomLogs.some((l: any) => isSameDay(new Date(l.timestamp), day))
  ).length;

  const moodLabel = avgMood >= 3.5 ? "Positive" : avgMood >= 2.5 ? "Neutral" : "Low";
  const energyLabel = avgEnergy >= 3.5 ? "High" : avgEnergy >= 2.5 ? "Moderate" : "Low";

  return (
    <div id="medical-report-content" className="font-sans text-slate-900 bg-white w-full max-w-4xl mx-auto px-6 sm:px-12 py-10 sm:py-16">
      {/* Report Header */}
      <div className="pdf-block flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-4 border-blue-600 pb-8 mb-10 gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-200">
            <Stethoscope className="text-white" size={32} />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-none mb-2">
              Care Report
            </h1>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider rounded-md border border-blue-100">
                Clinical Summary
              </span>
              <span className="text-xs font-bold text-slate-400">
                v1.2 • Dawa Lens AI
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-start sm:items-end text-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <Calendar size={14} />
            <span className="font-bold">{format(new Date(), "MMMM do, yyyy")}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <FileText size={14} />
            <span className="font-medium">REF: DL-{Math.random().toString(36).substr(2, 6).toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Patient Overview Card */}
      <div className="pdf-block bg-slate-50 rounded-3xl p-8 mb-10 border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <User size={120} />
        </div>
        
        <div className="space-y-6">
          <section>
            <p className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400 mb-2 flex items-center gap-2">
              <User size={12} className="text-blue-500" /> Patient Information
            </p>
            <h2 className="text-2xl font-black text-slate-900 leading-tight">{patientName}</h2>
            <p className="text-slate-600 font-semibold mt-1 flex items-center gap-2">
              <span className="capitalize">{patientGender}</span>
              <span className="w-1.5 h-1.5 bg-slate-300 rounded-full"></span>
              <span>{patientAge}</span>
            </p>
          </section>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
              <div className="flex items-center gap-2 text-emerald-600">
                <ShieldCheck size={16} />
                <span className="text-sm font-bold">Active Care</span>
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Provider</p>
              <div className="flex items-center gap-2 text-blue-600">
                <Activity size={16} />
                <span className="text-sm font-bold">Dawa Lens</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-md flex items-center gap-6">
            <div className="relative flex-shrink-0">
              <svg className="w-20 h-20 transform -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-slate-100"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 34}
                  strokeDashoffset={2 * Math.PI * 34 * (1 - adherenceScore / 100)}
                  strokeLinecap="round"
                  className="text-blue-600 transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-black text-slate-900">{adherenceScore}%</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">Adherence Score</p>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                {doseLogs.length} total doses logged in the last 7 days.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Medications Section */}
      <section className="pdf-block mb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-amber-50 p-2 rounded-xl border border-amber-100">
            <Pill className="text-amber-600" size={20} />
          </div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Active Medications</h3>
          <div className="h-[2px] flex-1 bg-slate-100 ml-2"></div>
        </div>

        {medicines.length > 0 ? (
          <div className="space-y-4">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-hidden rounded-3xl border border-slate-200 shadow-sm">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Medication Details</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Schedule</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Clinical Notes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {medicines.map((med) => (
                    <tr key={med.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-5">
                        <p className="text-sm font-black text-slate-900">{med.name}</p>
                        {med.genericName && (
                          <p className="text-[10px] font-bold text-blue-600/70 italic mt-0.5">{med.genericName}</p>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-slate-700">
                          <Clock size={12} className="text-slate-400" />
                          <span className="text-xs font-bold">{med.dosage}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-xs text-slate-500 font-medium leading-relaxed italic">
                          {med.notes || "As directed by physician"}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {medicines.map((med) => (
                <div key={med.id} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-base font-black text-slate-900">{med.name}</p>
                      {med.genericName && (
                        <p className="text-[10px] font-bold text-blue-600/70 italic">{med.genericName}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-100">
                      <Clock size={10} className="text-slate-400" />
                      <span className="text-[10px] font-black text-slate-700">{med.dosage}</span>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-500 font-medium leading-relaxed italic">
                      {med.notes || "As directed by physician"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-2xl p-6 border-2 border-dashed border-slate-200 text-center">
            <p className="text-slate-400 font-bold text-sm">No active medications recorded in this period.</p>
          </div>
        )}
      </section>

      {/* Wellness Metrics Section */}
      {hasPRO && (
        <section className="pdf-block mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-rose-50 p-2 rounded-xl border border-rose-100">
              <Heart className="text-rose-600" size={20} />
            </div>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Patient Reported Outcomes</h3>
            <div className="h-[2px] flex-1 bg-slate-100 ml-2"></div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
            {[
              { label: "Avg Mood", value: avgMood.toFixed(1), max: "/5", status: moodLabel, color: "rose" },
              { label: "Avg Energy", value: avgEnergy.toFixed(1), max: "/5", status: energyLabel, color: "amber" },
              { label: "Days Tracked", value: daysWithData, max: "/7", status: "Consistency", color: "blue" },
              { label: "Total Entries", value: logsLast7.length, max: "", status: "Check-ins", color: "slate" },
            ].map((stat, i) => (
              <div key={i} className="bg-white p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm text-center">
                <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 sm:mb-2">{stat.label}</p>
                <div className="flex items-baseline justify-center gap-0.5">
                  <span className="text-xl sm:text-2xl font-black text-slate-900">{stat.value}</span>
                  <span className="text-[10px] sm:text-xs font-bold text-slate-300">{stat.max}</span>
                </div>
                <div className={`mt-2 inline-block px-2 py-0.5 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-wider bg-${stat.color}-50 text-${stat.color}-600 border border-${stat.color}-100`}>
                  {stat.status}
                </div>
              </div>
            ))}
          </div>

          {topSymptoms.length > 0 && (
            <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <TrendingUp size={12} className="text-rose-500" /> Primary Symptom Analysis
              </p>
              <div className="flex flex-wrap gap-2">
                {topSymptoms.map(([name, count]) => (
                  <div key={name} className="flex items-center gap-2 px-4 py-2 bg-white rounded-2xl border border-slate-200 shadow-sm">
                    <span className="text-xs font-black text-slate-900">{name}</span>
                    <span className="h-4 w-[1px] bg-slate-100"></span>
                    <span className="text-[10px] font-bold text-slate-400">{count} occurrences</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* AI Clinical Summary Section */}
      {insights && (
        <section className="mb-12">
          <div className="pdf-block space-y-6 mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-50 p-2 rounded-xl border border-indigo-100">
                <Brain className="text-indigo-600" size={20} />
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">AI Clinical Assessment</h3>
              <div className="h-[2px] flex-1 bg-slate-100 ml-2"></div>
            </div>

            <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
              <Brain className="absolute -bottom-10 -right-10 opacity-10" size={200} />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 opacity-70">Executive Summary</p>
              <div className="text-lg font-bold leading-relaxed relative z-10">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  }}
                >
                  {insights.summary}
                </ReactMarkdown>
              </div>
            </div>

            <div className="pdf-block grid grid-cols-1 md:grid-cols-2 gap-6">
              {insights.dosagePatterns && (
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Dosage Patterns</p>
                  <div className="text-sm text-slate-700 font-semibold leading-relaxed">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc ml-4 mb-2 space-y-1">{children}</ul>,
                        li: ({ children }) => <li className="text-[12px]">{children}</li>,
                      }}
                    >
                      {insights.dosagePatterns}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
              {insights.lifestyleAnalysis && (
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Lifestyle & Environment</p>
                  <div className="text-sm text-slate-700 font-semibold leading-relaxed italic">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      }}
                    >
                      {insights.lifestyleAnalysis}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>

            {insights.insights && insights.insights.length > 0 && (
              <div className="pdf-block bg-slate-50 rounded-3xl p-8 border border-slate-200">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <ShieldCheck size={14} className="text-emerald-500" /> Observed Patterns
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {insights.insights.map((insight: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                      <div className="bg-emerald-50 text-emerald-600 w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5">
                        <ShieldCheck size={10} />
                      </div>
                      <div className="text-xs font-bold text-slate-700 leading-relaxed">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <span className="m-0">{children}</span>,
                          }}
                        >
                          {insight}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {insights.actionItems && insights.actionItems.length > 0 && (
              <div className="pdf-block bg-amber-50 rounded-3xl p-8 border border-amber-100">
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <AlertCircle size={14} /> Priority Action Items
                </p>
                <ul className="space-y-4">
                  {insights.actionItems.map((action: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-4">
                      <div className="bg-amber-600 text-white w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center text-[10px] font-black mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="text-sm font-black text-slate-900 leading-tight">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <span className="m-0">{children}</span>,
                          }}
                        >
                          {action}
                        </ReactMarkdown>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Report Footer */}
      <div className="pdf-block mt-20 pt-10 border-t-2 border-slate-100 text-center">
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-full border border-slate-100">
            <ShieldCheck size={14} className="text-blue-600" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Encrypted & Confidential</span>
          </div>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed max-w-2xl mx-auto font-medium">
          This report was generated securely by the Dawa Lens AI engine. The insights provided are based on self-reported data and automated analysis. 
          <span className="text-slate-900 font-bold ml-1">Please consult a registered healthcare professional before making any changes to your prescribed medical regimen.</span>
        </p>
        <div className="mt-8 flex items-center justify-center gap-8 opacity-30 grayscale">
          {/* Mock Logos for Professional Look */}
          <div className="text-[10px] font-black tracking-tighter">DAWA LENS</div>
          <div className="text-[10px] font-black tracking-tighter">AI DIAGNOSTICS</div>
          <div className="text-[10px] font-black tracking-tighter">SECURE HEALTH</div>
        </div>
      </div>
    </div>
  );
};

