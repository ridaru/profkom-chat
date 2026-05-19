import "dotenv/config";
import express, { type Request } from "express";
import cors from "cors";
import pg from "pg";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";

const { Pool } = pg;

type UserRole = "student" | "operator" | "admin";
type ResourceName = "users" | "tickets" | "messages" | "ticket-events" | "priority-rules" | "response-templates";
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
    priority: "priority",
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

const ticketEventColumns = {
    id: "id",
    ticketId: "ticket_id",
    actorId: "actor_id",
    eventType: "event_type",
    message: "message",
    createdAt: "created_at",
    metadata: "metadata",
} as const;

const priorityRuleColumns = {
    id: "id",
    topic: "topic",
    type: "ticket_type",
    priority: "priority",
    description: "description",
    updatedAt: "updated_at",
    updatedBy: "updated_by",
} as const;

const responseTemplateColumns = {
    id: "id",
    title: "title",
    preview: "preview",
    text: "text",
    isActive: "is_active",
    createdAt: "created_at",
    updatedAt: "updated_at",
    updatedBy: "updated_by",
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
    priority: row.priority ?? "normal",
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

const rowToTicketEvent = (row: Record<string, unknown>) => ({
    id: String(row.id),
    ticketId: String(row.ticket_id),
    actorId: String(row.actor_id),
    eventType: String(row.event_type ?? ""),
    message: String(row.message ?? ""),
    createdAt: toDateString(row.created_at),
    metadata: row.metadata ?? {},
});

const rowToPriorityRule = (row: Record<string, unknown>) => ({
    id: String(row.id),
    topic: String(row.topic ?? ""),
    type: row.ticket_type ? String(row.ticket_type) : null,
    priority: row.priority ?? "normal",
    description: String(row.description ?? ""),
    updatedAt: toDateString(row.updated_at),
    updatedBy: row.updated_by ?? null,
});

const rowToResponseTemplate = (row: Record<string, unknown>) => ({
    id: String(row.id),
    title: String(row.title ?? ""),
    preview: String(row.preview ?? ""),
    text: String(row.text ?? ""),
    isActive: Boolean(row.is_active),
    createdAt: toDateString(row.created_at),
    updatedAt: toDateString(row.updated_at),
    updatedBy: row.updated_by ?? null,
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
    "ticket-events": {
        table: "ticket_events",
        columns: ticketEventColumns,
        writable: [],
        orderBy: "created_at asc",
        rowToItem: rowToTicketEvent,
    },
    "priority-rules": {
        table: "priority_rules",
        columns: priorityRuleColumns,
        writable: ["priority", "description", "updatedAt", "updatedBy"],
        orderBy: "topic asc, ticket_type asc",
        rowToItem: rowToPriorityRule,
    },
    "response-templates": {
        table: "response_templates",
        columns: responseTemplateColumns,
        writable: ["title", "preview", "text", "isActive", "createdAt", "updatedAt", "updatedBy"],
        orderBy: "updated_at desc, title asc",
        rowToItem: rowToResponseTemplate,
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

        alter table tickets add column if not exists priority text not null default 'normal';

        create index if not exists idx_users_email on users(email);
        create index if not exists idx_users_student_card on users(student_card);
        create index if not exists idx_tickets_student_id on tickets(student_id);
        create index if not exists idx_tickets_updated_at on tickets(updated_at);
        create index if not exists idx_messages_ticket_id on messages(ticket_id);
        create index if not exists idx_ticket_events_ticket_id on ticket_events(ticket_id);
        create index if not exists idx_priority_rules_topic on priority_rules(topic);
        create index if not exists idx_response_templates_active on response_templates(is_active);
    `);

    await seedPriorityRules();
    await seedResponseTemplates();
}

async function seedPriorityRules() {
    const now = new Date().toISOString();
    const defaults = [
        {
            topic: "Материальная поддержка",
            type: "Финансы",
            priority: "high",
            description: "Заявления на матпомощь зависят от оснований, подтверждающих документов, квот и сроков подачи.",
        },
        {
            topic: "Социальная поддержка",
            type: "Социальная",
            priority: "high",
            description: "Социальные выплаты и льготы требуют быстрой проверки категории и документов.",
        },
        {
            topic: "Справка/документы",
            type: "Общее",
            priority: "normal",
            description: "Документальные вопросы важны, но обычно не требуют немедленной обработки.",
        },
        {
            topic: "Вопрос по стипендии",
            type: "Общее",
            priority: "normal",
            description: "Стипендиальные вопросы обрабатываются планово, если не связаны с социальным основанием.",
        },
        {
            topic: "Общежитие",
            type: "Общее",
            priority: "normal",
            description: "Вопросы проживания требуют контроля, но чаще обрабатываются в общей очереди.",
        },
        {
            topic: "Другое",
            type: "Общее",
            priority: "low",
            description: "Неклассифицированные консультации можно разбирать после профильных обращений.",
        },
    ];

    for (const rule of defaults) {
        await pool.query(
            `insert into priority_rules (id, topic, ticket_type, priority, description, updated_at)
             values ($1, $2, $3, $4, $5, $6)
             on conflict (topic, ticket_type) do nothing`,
            [crypto.randomUUID(), rule.topic, rule.type, rule.priority, rule.description, now],
        );
    }
}

async function seedResponseTemplates() {
    const now = new Date().toISOString();
    const defaults = [
        {
            title: "Принято в работу",
            preview: "Сообщает студенту, что обращение принято оператором.",
            text: "Здравствуйте! Ваше обращение принято в работу.",
        },
        {
            title: "Приложите документы",
            preview: "Запрашивает недостающие подтверждающие документы.",
            text: "Пожалуйста, приложите недостающие документы к обращению.",
        },
        {
            title: "Уточните детали",
            preview: "Просит студента подробнее описать ситуацию.",
            text: "Уточните, пожалуйста, детали по вашему обращению.",
        },
        {
            title: "Документы проверены",
            preview: "Подтверждает проверку документов и передачу дальше.",
            text: "Документы проверены, обращение передано на дальнейшее рассмотрение.",
        },
        {
            title: "Обращение обработано",
            preview: "Сообщает о завершении обработки обращения.",
            text: "Ваше обращение обработано. При необходимости можете написать в этом чате.",
        },
    ];

    for (const template of defaults) {
        await pool.query(
            `insert into response_templates (id, title, preview, text, is_active, created_at, updated_at)
             values ($1, $2, $3, $4, true, $5, $5)
             on conflict (id) do nothing`,
            [crypto.randomUUID(), template.title, template.preview, template.text, now],
        );
    }
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
            value: key === "formData" || key === "metadata" ? JSON.stringify(body[key] ?? {}) : body[key],
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

function canManageTickets(user: SessionUser) {
    return user.role === "operator" || user.role === "admin";
}

async function createTicketEvent(
    ticketId: string,
    actorId: string,
    eventType: string,
    message: string,
    metadata: Record<string, unknown> = {},
) {
    await pool.query(
        `insert into ticket_events (id, ticket_id, actor_id, event_type, message, created_at, metadata)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [crypto.randomUUID(), ticketId, actorId, eventType, message, new Date().toISOString(), JSON.stringify(metadata)],
    );
}

async function getUserName(userId: unknown) {
    if (!userId) return "Не назначен";
    const result = await pool.query("select full_name from users where id = $1", [userId]);
    return String(result.rows[0]?.full_name ?? "Не назначен");
}

async function resolvePriority(topic: unknown, type: unknown) {
    const result = await pool.query(
        `select priority
         from priority_rules
         where topic = $1 and (ticket_type = $2 or ticket_type is null)
         order by case when ticket_type = $2 then 0 else 1 end
         limit 1`,
        [String(topic ?? ""), String(type ?? "")],
    );

    return String(result.rows[0]?.priority ?? "normal");
}

app.get("/api/health", async (_req, res) => {
    await pool.query("select 1");
    res.json({ ok: true });
});

app.get("/api/analytics/tickets", async (req, res) => {
    const user = await requireSession(req);
    if (!canManageTickets(user)) throw httpError(403, "Forbidden");

    const [summary, byTopic, byStatus, byPriority, workload, timings] = await Promise.all([
        pool.query(`
            select
                count(*)::int as total,
                count(*) filter (where status = 'new')::int as new,
                count(*) filter (where status = 'in_progress')::int as in_progress,
                count(*) filter (where status = 'closed')::int as closed
            from tickets
        `),
        pool.query(`
            select topic as label, count(*)::int as count
            from tickets
            group by topic
            order by count desc, topic asc
        `),
        pool.query(`
            select status as label, count(*)::int as count
            from tickets
            group by status
            order by status asc
        `),
        pool.query(`
            select priority as label, count(*)::int as count
            from tickets
            group by priority
            order by priority asc
        `),
        pool.query(`
            select coalesce(u.full_name, 'Не назначен') as label, count(t.id)::int as count
            from tickets t
            left join users u on u.id = t.assigned_to
            group by coalesce(u.full_name, 'Не назначен')
            order by count desc, label asc
        `),
        pool.query(`
            with first_operator_message as (
                select
                    t.id as ticket_id,
                    min(m.created_at) as first_response_at
                from tickets t
                join messages m on m.ticket_id = t.id
                join users u on u.id = m.author_id
                where u.role in ('operator', 'admin')
                group by t.id
            ),
            closed_events as (
                select
                    ticket_id,
                    min(created_at) as closed_at
                from ticket_events
                where event_type = 'status_changed'
                  and metadata->>'to' = 'closed'
                group by ticket_id
            )
            select
                avg(extract(epoch from (f.first_response_at - t.created_at))) as avg_first_response_seconds,
                avg(extract(epoch from (coalesce(c.closed_at, t.updated_at) - t.created_at))) filter (where t.status = 'closed') as avg_close_seconds
            from tickets t
            left join first_operator_message f on f.ticket_id = t.id
            left join closed_events c on c.ticket_id = t.id
        `),
    ]);

    const timingRow = timings.rows[0] ?? {};

    res.json({
        summary: {
            total: Number(summary.rows[0]?.total ?? 0),
            new: Number(summary.rows[0]?.new ?? 0),
            inProgress: Number(summary.rows[0]?.in_progress ?? 0),
            closed: Number(summary.rows[0]?.closed ?? 0),
        },
        byTopic: byTopic.rows.map((row) => ({ label: String(row.label), count: Number(row.count) })),
        byStatus: byStatus.rows.map((row) => ({ label: String(row.label), count: Number(row.count) })),
        byPriority: byPriority.rows.map((row) => ({ label: String(row.label), count: Number(row.count) })),
        workload: workload.rows.map((row) => ({ label: String(row.label), count: Number(row.count) })),
        timings: {
            avgFirstResponseSeconds: timingRow.avg_first_response_seconds === null ? null : Number(timingRow.avg_first_response_seconds ?? 0),
            avgCloseSeconds: timingRow.avg_close_seconds === null ? null : Number(timingRow.avg_close_seconds ?? 0),
        },
    });
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

    if (resourceName === "ticket-events" && user.role === "student") {
        parts.push(`ticket_id in (select id from tickets where student_id = $${values.length + 1})`);
        values.push(user.id);
    }

    if (resourceName === "priority-rules" && user.role !== "admin") {
        throw httpError(403, "Forbidden");
    }

    if (resourceName === "response-templates" && user.role === "student") {
        parts.push(`is_active = $${values.length + 1}`);
        values.push(true);
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

    if (resourceName === "priority-rules" && user.role !== "admin") {
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

    if (resourceName === "ticket-events") {
        const result = await pool.query("select * from ticket_events where id = $1", [req.params.id]);
        if (result.rowCount === 0) throw httpError(404, "Not found");
        await assertTicketAccess(String(result.rows[0].ticket_id), user);
        res.json(rowToTicketEvent(result.rows[0]));
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
    if (resourceName === "ticket-events") throw httpError(403, "Ticket events are created by the server");
    if (resourceName === "priority-rules") throw httpError(403, "Priority rules are configured by admins");

    const body = { ...(req.body as Record<string, unknown>) };
    body.id = typeof body.id === "string" ? body.id : crypto.randomUUID();

    if (resourceName === "response-templates") {
        if (user.role !== "admin") throw httpError(403, "Forbidden");
        const now = new Date().toISOString();
        body.createdAt = now;
        body.updatedAt = now;
        body.updatedBy = user.id;
        body.isActive = body.isActive ?? true;
    }

    if (resourceName === "tickets") {
        if (user.role !== "student") throw httpError(403, "Only students can create tickets");
        body.studentId = user.id;
        body.status = "new";
        body.assignedTo = null;
        body.priority = await resolvePriority(body.topic, body.type);
    }

    if (resourceName === "messages") {
        const ticket = await assertTicketAccess(String(body.ticketId ?? ""), user);
        body.authorId = user.id;
        const now = new Date().toISOString();
        body.createdAt = body.createdAt ?? now;
        await pool.query("update tickets set updated_at = $1 where id = $2", [now, body.ticketId]);
        await createTicketEvent(
            String(body.ticketId),
            user.id,
            user.role === "student" ? "message_sent" : "response_sent",
            user.role === "student" ? "Студент отправил сообщение." : "Сотрудник отправил ответ.",
            { ticketStatus: ticket.status },
        );
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

    if (resourceName === "tickets") {
        await createTicketEvent(
            String(result.rows[0].id),
            user.id,
            "ticket_created",
            "Обращение создано студентом.",
            { priority: result.rows[0].priority, topic: result.rows[0].topic },
        );
    }
});

app.put("/api/:resource/:id", async (req, res) => {
    const user = await requireSession(req);
    const resourceName = req.params.resource as ResourceName;
    const resource = getResource(resourceName);
    const body: Record<string, unknown> = { ...(req.body as Record<string, unknown>), id: req.params.id };

    if (resourceName === "users") throw httpError(405, "Use PATCH for users");
    if (resourceName === "tickets") throw httpError(405, "Use PATCH for tickets");
    if (resourceName === "messages") await assertTicketAccess(String(body.ticketId ?? ""), user);
    if (resourceName === "ticket-events") throw httpError(403, "Ticket events are read-only");
    if (resourceName === "priority-rules") throw httpError(405, "Use PATCH for priority rules");
    if (resourceName === "response-templates") throw httpError(405, "Use PATCH for response templates");

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

    const previousTicket = resourceName === "tickets" ? await assertTicketAccess(req.params.id, user) : null;
    if (resourceName === "messages") {
        const message = await pool.query("select ticket_id from messages where id = $1", [req.params.id]);
        if (message.rowCount === 0) throw httpError(404, "Not found");
        await assertTicketAccess(String(message.rows[0].ticket_id), user);
    }
    if (resourceName === "ticket-events") throw httpError(403, "Ticket events are read-only");

    if (resourceName === "priority-rules") {
        if (user.role !== "admin") throw httpError(403, "Forbidden");
        body.updatedAt = new Date().toISOString();
        body.updatedBy = user.id;

        if (Object.prototype.hasOwnProperty.call(body, "priority") && !["low", "normal", "high"].includes(String(body.priority))) {
            throw httpError(400, "Invalid priority");
        }
    }

    if (resourceName === "response-templates") {
        if (user.role !== "admin") throw httpError(403, "Forbidden");
        body.updatedAt = new Date().toISOString();
        body.updatedBy = user.id;
    }

    if (resourceName === "tickets") {
        if (user.role === "student") {
            const allowed = new Set(["topic", "type", "priority", "updatedAt", "formData"]);
            for (const key of Object.keys(body)) {
                if (!allowed.has(key)) throw httpError(403, "Students cannot change ticket processing fields");
            }
        } else if (!canManageTickets(user)) {
            throw httpError(403, "Forbidden");
        }

        if (Object.prototype.hasOwnProperty.call(body, "priority") && !["low", "normal", "high"].includes(String(body.priority))) {
            throw httpError(400, "Invalid priority");
        }

        if (Object.prototype.hasOwnProperty.call(body, "status") && !["new", "in_progress", "closed"].includes(String(body.status))) {
            throw httpError(400, "Invalid status");
        }
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

    if (resourceName === "tickets" && previousTicket) {
        const nextTicket = result.rows[0] as Record<string, unknown>;
        const events: Array<{ type: string; message: string; metadata?: Record<string, unknown> }> = [];

        if (previousTicket.status !== nextTicket.status) {
            events.push({
                type: "status_changed",
                message: `Статус изменён: ${previousTicket.status} → ${nextTicket.status}.`,
                metadata: { from: previousTicket.status, to: nextTicket.status },
            });
        }

        if (previousTicket.priority !== nextTicket.priority) {
            events.push({
                type: "priority_changed",
                message: `Приоритет изменён: ${previousTicket.priority ?? "normal"} → ${nextTicket.priority}.`,
                metadata: { from: previousTicket.priority ?? "normal", to: nextTicket.priority },
            });
        }

        if (previousTicket.assigned_to !== nextTicket.assigned_to) {
            const fromName = await getUserName(previousTicket.assigned_to);
            const toName = await getUserName(nextTicket.assigned_to);
            events.push({
                type: "assignee_changed",
                message: `Ответственный изменён: ${fromName} → ${toName}.`,
                metadata: { from: previousTicket.assigned_to, to: nextTicket.assigned_to },
            });
        }

        const formChanged = JSON.stringify(previousTicket.form_data ?? {}) !== JSON.stringify(nextTicket.form_data ?? {});
        if (formChanged || previousTicket.topic !== nextTicket.topic || previousTicket.ticket_type !== nextTicket.ticket_type) {
            events.push({
                type: "ticket_updated",
                message: "Данные обращения обновлены.",
                metadata: { topic: nextTicket.topic, type: nextTicket.ticket_type },
            });
        }

        for (const event of events) {
            await createTicketEvent(req.params.id, user.id, event.type, event.message, event.metadata);
        }
    }
});

app.delete("/api/:resource/:id", async (req, res) => {
    const user = await requireSession(req);
    const resourceName = req.params.resource as ResourceName;
    const resource = getResource(resourceName);

    if (resourceName !== "response-templates") {
        throw httpError(405, "Delete is only supported for response templates");
    }

    if (user.role !== "admin") throw httpError(403, "Forbidden");

    const result = await pool.query(`delete from ${resource.table} where id = $1 returning id`, [req.params.id]);
    if (result.rowCount === 0) throw httpError(404, "Not found");

    res.status(204).send();
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
