CREATE TABLE IF NOT EXISTS objects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    condition TEXT,
    description TEXT,
    coords JSONB NOT NULL,
    date TEXT,
    created_by TEXT
);

CREATE TABLE IF NOT EXISTS issues (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    object_id TEXT,
    object_name TEXT,
    coords JSONB,
    description TEXT NOT NULL,
    problem_type TEXT,
    urgency TEXT,
    created_by TEXT,
    created_by_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'pending',
    response TEXT,
    resolved_by TEXT,
    resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS polls (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);
