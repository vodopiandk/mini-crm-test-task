const db = require('../db');

// Состояние диалога per tg_user_id — хранится в БД, а не в памяти процесса,
// чтобы переживать рестарт сервера (требование ТЗ).

function getSession(tgUserId) {
  const row = db.prepare('SELECT step, draft FROM bot_sessions WHERE tg_user_id = ?').get(tgUserId);
  if (!row) return null;
  return { step: row.step, draft: JSON.parse(row.draft) };
}

function setSession(tgUserId, step, draft) {
  db.prepare(
    `INSERT INTO bot_sessions (tg_user_id, step, draft) VALUES (?, ?, ?)
     ON CONFLICT(tg_user_id) DO UPDATE SET step = excluded.step, draft = excluded.draft`
  ).run(tgUserId, step, JSON.stringify(draft));
}

function clearSession(tgUserId) {
  db.prepare('DELETE FROM bot_sessions WHERE tg_user_id = ?').run(tgUserId);
}

module.exports = { getSession, setSession, clearSession };
