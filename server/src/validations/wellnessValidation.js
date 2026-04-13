import { z } from 'zod';

export const logWellnessSchema = z.object({
  body: z.object({
    userId: z.string({ required_error: 'User ID is required' }),
    type: z.enum(['symptom', 'food', 'mood'], { 
      required_error: 'Log type must be symptom, food, or mood' 
    }),
    patientId: z.string().optional(),
    timestamp: z.string().optional(),
    data: z.record(z.any()).optional(),
    notes: z.string().optional(),
  })
});

export const getWellnessSchema = z.object({
  query: z.object({
    userId: z.string({ required_error: 'User ID query parameter is required' }),
    patientId: z.string().optional(),
  })
});
