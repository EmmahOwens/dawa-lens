import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Camera, Plus, History, Search, Pill, Bell, AlertTriangle, Package2, Users, User, Plane, Heart, FileText, Check, X, Sparkles } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import AchievementOverlay from "@/components/AchievementOverlay";
import { DashboardBanner } from "@/components/DashboardBanner";
import { FeatureSlideshow } from "@/components/FeatureSlideshow";
import { calculateRefillStatus, RefillStatus } from "@/services/refillService";
import { calculateNextDose, NextDoseInfo } from "@/services/reminderService";
import { StatusHero } from "@/components/StatusHero";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function Dashboard() {
  const navigate = useNavigate();
  const { reminders, doseLogs, userProfile, medicines, isProfessionalMode, patients, selectedPatientId, logDose } = useApp();
  const { t } = useTranslation();
  const [showAchievement, setShowAchievement] = useState(false);

  const refillStatuses = useMemo(() => {
    return medicines
      .map(m => calculateRefillStatus(m, reminders))
      .filter((s): s is RefillStatus => s !== null && s.isLow);
  }, [medicines, reminders]);

  const nextDose = useMemo(() => {
    return calculateNextDose(reminders, doseLogs);
  }, [reminders, doseLogs]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("dashboard.good_morning", "Good morning");
    if (hour < 18) return t("dashboard.good_afternoon", "Good afternoon");
    return t("dashboard.good_evening", "Good evening");
  };

  const quickActions = [
    { 
      icon: Camera, 
      label: t("dashboard.quick_scan"), 
      to: "/scan", 
      color: "bg-primary text-primary-foreground", 
      size: "large",
      description: "AI Recognition"
    },
    { 
      icon: Users, 
      label: isProfessionalMode ? "Patient Hub" : "Family Hub", 
      to: "/family", 
      color: "bg-success/10 border-success/20 text-success",
      size: "medium"
    },
    { 
      icon: Heart, 
      label: "Wellness", 
      to: "/wellness", 
      color: "bg-destructive/10 border-destructive/20 text-destructive",
      size: "small"
    },
    { 
      icon: FileText, 
      label: "Reports", 
      to: "/report", 
      color: "bg-indigo-500/10 border-indigo-500/20 text-indigo-500",
      size: "small"
    },
    { 
      icon: Bell, 
      label: "Reminders", 
      to: "/reminders", 
      color: "bg-amber-500/10 border-amber-500/20 text-amber-600",
      size: "small"
    },
    { 
      icon: History, 
      label: "History", 
      to: "/history", 
      color: "bg-accent border-accent/60 text-accent-foreground",
      size: "small"
    },
  ];

  const todayReminders = reminders.filter((r) => r.enabled);
  const takenToday = doseLogs.filter(
    (l) => l.action === "taken" && new Date(l.actionTime).toDateString() === new Date().toDateString()
  ).length;

  useEffect(() => {
    if (todayReminders.length > 0 && takenToday === todayReminders.length) {
      const today = new Date().toDateString();
      const lastCelebrated = localStorage.getItem("last_celebration_date");
      
      if (lastCelebrated !== today) {
        setShowAchievement(true);
        localStorage.setItem("last_celebration_date", today);
      }
    }
  }, [takenToday, todayReminders.length]);

  const handleAction = async (reminder: any, action: "taken" | "skipped") => {
    try {
      await logDose({
        reminderId: reminder.id,
        medicineName: reminder.medicineName,
        dose: reminder.dose,
        scheduledTime: reminder.time,
        action,
      });
      toast.success(action === "taken" ? "Dose logged!" : "Dose skipped.");
    } catch (error) {
      toast.error("Failed to log dose");
    }
  };

  return (
    <div className="px-4 pt-8 pb-10">
      <AchievementOverlay 
        open={showAchievement}
        onClose={() => setShowAchievement(false)}
        title="Perfect Day!"
        subtitle="You've taken all your scheduled medications for today. Keep up the great work!"
        emoji="🏆"
      />
      
      {/* 1. Greeting */}
      <motion.div 
        variants={container} 
        initial="hidden" 
        animate="show" 
        className="mb-6 flex items-start justify-between"
      >
        <div>
          <motion.p 
            variants={item}
            className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-1 opacity-70"
          >
            {isProfessionalMode ? "Professional Mode" : "Personal Health"}
          </motion.p>
          <motion.h1 
            variants={item}
            className="text-3xl font-black tracking-tight text-foreground leading-none"
          >
            {getGreeting()},<br />
            <motion.span className="text-primary">{userProfile?.name?.split(" ")[0] || t("dashboard.greeting_there")}</motion.span>
          </motion.h1>
        </div>
        {selectedPatientId && (
          <motion.button 
            variants={item}
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate("/family")}
            className="flex flex-col items-center gap-1.5"
          >
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
              <User size={20} />
            </div>
            <span className="text-[10px] font-bold uppercase text-primary tracking-wider">Switch</span>
          </motion.button>
        )}
      </motion.div>

      {/* 2. Combined Hero Section */}
      <StatusHero 
        nextDose={nextDose}
        takenToday={takenToday}
        totalToday={todayReminders.length}
        onNextDoseClick={() => navigate("/reminders")}
        onProgressClick={() => navigate("/history")}
      />

      {/* 3. Critical Alerts (Conditional) */}
      {refillStatuses.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-6 space-y-3"
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

      {/* 4. Actionable Reminders */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title flex items-center gap-2 mb-0">
            <Bell size={14} />
            {t("dashboard.upcoming_reminders")}
          </h2>
          <button onClick={() => navigate("/reminders")} className="text-[10px] font-bold uppercase text-primary tracking-widest hover:underline">
            See All
          </button>
        </div>
        
        {todayReminders.length === 0 ? (
          <div className="premium-card p-10 text-center border-dashed">
            <p className="text-sm text-muted-foreground">{t("dashboard.no_reminders")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayReminders.slice(0, 3).map((r) => {
              const actionToday = doseLogs.find(l => l.reminderId === r.id && new Date(l.actionTime).toDateString() === new Date().toDateString());
              
              if (actionToday) return null;

              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center justify-between rounded-[1.5rem] border border-border/50 bg-card p-4 shadow-sm hover:border-primary/30 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-primary/5 flex items-center justify-center text-primary">
                      <Pill size={20} />
                    </div>
                    <div>
                      <p className="text-[15px] font-bold text-foreground leading-tight">{r.medicineName}</p>
                      <p className="text-xs font-semibold text-muted-foreground mt-0.5">{r.dose} • {r.time}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleAction(r, "taken")} 
                      className="w-10 h-10 rounded-xl bg-success/15 hover:bg-success/25 text-success flex items-center justify-center transition-colors shadow-sm"
                    >
                      <Check size={20} strokeWidth={3} />
                    </button>
                    <button 
                      onClick={() => handleAction(r, "skipped")} 
                      className="w-10 h-10 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive flex items-center justify-center transition-colors shadow-sm"
                    >
                      <X size={20} strokeWidth={2.5} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
            
            {todayReminders.slice(0, 3).every(r => doseLogs.some(l => l.reminderId === r.id && new Date(l.actionTime).toDateString() === new Date().toDateString())) && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 text-center rounded-[2rem] bg-success/10 border border-success/20 text-success">
                <Sparkles size={24} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm font-black uppercase tracking-widest">All caught up! 🎉</p>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* 5. Bento Grid Quick Actions */}
      <div className="mb-8">
        <h2 className="section-title flex items-center gap-2">
          <Plus size={14} />
          Quick Actions
        </h2>
        <div className="grid grid-cols-4 grid-rows-3 gap-3 h-[320px]">
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

          {/* Row 3: Reminders and History (2x1 each) */}
          {quickActions.slice(4).map((action) => (
            <motion.button
              key={action.label}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(action.to)}
              className={`col-span-2 row-span-1 rounded-[1.5rem] p-4 flex items-center gap-4 border ${action.color}`}
            >
              <div className="p-2 bg-white/10 rounded-xl">
                 <action.icon size={20} />
              </div>
              <span className="font-bold text-sm tracking-tight">{action.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* 6. Wellness Pulse */}
      <DashboardBanner />

      {/* 7. Discover / Slideshow */}
      <div className="mb-8">
        <h2 className="section-title flex items-center gap-2">
          <Sparkles size={14} />
          Discover
        </h2>
        <FeatureSlideshow />
      </div>

      {/* 8. Disclaimer */}
      <div className="mt-4 rounded-2xl border border-warning/20 bg-warning/5 p-5 mb-8">
        <p className="text-[10px] text-warning/80 leading-relaxed flex items-start gap-3 font-medium uppercase tracking-wide">
          <span className="shrink-0 text-xs">⚠️</span>
          <span>{t("dashboard.disclaimer")}</span>
        </p>
      </div>
    </div>
  );
}
