import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/contexts/AppContext";
import { FileText, Printer, Download, TrendingUp, Activity, Calendar, Sparkles, Loader2, Info, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { aiApi } from "@/services/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { format, subDays, isSameDay } from "date-fns";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function ReportPage() {
  const { doseLogs, wellnessLogs, medicines, userProfile, patients, selectedPatientId } = useApp();
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<any>(null);

  const patient = selectedPatientId ? patients.find(p => p.id === selectedPatientId) : null;
  const patientName = patient?.name || userProfile?.name || "User";
  const patientAge = patient?.age ? `${patient.age} yrs` : (userProfile?.dateOfBirth ? `${new Date().getFullYear() - new Date(userProfile.dateOfBirth).getFullYear()} yrs` : "N/A");
  const patientGender = patient?.gender || userProfile?.gender || "N/A";

  // Prepare Chart Data (Last 7 Days)
  const chartData = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dayStr = format(date, "MMM dd");
      
      const dayLogs = doseLogs.filter(l => isSameDay(new Date(l.actionTime), date));
      const taken = dayLogs.filter(l => l.action === "taken").length;
      const total = dayLogs.length;
      const adherence = total > 0 ? (taken / total) * 100 : 100;

      const dayWellness = wellnessLogs.find(l => l.type === "symptom" && isSameDay(new Date(l.timestamp), date));
      const energy = dayWellness?.data?.energy || 0;
      const mood = dayWellness?.data?.mood || 0;

      return { name: dayStr, adherence, energy: energy * 20, mood: mood * 20 };
    });
  }, [doseLogs, wellnessLogs]);

  const adherenceScore = Math.round(chartData.reduce((acc, d) => acc + d.adherence, 0) / 7) || 0;

  const fetchInsights = async () => {
    if (doseLogs.length === 0 && medicines.length === 0) return;
    setLoading(true);
    try {
      const res = await aiApi.getWellnessInsight({
        doseLogs: doseLogs.slice(0, 70), // Send more context
        wellnessLogs: wellnessLogs.slice(0, 50),
        medicines: medicines.filter(m => !m.isConflict) // active meds
      });
      setInsights(res);
    } catch (err) {
      console.error("Insight fetch failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [selectedPatientId]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="px-4 pt-12 pb-24 print:p-0 print:m-0 print:bg-white print:text-black">
      {/* -------------------- WEB VIEW -------------------- */}
      <div className="print:hidden">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Care Report
            </h1>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider opacity-80 mt-1">
              Official health summary for {patientName}
            </p>
          </div>
          <div>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handlePrint}
              className="rounded-xl w-11 h-11 border-border/50 shadow-sm"
              title="Print Medical Report"
            >
              <Printer size={18} />
            </Button>
          </div>
        </motion.div>

        <motion.div 
          variants={container} 
          initial="hidden" 
          animate="show" 
          className="space-y-6"
        >
          {/* Adherence Score Card */}
          <motion.div variants={item} className="p-8 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/10 relative overflow-hidden transition-all hover:scale-[1.01]">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Activity size={96} />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-1">7-Day Adherence Rating</p>
            <div className="flex items-end gap-3">
               <h2 className="text-5xl font-bold tracking-tight">
                 {adherenceScore}%
               </h2>
               <p className="text-[10px] font-bold mb-2.5 opacity-90 uppercase tracking-widest text-primary-foreground/70">Overall Score</p>
            </div>
            <p className="mt-5 text-[12px] font-medium opacity-80 leading-relaxed max-w-[260px]">
              {adherenceScore >= 90 ? "Excellent tracking consistency. Keep it up!" : adherenceScore >= 70 ? "Good tracking, but some doses were missed." : "Adherence is below average. Consider setting extra reminders."}
            </p>
          </motion.div>

          {/* Charts Section */}
          <motion.div variants={item} className="premium-card">
            <h3 className="section-title flex items-center gap-2">
              <TrendingUp size={14} className="text-primary" /> Vitality Trends
            </h3>
            <div className="h-[260px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorAdherence" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }} 
                    dy={10}
                  />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '1rem', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 40px rgba(0,0,0,0.08)', background: 'hsl(var(--card))' }}
                    itemStyle={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    labelStyle={{ fontSize: '11px', fontWeight: 800, color: 'hsl(var(--foreground))', marginBottom: '8px' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="adherence" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#colorAdherence)" 
                    name="Adherence %"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="energy" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    fill="transparent"
                    name="Energy Level"
                    strokeDasharray="4 4"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-6">
              <div className="flex items-center gap-2 bg-accent/50 px-3 py-1.5 rounded-full">
                <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground cursor-default">Adherence</span>
              </div>
              <div className="flex items-center gap-2 bg-accent/50 px-3 py-1.5 rounded-full">
                <div className="w-2.5 h-2.5 rounded-full bg-success" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground cursor-default">Energy</span>
              </div>
            </div>
          </motion.div>

          {/* AI Clinical Summary */}
          <motion.div variants={item} className="premium-card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="section-title flex items-center gap-2 mb-0">
                <Sparkles size={14} className="text-primary" /> AI Clinical Assessment
              </h3>
              {loading && <Loader2 size={14} className="animate-spin text-primary opacity-50" />}
            </div>

            {insights ? (
              <div className="space-y-6">
                <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10 relative">
                  <p className="text-sm font-semibold text-foreground leading-relaxed">
                    {insights.summary}
                  </p>
                  {insights.lifestyleAnalysis && (
                    <p className="text-xs font-medium text-muted-foreground mt-3 pt-3 border-t border-primary/10">
                      {insights.lifestyleAnalysis}
                    </p>
                  )}
                </div>
                
                {insights.insights && insights.insights.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2 px-1">Observed Patterns</h4>
                    {insights.insights.map((insight: string, idx: number) => (
                      <div key={idx} className="flex gap-3 items-start p-3.5 rounded-xl bg-accent/30 border border-border/40 hover:bg-accent/50 transition-colors">
                        <div className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0 mt-0.5">
                          <CheckCircle2 size={12} className="text-indigo-500" />
                        </div>
                        <p className="text-xs text-foreground leading-relaxed font-medium">{insight}</p>
                      </div>
                    ))}
                  </div>
                )}

                {insights.actionItems && insights.actionItems.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <h4 className="text-[10px] uppercase tracking-widest font-bold text-warning mb-2 px-1 flex items-center gap-1.5">
                      <Activity size={12} /> Suggested Action Items
                    </h4>
                    {insights.actionItems.map((action: string, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl bg-warning/5 border border-warning/20">
                        <p className="text-xs font-semibold text-warning-foreground leading-snug pr-4">{action}</p>
                        <ArrowRight size={14} className="text-warning shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-14 text-center opacity-40 bg-accent/20 rounded-2xl border border-dashed border-border/50">
                <Info size={32} className="mx-auto mb-4 opacity-50" />
                <p className="text-[10px] font-black uppercase tracking-widest">
                  {doseLogs.length > 0 ? "Generating Clinical Insights..." : "No Data Available Yet"}
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>

      {/* -------------------- HIDDEN PRINT TEMPLATE -------------------- */}
      <div className="hidden print:block font-sans text-black bg-white w-full max-w-4xl mx-auto">
        
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
        <div className="grid grid-cols-2 gap-8 mb-10 p-6 bg-gray-50 rounded-xl border border-gray-200 print:break-inside-avoid">
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
        <div className="mb-10 print:break-inside-avoid">
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

        {/* AI Clinical Summary (Print) */}
        {insights && (
          <div className="mb-10 print:break-inside-avoid">
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
        <div className="mt-16 pt-6 border-t border-gray-300 text-center print:break-inside-avoid">
           <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Strictly Confidential</p>
           <p className="text-xs text-gray-400">Generated securely by Dawa Lens AI engine. Please consult a registered physician before altering any medical dosages based on these automated insights.</p>
        </div>

      </div>
    </div>
  );
}
