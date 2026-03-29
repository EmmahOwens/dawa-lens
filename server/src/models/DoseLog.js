import mongoose from 'mongoose';

const doseLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reminderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reminder', required: true },
  medicineName: String,
  dose: String,
  scheduledTime: Date,
  actionTime: { type: Date, default: Date.now },
  action: { type: String, enum: ['taken', 'skipped', 'snoozed'], required: true }
});

export default mongoose.model('DoseLog', doseLogSchema);
