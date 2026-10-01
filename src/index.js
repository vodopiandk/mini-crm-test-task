require('dotenv').config();

const path = require('node:path');
const express = require('express');
const cookieSession = require('cookie-session');

require('./db'); // открывает БД и прогоняет migrate.sql при старте

const { checkPassword, requireAuth } = require('./auth');
const leadsRouter = require('./routes/leads');
const tagsRouter = require('./routes/tags');
const { createBot } = require('./bot/bot');

const app = express();

app.use(express.json());
app.use(
  cookieSession({
    name: 'session',
    secret: process.env.SESSION_SECRET,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
  })
);

app.post('/api/login', (req, res) => {
  if (checkPassword(req.body?.password)) {
    req.session.authenticated = true;
    return res.json({ success: true });
  }
  res.status(401).json({ error: 'invalid password' });
});

app.post('/api/logout', (req, res) => {
  req.session = null;
  res.json({ success: true });
});

app.get('/api/session', (req, res) => {
  res.json({ authenticated: Boolean(req.session && req.session.authenticated) });
});

app.use('/api/leads', requireAuth, leadsRouter);
app.use('/api/tags', requireAuth, tagsRouter);

app.use(express.static(path.join(__dirname, '..', 'public')));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

if (process.env.BOT_TOKEN) {
  const bot = createBot(process.env.BOT_TOKEN);
  bot.start().catch((err) => {
    console.error('Bot failed to start:', err);
  });
  console.log('Telegram bot started (long polling)');
} else {
  console.warn('BOT_TOKEN not set in .env — Telegram bot not started, web CRM still works');
}
