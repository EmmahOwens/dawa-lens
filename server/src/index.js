import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// db.js initializes firebase admin
import { db } from './db.js';

import medicinesRouter from './routes/medicines.js';
import remindersRouter from './routes/reminders.js';
import doseLogsRouter from './routes/doseLogs.js';
import usersRouter from './routes/users.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // 10mb to allow base64 image uploads

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Pill-Pal API is running 🚀 (Firebase Powered)' });
});

// Mount Routes
app.use('/api/users', usersRouter);
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
