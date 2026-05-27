import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { useApp } from "@/contexts/AppContext";
import {
  FileText,
  Printer,
  Download,
  TrendingUp,
  Activity,
  Calendar,
  Sparkles,
  Loader2,
  Info,
  CheckCircle2,
  ArrowRight,
  Share2,
  Eye,
  X,
  Smile,
  Frown,
  Minus,
  Zap,
  Brain,
  Heart,
} from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { aiApi } from "@/services/api";
import { VitalityTrends2D } from "@/components/wellness/VitalityTrends2D";
import { format, subDays, isSameDay } from "date-fns";
import { toDate } from "@/lib/utils";
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MedicalReportContent } from "@/components/MedicalReportContent";
import { toast } from "sonner";
import { usePatientScope } from "@/hooks/usePatientScope";
import { NativePdf, NativeReportData } from "@/plugins/nativePdf";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function ReportPage() {
  const { selectedPatientId } = useApp();
  const [loading, setLoading] = useState(false);

  interface WellnessInsight {
    summary?: string;
    dosagePatterns?: string;
    lifestyleAnalysis?: string;
    insights?: string[];
    actionItems?: string[];
  }
  const [insights, setInsights] = useState<WellnessInsight | null>(null);
  const lastFetchKey = useRef<string>("");

  const {
    resolvedPatient,
    scopedDoseLogs,
    scopedWellnessLogs,
    scopedMedicines,
  } = usePatientScope();
  const patientName = resolvedPatient.name;
  const patientAge = resolvedPatient.age ? `${resolvedPatient.age} yrs` : "N/A";
  const patientGender = resolvedPatient.gender ?? "N/A";

  // Prepare Chart Data (Last 7 Days)
  const chartData = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dayStr = format(date, "MMM dd");

      const dayLogs = scopedDoseLogs.filter((l) =>
        isSameDay(toDate(l.actionTime), date)
      );
      const taken = dayLogs.filter((l) => l.action === "taken").length;
      const total = dayLogs.length;
      const adherence = total > 0 ? (taken / total) * 100 : 100;

      // Average wellness logs if multiple exist for the day
      const dayWellnessLogs = scopedWellnessLogs.filter(
        (l) => l.type === "symptom" && isSameDay(toDate(l.timestamp), date)
      );

      let energy: number | null = null;
      let mood: number | null = null;

      if (dayWellnessLogs.length > 0) {
        const sumEnergy = dayWellnessLogs.reduce(
          (acc, l) => acc + (Number(l.data?.energy) || 0),
          0
        );
        const sumMood = dayWellnessLogs.reduce(
          (acc, l) => acc + (Number(l.data?.mood) || 0),
          0
        );
        energy = (sumEnergy / dayWellnessLogs.length) * 20;
        mood = (sumMood / dayWellnessLogs.length) * 20;
      }

      return { name: dayStr, adherence, energy, mood };
    });
  }, [scopedDoseLogs, scopedWellnessLogs]);

  const adherenceScore =
    Math.round(chartData.reduce((acc, d) => acc + d.adherence, 0) / 7) || 0;

  // Emotional Wellness Statistics (last 7 days)
  const emotionalStats = useMemo(() => {
    const last7 = Array.from({ length: 7 }).map((_, i) =>
      subDays(new Date(), 6 - i)
    );
    const symptomLogs = scopedWellnessLogs.filter((l) => l.type === "symptom");

    const logsLast7 = symptomLogs.filter((l) => {
      const d = toDate(l.timestamp);
      return last7.some((day) => isSameDay(d, day));
    });

    const daysWithData = last7.filter((day) =>
      symptomLogs.some((l) => isSameDay(toDate(l.timestamp), day))
    ).length;

    if (logsLast7.length === 0) return null;

    const avgMood =
      logsLast7.reduce((acc, l) => acc + (Number(l.data?.mood) || 0), 0) /
      logsLast7.length;
    const avgEnergy =
      logsLast7.reduce((acc, l) => acc + (Number(l.data?.energy) || 0), 0) /
      logsLast7.length;

    // Tally symptom frequency
    const symptomCount: Record<string, number> = {};
    logsLast7.forEach((l) => {
      const syms = l.data?.symptoms as string[] | undefined;
      if (syms)
        syms.forEach((s) => {
          symptomCount[s] = (symptomCount[s] || 0) + 1;
        });
    });
    const topSymptoms = Object.entries(symptomCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, count]) => ({ name, count }));

    const moodLabel =
      avgMood >= 3.5 ? "Positive" : avgMood >= 2.5 ? "Neutral" : "Low";
    const moodColor =
      avgMood >= 3.5
        ? "text-success"
        : avgMood >= 2.5
        ? "text-warning"
        : "text-destructive";
    const moodBg =
      avgMood >= 3.5
        ? "bg-success/10"
        : avgMood >= 2.5
        ? "bg-warning/10"
        : "bg-destructive/10";

    return {
      avgMood,
      avgEnergy,
      topSymptoms,
      daysWithData,
      moodLabel,
      moodColor,
      moodBg,
    };
  }, [scopedWellnessLogs]);

  const [showPreview, setShowPreview] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  const fetchInsights = useCallback(async () => {
    if (scopedDoseLogs.length === 0 && scopedMedicines.length === 0) return;
    setLoading(true);
    try {
      const res = await aiApi.getWellnessInsight({
        doseLogs: scopedDoseLogs.slice(0, 70),
        wellnessLogs: scopedWellnessLogs.slice(0, 50),
        medicines: scopedMedicines.filter((m) => !m.isConflict),
        patientContext: {
          name: resolvedPatient.name,
          age: resolvedPatient.age,
          gender: resolvedPatient.gender,
          type: resolvedPatient.type,
          conditions: resolvedPatient.conditions,
          allergies: resolvedPatient.allergies,
        },
      });
      setInsights(res);
    } catch (err) {
      console.error("Insight fetch failed", err);
    } finally {
      setLoading(false);
    }
  }, [scopedDoseLogs, scopedWellnessLogs, scopedMedicines]);

  useEffect(() => {
    const fetchKey = `${selectedPatientId}-${scopedDoseLogs.length}-${scopedMedicines.length}`;
    if (fetchKey === lastFetchKey.current) return;
    lastFetchKey.current = fetchKey;

    fetchInsights();
  }, [
    selectedPatientId,
    scopedDoseLogs.length,
    scopedMedicines.length,
    fetchInsights,
  ]);

  const handlePrint = () => {
    window.print();
  };

  const [downloading, setDownloading] = useState(false);

  const handleDownloadPDF = async () => {
    if (downloading) return;
    setDownloading(true);
    const toastId = toast.loading("Generating professional PDF report...");

    // On native platforms: use the native PDF engine (no DOM snapshot, low memory)
    if (Capacitor.isNativePlatform()) {
      try {
        const reportData: NativeReportData = {
          patientName,
          patientAge,
          dateRange: `${format(subDays(new Date(), 6), "MMM d")}–${format(
            new Date(),
            "MMM d, yyyy"
          )}`,
          adherenceScore,
          chartData: chartData.map((d) => ({
            name: d.name,
            adherence: d.adherence,
            mood: d.mood ?? null,
            energy: d.energy ?? null,
          })),
          medicines: scopedMedicines.map((m) => ({
            name: m.name,
            dosage: m.dosage,
            daysRemaining: undefined,
          })),
          topSymptoms: emotionalStats?.topSymptoms ?? [],
          averageMood: emotionalStats?.avgMood ?? 0,
          averageEnergy: emotionalStats?.avgEnergy ?? 0,
          generatedAt: new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
        };

        const { fileUri } = await NativePdf.generateReport(reportData);
        await Share.share({
          title: `Dawa Lens Report - ${patientName}`,
          url: fileUri,
        });
        toast.success("Report generated successfully!", { id: toastId });
        setDownloading(false);
        return;
      } catch (nativePdfErr) {
        console.warn(
          "[ReportPage] Native PDF failed, falling back to html2canvas:",
          nativePdfErr
        );
        // Fall through to existing html2canvas path
      }
    }

    try {
      // Find the element to capture (the hidden print template)
      const element = document.getElementById(
        "medical-report-content-download"
      );
      if (!element) throw new Error("Report content not found");

      // Wait a bit to ensure everything is rendered
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Set options for html2canvas - reduce scale on mobile to save memory
      const scale = Capacitor.getPlatform() === "web" ? 2 : 1.5;

      const canvas = await html2canvas(element, {
        scale: scale,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: 800, // Fixed width for consistent rendering
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95); // Use JPEG for better compression/memory
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = imgWidth / pdfWidth;
      const imgPdfHeight = imgHeight / ratio;

      let heightLeft = imgPdfHeight;
      let position = 0;

      // Add first page
      pdf.addImage(
        imgData,
        "JPEG",
        0,
        position,
        pdfWidth,
        imgPdfHeight,
        undefined,
        "FAST"
      );
      heightLeft -= pdfHeight;

      // Add subsequent pages if content is longer than one page
      while (heightLeft > 0) {
        position = heightLeft - imgPdfHeight;
        pdf.addPage();
        pdf.addImage(
          imgData,
          "JPEG",
          0,
          position,
          pdfWidth,
          imgPdfHeight,
          undefined,
          "FAST"
        );
        heightLeft -= pdfHeight;
      }

      // Sanitize filename: remove characters that might cause issues on some file systems
      const safePatientName = patientName
        .replace(/[^a-z0-9]/gi, "-")
        .replace(/-+/g, "-");
      const fileName = `DawaLens-Report-${safePatientName}-${format(
        new Date(),
        "yyyyMMdd"
      )}.pdf`;

      if (Capacitor.isNativePlatform()) {
        try {
          // Handle Capacitor download
          const pdfBase64 = pdf.output("datauristring").split(",")[1];

          const savedFile = await Filesystem.writeFile({
            path: fileName,
            data: pdfBase64,
            directory: Directory.Cache,
          });

          await Share.share({
            title: "Care Report",
            text: `Medical Report for ${patientName}`,
            url: savedFile.uri,
            dialogTitle: "Save or Share Report",
          });
        } catch (fsError) {
          console.error("FileSystem/Share error:", fsError);
          // Fallback to basic download if share fails
          pdf.save(fileName);
        }
      } else {
        // Handle Web download
        pdf.save(fileName);
      }

      toast.success("Care Report generated successfully!", { id: toastId });
    } catch (err) {
      console.error("PDF generation failed", err);
      toast.error("Failed to generate PDF report. Please try again.", {
        id: toastId,
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!insights) return;

    const shareText =
      `Medical Report Summary for ${patientName}\n` +
      `Date: ${format(new Date(), "MMMM do, yyyy")}\n` +
      `Adherence Score: ${adherenceScore}%\n\n` +
      `Summary: ${insights.summary}\n\n` +
      `Action Items:\n${
        insights.actionItems?.map((item: string) => `- ${item}`).join("\n") ||
        "None"
      }`;

    try {
      if (isNative) {
        await Share.share({
          title: `Care Report - ${patientName}`,
          text: shareText,
          dialogTitle: "Share Care Report",
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
    <div className="pt-6 pb-28 w-full min-w-0 print:p-0 print:m-0 print:bg-white print:text-black">
      {/* -------------------- WEB VIEW -------------------- */}
      <div className="print:hidden">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-wrap items-start justify-between gap-4"
        >
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Care Report
            </h1>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider opacity-80 mt-1 truncate">
              Health summary for {patientName}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(true)}
              className="rounded-xl h-10 border-border/50 shadow-sm gap-2"
            >
              <Eye size={15} />
              <span className="hidden xs:inline">Preview</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="rounded-xl w-10 h-10 border-border/50 shadow-sm text-primary"
              title="Download PDF Report"
            >
              {downloading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleShare}
              className="rounded-xl w-10 h-10 border-border/50 shadow-sm"
              title="Share Report"
            >
              <Share2 size={16} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrint}
              className="rounded-xl w-10 h-10 border-border/50 shadow-sm hidden sm:flex"
              title="Print Medical Report"
            >
              <Printer size={16} />
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
          <motion.div
            variants={item}
            className="p-8 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/10 relative overflow-hidden transition-all hover:scale-[1.01]"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Activity size={96} />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-1">
              7-Day Adherence Rating
            </p>
            <div className="flex items-end gap-3">
              <h2 className="text-5xl font-bold tracking-tight">
                {adherenceScore}%
              </h2>
              <p className="text-[10px] font-bold mb-2.5 opacity-90 uppercase tracking-widest text-primary-foreground/70">
                Overall Score
              </p>
            </div>
            <p className="mt-5 text-[12px] font-medium opacity-80 leading-relaxed max-w-[260px]">
              {adherenceScore >= 90
                ? "Excellent tracking consistency. Keep it up!"
                : adherenceScore >= 70
                ? "Good tracking, but some doses were missed."
                : "Adherence is below average. Consider setting extra reminders."}
            </p>
          </motion.div>

          {/* Charts Section */}
          <motion.div variants={item} className="premium-card">
            <h3 className="section-title flex items-center gap-2">
              <TrendingUp size={14} className="text-primary" /> Vitality Trends
            </h3>
            <div className="w-full mt-4 relative">
              {chartData.every(
                (d) => d.energy === null && d.adherence === 100
              ) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-accent/5 z-10 rounded-2xl border border-dashed border-border/50">
                  <Activity
                    size={32}
                    className="text-muted-foreground/30 mb-3"
                  />
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                    No activity data yet
                  </p>
                  <p className="text-[8px] font-bold text-muted-foreground/40 mt-1 uppercase tracking-tighter">
                    Log your wellness in the Wellness Hub
                  </p>
                </div>
              )}
              <VitalityTrends2D data={chartData} />
            </div>
          </motion.div>

          {/* Emotional Wellness Summary */}
          {emotionalStats && (
            <motion.div variants={item} className="premium-card">
              <div className="flex items-center justify-between mb-6">
                <h3 className="section-title flex items-center gap-2 mb-0">
                  <Heart size={14} className="text-destructive" /> Emotional
                  Wellness
                </h3>
                <span
                  className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${emotionalStats.moodBg} ${emotionalStats.moodColor}`}
                >
                  {emotionalStats.moodLabel}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Avg Mood */}
                <div className="p-4 rounded-2xl bg-success/5 border border-success/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Smile size={14} className="text-success" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-success/70">
                      Avg Mood
                    </p>
                  </div>
                  <p className="text-2xl font-black text-foreground">
                    {emotionalStats.avgMood.toFixed(1)}
                    <span className="text-xs text-muted-foreground font-bold ml-1">
                      /5
                    </span>
                  </p>
                  <div className="mt-2 flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div
                        key={n}
                        className={`flex-1 h-1.5 rounded-full ${
                          n <= Math.round(emotionalStats.avgMood)
                            ? "bg-success"
                            : "bg-muted/40"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Avg Energy */}
                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap size={14} className="text-primary" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary/70">
                      Avg Energy
                    </p>
                  </div>
                  <p className="text-2xl font-black text-foreground">
                    {emotionalStats.avgEnergy.toFixed(1)}
                    <span className="text-xs text-muted-foreground font-bold ml-1">
                      /5
                    </span>
                  </p>
                  <div className="mt-2 flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div
                        key={n}
                        className={`flex-1 h-1.5 rounded-full ${
                          n <= Math.round(emotionalStats.avgEnergy)
                            ? "bg-primary"
                            : "bg-muted/40"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Wellness consistency */}
              <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-muted/20 border border-border/40">
                <Brain
                  size={14}
                  className="text-muted-foreground/60 shrink-0"
                />
                <p className="text-xs font-semibold text-muted-foreground">
                  Wellness logged on{" "}
                  <span className="font-black text-foreground">
                    {emotionalStats.daysWithData}
                  </span>{" "}
                  of 7 days this week.
                  {emotionalStats.daysWithData >= 5
                    ? " Excellent consistency!"
                    : emotionalStats.daysWithData >= 3
                    ? " Keep building the habit."
                    : " Try to log daily for better insights."}
                </p>
              </div>

              {/* Top symptoms */}
              {emotionalStats.topSymptoms.length > 0 && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 px-1">
                    Most Reported Symptoms
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {emotionalStats.topSymptoms.map(({ name, count }) => (
                      <div
                        key={name}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/50 border border-border/40"
                      >
                        <span className="text-xs font-bold text-foreground">
                          {name}
                        </span>
                        <span className="text-[9px] font-black text-muted-foreground bg-muted/60 px-1 rounded">
                          {count}×
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* AI Clinical Summary */}
          <motion.div variants={item} className="premium-card">
            <div className="flex items-center justify-between mb-6">
              <h3 className="section-title flex items-center gap-2 mb-0">
                <Sparkles size={14} className="text-primary" /> AI Clinical
                Assessment
              </h3>
              {loading && (
                <Loader2
                  size={14}
                  className="animate-spin text-primary opacity-50"
                />
              )}
            </div>

            {insights ? (
              <div className="space-y-6">
                <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10 relative">
                  <div className="text-sm font-semibold text-foreground leading-relaxed prose prose-sm max-w-none">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => (
                          <p className="mb-2 last:mb-0">{children}</p>
                        ),
                      }}
                    >
                      {insights.summary}
                    </ReactMarkdown>
                  </div>
                  {insights.dosagePatterns && (
                    <div className="text-xs font-medium text-muted-foreground mt-3 pt-3 border-t border-primary/10 prose prose-sm max-w-none">
                      <strong className="text-foreground">
                        Dosage Patterns:
                      </strong>
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => (
                            <span className="ml-1">{children}</span>
                          ),
                        }}
                      >
                        {insights.dosagePatterns}
                      </ReactMarkdown>
                    </div>
                  )}
                  {insights.lifestyleAnalysis && (
                    <div className="text-xs font-medium text-muted-foreground mt-3 pt-3 border-t border-primary/10 prose prose-sm max-w-none">
                      <strong className="text-foreground">
                        Lifestyle & Symptoms:
                      </strong>
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => (
                            <span className="ml-1">{children}</span>
                          ),
                        }}
                      >
                        {insights.lifestyleAnalysis}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>

                {insights.insights && insights.insights.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-2 px-1">
                      Observed Patterns
                    </h4>
                    {insights.insights.map((insight: string, idx: number) => (
                      <div
                        key={idx}
                        className="flex gap-3 items-start p-3.5 rounded-xl bg-accent/30 border border-border/40 hover:bg-accent/50 transition-colors"
                      >
                        <div className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0 mt-0.5">
                          <CheckCircle2 size={12} className="text-indigo-500" />
                        </div>
                        <div className="text-xs text-foreground leading-relaxed font-medium prose prose-sm max-w-none">
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => (
                                <p className="m-0">{children}</p>
                              ),
                            }}
                          >
                            {insight}
                          </ReactMarkdown>
                        </div>
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
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-warning/5 border border-warning/20"
                      >
                        <div className="text-xs font-semibold text-warning-foreground leading-snug pr-4 prose prose-sm max-w-none">
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => (
                                <p className="m-0">{children}</p>
                              ),
                            }}
                          >
                            {action}
                          </ReactMarkdown>
                        </div>
                        <ArrowRight
                          size={14}
                          className="text-warning shrink-0"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-14 text-center opacity-40 bg-accent/20 rounded-2xl border border-dashed border-border/50">
                <Info size={32} className="mx-auto mb-4 opacity-50" />
                <p className="text-[10px] font-black uppercase tracking-widest">
                  {scopedDoseLogs.length > 0
                    ? "Generating Clinical Insights..."
                    : "No Data Available Yet"}
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      </div>

      {/* -------------------- PREVIEW DIALOG -------------------- */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 overflow-hidden flex flex-col gap-0 rounded-2xl border-none shadow-2xl">
          <DialogHeader className="p-3 sm:p-4 border-b bg-background flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-[10px] sm:text-sm font-bold uppercase tracking-widest opacity-70 truncate mr-2">
              Report Preview
            </DialogTitle>
            <div className="flex gap-1.5 sm:gap-2 pr-8">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPDF}
                disabled={downloading}
                className="h-8 sm:h-9 px-2 sm:px-3 gap-1.5 sm:gap-2 rounded-xl text-primary"
              >
                {downloading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                <span className="hidden xs:inline text-[10px] sm:text-xs">
                  Download
                </span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="h-8 sm:h-9 px-2 sm:px-3 gap-1.5 sm:gap-2 rounded-xl"
              >
                <Share2 size={14} />
                <span className="hidden xs:inline text-[10px] sm:text-xs">
                  Share
                </span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="h-8 sm:h-9 px-2 sm:px-3 gap-1.5 sm:gap-2 rounded-xl hidden sm:flex"
              >
                <Printer size={14} />
                <span className="text-[10px] sm:text-xs">Print</span>
              </Button>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 bg-white">
            <MedicalReportContent
              patientName={patientName}
              patientGender={patientGender}
              patientAge={patientAge}
              adherenceScore={adherenceScore}
              doseLogs={scopedDoseLogs}
              medicines={scopedMedicines}
              insights={insights}
              wellnessLogs={scopedWellnessLogs}
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* -------------------- HIDDEN DOWNLOAD/PRINT TEMPLATE -------------------- */}
      {/* We use an off-screen container for PDF generation to ensure html2canvas can capture it */}
      <div
        className="fixed -left-[9999px] top-0 w-[800px] bg-white"
        id="medical-report-content-download"
      >
        <MedicalReportContent
          patientName={patientName}
          patientGender={patientGender}
          patientAge={patientAge}
          adherenceScore={adherenceScore}
          doseLogs={scopedDoseLogs}
          medicines={scopedMedicines}
          insights={insights}
          wellnessLogs={scopedWellnessLogs}
        />
      </div>
    </div>
  );
}
