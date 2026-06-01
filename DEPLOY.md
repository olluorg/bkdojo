# Деплой bkdojo

На сервере/локально приложение — это **один Bun-процесс** (`server/prod.ts`),
который раздаёт собранный фронтенд (`dist/`). Своего бэкенда у bkdojo больше нет:
серверная AI-оценка идёт через LLM-прокси micro-platform (`/functions/llm`), а
ключ OpenRouter каждый пользователь вводит сам в настройках приложения. Запустить
можно через Docker (рекомендуется) или вручную.

---

## Вариант 1. Docker Compose (локально и на VPS)

Нужен только Docker. Поведение настраивается через `.env`.

```bash
cp .env.example .env          # при желании задай VITE_EVAL_ENDPOINT (URL прокси)
docker compose up -d --build  # собрать и запустить
# открыть http://localhost:3000
```

Как устроены переменные:
- `VITE_EVAL_ENDPOINT` — **build-time** (вшивается в бандл, задан как build-arg в
  `docker-compose.yml`). Это URL LLM-прокси micro-platform, напр.
  `https://api.ollu.example/functions/llm`. Пусто = серверная оценка выключена.
  Поменял — пересобери: `docker compose up -d --build`.
- Секретов на сервере bkdojo больше нет: ключ OpenRouter пользователь вводит в
  настройках приложения, он шлётся в прокси заголовком `X-Provider-Key` и хранится
  только в его браузере.

Полезное:
```bash
docker compose logs -f        # логи
docker compose down           # остановить
```

### HTTPS на VPS через Docker
Добавь рядом сервис Caddy (авто-TLS) в `docker-compose.yml`:
```yaml
  caddy:
    image: caddy:2
    ports: ['80:80', '443:443']
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    restart: unless-stopped
volumes:
  caddy_data:
```
И `Caddyfile`:
```
your.domain.com {
    reverse_proxy bkdojo:3000
}
```
(в этом случае убери `ports` у сервиса `bkdojo` — наружу смотрит только Caddy).

---

## Вариант 2. Вручную (Bun + systemd + reverse-proxy)

### 0. Что понадобится
- VPS (Ubuntu/Debian), SSH-доступ.
- Домен, указывающий A-записью на IP VPS (для HTTPS).
- Развёрнутый LLM-прокси micro-platform (`/functions/llm`) — нужен только если
  хочешь серверную AI-оценку открытых ответов. Ключ OpenRouter вводит сам
  пользователь в настройках приложения, на сервере bkdojo он не хранится.

## 1. Установить Bun на VPS
```bash
curl -fsSL https://bun.sh/install | bash
exec $SHELL            # перезагрузить shell
which bun              # запомни путь, напр. /root/.bun/bin/bun
```

## 2. Забрать код и зависимости
```bash
sudo mkdir -p /opt/bkdojo && sudo chown "$USER" /opt/bkdojo
git clone <repo-url> /opt/bkdojo      # или scp/rsync проект
cd /opt/bkdojo
bun install
```

## 3. Настроить переменные окружения
```bash
cp .env.example .env
nano .env
```
Заполни:
```ini
# URL LLM-прокси micro-platform; включает серверный оценщик в клиенте.
VITE_EVAL_ENDPOINT=https://api.ollu.example/functions/llm
```
Важно: Vite вшивает в бандл **только** переменные с префиксом `VITE_`. URL прокси
не секрет, поэтому его можно держать в бандле; секретов (ключей) на сервере bkdojo
больше нет.

## 4. Собрать фронтенд
```bash
bun run build      # читает .env → вшивает VITE_EVAL_ENDPOINT, кладёт в dist/
```

## 5. Запустить как сервис (systemd)
`/etc/systemd/system/bkdojo.service`:
```ini
[Unit]
Description=bkdojo
After=network.target

[Service]
WorkingDirectory=/opt/bkdojo
EnvironmentFile=/opt/bkdojo/.env
Environment=PORT=3000
ExecStart=/root/.bun/bin/bun server/prod.ts   # ← путь из `which bun`
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now bkdojo
sudo systemctl status bkdojo          # должно быть active (running)
curl -s localhost:3000/ | grep title  # проверка
```
(Альтернатива systemd — pm2: `pm2 start "bun server/prod.ts" --name bkdojo`.)

## 6. Reverse-proxy + HTTPS

### Вариант A — Caddy (проще, авто-TLS)
`/etc/caddy/Caddyfile`:
```
your.domain.com {
    reverse_proxy localhost:3000
}
```
```bash
sudo systemctl reload caddy
```
Caddy сам получит и продлит сертификат Let's Encrypt.

### Вариант B — nginx + certbot
`/etc/nginx/sites-available/bkdojo`:
```nginx
server {
    server_name your.domain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/bkdojo /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your.domain.com   # выдаст HTTPS
```

## 7. Firewall
Открой 80/443, порт приложения (3000) держи только локально:
```bash
sudo ufw allow 80,443/tcp
sudo ufw enable
```

## Обновление (redeploy)
```bash
cd /opt/bkdojo
git pull
bun install
bun run build
sudo systemctl restart bkdojo
```

## Без серверной оценки
Если серверная AI-оценка не нужна — не задавай `VITE_EVAL_ENDPOINT` (открытые
ответы пойдут через Chrome Built-in AI или режим самопроверки).

## Заметки по эксплуатации
- bkdojo раздаёт только статику — секретов и платных вызовов на нём нет.
  Провайдера (OpenRouter/OpenAI/routerai.ru), модель и ключ пользователь выбирает
  прямо в настройках приложения; они уходят в прокси заголовками
  `X-Provider-Base-Url` / `X-Provider-Key` и в поле `model`. На сервере
  micro-platform при желании ограничь список провайдеров через
  `LLM_ALLOWED_BASE_URLS` (пусто = разрешён любой хост).
- Логи: `journalctl -u bkdojo -f`.
