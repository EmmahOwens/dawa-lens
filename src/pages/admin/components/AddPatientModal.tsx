import { X } from "@/lib/icons";

type Props = { open: boolean; onClose: () => void };

export function AddPatientModal({ open, onClose }: Props) {
  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      onClick={onClose}
    >
      <div
        className={`w-[480px] max-w-[92vw] overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0d1320] transition-transform duration-200 ${open ? "scale-100" : "scale-95"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
          <span className="font-['Syne'] text-base font-bold">Add New Patient</span>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.07] bg-[#111827] text-[#6e7585] hover:bg-[rgba(255,69,58,0.12)] hover:text-[#ff453a]"
          >
            <X size={13} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name" placeholder="e.g. Grace" />
            <Field label="Last Name"  placeholder="e.g. Nakato" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date of Birth" type="date" />
            <Field label="Gender" as="select">
              <option>Female</option><option>Male</option><option>Other</option>
            </Field>
          </div>
          <Field label="Primary Condition" as="select">
            <option>Hypertension</option><option>Diabetes T2</option><option>HIV/ARV</option>
            <option>TB</option><option>Epilepsy</option><option>Malaria</option><option>Other</option>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone Number" placeholder="+256 700 000000" />
            <Field label="Ward / Unit"  placeholder="e.g. Ward B" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-white/[0.07] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-white/[0.07] bg-[#111827] px-4 py-2 text-[12px] font-semibold text-[#6e7585] hover:border-white/[0.12] hover:text-[#f2f2f7]"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-[#0a84ff] px-4 py-2 text-[12px] font-semibold text-white shadow-[0_0_14px_rgba(10,132,255,0.35)] hover:opacity-90"
          >
            Create Patient →
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, placeholder, type = "text", as, children }: {
  label: string; placeholder?: string; type?: string;
  as?: "select"; children?: React.ReactNode;
}) {
  const cls = "w-full rounded-lg border border-white/[0.07] bg-[#111827] px-3 py-2.5 text-[13px] text-[#f2f2f7] outline-none placeholder-[#6e7585] focus:border-[#0a84ff] transition-colors";
  return (
    <div>
      <label className="mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-[0.04em] text-[#6e7585]">{label}</label>
      {as === "select"
        ? <select className={cls}>{children}</select>
        : <input className={cls} type={type} placeholder={placeholder} />
      }
    </div>
  );
}
