import express from 'express';
import crypto from 'crypto';
import User from '../models/User.js';

const router = express.Router();

// --- Helpers ---

const hashPassword = (pw) => crypto.createHash('sha256').update(pw).digest('hex');

/** Generate a secure random hex token and its 24-hour expiry */
function generateVerificationToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  return { token, expiry };
}

/**
 * Build the verification URL that the user will click.
 * In production, replace APP_URL with your deployed domain.
 */
function buildVerificationUrl(token) {
  const base = process.env.APP_URL || 'http://localhost:8080';
  return `${base}/verify-email?token=${token}`;
}

// --- Routes ---

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const { token, expiry } = generateVerificationToken();

    const user = new User({
      email,
      passwordHash: hashPassword(password),
      verificationToken: token,
      verificationTokenExpiry: expiry,
      isVerified: false,
    });

    await user.save();

    // The verification URL is stored in MongoDB and returned here.
    // In production, you would email this link instead of returning it.
    // You can connect any email provider (Resend, SendGrid, Atlas Triggers)
    // to the verificationUrl without changing this backend logic.
    const verificationUrl = buildVerificationUrl(token);

    res.status(201).json({
      message: 'Registration successful. Please verify your email.',
      email: user.email,
      // NOTE: In production, remove verificationUrl from the response
      // and deliver it only via email. It's included here for development.
      verificationUrl,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/verify/:token
// Called when the user clicks the link in their verification email
router.get('/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpiry: { $gt: new Date() }, // token must not be expired
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token.' });
    }

    // Mark as verified and clear the token from MongoDB
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully! You can now log in.', email: user.email });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ error: 'No account found with that email.' });
    if (user.isVerified) return res.status(400).json({ error: 'This account is already verified.' });

    const { token, expiry } = generateVerificationToken();
    user.verificationToken = token;
    user.verificationTokenExpiry = expiry;
    await user.save();

    const verificationUrl = buildVerificationUrl(token);

    res.json({
      message: 'A new verification link has been generated.',
      verificationUrl,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || user.passwordHash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Block login until email is verified
    if (!user.isVerified) {
      return res.status(403).json({
        error: 'Please verify your email before logging in.',
        needsVerification: true,
        email: user.email,
      });
    }

    res.json({
      _id: user._id,
      email: user.email,
      languagePreference: user.languagePreference,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
