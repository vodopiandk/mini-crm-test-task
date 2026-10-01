const express = require('express');
const db = require('../db');

const router = express.Router();
const MAX_NAME_LENGTH = 50;

// GET /api/tags
router.get('/', (req, res) => {
  const tags = db.prepare('SELECT id, name FROM tags ORDER BY name').all();
  res.json({ tags });
});

// POST /api/tags — { name }
router.post('/', (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (name.length > MAX_NAME_LENGTH) return res.status(400).json({ error: 'name is too long' });

  try {
    const info = db.prepare('INSERT INTO tags (name) VALUES (?)').run(name);
    res.status(201).json({ tag: { id: info.lastInsertRowid, name } });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({ error: 'tag already exists' });
    }
    throw err;
  }
});

module.exports = router;
