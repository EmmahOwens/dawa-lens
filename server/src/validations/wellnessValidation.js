import { z } from 'zod';

export const logWellnessSchema = z.object({
  body: z.object({
    userId: z.string({ required_error: 'User ID is required' }),
    type: z.enum(['symptom', 'food', 'mood'], { 
      required_error: 'Log type must be symptom, food, or mood' 
    }),
    patientId: z.string().optional(),
    timestamp: z.string().max(100).optional(),
    data: z.record(z.union([z.string().max(500), z.number(), z.boolean(), z.array(z.string().max(200))])).optional(),
    notes: z.string().max(1000).optional(),
  })
});

export const getWellnessSchema = z.object({
  query: z.object({
    userId: z.string({ required_error: 'User ID query parameter is required' }),
    patientId: z.string().optional(),
  })
});
