import { format, subDays, isSameDay } from "date-fns";
import { toDate } from "./utils";
import { DoseLog, WellnessLog } from "../contexts/AppContext";

export interface VitalityDataPoint {
  name: string;
  adherence: number;
  energy: number | null;
  mood: number | null;
}

/**
 * Calculates a 7-day vitality summary (adherence, energy, mood)
 * based on provided dose logs and wellness logs.
 */
export function calculateVitalitySummary(
  doseLogs: DoseLog[] = [],
  wellnessLogs: WellnessLog[] = []
): VitalityDataPoint[] {
  return Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dayStr = format(date, "MMM dd");

    // Adherence Calculation
    const dayLogs = (doseLogs || []).filter((l) =>
      isSameDay(toDate(l.actionTime), date)
    );
    const taken = dayLogs.filter((l) => l.action === "taken").length;
    const total = dayLogs.length;
    const adherence = total > 0 ? (taken / total) * 100 : 100;

    // Wellness Calculation (Mood & Energy)
    const dayWellnessLogs = (wellnessLogs || []).filter(
      (l) => l.type === "symptom" && isSameDay(toDate(l.timestamp), date)
    );

    let energy: number | null = null;
    let mood: number | null = null;

    if (dayWellnessLogs.length > 0) {
      const sumEnergy = dayWellnessLogs.reduce(
        (acc, l) => acc + (Number(l.data?.energy) || 0),
        0
      );
      const sumMood = dayWellnessLogs.reduce(
        (acc, l) => acc + (Number(l.data?.mood) || 0),
        0
      );
      // Scaled to 0-100 for the chart component which maps it back to 1-5
      energy = (sumEnergy / dayWellnessLogs.length) * 20;
      mood = (sumMood / dayWellnessLogs.length) * 20;
    }

    return { name: dayStr, adherence, energy, mood };
  });
}
