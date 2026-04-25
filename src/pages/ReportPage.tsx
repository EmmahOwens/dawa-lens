import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/contexts/AppContext";
import { FileText, Printer, Download, TrendingUp, Activity, Calendar, Sparkles, Loader2, Info, CheckCircle2, ArrowRight, Share2, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { aiApi } from "@/services/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { format, subDays, isSameDay } from "date-fns";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MedicalReportContent } from "@/components/MedicalReportContent";

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

      // Average wellness logs if multiple exist for the day
      const dayWellnessLogs = wellnessLogs.filter(l => l.type === "symptom" && isSameDay(new Date(l.timestamp), date));
      
      let energy: number | null = null;
      let mood: number | null = null;

      if (dayWellnessLogs.length > 0) {
        const sumEnergy = dayWellnessLogs.reduce((acc, l) => acc + (l.data?.energy || 0), 0);
        const sumMood = dayWellnessLogs.reduce((acc, l) => acc + (l.data?.mood || 0), 0);
        energy = (sumEnergy / dayWellnessLogs.length) * 20;
        mood = (sumMood / dayWellnessLogs.length) * 20;
      }

      return { name: dayStr, adherence, energy, mood };
    });
  }, [doseLogs, wellnessLogs]);

  const adherenceScore = Math.round(chartData.reduce((acc, d) => acc + d.adherence, 0) / 7) || 0;

  const [showPreview, setShowPreview] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  const fetchInsights = async () => {
    if (doseLogs.length === 0 && medicines.length === 0) return;
    setLoading(true);
    try {
      const res = await aiApi.getWellnessInsight({
        doseLogs: doseLogs.slice(0, 70), 
        wellnessLogs: wellnessLogs.slice(0, 50),
        medicines: medicines.filter(m => !m.isConflict)
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

  const handleShare = async () => {
    if (!insights) return;
    
    const shareText = `Medical Report Summary for ${patientName}\n` +
      `Date: ${format(new Date(), "MMMM do, yyyy")}\n` +
      `Adherence Score: ${adherenceScore}%\n\n` +
      `Summary: ${insights.summary}\n\n` +
      `Action Items:\n${insights.actionItems?.map((item: string) => `- ${item}`).join('\n') || 'None'}`;

    try {
      if (isNative) {
        await Share.share({
          title: `Care Report - ${patientName}`,
          text: shareText,
          dialogTitle: 'Share Care Report',
        });
      } else {
        if (navigator.share) {
          await navigator.share({
            title: `Care Report - ${patientName}`,
            text: shareText,
          });
        } else {
          await navigator.clipboard.writeText(shareText);
          alert("Report summary copied to clipboard!");
        }
      }
    } catch (err) {
      console.error("Share failed", err);
    }
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
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowPreview(true)}
              className="rounded-xl h-11 border-border/50 shadow-sm gap-2"
            >
              <Eye size={16} />
              Preview
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handleShare}
              className="rounded-xl w-11 h-11 border-border/50 shadow-sm"
              title="Share Report"
            >
              <Share2 size={18} />
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handlePrint}
              className="rounded-xl w-11 h-11 border-border/50 shadow-sm hidden sm:flex"
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
            <div className="h-[260px] w-full mt-4 relative">
              {chartData.every(d => d.energy === null && d.adherence === 100) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-accent/5 z-10 rounded-2xl border border-dashed border-border/50">
                  <Activity size={32} className="text-muted-foreground/30 mb-3" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">No activity data yet</p>
                  <p className="text-[8px] font-bold text-muted-foreground/40 mt-1 uppercase tracking-tighter">Log your wellness in the Wellness Hub</p>
                </div>
              )}
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
                  <YAxis hide domain={[0, 100]} />
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
                    connectNulls
                  />
                  <Area 
                    type="monotone" 
                    dataKey="mood" 
                    stroke="#6366f1" 
                    strokeWidth={3}
                    fill="transparent"
                    name="Mood Level"
                    strokeDasharray="2 2"
                    connectNulls
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
              <div className="flex items-center gap-2 bg-accent/50 px-3 py-1.5 rounded-full">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground cursor-default">Mood</span>
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

      {/* -------------------- PREVIEW DIALOG -------------------- */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 overflow-hidden flex flex-col gap-0 rounded-2xl border-none shadow-2xl">
          <DialogHeader className="p-4 border-b bg-background flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-sm font-bold uppercase tracking-widest opacity-70">
              Formal Care Report Preview
            </DialogTitle>
            <div className="flex gap-2 pr-8">
               <Button variant="outline" size="sm" onClick={handleShare} className="h-9 gap-2 rounded-xl">
                 <Share2 size={14} /> Share
               </Button>
               <Button variant="outline" size="sm" onClick={handlePrint} className="h-9 gap-2 rounded-xl hidden sm:flex">
                 <Printer size={14} /> Print
               </Button>
               <Button variant="ghost" size="icon" onClick={() => setShowPreview(false)} className="rounded-full w-9 h-9">
                 <X size={18} />
               </Button>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 bg-white p-6 sm:p-12">
            <MedicalReportContent 
              patientName={patientName}
              patientGender={patientGender}
              patientAge={patientAge}
              adherenceScore={adherenceScore}
              doseLogs={doseLogs}
              medicines={medicines}
              insights={insights}
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* -------------------- HIDDEN PRINT TEMPLATE -------------------- */}
      <div className="hidden print:block">
        <MedicalReportContent 
          patientName={patientName}
          patientGender={patientGender}
          patientAge={patientAge}
          adherenceScore={adherenceScore}
          doseLogs={doseLogs}
          medicines={medicines}
          insights={insights}
        />
      </div>
    </div>
  );
}
