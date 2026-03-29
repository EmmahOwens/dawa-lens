import express from 'express';
import crypto from 'crypto';
import User from '../models/User.js';

const router = express.Router();

// Simple hash helper (use bcrypt in production)
const hashPassword = (pw) => crypto.createHash('sha256').update(pw).digest('hex');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const user = new User({ email, passwordHash: hashPassword(password) });
    const saved = await user.save();
    res.status(201).json({ _id: saved._id, email: saved.email });
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
    // Return the user ID — in production, return a JWT here
    res.json({ _id: user._id, email: user.email, languagePreference: user.languagePreference });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
