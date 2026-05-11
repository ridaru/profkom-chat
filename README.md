MGTU STANKIN prof support-chat

## PostgreSQL

Проект теперь хранит пользователей, обращения и сообщения в PostgreSQL через локальный API-сервер.

1. Поднимите PostgreSQL:

```bash
docker compose up -d postgres
```

Если PostgreSQL уже установлен локально, можно вместо Docker создать базу вручную:

```sql
create database profkom_chat;
```

2. Скопируйте `.env.example` в `.env` и настройте подключение:

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/profkom_chat
SERVER_PORT=3001
CLIENT_ORIGIN=http://localhost:5173
```

3. Запустите приложение:

```bash
npm run dev
```

Команда поднимет API на `http://localhost:3001` и Vite-клиент на `http://localhost:5173`.
Таблицы создаются автоматически при старте сервера; SQL-схема также лежит в `server/schema.sql`.
