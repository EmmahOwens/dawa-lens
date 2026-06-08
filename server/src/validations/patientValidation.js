import { z } from 'zod';

export const createPatientSchema = z.object({
  body: z.object({
    managedBy: z.string({ required_error: 'managedBy is required' }),
    name: z.string({ required_error: 'Patient name is required' }).min(1).max(200),
    relationship: z.string().max(100).optional(),
    avatar: z.string().max(500).optional(),
    dateOfBirth: z.string().max(100).optional(),
    gender: z.string().max(50).optional(),
  })
});

export const updatePatientSchema = z.object({
  params: z.object({
    id: z.string({ required_error: 'Patient ID is required' }),
  }),
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    relationship: z.string().max(100).optional(),
    avatar: z.string().max(500).optional(),
    dateOfBirth: z.string().max(100).optional(),
    gender: z.string().max(50).optional(),
  })
});

export const getPatientsSchema = z.object({
  query: z.object({
    managedBy: z.string({ required_error: 'managedBy query parameter is required' }),
  })
});
