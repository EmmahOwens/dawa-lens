import { z } from 'zod';

export const createReminderSchema = z.object({
  body: z.object({
    userId: z.string({ required_error: 'userId is required' }),
    medicineName: z.string({ required_error: 'Medicine name is required' }).max(200),
    dose: z.string({ required_error: 'Dose is required' }).max(100),
    time: z.string({ required_error: 'Time is required' }).max(100),
    repeatSchedule: z.enum(['daily', 'weekly', 'once', 'custom']).optional(),
    repeatDays: z.array(z.number()).optional(),
    patientId: z.string().nullable().optional(),
    patientName: z.string().max(200).nullable().optional(),
    notes: z.string().max(1000).optional(),
    enabled: z.boolean().optional(),
    color: z.string().max(50).optional(),
    icon: z.string().max(50).optional(),
    medicineId: z.string().nullable().optional(),
  })
});

export const updateReminderSchema = z.object({
  params: z.object({
    id: z.string({ required_error: 'Reminder ID is required' }),
  }),
  body: z.object({
    medicineName: z.string().max(200).optional(),
    dose: z.string().max(100).optional(),
    time: z.string().max(100).optional(),
    repeatSchedule: z.enum(['daily', 'weekly', 'once', 'custom']).optional(),
    repeatDays: z.array(z.number()).optional(),
    notes: z.string().max(1000).optional(),
    enabled: z.boolean().optional(),
    color: z.string().max(50).optional(),
    icon: z.string().max(50).optional(),
    medicineId: z.string().nullable().optional(),
    patientId: z.string().nullable().optional(),
    patientName: z.string().max(200).nullable().optional(),
  })
});

export const getRemindersSchema = z.object({
  query: z.object({
    userId: z.string({ required_error: 'userId query parameter is required' }),
    patientId: z.string().optional(),
  })
});
