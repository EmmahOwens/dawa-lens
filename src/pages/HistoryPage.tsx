import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Check, X, Clock, Download, Upload } from "lucide-react";
import { useApp, DoseLog } from "@/contexts/AppContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export default function HistoryPage() {
  const navigate = useNavigate();
  const { doseLogs, reminders, logDose } = useApp();
  const { toast } = useToast();
  const { t } = useTranslation();

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
    toast({ title: t("history.dose_logged"), description: `${r.medicineName} ${t("history.marked_as")} ${t("history.taken")}` });
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
      toast({ title: t("history.imported"), description: `${count} ${t("history.imported_desc")}` });
    };
    reader.readAsText(file);
  };

  const days = Object.keys(grouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return (
    <div className="px-4 pt-6 pb-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <ArrowLeft size={16} /> {t("common.back")}
      </button>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-foreground">{t("history.title")}</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCSV} className="rounded-lg h-9">
            <Download size={14} className="mr-1" /> {t("history.export")}
          </Button>
          <label>
            <Button size="sm" variant="outline" asChild className="rounded-lg h-9">
              <span><Upload size={14} className="mr-1" /> {t("history.import")}</span>
            </Button>
            <input type="file" accept=".csv" className="hidden" onChange={importCSV} />
          </label>
        </div>
      </div>

      {/* Quick log from active reminders */}
      {reminders.filter((r) => r.enabled).length > 0 && (
        <div className="mb-8">
          <h2 className="section-title">{t("history.quick_log")}</h2>
          <div className="space-y-3">
            {reminders.filter((r) => r.enabled).map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border border-border/50 bg-card p-4 transition-all hover:bg-accent/5">
                <div>
                  <p className="text-sm font-semibold text-card-foreground">{r.medicineName}</p>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{r.dose} • {r.time}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleMarkTaken(r)}
                    className="rounded-lg bg-success/10 p-2 text-success hover:bg-success/20 transition-colors shadow-sm"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => {
                      logDose({ reminderId: r.id, medicineName: r.medicineName, dose: r.dose, scheduledTime: r.time, action: "skipped" });
                      toast({ title: t("history.skipped"), description: `${r.medicineName} ${t("history.marked_as")} ${t("history.skipped")}` });
                    }}
                    className="rounded-lg bg-destructive/10 p-2 text-destructive hover:bg-destructive/20 transition-colors shadow-sm"
                  >
                    <X size={16} />
                  </button>
                  <button
                    onClick={() => {
                      logDose({ reminderId: r.id, medicineName: r.medicineName, dose: r.dose, scheduledTime: r.time, action: "snoozed" });
                      toast({ title: t("history.snoozed"), description: `${r.medicineName} ${t("history.snoozed")}` });
                    }}
                    className="rounded-lg bg-warning/10 p-2 text-warning hover:bg-warning/20 transition-colors shadow-sm"
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
          <p className="text-sm text-muted-foreground">{t("history.no_history")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {days.map((day) => (
            <div key={day}>
              <h3 className="section-title mb-3">{day}</h3>
              <div className="space-y-3">
                {grouped[day].map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-between rounded-xl border border-border/50 bg-card p-4 transition-all hover:bg-accent/5"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`rounded-lg p-2 ${
                          log.action === "taken" ? "bg-success/10 text-success" : log.action === "skipped" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
                        } shadow-sm`}
                      >
                        {log.action === "taken" ? <Check size={14} /> : log.action === "skipped" ? <X size={14} /> : <Clock size={14} />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-card-foreground">{log.medicineName}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{log.dose} • {log.scheduledTime}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
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
