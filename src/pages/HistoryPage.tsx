import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Check,
  X,
  Clock,
  AlertCircle,
  Download,
  Upload,
  Trash2,
  Search,
  TrendingUp,
  Calendar,
  MoreVertical,
} from "@/lib/icons";
import { useApp, DoseLog } from "@/contexts/AppContext";
import { usePatientScope } from "@/hooks/usePatientScope";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useState, useMemo } from "react";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import { toDate } from "@/lib/utils";
import { calculateVitalitySummary } from "@/lib/vitalityUtils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Helper for relative date
function getRelativeDate(dateString: string) {
  const date = toDate(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const { logDose, deleteDoseLog, patients, doseLogs, userProfile } = useApp();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    logId: string;
    medicineName: string;
  }>({ open: false, logId: "", medicineName: "" });

  const [statusFilter, setStatusFilter] = useState<
    "All" | "taken" | "skipped" | "missed"
  >("All");
  const [patientFilter, setPatientFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleCount, setVisibleCount] = useState(30);

  const { scopedDoseLogs, scopedWellnessLogs } = usePatientScope();

  // Resolve dose logs according to patientFilter
  const historyDoseLogs = useMemo(() => {
    let source = doseLogs.length > 0 ? doseLogs : scopedDoseLogs;
    if (patientFilter === "self") {
      source = source.filter((l) => !l.patientId || l.patientId === userProfile?.id);
    } else if (patientFilter !== "all") {
      source = source.filter((l) => l.patientId === patientFilter);
    }
    // Exclude non-history/temporary logs (e.g. snoozed actions)
    return source.filter((l) => l.action !== "snoozed");
  }, [patientFilter, doseLogs, scopedDoseLogs, userProfile]);

  // Adherence Stats
  const stats = useMemo(() => {
    const chartData = calculateVitalitySummary(historyDoseLogs, scopedWellnessLogs);
    const rate = Math.round(chartData.reduce((acc, d) => acc + d.adherence, 0) / 7) || 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    // Set to start of day for accurate comparison
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const last7Days = historyDoseLogs.filter((l) => {
      const logDate = toDate(l.actionTime);
      return logDate >= sevenDaysAgo;
    });

    const taken = last7Days.filter((l) => l.action === "taken").length;
    const total = last7Days.length;

    return { taken, total, rate };
  }, [historyDoseLogs, scopedWellnessLogs]);

  // Group and sort
  const filteredLogs = useMemo(() => {
    let filtered = historyDoseLogs;
    if (statusFilter !== "All") {
      filtered = filtered.filter((l) => l.action === statusFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter((l) =>
        l.medicineName.toLowerCase().includes(q)
      );
    }
    // Sort descending by scheduledTime or actionTime
    return filtered.sort((a, b) => {
      const timeA = toDate(a.scheduledTime || a.actionTime).getTime();
      const timeB = toDate(b.scheduledTime || b.actionTime).getTime();
      return timeB - timeA;
    });
  }, [historyDoseLogs, statusFilter, searchTerm]);

  const visibleLogs = filteredLogs.slice(0, visibleCount);

  // Group by relative date using scheduledTime if available, fallback to actionTime
  const grouped = useMemo(() => {
    return visibleLogs.reduce<Record<string, DoseLog[]>>((acc, log) => {
      const targetTime = log.scheduledTime || log.actionTime;
      const day = getRelativeDate(targetTime);
      (acc[day] = acc[day] || []).push(log);
      return acc;
    }, {});
  }, [visibleLogs]);

  const days = Object.keys(grouped);

  const handleDelete = (logId: string) => {
    const log = historyDoseLogs.find((l) => l.id === logId);
    setDeleteDialog({
      open: true,
      logId,
      medicineName: log?.medicineName ?? "",
    });
  };

  const exportCSV = () => {
    const escape = (val: string) =>
      `"${(val || "").toString().replace(/"/g, '""')}"`;
    const header = "Date,Medicine,Dose,Scheduled Time,Action\n";
    const rows = historyDoseLogs
      .map((l) =>
        [
          toDate(l.actionTime).toLocaleDateString(),
          escape(l.medicineName),
          escape(l.dose),
          escape(l.scheduledTime),
          escape(l.action),
        ].join(",")
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dawalens-history-${
      new Date().toISOString().split("T")[0]
    }.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: t("history.exported"),
      description: t("history.exported_desc"),
    });
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
          const parts = line
            .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
            .map((p) => p.replace(/^"|"$/g, "").replace(/""/g, '"'));

          if (parts.length >= 4) {
            const medicine = parts[1]?.trim();
            const dose = parts[2]?.trim();
            const scheduledTime = parts[3]?.trim();
            const rawAction = parts[4]?.trim().toLowerCase();
            const action: DoseLog["action"] =
              rawAction === "missed" || rawAction === "skipped"
                ? rawAction
                : "taken";

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
        toast({
          title: t("history.imported"),
          description: `${count} ${t("history.imported_desc")}`,
        });
      } catch (err) {
        toast({
          variant: "destructive",
          title: "Import Failed",
          description: "Invalid CSV format.",
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full pt-2">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} /> {t("common.back")}
        </button>
        <div className="flex gap-2">
          {/* Desktop Export/Import buttons */}
          <div className="hidden sm:flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={exportCSV}
              className="rounded-full h-9 px-4 text-xs font-medium"
            >
              <Download size={14} className="mr-1.5" /> {t("history.export")}
            </Button>
            <label>
              <Button
                size="sm"
                variant="outline"
                asChild
                className="rounded-full h-9 px-4 text-xs font-medium cursor-pointer"
              >
                <span>
                  <Upload size={14} className="mr-1.5" /> {t("history.import")}
                </span>
              </Button>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={importCSV}
              />
            </label>
          </div>

          {/* Mobile More Actions Dropdown */}
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="outline" className="rounded-full h-9 w-9">
                  <MoreVertical size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl min-w-[150px]">
                <DropdownMenuItem onClick={exportCSV} className="gap-2 cursor-pointer text-xs font-semibold">
                  <Download size={14} /> {t("history.export")}
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="gap-2 cursor-pointer text-xs font-semibold">
                  <label className="flex items-center gap-2 cursor-pointer w-full">
                    <Upload size={14} /> {t("history.import")}
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={importCSV}
                    />
                  </label>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-[-0.022em] mb-2">
          {t("history.title")}
        </h1>
        <p className="text-muted-foreground text-sm">
          Keep track of your adherence and health records.
        </p>
      </div>

      {/* Adherence Dashboard - Apple Near-Black Tile 1 / Parchment */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-[18px] border border-border bg-[#f5f5f7] dark:bg-[#272729] p-6 mb-6 overflow-hidden relative"
      >
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="7"
                fill="transparent"
                className="text-muted/20"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="7"
                fill="transparent"
                strokeDasharray={251.2}
                strokeDashoffset={251.2 - (251.2 * stats.rate) / 100}
                className="text-[#0066cc] dark:text-[#2997ff] transition-all duration-1000 ease-out"
              />
            </svg>
            <span className="absolute text-xl font-bold tracking-tight text-foreground">{stats.rate}%</span>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-lg font-bold text-foreground tracking-[-0.015em] mb-1">
              7-Day Adherence
            </h2>
            <p className="text-sm text-muted-foreground mb-3">
              You've taken {stats.taken} of your last {stats.total} scheduled
              doses.
            </p>
            <div className="flex gap-2 justify-center sm:justify-start">
              <button
                onClick={() => navigate("/wellness")}
                className="inline-flex items-center rounded-full py-1.5 px-3.5 bg-success/10 text-success border border-success/20 text-xs font-semibold hover:bg-success/20 transition-colors active:scale-95"
              >
                <Check size={12} className="mr-1" /> Good Progress
              </button>
              <button
                onClick={() => navigate("/report")}
                className="inline-flex items-center rounded-full py-1.5 px-3.5 bg-primary/10 text-primary border border-primary/20 text-xs font-semibold hover:bg-primary/20 transition-colors active:scale-95"
              >
                <Calendar size={12} className="mr-1" /> Weekly Report
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Search & Filters */}
      <div className="space-y-3 mb-6">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Search medicine logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-11 pl-12 pr-4 rounded-full border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm transition-all"
          />
        </div>

        {/* Mobile Dropdowns for Filters */}
        <div className="sm:hidden grid grid-cols-2 gap-2">
          {patients.length > 0 && (
            <Select value={patientFilter} onValueChange={setPatientFilter}>
              <SelectTrigger className="h-10 rounded-full bg-card border-border text-xs font-semibold truncate">
                <SelectValue placeholder="Profile" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Family & Clients</SelectItem>
                <SelectItem value="self">{userProfile?.name ? `${userProfile.name} (You)` : "Self (You)"}</SelectItem>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.relation ? `(${p.relation})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select
            value={statusFilter}
            onValueChange={(val) => setStatusFilter(val as any)}
          >
            <SelectTrigger
              className={`h-10 rounded-full bg-card border-border text-xs font-semibold ${
                patients.length === 0 ? "col-span-2" : ""
              }`}
            >
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Statuses</SelectItem>
              <SelectItem value="taken">Taken</SelectItem>
              <SelectItem value="skipped">Skipped</SelectItem>
              <SelectItem value="missed">Missed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Desktop / Tablet Filter Pill Bars */}
        {patients.length > 0 && (
          <div className="hidden sm:flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setPatientFilter("all")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                patientFilter === "all"
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              All Profiles
            </button>
            <button
              onClick={() => setPatientFilter("self")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                patientFilter === "self"
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {userProfile?.name || "You"}
            </button>
            {patients.map((p) => (
              <button
                key={p.id}
                onClick={() => setPatientFilter(p.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                  patientFilter === p.id
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        <div className="hidden sm:flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {(["All", "taken", "skipped", "missed"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize whitespace-nowrap transition-all border ${
                statusFilter === status
                  ? "bg-[#0066cc] dark:bg-[#0071e3] border-transparent text-white"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
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
          <p className="text-base font-bold text-foreground mb-1">
            {t("history.no_history")}
          </p>
          <p className="text-sm text-muted-foreground max-w-[240px] mx-auto">
            No records found matching your filters.
          </p>
          {searchTerm || statusFilter !== "All" ? (
            <Button
              variant="link"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("All");
              }}
              className="mt-4 text-primary font-bold uppercase tracking-wider text-xs"
            >
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
                      className="group relative rounded-[18px] border border-border bg-card p-4 transition-colors hover:border-foreground/20"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div
                            className={`flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-[11px] transition-transform group-hover:scale-105 ${
                              log.action === "taken"
                                ? "bg-success/10 text-success"
                                : log.action === "missed"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-muted text-muted-foreground border border-border"
                            }`}
                          >
                            {log.action === "taken" ? (
                              <Check size={20} strokeWidth={2.5} />
                            ) : log.action === "missed" ? (
                              <AlertCircle size={20} strokeWidth={2.5} />
                            ) : (
                              <X size={20} strokeWidth={2.5} />
                            )}
                          </div>
                          <div>
                            <p className="text-[17px] font-bold text-foreground leading-tight mb-1">
                              {log.medicineName}
                            </p>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0 border-none rounded-full ${
                                  log.action === "taken"
                                    ? "bg-success/10 text-success"
                                    : log.action === "missed"
                                    ? "bg-destructive/10 text-destructive"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {log.action}
                              </Badge>
                              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-tight">
                                SCH:{" "}
                                {log.scheduledTime
                                  ? toDate(log.scheduledTime).toLocaleTimeString(undefined, {
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })
                                  : "N/A"}
                              </span>
                              {log.patientId && patients.length > 0 && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] font-semibold px-2 py-0 h-4 bg-muted text-muted-foreground rounded-full"
                                >
                                  {patients.find((p) => p.id === log.patientId)?.name || "Dependent"}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 mt-4 sm:mt-0 pt-4 sm:pt-0 border-t border-border/50 sm:border-0">
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">
                              Logged at
                            </p>
                            <p className="text-sm font-semibold text-foreground">
                              {toDate(log.actionTime).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>

                          <button
                            onClick={() => handleDelete(log.id)}
                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-all active:scale-95"
                            title="Undo / Delete Record"
                          >
                            <Trash2 size={16} />
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
                onClick={() => setVisibleCount((c) => c + 30)}
                className="rounded-full w-full sm:w-auto h-11 px-8 font-semibold text-xs border-border text-foreground hover:bg-muted active:scale-95"
              >
                Load Older Records
              </Button>
            </motion.div>
          )}
        </div>
      )}
      <ConfirmationDialog
        open={deleteDialog.open}
        onOpenChange={(open) => {
          if (!open) setDeleteDialog({ open: false, logId: "", medicineName: "" });
        }}
        title="Delete Record"
        description={`Are you sure you want to delete the dose record for ${deleteDialog.medicineName}?`}
        onConfirm={async () => {
          try {
            await deleteDoseLog(deleteDialog.logId);
            toast({
              title: "Log Deleted",
              description: "The dose log has been removed from your history.",
            });
          } catch (err) {
            toast({
              variant: "destructive",
              title: "Error",
              description: "Failed to delete log.",
            });
          }
        }}
        dangerBadgeLabel="Irreversible"
        confirmLabel="Delete Record"
        variant="default"
      />
    </div>
  );
}
