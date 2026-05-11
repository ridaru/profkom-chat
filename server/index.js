import "dotenv/config";
import { pbkdf2Sync, randomBytes, randomUUID } from "node:crypto";
import express from "express";
import cors from "cors";
import pg from "pg";

const { Pool } = pg;

const PORT = Number(process.env.SERVER_PORT ?? 3001);
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error("DATABASE_URL is not set. Create .env from .env.example.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
});

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json({ limit: "25mb" }));

const userColumns = {
    id: "id",
    fullName: "full_name",
    email: "email",
    role: "role",
    passSaltB64: "pass_salt_b64",
    passHashB64: "pass_hash_b64",
    createdAt: "created_at",
    studentCard: "student_card",
    studyForm: "study_form",
    group: "student_group",
    course: "course",
    educationLevel: "education_level",
    edsEnabled: "eds_enabled",
    edsCertificateName: "eds_certificate_name",
    edsCertificateSerial: "eds_certificate_serial",
    edsConnectedAt: "eds_connected_at",
};

const ticketColumns = {
    id: "id",
    studentId: "student_id",
    topic: "topic",
    type: "ticket_type",
    status: "status",
    createdAt: "created_at",
    updatedAt: "updated_at",
    assignedTo: "assigned_to",
    formData: "form_data",
};

const messageColumns = {
    id: "id",
    ticketId: "ticket_id",
    authorId: "author_id",
    text: "text",
    createdAt: "created_at",
    isReadByStudent: "is_read_by_student",
    isReadByOperator: "is_read_by_operator",
};

const resources = {
    users: {
        table: "users",
        columns: userColumns,
        writable: Object.keys(userColumns),
        orderBy: "created_at asc",
        rowToItem: (row) => ({
            id: row.id,
            fullName: row.full_name,
            email: row.email,
            role: row.role,
            passSaltB64: row.pass_salt_b64,
            passHashB64: row.pass_hash_b64,
            createdAt: row.created_at,
            studentCard: row.student_card ?? undefined,
            studyForm: row.study_form ?? undefined,
            group: row.student_group ?? undefined,
            course: row.course ?? undefined,
            educationLevel: row.education_level ?? undefined,
            edsEnabled: row.eds_enabled,
            edsCertificateName: row.eds_certificate_name ?? undefined,
            edsCertificateSerial: row.eds_certificate_serial ?? undefined,
            edsConnectedAt: row.eds_connected_at ?? undefined,
        }),
    },
    tickets: {
        table: "tickets",
        columns: ticketColumns,
        writable: Object.keys(ticketColumns),
        orderBy: "updated_at desc",
        rowToItem: (row) => ({
            id: row.id,
            studentId: row.student_id,
            topic: row.topic,
            type: row.ticket_type,
            status: row.status,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            assignedTo: row.assigned_to ?? undefined,
            formData: row.form_data,
        }),
    },
    messages: {
        table: "messages",
        columns: messageColumns,
        writable: Object.keys(messageColumns),
        orderBy: "created_at asc",
        rowToItem: (row) => ({
            id: row.id,
            ticketId: row.ticket_id,
            authorId: row.author_id,
            text: row.text,
            createdAt: row.created_at,
            isReadByStudent: row.is_read_by_student,
            isReadByOperator: row.is_read_by_operator,
        }),
    },
};

async function initDb() {
    await pool.query(`
        create table if not exists users (
            id text primary key,
            full_name text not null,
            email text not null unique,
            role text not null check (role in ('student', 'operator', 'admin')),
            pass_salt_b64 text not null,
            pass_hash_b64 text not null,
            created_at text not null,
            student_card text,
            study_form text,
            student_group text,
            course text,
            education_level text,
            eds_enabled boolean not null default false,
            eds_certificate_name text,
            eds_certificate_serial text,
            eds_connected_at text
        );

        create table if not exists tickets (
            id text primary key,
            student_id text not null references users(id) on delete cascade,
            topic text not null,
            ticket_type text not null,
            status text not null check (status in ('new', 'in_progress', 'closed')),
            created_at text not null,
            updated_at text not null,
            assigned_to text references users(id) on delete set null,
            form_data jsonb not null default '{}'::jsonb
        );

        create table if not exists messages (
            id text primary key,
            ticket_id text not null references tickets(id) on delete cascade,
            author_id text not null references users(id) on delete cascade,
            text text not null,
            created_at text not null,
            is_read_by_student boolean not null default false,
            is_read_by_operator boolean not null default false
        );

        create index if not exists idx_users_email on users(email);
        create index if not exists idx_tickets_student_id on tickets(student_id);
        create index if not exists idx_tickets_updated_at on tickets(updated_at);
        create index if not exists idx_messages_ticket_id on messages(ticket_id);
    `);

    await pool.query(`
        alter table users add column if not exists course text;
        alter table users add column if not exists education_level text;
    `);
}

function hashPassword(password) {
    const salt = randomBytes(16);
    const hash = pbkdf2Sync(password, salt, 120_000, 32, "sha256");

    return {
        saltB64: salt.toString("base64"),
        hashB64: hash.toString("base64"),
    };
}

async function seedDb() {
    const now = new Date().toISOString();
    const users = [
        { fullName: "Оператор 1", email: "operator@stankin.ru", role: "operator", password: "123456" },
        { fullName: "Админ", email: "admin@stankin.ru", role: "admin", password: "123456" },
        {
            fullName: "Иван Иванов",
            email: "student@stankin.ru",
            role: "student",
            password: "st123456",
            studentCard: "st123456",
            studyForm: "Очная",
            group: "ИДБ-22-11",
            course: "4",
            educationLevel: "Бакалавриат",
        },
    ].map((user) => {
        const { saltB64, hashB64 } = hashPassword(user.password);
        return {
            id: randomUUID(),
            ...user,
            passSaltB64: saltB64,
            passHashB64: hashB64,
            createdAt: now,
        };
    });

    await Promise.all(users.map((user) => {
        return pool.query(
            `insert into users (
                id,
                full_name,
                email,
                role,
                pass_salt_b64,
                pass_hash_b64,
                created_at,
                student_card,
                study_form,
                student_group,
                course,
                education_level
            )
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            on conflict (email) do update set
                full_name = excluded.full_name,
                pass_salt_b64 = excluded.pass_salt_b64,
                pass_hash_b64 = excluded.pass_hash_b64,
                student_card = excluded.student_card,
                study_form = excluded.study_form,
                student_group = excluded.student_group,
                course = excluded.course,
                education_level = excluded.education_level
            where excluded.student_card is not null`,
            [
                user.id,
                user.fullName,
                user.email,
                user.role,
                user.passSaltB64,
                user.passHashB64,
                user.createdAt,
                user.studentCard ?? null,
                user.studyForm ?? null,
                user.group ?? null,
                user.course ?? null,
                user.educationLevel ?? null,
            ]
        );
    }));
}

function getResource(name) {
    const resource = resources[name];
    if (!resource) {
        const error = new Error("Unknown resource");
        error.status = 404;
        throw error;
    }
    return resource;
}

function buildWhere(resource, query) {
    const entries = Object.entries(query).filter(([key]) => resource.columns[key]);
    const values = [];
    const parts = entries.map(([key, value]) => {
        values.push(value);
        return `${resource.columns[key]} = $${values.length}`;
    });

    return {
        clause: parts.length > 0 ? `where ${parts.join(" and ")}` : "",
        values,
    };
}

function buildPayload(resource, body, partial = false) {
    const keys = resource.writable.filter((key) => Object.prototype.hasOwnProperty.call(body, key));

    if (!partial && !keys.includes("id")) {
        const error = new Error("id is required");
        error.status = 400;
        throw error;
    }

    if (partial && keys.length === 0) {
        const error = new Error("Empty update payload");
        error.status = 400;
        throw error;
    }

    return keys.map((key) => ({
        key,
        column: resource.columns[key],
        value: key === "formData" ? JSON.stringify(body[key] ?? {}) : body[key],
    }));
}

app.get("/api/health", async (_req, res) => {
    await pool.query("select 1");
    res.json({ ok: true });
});

app.get("/api/:resource", async (req, res) => {
    const resource = getResource(req.params.resource);
    const where = buildWhere(resource, req.query);
    const result = await pool.query(
        `select * from ${resource.table} ${where.clause} order by ${resource.orderBy}`,
        where.values
    );

    res.json(result.rows.map(resource.rowToItem));
});

app.get("/api/:resource/:id", async (req, res) => {
    const resource = getResource(req.params.resource);
    const result = await pool.query(`select * from ${resource.table} where id = $1`, [req.params.id]);

    if (result.rowCount === 0) {
        res.status(404).json({ error: "Not found" });
        return;
    }

    res.json(resource.rowToItem(result.rows[0]));
});

app.post("/api/:resource", async (req, res) => {
    const resource = getResource(req.params.resource);
    const payload = buildPayload(resource, req.body);
    const columns = payload.map((item) => item.column);
    const values = payload.map((item) => item.value);
    const placeholders = values.map((_, index) => `$${index + 1}`);

    const result = await pool.query(
        `insert into ${resource.table} (${columns.join(", ")})
         values (${placeholders.join(", ")})
         returning *`,
        values
    );

    res.status(201).json(resource.rowToItem(result.rows[0]));
});

app.put("/api/:resource/:id", async (req, res) => {
    const resource = getResource(req.params.resource);
    const body = { ...req.body, id: req.params.id };
    const payload = buildPayload(resource, body);
    const columns = payload.map((item) => item.column);
    const values = payload.map((item) => item.value);
    const updates = columns.map((column, index) => `${column} = $${index + 1}`);

    const result = await pool.query(
        `insert into ${resource.table} (${columns.join(", ")})
         values (${values.map((_, index) => `$${index + 1}`).join(", ")})
         on conflict (id) do update set ${updates.join(", ")}
         returning *`,
        values
    );

    res.json(resource.rowToItem(result.rows[0]));
});

app.patch("/api/:resource/:id", async (req, res) => {
    const resource = getResource(req.params.resource);
    const payload = buildPayload(resource, req.body, true).filter((item) => item.key !== "id");
    const values = payload.map((item) => item.value);
    const updates = payload.map((item, index) => `${item.column} = $${index + 1}`);

    const result = await pool.query(
        `update ${resource.table}
         set ${updates.join(", ")}
         where id = $${values.length + 1}
         returning *`,
        [...values, req.params.id]
    );

    if (result.rowCount === 0) {
        res.status(404).json({ error: "Not found" });
        return;
    }

    res.json(resource.rowToItem(result.rows[0]));
});

app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(err.status ?? 500).json({ error: err.message ?? "Server error" });
});

try {
    await initDb();
    await seedDb();

    app.listen(PORT, () => {
        console.log(`API server listening on http://localhost:${PORT}`);
    });
} catch (error) {
    console.error("Failed to initialize PostgreSQL connection.");
    console.error(error);
    process.exit(1);
}
