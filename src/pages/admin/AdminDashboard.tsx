import { useState } from "react";
import { AdminSidebar, Page } from "./components/AdminSidebar";
import { PatientDetailPanel } from "./components/PatientDetailPanel";
import { AddPatientModal } from "./components/AddPatientModal";
import { DashboardPage } from "./DashboardPage";
import { PatientsPage } from "./PatientsPage";
import { AlertsPage, AnalyticsPage, AIPage, ScansPage, StubPage } from "./SubPages";
import { AdminPatient } from "./data";

const PAGE_TITLES: Record<Page, string> = {
  dashboard: "Dashboard",   analytics: "Analytics",
  alerts: "Alerts",         patients: "Patients",
  medications: "Medications",reminders: "Reminders",
  ai: "AI Overview",        scans: "Scan Activity",
  interactions: "Drug Interactions", settings: "Settings",
};

export default function AdminDashboard() {
  const [page, setPage] = useState<Page>("dashboard");
  const [selectedPatient, setSelectedPatient] = useState<AdminPatient | null>(null);
  const [addPatientOpen, setAddPatientOpen] = useState(false);

  const now = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="flex min-h-screen bg-[#080c14] text-[#f2f2f7]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Sidebar */}
      <AdminSidebar active={page} onNavigate={setPage} />

      {/* Main */}
      <div className="ml-[240px] flex flex-1 flex-col min-h-screen">
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-[60px] items-center justify-between border-b border-white/[0.07] bg-[rgba(8,12,20,0.85)] px-7 backdrop-blur-[14px]">
          <div>
            <div className="font-['Syne'] text-[17px] font-bold leading-none tracking-[-0.3px]">
              {PAGE_TITLES[page]}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-[#6e7585]">
              {now}
              <span className="mx-1">·</span>
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#30d158] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#30d158]" />
              </span>
              Live
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-[#111827] px-3 py-1.5 focus-within:border-[#0a84ff] transition-colors">
              <span className="text-[13px] text-[#6e7585]">🔍</span>
              <input
                placeholder="Search patients, meds…"
                className="w-44 bg-transparent text-[12px] text-[#f2f2f7] outline-none placeholder:text-[#6e7585]"
              />
            </div>
            {/* Notifications */}
            <button
              onClick={() => setPage("alerts")}
              className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-[#111827] text-sm transition-colors hover:border-white/[0.12]"
            >
              🔔
              <span className="absolute right-[5px] top-[5px] h-1.5 w-1.5 rounded-full bg-[#ff453a] shadow-[0_0_5px_#ff453a]" />
            </button>
            {/* CTA */}
            <button
              onClick={() => setAddPatientOpen(true)}
              className="rounded-lg bg-[#0a84ff] px-3 py-1.5 text-[12px] font-semibold text-white shadow-[0_0_14px_rgba(10,132,255,0.35)] transition-all hover:-translate-y-px hover:opacity-90"
            >
              + Add Patient
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex flex-1 flex-col overflow-y-auto">
          {page === "dashboard"    && <DashboardPage onPatientClick={setSelectedPatient} onNavigate={(p) => setPage(p as Page)} />}
          {page === "analytics"   && <AnalyticsPage />}
          {page === "patients"    && <PatientsPage onPatientClick={setSelectedPatient} onAddPatient={() => setAddPatientOpen(true)} />}
          {page === "alerts"      && <AlertsPage />}
          {page === "ai"          && <AIPage />}
          {page === "scans"       && <ScansPage />}
          {page === "medications" && <StubPage icon="💊" title="Medications" subtitle="Full medication management coming soon." />}
          {page === "reminders"   && <StubPage icon="⏰" title="Reminders" subtitle="Reminder management and scheduling coming soon." />}
          {page === "interactions"&& <StubPage icon="⚗️" title="Drug Interactions" subtitle="Full interaction checker coming soon." />}
          {page === "settings"    && <StubPage icon="🏥" title="Settings" subtitle="Clinic configuration and integrations coming soon." />}
        </main>
      </div>

      {/* Overlays */}
      <PatientDetailPanel patient={selectedPatient} onClose={() => setSelectedPatient(null)} />
      <AddPatientModal open={addPatientOpen} onClose={() => setAddPatientOpen(false)} />
    </div>
  );
}
