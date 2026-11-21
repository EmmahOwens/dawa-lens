import { format, subDays, isSameDay } from "date-fns";
import { toDate } from "./utils";
import { DoseLog, WellnessLog } from "../contexts/AppContext";
import { wasmComputeVitality } from "./dawaWasm";

export interface VitalityDataPoint {
  name: string;
  adherence: number;
  energy: number | null;
  mood: number | null;
}

function toDayKey(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/**
 * Calculates a 7-day vitality summary (adherence, energy, mood)
 * based on provided dose logs and wellness logs.
 * Delegates the multi-day aggregation to the compiled Rust WASM engine
 * in a single O(N) pass, with an identical JS fallback.
 */
export function calculateVitalitySummary(
  doseLogs: DoseLog[] = [],
  wellnessLogs: WellnessLog[] = []
): VitalityDataPoint[] {
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => subDays(now, 6 - i));
  const dayKeys = days.map(toDayKey);
  const dayNames = days.map((d) => format(d, "MMM dd"));
  const minDayKey = dayKeys[0];

  // Fast path: single-pass Rust WASM aggregation
  const compactDoses: Array<{ dayKey: number; taken: boolean }> = [];
  for (const l of doseLogs || []) {
    const dt = toDate(l.actionTime);
    if (!isNaN(dt.getTime())) {
      const k = toDayKey(dt);
      if (k >= minDayKey) {
        compactDoses.push({ dayKey: k, taken: l.action === "taken" });
      }
    }
  }

  const compactWellness: Array<{
    dayKey: number;
    ts: number;
    mood: number | null;
    energy: number | null;
  }> = [];
  for (const l of wellnessLogs || []) {
    if (l.type !== "symptom") continue;
    const dt = toDate(l.timestamp);
    const ts = dt.getTime();
    if (!isNaN(ts)) {
      const k = toDayKey(dt);
      if (k >= minDayKey) {
        const rawEnergy = l.data?.energy != null ? Number(l.data.energy) : NaN;
        const rawMood = l.data?.mood != null ? Number(l.data.mood) : NaN;
        compactWellness.push({
          dayKey: k,
          ts,
          energy: !isNaN(rawEnergy) && rawEnergy > 0 ? rawEnergy : null,
          mood: !isNaN(rawMood) && rawMood > 0 ? rawMood : null,
        });
      }
    }
  }

  const wasmResult = wasmComputeVitality({
    dayKeys,
    dayNames,
    doseLogs: compactDoses,
    wellnessLogs: compactWellness,
  });
  if (wasmResult && wasmResult.length === 7) {
    return wasmResult;
  }

  // Fallback pure JS implementation
  return days.map((date, i) => {
    const dayStr = dayNames[i];

    const dayLogs = (doseLogs || []).filter((l) =>
      isSameDay(toDate(l.actionTime), date)
    );
    const taken = dayLogs.filter((l) => l.action === "taken").length;
    const total = dayLogs.length;
    const adherence = total > 0 ? (taken / total) * 100 : 100;

    const dayWellnessLogs = (wellnessLogs || []).filter(
      (l) => l.type === "symptom" && isSameDay(toDate(l.timestamp), date)
    );

    let energy: number | null = null;
    let mood: number | null = null;

    if (dayWellnessLogs.length > 0) {
      const sortedLogs = [...dayWellnessLogs].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      const validEnergyLogs = sortedLogs.filter(
        (l) => l.data?.energy != null && !isNaN(Number(l.data.energy)) && Number(l.data.energy) > 0
      );
      const validMoodLogs = sortedLogs.filter(
        (l) => l.data?.mood != null && !isNaN(Number(l.data.mood)) && Number(l.data.mood) > 0
      );

      if (validEnergyLogs.length > 0) {
        const latestEnergy = Number(validEnergyLogs[validEnergyLogs.length - 1].data?.energy);
        const integerEnergy = Math.max(1, Math.min(5, Math.round(latestEnergy)));
        energy = integerEnergy * 20;
      }

      if (validMoodLogs.length > 0) {
        const latestMood = Number(validMoodLogs[validMoodLogs.length - 1].data?.mood);
        const integerMood = Math.max(1, Math.min(5, Math.round(latestMood)));
        mood = integerMood * 20;
      }
    }

    return { name: dayStr, adherence, energy, mood };
  });
}
