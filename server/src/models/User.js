import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  privacyMode: { type: Boolean, default: false },
  languagePreference: { type: String, default: 'en' },
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  verificationTokenExpiry: { type: Date },
}, { timestamps: true });

export default mongoose.model('User', userSchema);
