import { z } from 'zod';

export const createMedicineSchema = z.object({
  body: z.object({
    _id: z.string().max(128).optional(),
    userId: z.string({ required_error: 'userId is required' }),
    name: z.string({ required_error: 'Medicine name is required' }).min(1).max(200),
    genericName: z.string().max(200).optional(),
    dosage: z.string().max(100).optional(),
    form: z.string().max(100).optional(),
    unit: z.string().max(50).optional(),
    currentQuantity: z.number().optional(),
    totalQuantity: z.number().optional(),
    dosagePerDose: z.number().optional(),
    frequencyPerDay: z.number().optional(),
    patientId: z.string().nullable().optional(),
    icon: z.string().max(50).optional(),
    color: z.string().max(50).optional(),
    notes: z.string().max(2000).optional(),
    imageUrl: z.string().max(2000).optional(),
    isConflict: z.boolean().optional(),
    rxcui: z.string().max(50).optional(),
    rxNormConcept: z.record(z.string(), z.unknown()).optional(),
    totalDoses: z.number().optional(),
    dosesTaken: z.number().optional(),
    addedAt: z.string().max(100).optional(),
    createdAt: z.string().max(100).optional(),
    updatedAt: z.string().max(100).optional(),
  })
});

export const updateMedicineSchema = z.object({
  params: z.object({
    id: z.string({ required_error: 'Medicine ID is required' }),
  }),
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    genericName: z.string().max(200).optional(),
    dosage: z.string().max(100).optional(),
    form: z.string().max(100).optional(),
    unit: z.string().max(50).optional(),
    currentQuantity: z.number().optional(),
    totalQuantity: z.number().optional(),
    dosagePerDose: z.number().optional(),
    frequencyPerDay: z.number().optional(),
    patientId: z.string().nullable().optional(),
    icon: z.string().max(50).optional(),
    color: z.string().max(50).optional(),
    notes: z.string().max(2000).optional(),
    imageUrl: z.string().max(2000).optional(),
    isConflict: z.boolean().optional(),
    rxcui: z.string().max(50).optional(),
    rxNormConcept: z.record(z.string(), z.unknown()).optional(),
    totalDoses: z.number().optional(),
    dosesTaken: z.number().optional(),
    updatedAt: z.string().max(100).optional(),
  })
});

export const getMedicinesSchema = z.object({
  query: z.object({
    userId: z.string({ required_error: 'userId query parameter is required' }),
    patientId: z.string().optional(),
  })
});
