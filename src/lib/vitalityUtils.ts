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
      // Sort day logs chronologically so latest entry is prioritized
      const sortedLogs = [...dayWellnessLogs].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Filter only logs that actually contain a valid energy rating (1-5)
      const validEnergyLogs = sortedLogs.filter(
        (l) => l.data?.energy != null && !isNaN(Number(l.data.energy)) && Number(l.data.energy) > 0
      );
      // Filter only logs that actually contain a valid mood rating (1-5)
      const validMoodLogs = sortedLogs.filter(
        (l) => l.data?.mood != null && !isNaN(Number(l.data.mood)) && Number(l.data.mood) > 0
      );

      if (validEnergyLogs.length > 0) {
        // Use the latest recorded energy of the day, rounded to a clean 1-5 integer scale
        const latestEnergy = Number(validEnergyLogs[validEnergyLogs.length - 1].data?.energy);
        const integerEnergy = Math.max(1, Math.min(5, Math.round(latestEnergy)));
        // Scaled to 0-100 for the chart component (20, 40, 60, 80, 100)
        energy = integerEnergy * 20;
      }

      if (validMoodLogs.length > 0) {
        // Use the latest recorded mood of the day, rounded to a clean 1-5 integer scale
        const latestMood = Number(validMoodLogs[validMoodLogs.length - 1].data?.mood);
        const integerMood = Math.max(1, Math.min(5, Math.round(latestMood)));
        // Scaled to 0-100 for the chart component (20, 40, 60, 80, 100)
        mood = integerMood * 20;
      }
    }

    return { name: dayStr, adherence, energy, mood };
  });
}
