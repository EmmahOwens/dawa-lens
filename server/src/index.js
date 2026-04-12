import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// db.js initializes firebase admin
import { db } from './db.js';

import medicinesRouter from './routes/medicines.js';
import remindersRouter from './routes/reminders.js';
import doseLogsRouter from './routes/doseLogs.js';
import usersRouter from './routes/users.js';
import visionRouter from './routes/vision.js';
import aiRouter from './routes/ai.js';
import patientsRouter from './routes/patients.js';
import wellnessRouter from './routes/wellness.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://dawalens256.vercel.app',
  'https://dawalens.web.app',
  'https://medicine-d3ba2.web.app'
];

if (process.env.ALLOWED_ORIGINS) {
  allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(','));
}

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // 10mb to allow base64 image uploads

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Dawa Lens API is running 🚀 (Firebase Powered)' });
});

// Mount Routes
app.use('/api/users', usersRouter);
app.use('/api/medicines', medicinesRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/doselogs', doseLogsRouter);
app.use('/api/vision', visionRouter);
app.use('/api/ai', aiRouter);
app.use('/api/patients', patientsRouter);
app.use('/api/wellness', wellnessRouter);

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found` });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
