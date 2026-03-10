import { db } from "./db"
import { nanoid } from "nanoid"

export const seedDatabase = async () => {
    const count = await db.users.count()
    if (count > 0) return

    const studentId = nanoid()
    const operatorId = nanoid()

    await db.users.bulkAdd([
        { id: studentId, fullName: "Иван Иванов", role: "student" },
        { id: operatorId, fullName: "Оператор 1", role: "operator" }
    ])

    const ticketId = nanoid()

    await db.tickets.add({
        id: ticketId,
        studentId,
        topic: "Материальная помощь",
        type: "Финансы",
        status: "new",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        formData: { amount: 15000 }
    })

    await db.messages.add({
        id: nanoid(),
        ticketId,
        authorId: studentId,
        text: "Здравствуйте, хочу подать заявление.",
        createdAt: new Date().toISOString(),
        isReadByStudent: true,
        isReadByOperator: false
    })
}