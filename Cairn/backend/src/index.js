/**
 * Cairn Backend — Entry point
 *
 * Start: node src/index.js  (or: npm run dev)
 * Health: GET http://localhost:3001/health
 *
 * Requires MySQL 8+ running with database `cairn` created.
 * See docs/DB_SCHEMA.md for setup instructions.
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pool = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Security middleware ────────────────────────────────────────────────────
app.use(helmet());

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:8082')
  .split(',')
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

// ── Health check ───────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  let dbStatus = 'ok';
  try {
    await pool.execute('SELECT 1');
  } catch (err) {
    dbStatus = `error: ${err.code || err.message || 'unknown'}`;
  }
  const status = dbStatus === 'ok' ? 200 : 503;
  res.status(status).json({
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
    service: 'cairn-backend',
    version: '0.1.0',
    db: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/friends', require('./routes/friends'));
app.use('/api/markers', require('./routes/markers'));

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ message: 'Not found.' });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('[error]', err.message);
  res.status(500).json({ message: 'Internal server error.' });
});

// ── Start ──────────────────────────────────────────────────────────────────
async function start() {
  // Verify DB connection at startup
  try {
    const conn = await pool.getConnection();
    await conn.execute('SELECT 1');
    conn.release();
    console.log('✓ Database connected');
  } catch (err) {
    console.error('\n⚠  Database connection failed:', err.code || err.message);
    console.error('   Run: mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS cairn;"');
    console.error('   Then verify DB_HOST, DB_USER, DB_PASSWORD in .env\n');
    // Start anyway so health check can report the issue
  }

  app.listen(PORT, () => {
    console.log(`✓ Cairn backend running on http://localhost:${PORT}`);
    console.log(`  Health: http://localhost:${PORT}/health`);
  });
}

start();
