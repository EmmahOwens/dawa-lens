import { AdminPatient, adherenceColor } from "../data";
import { AdminBadge } from "./AdminBadge";

type Props = {
  patient: AdminPatient;
  showExtra?: boolean;
  onClick: (p: AdminPatient) => void;
};

const statusVariant = (s: AdminPatient["status"]) =>
  ({ active: "green", alert: "red", warning: "amber", inactive: "muted" } as const)[s];

export function PatientRow({ patient: p, showExtra = false, onClick }: Props) {
  const color = adherenceColor(p.adherence);
  return (
    <tr
      className="cursor-pointer border-b border-white/[0.04] transition-colors hover:bg-[#111827]"
      onClick={() => onClick(p)}
    >
      {/* Patient cell */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-[6px] font-['Syne'] text-[10px] font-bold"
            style={{ background: `${p.color}22`, color: p.color }}
          >
            {p.initials}
          </div>
          <div>
            <div className="text-[12.5px] font-semibold">{p.name}</div>
            <div className="font-mono text-[10px] text-[#6e7585]">{p.id}</div>
          </div>
        </div>
      </td>

      {showExtra && (
        <>
          <td className="px-3 py-2.5 text-[12px] text-[#6e7585]">
            {p.age}y · {p.gender === "F" ? "Female" : "Male"}
          </td>
          <td className="px-3 py-2.5">
            <AdminBadge>{p.condition}</AdminBadge>
          </td>
          <td className="px-3 py-2.5 text-[11px] text-[#6e7585]">
            {p.meds.length} med{p.meds.length > 1 ? "s" : ""}
          </td>
        </>
      )}

      {!showExtra && (
        <td className="px-3 py-2.5">
          <AdminBadge>{p.condition}</AdminBadge>
        </td>
      )}

      {/* Adherence mini bar */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="h-1 w-14 overflow-hidden rounded-full bg-[#111827]">
            <div className="h-full rounded-full" style={{ width: `${p.adherence}%`, background: color }} />
          </div>
          <span className="font-mono text-[11.5px] font-medium" style={{ color }}>{p.adherence}%</span>
        </div>
      </td>

      <td className="px-3 py-2.5">
        <AdminBadge variant={statusVariant(p.status)}>{p.status.toUpperCase()}</AdminBadge>
      </td>

      <td className="px-3 py-2.5 font-mono text-[11px] text-[#6e7585]">{p.lastActive}</td>

      {showExtra && (
        <td className="px-3 py-2.5 text-right">
          <button
            className="rounded-lg border border-white/[0.07] bg-[#111827] px-2 py-1 text-[10px] font-semibold text-[#6e7585] transition-colors hover:border-white/[0.12] hover:text-[#f2f2f7]"
            onClick={(e) => { e.stopPropagation(); onClick(p); }}
          >
            View →
          </button>
        </td>
      )}
    </tr>
  );
}
