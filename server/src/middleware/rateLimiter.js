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
});

// AI endpoints limiter (User-based with IP fallback)
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit to 20 AI requests per hour
  keyGenerator: (req) => {
    return req.user?.uid || req.ip;
  },
  message: {
    status: 'fail',
    message: 'AI usage limit reached for this hour. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
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
