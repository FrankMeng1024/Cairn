/**
 * Session model — wraps sessions table queries.
 */
const pool = require('../config/db');

const Session = {
  async create({ userId, routeId, type, startTime, endTime, distanceM, durationS, routePoints, flags }) {
    const [result] = await pool.execute(
      `INSERT INTO sessions (user_id, route_id, type, start_time, end_time, distance_m, duration_s, route_points, flags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, routeId ?? null, type, startTime, endTime,
        distanceM ?? 0, durationS ?? 0,
        routePoints ? JSON.stringify(routePoints) : null,
        flags ? JSON.stringify(flags) : null,
      ]
    );
    return result.insertId;
  },

  async findByUser(userId) {
    const [rows] = await pool.execute(
      `SELECT id, user_id, route_id, type, start_time, end_time, distance_m, duration_s, created_at
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
      `SELECT id, user_id, route_id, type, start_time, end_time, distance_m, duration_s, route_points, flags, created_at
       FROM sessions WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    if (!rows[0]) return null;
    const s = rows[0];
    return {
      ...s,
      route_points: s.route_points ? JSON.parse(s.route_points) : [],
      flags: s.flags ? JSON.parse(s.flags) : [],
    };
  },
};

module.exports = Session;
