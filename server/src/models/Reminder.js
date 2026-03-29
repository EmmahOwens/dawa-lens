import mongoose from 'mongoose';

const reminderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' },
  medicineName: { type: String, required: true },
  dose: String,
  time: String,
  repeatSchedule: { type: String, enum: ['daily', 'weekly', 'custom', 'once'], default: 'daily' },
  repeatDays: [Number],
  notes: String,
  enabled: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('Reminder', reminderSchema);
