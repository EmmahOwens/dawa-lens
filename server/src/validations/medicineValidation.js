import { z } from 'zod';

export const createMedicineSchema = z.object({
  body: z.object({
    userId: z.string({ required_error: 'userId is required' }),
    name: z.string({ required_error: 'Medicine name is required' }),
    genericName: z.string().optional(),
    dosage: z.string().optional(),
    patientId: z.string().optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
    totalDoses: z.number().optional(),
    dosesTaken: z.number().optional(),
  })
});

export const updateMedicineSchema = z.object({
  params: z.object({
    id: z.string({ required_error: 'Medicine ID is required' }),
  }),
  body: z.object({
    name: z.string().optional(),
    genericName: z.string().optional(),
    dosage: z.string().optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
    totalDoses: z.number().optional(),
    dosesTaken: z.number().optional(),
  })
});

export const getMedicinesSchema = z.object({
  query: z.object({
    userId: z.string({ required_error: 'userId query parameter is required' }),
    patientId: z.string().optional(),
  })
});
