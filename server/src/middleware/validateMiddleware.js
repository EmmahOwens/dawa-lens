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
    const message = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ');
    next(new AppError(message, 400));
  }
};
