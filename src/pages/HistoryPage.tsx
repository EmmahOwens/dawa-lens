import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
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
import {
  EDITORIAL_EASE,
  EditorialEyebrow,
} from "@/components/editorial/EditorialPrimitives";

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
    <div className="w-full pt-2 sm:pt-4 pb-10">
      {/* Unified Editorial Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EDITORIAL_EASE }}
        className="editorial-card p-6 sm:p-7 mb-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <EditorialEyebrow
              index="01"
              label={`Adherence Archive · ${scopedDoseLogs.length} Logs`}
              dotColor="bg-primary"
            />
            <h1 className="editorial-display text-[30px] sm:text-[38px] font-medium text-foreground leading-[1.02]">
              {t("history.title", "Dose History")}
            </h1>
            <p className="text-[13.5px] text-muted-foreground max-w-lg">
              Keep track of your adherence, daily dose logs, and exportable clinical records.
            </p>
          </div>

          <div className="flex gap-2 shrink-0">
            {/* Desktop Export/Import buttons */}
            <div className="hidden sm:flex gap-2">
              <button
                type="button"
                onClick={exportCSV}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20 text-[12px] font-medium transition-all active:scale-95"
              >
                <Download size={13} /> {t("history.export")}
              </button>
              <label className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-border bg-card hover:bg-secondary text-foreground text-[12px] font-medium cursor-pointer transition-colors active:scale-95">
                <Upload size={13} className="text-primary" /> {t("history.import")}
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
                  <Button size="icon" variant="outline" className="rounded-full h-9 w-9 border-border">
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
      </motion.div>

      {/* Luminous Midnight Indigo 7-Day Adherence Hero */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EDITORIAL_EASE }}
        className="editorial-panel-indigo rounded-[26px] p-6 sm:p-7 mb-6 text-white"
      >
        <div className="editorial-grain" aria-hidden="true" />
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 sm:gap-7">
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 96 96" aria-hidden="true">
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="4.5"
                fill="transparent"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke={stats.rate >= 80 ? "#34d399" : "#38bdf8"}
                strokeWidth="4.5"
                strokeLinecap="round"
                fill="transparent"
                strokeDasharray={251.2}
                strokeDashoffset={251.2 - (251.2 * stats.rate) / 100}
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="editorial-tabular text-[24px] font-light tracking-[-0.03em] text-white leading-none">
                {stats.rate}%
              </span>
              <span className="editorial-mono text-[8px] text-white/55 mt-1">7-DAY</span>
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <EditorialEyebrow
              index="02"
              label="7-Day Adherence"
              dotColor={stats.rate >= 80 ? "bg-emerald-400" : "bg-sky-300"}
              onDark
              className="justify-center sm:justify-start mb-2"
            />
            <h2 className="editorial-display text-[24px] sm:text-[28px] font-medium text-white leading-tight mb-1.5">
              Consistency{" "}
              <em className="editorial-serif text-[1.08em] text-indigo-200 font-normal">
                overview.
              </em>
            </h2>
            <p className="text-[13.5px] text-white/75 mb-4">
              You've taken {stats.taken} of your last {stats.total} scheduled doses.
            </p>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
              <button
                type="button"
                onClick={() => navigate("/wellness")}
                className="editorial-glass-dark inline-flex items-center gap-1.5 rounded-full h-8 px-3.5 text-emerald-200 hover:bg-white/10 text-[12px] font-medium transition-colors active:scale-95"
              >
                <Check size={12} /> Good Progress
              </button>
              <button
                type="button"
                onClick={() => navigate("/report")}
                className="editorial-glass-dark inline-flex items-center gap-1.5 rounded-full h-8 px-3.5 text-sky-100 hover:bg-white/10 text-[12px] font-medium transition-colors active:scale-95"
              >
                <Calendar size={12} /> Weekly Report
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Search & Filters */}
      <div className="space-y-3 mb-6">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Search medicine logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-11 pl-11 pr-4 rounded-full border border-border/80 bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-[14px] transition-all"
          />
        </div>

        {/* Mobile Dropdowns for Filters */}
        <div className="sm:hidden grid grid-cols-2 gap-2">
          {patients.length > 0 && (
            <Select value={patientFilter} onValueChange={setPatientFilter}>
              <SelectTrigger className="h-10 rounded-full bg-card border-border text-xs font-medium truncate">
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
              className={`h-10 rounded-full bg-card border-border text-xs font-medium ${
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
              type="button"
              onClick={() => setPatientFilter("all")}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-all border ${
                patientFilter === "all"
                  ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                  : "bg-card border-border/80 text-muted-foreground hover:text-foreground hover:border-primary/30"
              }`}
            >
              All Profiles
            </button>
            <button
              type="button"
              onClick={() => setPatientFilter("self")}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-all border ${
                patientFilter === "self"
                  ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                  : "bg-card border-border/80 text-muted-foreground hover:text-foreground hover:border-primary/30"
              }`}
            >
              {userProfile?.name || "You"}
            </button>
            {patients.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => setPatientFilter(p.id)}
                className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-all border ${
                  patientFilter === p.id
                    ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                    : "bg-card border-border/80 text-muted-foreground hover:text-foreground hover:border-primary/30"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        <div className="hidden sm:flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {(["All", "taken", "skipped", "missed"] as const).map((status) => (
            <button
              type="button"
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-1.5 rounded-full text-[12.5px] font-medium capitalize whitespace-nowrap transition-all border ${
                statusFilter === status
                  ? "bg-primary border-primary text-primary-foreground shadow-sm shadow-primary/20"
                  : "bg-card border-border/80 text-muted-foreground hover:text-foreground hover:border-primary/30"
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
          className="editorial-bento bg-gradient-to-br from-indigo-50/60 via-card to-sky-50/35 dark:from-indigo-950/30 dark:via-card dark:to-sky-950/20 border-dashed border-indigo-500/25 text-center py-16 px-6"
        >
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4 text-indigo-600 dark:text-indigo-400">
            <Clock size={26} />
          </div>
          <p className="editorial-display text-[22px] font-medium text-foreground mb-1.5">
            {t("history.no_history")}
          </p>
          <p className="text-[13.5px] text-muted-foreground max-w-[280px] mx-auto">
            No records found matching your filters.
          </p>
          {searchTerm || statusFilter !== "All" ? (
            <Button
              variant="link"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("All");
              }}
              className="mt-4 text-primary font-semibold uppercase tracking-wider text-xs"
            >
              Reset All Filters
            </Button>
          ) : null}
        </motion.div>
      ) : (
        <div className="space-y-10 relative before:absolute before:left-5 before:top-4 before:bottom-0 before:w-px before:bg-gradient-to-b before:from-primary/40 before:via-border before:to-transparent">
          <AnimatePresence mode="popLayout">
            {days.map((day) => (
              <motion.div
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                key={day}
                className="relative pl-12"
              >
                <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center z-10">
                  <Calendar size={15} className="text-primary" />
                </div>

                <h3 className="editorial-mono text-[10.5px] text-muted-foreground mb-4 inline-block pt-2.5">
                  {day}
                </h3>

                <div className="space-y-3">
                  {grouped[day].map((log) => (
                    <motion.div
                      layout
                      key={log.id}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`group relative editorial-bento p-4 sm:p-5 bg-gradient-to-r ${
                        log.action === "taken"
                          ? "from-emerald-50/75 via-card to-card dark:from-emerald-950/35 dark:via-card dark:to-card border-emerald-500/20 hover:border-emerald-500/40"
                          : log.action === "missed"
                          ? "from-rose-50/75 via-card to-card dark:from-rose-950/35 dark:via-card dark:to-card border-rose-500/25 hover:border-rose-500/45"
                          : "from-amber-50/70 via-card to-card dark:from-amber-950/30 dark:via-card dark:to-card border-amber-500/20 hover:border-amber-500/40"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div
                            className={`flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl border transition-transform group-hover:scale-105 ${
                              log.action === "taken"
                                ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-600 dark:text-emerald-400"
                                : log.action === "missed"
                                ? "bg-rose-500/15 border-rose-500/25 text-rose-600 dark:text-rose-400"
                                : "bg-amber-500/15 border-amber-500/25 text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {log.action === "taken" ? (
                              <Check size={18} strokeWidth={2.5} />
                            ) : log.action === "missed" ? (
                              <AlertCircle size={18} strokeWidth={2.5} />
                            ) : (
                              <X size={18} strokeWidth={2.5} />
                            )}
                          </div>
                          <div>
                            <p className="text-[16px] font-medium text-foreground leading-tight mb-1">
                              {log.medicineName}
                            </p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge
                                variant="outline"
                                className={`text-[10px] uppercase font-semibold tracking-wider px-2 py-0 border rounded-full ${
                                  log.action === "taken"
                                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25"
                                    : log.action === "missed"
                                    ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25"
                                    : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25"
                                }`}
                              >
                                {log.action}
                              </Badge>
                              <span className="editorial-mono editorial-tabular text-[10px] text-muted-foreground">
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
                                  className="text-[10px] font-medium px-2 py-0 h-4 bg-primary/10 text-primary border border-primary/20 rounded-full"
                                >
                                  {patients.find((p) => p.id === log.patientId)?.name || "Dependent"}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 mt-3 sm:mt-0 pt-3 sm:pt-0 border-t border-border/50 sm:border-0">
                          <div className="text-right">
                            <p className="editorial-mono text-[9px] text-muted-foreground mb-0.5">
                              Logged at
                            </p>
                            <p className="editorial-tabular text-[14px] font-medium text-foreground">
                              {toDate(log.actionTime).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDelete(log.id)}
                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-all active:scale-95"
                            title="Undo / Delete Record"
                          >
                            <Trash2 size={15} />
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
                className="rounded-full w-full sm:w-auto h-11 px-8 font-medium text-xs border-border text-foreground hover:bg-secondary active:scale-95"
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
