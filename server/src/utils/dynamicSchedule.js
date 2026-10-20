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
 * Computes the minute interval between two consecutive slots (with wrap-around).
 */
export function getInterSlotInterval(times, fromIdx, toIdx) {
  if (!times || times.length <= 1) return 24 * 60;
  const fromMins = timeStrToMinutes(times[fromIdx]);
  const toMins = timeStrToMinutes(times[toIdx % times.length]);
  let diff = toMins - fromMins;
  if (diff <= 0) diff += 24 * 60;
  return diff;
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
 * Finds the slot index that corresponds to the given scheduled datetime or time string.
 */
export function findSlotIndexForTime(times, scheduledDateOrStr) {
  if (!times || times.length === 0) return -1;
  const dateObj =
    typeof scheduledDateOrStr === 'string'
      ? new Date(scheduledDateOrStr)
      : scheduledDateOrStr;

  if (!dateObj || isNaN(dateObj.getTime())) return 0;

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
 * Preserves the equal spacing between all doses throughout the recurring daily schedule.
 */
export function calculateDynamicSchedule(times, slotIndex, actualTakeTime) {
  if (!times || times.length === 0 || slotIndex < 0 || slotIndex >= times.length) {
    return {
      newTimes: times || [],
      newTimeStr: (times || []).join(','),
      hasChanges: false,
      adjustedSubsequentCount: 0,
    };
  }

  const actualDate =
    typeof actualTakeTime === 'string' ? new Date(actualTakeTime) : actualTakeTime;
  const actualMinutes = actualDate.getHours() * 60 + actualDate.getMinutes();
  const N = times.length;
  const intervalMinutes = Math.round((24 * 60) / N);

  const newTimes = times.map((_, idx) => {
    if (idx === slotIndex) {
      return minutesToTimeStr(actualMinutes);
    }
    const slotMins = actualMinutes + (idx - slotIndex) * intervalMinutes;
    return minutesToTimeStr(slotMins);
  });

  const newTimeStr = newTimes.join(',');
  const hasChanges = newTimeStr !== times.join(',');

  return {
    newTimes,
    newTimeStr,
    hasChanges,
    adjustedSubsequentCount: Math.max(0, times.length - 1),
  };
}
