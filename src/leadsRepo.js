const db = require('./db');

// Общий лимит длины полей — используется и REST API (ручное добавление),
// и ботом (валидация шагов диалога), чтобы не разъезжались два места.
const MAX_FIELD_LENGTH = 500;

function createLead({ name, contact, request, source, tgUserId = null, tgUsername = null }) {
  const info = db
    .prepare(
      `INSERT INTO leads (name, contact, request, source, status, tg_user_id, tg_username)
       VALUES (?, ?, ?, ?, 'new', ?, ?)`
    )
    .run(name, contact, request, source, tgUserId, tgUsername);

  return db.prepare('SELECT * FROM leads WHERE id = ?').get(info.lastInsertRowid);
}

module.exports = { createLead, MAX_FIELD_LENGTH };
