import { z } from 'zod';

export const medicineInputSchema = z.object({
  id: z.string().max(100).optional(),
  name: z.string().min(1).max(200),
  genericName: z.string().max(200).optional(),
  dosage: z.string().max(100).optional(),
  form: z.string().max(100).optional(),
  currentQuantity: z.number().min(0).max(1000000).optional(),
  dosagePerDose: z.number().min(0).max(100).optional(),
  frequencyPerDay: z.number().min(0).max(24).optional(),
  color: z.string().max(50).optional(),
  icon: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
  patientId: z.string().max(100).nullable().optional(),
  isConflict: z.boolean().optional(),
}).strip();

export const doseLogInputSchema = z.object({
  id: z.string().max(100).optional(),
  medicineName: z.string().max(200),
  action: z.enum(['taken', 'skipped', 'missed', 'snoozed']),
  actionTime: z.string().max(100).optional(),
  scheduledTime: z.string().max(100).optional(),
  dose: z.string().max(100).optional(),
  patientId: z.string().max(100).nullable().optional(),
  reminderId: z.string().max(100).optional(),
}).strip();

export const wellnessLogInputSchema = z.object({
  id: z.string().max(100).optional(),
  type: z.string().max(50).optional(),
  timestamp: z.string().max(100).optional(),
  date: z.string().max(100).optional(),
  mood: z.number().min(1).max(5).nullable().optional(),
  energy: z.number().min(1).max(5).nullable().optional(),
  symptoms: z.array(z.string().max(200)).max(20).optional(),
  notes: z.string().max(1000).optional(),
  patientId: z.string().max(100).nullable().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
}).strip();

export const reminderInputSchema = z.object({
  id: z.string().max(100).optional(),
  medicineName: z.string().max(200),
  dose: z.string().max(100).optional(),
  time: z.string().max(100).optional(),
  repeatSchedule: z.string().max(100).optional(),
  patientId: z.string().max(100).nullable().optional(),
  medicineId: z.string().max(100).nullable().optional(),
}).strip();

export const patientInputSchema = z.object({
  id: z.string().max(100).optional(),
  name: z.string().max(100).optional(),
  age: z.number().min(0).max(150).nullable().optional(),
  gender: z.string().max(50).nullable().optional(),
  relation: z.string().max(50).optional(),
  relationship: z.string().max(50).optional(),
}).strip();

export const userProfileInputSchema = z.object({
  id: z.string().max(100).optional(),
  name: z.string().max(100).optional(),
  email: z.string().max(200).nullable().optional(),
  age: z.number().min(0).max(150).nullable().optional(),
  dateOfBirth: z.string().max(100).nullable().optional(),
  gender: z.string().max(50).nullable().optional(),
  allergies: z.array(z.string().max(200)).max(50).optional(),
  conditions: z.array(z.string().max(200)).max(50).optional(),
  isProfessional: z.boolean().optional(),
  language: z.string().max(50).optional(),
}).strip();

export const vitalitySummaryInputSchema = z.object({
  name: z.string().max(100).optional(),
  adherence: z.number().nullable().optional(),
  energy: z.number().nullable().optional(),
  mood: z.number().nullable().optional(),
  type: z.string().max(100).optional(),
  score: z.number().nullable().optional(),
  label: z.string().max(200).optional(),
  value: z.any().optional(),
}).passthrough();

export const wellnessQuoteSchema = z.object({
  body: z.object({
    userName: z.string().max(100).optional(),
  })
});

export const healthDiscoveriesSchema = z.object({
  body: z.object({}).optional()
});

export const coachAdviceSchema = z.object({
  body: z.object({
    logs: z.array(doseLogInputSchema).max(50).optional(),
    medicines: z.array(medicineInputSchema).max(50).optional(),
    userName: z.string().max(100).optional(),
  })
});

export const holisticSafetySchema = z.object({
  body: z.object({
    medicines: z.array(medicineInputSchema).max(50),
    lifestyleFactors: z.array(z.string().max(200)).max(20).optional(),
  })
});

export const travelAdviceSchema = z.object({
  body: z.object({
    medicines: z.array(medicineInputSchema).max(50),
    destination: z.string().max(200),
    currentCity: z.string().max(200).optional(),
    homeTimezone: z.string().max(100).optional(),
    targetTimezone: z.string().max(100).optional(),
  })
});

export const wellnessInsightSchema = z.object({
  body: z.object({
    doseLogs: z.array(doseLogInputSchema).max(100).optional(),
    wellnessLogs: z.array(wellnessLogInputSchema).max(100).optional(),
    medicines: z.array(medicineInputSchema).max(50).optional(),
  })
});

export const mealCheckSchema = z.object({
  body: z.object({
    medicines: z.array(medicineInputSchema).max(50),
    mealDescription: z.string().min(1).max(1000, 'Meal description too long'),
  })
});

export const nutritionalGuidanceSchema = z.object({
  body: z.object({
    medicines: z.array(medicineInputSchema).max(50),
  })
});

export const emotionReflectionSchema = z.object({
  body: z.object({
    mood: z.number().min(1).max(5),
    energy: z.number().min(1).max(5),
    symptoms: z.array(z.string().max(200)).max(20).optional(),
    medicines: z.array(medicineInputSchema).max(50).optional(),
  })
});

export const chatSchema = z.object({
  body: z.object({
    messages: z.array(z.object({
      id: z.string().optional(),
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string().max(20000).optional(),
      text: z.string().max(20000).optional(),
      source: z.string().optional(),
      suggestions: z.array(z.string()).optional(),
    })).max(50),
    medicines: z.array(medicineInputSchema).max(50).optional(),
    userProfile: userProfileInputSchema.nullable().optional(),
    doseLogs: z.array(doseLogInputSchema).max(50).optional(),
    reminders: z.array(reminderInputSchema).max(50).optional(),
    wellnessLogs: z.array(wellnessLogInputSchema).max(50).optional(),
    vitalitySummary: z.array(vitalitySummaryInputSchema).max(20).optional(),
    patients: z.array(patientInputSchema).max(20).optional(),
    selectedPatientId: z.string().max(100).nullable().optional(),
    currentPage: z.string().max(200).nullable().optional(),
  })
});
