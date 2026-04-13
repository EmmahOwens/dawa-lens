import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
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

import errorMiddleware from './middleware/errorMiddleware.js';
import { globalLimiter, aiLimiter } from './middleware/rateLimiter.js';
import AppError from './utils/AppError.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security Headers
app.use(helmet());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate Limiting
app.use('/api', globalLimiter);

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

// API Routes (v1)
const v1Router = express.Router();

v1Router.use('/users', usersRouter);
v1Router.use('/medicines', medicinesRouter);
v1Router.use('/reminders', remindersRouter);
v1Router.use('/doselogs', doseLogsRouter);
v1Router.use('/vision', aiLimiter, visionRouter);
v1Router.use('/ai', aiLimiter, aiRouter);
v1Router.use('/patients', patientsRouter);
v1Router.use('/wellness', wellnessRouter);

app.use('/api/v1', v1Router);

// Health Check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Dawa Lens API is running (v1 ready)' });
});

// 404 fallback
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handler
app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
