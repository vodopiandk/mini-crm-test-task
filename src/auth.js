const crypto = require('node:crypto');

// Сравнение с ADMIN_PASSWORD через timingSafeEqual — защита от тайминг-атаки
// без лишних зависимостей (bcrypt не нужен: хранимого пользователя/хэша нет,
// пароль один общий секрет из .env). См. DECISIONS.md.
function checkPassword(input) {
  const expected = Buffer.from(String(process.env.ADMIN_PASSWORD || ''));
  const actual = Buffer.from(String(input || ''));

  if (expected.length === 0) return false;
  if (actual.length !== expected.length) {
    crypto.timingSafeEqual(expected, expected); // одинаковая по времени ветка
    return false;
  }
  return crypto.timingSafeEqual(actual, expected);
}

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.status(401).json({ error: 'unauthorized' });
}

module.exports = { checkPassword, requireAuth };
