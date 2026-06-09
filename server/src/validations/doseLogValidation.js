import { z } from 'zod';

export const createDoseLogSchema = z.object({
  body: z.object({
    userId: z.string({ required_error: 'userId is required' }),
    medicineName: z.string({ required_error: 'Medicine name is required' }).max(200),
    action: z.enum(['taken', 'skipped', 'missed', 'snoozed'], { required_error: 'Action is required' }),
    actionTime: z.string().max(100).optional(),
    dose: z.string().max(100).optional(),
    patientId: z.string().nullable().optional(),
    reminderId: z.string().optional(),
    scheduledTime: z.string().max(100).optional(),
  })
});

export const getDoseLogsSchema = z.object({
  query: z.object({
    userId: z.string({ required_error: 'userId query parameter is required' }),
    // Optional: scope logs to a specific family member / client
    patientId: z.string().optional(),
  })
});
