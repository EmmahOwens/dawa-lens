import { authAdmin } from '../db.js';
import AppError from '../utils/AppError.js';

export const protect = async (req, res, next) => {
  try {
    // 1) Getting token and check if it's there
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(
        new AppError('You are not logged in! Please log in to get access.', 401)
      );
    }

    // 2) Verification token
    const decodedToken = await authAdmin.verifyIdToken(token);

    // 3) Check if user still exists (Optional but good practice)
    // For now we just attach the user data to the request
    req.user = decodedToken;
    next();
  } catch (error) {
    return next(new AppError('Invalid token. Please log in again.', 401));
  }
};

/**
 * Middleware to ensure the authenticated user can only access their own data.
 * Assumes 'uid' is passed in either params or body.
 */
export const restrictToOwner = (req, res, next) => {
  const requestedUid = req.params.uid || req.body.uid || req.params.userId || req.query.userId || req.body.userId || req.query.managedBy || req.body.managedBy;
  
  if (!requestedUid) return next(); // Fall through if no UID is present to check

  if (req.user.uid !== requestedUid) {
    return next(
      new AppError('You do not have permission to perform this action', 403)
    );
  }

  next();
};
