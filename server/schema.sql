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
