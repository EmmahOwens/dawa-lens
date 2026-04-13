import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/contexts/AppContext";
import { FileText, Printer, Download, TrendingUp, Activity, Calendar, Sparkles, Loader2, Info, CheckCircle2 } from "lucide-react";
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

  const patientName = selectedPatientId 
    ? patients.find(p => p.id === selectedPatientId)?.name 
    : userProfile?.name || "User";

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

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const res = await aiApi.getWellnessInsight({
        doseLogs: doseLogs.slice(0, 50),
        wellnessLogs: wellnessLogs.slice(0, 50),
        medicines
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
    <div className="px-4 pt-12 pb-24 print:p-0 print:bg-white">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-start justify-between print:mb-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-foreground print:text-black">
            Health Dossier
          </h1>
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest opacity-70 print:text-black/60">
            Official health summary for {patientName}
          </p>
        </div>
        <div className="print:hidden">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handlePrint}
            className="rounded-2xl w-12 h-12 border-2"
          >
            <Printer size={20} />
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
        <motion.div variants={item} className="p-8 rounded-[2.5rem] bg-primary text-primary-foreground shadow-2xl shadow-primary/20 relative overflow-hidden print:shadow-none print:border print:text-black print:bg-white">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Activity size={100} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Adherence Rating</p>
          <div className="flex items-end gap-3">
             <h2 className="text-5xl font-black italic">
               {Math.round(chartData.reduce((acc, d) => acc + d.adherence, 0) / 7)}%
             </h2>
             <p className="text-sm font-bold mb-2 opacity-90">Perfect Score</p>
          </div>
          <p className="mt-4 text-xs font-medium opacity-70 leading-relaxed max-w-[240px]">
            Based on the last 7 days of recorded dosages.
          </p>
        </motion.div>

        {/* Charts Section */}
        <motion.div variants={item} className="p-8 rounded-[2.5rem] bg-card border-2 border-border shadow-xl shadow-black/5 print:shadow-none print:border">
          <h3 className="text-sm font-black uppercase tracking-widest text-foreground mb-8 flex items-center gap-2">
            <TrendingUp size={16} className="text-primary" /> Vitality Trends
          </h3>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorAdherence" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: "hsl(var(--muted-foreground))" }} 
                  dy={10}
                />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                  itemStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="adherence" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorAdherence)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="energy" 
                  stroke="#10b981" 
                  strokeWidth={4}
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Adherence</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-success" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Energy</span>
            </div>
          </div>
        </motion.div>

        {/* AI Insight Summary */}
        <motion.div variants={item} className="p-8 rounded-[2.5rem] bg-card border-2 border-border shadow-xl shadow-black/5 print:shadow-none print:border">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
              <Sparkles size={16} className="text-primary" /> AI Health Analysis
            </h3>
            {loading && <Loader2 size={16} className="animate-spin text-primary" />}
          </div>

          {insights ? (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20">
                <p className="text-xs font-bold text-foreground leading-relaxed italic">
                  "{insights.summary}"
                </p>
              </div>
              <div className="space-y-4">
                {insights.insights.map((insight: string, idx: number) => (
                  <div key={idx} className="flex gap-4 items-start">
                    <div className="w-6 h-6 rounded-lg bg-success/10 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 size={14} className="text-success" />
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{insight}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center opacity-40">
              <Info size={32} className="mx-auto mb-4" />
              <p className="text-[10px] font-black uppercase tracking-widest">Generating Insights...</p>
            </div>
          )}
        </motion.div>

        {/* Printing Footer */}
        <div className="hidden print:block mt-12 border-t pt-8">
           <div className="flex justify-between items-end">
             <div>
               <p className="text-lg font-black tracking-tighter">Dawa Lens Health Report</p>
               <p className="text-[10px] font-bold text-black/60 italic uppercase tracking-widest">Confidential Patient Summary</p>
             </div>
             <p className="text-[10px] font-bold">Generated: {format(new Date(), "PPpp")}</p>
           </div>
        </div>
      </motion.div>
    </div>
  );
}

// Add Print styles at the bottom of the file if needed, or rely on tailwind "print:" utilities
