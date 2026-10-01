const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');

// DATA_DIR — для деплоя на платформы с монтируемым диском (например, Railway
// volume), где путь к постоянному хранилищу не совпадает с путём кода.
// Без переменной — как раньше, рядом с проектом.
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'db.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const migration = fs.readFileSync(path.join(__dirname, 'migrate.sql'), 'utf8');
db.exec(migration);

module.exports = db;
