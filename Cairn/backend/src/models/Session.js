/**
 * Session model — wraps sessions table queries.
 */
const pool = require('../config/db');

/**
 * mysql2 returns JSON columns as JS arrays/objects on modern MySQL+driver
 * combos (the JSON type is auto-parsed). Older driver versions returned
 * strings. Both are still legal — code that reads route_points/flags
 * needs to handle either. This helper normalises to a JS value.
 */
function parseJsonCol(v) {
  if (v == null) return null;
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return null; }
  }
  // Already parsed by the driver — return as-is.
  return v;
}

const Session = {
  async create({ userId, routeId, type, startTime, endTime, distanceM, durationS, routePoints, flags, name }) {
    const [result] = await pool.execute(
      `INSERT INTO sessions (user_id, route_id, type, start_time, end_time, distance_m, duration_s, name, route_points, flags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, routeId ?? null, type, startTime, endTime,
        distanceM ?? 0, durationS ?? 0,
        name ?? null,
        routePoints ? JSON.stringify(routePoints) : null,
        flags ? JSON.stringify(flags) : null,
      ]
    );
    return result.insertId;
  },

  async findByUser(userId) {
    const [rows] = await pool.execute(
      `SELECT id, user_id, route_id, type, start_time, end_time, distance_m, duration_s, name, created_at
       FROM sessions WHERE user_id = ? ORDER BY start_time DESC`,
      [userId]
    );
    return rows;
  },

  async deleteByIdAndUser(id, userId) {
    const [result] = await pool.execute(
      `DELETE FROM sessions WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    return result.affectedRows > 0;
  },

  async findByIdAndUser(id, userId) {
    const [rows] = await pool.execute(
      `SELECT id, user_id, route_id, type, start_time, end_time, distance_m, duration_s, name, route_points, flags, created_at
       FROM sessions WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    if (!rows[0]) return null;
    const s = rows[0];
    return {
      ...s,
      route_points: parseJsonCol(s.route_points) ?? [],
      flags: parseJsonCol(s.flags) ?? [],
    };
  },

  /**
   * Create an empty session row at the start of tracking. Returns the
   * insert id so the client can use it for incremental append + final
   * finalize calls.
   *
   * end_time is set equal to start_time as a placeholder; finalize()
   * will overwrite it with the real end time. Without this placeholder
   * the NOT NULL constraint on end_time would reject the insert.
   */
  async createEmpty({ userId, type, startTime }) {
    const [result] = await pool.execute(
      `INSERT INTO sessions (user_id, type, start_time, end_time, distance_m, duration_s, route_points, flags)
       VALUES (?, ?, ?, ?, 0, 0, JSON_ARRAY(), NULL)`,
      [userId, type, startTime, startTime]
    );
    return result.insertId;
  },

  /**
   * Append a batch of GPS points to a session's route_points JSON array.
   * Used by the incremental backup flow during an active session.
   *
   * Implementation: read-merge-write (MySQL has no native JSON_ARRAY_APPEND
   * with multi-element batch in older versions). We use JSON_ARRAY_INSERT
   * via a server-side merge for safety: read existing, concat, write back.
   */
  async appendPoints(id, userId, points) {
    if (!Array.isArray(points) || points.length === 0) return false;
    const [rows] = await pool.execute(
      `SELECT route_points FROM sessions WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    if (!rows[0]) return false;
    const existing = parseJsonCol(rows[0].route_points) ?? [];
    const merged = Array.isArray(existing) ? existing.concat(points) : points.slice();
    await pool.execute(
      `UPDATE sessions SET route_points = ? WHERE id = ? AND user_id = ?`,
      [JSON.stringify(merged), id, userId]
    );
    return true;
  },

  /**
   * Finalize a session at stop time: overwrite end_time, distance_m,
   * duration_s, and (optionally) name. Called from stopTracking after
   * the final point flush.
   */
  async finalize(id, userId, { endTime, distanceM, durationS, name }) {
    const fields = [];
    const values = [];
    if (endTime != null) { fields.push('end_time = ?'); values.push(endTime); }
    if (distanceM != null) { fields.push('distance_m = ?'); values.push(distanceM); }
    if (durationS != null) { fields.push('duration_s = ?'); values.push(durationS); }
    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (fields.length === 0) return false;
    values.push(id, userId);
    const [result] = await pool.execute(
      `UPDATE sessions SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`,
      values
    );
    return result.affectedRows > 0;
  },
};

module.exports = Session;
