import { z } from 'zod';

export const getUserSchema = z.object({
  params: z.object({
    uid: z.string({ required_error: 'User UID is required' }),
  })
});

export const upsertUserSchema = z.object({
  body: z.object({
    uid: z.string({ required_error: 'User ID is required' }),
    name: z.string().optional(),
    dateOfBirth: z.string().nullable().optional(),
    gender: z.string().nullable().optional(),
    isProfessional: z.boolean().optional(),
  })
});
