import { z } from 'zod';

export const createReminderSchema = z.object({
  body: z.object({
    userId: z.string({ required_error: 'userId is required' }),
    medicineName: z.string({ required_error: 'Medicine name is required' }),
    dose: z.string({ required_error: 'Dose is required' }),
    time: z.string({ required_error: 'Time is required' }),
    repeatSchedule: z.enum(['daily', 'weekly', 'once', 'custom']).optional(),
    repeatDays: z.array(z.number()).optional(),
    patientId: z.string().nullable().optional(),
    patientName: z.string().nullable().optional(),
    notes: z.string().optional(),
    enabled: z.boolean().optional(),
    color: z.string().optional(),
    icon: z.string().optional(),
    medicineId: z.string().nullable().optional(),
  })
});

export const updateReminderSchema = z.object({
  params: z.object({
    id: z.string({ required_error: 'Reminder ID is required' }),
  }),
  body: z.object({
    medicineName: z.string().optional(),
    dose: z.string().optional(),
    time: z.string().optional(),
    repeatSchedule: z.enum(['daily', 'weekly', 'once', 'custom']).optional(),
    repeatDays: z.array(z.number()).optional(),
    notes: z.string().optional(),
    enabled: z.boolean().optional(),
    color: z.string().optional(),
    icon: z.string().optional(),
    medicineId: z.string().nullable().optional(),
    patientId: z.string().nullable().optional(),
    patientName: z.string().nullable().optional(),
  })
});

export const getRemindersSchema = z.object({
  query: z.object({
    userId: z.string({ required_error: 'userId query parameter is required' }),
    patientId: z.string().optional(),
  })
});
