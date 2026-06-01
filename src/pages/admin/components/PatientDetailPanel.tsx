import { AdminPatient, adherenceColor } from "../data";
import { AdminBadge } from "./AdminBadge";
import { X } from "@/lib/icons";

type Props = { patient: AdminPatient | null; onClose: () => void };

export function PatientDetailPanel({ patient: p, onClose }: Props) {
  const open = !!p;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-[380px] flex-col overflow-y-auto border-l border-white/[0.12] bg-[#0d1320] transition-transform duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {p && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between border-b border-white/[0.07] p-5">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[11px] font-['Syne'] text-base font-extrabold"
                  style={{ background: `${p.color}22`, color: p.color }}
                >
                  {p.initials}
                </div>
                <div>
                  <div className="font-['Syne'] text-base font-bold">{p.name}</div>
                  <div className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-[#6e7585]">
                    {p.id}
                    <AdminBadge variant={({ active: "green", alert: "red", warning: "amber", inactive: "muted" } as const)[p.status]}>
                      {p.status.toUpperCase()}
                    </AdminBadge>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.07] bg-[#111827] text-[#6e7585] transition-colors hover:border-[rgba(255,69,58,0.3)] hover:bg-[rgba(255,69,58,0.12)] hover:text-[#ff453a]"
              >
                <X size={13} />
              </button>
            </div>

            <div className="flex-1 p-5 space-y-6">
              {/* Personal info */}
              <section>
                <div className="mb-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#6e7585]">Personal Info</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Age", value: `${p.age} years old` },
                    { label: "Gender", value: p.gender === "F" ? "Female" : "Male" },
                    { label: "Phone", value: p.phone },
                    { label: "Ward", value: p.ward },
                  ].map((f) => (
                    <div key={f.label} className="rounded-lg bg-[#111827] p-2.5">
                      <div className="mb-1 text-[10px] text-[#6e7585]">{f.label}</div>
                      <div className="text-[13px] font-semibold font-mono">{f.value}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Condition */}
              <section>
                <div className="mb-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#6e7585]">Condition</div>
                <div className="rounded-lg bg-[#111827] p-2.5">
                  <div className="mb-1 text-[10px] text-[#6e7585]">Primary Diagnosis</div>
                  <div className="text-[13px] font-semibold">{p.condition}</div>
                </div>
              </section>

              {/* Medications */}
              <section>
                <div className="mb-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#6e7585]">Current Medications</div>
                <div className="space-y-2">
                  {p.meds.map((m) => (
                    <div key={m} className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-[#111827] px-3 py-2.5">
                      <div>
                        <div className="text-[12px] font-semibold">{m}</div>
                        <div className="font-mono text-[10.5px] text-[#6e7585]">Active prescription</div>
                      </div>
                      <AdminBadge variant="green">Active</AdminBadge>
                    </div>
                  ))}
                </div>
              </section>

              {/* 30-day adherence heatmap */}
              <section>
                <div className="mb-2.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#6e7585]">Adherence — Last 30 Days</div>
                <div className="mb-3 flex items-center gap-3">
                  <span
                    className="font-['Syne'] text-[28px] font-extrabold leading-none tracking-tighter"
                    style={{ color: adherenceColor(p.adherence) }}
                  >
                    {p.adherence}%
                  </span>
                  <span className="text-[11px] text-[#6e7585]">Overall adherence<br />this month</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: 30 }, (_, i) => {
                    const v = Math.random();
                    const bg = v > 0.7 ? "#30d158" : v > 0.4 ? "#ffd60a" : "#ff453a";
                    return (
                      <div
                        key={i}
                        title={`${Math.round(v * 100)}% adherence`}
                        className="h-3.5 w-3.5 cursor-pointer rounded-[3px] transition-transform hover:scale-125"
                        style={{ background: bg, opacity: v > 0.7 ? 1 : v > 0.4 ? 0.7 : 0.5 }}
                      />
                    );
                  })}
                </div>
              </section>
            </div>

            {/* Footer actions */}
            <div className="border-t border-white/[0.07] p-4 flex gap-2">
              <button className="flex-1 rounded-lg bg-[#0a84ff] py-2 text-[12.5px] font-semibold text-white shadow-[0_0_14px_rgba(10,132,255,0.35)] transition-opacity hover:opacity-90">
                📞 Contact Patient
              </button>
              <button className="rounded-lg border border-white/[0.07] bg-[#111827] px-3 py-2 text-[12.5px] font-semibold text-[#6e7585] transition-colors hover:border-white/[0.12] hover:text-[#f2f2f7]">
                Edit
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
