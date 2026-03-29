import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

import medicinesRouter from './routes/medicines.js';
import remindersRouter from './routes/reminders.js';
import doseLogsRouter from './routes/doseLogs.js';
import authRouter from './routes/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // 10mb to allow base64 image uploads

// MongoDB Connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

connectDB();

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Pill-Pal API is running 🚀' });
});

// Mount Routes
app.use('/api/auth', authRouter);
app.use('/api/medicines', medicinesRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/doselogs', doseLogsRouter);

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found` });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
