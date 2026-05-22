import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Camera, Plus, History, Search, Pill, Bell, AlertTriangle, Package2, Users, User, Plane, Heart, FileText, Check, X, Sparkles, Sun, Moon, Cloud, Sunrise, ShieldAlert } from "@/lib/icons";
import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";
import { useEffect, useState, useMemo, useCallback } from "react";
import { toDate } from "@/lib/utils";
import { toast } from "sonner";
import AchievementOverlay from "@/components/AchievementOverlay";
import { DashboardBanner } from "@/components/DashboardBanner";
import { FeatureSlideshow } from "@/components/FeatureSlideshow";
import { calculateRefillStatus, RefillStatus } from "@/services/refillService";
import { calculateNextDose, NextDoseInfo } from "@/services/reminderService";
import { StatusHero } from "@/components/StatusHero";

// New Dashboard Components

import { DailyTimeline } from "@/components/dashboard/DailyTimeline";
import { HealthWidgets } from "@/components/dashboard/HealthWidgets";
import { FamilyStatusDots } from "@/components/dashboard/FamilyStatusDots";
import { AIInsightCard } from "@/components/dashboard/AIInsightCard";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function Dashboard() {
  const navigate = useNavigate();
  const { 
    reminders, 
    doseLogs, 
    userProfile, 
    medicines, 
    isProfessionalMode, 
    patients, 
    selectedPatientId, 
    logDose, 
    setSelectedPatientId,
    wellnessLogs,
    addWellnessLog
  } = useApp();
  const { t } = useTranslation();
  const [showAchievement, setShowAchievement] = useState(false);

  const matchPatient = useCallback((pid: string | null | undefined) => (pid || null) === (selectedPatientId || null), [selectedPatientId]);

  const scopedMedicines = useMemo(() => medicines.filter(m => matchPatient((m as any).patientId)), [medicines, matchPatient]);
  const scopedReminders = useMemo(() => reminders.filter(r => matchPatient(r.patientId)), [reminders, matchPatient]);
  const scopedDoseLogs = useMemo(() => doseLogs.filter(l => matchPatient(l.patientId)), [doseLogs, matchPatient]);
  const scopedWellnessLogs = useMemo(() => wellnessLogs.filter(l => matchPatient(l.patientId)), [wellnessLogs, matchPatient]);

  const refillStatuses = useMemo(() => {
    return scopedMedicines
      .map(m => calculateRefillStatus(m, scopedReminders))
      .filter((s): s is RefillStatus => s !== null && s.isLow);
  }, [scopedMedicines, scopedReminders]);

  const nextDose = useMemo(() => {
    return calculateNextDose(scopedReminders, scopedDoseLogs);
  }, [scopedReminders, scopedDoseLogs]);

  const greetingInfo = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 5) return { text: "Good late night", icon: Moon, color: "text-indigo-400" };
    if (hour < 12) return { text: t("dashboard.good_morning", "Good morning"), icon: Sunrise, color: "text-amber-500" };
    if (hour < 17) return { text: t("dashboard.good_afternoon", "Good afternoon"), icon: Sun, color: "text-orange-500" };
    if (hour < 21) return { text: t("dashboard.good_evening", "Good evening"), icon: Cloud, color: "text-blue-400" };
    return { text: "Good night", icon: Moon, color: "text-indigo-500" };
  }, [t]);

  const quickActions = [
    { icon: Camera, label: t("dashboard.quick_scan"), to: "/scan", color: "bg-primary text-primary-foreground", description: "AI Recognition" },
    { icon: Users, label: isProfessionalMode ? "Patient Hub" : "Family Hub", to: "/family", color: "bg-success/10 border-success/20 text-success" },
    { icon: Heart, label: "Wellness", to: "/wellness", color: "bg-destructive/10 border-destructive/20 text-destructive" },
    { icon: Plane, label: "Travel", to: "/travel", color: "bg-blue-500/10 border-blue-500/20 text-blue-600" },
    { icon: ShieldAlert, label: "Safety Check", to: "/interactions", color: "bg-warning/10 border-warning/20 text-warning-foreground dark:text-warning" },
    { icon: Bell, label: "Reminders", to: "/reminders", color: "bg-amber-500/10 border-amber-500/20 text-amber-600" },
    { icon: History, label: "History", to: "/history", color: "bg-accent border-accent/60 text-accent-foreground" },
    { icon: FileText, label: "Reports", to: "/report", color: "bg-indigo-500/10 border-indigo-500/20 text-indigo-500" },
  ];

  const todayReminders = scopedReminders.filter((r) => r.enabled);
  
  const expectedDosesToday = useMemo(() => {
    let count = 0;
    const todayNum = new Date().getDay();
    todayReminders.forEach(r => {
      if (r.repeatSchedule === "custom" && r.repeatDays && r.repeatDays.length > 0) {
        if (!r.repeatDays.includes(todayNum)) return;
      }
      if (r.repeatSchedule === "weekly") {
        if (r.repeatDays && r.repeatDays.length > 0) {
          if (!r.repeatDays.includes(todayNum)) return;
        } else {
          const createdDay = new Date(r.createdAt).getDay();
          if (createdDay !== todayNum) return;
        }
      }
      count += r.time.split(",").length;
    });
    return count;
  }, [todayReminders]);

  const takenToday = scopedDoseLogs.filter(
    (l) => l.action === "taken" && new Date(l.actionTime).toDateString() === new Date().toDateString()
  ).length;
  
  const adherencePercent = expectedDosesToday > 0 ? Math.round((takenToday / expectedDosesToday) * 100) : 100;

  useEffect(() => {
    if (expectedDosesToday > 0 && takenToday >= expectedDosesToday) {
      const today = new Date().toDateString();
      const lastCelebrated = localStorage.getItem("last_celebration_date");
      
      if (lastCelebrated !== today) {
        setShowAchievement(true);
        localStorage.setItem("last_celebration_date", today);
      }
    }
  }, [takenToday, expectedDosesToday]);

  // scheduledTime is the exact ISO datetime for the specific dose slot being actioned,
  // provided by DailyTimeline so each slot in a multi-dose reminder is tracked individually.
  const handleAction = async (reminder: any, action: "taken" | "skipped", scheduledTime: string) => {
    try {
      await logDose({
        reminderId: reminder.id,
        medicineName: reminder.medicineName,
        dose: reminder.dose,
        scheduledTime,
        action,
      });
      toast.success(action === "taken" ? "Dose logged!" : "Dose skipped.");
    } catch (error) {
      toast.error("Failed to log dose");
    }
  };

  return (
    <div className="px-4 pt-8 pb-24">
      <AchievementOverlay 
        open={showAchievement}
        onClose={() => setShowAchievement(false)}
        title="Perfect Day!"
        subtitle="You've taken all your scheduled medications for today. Keep up the great work!"
        emoji="🏆"
      />
      
      {/* 1. Greeting & Search */}
      <motion.div 
        variants={container} 
        initial="hidden" 
        animate="show" 
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <greetingInfo.icon size={16} className={greetingInfo.color} />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-70">
                {greetingInfo.text}
              </span>
            </div>
            <motion.h1 
              variants={item}
              className="text-3xl font-black tracking-tight text-foreground leading-none"
            >
              Hi, <span className="text-primary">{userProfile?.name?.split(" ")[0] || t("dashboard.greeting_there")}</span>
            </motion.h1>
          </div>
          {selectedPatientId ? (
             <motion.button 
               whileTap={{ scale: 0.9 }}
               onClick={() => setSelectedPatientId(null)}
               className="flex flex-col items-center gap-1.5"
             >
               <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
                 <User size={20} />
               </div>
               <span className="text-[10px] font-bold uppercase text-primary tracking-wider">Switch</span>
             </motion.button>
          ) : (
             <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center text-accent-foreground font-black border border-border shadow-sm">
                {userProfile?.name?.charAt(0) || "U"}
             </div>
          )}
        </div>
        
        {/* Circle of Care (Family Status) */}
        {(isProfessionalMode || patients.length > 0) && (
          <FamilyStatusDots 
            patients={patients} 
            selectedId={selectedPatientId} 
            onSelect={setSelectedPatientId} 
          />
        )}
      </motion.div>

      {/* 2. Combined Hero Section */}
      <StatusHero 
        nextDose={nextDose}
        takenToday={takenToday}
        totalToday={expectedDosesToday}
        onNextDoseClick={() => navigate("/reminders")}
        onProgressClick={() => navigate("/history")}
      />

      {/* 3. AI Health Insight Card */}
      <AIInsightCard adherencePercent={adherencePercent} />

      {/* 4. Critical Alerts (Conditional) */}
      {refillStatuses.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-8 space-y-3"
        >
          <h2 className="section-title flex items-center gap-2 text-warning">
            <AlertTriangle size={14} />
            Critical Refills
          </h2>
          {refillStatuses.map(status => (
            <div 
              key={status.medicineId}
              className="glass-card border-warning/30 bg-warning/5 p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center text-warning">
                  <Package2 size={20} />
                </div>
                <div>
                   <p className="text-sm font-bold text-foreground">{status.medicineName}</p>
                   <p className="text-[10px] font-bold text-warning uppercase tracking-wider">
                     {status.daysRemaining} days remaining
                   </p>
                </div>
              </div>
              <button 
                onClick={() => navigate(`/medicine/${encodeURIComponent(status.medicineName)}`)}
                className="bg-warning text-warning-foreground text-[10px] font-bold px-4 py-2 rounded-lg uppercase tracking-wider"
              >
                Refill
              </button>
            </div>
          ))}
        </motion.div>
      )}

      {/* 5. Daily Timeline (Reminders) */}
      <DailyTimeline 
        reminders={todayReminders}
        doseLogs={scopedDoseLogs}
        onAction={handleAction}
      />

      {/* 6. Health Widgets (Water/Mood) */}
      <HealthWidgets 
        wellnessLogs={scopedWellnessLogs}
        onAddLog={(type, data) => addWellnessLog({ type, data, patientId: selectedPatientId })}
      />

      {/* 7. Bento Grid Quick Actions */}
      <div className="mb-10">
        <h2 className="section-title flex items-center gap-2">
          <Plus size={14} />
          Tools & Actions
        </h2>
        <div className="grid grid-cols-4 grid-rows-4 gap-3 h-[420px]">
          {/* Large Card: Quick Scan */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(quickActions[0].to)}
            className={`col-span-2 row-span-2 rounded-[2rem] p-6 flex flex-col justify-between items-start text-left relative overflow-hidden ${quickActions[0].color} shadow-lg shadow-primary/20`}
          >
            <div className="absolute top-[-10%] right-[-10%] w-32 h-32 bg-white/20 rounded-full blur-2xl" />
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
               <Camera size={28} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider opacity-70 mb-1">{quickActions[0].description}</p>
              <h3 className="text-xl font-black leading-tight">{quickActions[0].label}</h3>
            </div>
          </motion.button>

          {/* Medium Card: Family Hub */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(quickActions[1].to)}
            className={`col-span-2 row-span-1 rounded-[1.5rem] p-4 flex items-center gap-4 border ${quickActions[1].color}`}
          >
            <div className="p-2.5 bg-success/20 rounded-xl">
               <Users size={20} />
            </div>
            <span className="font-bold text-sm tracking-tight">{quickActions[1].label}</span>
          </motion.button>

          {/* Small Cards Row 2 */}
          {quickActions.slice(2, 4).map((action) => (
            <motion.button
              key={action.label}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(action.to)}
              className={`col-span-1 row-span-1 rounded-[1.25rem] border ${action.color} flex flex-col items-center justify-center gap-1.5`}
            >
              <action.icon size={20} />
              <span className="text-[9px] font-bold uppercase tracking-wider">{action.label}</span>
            </motion.button>
          ))}

          {/* Row 3: Safety Check (2x1) and Reminders (2x1) */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(quickActions[4].to)}
            className={`col-span-2 row-span-1 rounded-[1.5rem] p-4 flex items-center gap-4 border ${quickActions[4].color}`}
          >
            <div className="p-2.5 bg-warning/20 rounded-xl">
               <ShieldAlert size={20} className="text-warning-foreground dark:text-warning" />
            </div>
            <span className="font-bold text-sm tracking-tight">{quickActions[4].label}</span>
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(quickActions[5].to)}
            className={`col-span-2 row-span-1 rounded-[1.5rem] p-4 flex items-center gap-4 border ${quickActions[5].color}`}
          >
            <div className="p-2.5 bg-white/10 rounded-xl">
               <Bell size={20} />
            </div>
            <span className="font-bold text-sm tracking-tight">{quickActions[5].label}</span>
          </motion.button>

          {/* Row 4: History (2x1) and Reports (2x1) */}
          {quickActions.slice(6, 8).map((action) => (
            <motion.button
              key={action.label}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(action.to)}
              className={`col-span-2 row-span-1 rounded-[1.5rem] p-4 flex items-center gap-4 border ${action.color}`}
            >
              <div className="p-2.5 bg-white/10 rounded-xl">
                 <action.icon size={20} />
              </div>
              <span className="font-bold text-sm tracking-tight">{action.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* 8. Wellness Pulse */}
      <DashboardBanner />

      {/* 9. Discover / Slideshow */}
      <div className="mb-8">
        <h2 className="section-title flex items-center gap-2">
          <Sparkles size={14} />
          Discover & Learn
        </h2>
        <FeatureSlideshow />
      </div>

      {/* 10. Disclaimer */}
      <div className="mt-4 rounded-2xl border border-warning/20 bg-warning/5 p-5 mb-8">
        <p className="text-[10px] text-warning/80 leading-relaxed flex items-start gap-3 font-medium uppercase tracking-wide">
          <span className="shrink-0 text-xs">⚠️</span>
          <span>{t("dashboard.disclaimer")}</span>
        </p>
      </div>
    </div>
  );
}
