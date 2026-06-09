import { z } from 'zod';

export const getUserSchema = z.object({
  params: z.object({
    uid: z.string({ required_error: 'User UID is required' }),
  })
});

export const upsertUserSchema = z.object({
  body: z.object({
    uid: z.string({ required_error: 'User ID is required' }),
    name: z.string().max(200).optional(),
    dateOfBirth: z.string().max(100).nullable().optional(),
    gender: z.string().max(50).nullable().optional(),
    isProfessional: z.boolean().optional(),
    language: z.string().max(50).optional(),
    timezone: z.string().max(100).optional(),
    currentCity: z.string().max(200).optional(),
  })
});
