import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { db, type TicketAnalytics, type User } from "../db/db";
import { useAuth } from "../features/auth/store";
import "../styles/analytics-page.css";

const statusLabels: Record<string, string> = {
    new: "Новые",
    in_progress: "В работе",
    closed: "Закрытые",
};

const priorityLabels: Record<string, string> = {
    low: "Низкий",
    normal: "Обычный",
    high: "Высокий",
};

function formatDuration(seconds: number | null) {
    if (seconds === null || Number.isNaN(seconds)) return "Нет данных";
    if (seconds < 60) return `${Math.round(seconds)} сек.`;

    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} мин.`;

    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} ч.`;

    const days = Math.round(hours / 24);
    return `${days} дн.`;
}

function labelFor(kind: "status" | "priority" | "plain", value: string) {
    if (kind === "status") return statusLabels[value] ?? value;
    if (kind === "priority") return priorityLabels[value] ?? value;
    return value;
}

function BucketList({
    title,
    items,
    kind = "plain",
}: {
    title: string;
    items: TicketAnalytics["byTopic"];
    kind?: "status" | "priority" | "plain";
}) {
    const max = Math.max(1, ...items.map((item) => item.count));

    return (
        <section className="analytics-block">
            <h2>{title}</h2>
            {items.length === 0 ? (
                <div className="analytics-empty">Нет данных</div>
            ) : (
                <div className="analytics-bars">
                    {items.map((item) => (
                        <div className="analytics-bar" key={item.label}>
                            <div className="analytics-bar__top">
                                <span>{labelFor(kind, item.label)}</span>
                                <b>{item.count}</b>
                            </div>
                            <div className="analytics-bar__track">
                                <span style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

export default function AnalyticsPage() {
    const userId = useAuth((s) => s.userId)!;
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [analytics, setAnalytics] = useState<TicketAnalytics | null>(null);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const me = await db.users.get(userId);
            setCurrentUser(me ?? null);

            if (me?.role === "operator" || me?.role === "admin") {
                setAnalytics(await db.analytics.tickets());
            }
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const stats = useMemo(() => {
        if (!analytics) return [];

        return [
            { label: "Всего обращений", value: analytics.summary.total },
            { label: "Новые", value: analytics.summary.new },
            { label: "В работе", value: analytics.summary.inProgress },
            { label: "Закрытые", value: analytics.summary.closed },
            { label: "Первичный ответ", value: formatDuration(analytics.timings.avgFirstResponseSeconds) },
            { label: "Закрытие обращения", value: formatDuration(analytics.timings.avgCloseSeconds) },
        ];
    }, [analytics]);

    if (loading) {
        return (
            <div className="analytics-page">
                <section className="analytics-panel">Загрузка аналитики...</section>
            </div>
        );
    }

    if (currentUser?.role !== "operator" && currentUser?.role !== "admin") {
        return <Navigate to="/app" replace />;
    }

    if (!analytics) {
        return (
            <div className="analytics-page">
                <section className="analytics-panel">Аналитика недоступна.</section>
            </div>
        );
    }

    return (
        <div className="analytics-page">
            <section className="analytics-panel">
                <div className="analytics-head">
                    <div>
                        <h1>Аналитика обращений</h1>
                        <p>Сводка по статусам, темам, приоритетам и нагрузке сотрудников профкома.</p>
                    </div>
                    <button type="button" className="analytics-refresh" onClick={() => void loadData()}>
                        Обновить
                    </button>
                </div>

                <div className="analytics-stats">
                    {stats.map((item) => (
                        <div className="analytics-stat" key={item.label}>
                            <span>{item.label}</span>
                            <b>{item.value}</b>
                        </div>
                    ))}
                </div>

                <div className="analytics-grid">
                    <BucketList title="По статусам" items={analytics.byStatus} kind="status" />
                    <BucketList title="По приоритетам" items={analytics.byPriority} kind="priority" />
                    <BucketList title="По темам" items={analytics.byTopic} />
                    <BucketList title="Нагрузка по ответственным" items={analytics.workload} />
                </div>
            </section>
        </div>
    );
}
