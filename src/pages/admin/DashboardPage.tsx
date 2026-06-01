import { KpiCard } from "../components/KpiCard";
import { AdherenceBarChart } from "../components/AdherenceBarChart";
import { PatientRow } from "../components/PatientRow";
import { AdminBadge } from "../components/AdminBadge";
import { ADMIN_PATIENTS, ADMIN_SCANS, ADMIN_ALERTS, AdminPatient } from "../data";

const ADH_7D = [
  { day: "Mon", pct: 78 }, { day: "Tue", pct: 82 }, { day: "Wed", pct: 71 },
  { day: "Thu", pct: 88 }, { day: "Fri", pct: 85 }, { day: "Sat", pct: 64 }, { day: "Sun", pct: 84 },
];

const ALERT_BORDER = { crit: "#ff453a", warn: "#ffd60a", info: "#0a84ff" } as const;
const ALERT_BG     = { crit: "rgba(255,69,58,0.12)", warn: "rgba(255,214,10,0.12)", info: "rgba(10,132,255,0.12)" } as const;

type Props = {
  onPatientClick: (p: AdminPatient) => void;
  onNavigate: (page: string) => void;
};

export function DashboardPage({ onPatientClick, onNavigate }: Props) {
  return (
    <div className="p-7 space-y-3.5">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3.5">
        <KpiCard label="Total Patients"     value="342"  icon="👥" trend="↑ 12"  trendUp trendLabel="this month" accentColor="#0a84ff" />
        <KpiCard label="Avg Adherence"      value="84%"  icon="✅" trend="↑ 6%"  trendUp trendLabel="vs last month" accentColor="#30d158" valueColor="#30d158" />
        <KpiCard label="Missed Doses"       value="127"  icon="⚠️" trend="↓ 18"  trendLabel="vs yesterday" accentColor="#ffd60a" valueColor="#ffd60a" />
        <KpiCard label="AI Requests Today"  value="89"   icon="🤖" trend="↑ 23"  trendUp trendLabel="from yesterday" accentColor="#bf5af2" valueColor="#bf5af2" />
      </div>

      {/* Adherence + Alerts */}
      <div className="grid grid-cols-[2fr_1fr] gap-3.5">
        {/* Adherence chart */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0d1320] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
            <div>
              <div className="font-['Syne'] text-[13.5px] font-bold">Medication Adherence</div>
              <div className="mt-0.5 text-[11px] text-[#6e7585]">Daily rate across all active patients</div>
            </div>
            <div className="flex gap-1">
              {["7D", "30D", "90D"].map((t, i) => (
                <button key={t} className={`rounded-[5px] px-2.5 py-1 font-['DM_Sans'] text-[10.5px] font-semibold ${i === 0 ? "bg-[rgba(10,132,255,0.12)] text-[#0a84ff]" : "text-[#6e7585] hover:text-[#f2f2f7]"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="p-5">
            <AdherenceBarChart data={ADH_7D} />
          </div>
        </div>

        {/* Alerts */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0d1320] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
            <div>
              <div className="font-['Syne'] text-[13.5px] font-bold">Active Alerts</div>
              <div className="mt-0.5 text-[11px] text-[#6e7585]">Requires attention</div>
            </div>
            <AdminBadge variant="red">7 open</AdminBadge>
          </div>
          <div className="p-4 space-y-2">
            {ADMIN_ALERTS.slice(0, 5).map((a, i) => (
              <div
                key={i}
                onClick={() => onNavigate("alerts")}
                className="flex cursor-pointer items-center gap-2.5 rounded-[9px] border border-white/[0.04] bg-[#111827] px-3 py-2.5 transition-colors hover:border-white/[0.1]"
                style={{ borderLeftColor: ALERT_BORDER[a.severity], borderLeftWidth: 3 }}
              >
                <div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[7px] text-sm"
                     style={{ background: ALERT_BG[a.severity] }}>
                  {a.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold truncate">{a.title}</div>
                  <div className="text-[10.5px] text-[#6e7585] truncate">{a.description}</div>
                </div>
                <div className="font-mono text-[10px] flex-shrink-0 text-[#6e7585]">{a.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Patients + AI donut */}
      <div className="grid grid-cols-2 gap-3.5">
        {/* Mini patient table */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0d1320] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
            <div>
              <div className="font-['Syne'] text-[13.5px] font-bold">Patient Overview</div>
              <div className="mt-0.5 text-[11px] text-[#6e7585]">Top patients by activity today</div>
            </div>
            <button onClick={() => onNavigate("patients")} className="rounded-lg border border-white/[0.07] bg-[#111827] px-3 py-1.5 text-[11px] font-semibold text-[#6e7585] hover:text-[#f2f2f7]">
              View all →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>{["Patient", "Condition", "Adherence", "Status", "Last Active"].map(h => (
                  <th key={h} className="border-b border-white/[0.07] px-3 py-2.5 text-left font-mono text-[9px] font-medium uppercase tracking-[0.1em] text-[#6e7585]">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {ADMIN_PATIENTS.slice(0, 6).map(p => (
                  <PatientRow key={p.id} patient={p} onClick={onPatientClick} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI usage */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0d1320] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
            <div>
              <div className="font-['Syne'] text-[13.5px] font-bold">AI Usage Breakdown</div>
              <div className="mt-0.5 text-[11px] text-[#6e7585]">This month · 2,847 total</div>
            </div>
            <AdminBadge variant="violet">↑ 31%</AdminBadge>
          </div>
          <div className="p-5">
            {/* Donut */}
            <div className="flex items-center gap-5 mb-4">
              <svg width="88" height="88" viewBox="0 0 88 88" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="44" cy="44" r="34" fill="none" stroke="#111827" strokeWidth="8"/>
                <circle cx="44" cy="44" r="34" fill="none" stroke="#0a84ff" strokeWidth="8" strokeLinecap="round" strokeDasharray="128 86" strokeDashoffset="0"/>
                <circle cx="44" cy="44" r="34" fill="none" stroke="#bf5af2" strokeWidth="8" strokeLinecap="round" strokeDasharray="54 160" strokeDashoffset="-128"/>
                <circle cx="44" cy="44" r="34" fill="none" stroke="#30d158" strokeWidth="8" strokeLinecap="round" strokeDasharray="26 188" strokeDashoffset="-182"/>
                <circle cx="44" cy="44" r="34" fill="none" stroke="#ffd60a" strokeWidth="8" strokeLinecap="round" strokeDasharray="6 208" strokeDashoffset="-208"/>
              </svg>
              <div className="flex-1 space-y-2">
                {[
                  { color: "#0a84ff", label: "Pill Scans", val: "1,491" },
                  { color: "#bf5af2", label: "Dawa-GPT",   val: "654" },
                  { color: "#30d158", label: "Drug Checks",val: "512" },
                  { color: "#ffd60a", label: "Med Search", val: "190" },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between text-[11.5px]">
                    <div className="flex items-center gap-1.5 text-[#6e7585]">
                      <div className="h-1.5 w-1.5 rounded-[2px]" style={{ background: r.color }} />
                      {r.label}
                    </div>
                    <span className="font-mono font-medium">{r.val}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Stat grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { val: "97.2%", color: "#30d158", label: "Scan accuracy" },
                { val: "1.4s",  color: "#0a84ff", label: "Avg response" },
                { val: "89",    color: "#bf5af2", label: "GPT sessions" },
                { val: "14",    color: "#ffd60a", label: "Interactions flagged" },
              ].map(s => (
                <div key={s.label} className="rounded-[9px] border border-white/[0.07] bg-[#111827] p-3">
                  <div className="font-['Syne'] text-xl font-extrabold tracking-tight" style={{ color: s.color }}>{s.val}</div>
                  <div className="mt-0.5 text-[10.5px] text-[#6e7585]">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Reminders + Scans */}
      <div className="grid grid-cols-2 gap-3.5">
        {/* Reminders */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0d1320] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
            <div>
              <div className="font-['Syne'] text-[13.5px] font-bold">Reminder Overview</div>
              <div className="mt-0.5 text-[11px] text-[#6e7585]">Today · all active patients</div>
            </div>
            <AdminBadge variant="blue">Live</AdminBadge>
          </div>
          <div className="p-5">
            <div className="mb-4 flex gap-2.5">
              {[{ color: "#30d158", num: "621", label: "Taken" }, { color: "#ffd60a", num: "127", label: "Missed" }, { color: "#0a84ff", num: "83", label: "Pending" }, { color: "#6e7585", num: "41", label: "Skipped" }].map(r => (
                <div key={r.label} className="flex flex-1 flex-col items-center text-center">
                  <div className="font-['Syne'] text-[13px] font-extrabold" style={{ color: r.color }}>{r.num}</div>
                  <div className="font-mono text-[9.5px] text-[#6e7585]">{r.label}</div>
                </div>
              ))}
            </div>
            <div className="space-y-2.5">
              {[
                { label: "Morning (06:00–10:00)", pct: 88, color: "#30d158" },
                { label: "Afternoon (12:00–15:00)", pct: 74, color: "#ffd60a" },
                { label: "Evening (18:00–21:00)", pct: 61, color: "#ffd60a" },
                { label: "Night (21:00+)", pct: 45, color: "#ff453a" },
              ].map(r => (
                <div key={r.label} className="flex items-center gap-2.5 text-[11px]">
                  <span className="flex-1 text-[#6e7585]">{r.label}</span>
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#111827]">
                    <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: r.color }} />
                  </div>
                  <span className="w-7 text-right font-mono text-[11px]" style={{ color: r.color }}>{r.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent scans */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0d1320] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
            <div>
              <div className="font-['Syne'] text-[13.5px] font-bold">Recent AI Scans</div>
              <div className="mt-0.5 text-[11px] text-[#6e7585]">Pill identification · last 24h</div>
            </div>
            <button onClick={() => onNavigate("scans")} className="rounded-lg border border-white/[0.07] bg-[#111827] px-3 py-1.5 text-[11px] font-semibold text-[#6e7585] hover:text-[#f2f2f7]">
              All →
            </button>
          </div>
          <div className="p-4">
            {ADMIN_SCANS.slice(0, 6).map((s, i) => {
              const c = s.confidence >= 80 ? "#30d158" : s.confidence >= 60 ? "#ffd60a" : "#ff453a";
              return (
                <div key={i} className="flex items-center gap-2.5 border-b border-white/[0.04] py-2.5 last:border-0">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[rgba(10,132,255,0.12)] text-sm">
                    {s.matched ? "💊" : "❓"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold truncate">{s.medication}</div>
                    <div className="text-[10.5px] text-[#6e7585]">Patient {s.patientId} · {s.time}</div>
                  </div>
                  <span className="font-mono text-[11px] font-semibold" style={{ color: c }}>{s.confidence}%</span>
                  <AdminBadge variant={s.matched ? "green" : "red"}>{s.matched ? "OK" : "LOW"}</AdminBadge>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
