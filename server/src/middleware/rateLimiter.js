import rateLimit from 'express-rate-limit';

// Global limiter (IP-based)
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
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

// AI endpoints limiter (User-based with IP fallback)
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // limit to 30 AI requests per hour
  keyGenerator: (req) => {
    return req.user?.uid || req.ip;
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

// Vision / Heavy AI endpoints limiter (User-based with IP fallback)
// Image processing is more expensive (TPM/RPD)
export const visionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit to 5 vision requests per 15 minutes
  keyGenerator: (req) => {
    return req.user?.uid || req.ip;
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

// Heavy AI endpoints limiter (User-based with IP fallback)
export const heavyAiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // limit to 15 heavy requests per 15 minutes
  keyGenerator: (req) => {
    return req.user?.uid || req.ip;
  },
  message: {
    status: 'fail',
    message: 'Too many requests to heavy AI features. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Per-user token budget guard.
 * Blocks requests that are too large before they hit the AI service.
 */
export const tokenBudgetGuard = (req, res, next) => {
  const body = req.body || {};

  // Strip imageUrl from medicines in the request body to avoid triggering size limits
  if (Array.isArray(body.medicines)) {
    body.medicines = body.medicines.map(med => {
      if (med && typeof med === 'object') {
        const { imageUrl, ...rest } = med;
        return rest;
      }
      return med;
    });
  }

  // Rough token estimate from request body
  const roughEstimate =
    JSON.stringify(body.messages || []).length / 3.7 +
    JSON.stringify(body.medicines || []).length / 3.7 +
    JSON.stringify(body.doseLogs || []).length / 3.7;

  if (roughEstimate > 8000) {
    return res.status(429).json({
      status: 'fail',
      message: 'Request context is too large. Please start a new conversation to clear history.'
    });
  }
  next();
};
