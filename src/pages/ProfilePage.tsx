import { useEffect, useState } from "react";
import { db, type User } from "../db/db";
import { useAuth } from "../features/auth/store";
import "../styles/profile-page.css";

const ProfilePage = () => {
    const userId = useAuth((s) => s.userId)!;

    const [user, setUser] = useState<User | null>(null);
    const [busy, setBusy] = useState(false);
    const [edsBusy, setEdsBusy] = useState(false);

    const [studentCard, setStudentCard] = useState("");
    const [studyForm, setStudyForm] = useState<User["studyForm"]>("Очная");
    const [group, setGroup] = useState("");
    const [course, setCourse] = useState("");
    const [educationLevel, setEducationLevel] = useState("");

    const loadUser = async () => {
        const data = await db.users.get(userId);
        setUser(data ?? null);

        if (data) {
            setStudentCard(data.studentCard ?? "");
            setStudyForm(data.studyForm ?? "Очная");
            setGroup(data.group ?? "");
            setCourse(data.course ?? "");
            setEducationLevel(data.educationLevel ?? "");
        }
    };

    useEffect(() => {
        void loadUser();
    }, [userId]);

    const handleSaveProfile = async () => {
        if (!user) return;

        setBusy(true);
        try {
            await db.users.update(user.id, {
                studentCard: studentCard.trim(),
                studyForm,
                group: group.trim(),
                course: course.trim(),
                educationLevel: educationLevel.trim(),
            });

            await loadUser();
        } finally {
            setBusy(false);
        }
    };

    const handleConnectEds = async () => {
        if (!user) return;

        setEdsBusy(true);
        try {
            // Демо-подключение подписи заявления для дипломного проекта.
            const now = new Date().toISOString();

            await db.users.update(user.id, {
                edsEnabled: true,
                edsCertificateName: `Демо-ключ подписи ${user.fullName}`,
                edsCertificateSerial: `DEMO-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
                edsConnectedAt: now,
            });

            await loadUser();
        } finally {
            setEdsBusy(false);
        }
    };

    const handleDisconnectEds = async () => {
        if (!user) return;

        setEdsBusy(true);
        try {
            await db.users.update(user.id, {
                edsEnabled: false,
                edsCertificateName: "",
                edsCertificateSerial: "",
                edsConnectedAt: "",
            });

            await loadUser();
        } finally {
            setEdsBusy(false);
        }
    };

    if (!user) {
        return (
            <div className="profile-page">
                <div className="profile-card">Загрузка профиля...</div>
            </div>
        );
    }

    return (
        <div className="profile-page">
            <div className="profile-layout">
                <section className="profile-card">
                    <div className="profile-card__head">
                        <div>
                            <h1 className="profile-title">Личный кабинет</h1>
                            <div className="profile-subtitle">
                                Информация о пользователе и настройка демо-подписи заявления
                            </div>
                        </div>
                    </div>

                    <div className="profile-grid">
                        <label className="profile-field">
                            <span className="profile-label">ФИО</span>
                            <input
                                className="profile-input"
                                value={user.fullName}
                                disabled
                            />
                        </label>

                        <label className="profile-field">
                            <span className="profile-label">Электронная почта</span>
                            <input
                                className="profile-input"
                                value={user.email}
                                disabled
                            />
                        </label>

                        <label className="profile-field">
                            <span className="profile-label">Роль</span>
                            <input
                                className="profile-input"
                                value={
                                    user.role === "student"
                                        ? "Студент"
                                        : user.role === "operator"
                                        ? "Оператор"
                                        : "Администратор"
                                }
                                disabled
                            />
                        </label>

                        <label className="profile-field">
                            <span className="profile-label">Номер студенческого билета</span>
                            <input
                                className="profile-input"
                                value={studentCard}
                                onChange={(e) => setStudentCard(e.target.value)}
                                placeholder="Например: 123456"
                                disabled={user.role !== "student"}
                            />
                        </label>

                        <label className="profile-field">
                            <span className="profile-label">Форма обучения</span>
                            <select
                                className="profile-input"
                                value={studyForm ?? "Очная"}
                                onChange={(e) => setStudyForm(e.target.value as User["studyForm"])}
                                disabled={user.role !== "student"}
                            >
                                <option value="Очная">Очная</option>
                                <option value="Очно-заочная">Очно-заочная</option>
                                <option value="Заочная">Заочная</option>
                            </select>
                        </label>

                        <label className="profile-field">
                            <span className="profile-label">Группа</span>
                            <input
                                className="profile-input"
                                value={group}
                                onChange={(e) => setGroup(e.target.value)}
                                placeholder="Например: ИДБ-22-11"
                                disabled={user.role !== "student"}
                            />
                        </label>

                        <label className="profile-field">
                            <span className="profile-label">Курс</span>
                            <input
                                className="profile-input"
                                value={course}
                                onChange={(e) => setCourse(e.target.value)}
                                placeholder="Например: 4"
                                disabled={user.role !== "student"}
                            />
                        </label>

                        <label className="profile-field">
                            <span className="profile-label">Уровень образования</span>
                            <input
                                className="profile-input"
                                value={educationLevel}
                                onChange={(e) => setEducationLevel(e.target.value)}
                                placeholder="Например: Бакалавриат"
                                disabled={user.role !== "student"}
                            />
                        </label>
                    </div>

                    {user.role === "student" && (
                        <div className="profile-actions">
                            <button
                                type="button"
                                className="profile-btn profile-btn--primary"
                                onClick={handleSaveProfile}
                                disabled={busy}
                            >
                                {busy ? "Сохраняем..." : "Сохранить данные"}
                            </button>
                        </div>
                    )}
                </section>

                <section className="profile-card">
                    <div className="profile-card__head">
                        <div>
                            <h2 className="profile-section-title">Демо-подпись заявления</h2>
                            <div className="profile-subtitle">
                                Учебная модель подписи для подтверждения отправки заявлений в рамках дипломного проекта
                            </div>
                        </div>

                        <span
                            className={`profile-status ${
                                user.edsEnabled ? "profile-status--ok" : "profile-status--off"
                            }`}
                        >
                            {user.edsEnabled ? "Подключена" : "Не подключена"}
                        </span>
                    </div>

                    <div className="profile-eds">
                        <div className="profile-eds__item">
                            <div className="profile-eds__label">Статус</div>
                            <div className="profile-eds__value">
                                {user.edsEnabled
                                    ? "Демо-подпись активна"
                                    : "Демо-подпись ещё не подключена"}
                            </div>
                        </div>

                        <div className="profile-eds__item">
                            <div className="profile-eds__label">Ключ подписи</div>
                            <div className="profile-eds__value">
                                {user.edsCertificateName || "Нет данных"}
                            </div>
                        </div>

                        <div className="profile-eds__item">
                            <div className="profile-eds__label">Серийный номер</div>
                            <div className="profile-eds__value">
                                {user.edsCertificateSerial || "Нет данных"}
                            </div>
                        </div>

                        <div className="profile-eds__item">
                            <div className="profile-eds__label">Дата подключения</div>
                            <div className="profile-eds__value">
                                {user.edsConnectedAt
                                    ? new Date(user.edsConnectedAt).toLocaleString("ru-RU")
                                    : "Нет данных"}
                            </div>
                        </div>
                    </div>

                    <div className="profile-note">
                        В прототипе используется демонстрационная модель подписи на базе Web Crypto API.
                        Она показывает принцип подписания и проверки целостности заявления, но не является
                        юридически значимой квалифицированной электронной подписью.
                    </div>

                    <div className="profile-actions">
                        {!user.edsEnabled ? (
                            <button
                                type="button"
                                className="profile-btn profile-btn--primary"
                                onClick={handleConnectEds}
                                disabled={edsBusy}
                            >
                                {edsBusy ? "Подключаем..." : "Подключить демо-подпись"}
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="profile-btn profile-btn--ghost"
                                onClick={handleDisconnectEds}
                                disabled={edsBusy}
                            >
                                {edsBusy ? "Отключаем..." : "Отключить демо-подпись"}
                            </button>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default ProfilePage;
