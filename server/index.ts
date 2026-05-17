import "dotenv/config";
import express, { type Request } from "express";
import cors from "cors";
import pg from "pg";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";

const { Pool } = pg;

type UserRole = "student" | "operator" | "admin";
type ResourceName = "users" | "tickets" | "messages";
type ResourceDef = {
    table: string;
    columns: Record<string, string>;
    writable: readonly string[];
    orderBy: string;
    rowToItem: (row: Record<string, unknown>) => unknown;
};

type SessionUser = {
    id: string;
    email: string;
    name: string;
    role?: UserRole;
};

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

app.use(cors({
    origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
    credentials: true,
}));

app.get("/api/auth/lookup-student", async (req, res) => {
    const studentCard = String(req.query.studentCard ?? "").trim();
    if (!studentCard) throw httpError(400, "studentCard is required");

    const result = await pool.query(
        "select email from users where student_card = $1 limit 1",
        [studentCard],
    );

    if (result.rowCount === 0) {
        res.status(404).json({ error: "Not found" });
        return;
    }

    res.json({ email: result.rows[0].email });
});

app.all("/api/auth/*splat", toNodeHandler(auth));
app.use(express.json({ limit: "25mb" }));

const userColumns = {
    id: "id",
    fullName: "full_name",
    email: "email",
    role: "role",
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
} as const;

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
} as const;

const messageColumns = {
    id: "id",
    ticketId: "ticket_id",
    authorId: "author_id",
    text: "text",
    createdAt: "created_at",
    isReadByStudent: "is_read_by_student",
    isReadByOperator: "is_read_by_operator",
} as const;

const toDateString = (value: unknown) => (
    value instanceof Date ? value.toISOString() : String(value ?? "")
);

const rowToUser = (row: Record<string, unknown>) => ({
    id: String(row.id),
    fullName: String(row.full_name ?? ""),
    email: String(row.email ?? ""),
    role: (row.role ?? "student") as UserRole,
    createdAt: toDateString(row.created_at),
    studentCard: row.student_card ?? undefined,
    studyForm: row.study_form ?? undefined,
    group: row.student_group ?? undefined,
    course: row.course ?? undefined,
    educationLevel: row.education_level ?? undefined,
    edsEnabled: Boolean(row.eds_enabled),
    edsCertificateName: row.eds_certificate_name ?? undefined,
    edsCertificateSerial: row.eds_certificate_serial ?? undefined,
    edsConnectedAt: row.eds_connected_at ?? undefined,
});

const rowToTicket = (row: Record<string, unknown>) => ({
    id: String(row.id),
    studentId: String(row.student_id),
    topic: String(row.topic ?? ""),
    type: String(row.ticket_type ?? ""),
    status: row.status,
    createdAt: toDateString(row.created_at),
    updatedAt: toDateString(row.updated_at),
    assignedTo: row.assigned_to ?? undefined,
    formData: row.form_data ?? {},
});

const rowToMessage = (row: Record<string, unknown>) => ({
    id: String(row.id),
    ticketId: String(row.ticket_id),
    authorId: String(row.author_id),
    text: String(row.text ?? ""),
    createdAt: toDateString(row.created_at),
    isReadByStudent: Boolean(row.is_read_by_student),
    isReadByOperator: Boolean(row.is_read_by_operator),
});

const resources: Record<ResourceName, ResourceDef> = {
    users: {
        table: "users",
        columns: userColumns,
        writable: ["fullName", "role", "studentCard", "studyForm", "group", "course", "educationLevel", "edsEnabled", "edsCertificateName", "edsCertificateSerial", "edsConnectedAt"],
        orderBy: "created_at asc",
        rowToItem: rowToUser,
    },
    tickets: {
        table: "tickets",
        columns: ticketColumns,
        writable: Object.keys(ticketColumns).filter((key) => key !== "id"),
        orderBy: "updated_at desc",
        rowToItem: rowToTicket,
    },
    messages: {
        table: "messages",
        columns: messageColumns,
        writable: Object.keys(messageColumns).filter((key) => key !== "id"),
        orderBy: "created_at asc",
        rowToItem: rowToMessage,
    },
};

function httpError(status: number, message: string) {
    const error = new Error(message) as Error & { status?: number };
    error.status = status;
    return error;
}

async function initAppTables() {
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

async function requireSession(req: Request) {
    const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
    });

    if (!session) throw httpError(401, "Unauthorized");
    return session.user as SessionUser;
}

function getResource(name: string) {
    const resource = resources[name as ResourceName];
    if (!resource) throw httpError(404, "Unknown resource");
    return resource;
}

function buildWhere(
    columns: Record<string, string>,
    query: Request["query"],
    startIndex = 1,
) {
    const values: unknown[] = [];
    const parts = Object.entries(query).flatMap(([key, value]) => {
        const column = columns[key];
        if (!column || value === undefined) return [];
        values.push(Array.isArray(value) ? value[0] : value);
        return [`${column} = $${values.length + startIndex - 1}`];
    });

    return { parts, values };
}

function buildPayload(
    writable: readonly string[],
    columns: Record<string, string>,
    body: Record<string, unknown>,
) {
    return writable
        .filter((key) => Object.prototype.hasOwnProperty.call(body, key))
        .map((key) => ({
            key,
            column: columns[key],
            value: key === "formData" ? JSON.stringify(body[key] ?? {}) : body[key],
        }));
}

async function assertTicketAccess(ticketId: string, user: SessionUser) {
    const result = await pool.query("select * from tickets where id = $1", [ticketId]);
    if (result.rowCount === 0) throw httpError(404, "Not found");

    const ticket = result.rows[0] as Record<string, unknown>;
    if (user.role === "student" && ticket.student_id !== user.id) {
        throw httpError(403, "Forbidden");
    }

    return ticket;
}

app.get("/api/health", async (_req, res) => {
    await pool.query("select 1");
    res.json({ ok: true });
});

app.get("/api/:resource", async (req, res) => {
    const user = await requireSession(req);
    const resourceName = req.params.resource as ResourceName;
    const resource = getResource(resourceName);

    const where = buildWhere(resource.columns, req.query);
    const parts = [...where.parts];
    const values = [...where.values];

    if (resourceName === "users" && user.role === "student") {
        parts.push(`id = $${values.length + 1}`);
        values.push(user.id);
    }

    if (resourceName === "tickets" && user.role === "student") {
        parts.push(`student_id = $${values.length + 1}`);
        values.push(user.id);
    }

    if (resourceName === "messages" && user.role === "student") {
        parts.push(`ticket_id in (select id from tickets where student_id = $${values.length + 1})`);
        values.push(user.id);
    }

    const clause = parts.length > 0 ? `where ${parts.join(" and ")}` : "";
    const result = await pool.query(
        `select * from ${resource.table} ${clause} order by ${resource.orderBy}`,
        values,
    );

    res.json(result.rows.map(resource.rowToItem));
});

app.get("/api/:resource/:id", async (req, res) => {
    const user = await requireSession(req);
    const resourceName = req.params.resource as ResourceName;
    const resource = getResource(resourceName);

    if (resourceName === "users" && user.role === "student" && req.params.id !== user.id) {
        throw httpError(403, "Forbidden");
    }

    if (resourceName === "tickets") {
        const ticket = await assertTicketAccess(req.params.id, user);
        res.json(rowToTicket(ticket));
        return;
    }

    if (resourceName === "messages") {
        const result = await pool.query("select * from messages where id = $1", [req.params.id]);
        if (result.rowCount === 0) throw httpError(404, "Not found");
        await assertTicketAccess(String(result.rows[0].ticket_id), user);
        res.json(rowToMessage(result.rows[0]));
        return;
    }

    const result = await pool.query(`select * from ${resource.table} where id = $1`, [req.params.id]);
    if (result.rowCount === 0) throw httpError(404, "Not found");
    res.json(resource.rowToItem(result.rows[0]));
});

app.post("/api/:resource", async (req, res) => {
    const user = await requireSession(req);
    const resourceName = req.params.resource as ResourceName;
    const resource = getResource(resourceName);

    if (resourceName === "users") throw httpError(403, "Create users through Better Auth");

    const body = { ...(req.body as Record<string, unknown>) };
    body.id = typeof body.id === "string" ? body.id : crypto.randomUUID();

    if (resourceName === "tickets") {
        if (user.role !== "student") throw httpError(403, "Only students can create tickets");
        body.studentId = user.id;
    }

    if (resourceName === "messages") {
        await assertTicketAccess(String(body.ticketId ?? ""), user);
        body.authorId = user.id;
    }

    const writable = ["id", ...resource.writable];
    const payload = buildPayload(writable, resource.columns, body);
    const columns = payload.map((item) => item.column);
    const values = payload.map((item) => item.value);

    const result = await pool.query(
        `insert into ${resource.table} (${columns.join(", ")})
         values (${values.map((_, index) => `$${index + 1}`).join(", ")})
         returning *`,
        values,
    );

    res.status(201).json(resource.rowToItem(result.rows[0]));
});

app.put("/api/:resource/:id", async (req, res) => {
    const user = await requireSession(req);
    const resourceName = req.params.resource as ResourceName;
    const resource = getResource(resourceName);
    const body: Record<string, unknown> = { ...(req.body as Record<string, unknown>), id: req.params.id };

    if (resourceName === "users") throw httpError(405, "Use PATCH for users");
    if (resourceName === "tickets") await assertTicketAccess(req.params.id, user);
    if (resourceName === "messages") await assertTicketAccess(String(body.ticketId ?? ""), user);

    if (resourceName === "tickets" && user.role === "student") body.studentId = user.id;
    if (resourceName === "messages") body.authorId = user.id;

    const writable = ["id", ...resource.writable];
    const payload = buildPayload(writable, resource.columns, body);
    const columns = payload.map((item) => item.column);
    const values = payload.map((item) => item.value);
    const updates = columns
        .filter((column) => column !== "id")
        .map((column) => `${column} = excluded.${column}`);

    const result = await pool.query(
        `insert into ${resource.table} (${columns.join(", ")})
         values (${values.map((_, index) => `$${index + 1}`).join(", ")})
         on conflict (id) do update set ${updates.join(", ")}
         returning *`,
        values,
    );

    res.json(resource.rowToItem(result.rows[0]));
});

app.patch("/api/:resource/:id", async (req, res) => {
    const user = await requireSession(req);
    const resourceName = req.params.resource as ResourceName;
    const resource = getResource(resourceName);
    const body = { ...(req.body as Record<string, unknown>) };

    if (resourceName === "users") {
        if (user.role !== "admin" && req.params.id !== user.id) throw httpError(403, "Forbidden");
        if (Object.prototype.hasOwnProperty.call(body, "role") && user.role !== "admin") {
            throw httpError(403, "Only admins can change roles");
        }
    }

    if (resourceName === "tickets") await assertTicketAccess(req.params.id, user);
    if (resourceName === "messages") {
        const message = await pool.query("select ticket_id from messages where id = $1", [req.params.id]);
        if (message.rowCount === 0) throw httpError(404, "Not found");
        await assertTicketAccess(String(message.rows[0].ticket_id), user);
    }

    const payload = buildPayload(resource.writable, resource.columns, body);
    if (payload.length === 0) throw httpError(400, "Empty update payload");

    const values = payload.map((item) => item.value);
    const updates = payload.map((item, index) => `${item.column} = $${index + 1}`);

    const result = await pool.query(
        `update ${resource.table}
         set ${updates.join(", ")}
         where id = $${values.length + 1}
         returning *`,
        [...values, req.params.id],
    );

    if (result.rowCount === 0) throw httpError(404, "Not found");
    res.json(resource.rowToItem(result.rows[0]));
});

app.use((err: Error & { status?: number }, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    void next;
    console.error(err);
    res.status(err.status ?? 500).json({ error: err.message ?? "Server error" });
});

try {
    await initAppTables();

    app.listen(PORT, () => {
        console.log(`API server listening on http://localhost:${PORT}`);
    });
} catch (error) {
    console.error("Failed to initialize PostgreSQL connection.");
    console.error(error);
    process.exit(1);
}
