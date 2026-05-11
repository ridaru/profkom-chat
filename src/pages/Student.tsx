import { useEffect, useMemo, useState } from "react";
import { db, type Ticket, type User, type UserRole } from "../db/db";
import { useAuth } from "../features/auth/store";
import TicketList from "../components/TicketList";
import TicketDetails from "../components/TicketDetails";
import CreateTicketModal from "../components/CreateTicketModal";
import "../styles/student-page.css";

const StudentPage = () => {
    const userId = useAuth((s) => s.userId)!;

    const [me, setMe] = useState<User | null>(null);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [viewMode, setViewMode] = useState<"active" | "archive">("active");
    const [unreadTotal, setUnreadTotal] = useState(0);

    const role: UserRole | null = me?.role ?? null;
    const isStudent = role === "student";

    const visibleTickets = useMemo(
        () => tickets.filter((ticket) => (
            viewMode === "archive" ? ticket.status === "closed" : ticket.status !== "closed"
        )),
        [tickets, viewMode]
    );

    const effectiveSelectedId = useMemo(() => {
        if (selectedId && visibleTickets.some((ticket) => ticket.id === selectedId)) {
            return selectedId;
        }

        return visibleTickets[0]?.id ?? null;
    }, [selectedId, visibleTickets]);

    const selectedTicket = useMemo(
        () => visibleTickets.find((t) => t.id === effectiveSelectedId) ?? null,
        [visibleTickets, effectiveSelectedId]
    );

    const reloadTickets = async (userRole: UserRole | null) => {
        let data: Ticket[] = [];

        if (userRole === "student") {
            data = await db.tickets.where("studentId").equals(userId).toArray();
        } else {
            data = await db.tickets.toArray();
        }

        data.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
        setTickets(data);

        const unreadCounts = await Promise.all(
            data.map(async (ticket) => {
                return db.messages
                    .where("ticketId")
                    .equals(ticket.id)
                    .filter((message) => (
                        userRole === "student"
                            ? !message.isReadByStudent
                            : !message.isReadByOperator
                    ))
                    .count();
            })
        );
        setUnreadTotal(unreadCounts.reduce((sum, count) => sum + count, 0));
    };

    useEffect(() => {
        const load = async () => {
            const u = await db.users.get(userId);
            setMe(u ?? null);
            await reloadTickets(u?.role ?? null);
        };

        void load();
    }, [userId]);

    return (
        <div className="student-page">
            <aside className="student-page__left">
                <div className="student-page__leftHeader">
                    <button
                        type="button"
                        className={`student-page__h1Btn ${viewMode === "active" ? "student-page__h1Btn--active" : ""}`}
                        onClick={() => setViewMode("active")}
                    >
                        {viewMode === "archive" ? "Архив" : "Обращения"}
                        {unreadTotal > 0 && (
                            <span className="student-page__unread">{unreadTotal}</span>
                        )}
                    </button>

                    <button
                        type="button"
                        className={`student-page__archiveBtn ${viewMode === "archive" ? "student-page__archiveBtn--active" : ""}`}
                        onClick={() => setViewMode(viewMode === "archive" ? "active" : "archive")}
                        aria-label={viewMode === "archive" ? "Вернуться к обращениям" : "Архив обращений"}
                        title={viewMode === "archive" ? "Вернуться к обращениям" : "Архив обращений"}
                    >
                        {viewMode === "archive" ? (
                            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path
                                    d="M15 6 9 12l6 6M10 12h10"
                                    stroke="currentColor"
                                    strokeWidth="1.9"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        ) : (
                            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path
                                    d="M4.5 8.5h15m-13 0V18a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2V8.5m-11 0L8 4.75A1.3 1.3 0 0 1 9.2 4h5.6a1.3 1.3 0 0 1 1.2.75l1.5 3.75M9.5 12h5"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        )}
                    </button>

                    {isStudent && (
                        <button
                            className="sp-new"
                            type="button"
                            onClick={() => setCreateOpen(true)}
                        >
                            <span className="sp-new__plus" aria-hidden>+</span>
                            Новое обращение
                        </button>
                    )}
                </div>

                <TicketList
                    key={viewMode}
                    tickets={visibleTickets}
                    selectedId={effectiveSelectedId}
                    onSelect={setSelectedId}
                    currentUserId={userId}
                    role={role ?? "student"}
                />
            </aside>

            <section className="student-page__right">
                {selectedTicket ? (
                    <TicketDetails
                        ticketId={selectedTicket.id}
                        currentUserId={userId}
                        role={role ?? "student"}
                        onChanged={() => reloadTickets(role)}
                    />
                ) : (
                    <div className="student-page__empty">
                        <div className="student-page__emptyCard">
                            <span className="student-page__h1">Нет обращений</span>
                            <p>
                                {isStudent
                                    ? "Нажмите «Новое обращение», чтобы создать обращение."
                                    : viewMode === "archive"
                                    ? "Архив закрытых обращений пуст."
                                    : "Список обращений пуст."}
                            </p>
                        </div>
                    </div>
                )}
            </section>

            {isStudent && (
                <CreateTicketModal
                    open={createOpen}
                    onClose={() => setCreateOpen(false)}
                    currentUserId={userId}
                    onCreated={(id) => {
                        setViewMode("active");
                        setSelectedId(id);
                        void reloadTickets(role);
                    }}
                />
            )}
        </div>
    );
};

export default StudentPage;
