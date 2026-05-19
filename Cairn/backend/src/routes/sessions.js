/**
 * Session routes:
 *   POST /api/sessions      (authenticated) — save a session
 *   GET  /api/sessions      (authenticated) — list user's sessions
 *   GET  /api/sessions/:id  (authenticated) — get session with route_points + flags
 */
const express = require('express');
const Session = require('../models/Session');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

// ── POST /api/sessions ─────────────────────────────────────────────────────
router.post('/', authenticate, async (req, res) => {
  const { type, start_time, end_time, distance_m, duration_s, route_points, flags, route_id } = req.body;

  if (!type || !['hiking', 'running'].includes(type)) {
    return res.status(400).json({ error: 'type must be "hiking" or "running".' });
  }
  if (!start_time || isNaN(Date.parse(start_time))) {
    return res.status(400).json({ error: 'start_time must be a valid ISO date.' });
  }
  if (!end_time || isNaN(Date.parse(end_time))) {
    return res.status(400).json({ error: 'end_time must be a valid ISO date.' });
  }
  if (distance_m !== undefined && (typeof distance_m !== 'number' || distance_m < 0)) {
    return res.status(400).json({ error: 'distance_m must be a non-negative number.' });
  }

  try {
    const id = await Session.create({
      userId: req.user.userId,
      routeId: route_id ?? null,
      type,
      startTime: new Date(start_time),
      endTime: new Date(end_time),
      distanceM: distance_m ?? 0,
      durationS: duration_s ?? 0,
      routePoints: route_points ?? null,
      flags: flags ?? null,
    });

    const session = await Session.findByIdAndUser(id, req.user.userId);
    return res.status(201).json({ session });
  } catch (err) {
    console.error('[sessions/post]', err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ── GET /api/sessions ──────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const sessions = await Session.findByUser(req.user.userId);
    return res.json({ sessions });
  } catch (err) {
    console.error('[sessions/list]', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// ── GET /api/sessions/:id ──────────────────────────────────────────────────
router.get('/:id', authenticate, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'Invalid session ID.' });
  }
  try {
    const session = await Session.findByIdAndUser(id, req.user.userId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }
    return res.json({ session });
  } catch (err) {
    console.error('[sessions/get]', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// ── DELETE /api/sessions/:id ───────────────────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'Invalid session ID.' });
  }
  try {
    const deleted = await Session.deleteByIdAndUser(id, req.user.userId);
    if (!deleted) {
      return res.status(404).json({ error: 'Session not found.' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[sessions/delete]', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
