import { format } from "date-fns";

interface MedicalReportContentProps {
  patientName: string;
  patientGender: string;
  patientAge: string;
  adherenceScore: number;
  doseLogs: any[];
  medicines: any[];
  insights: any;
}

export const MedicalReportContent = ({
  patientName,
  patientGender,
  patientAge,
  adherenceScore,
  doseLogs,
  medicines,
  insights
}: MedicalReportContentProps) => {
  return (
    <div className="font-sans text-black bg-white w-full max-w-4xl mx-auto p-1">
      {/* Print Header */}
      <div className="border-b-2 border-black pb-6 mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-black tracking-tight mb-2">Care Report</h1>
          <p className="text-sm font-bold uppercase tracking-widest text-black/50">Dawa Lens Clinical Summary</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold mb-1"><strong>Date:</strong> {format(new Date(), "MMMM do, yyyy")}</p>
          <p className="text-sm font-semibold"><strong>Report ID:</strong> DL-{Math.random().toString(36).substr(2, 6).toUpperCase()}</p>
        </div>
      </div>

      {/* Patient Demographics */}
      <div className="grid grid-cols-2 gap-8 mb-10 p-6 bg-gray-50 rounded-xl border border-gray-200">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">Patient Name</p>
          <p className="text-xl font-bold text-black">{patientName}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">Demographics</p>
          <p className="text-lg font-bold text-black capitalize">{patientGender} • {patientAge}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">Adherence Score</p>
          <p className="text-lg font-bold text-black">{adherenceScore}% (7-Day Average)</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1">Tracking Activity</p>
          <p className="text-lg font-bold text-black">{doseLogs.length} Doses Logged Total</p>
        </div>
      </div>

      {/* Active Medications */}
      <div className="mb-10">
        <h2 className="text-xl font-black border-b border-gray-300 pb-2 mb-4">Active Medications</h2>
        {medicines.length > 0 ? (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-black/80">
                <th className="py-3 px-2 text-sm font-bold uppercase tracking-wider">Medication Name</th>
                <th className="py-3 px-2 text-sm font-bold uppercase tracking-wider">Dosage</th>
                <th className="py-3 px-2 text-sm font-bold uppercase tracking-wider">Instructions</th>
              </tr>
            </thead>
            <tbody>
              {medicines.map((med, idx) => (
                <tr key={med.id} className={`border-b border-gray-200 ${idx % 2 === 0 ? "bg-gray-50/50" : ""}`}>
                  <td className="py-3 px-2 text-base font-bold text-black">{med.name} <span className="font-normal text-xs text-gray-500 block italic">{med.genericName}</span></td>
                  <td className="py-3 px-2 text-sm font-semibold">{med.dosage}</td>
                  <td className="py-3 px-2 text-sm text-gray-700">{med.notes || "As directed"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-black/60 italic">No active medications registered.</p>
        )}
      </div>

      {/* AI Clinical Summary */}
      {insights && (
        <div className="mb-10">
          <h2 className="text-xl font-black border-b border-gray-300 pb-2 mb-6">AI Clinical Assessment</h2>
          
          <div className="mb-6">
            <p className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-2">Overview</p>
            <p className="text-base font-medium leading-relaxed bg-blue-50/50 p-4 rounded-lg border border-blue-100">{insights.summary}</p>
          </div>

          {insights.lifestyleAnalysis && (
             <div className="mb-6">
               <p className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-2">Lifestyle & Symptoms</p>
               <p className="text-base font-medium leading-relaxed italic text-gray-800">{insights.lifestyleAnalysis}</p>
             </div>
          )}

          {insights.actionItems && insights.actionItems.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-2">Suggested Action Items</p>
              <ul className="list-disc pl-5 space-y-2">
                {insights.actionItems.map((item: string, idx: number) => (
                  <li key={idx} className="text-base font-bold text-black">{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-16 pt-6 border-t border-gray-300 text-center">
         <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Strictly Confidential</p>
         <p className="text-xs text-gray-400">Generated securely by Dawa Lens AI engine. Please consult a registered physician before altering any medical dosages based on these automated insights.</p>
      </div>
    </div>
  );
};
