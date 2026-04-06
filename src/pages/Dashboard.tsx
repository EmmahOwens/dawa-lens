import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Camera, Plus, History, Search, Pill, Bell } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function Dashboard() {
  const navigate = useNavigate();
  const { reminders, doseLogs, userProfile } = useApp();
  const { t } = useTranslation();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("dashboard.good_morning", "Good morning");
    if (hour < 18) return t("dashboard.good_afternoon", "Good afternoon");
    return t("dashboard.good_evening", "Good evening");
  };

  const quickActions = [
    { icon: Camera, label: t("dashboard.quick_scan"), to: "/scan", color: "bg-primary text-primary-foreground" },
    { icon: Plus, label: t("dashboard.quick_add"), to: "/reminders/new", color: "bg-success text-success-foreground" },
    { icon: History, label: t("dashboard.quick_history"), to: "/history", color: "bg-accent text-accent-foreground" },
    { icon: Search, label: t("dashboard.quick_search"), to: "/search", color: "bg-warning text-warning-foreground" },
  ];

  const todayReminders = reminders.filter((r) => r.enabled);
  const takenToday = doseLogs.filter(
    (l) => l.action === "taken" && new Date(l.actionTime).toDateString() === new Date().toDateString()
  ).length;

  return (
    <div className="px-4 pt-12 pb-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
        <h1 className="text-4xl font-black tracking-tighter text-foreground leading-tight">
          {getGreeting()},<br />
          <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            {userProfile?.name?.split(" ")[0] || t("dashboard.greeting_there")}
          </span>
        </h1>
        <p className="mt-2 text-sm font-medium text-muted-foreground uppercase tracking-widest opacity-70 italic">{t("dashboard.subtitle")}</p>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mb-10 rounded-[2.5rem] bg-gradient-to-br from-primary to-primary/80 p-8 text-primary-foreground shadow-[0_20px_50px_rgba(var(--primary-rgb),0.3)] relative overflow-hidden group"
      >
        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700" />
        <div className="flex items-center gap-3 mb-3">
          <Pill size={20} />
          <span className="text-sm font-medium opacity-90">{t("dashboard.todays_progress")}</span>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-bold">{takenToday}</span>
          <span className="mb-1 text-sm opacity-80">/ {todayReminders.length} {t("dashboard.doses")}</span>
        </div>
        <div className="mt-6 h-3 rounded-full bg-primary-foreground/20 overflow-hidden border border-white/10">
          <motion.div
            className="h-full rounded-full bg-primary-foreground shadow-[0_0_15px_rgba(255,255,255,0.5)]"
            initial={{ width: 0 }}
            animate={{ width: todayReminders.length ? `${(takenToday / todayReminders.length) * 100}%` : "0%" }}
            transition={{ duration: 1.2, ease: "circOut" }}
          />
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 gap-3 mb-8">
        {quickActions.map(({ icon: Icon, label, to, color }) => (
          <motion.button
            key={to}
            variants={item}
            whileHover={{ scale: 1.05, y: -5 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate(to)}
            className={`flex flex-col items-start gap-4 rounded-[2rem] p-6 text-left transition-all shadow-sm border border-transparent hover:border-white/20 active:scale-[0.97] ${color}`}
          >
            <div className="p-3 rounded-2xl bg-white/20 shadow-inner">
               <Icon size={26} />
            </div>
            <span className="text-sm font-bold tracking-tight leading-tight">{label}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* Upcoming reminders */}
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground mb-3 flex items-center gap-2">
          <Bell size={16} />
          {t("dashboard.upcoming_reminders")}
        </h2>
        {todayReminders.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">{t("dashboard.no_reminders")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayReminders.slice(0, 5).map((r) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ x: 5 }}
                className="flex items-center justify-between rounded-[1.5rem] border border-border/50 bg-card p-5 group transition-all hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <Pill size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-card-foreground">{r.medicineName}</p>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mt-0.5">{r.dose} • {r.time}</p>
                  </div>
                </div>
                <span className="rounded-full bg-primary/5 px-4 py-1.5 text-[10px] font-black text-primary uppercase tracking-tighter">
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
