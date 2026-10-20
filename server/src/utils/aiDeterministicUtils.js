/**
 * Shared Deterministic AI Action & Cultural Guardrail Utilities
 * Used by both backend (server/src/services/aiService.js) and frontend (src/services/aiAssistantService.ts).
 */

import { isSameTaskOrDuplicateQuery } from './therapeuticClasses.js';

function inferMissingActionType(payload) {
  if (payload.time && (payload.medicineName || payload.medicineId || payload.dose)) {
    return 'ADD_REMINDER';
  }
  if (payload.currentQuantity !== undefined) {
    return 'UPDATE_MEDICINE';
  }
  if (payload.targetRoute) {
    return 'NAVIGATE_PAGE';
  }
  if (payload.snoozeMinutes !== undefined) {
    return 'SNOOZE_REMINDER';
  }
  if (
    payload.status === 'taken' ||
    payload.status === 'missed' ||
    payload.scheduledTime ||
    payload.action === 'taken' ||
    payload.action === 'skipped'
  ) {
    return 'LOG_DOSE';
  }
  if (payload.mood !== undefined || payload.energy !== undefined || payload.symptoms || payload.aiReflection) {
    return 'LOG_WELLNESS';
  }
  if (payload.patientName && (payload.relation || payload.age || payload.gender || payload.dateOfBirth)) {
    return 'ADD_PATIENT';
  }
  if (payload.patientId !== undefined || (payload.patientName !== undefined && !payload.dose && !payload.time && !payload.dosage)) {
    return 'SWITCH_PATIENT_SCOPE';
  }
  if ((payload.name || payload.medicineName) && (payload.dosage || payload.dosagePerDose || payload.unit)) {
    return 'ADD_MEDICINE';
  }
  return null;
}

function unwrapRawPayload(rawAction) {
  if (rawAction.payload && typeof rawAction.payload === 'object' && !Array.isArray(rawAction.payload)) {
    return { ...rawAction.payload };
  }
  if (rawAction.data && typeof rawAction.data === 'object' && !Array.isArray(rawAction.data)) {
    return { ...rawAction.data };
  }
  return { ...rawAction };
}

/**
 * Normalizes an AI action into standard { type, payload, confirmMessage } format.
 */
export function normalizeAIAction(rawAction) {
  if (!rawAction || typeof rawAction !== 'object') return null;

  const payload = unwrapRawPayload(rawAction);
  delete payload.type;
  delete payload.confirmMessage;
  delete payload.requiresConfirmation;

  const timeVal = payload.time || payload.times || payload.reminderTime;
  const medNameVal = payload.medicineName || payload.name || payload.medication;
  if (!payload.medicineName && medNameVal) payload.medicineName = medNameVal;
  if (!payload.time && timeVal) payload.time = timeVal;
  if (payload.currentQuantity === undefined) {
    if (payload.quantity !== undefined) payload.currentQuantity = payload.quantity;
    else if (payload.stock !== undefined) payload.currentQuantity = payload.stock;
  }

  const type = rawAction.type || inferMissingActionType(payload);
  if (!type) return null;

  if (!payload.name && (type === 'ADD_MEDICINE' || type === 'UPDATE_MEDICINE' || type === 'REMOVE_MEDICINE') && medNameVal) {
    payload.name = medNameVal;
  }

  const normalized = { type, payload };
  if (rawAction.confirmMessage !== undefined) {
    normalized.confirmMessage = rawAction.confirmMessage;
  }
  if (rawAction.requiresConfirmation !== undefined) {
    normalized.requiresConfirmation = rawAction.requiresConfirmation;
  }
  return normalized;
}

export function resolveHonorific(gender) {
  if (!gender) return '';
  const g = String(gender).trim().toLowerCase();
  if (g === 'female' || g === 'woman' || g === 'f') return 'Nyabo';
  if (g === 'male' || g === 'man' || g === 'm') return 'Ssebo';
  return '';
}

const NON_NAME_WORDS = new Set([
  'is', 'means', 'refers', 'represents', 'translates', 'stands', 'defined',
  'can', 'should', 'would', 'will', 'and', 'or', 'to', 'for', 'in'
]);

const GREETING_HONORIFIC_PREFIX =
  '(Oli\\s+otya|Wasuze\\s+otya|Osiibye\\s+otya|Gyebaleko|Bambi|Webale(?:\\s+nnyo)?|Kale|Ki\\s+kati)';

export function enforceGenderHonorifics(text, gender) {
  if (!text || typeof text !== 'string') return text || '';
  const normGender = typeof gender === 'string' ? gender.trim().toLowerCase() : null;
  const isMale = normGender === 'male' || normGender === 'man' || normGender === 'm';
  const isFemale = normGender === 'female' || normGender === 'woman' || normGender === 'f';

  let result = text;

  if (isMale) {
    result = result.replace(/\bNyabo\s+([A-Z][a-zA-Z'-]*)/g, (match, p1) =>
      NON_NAME_WORDS.has(p1.toLowerCase()) ? match : `Ssebo ${p1}`
    );
    result = result.replace(
      new RegExp(`\\b${GREETING_HONORIFIC_PREFIX}(?:,\\s*|\\s+)Nyabo\\b`, 'gi'),
      (match, greet) => `${greet}${match.includes(',') ? ', ' : ' '}Ssebo`
    );
    result = result.replace(/\bNyabo\s*([,!:?])/g, 'Ssebo$1').replace(/\bnyabo\s*([,!:?])/g, 'ssebo$1');
  } else if (isFemale) {
    result = result.replace(/\b(?:Ssebo|Sebbo)\s+([A-Z][a-zA-Z'-]*)/g, (match, p1) =>
      NON_NAME_WORDS.has(p1.toLowerCase()) ? match : `Nyabo ${p1}`
    );
    result = result.replace(
      new RegExp(`\\b${GREETING_HONORIFIC_PREFIX}(?:,\\s*|\\s+)(?:Ssebo|Sebbo)\\b`, 'gi'),
      (match, greet) => `${greet}${match.includes(',') ? ', ' : ' '}Nyabo`
    );
    result = result
      .replace(/\b(?:Ssebo|Sebbo)\s*([,!:?])/g, 'Nyabo$1')
      .replace(/\b(?:ssebo|sebbo)\s*([,!:?])/g, 'nyabo$1');
  } else {
    result = result.replace(/\b(?:Nyabo|Ssebo|Sebbo)\s+([A-Z][a-zA-Z'-]*)/g, (match, p1) =>
      NON_NAME_WORDS.has(p1.toLowerCase()) ? match : p1
    );
    result = result.replace(
      new RegExp(`\\b${GREETING_HONORIFIC_PREFIX}\\s+(?:Nyabo|Ssebo|Sebbo)\\b`, 'gi'),
      '$1'
    );
    result = result.replace(/^(?:Nyabo|Ssebo|Sebbo),\s*/gim, '');
  }

  return result;
}

export function distributeTimes(startTime = '08:00', freq = 1) {
  if (!startTime || !startTime.includes(':')) return [startTime || '08:00'];
  const [hStr, mStr] = startTime.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (isNaN(h) || isNaN(m)) return [startTime];
  if (freq <= 1) {
    return [`${String(h % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`];
  }
  const intervalHours = 24 / freq;
  const newTimes = [];
  for (let i = 0; i < freq; i++) {
    const totalMinutes = Math.round(h * 60 + m + i * intervalHours * 60) % (24 * 60);
    const newH = Math.floor(totalMinutes / 60);
    const newM = Math.floor(totalMinutes % 60);
    newTimes.push(`${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`);
  }
  return newTimes;
}

function formatTimeDisplay(timeStr) {
  if (!timeStr) return '8:00 AM';
  if (timeStr.includes(',')) {
    const parts = timeStr.split(',').map((t) => formatTimeDisplay(t.trim()));
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
    return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
  }
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ? mStr.padStart(2, '0') : '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

const EXPLICIT_ADD_REMINDER_REGEX =
  /\b(?:remind(?:\s+me)?(?:\s+to\s+take|\s+about)?|(?:set(?:\s*up)?|add|create|schedule|make|give\s+me|put|need|want)(?:\s+a)?\s+reminder|alarm\s+for|set\s+(?:an?\s+)?alarm|new\s+reminder|reminder\s+for|reminder\s+schedule)\b/i;

const isAssistantMsg = (m) => m && (m.role === 'assistant' || m.sender === 'dawagpt' || m.sender === 'assistant');
const isUserMsg = (m) => m && (m.role === 'user' || m.sender === 'user');
const getMsgText = (m) => String(m?.text || m?.content || '');

export function userRequestedReminder(text, history) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase().trim();

  if (/\b(?:delete|remove|cancel|stop|pause|mute|disable|turn off|clear)\b/i.test(lower)) {
    return false;
  }

  const isMedOrInquiry =
    /\b(side effects?|adverse effects?|can i take|should i take|is it safe|interact|interaction|what is|what are|how much|tell me about|show me|list|view|check)\b/i.test(
      lower
    );

  if (EXPLICIT_ADD_REMINDER_REGEX.test(lower) && !isMedOrInquiry) {
    return true;
  }

  if (Array.isArray(history) && history.length >= 1) {
    const prevAssistant = [...history].reverse().find(isAssistantMsg);
    if (prevAssistant) {
      const prevAssistantText = getMsgText(prevAssistant).toLowerCase();
      const asksForReminderTime =
        /\b(what time.*(?:first dose|take|start|reminder)|starting time|when would you like to take|what time would you like to take)\b/i.test(
          prevAssistantText
        );
      const isTimeAnswer = /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}:\d{2})\b/i.test(lower);

      if (asksForReminderTime && isTimeAnswer && !isMedOrInquiry) {
        return history.some((m) => isUserMsg(m) && EXPLICIT_ADD_REMINDER_REGEX.test(getMsgText(m).toLowerCase()));
      }
    }
  }

  return false;
}

// ── Individual Intent Extractors ────────────────────────────────────────────────

function extractUndoOrSnoozeOrToggle(lower) {
  if (
    /\b(undo(\s+my)?(\s+last)?\s+(dose|log|record)|revert(\s+my)?\s+dose|cancel(\s+my)?(\s+last)?\s+dose|i didn't take|didn't take my dose|made a mistake.*take)\b/i.test(
      lower
    )
  ) {
    return {
      type: 'UNDO_DOSE_LOG',
      payload: {},
      confirmMessage: 'Reverted your last dose log and restored your Med Vault inventory.'
    };
  }

  const snoozeMatch = lower.match(
    /\bsnooze(?:\s+my)?(?:\s+[a-z0-9-]+)?(?:\s+reminder|\s+alarm)?\s+(?:for\s+)?(\d+)\s*(?:mins?|minutes?)\b/i
  );
  if (snoozeMatch) {
    const snoozeMinutes = parseInt(snoozeMatch[1], 10) || 15;
    return {
      type: 'SNOOZE_REMINDER',
      payload: { snoozeMinutes },
      confirmMessage: `Snoozed your reminder for ${snoozeMinutes} minutes.`
    };
  }

  const isPause = /\b(pause|turn off|disable|mute)\s+(?:all\s+)?(?:my\s+)?(?:medication\s+|medicine\s+)?(?:reminders?|alarms?)\b/i.test(lower);
  const isResume = /\b(resume|turn on|enable|unmute)\s+(?:all\s+)?(?:my\s+)?(?:medication\s+|medicine\s+)?(?:reminders?|alarms?)\b/i.test(lower);
  if (isPause || isResume) {
    return {
      type: 'TOGGLE_REMINDER',
      payload: { enabled: isResume },
      confirmMessage: isResume
        ? 'All active medication reminders have been resumed.'
        : 'Your medication reminders have been paused.'
    };
  }

  return null;
}

function extractSwitchPatientAction(lower, patients) {
  const switchMatch = lower.match(
    /\b(?:switch\s+(?:to|context\s+to|profile\s+to)|view\s+profile\s+(?:for|of)|show\s+me\s+profile\s+(?:for|of))\s+([a-z0-9\s'-]+)/i
  );
  if (!switchMatch) return null;

  const rawTarget = switchMatch[1].replace(/'s.*/, '').trim();
  if (['me', 'myself', 'self', 'my account', 'my profile'].includes(rawTarget)) {
    return {
      type: 'SWITCH_PATIENT_SCOPE',
      payload: { patientId: null, patientName: 'Self' },
      confirmMessage: 'Switched context back to your personal health profile.'
    };
  }
  const matchedPatient = patients.find(
    (p) => p.name.toLowerCase().includes(rawTarget) || rawTarget.includes(p.name.toLowerCase())
  );
  if (matchedPatient) {
    return {
      type: 'SWITCH_PATIENT_SCOPE',
      payload: { patientId: matchedPatient.id, patientName: matchedPatient.name },
      confirmMessage: `Switched active context to ${matchedPatient.name}.`
    };
  }
  return null;
}

function resolveMedQueryFromHistory(history, medicines, reminders) {
  if (!Array.isArray(history) || history.length === 0) return '';
  const prevAssistant = [...history].reverse().find(isAssistantMsg);
  const prevRaw = getMsgText(prevAssistant);
  const prevText = prevRaw.toLowerCase();

  const mentionedMed =
    medicines.find((m) => m.name && prevText.includes(m.name.toLowerCase())) ||
    reminders.find((r) => r.medicineName && prevText.includes(r.medicineName.toLowerCase()));
  if (mentionedMed) {
    return mentionedMed.name || mentionedMed.medicineName;
  }

  const boldMatch =
    prevRaw.match(/\*\*(?:take\s+)?([A-Za-z0-9-]+)\*\*/i) ||
    prevRaw.match(/\b(?:reminder\s+(?:for|to\s+take)|to\s+take)\s+\*?\*?([A-Za-z0-9-]+)\*?\*?/i);
  if (boldMatch && !['you', 'your', 'the', 'a', 'all'].includes(boldMatch[1].toLowerCase())) {
    return boldMatch[1];
  }
  return '';
}

function extractRemoveOrUpdateReminderAction(lower, medicines, reminders, history) {
  const removeRemMatch =
    lower.match(/\b(?:delete|remove|cancel|stop)\s+(?:(?:my|the|that|this)\s+)?(?:(?:medication\s+|medicine\s+)?(?:reminders?|alarms?))\s*(?:for\s+([a-z0-9-]+))?\b/i) ||
    lower.match(/\b(?:delete|remove|cancel)\s+([a-z0-9-]+)\s+(?:reminder|alarm)\b/i) ||
    lower.match(/\bstop\s+reminding\s+me\s+(?:about|for|to\s+take)\s+([a-z0-9-]+)\b/i);

  if (removeRemMatch) {
    const medQuery = (removeRemMatch[1] || '').trim() || resolveMedQueryFromHistory(history, medicines, reminders);
    let matchedReminder = medQuery
      ? reminders.find((r) => r.medicineName && r.medicineName.toLowerCase().includes(medQuery.toLowerCase()))
      : reminders.length === 1
      ? reminders[0]
      : null;

    if (!matchedReminder && medQuery) {
      matchedReminder = reminders.find((r) => r.medicineName.toLowerCase() === medQuery.toLowerCase());
    }

    const medName = matchedReminder?.medicineName || medQuery || 'the medication';
    return {
      type: 'REMOVE_REMINDER',
      payload: {
        id: matchedReminder?.id || null,
        medicineName: medName
      },
      confirmMessage: `Removed reminder for ${medName}.`
    };
  }

  const updateRemMatch = lower.match(
    /\b(?:change|move|reschedule|update|shift)\s+(?:my\s+)?([a-z0-9-]+)?\s*(?:reminder|alarm|schedule)\s*(?:to|for|at)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i
  );
  if (updateRemMatch) {
    const medQuery = (updateRemMatch[1] || '').trim();
    const rawTime = updateRemMatch[2];
    const normalizedTime = rawTime ? formatTimeDisplay(rawTime) : '08:00';
    const matchedReminder = reminders.find(
      (r) => medQuery && r.medicineName.toLowerCase().includes(medQuery.toLowerCase())
    );
    const targetName = matchedReminder?.medicineName || medQuery || 'your medication';
    return {
      type: 'UPDATE_REMINDER',
      payload: {
        id: matchedReminder?.id || null,
        medicineName: matchedReminder?.medicineName || medQuery || 'Reminder',
        time: rawTime
      },
      confirmMessage: `Updated reminder time for ${targetName} to ${normalizedTime}.`
    };
  }

  return null;
}

function extractRemoveMedicineAction(lower, medicines) {
  const removeMedMatch = lower.match(
    /\b(?:delete|remove|archive|stop\s+taking)\s+(?:the\s+|my\s+)?(?:medicine|medication|drug|pill)?\s*([a-z0-9-]+)(?:\s+from\s+(?:my\s+)?(?:cabinet|medications?|meds?|vault))?\b/i
  );
  if (
    !removeMedMatch ||
    lower.includes('reminder') ||
    lower.includes('alarm') ||
    lower.includes('patient') ||
    lower.includes('member')
  ) {
    return null;
  }
  const medQuery = removeMedMatch[1].trim();
  if (['a', 'the', 'my', 'some', 'this'].includes(medQuery.toLowerCase())) return null;

  const matchedMed = medicines.find((m) => m.name.toLowerCase().includes(medQuery.toLowerCase()));
  return {
    type: 'REMOVE_MEDICINE',
    payload: {
      id: matchedMed?.id || null,
      name: matchedMed?.name || medQuery.charAt(0).toUpperCase() + medQuery.slice(1)
    },
    confirmMessage: `Removed ${matchedMed?.name || medQuery} from your medicine cabinet.`
  };
}

const RELATION_KEYWORDS = [
  { keys: ['mother', 'mama'], label: 'Mother' },
  { keys: ['father', 'baba'], label: 'Father' },
  { keys: ['son'], label: 'Son' },
  { keys: ['daughter'], label: 'Daughter' },
  { keys: ['child', 'baby'], label: 'Child' },
  { keys: ['client'], label: 'Client' }
];

function extractAddPatientOrRegimenAction(lower) {
  const addPatientMatch = lower.match(
    /\b(?:add|create|register)\s+(?:a\s+|my\s+)?(?:family\s+member|dependent|client|patient|child|parent|mother|father|son|daughter|relative)\s+([a-z0-9\s'-]+)/i
  );
  if (addPatientMatch) {
    const rawInfo = addPatientMatch[1].trim();
    const ageMatch =
      lower.match(/\bage\s+(\d{1,3})\b/i) || lower.match(/\b(\d{1,3})\s*(?:years?\s*old|yrs?\s*old|yo)\b/i);
    const age = ageMatch ? parseInt(ageMatch[1], 10) : undefined;
    const gender = /\b(female|mother|daughter|girl|woman)\b/i.test(lower)
      ? 'female'
      : /\b(male|father|son|boy|man)\b/i.test(lower)
      ? 'male'
      : undefined;
    const cleanName = rawInfo.split(/,\s*|\s+(?:age|\d+|who|with)\b/i)[0].trim();
    const formattedName = cleanName
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    const matchedRel = RELATION_KEYWORDS.find((r) => r.keys.some((k) => lower.includes(k)));
    const relation = matchedRel ? matchedRel.label : 'Family';

    return {
      type: 'ADD_PATIENT',
      payload: {
        name: formattedName || 'New Member',
        age,
        gender,
        relation,
        type: lower.includes('client') ? 'client' : 'family'
      },
      confirmMessage: `Added ${formattedName || 'family member'} to your Family Hub.`
    };
  }

  const isRegimen =
    /\b(?:add|start|set up)\s+(?:a\s+)?(?:\d+[- ]day\s+)?(?:treatment|regimen|course|treatment\s+regimen|malaria\s*treatment)\s*(?:of|for)?\s*([a-z0-9-]+)\b/i.test(
      lower
    );
  if (isRegimen) {
    const regMatch = lower.match(/\b(?:of|for)\s+([a-z0-9-]+)/i);
    const medName = regMatch
      ? regMatch[1].charAt(0).toUpperCase() + regMatch[1].slice(1)
      : 'Coartem (Artemether/Lumefantrine)';
    return {
      type: 'BATCH_ADD_REGIMEN',
      payload: {
        medicineName: medName,
        dosage: '20/120mg',
        durationDays: 3,
        frequency: 'twice daily',
        times: '08:00,20:00'
      },
      confirmMessage: `Set up 3-day treatment regimen and reminders for ${medName}.`
    };
  }

  return null;
}

const ROUTE_TARGETS = [
  { keys: ['medvault', 'inventory', 'stock'], route: '/medvault' },
  { keys: ['reminder', 'alarm'], route: '/reminders' },
  { keys: ['medication', 'cabinet'], route: '/medications' },
  { keys: ['history', 'log'], route: '/history' },
  { keys: ['wellness'], route: '/wellness' },
  { keys: ['family', 'dependent'], route: '/family' },
  { keys: ['interaction', 'safety'], route: '/interactions' },
  { keys: ['travel'], route: '/travel' },
  { keys: ['report'], route: '/report' },
  { keys: ['scan'], route: '/scan' },
  { keys: ['setting'], route: '/settings' }
];

function extractNavigationOrPharmacyAction(lower) {
  const navMatch = lower.match(
    /\b(?:go to|take me to|open|navigate to)\s+(?:the\s+|my\s+)?(medvault|med\s*vault|inventory|stock|reminders?|alarms?|medications?|cabinet|history|logs|wellness|wellness\s*hub|family|family\s*hub|dependents?|interactions?|safety|safety\s*guard|travel|travel\s*companion|reports?|doctor\s*report|scanner|scan|settings?)\b/i
  );
  const blockedNavKeywords = ['page', 'how', 'link', 'add', 'remind me', 'log', 'refill'];
  if (navMatch && !lower.startsWith('show') && !blockedNavKeywords.some((k) => lower.includes(k))) {
    const rawTarget = navMatch[1].toLowerCase().replace(/\s+/g, '');
    const matched = ROUTE_TARGETS.find((r) => r.keys.some((k) => rawTarget.includes(k)));
    const targetRoute = matched ? matched.route : '/';
    return {
      type: 'NAVIGATE_PAGE',
      payload: { targetRoute },
      confirmMessage: `Navigating to ${targetRoute}.`
    };
  }

  if (
    /\b(find\s+(?:a\s+)?pharmacy|where\s+(?:can\s+i|to)\s+buy|nearest\s+pharmacy|pharmacies\s+near\s+me|open\s+pharmacy\s+finder|locate\s+pharmacy)\b/i.test(
      lower
    )
  ) {
    const medMatch = lower.match(/\b(?:buy|find|for)\s+([a-z0-9-]+)\b/i);
    const targetMed =
      medMatch && !['a', 'the', 'some', 'me', 'pharmacy', 'medicine', 'pills'].includes(medMatch[1].toLowerCase())
        ? medMatch[1].charAt(0).toUpperCase() + medMatch[1].slice(1)
        : undefined;
    return {
      type: 'OPEN_PHARMACY_MODAL',
      payload: { medicineName: targetMed },
      confirmMessage: `Opening National Drug Authority (NDA) pharmacy locator${targetMed ? ` for ${targetMed}` : ''}.`
    };
  }

  return null;
}

function parseExplicit24HourTime(primaryText, fallbackText = null) {
  const patterns = [
    /\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i,
    /\b([01]?\d|2[0-3]):([0-5]\d)\b/,
    /\b(?:start(?:ing)?\s+at|\bat)\s+([01]?\d|2[0-3])(?::([0-5]\d))?\s*(am|pm)?\b/i,
    /\b([01]?\d|2[0-3])\s*o'?clock\s*(am|pm)?\b/i
  ];

  let activeMatch = null;
  for (const pat of patterns) {
    activeMatch = primaryText.match(pat) || (fallbackText ? fallbackText.match(pat) : null);
    if (activeMatch) break;
  }
  if (!activeMatch) return null;

  let hours = parseInt(activeMatch[1], 10);
  const minutes = activeMatch[2] ? parseInt(activeMatch[2], 10) : 0;
  const meridiem = (activeMatch[3] || activeMatch[0].match(/am|pm/i)?.[0])?.toLowerCase();

  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;

  if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  return null;
}

function parseFrequencyAndSchedule(freqSourceText, defaultFreq = 1) {
  let freq = defaultFreq > 0 ? defaultFreq : 1;
  let repeatSchedule = freq > 1 ? 'custom' : 'daily';

  if (freqSourceText.includes('weekly')) {
    return { freq: 1, repeatSchedule: 'weekly' };
  }
  if (freqSourceText.includes('once')) {
    return { freq: 1, repeatSchedule: 'once' };
  }
  if (
    freqSourceText.includes('twice') ||
    freqSourceText.includes('2 times') ||
    freqSourceText.includes('2x') ||
    freqSourceText.includes('two times')
  ) {
    return { freq: 2, repeatSchedule: 'custom' };
  }
  if (
    freqSourceText.includes('three times') ||
    freqSourceText.includes('thrice') ||
    freqSourceText.includes('3 times') ||
    freqSourceText.includes('3x')
  ) {
    return { freq: 3, repeatSchedule: 'custom' };
  }
  if (freqSourceText.includes('four times') || freqSourceText.includes('4 times') || freqSourceText.includes('4x')) {
    return { freq: 4, repeatSchedule: 'custom' };
  }
  return { freq, repeatSchedule };
}

function findLongestMatchingMed(medicines, searchText) {
  return medicines
    .filter(
      (m) =>
        (m.name && searchText.includes(m.name.toLowerCase())) ||
        (m.genericName && searchText.includes(m.genericName.toLowerCase()))
    )
    .sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0))[0];
}

function extractAddReminderAction(lower, effectiveText, isAnsweringTimePrompt, medicines) {
  const explicitTime = parseExplicit24HourTime(lower, isAnsweringTimePrompt ? effectiveText : null);
  let matchedMed = findLongestMatchingMed(medicines, lower);
  if (!matchedMed && isAnsweringTimePrompt) {
    matchedMed = findLongestMatchingMed(medicines, effectiveText);
  }
  if (!matchedMed || !explicitTime) return null;

  const userDoseMatch = lower.match(/\b(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|tablets?|pills?|capsules?|drops?|puffs?))\b/i);
  const dose = userDoseMatch
    ? userDoseMatch[1]
    : matchedMed.dosagePerDose
    ? `${matchedMed.dosagePerDose} ${matchedMed.unit || 'tablets'}`
    : matchedMed.dosage || '1 tablet';

  const hasExplicitFreqKeyword = ['twice', 'thrice', 'times', 'once', 'weekly'].some((k) => lower.includes(k));
  const freqSourceText = hasExplicitFreqKeyword
    ? lower
    : isAnsweringTimePrompt
    ? effectiveText.toLowerCase()
    : lower;

  const { freq, repeatSchedule } = parseFrequencyAndSchedule(freqSourceText, matchedMed.frequencyPerDay || 1);
  const finalTimeStr = distributeTimes(explicitTime, freq).join(',');
  const freqDesc = freq > 1 ? `${freq} times a day` : repeatSchedule;

  return {
    type: 'ADD_REMINDER',
    payload: {
      medicineName: matchedMed.name,
      medicineId: matchedMed.id,
      dose,
      time: finalTimeStr,
      repeatSchedule,
      frequencyPerDay: freq
    },
    confirmMessage: `Reminder set for ${matchedMed.name} (${dose}) at ${formatTimeDisplay(finalTimeStr)} (${freqDesc}).`
  };
}

function extractLogDoseOrRefillAction(lower, effectiveText, medicines) {
  if (
    /\b(i took|i've taken|i just took|i already took|log (that )?i took|record (that )?i took|mark (my )?.* as taken|i missed|i skipped)\b/i.test(
      lower
    )
  ) {
    const status = /\b(missed|skipped|forgot)\b/i.test(lower) ? 'missed' : 'taken';
    const matchedMed = medicines.find((m) => m.name && lower.includes(m.name.toLowerCase()));
    let medName = matchedMed ? matchedMed.name : null;

    if (!medName) {
      const medMatch = lower.match(/(?:took|taken|missed|skipped)\s+(?:my\s+)?([a-z0-9-]+)/i);
      if (medMatch && !['my', 'the', 'a', 'dose', 'medicine', 'pills'].includes(medMatch[1].toLowerCase())) {
        medName = medMatch[1].charAt(0).toUpperCase() + medMatch[1].slice(1);
      } else {
        medName = medicines[0]?.name || 'Medication';
      }
    }

    return {
      type: 'LOG_DOSE',
      payload: {
        medicineName: medName,
        medicineId: matchedMed?.id || null,
        status,
        timestamp: new Date().toISOString()
      },
      confirmMessage: `Logged ${medName} as ${status}.`
    };
  }

  if (
    /\b(refill(ed)?|restock(ed)?|top\s*up|topped\s*up|update stock|set stock|purchased|bought|added\s+\d+\s*(?:more\s+)?(?:pills?|tablets?))\b/i.test(
      effectiveText
    )
  ) {
    const qtyMatch =
      effectiveText.match(/\b(?:to|with|by|have|bought|purchased|added)?\s*(\d+)\s*(?:pills?|tablets?|capsules?|units?|bottles?)?\b/i) ||
      effectiveText.match(/(\d+)\s*(?:pills?|tablets?|capsules?|units?|bottles?)/i);
    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : null;

    let matchedMed = medicines.find((m) => {
      if (!m.name) return false;
      const medLower = m.name.toLowerCase();
      const genLower = m.genericName ? m.genericName.toLowerCase() : '';
      if (effectiveText.includes(medLower) || (genLower && effectiveText.includes(genLower))) return true;
      const tokens = medLower.split(/\s+/).filter((t) => t.length > 2 && !/^\d+mg$/i.test(t));
      return tokens.some((tok) => effectiveText.includes(tok));
    });
    if (!matchedMed && medicines.length === 1) matchedMed = medicines[0];

    if (matchedMed && qty !== null) {
      return {
        type: 'UPDATE_MEDICINE',
        payload: {
          id: matchedMed.id,
          name: matchedMed.name,
          currentQuantity: qty,
          totalQuantity: Math.max(matchedMed.totalQuantity || 0, qty)
        },
        confirmMessage: `Updated ${matchedMed.name} stock to ${qty}.`
      };
    }
  }

  return null;
}

function inferMedUnit(lower) {
  if (lower.includes('capsule')) return 'capsules';
  if (lower.includes('ml') || lower.includes('syrup') || lower.includes('liquid')) return 'ml';
  if (lower.includes('puff') || lower.includes('inhaler')) return 'puffs';
  if (lower.includes('drop')) return 'drops';
  return 'tablets';
}

function extractAddMedicineAction(lower, isReminderIntent) {
  const isAddMedIntent =
    /\b(?:add|put|register|save)\s+(?:a\s+|my\s+)?(?:new\s+)?(?:medicine|medication|pill|drug|tablet|prescription)\b/i.test(
      lower
    ) ||
    /\b(?:add|put)\s+([a-z0-9-]+(?:\s+[a-z0-9-]+)?)\s+(?:to\s+(?:my\s+)?(?:cabinet|medications?|meds?|vault|inventory))\b/i.test(
      lower
    ) ||
    (/\b(?:add|register)\s+([a-z0-9-]+)\s+(\d+(?:\.\d+)?\s*(?:mg|g|ml|tablets?|pills?|capsules?|mcg))\b/i.test(lower) &&
      !isReminderIntent);

  if (!isAddMedIntent) return null;

  let name = 'Medication';
  const nameMatch = lower.match(
    /\b(?:add|put|register|new)\s+(?:a\s+|my\s+)?(?:new\s+)?(?:medicine|medication|pill|drug|tablet)?\s*(?:called\s+|named\s+)?([a-z0-9-]+(?:\s+[a-z0-9-]+)?)/i
  );
  if (nameMatch && !['a', 'the', 'my', 'some', 'new', 'to', 'in'].includes(nameMatch[1].toLowerCase())) {
    name = nameMatch[1].split(/\s+(?:to|in|at|dosage|\d+mg|\d+\s*mg)/)[0].trim();
    name = name.charAt(0).toUpperCase() + name.slice(1);
  }

  const doseMatch = lower.match(/\b(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg|tablets?|pills?|capsules?|drops?|puffs?))\b/i);
  const dosage = doseMatch ? doseMatch[1] : '500mg';

  const dosagePerDoseMatch = lower.match(
    /\b(\d+)\s*(?:tablets?|pills?|capsules?|drops?|puffs?)\s*(?:per\s+dose|each\s+time|twice|three|daily|per\s+day)?\b/i
  );
  const dosagePerDose = dosagePerDoseMatch ? parseInt(dosagePerDoseMatch[1], 10) || 1 : 1;

  const { freq: frequencyPerDay } = parseFrequencyAndSchedule(lower, 1);
  const unit = inferMedUnit(lower);

  const qtyMatch = lower.match(/\b(?:with|have|total\s+of)?\s*(\d+)\s*(?:pills?|tablets?|capsules?|units?|bottles?)\b/i);
  const totalQuantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 30;
  const time = parseExplicit24HourTime(lower);

  return {
    type: 'ADD_MEDICINE',
    payload: {
      name,
      dosage,
      dosagePerDose,
      frequencyPerDay,
      totalQuantity,
      currentQuantity: totalQuantity,
      unit,
      reminderSchedule: time
        ? {
            time,
            dose: `${dosagePerDose} ${unit}`,
            repeatSchedule: frequencyPerDay === 2 ? 'custom' : 'daily'
          }
        : undefined
    },
    confirmMessage: `Added **${name}** (${dosage}) to your medicine cabinet.`
  };
}

function synthesizeMultiTurnTimePrompt(lower, history) {
  if (!Array.isArray(history) || history.length === 0) {
    return { effectiveText: lower, isAnsweringTimePrompt: false };
  }
  const prevAssistant = [...history].reverse().find(isAssistantMsg);
  if (!prevAssistant) {
    return { effectiveText: lower, isAnsweringTimePrompt: false };
  }

  const cleanPrevAssistant = getMsgText(prevAssistant)
    .trim()
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .toLowerCase();

  const asksForTime =
    /\b(what time|starting time|first dose|when would you like to take|what time would you like to take)\b/i.test(
      cleanPrevAssistant
    );
  const isTimeAnswer = /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}:\d{2})\b/i.test(lower);

  if (asksForTime && isTimeAnswer) {
    return {
      effectiveText: `${cleanPrevAssistant} ${lower}`.trim(),
      isAnsweringTimePrompt: true
    };
  }
  return { effectiveText: lower, isAnsweringTimePrompt: false };
}

export function extractDeterministicAction(text, medicines = [], reminders = [], patients = [], history = []) {
  if (!text) return null;
  const lower = text.toLowerCase().trim();

  const isMedQuestion =
    /\b(can i take|should i take|is it safe|interact|interaction|safe to|together|can i use|should i use|side effects?|adverse effects?|what is|what are|tell me about|how do i take|dosage of|how much|when should i take|info on|details about|benefits of)\b/i.test(
      lower
    ) || isSameTaskOrDuplicateQuery(lower, medicines);

  if (isMedQuestion) return null;

  const isActionCommand =
    /\b(add|create|delete|remove|refill|restock|schedule|log|record|update|change|reschedule|pause|resume|undo|revert|snooze|switch)\b/i.test(
      lower
    );
  const isQuestionOrInquiry =
    /^(what|which|how|tell me|show me|list|check|view|display|can you tell|do i have|are there|when is|when are)\b/i.test(
      lower
    );
  if (isQuestionOrInquiry && !isActionCommand) return null;

  const { effectiveText, isAnsweringTimePrompt } = synthesizeMultiTurnTimePrompt(lower, history);

  const directAction =
    extractUndoOrSnoozeOrToggle(lower) ||
    extractSwitchPatientAction(lower, patients) ||
    extractRemoveOrUpdateReminderAction(lower, medicines, reminders, history) ||
    extractRemoveMedicineAction(lower, medicines) ||
    extractAddPatientOrRegimenAction(lower) ||
    extractNavigationOrPharmacyAction(lower);

  if (directAction) return directAction;

  const isReminderIntent = userRequestedReminder(lower, history);
  if (isReminderIntent) {
    return extractAddReminderAction(lower, effectiveText, isAnsweringTimePrompt, medicines);
  }

  const doseOrRefill = extractLogDoseOrRefillAction(lower, effectiveText, medicines);
  if (doseOrRefill) return doseOrRefill;

  const addMed = extractAddMedicineAction(lower, isReminderIntent);
  if (addMed) return addMed;

  const wellnessData = extractWellnessData(text);
  if (wellnessData) {
    const moodLabels = { 1: 'Low', 2: 'Meh', 3: 'Okay', 4: 'Good', 5: 'Great' };
    const moodStr = moodLabels[wellnessData.mood] || `${wellnessData.mood}/5`;
    const symSummary = wellnessData.symptoms.length > 0 ? wellnessData.symptoms.join(', ') : 'none';

    return {
      type: 'LOG_WELLNESS',
      payload: {
        type: 'symptom',
        data: {
          mood: wellnessData.mood,
          energy: wellnessData.energy,
          symptoms: wellnessData.symptoms,
          notes: wellnessData.notes
        }
      },
      confirmMessage: `Recorded wellness check-in (mood: ${moodStr} [${wellnessData.mood}/5], vitality: ${wellnessData.energy * 20}%, symptoms: ${symSummary}).`
    };
  }

  return null;
}

// ── Table-Driven Wellness Data Extraction ───────────────────────────────────────

const PHYSICAL_SYMPTOM_RULES = [
  { label: 'Headache', regex: /\b(headache|migraine|omutwe|head\s*ache|head\s*hurts?)\b/i },
  { label: 'Stomach Ache', regex: /\b(stomachache|stomach\s*ache|olubuto|tummy\s*ache|belly\s*ache|abdominal\s*pain|cramps?|indigestion)\b/i },
  { label: 'Fever', regex: /\b(fever|musujja|high\s*temp(erature)?|feverish|chills)\b/i },
  { label: 'Dizziness', regex: /\b(dizzy|dizziness|lightheaded(ness)?|vertigo)\b/i },
  { label: 'Nausea', regex: /\b(nausea|nauseous|vomit(ing)?|throwing\s*up|queasy)\b/i },
  { label: 'Fatigue', regex: /\b(fatigue|exhaust(ed|ion)?|tired|weak(ness)?|drained|worn\s*out|no\s*energy|low\s*energy)\b/i },
  { label: 'Cough', regex: /\b(cough(ing)?|ekifuba)\b/i }
];

const PHYSICAL_ILLNESS_SET = new Set([
  'Headache', 'Stomach Ache', 'Fever', 'Nausea', 'Dizziness', 'Pain', 'Cough'
]);

function detectWellnessSymptoms(lower) {
  const symptoms = [];
  for (const rule of PHYSICAL_SYMPTOM_RULES) {
    if (rule.regex.test(lower)) symptoms.push(rule.label);
  }
  if (
    /\b(pain|hurts?|aching|sore|obulumi|body\s*ache)\b/i.test(lower) &&
    !symptoms.includes('Headache') &&
    !symptoms.includes('Stomach Ache')
  ) {
    symptoms.push('Pain');
  }

  const isEcstatic = /\b(ecstatic|thrilled|overjoyed|on\s*cloud\s*nine|blissful|extremely\s*happy|so\s*happy|super\s*happy|very\s*happy)\b/i.test(lower);
  const isHappy = isEcstatic || /\b(happy|cheerful|joyful|delighted|in\s*a\s*great\s*mood|feeling\s*great|amazing|fantastic)\b/i.test(lower);
  const isRelaxed = /\b(relaxed|calm|peaceful|serene|chill)\b/i.test(lower);
  const isFocused = /\b(good\s*focus|focused|sharp|productive)\b/i.test(lower);
  const isAnxious = /\b(anxious|anxiety|nervous|worried|panicky)\b/i.test(lower);
  const isStressed = /\b(stressed|stress|overwhelmed|under\s*pressure)\b/i.test(lower);
  const isIrritable = /\b(irritable|irritated|annoyed|cranky|grumpy)\b/i.test(lower);

  if (isHappy) symptoms.push('Happy');
  if (isRelaxed) symptoms.push('Relaxed');
  if (isFocused) symptoms.push('Good Focus');
  if (isAnxious) symptoms.push('Anxious');
  if (isStressed) symptoms.push('Stressed');
  if (isIrritable) symptoms.push('Irritable');

  return {
    symptoms,
    flags: { isEcstatic, isHappy, isRelaxed, isFocused, isAnxious, isStressed, isIrritable }
  };
}

function computeMoodAndEnergy(lower, symptoms, flags) {
  const isSevere = /\b(severe|terrible|awful|unbearable|horrible|excruciating|depressed|miserable|agony)\b/i.test(lower);
  const hasPhysicalIllness = symptoms.some((s) => PHYSICAL_ILLNESS_SET.has(s));

  let mood = 3;
  if (flags.isEcstatic) mood = 5;
  else if (flags.isHappy || flags.isRelaxed || flags.isFocused) mood = 4;
  else if (isSevere) mood = 1;
  else if (
    hasPhysicalIllness ||
    flags.isAnxious ||
    flags.isStressed ||
    flags.isIrritable ||
    /\b(sad|down|bad|unwell|sick)\b/i.test(lower)
  ) {
    mood = 2;
  } else if (/\b(okay|fine|alright|neutral|meh)\b/i.test(lower)) {
    mood = lower.includes('meh') ? 2 : 3;
  }

  const isExhausted = /\b(exhaust(ed|ion)?|drained|fatigued|depleted|no\s*energy|burned\s*out|completely\s*tired|dead\s*tired)\b/i.test(lower);
  const isHighEnergy = /\b(full\s*of\s*energy|bursting\s*with\s*energy|super\s*energetic|hyper|invigorated|high\s*energy|energetic|feeling\s*strong)\b/i.test(lower);

  let energy = 3;
  if (flags.isEcstatic || isHighEnergy) energy = 5;
  else if (isExhausted || isSevere) energy = 1;
  else if (mood === 5) energy = 4;
  else if (mood === 4) energy = flags.isRelaxed ? 3 : 4;
  else if (hasPhysicalIllness || symptoms.includes('Fatigue') || /\b(tired|sluggish|weak|low\s*energy)\b/i.test(lower) || mood === 2) {
    energy = 2;
  }

  return { mood, energy };
}

export function extractWellnessData(text) {
  if (!text) return null;
  const lower = text.toLowerCase().trim();

  if (/\b(can i take|should i take|is it safe|interact|safe to|together|can i use|should i use)\b/i.test(lower)) {
    return null;
  }

  const isWellnessIntent =
    /\b(log (my )?(mood|symptoms?|wellness|energy)|feeling|i feel|i'm feeling|i am feeling|i have (a|an)?\s*(headache|stomachache|stomach\s*ache|migraine|fever|cough|cramp|pain)|headache|stomachache|stomach\s*ache|dizzy|dizziness|nausea|fatigue|fever|ecstatic|thrilled|overjoyed|very\s*happy|super\s*happy|so\s*happy|extremely\s*happy|happy|delighted|joyful|depressed|sad|unwell|sick|omutwe|olubuto|musujja)\b/i.test(
      lower
    );
  if (!isWellnessIntent) return null;

  const { symptoms, flags } = detectWellnessSymptoms(lower);
  const { mood, energy } = computeMoodAndEnergy(lower, symptoms, flags);

  return {
    mood,
    energy,
    symptoms,
    notes: text
  };
}

/**
 * Calculates total daily units consumed for a medicine based on dosage per dose,
 * daily frequency, and active scheduled reminders.
 */
export function getDailyDoseRate(medicine, reminders = []) {
  const { id, name, dosagePerDose, frequencyPerDay } = medicine || {};
  const doseVal = dosagePerDose && dosagePerDose > 0 ? dosagePerDose : 1;
  const freqVal = frequencyPerDay && frequencyPerDay > 0 ? frequencyPerDay : 1;
  const defaultDailyRate = doseVal * freqVal;

  const medReminders = (reminders || []).filter(
    (r) =>
      r.enabled !== false &&
      (r.medicineId === id ||
        (!r.medicineId && r.medicineName?.trim().toLowerCase() === name?.trim().toLowerCase()))
  );

  if (medReminders.length === 0) {
    return defaultDailyRate;
  }

  let dailyDoseSum = 0;

  for (const rem of medReminders) {
    const parsedRemDose = parseFloat(rem.dose);
    const slotDose =
      dosagePerDose && dosagePerDose > 0
        ? dosagePerDose
        : !isNaN(parsedRemDose) && parsedRemDose > 0
        ? parsedRemDose
        : 1;

    const timesCount =
      (rem.time || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean).length || 1;

    if (rem.repeatSchedule === 'daily') {
      dailyDoseSum += slotDose * timesCount;
    } else if (rem.repeatSchedule === 'custom') {
      const daysCount = rem.repeatDays && rem.repeatDays.length > 0 ? rem.repeatDays.length : 7;
      dailyDoseSum += (slotDose * timesCount * daysCount) / 7;
    } else if (rem.repeatSchedule === 'weekly') {
      const daysCount = rem.repeatDays && rem.repeatDays.length > 0 ? rem.repeatDays.length : 1;
      dailyDoseSum += (slotDose * timesCount * daysCount) / 7;
    } else {
      dailyDoseSum += slotDose * timesCount;
    }
  }

  return dailyDoseSum > 0 ? dailyDoseSum : defaultDailyRate;
}

/**
 * Shared formatting for deterministic action execution confirmations.
 */
export function formatActionExecutionMessage(action, greeting) {
  if (!action || !action.type) return null;
  const p = action.payload || {};

  if (action.type === 'ADD_MEDICINE') {
    const remText = p.reminderSchedule ? ` Companion reminder set for **${formatTimeDisplay(p.reminderSchedule.time)}**.` : '';
    return {
      text: `I've added **${p.name}** (${p.dosage}) to your medicine cabinet.${remText}\n\nYou can [view your active prescriptions in My Medications](/medications) or [track stock in Med Vault](/medvault).`,
      source: 'Cabinet Guard'
    };
  }
  if (action.type === 'REMOVE_MEDICINE') {
    return {
      text: `I've removed **${p.name}** from your active medicine cabinet.\n\nYou can [review your updated cabinet in My Medications](/medications).`,
      source: 'Cabinet Guard'
    };
  }
  if (action.type === 'ADD_REMINDER') {
    const displayTime = p.time ? formatTimeDisplay(p.time) : '8:00 AM';
    const freqCount = p.time?.includes(',') ? p.time.split(',').length : p.frequencyPerDay || 1;
    const freqText = freqCount > 1 ? ` ${freqCount} times a day` : ` ${p.repeatSchedule || 'daily'}`;
    return {
      text: `I've set up a reminder for you to take **${p.medicineName}** (${p.dose})${freqText} at **${displayTime}**.\n\nYou can [view or manage your schedule in Medication Reminders](/reminders) or [check stock in Med Vault](/medvault).`,
      source: 'Schedule Guard'
    };
  }
  if (action.type === 'UPDATE_REMINDER') {
    const displayTime = p.time ? formatTimeDisplay(p.time) : 'new time';
    return {
      text: `I've updated your reminder for **${p.medicineName}** to **${displayTime}**.\n\nYou can [review all alarms in Medication Reminders](/reminders).`,
      source: 'Schedule Guard'
    };
  }
  if (action.type === 'REMOVE_REMINDER') {
    return {
      text: `I've removed the reminder for **${p.medicineName}**.\n\nYou can [manage remaining alarms in Medication Reminders](/reminders).`,
      source: 'Schedule Guard'
    };
  }
  if (action.type === 'TOGGLE_REMINDER') {
    const statusText = p.enabled ? 'resumed' : 'paused';
    return {
      text: `I have **${statusText}** your medication reminders.\n\nYou can [view or toggle individual alarms in Medication Reminders](/reminders).`,
      source: 'Schedule Guard'
    };
  }
  if (action.type === 'SNOOZE_REMINDER') {
    return {
      text: `Snoozed your medication reminder for **${p.snoozeMinutes || 15} minutes**. I'll alert you again shortly!`,
      source: 'Schedule Guard'
    };
  }
  if (action.type === 'LOG_DOSE') {
    const statusVerb = p.status === 'taken' ? 'took' : 'missed';
    return {
      text: `I've logged that you **${statusVerb}** your dose of **${p.medicineName}**.\n\nYou can [review your adherence streak in Dose History](/history).`,
      source: 'Adherence Guard'
    };
  }
  if (action.type === 'UNDO_DOSE_LOG') {
    return {
      text: `I've reverted your last logged dose and restored your pill count in Med Vault.\n\nYou can [check your updated logs in Dose History](/history).`,
      source: 'Adherence Guard'
    };
  }
  if (action.type === 'UPDATE_MEDICINE') {
    return {
      text: `I've updated your Med Vault: **${p.name}** stock is now set to **${p.currentQuantity} tablets**.\n\nYou can [view and track your pill supply in Med Vault](/medvault).`,
      source: 'Med Vault'
    };
  }
  if (action.type === 'ADD_PATIENT') {
    return {
      text: `I've added **${p.name}**${p.relation ? ` (${p.relation})` : ''} to your Family Hub.\n\nYou can [manage multi-dependent profiles in Family Hub](/family).`,
      source: 'Family Hub Guard'
    };
  }
  if (action.type === 'SWITCH_PATIENT_SCOPE') {
    return {
      text: `Active context switched to **${p.patientName || 'Personal Profile'}**.\n\nAll subsequent queries and schedules are now scoped to this profile. You can [view family profiles in Family Hub](/family).`,
      source: 'Family Hub Guard'
    };
  }
  if (action.type === 'BATCH_ADD_REGIMEN') {
    return {
      text: `I've configured the 3-day treatment course and alarms for **${p.medicineName}** (${p.frequency} at ${p.times}).\n\nYou can [manage these alarms in Medication Reminders](/reminders).`,
      source: 'Schedule Guard'
    };
  }
  if (action.type === 'NAVIGATE_PAGE') {
    return {
      text: `Navigating directly to [${p.targetRoute}](${p.targetRoute}).`,
      source: 'Navigator Guard'
    };
  }
  if (action.type === 'OPEN_PHARMACY_MODAL') {
    return {
      text: `Opening the official **NDA Uganda Pharmacy Finder**${p.medicineName ? ` for **${p.medicineName}**` : ''}. Locating licensed dispensaries near you...`,
      source: 'NDA Locator Guard',
      suggestions: ['Find 24/7 pharmacies', 'Call nearest pharmacy', 'Check pill stock']
    };
  }
  if (action.type === 'LOG_WELLNESS') {
    const moodVal = Number(p.data?.mood) || 3;
    const energyVal = Number(p.data?.energy) || 3;
    const symptomsList = p.data?.symptoms || [];
    const symStr = symptomsList.length > 0 ? symptomsList.join(', ') : 'general check-in';
    const moodLabels = { 1: 'Low', 2: 'Meh', 3: 'Okay', 4: 'Good', 5: 'Great / Ecstatic' };
    const moodDisplay = moodLabels[moodVal] || `${moodVal}/5`;
    const isPositiveVibe =
      moodVal >= 4 &&
      !symptomsList.some((s) => ['Headache', 'Stomach Ache', 'Fever', 'Nausea', 'Dizziness', 'Pain', 'Cough'].includes(s));

    const responseText = isPositiveVibe
      ? `That's wonderful to hear${greeting}! 🌟 I've recorded your positive vibe in the Wellness Hub (Mood: **${moodDisplay}**, Vitality: **${energyVal * 20}%**). Keep embracing that great vitality!\n\nYou can [review your wellness logs in Wellness Hub](/wellness).`
      : `I've recorded this in your Wellness Hub (Mood: **${moodDisplay}**, Vitality: **${energyVal * 20}%**, Symptoms: **${symStr}**). Bambi${greeting}, please rest, stay well-hydrated, and consult a healthcare professional if symptoms persist.\n\nYou can [review your wellness logs in Wellness Hub](/wellness).`;

    return {
      text: responseText,
      source: 'Wellness Guard'
    };
  }
  return {
    text: action.confirmMessage || 'Action completed.',
    source: 'Clinical Guard'
  };
}

/**
 * Shared reminder clarification builder when user requests a reminder without a start time or matching med.
 */
export function buildReminderClarificationResponse(norm, medicines = []) {
  const matchedMed = (medicines || [])
    .filter((m) => (m.name && norm.includes(m.name.toLowerCase())) || (m.genericName && norm.includes(m.genericName.toLowerCase())))
    .sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0))[0];

  if (matchedMed) {
    const doseStr = matchedMed.dosagePerDose
      ? `${matchedMed.dosagePerDose} ${matchedMed.unit || 'tablets'}`
      : matchedMed.dosage || '1 tablet';
    const freqVal = matchedMed.frequencyPerDay && matchedMed.frequencyPerDay > 0 ? matchedMed.frequencyPerDay : 1;
    const freqStr = freqVal > 1 ? `${freqVal} times a day` : 'once daily';

    return {
      text: `I found **${matchedMed.name}** in your Med Vault, prescribed as **${doseStr}, ${freqStr}**.\n\nWhat time would you like to take your first dose so I can set up your reminder schedule?`,
      suggestions: ['Start at 7:00 AM', 'Start at 8:00 AM', 'Start at 9:00 AM', 'Take at 8:00 PM'],
      source: 'Schedule Guard',
      action: null
    };
  }

  let targetMedName = 'this medication';
  const medMatch = norm.match(
    /(?:take|reminder\s+for|set\s+a\s+reminder\s+for|add\s+a\s+reminder\s+for|remind\s+me\s+to\s+take|remind\s+me\s+for|alarm\s+for|for)\s+([a-z0-9-]+)/i
  );
  if (medMatch && !['a', 'my', 'the', 'some', 'me', 'daily', 'twice', 'an', 'once', 'alarm'].includes(medMatch[1].toLowerCase())) {
    targetMedName = medMatch[1].charAt(0).toUpperCase() + medMatch[1].slice(1);
  }

  return {
    text: `I couldn't find **${targetMedName}** in your Medications or Med Vault cabinet.\n\nTo set up the right reminder schedule for you, could you please tell me:\n1. **What is your prescribed dosage** (e.g., *1 tablet*, *500mg*, or *10ml*)?\n2. **How often should you take it** (e.g., *once daily*, *twice a day*, or *3 times a day*) and at what preferred times?\n\nYou can also [add it to your medicine cabinet](/medications) or [track stock in Med Vault](/medvault) so I can automatically sync your dosage and refill alerts.`,
    suggestions: [
      '1 tablet once daily at 8am',
      '2 tablets twice daily at 8am',
      '2 tablets 3 times daily at 8am',
      `Add ${targetMedName} to cabinet`
    ],
    source: 'Schedule Guard',
    action: null
  };
}

/**
 * Shared pediatric, geriatric, and adult food/drink/chewables guidance builder.
 */
export function buildAgeTailoredFoodGuidance(medName, resolvedAge, greeting) {
  if (resolvedAge !== null && resolvedAge < 12) {
    const ageDetail =
      resolvedAge === 0 ? 'an infant' : resolvedAge <= 3 ? `a toddler (${resolvedAge} yrs)` : `a child (${resolvedAge} yrs)`;
    return {
      text:
        `Here is age-tailored food, chewables, and drink guidance for **${medName}** for ${ageDetail}${greeting}:\n\n` +
        `• 🍬 **Chewable & Liquid Alternatives**: Swallowing whole pills is a serious choking risk for young children. Ask your pharmacist or clinician for **chewable tablets**, **orally dispersible tablets (ODTs)**, or **oral syrups/suspensions**.\n` +
        `• 🥣 **Soft Food Vehicles for Crushed Meds**: If the tablet is approved by a doctor or pharmacist to be crushed (never crush extended-release or coated pills), mix the dose into 1–2 teaspoons of smooth, palatable food:\n` +
        `  - **Everyday options**: Smooth applesauce, plain yogurt, fruit puree, or oatmeal.\n` +
        `  - **Local Ugandan options**: Warm smooth *Bushera* (millet porridge) or mashed soft *Matooke*.\n` +
        `  - *Instruction*: Have the child take the spoonful immediately without chewing, followed by a drink.\n` +
        `• 💧 **Safe Drinks**: Ample water, breast milk, infant formula, or oral rehydration solution (ORS). If taking antibiotics like Ciprofloxacin, space high-calcium dairy by at least 2 hours.\n` +
        `• ⚠️ **Critical Pediatric Warning**: **NEVER give honey** to infants under 1 year of age due to the severe risk of infant botulism. Avoid whole nuts, crunchy raw vegetables, or hard chewables due to choking hazards.\n\n` +
        `You can [check drug & food interactions in Interactions Guard](/interactions) or [review active medications](/medications).`,
      suggestions: ['Chewable medication options', 'Safe drinks with medication', 'Check drug interactions'],
      source: 'Clinical Pediatric Guard',
      action: null
    };
  }

  if (resolvedAge !== null && resolvedAge >= 65) {
    return {
      text:
        `Here is age-tailored food and beverage guidance for **${medName}** for seniors (Age: ${resolvedAge} yrs)${greeting}:\n\n` +
        `• 🥣 **Soft & Moist Foods (Swallowing Ease)**: To prevent swallowing difficulties (presbyphagia) and soothe the stomach:\n` +
        `  - **Local Ugandan options**: Steamed soft *Matooke*, warm smooth *Bushera* (millet/sorghum porridge), or steamed *Luwombo*.\n` +
        `  - **Everyday staples**: Warm oatmeal, Greek yogurt, soft scrambled eggs, applesauce, or pureed vegetable soups.\n` +
        `• 💧 **Swallowing Technique & Drinks**: Take a sip of water first to lubricate your throat, swallow the pill with a full glass of water (250ml) while sitting upright, and **remain sitting or standing upright for at least 30 minutes** to avoid esophageal irritation.\n` +
        `• ⚠️ **Nutritional & Drug Cautions**:\n` +
        `  - *Potassium*: If taking blood pressure or heart medications (ACE inhibitors like Lisinopril, ARBs, or Spironolactone), avoid excessive high-potassium foods (*Matooke*, bananas, avocados) or potassium salt substitutes.\n` +
        `  - *Calcium Spacing*: Space high-calcium foods (*Mukene*, dairy, fortified milks) at least 2 hours apart from thyroid medications (Levothyroxine) or certain antibiotics.\n` +
        `  - *Grapefruit & Alcohol*: Strictly avoid grapefruit juice and alcohol/Waragi.\n\n` +
        `You can [check drug & food interactions in Interactions Guard](/interactions) or [review active medications](/medications).`,
      suggestions: ['Safe foods for seniors', 'Check drug interactions', 'View active medications'],
      source: 'Clinical Geriatric Guard',
      action: null
    };
  }

  const isFatSoluble = /coartem|artemether|lumefantrine|griseofulvin|isotretinoin|vitamin d/i.test(medName);
  const fatGuidance = isFatSoluble
    ? `• 🥑 **Healthy Fats for Absorption (Crucial)**: **${medName}** requires dietary fats to be absorbed effectively into the bloodstream:\n` +
      `  - **Local options**: *G-nut sauce* (groundnut stew) or *Eshabwe*.\n` +
      `  - **Everyday options**: Fresh avocado, whole milk, eggs, peanut butter, or yogurt.\n`
    : `• 🍲 **Stomach Buffers**: To buffer the stomach lining and prevent gastric irritation:\n` +
      `  - **Local options**: Steamed *Matooke*, *Posho*, or *Kalo*.\n` +
      `  - **Everyday staples**: Plain oatmeal, white rice, toast, crackers, or plain yogurt.\n`;

  return {
    text:
      `Here is recommended food, chewables, and drink guidance for **${medName}**${greeting}:\n\n` +
      fatGuidance +
      `• 💧 **Drink Pairings & Hydration**: Always take your medication with a **full glass of plain water** (250ml+) to ensure the tablet dissolves smoothly in your stomach and prevents esophageal irritation.\n` +
      `• 🍬 **Chewables & Formulation Notes**: If you struggle with swallowing solid tablets, ask your doctor or pharmacist about chewable tablets, dispersible tablets, or smooth oral suspensions.\n` +
      `• ⚠️ **Key Dietary Warnings**:\n` +
      `  - **Alcohol & Waragi**: Strictly avoid with Paracetamol (liver damage) and Metronidazole (severe violent reaction).\n` +
      `  - **Grapefruit & Grapefruit Juice**: Avoid with statins and blood pressure medications (blocks CYP3A4 enzyme).\n` +
      `  - **Calcium & Mukene**: Space calcium-rich foods and dairy at least 2 hours away from fluoroquinolone (Ciprofloxacin) and tetracycline antibiotics.\n\n` +
      `You can [check your drug & food interactions in Interactions Guard](/interactions) to test specific dishes.`,
    suggestions: ['What foods should I avoid?', 'Can I take with milk?', 'Check drug interactions'],
    source: 'Dietary Safety Guard',
    action: null
  };
}

