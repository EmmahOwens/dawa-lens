import { useState, useMemo } from "react";
import { ADMIN_PATIENTS, AdminPatient } from "../data";
import { PatientRow } from "../components/PatientRow";

type Props = { onPatientClick: (p: AdminPatient) => void; onAddPatient: () => void };

export function PatientsPage({ onPatientClick, onAddPatient }: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [condFilter, setCondFilter] = useState("");

  const filtered = useMemo(() => {
    return ADMIN_PATIENTS.filter((p) => {
      const q = query.toLowerCase();
      const matchQ = !q || p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || p.condition.toLowerCase().includes(q);
      const matchS = !statusFilter || p.status === statusFilter;
      const matchC = !condFilter || p.condition.includes(condFilter);
      return matchQ && matchS && matchC;
    });
  }, [query, statusFilter, condFilter]);

  const selectCls = "rounded-lg border border-white/[0.07] bg-[#111827] px-3 py-1.5 text-[12px] text-[#f2f2f7] outline-none focus:border-[#0a84ff] transition-colors cursor-pointer";

  return (
    <div className="p-7">
      {/* Filter row */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="flex flex-1 max-w-xs items-center gap-2 rounded-lg border border-white/[0.07] bg-[#111827] px-3 py-1.5 focus-within:border-[#0a84ff] transition-colors">
          <span className="text-[13px] text-[#6e7585]">🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, ID, condition…"
            className="flex-1 bg-transparent text-[12.5px] text-[#f2f2f7] outline-none placeholder:text-[#6e7585]"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="alert">Alert</option>
          <option value="warning">Warning</option>
          <option value="inactive">Inactive</option>
        </select>
        <select value={condFilter} onChange={(e) => setCondFilter(e.target.value)} className={selectCls}>
          <option value="">All conditions</option>
          <option value="Hypertension">Hypertension</option>
          <option value="Diabetes">Diabetes T2</option>
          <option value="HIV">HIV/ARV</option>
          <option value="TB">TB</option>
          <option value="Epilepsy">Epilepsy</option>
          <option value="Malaria">Malaria</option>
        </select>
        <div className="ml-auto flex gap-2">
          <button className="rounded-lg border border-white/[0.07] bg-[#111827] px-3 py-1.5 text-[12px] font-semibold text-[#6e7585] hover:text-[#f2f2f7]">
            ⬇ Export
          </button>
          <button onClick={onAddPatient} className="rounded-lg bg-[#0a84ff] px-3 py-1.5 text-[12px] font-semibold text-white shadow-[0_0_14px_rgba(10,132,255,0.35)] hover:opacity-90">
            + Add Patient
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0d1320] overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <div>
            <div className="font-['Syne'] text-[13.5px] font-bold">All Patients</div>
            <div className="mt-0.5 text-[11px] text-[#6e7585]">{filtered.length} patient{filtered.length !== 1 ? "s" : ""}</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Patient", "Age / Gender", "Condition", "Medications", "Adherence", "Status", "Last Active", ""].map(h => (
                  <th key={h} className="border-b border-white/[0.07] px-3 py-2.5 text-left font-mono text-[9px] font-medium uppercase tracking-[0.1em] text-[#6e7585]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <PatientRow key={p.id} patient={p} showExtra onClick={onPatientClick} />
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-center text-[#6e7585]">
              <div className="text-3xl opacity-40">👥</div>
              <div className="font-['Syne'] text-sm font-bold">No patients found</div>
              <div className="text-[11px]">Try adjusting your search or filters</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
