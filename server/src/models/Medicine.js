import mongoose from 'mongoose';

const medicineSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  genericName: String,
  dosage: String,
  rxcui: String,
  imageUrl: String,
  notes: String
}, { timestamps: true });

export default mongoose.model('Medicine', medicineSchema);
