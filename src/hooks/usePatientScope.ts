/**
 * usePatientScope
 *
 * Single source of truth for the currently selected patient context.
 * Replaces the duplicated matchPatient + scoped-data pattern that existed
 * in Dashboard, ReportPage, HistoryPage, and RemindersPage.
 *
 * Usage:
 *   const { resolvedPatient, scopedMedicines, scopedReminders, scopedDoseLogs, scopedWellnessLogs } = usePatientScope();
 */

import { useCallback, useMemo } from "react";
import { useApp } from "@/contexts/AppContext";

/**
 * A unified patient profile that works for both the account owner (host)
 * and any family member or client they manage.
 */
export interface ResolvedPatient {
  /** Firestore patient document ID, or null when viewing the host's own profile */
  id: string | null;
  name: string;
  /** Age in years, derived from dateOfBirth if available, otherwise from stored age */
  age?: number;
  gender?: "male" | "female" | "other" | null;
  /** e.g. "Mother", "Client", "Primary User" */
  relation?: string;
  /** "self" = account owner; "family" = family member; "client" = professional client */
  type: "self" | "family" | "client";
  /** Tailwind color key: "blue" | "rose" | "amber" | "emerald" | "violet" | "slate" */
  color?: string;
  /** Chronic conditions — fed to AI reports and interaction checks */
  conditions?: string[];
  /** Drug/food allergies — fed to AI reports */
  allergies?: string[];
  /** For clinical (CHW/Professional) mode */
  bloodType?: string;
  /** Caregiver notes */
  notes?: string;
  /** true when the profile is the account owner themselves */
  isOwner: boolean;
}

export function usePatientScope() {
  const {
    medicines,
    reminders,
    doseLogs,
    wellnessLogs,
    patients,
    selectedPatientId,
    userProfile,
  } = useApp();

  /**
   * Returns true when a data record's patientId matches the currently active profile.
   * null patientId → belongs to the account owner.
   * string patientId → belongs to a managed patient.
   */
  const matchPatient = useCallback(
    (pid?: string | null) => (pid ?? null) === (selectedPatientId ?? null),
    [selectedPatientId]
  );

  /** Fully resolved profile for the active context (host or patient). */
  const resolvedPatient = useMemo<ResolvedPatient>(() => {
    if (selectedPatientId) {
      const p = patients.find((pt) => pt.id === selectedPatientId);
      if (p) {
        // Prefer dateOfBirth for an accurate age calculation; fall back to stored age
        const age = p.dateOfBirth
          ? new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear()
          : p.age;
        return {
          id: p.id,
          name: p.name,
          age,
          gender: p.gender,
          relation: p.relation,
          type: p.type ?? "family",
          color: p.color,
          conditions: p.conditions,
          allergies: p.allergies,
          bloodType: p.bloodType,
          notes: p.notes,
          isOwner: false,
        };
      }
    }

    // Host / account owner
    const ownerAge = userProfile?.dateOfBirth
      ? new Date().getFullYear() - new Date(userProfile.dateOfBirth).getFullYear()
      : undefined;

    return {
      id: userProfile?.id ?? null,
      name: userProfile?.name ?? "You",
      age: ownerAge,
      gender: userProfile?.gender ?? null,
      relation: "Primary User",
      type: "self",
      isOwner: true,
    };
  }, [selectedPatientId, patients, userProfile]);

  const scopedMedicines = useMemo(
    () => medicines.filter((m) => matchPatient(m.patientId)),
    [medicines, matchPatient]
  );

  const scopedReminders = useMemo(
    () => reminders.filter((r) => matchPatient(r.patientId)),
    [reminders, matchPatient]
  );

  const scopedDoseLogs = useMemo(
    () => doseLogs.filter((l) => matchPatient(l.patientId)),
    [doseLogs, matchPatient]
  );

  const scopedWellnessLogs = useMemo(
    () => wellnessLogs.filter((l) => matchPatient(l.patientId)),
    [wellnessLogs, matchPatient]
  );

  return {
    resolvedPatient,
    matchPatient,
    scopedMedicines,
    scopedReminders,
    scopedDoseLogs,
    scopedWellnessLogs,
  };
}
