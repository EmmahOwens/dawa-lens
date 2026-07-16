import express from 'express';
import { db } from '../db.js';
import { protect } from '../middleware/authMiddleware.js';
import AppError from '../utils/AppError.js';

const router = express.Router();

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

/**
 * POST /api/v1/google/exchange
 * Exchanges a GIS authorization code (+ PKCE verifier) for access + refresh tokens.
 * Stores the refresh token in Firestore; returns only the access token to the client.
 */
router.post('/exchange', protect, async (req, res, next) => {
  try {
    const { code, codeVerifier, redirectUri } = req.body;

    if (!code || !codeVerifier || !redirectUri) {
      return next(new AppError('Missing code, codeVerifier, or redirectUri', 400));
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return next(new AppError('Google OAuth is not configured on this server.', 503));
    }

    // Exchange authorization code for tokens at Google's token endpoint
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
      console.error('[GoogleCalendar] Token exchange failed:', tokenData);
      return next(new AppError(tokenData.error_description || 'Failed to exchange authorization code.', 502));
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    if (!access_token) {
      return next(new AppError('No access token returned from Google.', 502));
    }

    // Store refresh token server-side in Firestore (never expose to client)
    if (refresh_token) {
      const uid = req.user.uid;
      await db.collection('users').doc(uid).set(
        { googleCalendar: { refreshToken: refresh_token, connectedAt: new Date().toISOString() } },
        { merge: true }
      );
    }

    res.json({
      accessToken: access_token,
      expiresIn: expires_in ?? 3600,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/google/refresh
 * Uses the stored refresh token to silently obtain a new access token.
 * Called by the frontend when the stored access token is near expiry.
 */
router.post('/refresh', protect, async (req, res, next) => {
  try {
    const uid = req.user.uid;

    const userDoc = await db.collection('users').doc(uid).get();
    const refreshToken = userDoc.data()?.googleCalendar?.refreshToken;

    if (!refreshToken) {
      return next(new AppError('No Google Calendar connection found. Please reconnect.', 404));
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || tokenData.error) {
      // Refresh token may be revoked — clear it from Firestore
      if (tokenData.error === 'invalid_grant') {
        await db.collection('users').doc(uid).set(
          { googleCalendar: { refreshToken: null } },
          { merge: true }
        );
        return next(new AppError('Google authorization has expired. Please reconnect.', 401));
      }
      console.error('[GoogleCalendar] Token refresh failed:', tokenData);
      return next(new AppError(tokenData.error_description || 'Failed to refresh token.', 502));
    }

    res.json({
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in ?? 3600,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/v1/google/disconnect
 * Revokes the Google token and removes the stored refresh token from Firestore.
 */
router.delete('/disconnect', protect, async (req, res, next) => {
  try {
    const uid = req.user.uid;

    const userDoc = await db.collection('users').doc(uid).get();
    const refreshToken = userDoc.data()?.googleCalendar?.refreshToken;

    // Attempt to revoke the token at Google (best-effort, don't fail if it errors)
    if (refreshToken) {
      try {
        await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(refreshToken)}`, {
          method: 'POST',
        });
      } catch (revokeErr) {
        console.warn('[GoogleCalendar] Token revocation request failed (non-fatal):', revokeErr.message);
      }
    }

    // Remove the stored refresh token from Firestore regardless
    await db.collection('users').doc(uid).set(
      { googleCalendar: { refreshToken: null, connectedAt: null } },
      { merge: true }
    );

    res.json({ success: true, message: 'Google Calendar disconnected.' });
  } catch (err) {
    next(err);
  }
});

export default router;
