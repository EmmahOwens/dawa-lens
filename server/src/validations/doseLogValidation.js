import { z } from 'zod';

export const createDoseLogSchema = z.object({
  body: z.object({
    userId: z.string({ required_error: 'userId is required' }),
    medicineName: z.string({ required_error: 'Medicine name is required' }),
    status: z.enum(['taken', 'skipped', 'missed'], { required_error: 'Status is required' }),
    actionTime: z.string().optional(),
    dose: z.string().optional(),
    patientId: z.string().optional(),
  })
});

export const getDoseLogsSchema = z.object({
  query: z.object({
    userId: z.string({ required_error: 'userId query parameter is required' }),
  })
});
