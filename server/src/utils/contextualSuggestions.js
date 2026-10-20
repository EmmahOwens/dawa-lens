/**
 * Contextual Suggestion Engine for DawaGPT (Shared Backend & Frontend)
 *
 * Ensures all suggested prompts dynamically and accurately match the immediate
 * conversation topic, medications, symptoms, and user actions, replacing generic
 * boilerplate with natural, high-relevance follow-ups.
 */

const GENERIC_BOILERPLATE_PATTERNS = [
  /^check medications$/i,
  /^view reminders$/i,
  /^drug safety$/i,
  /^try (again|asking again)$/i,
  /^how is my pill stock\??$/i,
  /^open (my )?med vault$/i,
  /^contact (support|nda)( for uganda)?$/i,
  /^open settings$/i,
  /^check drug interactions$/i,
  /^check my medications$/i,
];

export function isGenericBoilerplate(suggestions) {
  if (!Array.isArray(suggestions) || suggestions.length === 0) return true;
  const genericCount = suggestions.filter((s) => {
    if (typeof s !== 'string') return true;
    const trimmed = s.trim();
    return GENERIC_BOILERPLATE_PATTERNS.some((pat) => pat.test(trimmed));
  }).length;
  return genericCount >= 2;
}

const SYMPTOM_PATTERNS = [
  {
    regex: /\b(headache|migraine|omutwe)\b/i,
    suggestions: [
      'Safe home remedies for headache',
      'Which painkiller is safest for me?',
      'When should I see a doctor?'
    ]
  },
  {
    regex: /\b(fever|temperature|musujja|chills)\b/i,
    suggestions: [
      'Safe ways to reduce fever',
      'Could this be malaria or infection?',
      'Warning signs that need urgent care'
    ]
  },
  {
    regex: /\b(malaria|coartem|artemether|lumefantrine)\b/i,
    suggestions: [
      'What food to take with Coartem?',
      'What if I vomit my malaria dose?',
      'How long until I feel better?'
    ]
  },
  {
    regex: /\b(stomach\s*ache|stomachache|nausea|vomit(ing)?|gastritis|ulcer|olubuto)\b/i,
    suggestions: [
      'Gentle foods that soothe nausea',
      'Which medicines irritate the stomach?',
      'When to consult a doctor'
    ]
  },
  {
    regex: /\b(dizzy|dizziness|lightheaded|vertigo)\b/i,
    suggestions: [
      'Could my medicine cause dizziness?',
      'What should I do right now?',
      'Check my blood pressure'
    ]
  },
  {
    regex: /\b(cough|flu|cold|sore throat|congestion|catarrh)\b/i,
    suggestions: [
      'Soothing drinks for cough and throat',
      'Do cold meds interact with my pills?',
      'How long does this usually last?'
    ]
  },
  {
    regex: /\b(diarrhea|loose stool|dehydration|ors)\b/i,
    suggestions: [
      'How to prepare ORS at home',
      'Safe foods to eat with diarrhea',
      'When is dehydration an emergency?'
    ]
  },
  {
    regex: /\b(hypertension|high blood pressure|bp|amlodipine|lisinopril|losartan)\b/i,
    suggestions: [
      'Foods that help manage blood pressure',
      'What if I forget my BP dose?',
      'Common side effects of BP meds'
    ]
  },
  {
    regex: /\b(diabetes|blood sugar|metformin|glibenclamide|insulin)\b/i,
    suggestions: [
      'Signs of low blood sugar (hypo)',
      'Best meal timing for Metformin',
      'Foods to moderate with diabetes'
    ]
  },
  {
    regex: /\b(pregnant|pregnancy|expecting|breastfeeding|nursing)\b/i,
    suggestions: [
      'Which medicines are safe in pregnancy?',
      'Safe remedies for morning sickness',
      'Consulting NDA pregnancy guidelines'
    ]
  },
  {
    regex: /\b(allergy|allergic|rash|itching|hives)\b/i,
    suggestions: [
      'Is this an allergic drug reaction?',
      'Signs of severe anaphylaxis',
      'Safe antihistamine options'
    ]
  }
];

const DIET_PATTERNS = [
  {
    regex: /\b(alcohol|waragi|beer|wine|spirits|kasese|malwa)\b/i,
    suggestions: [
      'How long after alcohol can I take meds?',
      'Why is alcohol dangerous with Flagyl?',
      'Check liver safety with Panadol'
    ]
  },
  {
    regex: /\b(milk|dairy|yogurt|mukene|calcium)\b/i,
    suggestions: [
      'How many hours to space dairy?',
      'Does milk weaken antibiotics?',
      'Best non-dairy drinks with medicine'
    ]
  },
  {
    regex: /\b(grapefruit|grapefruit juice)\b/i,
    suggestions: [
      'Why does grapefruit block drug breakdown?',
      'Which medications does it affect?',
      'Safe alternative fruit juices'
    ]
  },
  {
    regex: /\b(matooke|posho|kalo|g-nut|bushera|food|meal|eat|swallow)\b/i,
    suggestions: [
      'Should I take my pills before or after meals?',
      'Does G-nut sauce boost absorption?',
      'Best soft foods for swallowing pills'
    ]
  }
];

const COMMON_DRUGS = [
  'Panadol', 'Paracetamol', 'Ibuprofen', 'Amoxicillin', 'Coartem', 'Metronidazole',
  'Flagyl', 'Metformin', 'Ciprofloxacin', 'Amlodipine', 'Omeprazole', 'Diclofenac',
  'Cetirizine', 'Azithromycin', 'Artemether', 'Lumefantrine', 'Warfarin', 'Aspirin'
];

function extractContextEntities(text, medicines = []) {
  const norm = (text || '').toLowerCase();
  const matchedMeds = [];

  if (Array.isArray(medicines)) {
    for (const m of medicines) {
      if (m?.name && norm.includes(m.name.toLowerCase())) {
        matchedMeds.push(m.name);
      } else if (m?.genericName && norm.includes(m.genericName.toLowerCase())) {
        matchedMeds.push(m.genericName);
      }
    }
  }

  for (const d of COMMON_DRUGS) {
    if (norm.includes(d.toLowerCase()) && !matchedMeds.some((m) => m.toLowerCase() === d.toLowerCase())) {
      matchedMeds.push(d);
    }
  }

  return { matchedMeds, norm };
}

function getActionSuggestions(action, matchedMeds) {
  if (!action?.type) return null;
  const medName = action.payload?.medicineName || action.payload?.name || matchedMeds[0] || 'my medicine';
  switch (action.type) {
    case 'ADD_REMINDER':
      return [
        'Set an evening reminder',
        `What food to take with ${medName}?`,
        `Does ${medName} have side effects?`
      ];
    case 'LOG_DOSE':
      return [
        `When is my next dose of ${medName}?`,
        'Log another dose',
        'How many doses left in vault?'
      ];
    case 'UPDATE_MEDICINE':
      return [
        `How many days supply is ${medName}?`,
        `Set a reminder for ${medName}`,
        'When will I need a refill?'
      ];
    case 'LOG_WELLNESS':
      return [
        'Safe remedies to soothe symptoms',
        'When should I see a doctor?',
        'Can I take medication for this?'
      ];
    default:
      return null;
  }
}

function getQueryIntentSuggestions(lastUserMsg, norm, matchedMeds) {
  if (/\b(remind|alarm|schedule)\b/i.test(lastUserMsg)) {
    const med = matchedMeds[0] || 'this medicine';
    return [
      `What food to take with ${med}?`,
      `What if I miss a dose of ${med}?`,
      'How many days of supply do I have?'
    ];
  }
  if (/\b(refill|stock|vault|pill count|supply|doses left|days left)\b/i.test(lastUserMsg)) {
    const med = matchedMeds[0] || 'my meds';
    return [
      `How many days of ${med} are left?`,
      'Which medicines need restocking?',
      'Set reminder before stock runs out'
    ];
  }
  if (
    /\b(duplicat|same class|same task|taking both|together|interact|conflict)\b/i.test(norm) &&
    matchedMeds.length >= 2
  ) {
    return [
      `Which is safer: ${matchedMeds[0]} or ${matchedMeds[1]}?`,
      'Can I alternate them safely?',
      'How many hours between doses?'
    ];
  }
  return null;
}

function getMedicationSuggestions(matchedMeds, norm) {
  if (matchedMeds.length === 0) return null;
  const primaryMed = matchedMeds[0];

  if (/\b(food|eat|drink|milk|alcohol|matooke|meal)\b/i.test(norm)) {
    return [
      `Can I take ${primaryMed} with milk?`,
      `What foods should I avoid with ${primaryMed}?`,
      `Should I take ${primaryMed} with meals?`
    ];
  }
  if (/\b(side effect|reaction|danger|safe|harm|bad)\b/i.test(norm)) {
    return [
      `Common side effects of ${primaryMed}`,
      `What if I feel dizzy after ${primaryMed}?`,
      `When to call a doctor for ${primaryMed}`
    ];
  }
  return [
    `What foods go well with ${primaryMed}?`,
    `What if I miss a dose of ${primaryMed}?`,
    `Does ${primaryMed} interact with anything?`
  ];
}

function resolvePatientAge(userProfile, activePatient) {
  if (activePatient?.age !== undefined && activePatient?.age !== null) return activePatient.age;
  if (activePatient?.dateOfBirth) {
    return new Date().getFullYear() - new Date(activePatient.dateOfBirth).getFullYear();
  }
  if (userProfile?.age !== undefined && userProfile?.age !== null) return userProfile.age;
  if (userProfile?.dateOfBirth) {
    return new Date().getFullYear() - new Date(userProfile.dateOfBirth).getFullYear();
  }
  return undefined;
}

function getDemographicSuggestions(userProfile, activePatient, norm) {
  const patientAge = resolvePatientAge(userProfile, activePatient);
  if (patientAge === undefined || patientAge === null) return null;

  if (patientAge < 12 || /\b(child|baby|infant|toddler|pediatric)\b/i.test(norm)) {
    return [
      'Chewable medication options',
      'Can I crush tablets in porridge?',
      'Safe drinks for children'
    ];
  }
  if (patientAge >= 65 || /\b(senior|elderly|grandma|grandpa)\b/i.test(norm)) {
    return [
      'Swallowing tips for seniors',
      'Soothing foods to take with pills',
      'Checking drug interactions'
    ];
  }
  return null;
}

const PAGE_SUGGESTIONS_MAP = [
  {
    key: '/interactions',
    suggestions: [
      'Does Panadol interact with Ibuprofen?',
      'Is Matooke safe with my meds?',
      'Can I drink alcohol with antibiotics?'
    ]
  },
  {
    key: '/medvault',
    suggestions: [
      'How many days of meds do I have left?',
      'Which medications are low on stock?',
      'How is days of supply calculated?'
    ]
  },
  {
    key: '/reminders',
    suggestions: [
      'Add a medicine reminder for 8:00 AM',
      'What are my scheduled doses today?',
      'How to pause or snooze a reminder'
    ]
  },
  {
    key: '/wellness',
    suggestions: [
      'Log how I am feeling today',
      'Safe home remedies for headache',
      'How to improve my vitality score'
    ]
  },
  {
    key: '/family',
    suggestions: [
      'Check family medication schedules',
      'Add a family member or dependent',
      'Check interactions for family'
    ]
  },
  {
    key: '/travel',
    suggestions: [
      'Calculate travel medication supply',
      'Adjusting doses across time zones',
      'Carrying prescriptions through customs'
    ]
  }
];

function getPageSuggestions(currentPage) {
  if (!currentPage) return null;
  const matched = PAGE_SUGGESTIONS_MAP.find((entry) => currentPage.includes(entry.key));
  return matched ? matched.suggestions : null;
}

function getLastRoleMessageText(messages, role) {
  if (!Array.isArray(messages)) return '';
  const msg = messages.filter((m) => m.role === role).pop();
  return msg?.content || msg?.text || '';
}

export function generateContextualSuggestions({
  messages = [],
  userQuery = '',
  assistantText = '',
  medicines = [],
  userProfile = null,
  activePatient = null,
  currentPage = null,
  action = null,
  existingSuggestions = []
} = {}) {
  if (
    Array.isArray(existingSuggestions) &&
    existingSuggestions.length >= 2 &&
    !isGenericBoilerplate(existingSuggestions)
  ) {
    return existingSuggestions.slice(0, 3);
  }

  const lastUserMsg = userQuery || getLastRoleMessageText(messages, 'user');
  const lastAssistantMsg = assistantText || getLastRoleMessageText(messages, 'assistant');
  const { matchedMeds, norm } = extractContextEntities(`${lastUserMsg} ${lastAssistantMsg}`, medicines);

  const byAction = getActionSuggestions(action, matchedMeds);
  if (byAction) return byAction.slice(0, 3);

  const byIntent = getQueryIntentSuggestions(lastUserMsg, norm, matchedMeds);
  if (byIntent) return byIntent.slice(0, 3);

  const byMed = getMedicationSuggestions(matchedMeds, norm);
  if (byMed) return byMed.slice(0, 3);

  for (const item of [...SYMPTOM_PATTERNS, ...DIET_PATTERNS]) {
    if (item.regex.test(norm)) return item.suggestions.slice(0, 3);
  }

  const byDemographics = getDemographicSuggestions(userProfile, activePatient, norm);
  if (byDemographics) return byDemographics;

  const byPage = getPageSuggestions(currentPage);
  if (byPage) return byPage;

  if (Array.isArray(medicines) && medicines.length > 0 && medicines[0]?.name) {
    const med = medicines[0].name;
    return [
      `When should I take ${med}?`,
      `Does ${med} have side effects?`,
      `Is ${med} safe with local foods?`
    ];
  }

  return [
    'Check drug & food safety',
    'What foods pair well with medicines?',
    'How to manage side effects'
  ];
}
