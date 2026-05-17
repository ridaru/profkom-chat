export type UserRole = "student" | "operator" | "admin";

export interface User {
    id: string;
    fullName: string;
    email: string;
    role: UserRole;
    createdAt: string;
    studentCard?: string;
    studyForm?: string;
    group?: string;
    course?: string;
    educationLevel?: string;
    edsEnabled?: boolean;
    edsCertificateName?: string;
    edsCertificateSerial?: string;
    edsConnectedAt?: string;
}

export type TicketStatus = "new" | "in_progress" | "closed";

export interface Ticket {
    id: string;
    studentId: string;
    topic: string;
    type: string;
    status: TicketStatus;
    createdAt: string;
    updatedAt: string;
    assignedTo?: string;
    formData: unknown;
}

export interface Message {
    id: string;
    ticketId: string;
    authorId: string;
    text: string;
    createdAt: string;
    isReadByStudent: boolean;
    isReadByOperator: boolean;
}

type ResourceName = "users" | "tickets" | "messages";
type Filter<T> = (item: T) => boolean;

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
        ...init,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...init?.headers,
        },
    });

    if (response.status === 404 && (!init?.method || init.method === "GET")) {
        return undefined as T;
    }

    if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? `API request failed: ${response.status}`);
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
}

class QueryApi<T extends { id: string }> {
    private readonly table: TableApi<T>;
    private readonly field: keyof T;
    private readonly value: unknown;
    private readonly filters: Filter<T>[];

    constructor(
        table: TableApi<T>,
        field: keyof T,
        value: unknown,
        filters: Filter<T>[] = [],
    ) {
        this.table = table;
        this.field = field;
        this.value = value;
        this.filters = filters;
    }

    filter(predicate: Filter<T>) {
        return new QueryApi(this.table, this.field, this.value, [...this.filters, predicate]);
    }

    async toArray() {
        const items = await this.table.list({ [this.field]: this.value });
        return this.filters.reduce((current, predicate) => current.filter(predicate), items);
    }

    async first() {
        const [item] = await this.toArray();
        return item;
    }

    async count() {
        return (await this.toArray()).length;
    }
}

class WhereApi<T extends { id: string }> {
    private readonly table: TableApi<T>;
    private readonly field: keyof T;

    constructor(table: TableApi<T>, field: keyof T) {
        this.table = table;
        this.field = field;
    }

    equals(value: unknown) {
        return new QueryApi(this.table, this.field, value);
    }
}

class TableApi<T extends { id: string }> {
    private readonly resource: ResourceName;

    constructor(resource: ResourceName) {
        this.resource = resource;
    }

    async list(params: Record<string, unknown> = {}) {
        const query = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) query.set(key, String(value));
        });

        const suffix = query.size > 0 ? `?${query.toString()}` : "";
        return api<T[]>(`/${this.resource}${suffix}`);
    }

    async toArray() {
        return this.list();
    }

    async get(id: string) {
        return api<T | undefined>(`/${this.resource}/${encodeURIComponent(id)}`);
    }

    where(field: keyof T) {
        return new WhereApi(this, field);
    }

    async count() {
        return (await this.toArray()).length;
    }

    async add(item: T) {
        return api<T>(`/${this.resource}`, {
            method: "POST",
            body: JSON.stringify(item),
        });
    }

    async bulkAdd(items: T[]) {
        await Promise.all(items.map((item) => this.add(item)));
    }

    async put(item: T) {
        return api<T>(`/${this.resource}/${encodeURIComponent(item.id)}`, {
            method: "PUT",
            body: JSON.stringify(item),
        });
    }

    async bulkPut(items: T[]) {
        await Promise.all(items.map((item) => this.put(item)));
    }

    async update(id: string, patch: Partial<T>) {
        return api<T>(`/${this.resource}/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: JSON.stringify(patch),
        });
    }
}

export const db = {
    users: new TableApi<User>("users"),
    tickets: new TableApi<Ticket>("tickets"),
    messages: new TableApi<Message>("messages"),
};

export async function seedDatabase() {
    return Promise.resolve();
}
