import { ADMIN_ALERTS, ADMIN_SCANS, DRUG_INTERACTIONS } from "../data";
import { KpiCard } from "../components/KpiCard";
import { AdminBadge } from "../components/AdminBadge";

// ─── Alerts Page ────────────────────────────────────────────────────────────

const BORDER = { crit: "#ff453a", warn: "#ffd60a", info: "#0a84ff" } as const;
const BG     = { crit: "rgba(255,69,58,0.12)", warn: "rgba(255,214,10,0.12)", info: "rgba(10,132,255,0.12)" } as const;

export function AlertsPage() {
  return (
    <div className="p-7 space-y-3.5">
      <div className="grid grid-cols-4 gap-3.5">
        <KpiCard label="Critical"       value="2"  icon="🚨" trendLabel="Immediate action" accentColor="#ff453a" valueColor="#ff453a" />
        <KpiCard label="Warnings"       value="3"  icon="⚠️" trendLabel="Review soon"       accentColor="#ffd60a" valueColor="#ffd60a" />
        <KpiCard label="Informational"  value="2"  icon="ℹ️" trendLabel="No action needed"  accentColor="#0a84ff" />
        <KpiCard label="Resolved Today" value="11" icon="✅" trend="↑ 4" trendUp trendLabel="vs yesterday" accentColor="#30d158" valueColor="#30d158" />
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-[#0d1320] overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <div>
            <div className="font-['Syne'] text-[13.5px] font-bold">All Active Alerts</div>
            <div className="mt-0.5 text-[11px] text-[#6e7585]">Sorted by severity · 7 open</div>
          </div>
          <div className="flex gap-2">
            <button className="rounded-lg border border-white/[0.07] bg-[#111827] px-3 py-1.5 text-[12px] font-semibold text-[#6e7585] hover:text-[#f2f2f7]">
              Mark all read
            </button>
            <button className="rounded-lg bg-[#0a84ff] px-3 py-1.5 text-[12px] font-semibold text-white shadow-[0_0_14px_rgba(10,132,255,0.35)] hover:opacity-90">
              + Create alert
            </button>
          </div>
        </div>
        <div className="p-5 space-y-2.5">
          {ADMIN_ALERTS.map((a, i) => (
            <div
              key={i}
              className="flex cursor-pointer items-center gap-3.5 rounded-xl border border-white/[0.07] bg-[#0d1320] p-4 transition-colors hover:bg-[#111827]"
              style={{ borderLeftColor: BORDER[a.severity], borderLeftWidth: 4 }}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] text-lg"
                   style={{ background: BG[a.severity] }}>
                {a.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-bold">{a.title}</div>
                <div className="mt-0.5 text-[11.5px] text-[#6e7585]">{a.description}</div>
                <div className="mt-1 font-mono text-[10.5px] text-[#6e7585]">{a.meta}</div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <AdminBadge variant={a.severity === "crit" ? "red" : a.severity === "warn" ? "amber" : "blue"}>{a.tag}</AdminBadge>
                <span className="font-mono text-[10px] text-[#6e7585]">{a.time}</span>
                <button className="rounded-lg border border-white/[0.07] bg-[#111827] px-2.5 py-1 text-[10px] font-semibold text-[#6e7585] hover:text-[#f2f2f7]">
                  Resolve
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Analytics Page ──────────────────────────────────────────────────────────

const monthData = Array.from({ length: 31 }, (_, i) => ({
  day: i + 1,
  pct: Math.round(75 + Math.sin(i * 0.3) * 8 + Math.random() * 10 - 3),
}));

const condData = [
  { name: "Hypertension", count: 98, color: "#0a84ff" },
  { name: "Diabetes T2",  count: 76, color: "#ffd60a" },
  { name: "HIV/ARV",      count: 62, color: "#bf5af2" },
  { name: "TB",           count: 44, color: "#ff453a" },
  { name: "Epilepsy",     count: 32, color: "#5ac8fa" },
  { name: "Malaria",      count: 30, color: "#30d158" },
];
const condTotal = condData.reduce((s, c) => s + c.count, 0);

const ageBins = [
  { label: "0–12", val: 18 }, { label: "13–18", val: 32 }, { label: "19–30", val: 74 },
  { label: "31–45", val: 103 }, { label: "46–60", val: 79 }, { label: "61+", val: 36 },
];
const ageMax = Math.max(...ageBins.map(b => b.val));

export function AnalyticsPage() {
  return (
    <div className="p-7 space-y-3.5">
      <div className="grid grid-cols-4 gap-3.5">
        <KpiCard label="Monthly Adherence"    value="84%"  icon="📈" trend="↑ 6%"  trendUp trendLabel="MoM" accentColor="#30d158" valueColor="#30d158" />
        <KpiCard label="Active Patients"      value="319"  icon="👤" trend="↑ 8"   trendUp trendLabel="from last month" accentColor="#0a84ff" />
        <KpiCard label="Total Doses Logged"   value="28.4K"icon="💉" trend="↑ 12%" trendUp trendLabel="this month" accentColor="#ffd60a" valueColor="#ffd60a" />
        <KpiCard label="Avg GPT Sessions/day" value="76"   icon="🤖" trend="↑ 18%" trendUp trendLabel="WoW" accentColor="#bf5af2" valueColor="#bf5af2" />
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        {/* Monthly chart */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0d1320] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
            <div>
              <div className="font-['Syne'] text-[13.5px] font-bold">Adherence Trend — May 2026</div>
              <div className="mt-0.5 text-[11px] text-[#6e7585]">Daily average across all patients</div>
            </div>
            <AdminBadge variant="green">↑ Improving</AdminBadge>
          </div>
          <div className="p-5">
            <div className="flex items-end gap-[3px]" style={{ height: 180 }}>
              {monthData.map((d) => {
                const h = Math.round((d.pct / 100) * 175);
                const color = d.pct >= 80 ? "#30d158" : d.pct >= 60 ? "#ffd60a" : "#ff453a";
                return (
                  <div key={d.day} className="group relative flex-1 cursor-pointer rounded-t-[3px] transition-[filter] hover:brightness-125"
                       style={{ height: h, background: color, opacity: 0.72 }}>
                    <div className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[#161d2e] px-1.5 py-0.5 font-mono text-[9px] opacity-0 transition-opacity group-hover:opacity-100">
                      Day {d.day}: {d.pct}%
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-1.5 flex">
              {monthData.map(d => (
                <div key={d.day} className="flex-1 text-center font-mono text-[8.5px] text-[#6e7585]">
                  {d.day % 5 === 0 ? d.day : ""}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Condition breakdown */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0d1320] overflow-hidden">
          <div className="border-b border-white/[0.07] px-5 py-4">
            <div className="font-['Syne'] text-[13.5px] font-bold">Patient by Condition</div>
            <div className="mt-0.5 text-[11px] text-[#6e7585]">Distribution of primary diagnoses</div>
          </div>
          <div className="p-5 space-y-3">
            {condData.map(c => (
              <div key={c.name} className="flex items-center gap-2.5">
                <div className="w-24 text-[12px] text-[#6e7585]">{c.name}</div>
                <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-[#111827]">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.round(c.count / condTotal * 100)}%`, background: c.color }} />
                </div>
                <div className="w-8 text-right font-mono text-[11px]" style={{ color: c.color }}>{c.count}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        {/* Age distribution */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0d1320] overflow-hidden">
          <div className="border-b border-white/[0.07] px-5 py-4">
            <div className="font-['Syne'] text-[13.5px] font-bold">Age Distribution</div>
            <div className="mt-0.5 text-[11px] text-[#6e7585]">Patients by age group</div>
          </div>
          <div className="p-5">
            <div className="flex items-end gap-2" style={{ height: 130 }}>
              {ageBins.map(b => {
                const h = Math.round((b.val / ageMax) * 125);
                return (
                  <div key={b.label} className="group relative flex-1 cursor-pointer rounded-t-[4px] transition-[filter] hover:brightness-125"
                       style={{ height: h, background: "#0a84ff", opacity: 0.65 }}>
                    <div className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-[#161d2e] px-1.5 py-0.5 font-mono text-[9px] opacity-0 transition-opacity group-hover:opacity-100">
                      {b.val} patients
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-1.5 flex gap-2">
              {ageBins.map(b => <div key={b.label} className="flex-1 text-center font-mono text-[8.5px] text-[#6e7585]">{b.label}</div>)}
            </div>
          </div>
        </div>

        {/* Adherence by time of day */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0d1320] overflow-hidden">
          <div className="border-b border-white/[0.07] px-5 py-4">
            <div className="font-['Syne'] text-[13.5px] font-bold">Adherence by Time of Day</div>
            <div className="mt-0.5 text-[11px] text-[#6e7585]">Which hours have lowest compliance</div>
          </div>
          <div className="p-5">
            <div className="mb-4 grid grid-cols-3 gap-2">
              {[{ val: "91%", color: "#30d158", label: "Morning", trend: "↑ best" }, { val: "74%", color: "#ffd60a", label: "Afternoon", trend: "→ stable" }, { val: "45%", color: "#ff453a", label: "Night", trend: "↓ worst" }].map(m => (
                <div key={m.label} className="rounded-lg border border-white/[0.07] bg-[#111827] p-3 text-center">
                  <div className="font-['Syne'] text-2xl font-extrabold" style={{ color: m.color }}>{m.val}</div>
                  <div className="mt-1 text-[10.5px] text-[#6e7585]">{m.label}</div>
                  <div className="font-mono text-[10px]" style={{ color: m.color }}>{m.trend}</div>
                </div>
              ))}
            </div>
            <div className="space-y-2.5">
              {[
                { label: "06:00 – 10:00", pct: 91, color: "#30d158" },
                { label: "10:00 – 14:00", pct: 80, color: "#30d158" },
                { label: "14:00 – 18:00", pct: 74, color: "#ffd60a" },
                { label: "18:00 – 22:00", pct: 61, color: "#ffd60a" },
                { label: "22:00 – 06:00", pct: 45, color: "#ff453a" },
              ].map(r => (
                <div key={r.label} className="flex items-center gap-2.5">
                  <span className="w-32 text-[11px] text-[#6e7585]">{r.label}</span>
                  <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-[#111827]">
                    <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: r.color }} />
                  </div>
                  <span className="w-8 text-right font-mono text-[11px]" style={{ color: r.color }}>{r.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AI Overview Page ────────────────────────────────────────────────────────

export function AIPage() {
  return (
    <div className="p-7 space-y-3.5">
      <div className="grid grid-cols-4 gap-3.5">
        <KpiCard label="Total AI Requests"    value="2,847" icon="🤖" trend="↑ 31%"  trendUp trendLabel="this month" accentColor="#bf5af2" valueColor="#bf5af2" />
        <KpiCard label="Scan Accuracy"        value="97.2%" icon="🎯" trend="↑ 0.4%" trendUp trendLabel="vs last month" accentColor="#30d158" valueColor="#30d158" />
        <KpiCard label="Avg Latency"          value="1.4s"  icon="⚡" trend="↓ 0.3s" trendLabel="faster" accentColor="#0a84ff" />
        <KpiCard label="Flagged Interactions" value="14"    icon="⚠️" trend="↑ 3"    trendLabel="this week" accentColor="#ffd60a" valueColor="#ffd60a" />
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        {/* Model status */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0d1320] overflow-hidden">
          <div className="border-b border-white/[0.07] px-5 py-4">
            <div className="font-['Syne'] text-[13.5px] font-bold">AI Model Status</div>
            <div className="mt-0.5 text-[11px] text-[#6e7585]">Active inference endpoints</div>
          </div>
          <div className="p-5 space-y-3">
            {[
              { icon: "🦙", iconBg: "rgba(191,90,242,0.12)", iconColor: "#bf5af2", name: "Llama 4 Scout", sub: "Primary · via Groq", status: "ACTIVE", statusVar: "green" as const, pct: 72, barColor: "#bf5af2" },
              { icon: "💎", iconBg: "rgba(10,132,255,0.12)",  iconColor: "#0a84ff", name: "Gemini 2.0 Flash", sub: "Fallback · via Google", status: "STANDBY", statusVar: "blue" as const, pct: 18, barColor: "#0a84ff" },
              { icon: "👁",  iconBg: "rgba(90,200,250,0.12)", iconColor: "#5ac8fa", name: "Tesseract OCR",  sub: "Pill label extraction", status: "ACTIVE",  statusVar: "green" as const, pct: 44, barColor: "#5ac8fa" },
            ].map(m => (
              <div key={m.name} className="flex items-center gap-3.5 rounded-xl border border-white/[0.07] bg-[#111827] p-3.5 transition-colors hover:border-white/[0.12]">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[11px] text-xl" style={{ background: m.iconBg, color: m.iconColor }}>
                  {m.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-['Syne'] text-sm font-bold">{m.name}</div>
                  <div className="mt-0.5 text-[11px] text-[#6e7585]">{m.sub}</div>
                </div>
                <div className="text-right">
                  <AdminBadge variant={m.statusVar}>{m.status}</AdminBadge>
                  <div className="mt-1.5 w-24">
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#0d1320]">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${m.pct}%`, background: m.barColor }} />
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-[#6e7585]">{m.pct}% capacity</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scan confidence */}
        <div className="rounded-2xl border border-white/[0.07] bg-[#0d1320] overflow-hidden">
          <div className="border-b border-white/[0.07] px-5 py-4">
            <div className="font-['Syne'] text-[13.5px] font-bold">Scan Confidence Distribution</div>
            <div className="mt-0.5 text-[11px] text-[#6e7585]">1,491 scans this month</div>
          </div>
          <div className="p-5 space-y-3">
            {[
              { range: "95–100%", count: 1103, pct: 74, color: "#30d158" },
              { range: "80–94%",  count: 239,  pct: 16, color: "#30d158" },
              { range: "60–79%",  count: 89,   pct: 6,  color: "#ffd60a" },
              { range: "40–59%",  count: 41,   pct: 3,  color: "#ffd60a" },
              { range: "<40%",    count: 19,   pct: 1,  color: "#ff453a" },
            ].map(r => (
              <div key={r.range} className="flex items-center gap-2.5">
                <span className="w-16 font-mono text-[10px] text-[#6e7585]">{r.range}</span>
                <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-[#111827]">
                  <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: r.color }} />
                </div>
                <span className="w-10 text-right font-mono text-[10px] text-[#6e7585]">{r.count}</span>
              </div>
            ))}
            <div className="mt-3 border-t border-white/[0.07] pt-3">
              <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.1em] text-[#6e7585]">Top Identified Medications</div>
              <div className="flex flex-wrap gap-1.5">
                {["Metformin", "Amlodipine", "Cotrimoxazole", "Lisinopril", "Phenobarbital", "ARV combo"].map(m => (
                  <AdminBadge key={m} variant="blue">{m}</AdminBadge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Drug interactions */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0d1320] overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <div>
            <div className="font-['Syne'] text-[13.5px] font-bold">Flagged Drug Interactions</div>
            <div className="mt-0.5 text-[11px] text-[#6e7585]">Detected by AI this month · sorted by severity</div>
          </div>
          <AdminBadge variant="amber">14 total</AdminBadge>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {DRUG_INTERACTIONS.map((d, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5">
              <div className="w-1.5 self-stretch rounded-full flex-shrink-0" style={{ background: d.severity === "major" ? "#ff453a" : d.severity === "moderate" ? "#ffd60a" : "#0a84ff" }} />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold">{d.drugs}</div>
                <div className="mt-0.5 text-[10.5px] text-[#6e7585]">{d.description}</div>
              </div>
              <AdminBadge variant={d.severity === "major" ? "red" : d.severity === "moderate" ? "amber" : "blue"}>
                {d.severity}
              </AdminBadge>
              <span className="ml-2 font-mono text-[10.5px] text-[#6e7585]">{d.cases} case{d.cases > 1 ? "s" : ""}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Scans Page ──────────────────────────────────────────────────────────────

export function ScansPage() {
  return (
    <div className="p-7 space-y-3.5">
      <div className="grid grid-cols-4 gap-3.5">
        <KpiCard label="Scans Today"      value="89" icon="📷" trend="↑ 23"  trendUp trendLabel="from yesterday" accentColor="#bf5af2" valueColor="#bf5af2" />
        <KpiCard label="High Confidence"  value="74" icon="✅" trendLabel=">95% confidence" accentColor="#30d158" valueColor="#30d158" />
        <KpiCard label="Low Confidence"   value="11" icon="⚠️" trendLabel="Manual review needed" accentColor="#ffd60a" valueColor="#ffd60a" />
        <KpiCard label="Failed Scans"     value="4"  icon="❌" trendLabel="Image unreadable" accentColor="#ff453a" valueColor="#ff453a" />
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-[#0d1320] overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <div>
            <div className="font-['Syne'] text-[13.5px] font-bold">Scan Activity Log</div>
            <div className="mt-0.5 text-[11px] text-[#6e7585]">All scans · last 24 hours</div>
          </div>
          <button className="rounded-lg border border-white/[0.07] bg-[#111827] px-3 py-1.5 text-[12px] font-semibold text-[#6e7585] hover:text-[#f2f2f7]">
            ⬇ Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Medication", "Patient", "Confidence", "Model", "OCR Text", "Result", "Time"].map(h => (
                  <th key={h} className="border-b border-white/[0.07] px-3 py-2.5 text-left font-mono text-[9px] font-medium uppercase tracking-[0.1em] text-[#6e7585]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ADMIN_SCANS.map((s, i) => {
                const c = s.confidence >= 80 ? "#30d158" : s.confidence >= 60 ? "#ffd60a" : "#ff453a";
                return (
                  <tr key={i} className="border-b border-white/[0.04]">
                    <td className="px-3 py-2.5 text-[12.5px] font-semibold">{s.medication}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-[#6e7585]">{s.patientId}</td>
                    <td className="px-3 py-2.5"><span className="font-mono text-[12px] font-bold" style={{ color: c }}>{s.confidence}%</span></td>
                    <td className="px-3 py-2.5"><AdminBadge>{s.model}</AdminBadge></td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-[#6e7585]">{s.ocrText}</td>
                    <td className="px-3 py-2.5"><AdminBadge variant={s.matched ? "green" : "red"}>{s.matched ? "✓ Matched" : "✗ Low conf"}</AdminBadge></td>
                    <td className="px-3 py-2.5 font-mono text-[11px] text-[#6e7585]">{s.time}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Stub page ───────────────────────────────────────────────────────────────

export function StubPage({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
      <div className="text-4xl opacity-40">{icon}</div>
      <div className="font-['Syne'] text-base font-bold text-[#f2f2f7]">{title}</div>
      <div className="max-w-[240px] text-[12px] text-[#6e7585]">{subtitle}</div>
    </div>
  );
}
