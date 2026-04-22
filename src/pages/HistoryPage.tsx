import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, X, Clock, Download, Upload, Trash2, Search, TrendingUp, Calendar } from "lucide-react";
import { useApp, DoseLog } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useState, useMemo } from "react";

// Helper for relative date
function getRelativeDate(dateString: string) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const { doseLogs, logDose, deleteDoseLog } = useApp();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [statusFilter, setStatusFilter] = useState<"All" | "taken" | "skipped" | "snoozed">("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleCount, setVisibleCount] = useState(30);

  // Adherence Stats
  const stats = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    // Set to start of day for accurate comparison
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const last7Days = doseLogs.filter(l => {
      const logDate = new Date(l.actionTime);
      return logDate >= sevenDaysAgo;
    });

    const taken = last7Days.filter(l => l.action === "taken").length;
    const total = last7Days.length;
    const rate = total > 0 ? Math.round((taken / total) * 100) : 0;

    return { taken, total, rate };
  }, [doseLogs]);

  // Group and sort
  const filteredLogs = useMemo(() => {
    let filtered = doseLogs;
    if (statusFilter !== "All") {
      filtered = filtered.filter(l => l.action === statusFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(l => l.medicineName.toLowerCase().includes(q));
    }
    // Sort descending by actionTime
    return filtered.sort((a, b) => new Date(b.actionTime).getTime() - new Date(a.actionTime).getTime());
  }, [doseLogs, statusFilter, searchTerm]);

  const visibleLogs = filteredLogs.slice(0, visibleCount);

  // Group by relative date
  const grouped = useMemo(() => {
    return visibleLogs.reduce<Record<string, DoseLog[]>>((acc, log) => {
      const day = getRelativeDate(log.actionTime);
      (acc[day] = acc[day] || []).push(log);
      return acc;
    }, {});
  }, [visibleLogs]);

  const days = Object.keys(grouped);

  const handleDelete = async (logId: string) => {
    if (confirm("Are you sure you want to delete this log?")) {
      try {
        await deleteDoseLog(logId);
        toast({ title: "Log Deleted", description: "The dose log has been removed from your history." });
      } catch (err) {
        toast({ variant: "destructive", title: "Error", description: "Failed to delete log." });
      }
    }
  };

  const exportCSV = () => {
    const escape = (val: string) => `"${(val || "").toString().replace(/"/g, '""')}"`;
    const header = "Date,Medicine,Dose,Scheduled Time,Action\n";
    const rows = doseLogs
      .map((l) => [
        new Date(l.actionTime).toLocaleDateString(),
        escape(l.medicineName),
        escape(l.dose),
        escape(l.scheduledTime),
        escape(l.action)
      ].join(","))
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dawalens-history-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: t("history.exported"), description: t("history.exported_desc") });
  };

  const importCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const lines = text.split("\n").slice(1);
        let count = 0;
        lines.forEach((line) => {
          if (!line.trim()) return;
          // Robust regex to split CSV by comma while respecting quotes
          const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.replace(/^"|"$/g, '').replace(/""/g, '"'));
          
          if (parts.length >= 4) {
            const medicine = parts[1]?.trim();
            const dose = parts[2]?.trim();
            const scheduledTime = parts[3]?.trim();
            const action = (parts[4]?.trim() as DoseLog["action"]) || "taken";
            
            if (medicine && dose) {
              logDose({
                reminderId: "",
                medicineName: medicine,
                dose: dose,
                scheduledTime: scheduledTime,
                action: action,
              });
              count++;
            }
          }
        });
        toast({ title: t("history.imported"), description: `${count} ${t("history.imported_desc")}` });
      } catch (err) {
        toast({ variant: "destructive", title: "Import Failed", description: "Invalid CSV format." });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="px-4 pt-8 pb-24 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={16} /> {t("common.back")}
        </button>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCSV} className="rounded-xl h-9 text-xs">
            <Download size={14} className="mr-1.5" /> {t("history.export")}
          </Button>
          <label>
            <Button size="sm" variant="outline" asChild className="rounded-xl h-9 text-xs cursor-pointer">
              <span><Upload size={14} className="mr-1.5" /> {t("history.import")}</span>
            </Button>
            <input type="file" accept=".csv" className="hidden" onChange={importCSV} />
          </label>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-4xl font-bold text-foreground tracking-tight mb-2">{t("history.title")}</h1>
        <p className="text-muted-foreground">Keep track of your adherence and health records.</p>
      </div>

      {/* Adherence Dashboard */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="premium-card bg-gradient-to-br from-primary/10 via-background to-background border-primary/20 mb-6 overflow-hidden relative"
      >
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <TrendingUp size={120} />
        </div>
        
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                className="text-muted/20"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={251.2}
                strokeDashoffset={251.2 - (251.2 * stats.rate) / 100}
                className="text-primary transition-all duration-1000 ease-out"
              />
            </svg>
            <span className="absolute text-xl font-black">{stats.rate}%</span>
          </div>
          
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-lg font-bold text-foreground mb-1">7-Day Adherence</h2>
            <p className="text-sm text-muted-foreground mb-3">You've taken {stats.taken} of your last {stats.total} scheduled doses.</p>
            <div className="flex gap-2 justify-center sm:justify-start">
              <Badge variant="secondary" className="rounded-lg py-1 px-3 bg-success/10 text-success border-success/20">
                <Check size={12} className="mr-1" /> Good Progress
              </Badge>
              <Badge variant="secondary" className="rounded-lg py-1 px-3 bg-primary/10 text-primary border-primary/20">
                <Calendar size={12} className="mr-1" /> Weekly Report
              </Badge>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Search & Filters */}
      <div className="space-y-4 mb-6">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search medicine logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-12 pl-12 pr-4 rounded-2xl border border-border/50 bg-muted/20 focus:bg-background focus:ring-2 focus:ring-primary/20 transition-all outline-none"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {(["All", "taken", "skipped", "snoozed"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all border ${
                statusFilter === status 
                  ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/25" 
                  : "bg-card border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* History Timeline */}
      {days.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20 bg-accent/20 rounded-[32px] border border-dashed border-border/50"
        >
          <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center mx-auto mb-4">
            <Clock size={32} className="text-muted-foreground/30" />
          </div>
          <p className="text-base font-bold text-foreground mb-1">{t("history.no_history")}</p>
          <p className="text-sm text-muted-foreground max-w-[240px] mx-auto">No records found matching your filters.</p>
          {searchTerm || statusFilter !== "All" ? (
            <Button variant="link" onClick={() => {setSearchTerm(""); setStatusFilter("All");}} className="mt-4 text-primary font-bold uppercase tracking-wider text-xs">
              Reset All Filters
            </Button>
          ) : null}
        </motion.div>
      ) : (
        <div className="space-y-12 relative before:absolute before:left-5 before:top-4 before:bottom-0 before:w-px before:bg-gradient-to-b before:from-border before:via-border before:to-transparent">
          <AnimatePresence mode="popLayout">
            {days.map((day) => (
              <motion.div 
                layout 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                key={day}
                className="relative pl-12"
              >
                <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-background border-2 border-primary flex items-center justify-center z-10 shadow-sm">
                  <Calendar size={16} className="text-primary" />
                </div>
                
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-6 bg-background inline-block pr-4 py-1">
                  {day}
                </h3>
                
                <div className="space-y-4">
                  {grouped[day].map((log) => (
                    <motion.div
                      layout
                      key={log.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="group relative rounded-2xl border border-border/50 bg-card p-4 transition-all hover:shadow-xl hover:border-primary/20 hover:-translate-y-1"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div
                            className={`flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-2xl shadow-sm transition-transform group-hover:scale-110 ${
                              log.action === "taken" 
                                ? "bg-success/10 text-success" 
                                : log.action === "skipped" 
                                  ? "bg-destructive/10 text-destructive" 
                                  : "bg-warning/10 text-warning"
                            }`}
                          >
                            {log.action === "taken" ? <Check size={22} strokeWidth={3} /> : log.action === "skipped" ? <X size={22} strokeWidth={3} /> : <Clock size={22} strokeWidth={3} />}
                          </div>
                          <div>
                            <p className="text-[17px] font-bold text-foreground leading-tight mb-1">{log.medicineName}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={`text-[10px] uppercase font-black tracking-widest px-2 py-0 border-none ${
                                log.action === "taken" ? "bg-success/10 text-success" : log.action === "skipped" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
                              }`}>
                                {log.action}
                              </Badge>
                              <span className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-tighter">
                                SCH: {log.scheduledTime || "N/A"}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between sm:justify-end gap-3 mt-4 sm:mt-0 pt-4 sm:pt-0 border-t border-border/50 sm:border-0">
                          <div className="text-right">
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">Logged at</p>
                            <p className="text-sm font-bold text-foreground">
                              {new Date(log.actionTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                          
                          <button 
                            onClick={() => handleDelete(log.id)}
                            className="p-2.5 text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                            title="Undo / Delete Record"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredLogs.length > visibleCount && (
            <motion.div layout className="pt-6 text-center pl-12">
              <Button 
                variant="outline" 
                onClick={() => setVisibleCount(c => c + 30)}
                className="rounded-2xl w-full sm:w-auto h-12 font-bold uppercase tracking-widest text-xs border-primary/20 text-primary hover:bg-primary/5"
              >
                Load Older Records
              </Button>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
