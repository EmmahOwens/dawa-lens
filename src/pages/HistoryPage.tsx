import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Check, X, Clock, Download, Upload, Trash2 } from "lucide-react";
import { useApp, DoseLog } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function HistoryPage() {
  const navigate = useNavigate();
  const { doseLogs, reminders, logDose } = useApp();
  const { toast } = useToast();

  // Group by date
  const grouped = doseLogs.reduce<Record<string, DoseLog[]>>((acc, log) => {
    const day = new Date(log.actionTime).toLocaleDateString();
    (acc[day] = acc[day] || []).push(log);
    return acc;
  }, {});

  const handleMarkTaken = (r: typeof reminders[0]) => {
    logDose({
      reminderId: r.id,
      medicineName: r.medicineName,
      dose: r.dose,
      scheduledTime: r.time,
      action: "taken",
    });
    toast({ title: "Dose logged", description: `${r.medicineName} marked as taken` });
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
    toast({ title: "Exported!", description: "History downloaded as CSV" });
  };

  const importCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const lines = text.split("\n").slice(1);
      let count = 0;
      lines.forEach((line) => {
        const [, medicine, dose, scheduledTime, action] = line.split(",");
        if (medicine && dose) {
          logDose({
            reminderId: "",
            medicineName: medicine.trim(),
            dose: dose.trim(),
            scheduledTime: scheduledTime?.trim() || "",
            action: (action?.trim() as DoseLog["action"]) || "taken",
          });
          count++;
        }
      });
      toast({ title: "Imported!", description: `${count} records imported` });
    };
    reader.readAsText(file);
  };

  const days = Object.keys(grouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return (
    <div className="px-4 pt-6 pb-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-foreground">Medication Log</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCSV}>
            <Download size={14} className="mr-1" /> Export
          </Button>
          <label>
            <Button size="sm" variant="outline" asChild>
              <span><Upload size={14} className="mr-1" /> Import</span>
            </Button>
            <input type="file" accept=".csv" className="hidden" onChange={importCSV} />
          </label>
        </div>
      </div>

      {/* Quick log from active reminders */}
      {reminders.filter((r) => r.enabled).length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Quick Log</h2>
          <div className="space-y-2">
            {reminders.filter((r) => r.enabled).map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                <div>
                  <p className="text-sm font-medium text-card-foreground">{r.medicineName}</p>
                  <p className="text-xs text-muted-foreground">{r.dose} • {r.time}</p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleMarkTaken(r)}
                    className="rounded-lg bg-success/15 p-2 text-success hover:bg-success/25 transition-colors"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => {
                      logDose({ reminderId: r.id, medicineName: r.medicineName, dose: r.dose, scheduledTime: r.time, action: "skipped" });
                      toast({ title: "Skipped", description: `${r.medicineName} marked as skipped` });
                    }}
                    className="rounded-lg bg-destructive/10 p-2 text-destructive hover:bg-destructive/20 transition-colors"
                  >
                    <X size={16} />
                  </button>
                  <button
                    onClick={() => {
                      logDose({ reminderId: r.id, medicineName: r.medicineName, dose: r.dose, scheduledTime: r.time, action: "snoozed" });
                      toast({ title: "Snoozed", description: `${r.medicineName} snoozed` });
                    }}
                    className="rounded-lg bg-warning/15 p-2 text-warning hover:bg-warning/25 transition-colors"
                  >
                    <Clock size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {days.length === 0 ? (
        <div className="text-center py-16">
          <Clock size={40} className="text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No dose history yet. Start logging!</p>
        </div>
      ) : (
        <div className="space-y-5">
          {days.map((day) => (
            <div key={day}>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">{day}</h3>
              <div className="space-y-2">
                {grouped[day].map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`rounded-lg p-1.5 ${
                          log.action === "taken" ? "bg-success/15 text-success" : log.action === "skipped" ? "bg-destructive/10 text-destructive" : "bg-warning/15 text-warning"
                        }`}
                      >
                        {log.action === "taken" ? <Check size={14} /> : log.action === "skipped" ? <X size={14} /> : <Clock size={14} />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-card-foreground">{log.medicineName}</p>
                        <p className="text-xs text-muted-foreground">{log.dose} • {log.scheduledTime}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.actionTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
