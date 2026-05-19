/**
 * Route model — wraps routes table queries.
 */
const pool = require('../config/db');

const Route = {
  async create({ userId, name, description, points, waypoints, distanceM, elevationGainM }) {
    const [result] = await pool.execute(
      `INSERT INTO routes (user_id, name, description, points, waypoints, distance_m, elevation_gain_m)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        name,
        description ?? null,
        JSON.stringify(points),
        JSON.stringify(waypoints ?? []),
        distanceM ?? 0,
        elevationGainM ?? 0,
      ]
    );
    return result.insertId;
  },

  // List — omits heavy points JSON for performance
  async findByUser(userId) {
    const [rows] = await pool.execute(
      `SELECT id, user_id, name, description, distance_m, elevation_gain_m, run_count, last_run_at, created_at, updated_at
       FROM routes WHERE user_id = ? ORDER BY run_count DESC, created_at DESC`,
      [userId]
    );
    return rows;
  },

  // Detail — includes full points + waypoints
  async findByIdAndUser(id, userId) {
    const [rows] = await pool.execute(
      `SELECT id, user_id, name, description, points, waypoints, distance_m, elevation_gain_m, run_count, last_run_at, created_at, updated_at
       FROM routes WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      ...r,
      points:    r.points    ? JSON.parse(r.points)    : [],
      waypoints: r.waypoints ? JSON.parse(r.waypoints) : [],
    };
  },

  async update(id, userId, { name, description, points, waypoints, distanceM, elevationGainM }) {
    const updates = [];
    const values = [];

    if (name !== undefined)           { updates.push('name = ?');             values.push(name); }
    if (description !== undefined)    { updates.push('description = ?');      values.push(description); }
    if (points !== undefined)         { updates.push('points = ?');           values.push(JSON.stringify(points)); }
    if (waypoints !== undefined)      { updates.push('waypoints = ?');        values.push(JSON.stringify(waypoints)); }
    if (distanceM !== undefined)      { updates.push('distance_m = ?');       values.push(distanceM); }
    if (elevationGainM !== undefined) { updates.push('elevation_gain_m = ?'); values.push(elevationGainM); }

    if (updates.length === 0) return 0;

    updates.push('updated_at = NOW()');
    values.push(id, userId);

    const [result] = await pool.execute(
      `UPDATE routes SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );
    return result.affectedRows;
  },

  async delete(id, userId) {
    const [result] = await pool.execute(
      'DELETE FROM routes WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.affectedRows;
  },

  async incrementRunCount(id, userId) {
    const [result] = await pool.execute(
      'UPDATE routes SET run_count = run_count + 1, last_run_at = NOW() WHERE id = ? AND user_id = ?',
      [id, userId]
    );
    return result.affectedRows;
  },
};

module.exports = Route;
