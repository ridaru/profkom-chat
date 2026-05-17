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
