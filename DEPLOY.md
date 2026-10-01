# DEPLOY.md

Деплой на Ubuntu VPS: systemd (процесс всегда поднят и переживает рестарт
сервера) + nginx (reverse proxy) + certbot (HTTPS). Все команды — от
пользователя с `sudo`.

## Требования

- Ubuntu 20.04/22.04/24.04, доступ по SSH с `sudo`
- Домен или поддомен, A-record которого указывает на IP сервера
  (нужен для HTTPS через certbot; без домена — см. раздел «Без домена» внизу)
- Node.js 20+

## 1. Node.js 20+

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # должно быть v20.x или новее
```

## 2. Код на сервере

```bash
sudo mkdir -p /opt/mini-crm
sudo chown "$USER":"$USER" /opt/mini-crm
cd /opt/mini-crm
git clone <ссылка-на-репозиторий> .
npm install
```

## 3. Конфиг

```bash
cp .env.example .env
nano .env
```

Заполнить:
- `PORT=3000` (внутренний порт, nginx будет проксировать на него)
- `ADMIN_PASSWORD=` — пароль входа в CRM (не тот, что использовался для теста)
- `SESSION_SECRET=` — случайная строка, например `openssl rand -hex 32`
- `BOT_TOKEN=` — токен от @BotFather

## 4. systemd — процесс поднимается сам и переживает рестарт сервера

```bash
sudo tee /etc/systemd/system/mini-crm.service > /dev/null <<'EOF'
[Unit]
Description=Mini CRM (web + Telegram bot)
After=network.target

[Service]
Type=simple
User=REPLACE_WITH_YOUR_USER
WorkingDirectory=/opt/mini-crm
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo sed -i "s/REPLACE_WITH_YOUR_USER/$USER/" /etc/systemd/system/mini-crm.service

sudo systemctl daemon-reload
sudo systemctl enable mini-crm
sudo systemctl start mini-crm
sudo systemctl status mini-crm      # должен быть active (running)
```

Логи: `journalctl -u mini-crm -f`

## 5. nginx — reverse proxy

```bash
sudo apt-get install -y nginx

sudo tee /etc/nginx/sites-available/mini-crm > /dev/null <<'EOF'
server {
    listen 80;
    server_name YOUR_DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo sed -i "s/YOUR_DOMAIN/ваш-домен.example/" /etc/nginx/sites-available/mini-crm
sudo ln -s /etc/nginx/sites-available/mini-crm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 6. HTTPS — certbot

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ваш-домен.example
```

Certbot сам ставит systemd-таймер на продление сертификата — ничего
дополнительно делать не нужно.

## 7. Фаервол (если включён ufw)

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
```

## Обновление после изменений в коде

```bash
cd /opt/mini-crm
git pull
npm install          # только если менялись зависимости
sudo systemctl restart mini-crm
```

## Проверка после деплоя

- `https://ваш-домен.example` открывает страницу входа
- `sudo systemctl status mini-crm` — active (running)
- `journalctl -u mini-crm -n 50` — без ошибок
- Бот отвечает в Telegram на `/start`

## Без домена (быстрый путь, без HTTPS)

Если домена пока нет, а ссылку нужно получить немедленно — шаги 5-6 можно
пропустить и открыть порт приложения прямо наружу:

```bash
sudo ufw allow 3000/tcp
```

Ссылка — `http://IP-сервера:3000`. Работает, но без HTTPS: пароль при входе
идёт по сети открытым текстом. Приемлемо для короткой демонстрации
тестового задания, не для продакшена — как только появится домен, лучше
вернуться к шагам 5-6.
