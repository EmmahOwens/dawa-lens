import AppError from '../utils/AppError.js';

export const validate = (schema) => (req, res, next) => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (error) {
    // Zod v4 uses error.issues; v3 used error.errors — support both for safety
    const issues = error.issues || error.errors;
    if (issues && Array.isArray(issues)) {
      const message = issues.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
      next(new AppError(message, 400));
    } else {
      next(new AppError(error.message || 'Validation failed', 400));
    }
  }
};
