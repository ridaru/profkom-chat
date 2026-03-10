import { useEffect, useState } from "react";
import { db, type Ticket, type UserRole } from "../db/db";
import "../styles/ticket-list.css";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

type Props = {
    tickets: Ticket[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    currentUserId: string;
    role: UserRole;
};

const statusRu: Record<Ticket["status"], string> = {
    new: "Новое",
    in_progress: "В работе",
    need_info: "Нужна инфо",
    closed: "Закрыто",
};

const TicketRow = ({
                       t,
                       active,
                       onClick,
                       role,
                   }: {
    t: Ticket;
    active: boolean;
    onClick: () => void;
    role: UserRole;
}) => {
    const [unread, setUnread] = useState<number>(0);

    useEffect(() => {
        let alive = true;

        const loadUnread = async () => {
            // Для студента: непрочитано то, что isReadByStudent === false
            // Для оператора: isReadByOperator === false (потом пригодится на operator page)
            const count = await db.messages
                .where("ticketId")
                .equals(t.id)
                .filter((m) => (role === "student" ? !m.isReadByStudent : !m.isReadByOperator))
                .count();

            if (alive) setUnread(count);
        };

        void loadUnread();
        return () => {
            alive = false;
        };
    }, [t.id, t.updatedAt, role]);

    return (
        <button
            type="button"
            className={`ticket-row ${active ? "ticket-row--active" : ""}`}
            onClick={onClick}
        >
            <div className="ticket-row__top">
                <div className="ticket-row__topic">{t.topic}</div>

                <div className="ticket-row__badges">
                    {unread > 0 && <span className="badge badge--unread">{unread}</span>}
                    <span className={`badge badge--status badge--${t.status}`}>{statusRu[t.status]}</span>
                </div>
            </div>

            <div className="ticket-row__meta">
                <span className="ticket-row__type">{t.type}</span>
                <span className="ticket-row__date">
          {format(new Date(t.updatedAt), "dd.MM.yyyy HH:mm", { locale: ru })}
        </span>
            </div>
        </button>
    );
};

const TicketList = ({ tickets, selectedId, onSelect, role }: Props) => {
    return (
        <div className="ticket-list">
            {tickets.length === 0 ? (
                <div className="ticket-list__empty">Пока нет обращений</div>
            ) : (
                tickets.map((t) => (
                    <TicketRow
                        key={t.id}
                        t={t}
                        active={t.id === selectedId}
                        onClick={() => onSelect(t.id)}
                        role={role}
                    />
                ))
            )}
        </div>
    );
};

export default TicketList;