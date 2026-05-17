/**
 * Markers Routes — /api/markers
 *
 * Endpoints:
 * GET    /api/markers          — Get user's markers
 * POST   /api/markers          — Create a marker
 * PUT    /api/markers/:id      — Update a marker (note, permission)
 * DELETE /api/markers/:id      — Delete a marker
 */
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authenticate = require('../middleware/authenticate');

router.use(authenticate);

// ── Get user's markers ──────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [markers] = await pool.execute(
      `SELECT id, type, text, lat, lng, alt, permission, created_at, updated_at
       FROM markers WHERE user_id = ? ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(markers);
  } catch (err) {
    console.error('[markers/get]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Create marker ───────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { type, text, lat, lng, alt, permission } = req.body;

    if (!type || lat == null || lng == null) {
      return res.status(400).json({ error: 'type, lat, lng required' });
    }
    if (text && text.length > 30) {
      return res.status(400).json({ error: 'Text max 30 characters' });
    }

    const validPermissions = ['personal', 'group', 'public'];
    const perm = validPermissions.includes(permission) ? permission : 'personal';

    const [result] = await pool.execute(
      `INSERT INTO markers (user_id, type, text, lat, lng, alt, permission, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [req.user.id, type, text || '', lat, lng, alt || null, perm]
    );

    res.status(201).json({
      id: result.insertId,
      type, text: text || '', lat, lng, alt, permission: perm,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[markers/create]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Update marker ───────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { text, permission } = req.body;
    const markerId = req.params.id;

    // Verify ownership
    const [existing] = await pool.execute(
      'SELECT id FROM markers WHERE id = ? AND user_id = ?',
      [markerId, req.user.id]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Marker not found' });

    const updates = [];
    const values = [];

    if (text !== undefined) {
      if (text.length > 30) return res.status(400).json({ error: 'Text max 30 characters' });
      updates.push('text = ?');
      values.push(text);
    }
    if (permission !== undefined) {
      const validPermissions = ['personal', 'group', 'public'];
      if (!validPermissions.includes(permission)) {
        return res.status(400).json({ error: 'Invalid permission' });
      }
      updates.push('permission = ?');
      values.push(permission);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });

    updates.push('updated_at = NOW()');
    values.push(markerId, req.user.id);

    await pool.execute(
      `UPDATE markers SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );

    res.json({ message: 'Marker updated' });
  } catch (err) {
    console.error('[markers/update]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Delete marker ───────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.execute(
      'DELETE FROM markers WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Marker not found' });
    res.json({ message: 'Marker deleted' });
  } catch (err) {
    console.error('[markers/delete]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
