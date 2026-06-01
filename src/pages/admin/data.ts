// ─── Shared types ───────────────────────────────────────────────────────────

export type AdminPatient = {
  id: string;
  name: string;
  initials: string;
  color: string;
  age: number;
  gender: "M" | "F";
  condition: string;
  meds: string[];
  adherence: number;
  status: "active" | "alert" | "warning" | "inactive";
  lastActive: string;
  phone: string;
  ward: string;
};

export type AdminScan = {
  medication: string;
  patientId: string;
  confidence: number;
  model: string;
  ocrText: string;
  matched: boolean;
  time: string;
};

export type AdminAlert = {
  severity: "crit" | "warn" | "info";
  icon: string;
  title: string;
  description: string;
  meta: string;
  time: string;
  tag: string;
};

export type DrugInteraction = {
  drugs: string;
  severity: "major" | "moderate" | "minor";
  description: string;
  cases: number;
};

// ─── Mock data ───────────────────────────────────────────────────────────────

export const ADMIN_PATIENTS: AdminPatient[] = [
  { id: "P-0012", name: "Grace Nakato",    initials: "GN", color: "#0a84ff", age: 38, gender: "F", condition: "Hypertension",   meds: ["Lisinopril 10mg", "Hydrochlorothiazide"], adherence: 91, status: "active",  lastActive: "2m ago",  phone: "+256 701 112 233", ward: "OPD" },
  { id: "P-0091", name: "Samuel Okello",   initials: "SO", color: "#ff453a", age: 54, gender: "M", condition: "Diabetes T2",    meds: ["Metformin 500mg", "Glibenclamide"],        adherence: 43, status: "alert",   lastActive: "18m ago", phone: "+256 782 445 661", ward: "Ward B" },
  { id: "P-0147", name: "Fatuma Achieng",  initials: "FA", color: "#bf5af2", age: 29, gender: "F", condition: "HIV/ARV",         meds: ["TDF/3TC/EFV", "Cotrimoxazole"],            adherence: 78, status: "active",  lastActive: "1h ago",  phone: "+256 754 887 009", ward: "ART Clinic" },
  { id: "P-0203", name: "James Wekesa",    initials: "JW", color: "#30d158", age: 16, gender: "M", condition: "Epilepsy",        meds: ["Phenobarbital 30mg", "Carbamazepine"],     adherence: 96, status: "active",  lastActive: "3h ago",  phone: "+256 703 321 445", ward: "Paediatric" },
  { id: "P-0258", name: "Harriet Atim",    initials: "HA", color: "#ffd60a", age: 42, gender: "F", condition: "Malaria (prev)",  meds: ["Amlodipine 5mg"],                          adherence: 62, status: "warning", lastActive: "5h ago",  phone: "+256 779 556 120", ward: "OPD" },
  { id: "P-0311", name: "David Mugisha",   initials: "DM", color: "#ff9f0a", age: 31, gender: "M", condition: "TB",              meds: ["Rifampicin", "Isoniazid", "Pyrazinamide"], adherence: 88, status: "active",  lastActive: "6h ago",  phone: "+256 706 234 789", ward: "TB Clinic" },
  { id: "P-0334", name: "Prossy Nambi",    initials: "PN", color: "#5ac8fa", age: 61, gender: "F", condition: "Hypertension",   meds: ["Amlodipine 5mg", "Atenolol 50mg"],         adherence: 74, status: "warning", lastActive: "8h ago",  phone: "+256 714 009 334", ward: "OPD" },
  { id: "P-0378", name: "Ronald Asiimwe",  initials: "RA", color: "#34c759", age: 47, gender: "M", condition: "Diabetes T2",    meds: ["Metformin 1000mg", "Insulin Glargine"],    adherence: 55, status: "alert",   lastActive: "12h ago", phone: "+256 701 667 221", ward: "Ward A" },
  { id: "P-0412", name: "Lydia Ochieng",   initials: "LO", color: "#af52de", age: 23, gender: "F", condition: "HIV/ARV",         meds: ["TDF/3TC/DTG"],                             adherence: 95, status: "active",  lastActive: "14h ago", phone: "+256 788 121 554", ward: "ART Clinic" },
  { id: "P-0455", name: "Moses Nkrumah",   initials: "MN", color: "#ff6b35", age: 8,  gender: "M", condition: "Epilepsy",        meds: ["Phenobarbital 15mg"],                      adherence: 82, status: "active",  lastActive: "1d ago",  phone: "+256 703 448 876", ward: "Paediatric" },
];

export const ADMIN_SCANS: AdminScan[] = [
  { medication: "Metformin 500mg",    patientId: "P-0091", confidence: 98, model: "Llama 4",  ocrText: "MET 500",   matched: true,  time: "4m ago" },
  { medication: "Amlodipine 5mg",     patientId: "P-0258", confidence: 95, model: "Llama 4",  ocrText: "AMLOD 5MG", matched: true,  time: "12m ago" },
  { medication: "Unknown tablet",     patientId: "P-0034", confidence: 41, model: "Gemini",   ocrText: "???",       matched: false, time: "28m ago" },
  { medication: "Cotrimoxazole",      patientId: "P-0147", confidence: 99, model: "Llama 4",  ocrText: "CTX 480",   matched: true,  time: "1h ago" },
  { medication: "Phenobarbital 30mg", patientId: "P-0203", confidence: 93, model: "Llama 4",  ocrText: "PHENO 30",  matched: true,  time: "2h ago" },
  { medication: "Lisinopril 10mg",    patientId: "P-0012", confidence: 97, model: "Llama 4",  ocrText: "LISINO 10", matched: true,  time: "3h ago" },
  { medication: "Rifampicin 150mg",   patientId: "P-0311", confidence: 91, model: "Llama 4",  ocrText: "RIF 150",   matched: true,  time: "4h ago" },
  { medication: "Warfarin 5mg",       patientId: "P-0147", confidence: 67, model: "Gemini",   ocrText: "WARF 5",    matched: false, time: "5h ago" },
];

export const ADMIN_ALERTS: AdminAlert[] = [
  { severity: "crit", icon: "🚨", title: "Critical refill — Metformin",     description: "Patient Samuel Okello (P-0091) has only 2 days of Metformin 500mg remaining.", meta: "Condition: Diabetes T2 · Ward B",      time: "2m ago",  tag: "Refill" },
  { severity: "crit", icon: "⚡", title: "Drug interaction detected",         description: "Warfarin and Aspirin combination flagged for Fatuma Achieng (P-0147). Risk of serious bleeding.", meta: "Severity: Major · AI: Llama 4", time: "11m ago", tag: "Interaction" },
  { severity: "warn", icon: "⏰", title: "3 consecutive missed doses",        description: "Grace Nakato (P-0012) has missed Lisinopril 10mg for 3 days. Blood pressure risk elevated.", meta: "Condition: Hypertension · OPD",  time: "1h ago",  tag: "Adherence" },
  { severity: "warn", icon: "📦", title: "Low stock — Amlodipine 5mg",       description: "Clinic pharmacy stock will run out in 4 days. 4 patients are currently prescribed this.", meta: "Current stock: 14 tablets",         time: "3h ago",  tag: "Stock" },
  { severity: "warn", icon: "📉", title: "Adherence drop — Ronald Asiimwe",  description: "Patient P-0378 adherence dropped from 80% to 55% this week. Insulin Glargine doses being skipped.", meta: "Condition: Diabetes T2 · Ward A", time: "5h ago",  tag: "Adherence" },
  { severity: "info", icon: "📄", title: "Monthly report generated",          description: "May 2026 adherence summary is ready for download.", meta: "284 pages · PDF",                                                          time: "6h ago",  tag: "Report" },
  { severity: "info", icon: "🆕", title: "New patient registered",            description: "Lydia Ochieng (P-0412) completed onboarding and first pill scan.", meta: "Condition: HIV/ARV · ART Clinic",                   time: "14h ago", tag: "System" },
];

export const DRUG_INTERACTIONS: DrugInteraction[] = [
  { drugs: "Warfarin + Aspirin",        severity: "major",    description: "Increased risk of bleeding. Avoid combination if possible.", cases: 1 },
  { drugs: "Metformin + Ibuprofen",     severity: "moderate", description: "NSAIDs may reduce renal clearance of Metformin.", cases: 3 },
  { drugs: "ARV + Rifampicin",          severity: "major",    description: "Rifampicin induces CYP3A4, significantly reducing ARV levels.", cases: 2 },
  { drugs: "Phenobarbital + Warfarin",  severity: "moderate", description: "Phenobarbital increases Warfarin metabolism; monitor INR.", cases: 1 },
  { drugs: "Amlodipine + Grapefruit",   severity: "minor",    description: "Grapefruit juice may increase Amlodipine plasma levels.", cases: 4 },
  { drugs: "Lisinopril + Potassium",    severity: "moderate", description: "ACE inhibitors may cause hyperkalaemia with potassium supplements.", cases: 3 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function adherenceColor(v: number) {
  return v >= 80 ? "#30d158" : v >= 60 ? "#ffd60a" : "#ff453a";
}

export function statusVariant(s: AdminPatient["status"]): "default" | "destructive" | "secondary" | "outline" {
  const map: Record<AdminPatient["status"], "default" | "destructive" | "secondary" | "outline"> = {
    active: "default", alert: "destructive", warning: "secondary", inactive: "outline",
  };
  return map[s];
}
