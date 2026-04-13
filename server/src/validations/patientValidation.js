import { z } from 'zod';

export const createPatientSchema = z.object({
  body: z.object({
    managedBy: z.string({ required_error: 'managedBy is required' }),
    name: z.string({ required_error: 'Patient name is required' }),
    relationship: z.string().optional(),
    avatar: z.string().optional(),
    dateOfBirth: z.string().optional(),
    gender: z.string().optional(),
  })
});

export const updatePatientSchema = z.object({
  params: z.object({
    id: z.string({ required_error: 'Patient ID is required' }),
  }),
  body: z.object({
    name: z.string().optional(),
    relationship: z.string().optional(),
    avatar: z.string().optional(),
    dateOfBirth: z.string().optional(),
    gender: z.string().optional(),
  })
});

export const getPatientsSchema = z.object({
  query: z.object({
    managedBy: z.string({ required_error: 'managedBy query parameter is required' }),
  })
});
