import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// Global limiter (IP-based, tuned for SPA hydration & concurrency)
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600, // limit each IP to 600 requests per windowMs (40 req/min avg)
  message: {
    status: 'fail',
    message: 'Too many requests from this IP, please try again in 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  }
});


// Auth & User sensitive operations limiter
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 mins (stricter for profile updates/auth)
  message: {
    status: 'fail',
    message: 'Too many authentication or profile update attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  }
});

// AI endpoints limiter (User-based with IPv6-safe IP fallback)
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // limit to 30 AI requests per hour
  keyGenerator: (req) => {
    return req.user?.uid || ipKeyGenerator(req);
  },
  message: {
    status: 'fail',
    message: 'AI usage limit reached for this hour. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  }
});

// FDA & RxNorm proxy limiter (User-based with IPv6-safe IP fallback)
export const fdaLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 queries per minute per user/IP
  keyGenerator: (req) => {
    return req.user?.uid || ipKeyGenerator(req);
  },
  message: {
    status: 'fail',
    message: 'FDA query rate limit reached. Please wait a moment before searching again.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  }
});

// Vision / Heavy AI endpoints limiter (User-based with IPv6-safe IP fallback)
// Image processing is more expensive (TPM/RPD)
export const visionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit to 5 vision requests per 15 minutes
  keyGenerator: (req) => {
    return req.user?.uid || ipKeyGenerator(req);
  },
  message: {
    status: 'fail',
    message: 'Vision processing limit reached. Please wait a few minutes before identifying more pills.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  }
});

// Heavy AI endpoints limiter (User-based with IPv6-safe IP fallback)
export const heavyAiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // limit to 15 heavy requests per 15 minutes
  keyGenerator: (req) => {
    return req.user?.uid || ipKeyGenerator(req);
  },
  message: {
    status: 'fail',
    message: 'Too many requests to heavy AI features. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  }
});

/**
 * Per-user payload & token budget guard.
 * Blocks oversized clinical and conversational payloads before they hit external AI services.
 */
export const tokenBudgetGuard = (req, res, next) => {
  const body = req.body || {};

  // Strip imageUrl and heavy binary fields from medicines before estimation
  if (Array.isArray(body.medicines)) {
    body.medicines = body.medicines.map(med => {
      if (med && typeof med === 'object') {
        const { imageUrl, ...rest } = med;
        return rest;
      }
      return med;
    });
  }

  const payloadString = JSON.stringify(body);
  const byteLength = Buffer.byteLength(payloadString, 'utf8');

  // Hard payload cap (64 KB) to avoid prompt injection or resource exhaustion
  if (byteLength > 64 * 1024) {
    return res.status(413).json({
      status: 'fail',
      message: 'Payload exceeds maximum permitted size (64KB).'
    });
  }

  // Comprehensive token estimate across all clinical and conversational arrays
  const roughEstimate =
    JSON.stringify(body.messages || []).length / 3.7 +
    JSON.stringify(body.medicines || []).length / 3.7 +
    JSON.stringify(body.doseLogs || []).length / 3.7 +
    JSON.stringify(body.wellnessLogs || []).length / 3.7 +
    JSON.stringify(body.patients || []).length / 3.7 +
    JSON.stringify(body.reminders || []).length / 3.7;

  if (roughEstimate > 8000) {
    return res.status(429).json({
      status: 'fail',
      message: 'Request context is too large. Please trim history or simplify query.'
    });
  }
  next();
};
