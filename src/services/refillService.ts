import { Medicine, Reminder } from "../contexts/AppContext";

export const LOW_STOCK_THRESHOLD = 5;     // Days: amber warning
export const CRITICAL_STOCK_THRESHOLD = 2; // Days: red critical alert

export interface RefillStatus {
  medicineId: string;
  medicineName: string;
  daysRemaining: number | null;
  currentQuantity: number;
  isLow: boolean;    // true if <= CRITICAL_STOCK_THRESHOLD (red)
  isWarning: boolean; // true if <= LOW_STOCK_THRESHOLD but > critical (amber)
}

/**
 * Calculates how many days of medication remain based on current supply
 * and scheduled reminders.
 */
export function calculateRefillStatus(
  medicine: Medicine,
  reminders: Reminder[]
): RefillStatus | null {
  const { id, name, currentQuantity, dosagePerDose } = medicine;
  
  if (currentQuantity === undefined) return null;

  // Find all enabled reminders for this medicine
  const medReminders = reminders.filter(r => r.medicineId === id && r.enabled);

  // Calculate daily dose sum
  let dailyDoseTotal = 0;
  if (medReminders.length > 0) {
    const doseVal = dosagePerDose || 1;
    for (const rem of medReminders) {
      if (rem.repeatSchedule === "daily") {
        dailyDoseTotal += doseVal;
      } else if (rem.repeatSchedule === "custom") {
        const timesPerDay = rem.time.split(",").length;
        if (rem.repeatDays && rem.repeatDays.length > 0) {
          dailyDoseTotal += (doseVal * timesPerDay * rem.repeatDays.length) / 7;
        } else {
          dailyDoseTotal += (doseVal * timesPerDay);
        }
      } else if (rem.repeatSchedule === "weekly" && rem.repeatDays) {
        // Average daily dose for weekly schedule
        dailyDoseTotal += (doseVal * rem.repeatDays.length) / 7;
      } else {
        // Fallback for other schedules
        dailyDoseTotal += doseVal;
      }
    }
  }

  const daysRemaining = dailyDoseTotal > 0 ? Math.floor(currentQuantity / dailyDoseTotal) : null;
  const isOutOfStock = currentQuantity === 0;

  // Status flags based on remaining stock numbers OR days remaining
  const isLow = isOutOfStock || (daysRemaining !== null && daysRemaining <= CRITICAL_STOCK_THRESHOLD) || (currentQuantity <= 5);
  const isWarning = !isLow && ((daysRemaining !== null && daysRemaining <= LOW_STOCK_THRESHOLD) || (currentQuantity <= 10));

  return {
    medicineId: id,
    medicineName: name,
    daysRemaining,
    currentQuantity,
    isLow,
    isWarning,
  };
}

/**
 * Helper to suggest a refill date.
 */
export function getRefillDate(daysRemaining: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysRemaining);
  return date;
}
