
BEGIN;

-- OBJECTS
CREATE TABLE IF NOT EXISTS objects (
  id               BIGSERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  type             TEXT,
  condition        TEXT,
  description      TEXT,
  coords           JSONB NOT NULL,          -- например [lat, lng] или GeoJSON
  date             TIMESTAMPTZ,
  created_by       TEXT,
  created_by_name  TEXT,
  created_by_role  TEXT NOT NULL DEFAULT 'user'
);

-- ISSUES (идеи/проблемы)
CREATE TABLE IF NOT EXISTS issues (
  id               BIGSERIAL PRIMARY KEY,
  type             TEXT,
  object_id        BIGINT REFERENCES objects(id) ON DELETE SET NULL,
  object_name      TEXT,
  coords           JSONB NOT NULL,
  description      TEXT NOT NULL,
  problem_type     TEXT,
  urgency          TEXT,
  created_by       TEXT,
  created_by_name  TEXT,
  created_by_role  TEXT NOT NULL DEFAULT 'user',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status           TEXT NOT NULL DEFAULT 'open',
  response         TEXT,
  resolved_by      TEXT,
  resolved_at      TIMESTAMPTZ
);

-- POLLS (голосования)
CREATE TABLE IF NOT EXISTS polls (
  id               BIGSERIAL PRIMARY KEY,
  question         TEXT NOT NULL,
  options          JSONB NOT NULL,          -- например ["да","нет"] или [{text, votes}]
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       TEXT,
  created_by_name  TEXT,
  created_by_role  TEXT NOT NULL DEFAULT 'user'
);

-- Индексы (ускорят ленту/списки)
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_polls_created_at  ON polls(created_at DESC);

COMMIT;
