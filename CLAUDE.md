# CLAUDE.md

Мини-CRM для заявок агентства — тестовое задание, MVP за 3 дня. Оценивается
работающая ссылка и ход мысли, не объём кода или дизайн.

## Стек

Node.js 20+, Express, better-sqlite3, grammY (Telegram-бот, long polling).
Фронт — один статический HTML + vanilla JS + fetch к REST API, без сборки.
Один процесс: веб-сервер и бот стартуют вместе из `src/index.js`.

## Команды

```bash
npm install
cp .env.example .env   # заполнить ADMIN_PASSWORD, SESSION_SECRET, BOT_TOKEN
npm start               # node src/index.js
npm run dev              # то же самое с --watch
```

## Конфиг (`.env`, не в репозитории)

| Переменная | Описание |
|---|---|
| `PORT` | порт веб-сервера (default 3000) |
| `ADMIN_PASSWORD` | единственный пароль входа в CRM |
| `SESSION_SECRET` | секрет для подписи cookie-сессии |
| `BOT_TOKEN` | токен Telegram-бота |

## Структура

```
src/
  index.js        # entrypoint: Express + бот вместе, один процесс
  db.js            # better-sqlite3 коннект, прогоняет migrate.sql при старте
  migrate.sql       # схема: leads, tags, lead_tags, messages, bot_sessions
  auth.js            # проверка пароля, requireAuth middleware
  leadsRepo.js        # создание лида — общее для API и бота
  routes/
    leads.js            # REST: список/создание лидов, статус, теги лида
    tags.js               # REST: список/создание тегов
  bot/
    bot.js                 # сценарий сбора заявки: /start → имя → контакт →
                            # запрос → подтверждение; long polling (grammY)
    session.js               # bot_sessions — диалог переживает рестарт
    business.js                 # Telegram Business, этап 2 (шаг 6)
public/
  login.html        # страница входа
  index.html          # список лидов, фильтры, карточка лида, форма добавления
  app.js               # вся логика фронта (vanilla JS, без сборки)
  style.css             # стили
```

## Данные

SQLite-файл в `data/db.sqlite` (не в репозитории). Схема — `src/migrate.sql`,
выполняется целиком при каждом старте (`CREATE TABLE IF NOT EXISTS`).

## Статус

Готово: БД + REST API, веб-интерфейс, Telegram-бот (сбор заявки,
создаёт лида с `source=bot`, диалог переживает рестарт). Дальше — теги и
фильтры доведены (уже готовы с шага 1-2) → деплой (шаг 5) → Telegram
Business (шаг 6, этап 2 по ТЗ).
Подробности развилок — `DECISIONS.md`. Финальное описание — `README.md`
(пишется в конце).
