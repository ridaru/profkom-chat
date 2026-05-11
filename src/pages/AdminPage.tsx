import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { db, type User, type UserRole } from "../db/db";
import { useAuth } from "../features/auth/store";
import "../styles/admin-page.css";

const roleLabels: Record<UserRole, string> = {
    student: "Студент",
    operator: "Оператор",
    admin: "Администратор",
};

const staffRoles: UserRole[] = ["operator", "admin"];

export default function AdminPage() {
    const userId = useAuth((s) => s.userId)!;

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [me, allUsers] = await Promise.all([
                db.users.get(userId),
                db.users.toArray(),
            ]);

            setCurrentUser(me ?? null);
            setUsers(allUsers);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const filteredUsers = useMemo(() => {
        const value = query.toLowerCase().trim();
        if (!value) return users;

        return users.filter((user) => {
            return (
                user.fullName.toLowerCase().includes(value) ||
                user.email.toLowerCase().includes(value) ||
                roleLabels[user.role].toLowerCase().includes(value)
            );
        });
    }, [query, users]);

    const staffCount = users.filter((user) => staffRoles.includes(user.role)).length;

    const handleRoleChange = async (targetUser: User, role: UserRole) => {
        setMessage(null);
        setSavingId(targetUser.id);

        try {
            await db.users.update(targetUser.id, { role });
            setUsers((current) => {
                return current.map((user) => (
                    user.id === targetUser.id ? { ...user, role } : user
                ));
            });

            if (targetUser.id === userId) {
                setCurrentUser((user) => (user ? { ...user, role } : user));
            }

            setMessage(`Роль пользователя ${targetUser.fullName} обновлена`);
        } finally {
            setSavingId(null);
        }
    };

    if (loading) {
        return (
            <div className="admin-page">
                <section className="admin-panel">Загрузка административной панели...</section>
            </div>
        );
    }

    if (currentUser?.role !== "admin") {
        return <Navigate to="/app" replace />;
    }

    return (
        <div className="admin-page">
            <section className="admin-panel">
                <div className="admin-panel__head">
                    <div>
                        <h1 className="admin-title">Административная панель</h1>
                        <div className="admin-subtitle">
                            Управление сотрудниками профкома и административными правами
                        </div>
                    </div>

                    <div className="admin-stats">
                        <div className="admin-stat">
                            <span className="admin-stat__value">{users.length}</span>
                            <span className="admin-stat__label">Пользователей</span>
                        </div>
                        <div className="admin-stat">
                            <span className="admin-stat__value">{staffCount}</span>
                            <span className="admin-stat__label">Сотрудников</span>
                        </div>
                    </div>
                </div>

                <div className="admin-toolbar">
                    <input
                        className="admin-search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Поиск по ФИО, email или роли"
                    />

                    {message && <div className="admin-message">{message}</div>}
                </div>

                <div className="admin-tableWrap">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Пользователь</th>
                                <th>Email</th>
                                <th>Текущая роль</th>
                                <th>Назначить роль</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user) => (
                                <tr key={user.id}>
                                    <td>
                                        <div className="admin-user">
                                            <span className="admin-avatar">
                                                {user.fullName.slice(0, 1).toUpperCase()}
                                            </span>
                                            <span className="admin-user__name">{user.fullName}</span>
                                        </div>
                                    </td>
                                    <td>{user.email}</td>
                                    <td>
                                        <span className={`admin-role admin-role--${user.role}`}>
                                            {roleLabels[user.role]}
                                        </span>
                                    </td>
                                    <td>
                                        <select
                                            className="admin-roleSelect"
                                            value={user.role}
                                            onChange={(event) => {
                                                void handleRoleChange(user, event.target.value as UserRole);
                                            }}
                                            disabled={savingId === user.id}
                                        >
                                            <option value="student">Студент</option>
                                            <option value="operator">Оператор профкома</option>
                                            <option value="admin">Администратор</option>
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredUsers.length === 0 && (
                        <div className="admin-empty">Пользователи не найдены</div>
                    )}
                </div>
            </section>
        </div>
    );
}
