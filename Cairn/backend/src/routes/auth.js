/**
 * Auth routes:
 *   POST /api/auth/register
 *   POST /api/auth/login
 *   GET  /api/auth/me  (protected)
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { signToken } = require('../config/jwt');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

// Rate limit: max 10 auth attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please wait 15 minutes.' },
});

// ── POST /api/auth/register ────────────────────────────────────────────────
router.post('/register', authLimiter, async (req, res) => {
  const { name, email, password } = req.body;

  // Basic validation
  if (!name || typeof name !== 'string' || name.trim().length < 1) {
    return res.status(400).json({ error: 'Name is required.' });
  }
  if (name.trim().length > 50) {
    return res.status(400).json({ error: 'Name must be 50 characters or fewer.' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const existing = await User.findByEmail(email.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const hash = await User.hashPassword(password);
    const id = await User.createUser(name.trim(), email.toLowerCase(), hash);
    const user = { id: String(id), name: name.trim(), email: email.toLowerCase() };
    const token = signToken({ userId: user.id, email: user.email });

    return res.status(201).json({ user, token });
  } catch (err) {
    console.error('[register]', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/login ───────────────────────────────────────────────────
router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const user = await User.findByEmail(email.toLowerCase());
    if (!user) {
      // Consistent timing to prevent user enumeration
      await User.comparePassword(password, '$2a$12$invalid_hash_to_waste_time_only');
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    const match = await User.comparePassword(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    const publicUser = User.toPublic(user);
    const token = signToken({ userId: publicUser.id, email: publicUser.email });

    return res.json({ user: publicUser, token });
  } catch (err) {
    console.error('[login]', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ── GET /api/auth/me ───────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'Account not found.' });
    }
    return res.json({ user: User.toPublic(user) });
  } catch (err) {
    console.error('[me]', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
