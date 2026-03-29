import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Camera, Plus, History, Search, Pill, Bell } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useTranslation } from "react-i18next";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export default function Dashboard() {
  const navigate = useNavigate();
  const { reminders, doseLogs } = useApp();
  const { t } = useTranslation();

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
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("dashboard.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("dashboard.subtitle")}</p>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mb-6 rounded-2xl bg-primary p-5 text-primary-foreground"
      >
        <div className="flex items-center gap-3 mb-3">
          <Pill size={20} />
          <span className="text-sm font-medium opacity-90">{t("dashboard.todays_progress")}</span>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-bold">{takenToday}</span>
          <span className="mb-1 text-sm opacity-80">/ {todayReminders.length} {t("dashboard.doses")}</span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-primary-foreground/20 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-primary-foreground/80"
            initial={{ width: 0 }}
            animate={{ width: todayReminders.length ? `${(takenToday / todayReminders.length) * 100}%` : "0%" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 gap-3 mb-8">
        {quickActions.map(({ icon: Icon, label, to, color }) => (
          <motion.button
            key={to}
            variants={item}
            onClick={() => navigate(to)}
            className={`flex items-center gap-3 rounded-xl p-4 text-left transition-transform active:scale-[0.97] ${color}`}
          >
            <Icon size={22} />
            <span className="text-sm font-semibold">{label}</span>
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
          <div className="space-y-2">
            {todayReminders.slice(0, 5).map((r) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-card-foreground">{r.medicineName}</p>
                  <p className="text-xs text-muted-foreground">{r.dose} • {r.time}</p>
                </div>
                <span className="rounded-lg bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                  {r.repeatSchedule}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="mt-6 rounded-xl border border-warning/30 bg-warning/10 p-4">
        <p className="text-xs text-warning-foreground leading-relaxed">
          ⚠️ <strong>{t("dashboard.disclaimer")}</strong>
        </p>
      </div>
    </div>
  );
}
