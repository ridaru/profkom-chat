import { useEffect, useMemo, useState } from "react";
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
    closed: "Закрыто",
};

type StatusFilter = "all" | Ticket["status"];

const statusFilters: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "Все" },
    { value: "new", label: "Новые" },
    { value: "in_progress", label: "В работе" },
];

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
    }, [t.id, t.updatedAt, role, active]);

    useEffect(() => {
        if (!active || unread === 0) return;

        const timer = window.setTimeout(() => setUnread(0), 1200);
        return () => window.clearTimeout(timer);
    }, [active, unread]);

    return (
        <button
            type="button"
            className={`ticket-row ${active ? "ticket-row--active" : ""} ${unread > 0 ? "ticket-row--unread" : ""}`}
            onClick={onClick}
        >
            <div className="ticket-row__top">
                <div className="ticket-row__topic">{t.topic}</div>

                <div className="ticket-row__badges">
                    {unread > 0 && <span className="badge badge--unread">{unread}</span>}
                    <span className={`badge badge--status badge--${t.status}`}>
                        {statusRu[t.status]}
                    </span>
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
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

    const filteredTickets = useMemo(() => {
        const query = search.trim().toLowerCase();

        return tickets.filter((t) => {
            const matchesStatus =
                statusFilter === "all" ? true : t.status === statusFilter;

            const matchesSearch =
                query === ""
                    ? true
                    : t.topic.toLowerCase().includes(query) ||
                      t.type.toLowerCase().includes(query) ||
                      statusRu[t.status].toLowerCase().includes(query);

            return matchesStatus && matchesSearch;
        });
    }, [tickets, search, statusFilter]);

    return (
        <div className="ticket-list-wrap">
            <div className="ticket-list-toolbar">
                <div className="ticket-list-search">
                    <svg
                        className="ticket-list-search__icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                    >
                        <path
                            d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                        <path
                            d="M16.2 16.2 21 21"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                    </svg>

                    <input
                        type="text"
                        className="ticket-list-search__input"
                        placeholder="Поиск обращений"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="ticket-list-filters">
                    {statusFilters.map((item) => (
                        <button
                            key={item.value}
                            type="button"
                            className={`ticket-list-filter ${
                                statusFilter === item.value ? "ticket-list-filter--active" : ""
                            }`}
                            onClick={() => setStatusFilter(item.value)}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="ticket-list">
                {filteredTickets.length === 0 ? (
                    <div className="ticket-list__empty">По вашему запросу ничего не найдено</div>
                ) : (
                    filteredTickets.map((t) => (
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
        </div>
    );
};

export default TicketList;
