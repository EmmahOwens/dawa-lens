import { format, subDays, isSameDay } from "date-fns";

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
    <div className="font-sans text-black bg-white w-full max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
      {/* Report Header */}
      <div className="border-b-2 border-black pb-6 mb-8 flex flex-wrap gap-4 items-end justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl sm:text-4xl font-black text-black tracking-tight mb-1 break-words">
            Care Report
          </h1>
          <p className="text-xs sm:text-sm font-bold uppercase tracking-widest text-black/50">
            Dawa Lens Clinical Summary
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs sm:text-sm font-semibold mb-1">
            <strong>Date:</strong> {format(new Date(), "MMMM do, yyyy")}
          </p>
          <p className="text-xs sm:text-sm font-semibold">
            <strong>Report ID:</strong>{" "}
            DL-{Math.random().toString(36).substr(2, 6).toUpperCase()}
          </p>
        </div>
      </div>

      {/* Patient Demographics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-10 p-4 sm:p-6 bg-gray-50 rounded-xl border border-gray-200">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">
            Patient Name
          </p>
          <p className="text-lg sm:text-xl font-bold text-black break-words">{patientName}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">
            Demographics
          </p>
          <p className="text-base sm:text-lg font-bold text-black capitalize">
            {patientGender} • {patientAge}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">
            Adherence Score
          </p>
          <p className="text-base sm:text-lg font-bold text-black">
            {adherenceScore}% (7-Day Average)
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">
            Tracking Activity
          </p>
          <p className="text-base sm:text-lg font-bold text-black">
            {doseLogs.length} Doses Logged Total
          </p>
        </div>
      </div>

      {/* Active Medications */}
      <div className="mb-10">
        <h2 className="text-lg sm:text-xl font-black border-b border-gray-300 pb-2 mb-4">
          Active Medications
        </h2>
        {medicines.length > 0 ? (
          /* Wrap in a horizontally-scrollable div so the table never clips on narrow screens */
          <div className="w-full overflow-x-auto -mx-0">
            <table className="min-w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-black/80">
                  <th className="py-3 pr-4 text-xs sm:text-sm font-bold uppercase tracking-wider whitespace-nowrap">
                    Medication Name
                  </th>
                  <th className="py-3 pr-4 text-xs sm:text-sm font-bold uppercase tracking-wider whitespace-nowrap">
                    Dosage
                  </th>
                  <th className="py-3 text-xs sm:text-sm font-bold uppercase tracking-wider whitespace-nowrap">
                    Instructions
                  </th>
                </tr>
              </thead>
              <tbody>
                {medicines.map((med, idx) => (
                  <tr
                    key={med.id}
                    className={`border-b border-gray-200 ${idx % 2 === 0 ? "bg-gray-50/50" : ""}`}
                  >
                    <td className="py-3 pr-4 text-sm sm:text-base font-bold text-black align-top">
                      {med.name}
                      {med.genericName && (
                        <span className="font-normal text-xs text-gray-500 block italic">
                          {med.genericName}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-xs sm:text-sm font-semibold align-top whitespace-nowrap">
                      {med.dosage}
                    </td>
                    <td className="py-3 text-xs sm:text-sm text-gray-700 align-top">
                      {med.notes || "As directed"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-black/60 italic text-sm">No active medications registered.</p>
        )}
      </div>

      {/* Patient Reported Outcomes (PROs) */}
      {hasPRO && (
        <div className="mb-10">
          <h2 className="text-lg sm:text-xl font-black border-b border-gray-300 pb-2 mb-6">
            Patient Reported Outcomes (PROs)
          </h2>
          <p className="text-xs text-gray-500 italic mb-4">
            Self-reported emotional and physical data captured via the Wellness Hub over the last 7 days.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-center">
              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">Avg Mood</p>
              <p className="text-2xl font-black text-black">{avgMood.toFixed(1)}<span className="text-xs text-gray-400">/5</span></p>
              <p className="text-[10px] font-semibold text-gray-500 mt-0.5">{moodLabel}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-center">
              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">Avg Energy</p>
              <p className="text-2xl font-black text-black">{avgEnergy.toFixed(1)}<span className="text-xs text-gray-400">/5</span></p>
              <p className="text-[10px] font-semibold text-gray-500 mt-0.5">{energyLabel}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-center">
              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">Days Tracked</p>
              <p className="text-2xl font-black text-black">{daysWithData}<span className="text-xs text-gray-400">/7</span></p>
              <p className="text-[10px] font-semibold text-gray-500 mt-0.5">Consistency</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-center">
              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">Total Entries</p>
              <p className="text-2xl font-black text-black">{logsLast7.length}</p>
              <p className="text-[10px] font-semibold text-gray-500 mt-0.5">Check-ins</p>
            </div>
          </div>

          {topSymptoms.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-3">Most Reported Symptoms</p>
              <div className="flex flex-wrap gap-2">
                {topSymptoms.map(([name, count]) => (
                  <span
                    key={name}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200 text-xs font-bold text-black"
                  >
                    {name} <span className="text-gray-400 font-normal">({count}×)</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* AI Clinical Summary */}
      {insights && (
        <div className="mb-10">
          <h2 className="text-lg sm:text-xl font-black border-b border-gray-300 pb-2 mb-6">
            AI Clinical Assessment
          </h2>

          <div className="mb-6">
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
              Overview
            </p>
            <p className="text-sm sm:text-base font-medium leading-relaxed bg-blue-50/50 p-4 rounded-lg border border-blue-100 break-words">
              {insights.summary}
            </p>
          </div>

          {insights.lifestyleAnalysis && (
            <div className="mb-6">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                Lifestyle &amp; Symptoms
              </p>
              <p className="text-sm sm:text-base font-medium leading-relaxed italic text-gray-800 break-words">
                {insights.lifestyleAnalysis}
              </p>
            </div>
          )}

          {insights.actionItems && insights.actionItems.length > 0 && (
            <div className="mb-6">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                Suggested Action Items
              </p>
              <ul className="list-disc pl-5 space-y-2">
                {insights.actionItems.map((action: string, idx: number) => (
                  <li key={idx} className="text-sm sm:text-base font-bold text-black break-words">
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insights.insights && insights.insights.length > 0 && (
            <div className="mb-6">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                Observed Patterns
              </p>
              <ul className="list-disc pl-5 space-y-2">
                {insights.insights.map((insight: string, idx: number) => (
                  <li key={idx} className="text-sm sm:text-base font-medium text-gray-800 break-words">
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 sm:mt-16 pt-6 border-t border-gray-300 text-center">
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
          Strictly Confidential
        </p>
        <p className="text-xs text-gray-400 leading-relaxed break-words max-w-prose mx-auto">
          Generated securely by Dawa Lens AI engine. Please consult a registered physician
          before altering any medical dosages based on these automated insights.
        </p>
      </div>
    </div>
  );
};
