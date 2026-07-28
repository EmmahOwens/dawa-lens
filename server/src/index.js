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
import adminRouter from './routes/admin/index.js';

import errorMiddleware from './middleware/errorMiddleware.js';
import { globalLimiter, aiLimiter, authLimiter, visionLimiter } from './middleware/rateLimiter.js';
import { verifyAdmin } from './middleware/adminMiddleware.js';
import AppError from './utils/AppError.js';
import { initScheduler } from './scheduler.js';

dotenv.config();

// Startup environment status overview — logged for visibility in Render / Cloud deployment logs
console.log('─── Render Environment Status Check ───');
console.log('Firebase Admin:', process.env.FIREBASE_PROJECT_ID ? `✅ Active (Project: ${process.env.FIREBASE_PROJECT_ID})` : '⚠️ Missing FIREBASE_PROJECT_ID');
console.log('Cerebras API:', process.env.CEREBRAS_API_KEY ? '✅ Active (llama-3.3-70b)' : 'ℹ️ Not configured (optional fallback)');
console.log('Groq API:', process.env.GROQ_API_KEY ? '✅ Active (Primary)' : '⚠️ Missing GROQ_API_KEY');
console.log('SambaNova API:', (process.env.SAMBACLOUD_API_KEY || process.env.SAMBANOVA_API_KEY) ? '✅ Active (Meta-Llama-3.3-70B)' : 'ℹ️ Not configured (optional fallback)');
console.log('GitHub Models API:', (process.env.GITHUB_TOKEN || process.env.GITHUB_MODELS_KEY) ? '✅ Active (meta-llama-3.3-70b)' : 'ℹ️ Not configured (optional fallback)');
console.log('OpenRouter Free API:', process.env.OPENROUTER_API_KEY ? '✅ Active (llama-3.3-70b:free)' : 'ℹ️ Not configured (optional fallback)');
console.log('Mistral AI API:', process.env.MISTRAL_API_KEY ? '✅ Active (mistral-small)' : 'ℹ️ Not configured (optional fallback)');
console.log('Z.ai API:', process.env.Z_AI_API_KEY ? '✅ Active (GLM-4.7-Flash fallback)' : 'ℹ️ Not configured (optional fallback)');
console.log('Gemini API:', (process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_2) ? '✅ Active' : '⚠️ Missing GEMINI_API_KEY');
console.log('Cloudflare Vision API:', process.env.CLOUDFLARE_API_KEY ? '✅ Active' : 'ℹ️ Not configured (optional vision provider)');
console.log('────────────────────────────────────────');

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
  'http://localhost:5174',  // admin dev server
  'http://localhost:3000',
  'http://localhost:8080',
  'https://localhost',
  'http://localhost',
  'capacitor://localhost',
  'ionic://localhost',
  'https://dawalens256.vercel.app',
  'https://dawalens.web.app',
  'https://medicine-d3ba2.web.app',
  'https://dawalens-admin.web.app',
];

if (process.env.ALLOWED_ORIGINS) {
  allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(','));
}

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // 10mb to allow base64 image uploads

import { bootstrapClaim } from './routes/admin/users.js';

// API Routes (v1)
const v1Router = express.Router();

v1Router.post('/bootstrap-admin', authLimiter, bootstrapClaim);
v1Router.use('/users', authLimiter, usersRouter);
v1Router.use('/medicines', medicinesRouter);
v1Router.use('/reminders', remindersRouter);
v1Router.use('/doselogs', doseLogsRouter);
v1Router.use('/vision', visionLimiter, visionRouter);
v1Router.use('/ai', aiLimiter, aiRouter);
v1Router.use('/patients', patientsRouter);
v1Router.use('/wellness', wellnessRouter);
v1Router.use('/admin', verifyAdmin, adminRouter);

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
  initScheduler();
});
