import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, X, Clock, Download, Upload, Trash2, Filter } from "lucide-react";
import { useApp, DoseLog } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
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
  const [visibleCount, setVisibleCount] = useState(30);

  // Group and sort
  const filteredLogs = useMemo(() => {
    let filtered = doseLogs;
    if (statusFilter !== "All") {
      filtered = filtered.filter(l => l.action === statusFilter);
    }
    // Sort descending by actionTime
    return filtered.sort((a, b) => new Date(b.actionTime).getTime() - new Date(a.actionTime).getTime());
  }, [doseLogs, statusFilter]);

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
    const header = "Date,Medicine,Dose,Scheduled Time,Action\n";
    const rows = doseLogs
      .map((l) => `${new Date(l.actionTime).toLocaleDateString()},${l.medicineName},${l.dose},${l.scheduledTime},${l.action}`)
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
          const parts = line.split(",");
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
    <div className="px-4 pt-12 pb-24">
      <div className="flex items-center justify-between mb-8">
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
        <h1 className="text-3xl font-bold text-foreground mb-4">{t("history.title")}</h1>
        
        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
          <div className="flex items-center gap-1 text-muted-foreground mr-2">
            <Filter size={14} />
          </div>
          {(["All", "taken", "skipped", "snoozed"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                statusFilter === status 
                  ? "bg-primary text-primary-foreground shadow-md" 
                  : "bg-accent/50 text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* History Timeline */}
      {days.length === 0 ? (
        <div className="text-center py-16 bg-accent/20 rounded-3xl border border-border/50 shadow-sm mt-4">
          <Clock size={48} className="text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-sm font-medium text-muted-foreground">{t("history.no_history")}</p>
          {statusFilter !== "All" && (
            <Button variant="link" onClick={() => setStatusFilter("All")} className="mt-2 text-primary">
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          <AnimatePresence mode="popLayout">
            {days.map((day) => (
              <motion.div 
                layout 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.95 }}
                key={day}
                className="relative"
              >
                <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl py-2 mb-3 -mx-4 px-4 border-b border-border/20">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{day}</h3>
                </div>
                
                <div className="space-y-3">
                  {grouped[day].map((log) => (
                    <motion.div
                      layout
                      key={log.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl border border-border/50 bg-card p-4 transition-all hover:shadow-md hover:border-primary/20"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full ${
                            log.action === "taken" 
                              ? "bg-success/15 text-success" 
                              : log.action === "skipped" 
                                ? "bg-destructive/15 text-destructive" 
                                : "bg-warning/15 text-warning"
                          }`}
                        >
                          {log.action === "taken" ? <Check size={18} strokeWidth={2.5} /> : log.action === "skipped" ? <X size={18} strokeWidth={2.5} /> : <Clock size={18} strokeWidth={2.5} />}
                        </div>
                        <div>
                          <p className="text-[15px] font-bold text-foreground leading-tight">{log.medicineName}</p>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">
                            {log.action.toUpperCase()} • SCH: {log.scheduledTime || "N/A"}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between sm:justify-end gap-4 mt-3 sm:mt-0 pt-3 sm:pt-0 border-t border-border/50 sm:border-0">
                        <span className="text-[11px] font-bold bg-accent px-3 py-1 rounded-lg text-muted-foreground uppercase tracking-wider">
                          LOGGED: {new Date(log.actionTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        
                        <button 
                          onClick={() => handleDelete(log.id)}
                          className="p-2 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors opacity-100 sm:opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Undo / Delete Record"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredLogs.length > visibleCount && (
            <motion.div layout className="pt-4 text-center">
              <Button 
                variant="outline" 
                onClick={() => setVisibleCount(c => c + 30)}
                className="rounded-xl w-full sm:w-auto"
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
