import type { Medicine, Reminder } from "../contexts/AppContext";
import { getDailyDoseRate } from "../../server/src/utils/aiDeterministicUtils.js";

export { getDailyDoseRate };

const LOW_STOCK_THRESHOLD = 3;     // Days: amber warning (3 days)
const CRITICAL_STOCK_THRESHOLD = 2; // Days: red critical alert (<= 2 days)

export interface RefillStatus {
  medicineId: string;
  medicineName: string;
  daysRemaining: number | null;
  dosesRemaining: number | null;
  currentQuantity: number;
  dailyDoseTotal?: number;
  frequencyPerDay?: number;
  dosagePerDose?: number;
  isOutOfStock?: boolean;
  isLow: boolean;    // true if <= CRITICAL_STOCK_THRESHOLD (red)
  isWarning: boolean; // true if <= LOW_STOCK_THRESHOLD but > critical (amber)
}

/**
 * Calculates how many doses and days of medication remain based on current supply
 * and scheduled daily dosage / frequency.
 */
export function calculateRefillStatus(
  medicine: Medicine,
  reminders: Reminder[] = []
): RefillStatus | null {
  const { id, name, currentQuantity, dosagePerDose, frequencyPerDay } = medicine;

  if (currentQuantity === undefined) return null;

  const perDose = dosagePerDose && dosagePerDose > 0 ? dosagePerDose : 1;
  const dosesRemaining = Math.floor(currentQuantity / perDose);

  const dailyDoseTotal = getDailyDoseRate(medicine, reminders);
  const daysRemaining =
    dailyDoseTotal > 0
      ? Math.floor(currentQuantity / dailyDoseTotal)
      : currentQuantity <= 0
      ? 0
      : null;

  const isOutOfStock = currentQuantity <= 0;

  // Status flags strictly derived from dosage-based days remaining
  const isLow =
    isOutOfStock ||
    (daysRemaining !== null && daysRemaining <= CRITICAL_STOCK_THRESHOLD);

  const isWarning =
    !isLow &&
    daysRemaining !== null &&
    daysRemaining <= LOW_STOCK_THRESHOLD;

  return {
    medicineId: id,
    medicineName: name,
    daysRemaining,
    dosesRemaining,
    currentQuantity,
    dailyDoseTotal,
    frequencyPerDay: frequencyPerDay && frequencyPerDay > 0 ? frequencyPerDay : 1,
    dosagePerDose: perDose,
    isOutOfStock,
    isLow,
    isWarning,
  };
}
