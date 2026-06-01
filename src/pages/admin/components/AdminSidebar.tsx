import { cn } from "@/lib/utils";

type Page =
  | "dashboard" | "analytics" | "alerts" | "patients"
  | "medications" | "reminders" | "ai" | "scans"
  | "interactions" | "settings";

type NavItem = { id: Page; icon: string; label: string; badge?: string; badgeVariant?: "red" | "green" | "blue" };

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Overview",
    items: [
      { id: "dashboard",  icon: "⬛", label: "Dashboard" },
      { id: "analytics",  icon: "📊", label: "Analytics" },
      { id: "alerts",     icon: "🔔", label: "Alerts",    badge: "7",   badgeVariant: "red" },
    ],
  },
  {
    section: "Patient Care",
    items: [
      { id: "patients",     icon: "👥", label: "Patients",     badge: "342", badgeVariant: "green" },
      { id: "medications",  icon: "💊", label: "Medications" },
      { id: "reminders",    icon: "⏰", label: "Reminders" },
    ],
  },
  {
    section: "AI & Technology",
    items: [
      { id: "ai",           icon: "🤖", label: "AI Overview" },
      { id: "scans",        icon: "📷", label: "Scan Activity" },
      { id: "interactions", icon: "⚗️", label: "Drug Interactions" },
    ],
  },
  {
    section: "System",
    items: [
      { id: "settings", icon: "🏥", label: "Settings" },
    ],
  },
];

const badgeStyle = {
  red:   "bg-[rgba(255,69,58,0.12)]  text-[#ff453a] border-[rgba(255,69,58,0.25)]",
  green: "bg-[rgba(48,209,88,0.12)]  text-[#30d158] border-[rgba(48,209,88,0.25)]",
  blue:  "bg-[rgba(10,132,255,0.12)] text-[#0a84ff] border-[rgba(10,132,255,0.25)]",
};

type Props = { active: Page; onNavigate: (p: Page) => void };

export function AdminSidebar({ active, onNavigate }: Props) {
  return (
    <aside className="fixed bottom-0 left-0 top-0 z-30 flex w-[240px] flex-col border-r border-white/[0.07] bg-[#0d1320]">
      {/* Logo */}
      <div className="border-b border-white/[0.07] px-5 pb-4 pt-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] bg-[#0a84ff] text-lg shadow-[0_0_20px_rgba(10,132,255,0.35)]">
            💊
          </div>
          <div>
            <div className="font-['Syne'] text-[17px] font-extrabold leading-none tracking-[-0.3px]">
              Dawa<span className="text-[#0a84ff]">Lens</span>
            </div>
            <span className="mt-1 inline-block rounded-[4px] border border-[rgba(10,132,255,0.3)] bg-[rgba(10,132,255,0.12)] px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[0.08em] text-[#0a84ff]">
              ADMIN PORTAL
            </span>
          </div>
        </div>
        {/* Status */}
        <div className="mt-2.5 flex items-center gap-1.5 rounded-md border border-[rgba(48,209,88,0.2)] bg-[rgba(48,209,88,0.1)] px-2.5 py-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#30d158] opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#30d158]" />
          </span>
          <span className="font-mono text-[10px] text-[#30d158]">All systems operational</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        {NAV.map((group) => (
          <div key={group.section} className="mb-2">
            <div className="px-2.5 pb-1.5 pt-2.5 font-mono text-[9px] font-medium uppercase tracking-[0.15em] text-[#6e7585]">
              {group.section}
            </div>
            {group.items.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "mb-0.5 flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-[13px] font-medium transition-all",
                  active === item.id
                    ? "border-[rgba(10,132,255,0.2)] bg-[rgba(10,132,255,0.12)] text-[#0a84ff]"
                    : "border-transparent text-[#6e7585] hover:bg-[#111827] hover:text-[#f2f2f7]"
                )}
              >
                <span className="w-[18px] flex-shrink-0 text-center text-[15px]">{item.icon}</span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span className={cn("rounded-[4px] border px-1.5 py-0.5 font-mono text-[9px] font-semibold", badgeStyle[item.badgeVariant!])}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* Admin profile */}
      <div className="border-t border-white/[0.07] p-3.5">
        <div className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-[#111827] px-2.5 py-2.5 transition-colors hover:bg-[#161d2e]">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#0a84ff] to-[#bf5af2] font-['Syne'] text-[12px] font-extrabold">
            DA
          </div>
          <div>
            <div className="text-[12px] font-semibold">Dr. Amara</div>
            <div className="font-mono text-[10px] text-[#6e7585]">SUPER ADMIN</div>
          </div>
          <span className="ml-auto text-[14px] text-[#6e7585]">⋮</span>
        </div>
      </div>
    </aside>
  );
}

export type { Page };
