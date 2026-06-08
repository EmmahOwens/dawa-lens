import { z } from 'zod';

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
    logs: z.array(z.any()).max(50).optional(),
    medicines: z.array(z.any()).max(50).optional(),
    userName: z.string().max(100).optional(),
  })
});

export const holisticSafetySchema = z.object({
  body: z.object({
    medicines: z.array(z.any()).max(50),
    lifestyleFactors: z.array(z.string().max(200)).max(20).optional(),
  })
});

export const travelAdviceSchema = z.object({
  body: z.object({
    medicines: z.array(z.any()).max(50),
    destination: z.string().max(200),
    currentCity: z.string().max(200).optional(),
    homeTimezone: z.string().max(100).optional(),
    targetTimezone: z.string().max(100).optional(),
  })
});

export const wellnessInsightSchema = z.object({
  body: z.object({
    doseLogs: z.array(z.any()).max(100).optional(),
    wellnessLogs: z.array(z.any()).max(100).optional(),
    medicines: z.array(z.any()).max(50).optional(),
  })
});

export const mealCheckSchema = z.object({
  body: z.object({
    medicines: z.array(z.any()).max(50),
    mealDescription: z.string().min(1).max(1000, 'Meal description too long'),
  })
});

export const nutritionalGuidanceSchema = z.object({
  body: z.object({
    medicines: z.array(z.any()).max(50),
  })
});

export const emotionReflectionSchema = z.object({
  body: z.object({
    mood: z.number().min(1).max(5),
    energy: z.number().min(1).max(5),
    symptoms: z.array(z.string().max(200)).max(20).optional(),
    medicines: z.array(z.any()).max(50).optional(),
  })
});

export const chatSchema = z.object({
  body: z.object({
    messages: z.array(z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string().max(2000).optional(),
      text: z.string().max(2000).optional(),
    })).max(20),
    medicines: z.array(z.any()).max(50).optional(),
    userProfile: z.any().optional(),
    doseLogs: z.array(z.any()).max(50).optional(),
    reminders: z.array(z.any()).max(50).optional(),
    wellnessLogs: z.array(z.any()).max(50).optional(),
    patients: z.array(z.any()).max(20).optional(),
    selectedPatientId: z.string().max(100).optional(),
  })
});
