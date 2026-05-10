import { db } from "./db";
import type { User, UserRole } from "./db";
import { hashPassword } from "../lib/crypto";

export const seedDatabase = async () => {
    const count = await db.users.count();
    if (count > 0) return;

    const now = new Date().toISOString();

    const mkUser = async (fullName: string, email: string, role: UserRole, password: string): Promise<User> => {
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

    const student = await mkUser("Иван Иванов", "student@stankin.ru", "student", "123456");
    const operator = await mkUser("Оператор 1", "operator@stankin.ru", "operator", "123456");

    await db.users.bulkAdd([student, operator]);

    const ticketId = crypto.randomUUID();

    await db.tickets.add({
        id: ticketId,
        studentId: student.id,
        topic: "Материальная помощь",
        type: "Финансы",
        status: "new",
        createdAt: now,
        updatedAt: now,
        formData: { amount: 15000 },
    });

    await db.messages.add({
        id: crypto.randomUUID(),
        ticketId,
        authorId: student.id,
        text: "Здравствуйте, хочу подать заявление.",
        createdAt: now,
        isReadByStudent: true,
        isReadByOperator: false,
    });
};
