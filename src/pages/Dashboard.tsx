import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Camera, Plus, History, Search, Pill, Bell, AlertTriangle, Package2, Users, User, Plane, Heart, FileText } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";
import { useEffect, useState, useMemo } from "react";
import AchievementOverlay from "@/components/AchievementOverlay";
import { DashboardBanner } from "@/components/DashboardBanner";
import { FeatureSlideshow } from "@/components/FeatureSlideshow";
import { calculateRefillStatus, RefillStatus } from "@/services/refillService";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function Dashboard() {
  const navigate = useNavigate();
  const { reminders, doseLogs, userProfile, medicines, isProfessionalMode, patients, selectedPatientId, setSelectedPatientId } = useApp();
  const { t } = useTranslation();
  const [showAchievement, setShowAchievement] = useState(false);

  const refillStatuses = useMemo(() => {
    return medicines
      .map(m => calculateRefillStatus(m, reminders))
      .filter((s): s is RefillStatus => s !== null && s.isLow);
  }, [medicines, reminders]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("dashboard.good_morning", "Good morning");
    if (hour < 18) return t("dashboard.good_afternoon", "Good afternoon");
    return t("dashboard.good_evening", "Good evening");
  };

  const quickActions = [
    { icon: Camera, label: t("dashboard.quick_scan"), to: "/scan", color: "bg-primary/10 border border-primary/20 text-primary backdrop-blur-xl shadow-lg shadow-primary/5", ringScale: 1.05 },
    { icon: Users, label: isProfessionalMode ? "Patient Hub" : "Family Hub", to: "/family", color: "bg-success/10 border border-success/20 text-success backdrop-blur-xl shadow-lg shadow-success/5", ringScale: 1 },
    { icon: Heart, label: "Wellness", to: "/wellness", color: "bg-destructive/10 border border-destructive/20 text-destructive backdrop-blur-xl shadow-lg shadow-destructive/5", ringScale: 1.1 },
    { icon: FileText, label: "Dossier", to: "/report", color: "bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 backdrop-blur-xl shadow-lg shadow-indigo-500/5", ringScale: 1 },
    { icon: History, label: t("dashboard.quick_history"), to: "/history", color: "bg-accent/50 border border-accent/60 text-accent-foreground backdrop-blur-xl shadow-lg shadow-accent/5", ringScale: 1 },
    { icon: Plane, label: "Travel", to: "/travel", color: "bg-warning/10 border border-warning/20 text-warning backdrop-blur-xl shadow-lg shadow-warning/5", ringScale: 1.05 },
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

  return (
    <div className="px-4 pt-12 pb-4">
      <AchievementOverlay 
        open={showAchievement}
        onClose={() => setShowAchievement(false)}
        title="Perfect Day!"
        subtitle="You've taken all your scheduled medications for today. Keep up the great work!"
        emoji="🏆"
      />
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

      <DashboardBanner />

      {/* Refill Alerts */}
      {refillStatuses.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-8 space-y-3"
        >
          {refillStatuses.map(status => (
            <div 
              key={status.medicineId}
              className="rounded-2xl border border-warning/30 bg-warning/5 p-4 flex items-center justify-between shadow-sm"
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

      {/* Stats or Professional Hub */}
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

      <FeatureSlideshow />

      {/* Upcoming reminders */}
      <div className="mb-6">
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
            {todayReminders.slice(0, 5).map((r) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between rounded-2xl border border-border/50 bg-card p-4 group transition-all hover:bg-accent/5 hover:border-primary/20"
              >
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary transition-transform group-hover:scale-105">
                    <Pill size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{r.medicineName}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">{r.dose} • {r.time}</p>
                  </div>
                </div>
                <span className="rounded-full bg-primary/5 px-3 py-1 text-[10px] font-bold text-primary uppercase tracking-wider">
                  {r.repeatSchedule}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-warning/30 bg-warning/10 p-4 font-medium">
        <p className="text-xs text-warning leading-relaxed flex items-start gap-2">
          <span className="shrink-0">⚠️</span>
          <span>{t("dashboard.disclaimer")}</span>
        </p>
      </div>
    </div>
  );
}
