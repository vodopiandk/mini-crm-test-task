const express = require('express');
const db = require('../db');

const router = express.Router();

const SOURCES = ['bot', 'manual', 'telegram'];
const STATUSES = ['new', 'in_progress', 'done'];
const MAX_FIELD_LENGTH = 500;

function getTagsForLead(leadId) {
  return db
    .prepare(
      `SELECT t.id, t.name FROM tags t
       JOIN lead_tags lt ON lt.tag_id = t.id
       WHERE lt.lead_id = ?
       ORDER BY t.name`
    )
    .all(leadId);
}

function serializeLead(row, tags) {
  return {
    id: row.id,
    name: row.name,
    contact: row.contact,
    request: row.request,
    source: row.source,
    status: row.status,
    tgUserId: row.tg_user_id,
    tgUsername: row.tg_username,
    createdAt: row.created_at,
    tags: tags || [],
  };
}

function validateManualLead(body) {
  const errors = [];
  for (const field of ['name', 'contact', 'request']) {
    const value = body[field];
    if (typeof value !== 'string' || !value.trim()) {
      errors.push(`${field} is required`);
    } else if (value.length > MAX_FIELD_LENGTH) {
      errors.push(`${field} is too long`);
    }
  }
  return errors;
}

// GET /api/leads?tag=ID&source=bot|manual|telegram
router.get('/', (req, res) => {
  const { tag, source } = req.query;
  const where = [];
  const params = [];
  let sql = 'SELECT l.* FROM leads l';

  if (tag) {
    sql += ' JOIN lead_tags lt ON lt.lead_id = l.id';
    where.push('lt.tag_id = ?');
    params.push(tag);
  }
  if (source) {
    if (!SOURCES.includes(source)) {
      return res.status(400).json({ error: 'invalid source' });
    }
    where.push('l.source = ?');
    params.push(source);
  }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY l.created_at DESC, l.id DESC';

  const rows = db.prepare(sql).all(...params);
  const leads = rows.map((row) => serializeLead(row, getTagsForLead(row.id)));
  res.json({ leads });
});

// GET /api/leads/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });

  const tags = getTagsForLead(row.id);
  const messages = db
    .prepare('SELECT id, text, created_at as createdAt FROM messages WHERE lead_id = ? ORDER BY created_at ASC, id ASC')
    .all(row.id);

  res.json({ lead: serializeLead(row, tags), messages });
});

// POST /api/leads — ручное добавление, source = 'manual'
router.post('/', (req, res) => {
  const body = req.body || {};
  const errors = validateManualLead(body);
  if (errors.length) return res.status(400).json({ error: errors.join('; ') });

  const info = db
    .prepare(
      `INSERT INTO leads (name, contact, request, source, status)
       VALUES (?, ?, ?, 'manual', 'new')`
    )
    .run(body.name.trim(), body.contact.trim(), body.request.trim());

  const row = db.prepare('SELECT * FROM leads WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ lead: serializeLead(row, []) });
});

// PATCH /api/leads/:id/status — { status }
router.patch('/:id/status', (req, res) => {
  const { status } = req.body || {};
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: 'invalid status' });
  }
  const result = db.prepare('UPDATE leads SET status = ? WHERE id = ?').run(status, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'not found' });
  res.json({ success: true });
});

// POST /api/leads/:id/tags — { tagId } назначить тег
router.post('/:id/tags', (req, res) => {
  const lead = db.prepare('SELECT id FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'lead not found' });

  const tag = db.prepare('SELECT id FROM tags WHERE id = ?').get(req.body?.tagId);
  if (!tag) return res.status(404).json({ error: 'tag not found' });

  db.prepare('INSERT OR IGNORE INTO lead_tags (lead_id, tag_id) VALUES (?, ?)').run(lead.id, tag.id);
  res.json({ success: true });
});

// DELETE /api/leads/:id/tags/:tagId — снять тег
router.delete('/:id/tags/:tagId', (req, res) => {
  db.prepare('DELETE FROM lead_tags WHERE lead_id = ? AND tag_id = ?').run(req.params.id, req.params.tagId);
  res.json({ success: true });
});

module.exports = router;
