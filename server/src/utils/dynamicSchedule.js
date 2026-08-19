/**
 * Converts a "HH:mm" 24h string into total minutes from midnight (0..1439).
 */
export function timeStrToMinutes(timeStr) {
  const parts = (timeStr || '').trim().split(':');
  if (parts.length !== 2) return 0;
  const [h, m] = parts.map(Number);
  if (isNaN(h) || isNaN(m)) return 0;
  return ((h * 60 + m) % 1440 + 1440) % 1440;
}

/**
 * Converts total minutes from midnight into a normalized "HH:mm" string.
 */
export function minutesToTimeStr(totalMinutes) {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Parses and validates a comma-separated list of "HH:mm" time strings.
 */
export function parseReminderTimes(timeStr) {
  if (!timeStr) return [];
  return timeStr
    .split(',')
    .map((t) => t.trim())
    .filter((t) => {
      const parts = t.split(':');
      if (parts.length !== 2) return false;
      const [h, m] = parts.map(Number);
      return !isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59;
    });
}

/**
 * Computes the interval in minutes between slot `fromIndex` and slot `toIndex`.
 * Handles wrap-around midnight naturally.
 */
export function getInterSlotInterval(times, fromIndex, toIndex) {
  if (times.length <= 1) return 24 * 60;
  const fromMins = timeStrToMinutes(times[fromIndex]);
  const toMins = timeStrToMinutes(times[toIndex]);
  let diff = toMins - fromMins;
  if (diff <= 0) diff += 24 * 60;
  return diff;
}

/**
 * Finds the slot index that corresponds to the given scheduled datetime or time string.
 */
export function findSlotIndexForTime(times, scheduledDateOrStr) {
  if (!times || times.length === 0) return -1;
  const dateObj =
    typeof scheduledDateOrStr === 'string'
      ? new Date(scheduledDateOrStr)
      : scheduledDateOrStr;

  if (isNaN(dateObj.getTime())) return 0;

  const targetHHmm = `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;

  const exactIdx = times.indexOf(targetHHmm);
  if (exactIdx !== -1) return exactIdx;

  const targetMins = dateObj.getHours() * 60 + dateObj.getMinutes();
  let minDiff = Infinity;
  let bestIdx = 0;

  times.forEach((t, i) => {
    const slotMins = timeStrToMinutes(t);
    let diff = Math.abs(slotMins - targetMins);
    if (diff > 12 * 60) diff = 24 * 60 - diff;
    if (diff < minDiff) {
      minDiff = diff;
      bestIdx = i;
    }
  });

  return bestIdx;
}

/**
 * Calculates new reminder times when a dose is taken at `actualTakeTime`
 * instead of its scheduled slot `slotIndex`.
 *
 * Preserves the inter-dose intervals for all subsequent slots.
 */
export function calculateDynamicSchedule(times, slotIndex, actualTakeTime) {
  if (!times || times.length === 0 || slotIndex < 0 || slotIndex >= times.length) {
    return {
      newTimes: times || [],
      newTimeStr: (times || []).join(','),
      hasChanges: false,
    };
  }

  const actualDate =
    typeof actualTakeTime === 'string' ? new Date(actualTakeTime) : actualTakeTime;
  const actualMinutes = actualDate.getHours() * 60 + actualDate.getMinutes();
  const actualSlotStr = minutesToTimeStr(actualMinutes);

  const newTimes = times.map((originalSlot, idx) => {
    if (idx < slotIndex) {
      return originalSlot;
    }
    if (idx === slotIndex) {
      return actualSlotStr;
    }

    let cumulativeInterval = 0;
    for (let s = slotIndex; s < idx; s++) {
      cumulativeInterval += getInterSlotInterval(times, s, s + 1);
    }
    const newSlotMins = actualMinutes + cumulativeInterval;
    return minutesToTimeStr(newSlotMins);
  });

  const newTimeStr = newTimes.join(',');
  const hasChanges = newTimeStr !== times.join(',');

  return {
    newTimes,
    newTimeStr,
    hasChanges,
  };
}
