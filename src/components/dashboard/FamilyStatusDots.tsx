import { useNavigate } from "react-router-dom";
import { Patient, useApp } from "@/contexts/AppContext";
import { UserPlus } from "lucide-react";

interface FamilyStatusDotsProps {
  patients: Patient[];
  onSelect: (id: string | null) => void;
  selectedId: string | null;
}

/** Returns "green" | "warning" | "grey" based on today's dose adherence for a patientId */
function getAdherenceStatus(
  patientId: string | null,
  reminders: ReturnType<typeof useApp>["reminders"],
  doseLogs: ReturnType<typeof useApp>["doseLogs"]
): "green" | "warning" | "grey" {
  const memberReminders = reminders.filter((r) => {
    if (patientId === null) return !r["patientId"]; // self
    return r["patientId"] === patientId;
  });

  const activeReminders = memberReminders.filter((r) => r.enabled);
  if (activeReminders.length === 0) return "grey";

  const today = new Date().toDateString();
  const takenToday = doseLogs.filter(
    (l) =>
      l.action === "taken" &&
      new Date(l.actionTime).toDateString() === today &&
      activeReminders.some((r) => r.id === l.reminderId)
  ).length;

  if (takenToday >= activeReminders.length) return "green";
  return "warning";
}

const statusDotClass: Record<"green" | "warning" | "grey", string> = {
  green: "bg-success",
  warning: "bg-warning animate-pulse",
  grey: "bg-muted-foreground/40",
};

export function FamilyStatusDots({ patients, onSelect, selectedId }: FamilyStatusDotsProps) {
  const navigate = useNavigate();
  const { reminders, doseLogs, userProfile } = useApp();

  const selfStatus = getAdherenceStatus(null, reminders, doseLogs);

  return (
    <div className="mb-6">
      <h2 className="section-title text-[10px] opacity-70 flex items-center gap-2 mb-3">
        Circle of Care
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {/* Self */}
        <button
          onClick={() => onSelect(null)}
          className="flex flex-col items-center gap-1.5 flex-shrink-0"
        >
          <div
            className={`relative w-12 h-12 rounded-full border-2 p-0.5 transition-all ${
              selectedId === null ? "border-primary scale-110" : "border-transparent"
            }`}
          >
            <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-sm overflow-hidden">
              {userProfile?.name?.charAt(0) || "M"}
            </div>
            <div
              className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-background ${statusDotClass[selfStatus]}`}
            />
          </div>
          <span
            className={`text-[9px] font-bold uppercase tracking-wider truncate max-w-[48px] ${
              selectedId === null ? "text-primary" : "text-muted-foreground"
            }`}
          >
            Me
          </span>
        </button>

        {patients.map((p) => {
          const status = getAdherenceStatus(p.id, reminders, doseLogs);
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="flex flex-col items-center gap-1.5 flex-shrink-0"
            >
              <div
                className={`relative w-12 h-12 rounded-full border-2 p-0.5 transition-all ${
                  selectedId === p.id ? "border-primary scale-110" : "border-transparent"
                }`}
              >
                <div className="w-full h-full rounded-full bg-accent flex items-center justify-center text-accent-foreground font-black text-sm">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div
                  className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-background ${statusDotClass[status]}`}
                />
              </div>
              <span
                className={`text-[9px] font-bold uppercase tracking-wider truncate max-w-[48px] ${
                  selectedId === p.id ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {p.name.split(" ")[0]}
              </span>
            </button>
          );
        })}

        {/* Add new — navigates to /family and opens the add sheet */}
        <button
          onClick={() => navigate("/family", { state: { openAdd: true } })}
          className="flex flex-col items-center gap-1.5 flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        >
          <div className="w-12 h-12 rounded-full border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors">
            <UserPlus size={16} />
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            Add
          </span>
        </button>
      </div>
    </div>
  );
}
