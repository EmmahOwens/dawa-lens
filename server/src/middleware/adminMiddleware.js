import { authAdmin } from '../db.js';
import AppError from '../utils/AppError.js';

/**
 * Admin middleware — must be used AFTER the regular `protect` middleware.
 * Checks that the decoded Firebase token has the `admin: true` custom claim.
 * All /api/v1/admin/* routes run through this. No exceptions.
 */
export const verifyAdmin = async (req, res, next) => {
  try {
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('Authentication required.', 401));
    }

    const decodedToken = await authAdmin.verifyIdToken(token);

    if (!decodedToken.admin) {
      return next(new AppError('Admin access required. You do not have permission to access this resource.', 403));
    }

    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('[AdminMiddleware] Token verification failed:', error?.message);
    return next(new AppError('Invalid or expired token. Please sign in again.', 401));
  }
};
