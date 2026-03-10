import Dexie from "dexie";
import type { Table } from "dexie";
import { hashPassword } from "../lib/crypto";

export type UserRole = "student" | "operator" | "admin";

export interface User {
    id: string;
    fullName: string;
    email: string;
    role: UserRole;

    passSaltB64: string;
    passHashB64: string;

    createdAt: string;

    // профиль
    studentCard?: string;
    studyForm?: "Очная" | "Очно-заочная" | "Заочная";
    group?: string;

    // ЭЦП (демо-модель)
    edsEnabled?: boolean;
    edsCertificateName?: string;
    edsCertificateSerial?: string;
    edsConnectedAt?: string;
}

export type TicketStatus = "new" | "in_progress" | "need_info" | "closed";

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

export class AppDB extends Dexie {
    users!: Table<User, string>;
    tickets!: Table<Ticket, string>;
    messages!: Table<Message, string>;

    constructor() {
        super("ProfkomSupportDB");

        // v2 — текущая версия
        this.version(2).stores({
            users: "id, email, role, fullName, createdAt",
            tickets: "id, studentId, status, updatedAt, createdAt",
            messages: "id, ticketId, createdAt, authorId",
        });
    }
}

export const db = new AppDB();

/** создаём 2 служебных аккаунта + демо-студента */
export async function seedDatabase() {
    const count = await db.users.count();
    if (count > 0) return;

    const now = new Date().toISOString();

    const mkUser = async (
        fullName: string,
        email: string,
        role: UserRole,
        password: string
    ): Promise<User> => {
        const { saltB64, hashB64 } = await hashPassword(password);
        return {
            id: crypto.randomUUID(),
            fullName,
            email: email.toLowerCase().trim(),
            role,
            passSaltB64: saltB64,
            passHashB64: hashB64,
            createdAt: now,
        };
    };

    const operator = await mkUser("Оператор 1", "operator@stankin.ru", "operator", "123456");
    const admin = await mkUser("Админ", "admin@stankin.ru", "admin", "123456");
    const student = await mkUser("Иван Иванов", "student@stankin.ru", "student", "123456");

    await db.users.bulkAdd([operator, admin, student]);
}