/**
 * server.js — PROD MVP
 * Express + PostgreSQL (Render)
 */

require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

/* =========================
   CONFIG
========================= */

const PORT = process.env.PORT || 10000;
const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_CODE = process.env.ADMIN_CODE || 'admin-admin';
const SPECIALIST_CODE = process.env.SPECIALIST_CODE || 'specialist-specialist';

/* =========================
   MIDDLEWARE
========================= */

app.use(express.json());

// CORS — если фронт на GitHub Pages или другом домене
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

/* =========================
   DATABASE
========================= */

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL не задан');
}

let pool = null;

// Диагностика DATABASE_URL (БЕЗ паролей)
try {
  const u = new URL(DATABASE_URL);
  console.log('DB_PROTOCOL:', u.protocol);
  console.log('DB_HOST:', u.hostname);
  console.log('DB_PORT:', u.port || '(default)');
  console.log('DB_NAME:', u.pathname);
} catch (e) {
  console.error('❌ DATABASE_URL некорректный');
}

// Инициализация пула
if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false
  });

  pool.on('connect', () => {
    console.log('✅ PostgreSQL connected');
  });

  pool.on('error', (err) => {
    console.error('❌ PostgreSQL error:', err.message);
  });
}

/* =========================
   HELPERS
========================= */

function resolveRole(code) {
  if (code === ADMIN_CODE) return 'admin';
  if (code === SPECIALIST_CODE) return 'specialist';
  return 'user';
}

function requireDB(res) {
  if (!pool) {
    res.status(503).json({ ok: false, error: 'DATABASE_URL not configured' });
    return false;
  }
  return true;
}

/* =========================
   HEALTH
========================= */

app.get('/api/health', async (req, res) => {
  if (!requireDB(res)) return;
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* =========================
   GET DATA
========================= */

app.get('/api/data', async (req, res) => {
  if (!requireDB(res)) return;

  try {
    const [objects, issues, polls] = await Promise.all([
      pool.query('SELECT * FROM objects ORDER BY id'),
      pool.query('SELECT * FROM issues ORDER BY created_at DESC'),
      pool.query('SELECT * FROM polls ORDER BY created_at DESC')
    ]);

    res.json({
      objects: objects.rows,
      issues: issues.rows,
      polls: polls.rows
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================
   CREATE OBJECT
========================= */

app.post('/api/objects', async (req, res) => {
  if (!requireDB(res)) return;

  const { name, type, condition, description, coords, createdByName, roleCode } = req.body;

  if (!name || !coords || !createdByName) {
    return res.status(400).json({ error: 'name, coords, createdByName required' });
  }

  const role = resolveRole(roleCode);

  // Только specialist/admin
  if (role === 'user') {
    return res.status(403).json({ error: 'Only specialist or admin can add objects' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO objects
       (name, type, condition, description, coords, created_by_name, created_by_role)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [name, type, condition, description, coords, createdByName, role]
    );

    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================
   CREATE ISSUE
========================= */

app.post('/api/issues', async (req, res) => {
  if (!requireDB(res)) return;

  const {
    description,
    coords,
    createdByName,
    roleCode,
    urgency,
    problemType
  } = req.body;

  if (!description || !coords || !createdByName) {
    return res.status(400).json({ error: 'description, coords, createdByName required' });
  }

  const role = resolveRole(roleCode);

  try {
    const { rows } = await pool.query(
      `INSERT INTO issues
       (description, coords, urgency, problem_type, created_by_name, created_by_role)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [description, coords, urgency, problemType, createdByName, role]
    );

    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================
   CREATE POLL (ADMIN ONLY)
========================= */

app.post('/api/polls', async (req, res) => {
  if (!requireDB(res)) return;

  const { question, options, createdByName, roleCode } = req.body;

  if (!question || !options || !createdByName) {
    return res.status(400).json({ error: 'question, options, createdByName required' });
  }

  const role = resolveRole(roleCode);

  if (role !== 'admin') {
    return res.status(403).json({ error: 'Only admin can create polls' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO polls
       (question, options, created_by_name, created_by_role)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [question, options, createdByName, role]
    );

    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* =========================
   STATIC (OPTIONAL)
========================= */

app.use(express.static(path.join(__dirname)));

/* =========================
   START
========================= */

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
