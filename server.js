const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.warn('⚠️ DATABASE_URL не задан. API будет недоступен.');
}

const pool = DATABASE_URL
    ? new Pool({ connectionString: DATABASE_URL })
    : null;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/api/health', async (req, res) => {
    if (!pool) {
        return res.status(503).json({ ok: false, message: 'DATABASE_URL не задан' });
    }
    try {
        await pool.query('SELECT 1');
        return res.json({ ok: true });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
});

app.get('/api/data', async (req, res) => {
    if (!pool) {
        return res.status(503).json({ message: 'DATABASE_URL не задан' });
    }
    try {
        const [objects, issues, polls] = await Promise.all([
            pool.query('SELECT * FROM objects ORDER BY id'),
            pool.query('SELECT * FROM issues ORDER BY created_at DESC'),
            pool.query('SELECT * FROM polls ORDER BY created_at DESC')
        ]);

        return res.json({
            objects: objects.rows.map(row => ({
                id: row.id,
                name: row.name,
                type: row.type,
                condition: row.condition,
                description: row.description,
                coords: row.coords,
                date: row.date,
                createdBy: row.created_by
            })),
            issues: issues.rows.map(row => ({
                id: row.id,
                type: row.type,
                objectId: row.object_id,
                objectName: row.object_name,
                coords: row.coords,
                description: row.description,
                problemType: row.problem_type,
                urgency: row.urgency,
                createdBy: row.created_by,
                createdByName: row.created_by_name,
                createdAt: row.created_at,
                status: row.status,
                response: row.response,
                resolvedBy: row.resolved_by,
                resolvedAt: row.resolved_at
            })),
            polls: polls.rows.map(row => ({
                id: row.id,
                question: row.question,
                options: row.options,
                createdAt: row.created_at,
                createdBy: row.created_by
            }))
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
});
