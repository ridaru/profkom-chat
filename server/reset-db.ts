import "dotenv/config";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { auth } from "../lib/auth";

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error("DATABASE_URL is not set. Create .env from .env.example.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
});

async function dropLegacyTables() {
    await pool.query(`
        drop table if exists messages cascade;
        drop table if exists ticket_events cascade;
        drop table if exists priority_rules cascade;
        drop table if exists response_templates cascade;
        drop table if exists tickets cascade;
        drop table if exists verification cascade;
        drop table if exists account cascade;
        drop table if exists session cascade;
        drop table if exists users cascade;
    `);
}

function runBetterAuthMigration() {
    const command = process.platform === "win32" ? "npx.cmd" : "npx";
    const result = spawnSync(
        command,
        ["@better-auth/cli@latest", "migrate", "--config", "lib/auth.ts", "--yes"],
        {
            cwd: process.cwd(),
            env: process.env,
            shell: process.platform === "win32",
            stdio: "inherit",
        },
    );

    if (result.status !== 0) {
        throw new Error(`Better Auth migration failed with exit code ${result.status ?? "unknown"}`);
    }
}

async function createAppTables() {
    await pool.query(`
        create table if not exists tickets (
            id text primary key,
            student_id text not null references users(id) on delete cascade,
            topic text not null,
            ticket_type text not null,
            priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
            status text not null check (status in ('new', 'in_progress', 'closed')),
            created_at timestamptz not null,
            updated_at timestamptz not null,
            assigned_to text references users(id) on delete set null,
            form_data jsonb not null default '{}'::jsonb
        );

        create table if not exists messages (
            id text primary key,
            ticket_id text not null references tickets(id) on delete cascade,
            author_id text not null references users(id) on delete cascade,
            text text not null,
            created_at timestamptz not null,
            is_read_by_student boolean not null default false,
            is_read_by_operator boolean not null default false
        );

        create table if not exists ticket_events (
            id text primary key,
            ticket_id text not null references tickets(id) on delete cascade,
            actor_id text not null references users(id) on delete cascade,
            event_type text not null,
            message text not null,
            created_at timestamptz not null,
            metadata jsonb not null default '{}'::jsonb
        );

        create table if not exists priority_rules (
            id text primary key,
            topic text not null,
            ticket_type text,
            priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
            description text not null default '',
            updated_at timestamptz not null,
            updated_by text references users(id) on delete set null,
            unique (topic, ticket_type)
        );

        create table if not exists response_templates (
            id text primary key,
            title text not null,
            preview text not null default '',
            text text not null,
            is_active boolean not null default true,
            created_at timestamptz not null,
            updated_at timestamptz not null,
            updated_by text references users(id) on delete set null
        );

        create index if not exists idx_users_email on users(email);
        create index if not exists idx_users_student_card on users(student_card);
        create index if not exists idx_tickets_student_id on tickets(student_id);
        create index if not exists idx_tickets_updated_at on tickets(updated_at);
        create index if not exists idx_messages_ticket_id on messages(ticket_id);
        create index if not exists idx_ticket_events_ticket_id on ticket_events(ticket_id);
        create index if not exists idx_priority_rules_topic on priority_rules(topic);
        create index if not exists idx_response_templates_active on response_templates(is_active);
    `);
}

async function seedUser(data: {
    name: string;
    email: string;
    password: string;
    role: "student" | "operator" | "admin";
    studentCard?: string;
    studyForm?: string;
    group?: string;
    course?: string;
    educationLevel?: string;
}) {
    await auth.api.signUpEmail({
        body: {
            name: data.name,
            email: data.email,
            password: data.password,
        },
    });

    await pool.query(
        `update users
         set role = $2,
             student_card = $3,
             study_form = $4,
             student_group = $5,
             course = $6,
             education_level = $7
         where email = $1`,
        [
            data.email,
            data.role,
            data.studentCard ?? null,
            data.studyForm ?? null,
            data.group ?? null,
            data.course ?? null,
            data.educationLevel ?? null,
        ],
    );
}

async function seedUsers() {
    await seedUser({
        name: "Student",
        email: "student@stankin.ru",
        password: "st123456",
        role: "student",
        studentCard: "st123456",
        studyForm: "Очная",
        group: "ИДБ-22-11",
        course: "4",
        educationLevel: "Бакалавриат",
    });

    await seedUser({
        name: "Operator",
        email: "operator@stankin.ru",
        password: "123456",
        role: "operator",
    });

    await seedUser({
        name: "Admin",
        email: "admin@stankin.ru",
        password: "123456",
        role: "admin",
    });
}

async function seedPriorityRules() {
    const now = new Date().toISOString();
    const defaults = [
        ["Материальная поддержка", "Финансы", "high", "Заявления на матпомощь зависят от оснований, подтверждающих документов, квот и сроков подачи."],
        ["Социальная поддержка", "Социальная", "high", "Социальные выплаты и льготы требуют быстрой проверки категории и документов."],
        ["Справка/документы", "Общее", "normal", "Документальные вопросы важны, но обычно не требуют немедленной обработки."],
        ["Вопрос по стипендии", "Общее", "normal", "Стипендиальные вопросы обрабатываются планово, если не связаны с социальным основанием."],
        ["Общежитие", "Общее", "normal", "Вопросы проживания требуют контроля, но чаще обрабатываются в общей очереди."],
        ["Другое", "Общее", "low", "Неклассифицированные консультации можно разбирать после профильных обращений."],
    ] as const;

    for (const [topic, type, priority, description] of defaults) {
        await pool.query(
            `insert into priority_rules (id, topic, ticket_type, priority, description, updated_at)
             values ($1, $2, $3, $4, $5, $6)`,
            [crypto.randomUUID(), topic, type, priority, description, now],
        );
    }
}

async function seedResponseTemplates() {
    const now = new Date().toISOString();
    const defaults = [
        ["Принято в работу", "Сообщает студенту, что обращение принято оператором.", "Здравствуйте! Ваше обращение принято в работу."],
        ["Приложите документы", "Запрашивает недостающие подтверждающие документы.", "Пожалуйста, приложите недостающие документы к обращению."],
        ["Уточните детали", "Просит студента подробнее описать ситуацию.", "Уточните, пожалуйста, детали по вашему обращению."],
        ["Документы проверены", "Подтверждает проверку документов и передачу дальше.", "Документы проверены, обращение передано на дальнейшее рассмотрение."],
        ["Обращение обработано", "Сообщает о завершении обработки обращения.", "Ваше обращение обработано. При необходимости можете написать в этом чате."],
    ] as const;

    for (const [title, preview, text] of defaults) {
        await pool.query(
            `insert into response_templates (id, title, preview, text, is_active, created_at, updated_at)
             values ($1, $2, $3, $4, true, $5, $5)`,
            [crypto.randomUUID(), title, preview, text, now],
        );
    }
}

try {
    await dropLegacyTables();
    runBetterAuthMigration();
    await createAppTables();
    await seedUsers();
    await seedPriorityRules();
    await seedResponseTemplates();
    console.log("Database reset complete.");
} finally {
    await pool.end();
}
