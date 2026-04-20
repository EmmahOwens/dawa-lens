import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Camera, Plus, History, Search, Pill, Bell, AlertTriangle, Package2, Users, User, Plane, Heart, FileText, Check, X } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import AchievementOverlay from "@/components/AchievementOverlay";
import { DashboardBanner } from "@/components/DashboardBanner";
import { FeatureSlideshow } from "@/components/FeatureSlideshow";
import { calculateRefillStatus, RefillStatus } from "@/services/refillService";
import { calculateNextDose, NextDoseInfo } from "@/services/reminderService";
import { Clock as ClockIcon } from "lucide-react";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
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

  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // update every min
    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("dashboard.good_morning", "Good morning");
    if (hour < 18) return t("dashboard.good_afternoon", "Good afternoon");
    return t("dashboard.good_evening", "Good evening");
  };

  const quickActions = [
    { icon: Camera, label: t("dashboard.quick_scan"), to: "/scan", color: "bg-primary/10 border-primary/20 text-primary hover:bg-primary/20", ringScale: 1.05 },
    { icon: Users, label: isProfessionalMode ? "Patient Hub" : "Family Hub", to: "/family", color: "bg-success/10 border-success/20 text-success hover:bg-success/20", ringScale: 1 },
    { icon: Heart, label: "Wellness", to: "/wellness", color: "bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive/20", ringScale: 1.1 },
    { icon: FileText, label: "Care Report", to: "/report", color: "bg-indigo-500/10 border-indigo-500/20 text-indigo-500 hover:bg-indigo-500/20", ringScale: 1 },
    { icon: History, label: t("dashboard.quick_history"), to: "/history", color: "bg-accent border-accent/60 text-accent-foreground hover:bg-accent/80", ringScale: 1 },
    { icon: Bell, label: "Add Reminder", to: "/reminders/new", color: "bg-amber-500/10 border-amber-500/20 text-amber-600 hover:bg-amber-500/20", ringScale: 1.1 },
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
    <div className="px-4 pt-12 pb-4">
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
        className="mb-8 flex items-start justify-between"
      >
        <div>
          <motion.h1 
            variants={item}
            className="text-3xl font-bold tracking-tight text-foreground leading-tight"
          >
            {getGreeting()},<br />
            <motion.span 
              initial={{ opacity: 0, filter: "blur(4px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              transition={{ delay: 0.3, duration: 0.8 }}
              className="text-primary inline-block"
            >
              {userProfile?.name?.split(" ")[0] || t("dashboard.greeting_there")}
            </motion.span>
          </motion.h1>
          <motion.p 
            variants={item}
            className="mt-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider opacity-80"
          >
            {isProfessionalMode ? "CHW Professional Dashboard" : t("dashboard.subtitle")}
          </motion.p>
        </div>
        {selectedPatientId && (
          <motion.button 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            onClick={() => navigate("/family")}
            className="mt-1 flex flex-col items-center gap-1.5"
          >
            <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm hover:bg-primary/20 transition-colors">
              <User size={18} />
            </div>
            <span className="text-[10px] font-bold uppercase text-primary tracking-wider">Switch</span>
          </motion.button>
        )}
      </motion.div>

      {/* 1.5. Next Dose Hero Card */}
      {nextDose && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-6 rounded-[2rem] bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20 relative overflow-hidden active:scale-[0.98] transition-transform"
          onClick={() => navigate("/history")}
        >
          <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                <ClockIcon size={18} className="text-white" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Next Dose Due</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-4xl font-black tracking-tight mb-1">
                  {nextDose.timeUntil}
                </h2>
                <p className="text-sm font-semibold opacity-90">
                  {nextDose.reminder.medicineName} • {nextDose.reminder.time}
                </p>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 rounded-full backdrop-blur-md border border-white/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white">Live</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* 2. Quick Actions Grid */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 grid grid-cols-3 gap-3"
      >
        {quickActions.map((action) => (
          <motion.div key={action.label} whileHover={{ scale: 1.05 }} whileTap={{ scale: action.ringScale || 0.95 }}>
            <button 
              onClick={() => navigate(action.to)}
              className={`w-full flex flex-col items-center justify-center p-3 rounded-2xl border ${action.color} transition-all shadow-[0_4px_12px_rgba(0,0,0,0.02)]`}
            >
              <action.icon size={22} className="mb-2" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-center line-clamp-1">{action.label}</span>
            </button>
          </motion.div>
        ))}
      </motion.div>

      {/* 3. Actionable Reminders */}
      <div className="mb-8">
        <h2 className="section-title flex items-center gap-2">
          <Bell size={14} />
          {t("dashboard.upcoming_reminders")}
        </h2>
        {todayReminders.length === 0 ? (
          <div className="premium-card p-10 text-center">
            <p className="text-sm text-muted-foreground">{t("dashboard.no_reminders")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayReminders.slice(0, 5).map((r) => {
              const actionToday = doseLogs.find(l => l.reminderId === r.id && new Date(l.actionTime).toDateString() === new Date().toDateString());
              
              if (actionToday) return null; // Hide if already taken or skipped

              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between rounded-2xl border border-border/50 bg-card p-4 shadow-sm transition-all hover:border-primary/20 hover:bg-accent/5"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Pill size={18} />
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
            
            {/* If all displayed are taken/skipped, show a small success message */}
            {todayReminders.slice(0, 5).every(r => doseLogs.some(l => l.reminderId === r.id && new Date(l.actionTime).toDateString() === new Date().toDateString())) && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 text-center rounded-2xl bg-success/10 border border-success/20 text-success">
                <p className="text-sm font-bold uppercase tracking-wider">All caught up! 🎉</p>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* 4. Stats or Professional Hub */}
      {isProfessionalMode && !selectedPatientId ? (
        <motion.div 
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="mb-8 space-y-4"
        >
          <div className="premium-card flex items-center justify-between">
            <div>
              <p className="section-title mb-1">Managed Patients</p>
              <h2 className="text-3xl font-bold text-foreground">{patients.length}</h2>
            </div>
            <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center text-success">
              <Users size={24} />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-warning/5 border border-warning/20">
               <p className="text-[10px] font-bold uppercase tracking-wider text-warning mb-1">Refills Needed</p>
               <h3 className="text-2xl font-bold text-foreground">
                 {medicines.filter(m => calculateRefillStatus(m, reminders)?.isLow).length}
               </h3>
            </div>
            <div className="p-5 rounded-2xl bg-destructive/5 border border-destructive/20">
               <p className="text-[10px] font-bold uppercase tracking-wider text-destructive mb-1">Missed (24h)</p>
               <h3 className="text-2xl font-bold text-foreground">
                 {doseLogs.filter(log => 
                   log.action === "skipped" && 
                   new Date(log.actionTime).getTime() > Date.now() - 24 * 60 * 60 * 1000
                 ).length}
               </h3>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8 premium-card relative overflow-hidden group flex items-center justify-between"
        >
          <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
          
          <div className="z-10 flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                <Pill size={18} />
              </div>
              <span className="text-xs font-semibold tracking-tight text-muted-foreground">
                {selectedPatientId ? `${patients.find(p => p.id === selectedPatientId)?.name}'s Progress` : t("dashboard.todays_progress")}
              </span>
            </div>
            <div className="flex items-end gap-2 text-foreground">
              <span className="text-5xl font-bold tracking-tight">{takenToday}</span>
              <span className="mb-1.5 text-sm font-semibold opacity-40">/ {todayReminders.length} {t("dashboard.doses")}</span>
            </div>
          </div>

          <div className="relative z-10 w-24 h-24 flex items-center justify-center">
            {/* Background Track */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="transparent" stroke="currentColor" strokeWidth="10" className="text-muted/50" />
              {/* Animated Progress Ring */}
              <motion.circle
                cx="50" cy="50" r="42" fill="transparent" stroke="url(#gradient)" strokeWidth="10" strokeLinecap="round"
                initial={{ strokeDasharray: "263.9", strokeDashoffset: "263.9" }}
                animate={{ 
                  strokeDashoffset: todayReminders.length 
                    ? 263.9 - ((takenToday / todayReminders.length) * 263.9) 
                    : 263.9 
                }}
                transition={{ duration: 1.5, ease: "anticipate", delay: 0.2 }}
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="hsl(var(--primary))" />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
                </linearGradient>
              </defs>
            </svg>
            {takenToday === todayReminders.length && todayReminders.length > 0 && (
              <motion.div 
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.2, type: "spring" }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <span className="text-xl">🏆</span>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}

      {/* 5. Dashboard Banner */}
      <DashboardBanner />

      {/* 6. Refill Alerts */}
      {refillStatuses.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-8 space-y-3"
        >
          <h2 className="section-title flex items-center gap-2">
            <Package2 size={14} />
            Refill Alerts
          </h2>
          {refillStatuses.map(status => (
            <div 
              key={status.medicineId}
              className="glass-card border-warning/30 bg-warning/5 p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center text-warning">
                  <Package2 size={20} />
                </div>
                <div>
                   <p className="text-sm font-bold text-foreground">{status.medicineName}</p>
                   <p className="text-[10px] font-semibold text-warning uppercase tracking-wider mt-0.5">
                     Only {status.daysRemaining} days left
                   </p>
                </div>
              </div>
              <button 
                onClick={() => navigate(`/medicine/${encodeURIComponent(status.medicineName)}`)}
                className="bg-warning text-warning-foreground text-[10px] font-bold px-4 py-2 rounded-lg uppercase tracking-wider shadow-sm active:scale-95 transition-transform"
              >
                Refill
              </button>
            </div>
          ))}
        </motion.div>
      )}

      {/* 7. Feature Slideshow */}
      <FeatureSlideshow />

      <div className="mt-6 rounded-xl border border-warning/30 bg-warning/10 p-4 font-medium mb-12">
        <p className="text-xs text-warning leading-relaxed flex items-start gap-2">
          <span className="shrink-0">⚠️</span>
          <span>{t("dashboard.disclaimer")}</span>
        </p>
      </div>
    </div>
  );
}
