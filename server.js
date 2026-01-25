
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

// Для MVP — разрешаем всем (потом сузим до домена фронта)
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));

/* =========================
   DATABASE (STRICT)
========================= */

function safeDbInfoFromUrl(urlStr) {
  if (!urlStr) return { ok: false, error: 'DATABASE_URL missing' };

  let u;
  try {
    u = new URL(urlStr);
  } catch (e) {
    return { ok: false, error: 'DATABASE_URL invalid' };
  }

  // pathname обычно вида "/dbname"
  const dbName = (u.pathname || '').replace(/^\//, '');

  return {
    ok: true,
    protocol: u.protocol,
    host: u.hostname,
    port: u.port ? Number(u.port) : 5432,
    user: decodeURIComponent(u.username || ''),
    password: decodeURIComponent(u.password || ''),
    database: dbName
  };
}

const dbInfo = safeDbInfoFromUrl(DATABASE_URL);

// Печатаем то, что реально видит рантайм (без пароля)
if (dbInfo.ok) {
  console.log('DB_PROTOCOL:', dbInfo.protocol);
  console.log('DB_HOST:', dbInfo.host);
  console.log('DB_PORT:', dbInfo.port);
  console.log('DB_NAME:', '/' + dbInfo.database);
} else {
  console.log('DB_ERROR:', dbInfo.error);
}

let pool = null;

if (dbInfo.ok) {
  pool = new Pool({
    host: dbInfo.host,
    port: dbInfo.port,
    user: dbInfo.user,
    password: dbInfo.password,
    database: dbInfo.database,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  pool.on('connect', () => console.log('✅ PostgreSQL connected'));
  pool.on('error', (err) => console.error('❌ PostgreSQL pool error:', err.message));
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
   DEBUG (NO SECRETS)
========================= */

app.get('/api/debug-db', (req, res) => {
  if (!dbInfo.ok) return res.status(500).json({ ok: false, error: dbInfo.error });

  // Без паролей
  return res.json({
    ok: true,
    host: dbInfo.host,
    port: dbInfo.port,
    database: dbInfo.database,
    nodeEnv: process.env.NODE_ENV || null,
    hasPgHostEnv: !!process.env.PGHOST,
    pgHostEnv: process.env.PGHOST || null
  });
});

/* =========================
   HEALTH
========================= */

app.get('/api/health', async (req, res) => {
  if (!requireDB(res)) return;

  // ВАЖНО: выводим, куда будет подключаться прямо на запрос
  console.log('[/api/health] db host:', dbInfo.ok ? dbInfo.host : 'NO_DBINFO', 'PGHOST env:', process.env.PGHOST || '(none)');

  try {
    await pool.query('SELECT 1');
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
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

    return res.json({
      objects: objects.rows,
      issues: issues.rows,
      polls: polls.rows
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/* =========================
   CREATE OBJECT (specialist/admin)
========================= */

app.post('/api/objects', async (req, res) => {
  if (!requireDB(res)) return;

  const { name, type, condition, description, coords, createdByName, roleCode } = req.body;

  if (!createdByName || String(createdByName).trim().length < 2) {
    return res.status(400).json({ error: 'createdByName required (min 2 chars)' });
  }
  if (!name || !coords) {
    return res.status(400).json({ error: 'name and coords required' });
  }

  const role = resolveRole(roleCode);

  if (role === 'user') {
    return res.status(403).json({ error: 'Only specialist or admin can add objects' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO objects
       (name, type, condition, description, coords, created_by_name, created_by_role)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [name, type ?? null, condition ?? null, description ?? null, coords, String(createdByName).trim(), role]
    );
    return res.status(201).json(rows[0]);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/* =========================
   CREATE ISSUE (any role)
========================= */

app.post('/api/issues', async (req, res) => {
  if (!requireDB(res)) return;

  const { description, coords, createdByName, roleCode, urgency, problemType } = req.body;

  if (!createdByName || String(createdByName).trim().length < 2) {
    return res.status(400).json({ error: 'createdByName required (min 2 chars)' });
  }
  if (!description || !coords) {
    return res.status(400).json({ error: 'description and coords required' });
  }

  const role = resolveRole(roleCode);

  try {
    const { rows } = await pool.query(
      `INSERT INTO issues
       (description, coords, urgency, problem_type, created_by_name, created_by_role)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [description, coords, urgency ?? null, problemType ?? null, String(createdByName).trim(), role]
    );
    return res.status(201).json(rows[0]);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/* =========================
   CREATE POLL (admin only)
========================= */

app.post('/api/polls', async (req, res) => {
  if (!requireDB(res)) return;

  const { question, options, createdByName, roleCode } = req.body;

  if (!createdByName || String(createdByName).trim().length < 2) {
    return res.status(400).json({ error: 'createdByName required (min 2 chars)' });
  }
  if (!question || !options) {
    return res.status(400).json({ error: 'question and options required' });
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
      [question, options, String(createdByName).trim(), role]
    );
    return res.status(201).json(rows[0]);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/* =========================
   STATIC (optional)
========================= */

app.use(express.static(path.join(__dirname)));

/* =========================
   START
========================= */

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
