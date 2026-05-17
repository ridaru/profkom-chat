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

        create index if not exists idx_users_email on users(email);
        create index if not exists idx_users_student_card on users(student_card);
        create index if not exists idx_tickets_student_id on tickets(student_id);
        create index if not exists idx_tickets_updated_at on tickets(updated_at);
        create index if not exists idx_messages_ticket_id on messages(ticket_id);
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

try {
    await dropLegacyTables();
    runBetterAuthMigration();
    await createAppTables();
    await seedUsers();
    console.log("Database reset complete.");
} finally {
    await pool.end();
}
