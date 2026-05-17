# Полная миграция пользователей на Better Auth

## Summary

- Сделать Better Auth единственным источником пользователей, ролей и профиля.
- Удалить старые app-таблицы `users`, `tickets`, `messages` и начать с чистой базы.
- Создать новые `tickets` и `messages`, которые ссылаются на Better Auth user table.
- Оставить вход по email или студенческому билету.

## Key Changes

- Установить `better-auth`; добавить серверный TypeScript runtime `tsx` и перевести `server/index.js` в `server/index.ts`.
- Создать `lib/auth.ts` с `betterAuth`:
  - `database: new Pool({ connectionString: process.env.DATABASE_URL })`;
  - `emailAndPassword: { enabled: true }`;
  - `user.modelName: "users"`, чтобы Better Auth владел таблицей пользователей;
  - `user.additionalFields`: `role`, `studentCard`, `studyForm`, `group`, `course`, `educationLevel`, `edsEnabled`, `edsCertificateName`, `edsCertificateSerial`, `edsConnectedAt`;
  - `role` должен иметь default `student` и `input: false`;
  - OAuth не подключать, если в env нет credentials.
- Создать `src/lib/auth-client.ts` через `createAuthClient` из `better-auth/react`.
- Подключить Express handler: `app.all("/api/auth/{*any}", toNodeHandler(auth))` до `express.json()`, с CORS `credentials: true`.

## Database Reset

- Добавить отдельную reset/migration-команду для локальной разработки:
  - drop старых `messages`, `tickets`, `users`;
  - запустить `npx auth@latest migrate`, чтобы Better Auth создал свои `users`, `session`, `account`, `verification`;
  - создать новые `tickets` и `messages`.
- Новые таблицы:
  - `tickets.student_id references users(id) on delete cascade`;
  - `tickets.assigned_to references users(id) on delete set null`;
  - `messages.author_id references users(id) on delete cascade`;
  - убрать legacy password columns `pass_salt_b64`, `pass_hash_b64` полностью.
- Seed после reset:
  - `student@stankin.ru / st123456`, role `student`, studentCard `st123456`;
  - `operator@stankin.ru / 123456`, role `operator`;
  - `admin@stankin.ru / 123456`, role `admin`;
  - обращения и сообщения не seed-ить, база стартует чистой.

## App Behavior

- Заменить `useAuth` на обертку над `authClient.useSession()`:
  - `userId`, `user`, `isPending`, `logout`;
  - больше не использовать `localStorage`.
- Переделать `Login.tsx`:
  - email -> `authClient.signIn.email`;
  - студенческий билет -> серверный endpoint поиска пользователя по `studentCard`, затем `signIn.email` по найденному email;
  - после успеха переход на `/app`.
- Обновить `db.ts`:
  - тип `User` соответствует Better Auth user + additional fields;
  - `db.users` работает с Better Auth-owned `users`, но не создает пользователей напрямую с паролями;
  - все fetch-запросы отправляют cookies.
- Закрыть `/api/users`, `/api/tickets`, `/api/messages` сессионной проверкой:
  - без сессии `401`;
  - student видит/меняет только свои обращения и свой профиль;
  - operator/admin видят все обращения;
  - менять роли может только admin.
- Удалить старые `hashPassword`, `verifyPassword`, seed через legacy `db.users.add`, и неиспользуемую страницу регистрации либо оставить редирект `/register -> /login`.

## Test Plan

- `npm run build`.
- `npm run lint`.
- Локальная проверка после reset:
  - Better Auth migrate создает таблицы;
  - вход по `student@stankin.ru / st123456`;
  - вход по `st123456 / st123456`;
  - admin/operator login;
  - logout закрывает `/app`;
  - `/api/tickets` без cookie возвращает `401`;
  - student не может получить чужие данные;
  - admin может менять роли.

## Assumptions

- Выбран чистый старт: текущие обращения, сообщения и старые пользователи удаляются.
- Better Auth `users` становится единственной таблицей пользователей; отдельная profile-таблица не создается.
- Используем актуальные Better Auth docs: installation/env/migrate, Express v5 handler, React client, `modelName` и `additionalFields`.
  - https://better-auth.com/docs/installation
  - https://better-auth.com/docs/integrations/express
  - https://better-auth.com/docs/concepts/client
  - https://better-auth.com/docs/concepts/database
