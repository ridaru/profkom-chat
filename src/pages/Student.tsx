import { useEffect, useMemo, useState } from "react";
import { db, type Ticket, type User } from "../db/db";
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

    const selectedTicket = useMemo(
        () => tickets.find((t) => t.id === selectedId) ?? null,
        [tickets, selectedId]
    );

    const reloadTickets = async () => {
        const data = await db.tickets.where("studentId").equals(userId).toArray();
        data.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
        setTickets(data);

        if (!selectedId && data.length > 0) setSelectedId(data[0].id);
        if (selectedId && data.length > 0 && !data.some((t) => t.id === selectedId)) setSelectedId(data[0].id);
        if (data.length === 0) setSelectedId(null);
    };

    useEffect(() => {
        const load = async () => {
            const u = await db.users.get(userId);
            setMe(u ?? null);
            await reloadTickets();
        };
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    return (
        <div className="student-page">
            <aside className="student-page__left">
                <div className="student-page__leftHeader">
                    <div className="student-page__title">
                        <h1 className="student-page__h1">Мои обращения</h1>
                        {me && <div className="student-page__sub">Вы вошли как: {me.fullName}</div>}
                    </div>

                    <button className="sp-new" onClick={() => setCreateOpen(true)}>
                        <span className="sp-new__plus" aria-hidden>+</span>
                        Новое обращение
                    </button>
                </div>

                <TicketList
                    tickets={tickets}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    currentUserId={userId}
                    role="student"
                />
            </aside>

            <section className="student-page__right">
                {selectedTicket ? (
                    <TicketDetails
                        ticketId={selectedTicket.id}
                        currentUserId={userId}
                        role="student"
                        onChanged={reloadTickets}
                    />
                ) : (
                    <div className="student-page__empty">
                        <div className="student-page__emptyCard">
                            <h2>Нет обращений</h2>
                            <p>Нажмите “Новое”, чтобы создать обращение.</p>
                        </div>
                    </div>
                )}
            </section>

            <CreateTicketModal
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                currentUserId={userId}
                onCreated={(id) => {
                    setSelectedId(id);
                    void reloadTickets();
                }}
            />
        </div>
    );
};

export default StudentPage;