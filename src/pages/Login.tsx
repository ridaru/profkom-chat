import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, seedDatabase } from "../db/db";
import { verifyPassword } from "../lib/crypto";
import { useAuth } from "../features/auth/store";
import "../styles/auth.css";

const LoginPage = () => {
    const navigate = useNavigate();
    const login = useAuth((s) => s.login);

    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");

    const [boot, setBoot] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            try {
                await seedDatabase();
            } finally {
                setBoot(false);
            }
        };
        void init();
    }, []);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const loginValue = identifier.toLowerCase().trim();
            const user = loginValue.includes("@")
                ? await db.users.where("email").equals(loginValue).first()
                : await db.users.where("studentCard").equals(loginValue).first();

            if (!user) {
                setError("Пользователь не найден");
                return;
            }

            const ok = await verifyPassword(password, user.passSaltB64, user.passHashB64);
            if (!ok) {
                setError("Неверный пароль");
                return;
            }

            login(user.id);
            navigate("/app");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Ошибка входа");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth">
            <div className="auth__card">
                <div className="auth__head">
                    <div className="auth__title">Вход</div>
                    <div className="auth__subtitle">
                        Авторизация доступна только студентам и сотрудникам МГТУ «СТАНКИН»
                    </div>
                </div>

                {boot ? (
                    <div className="auth__subtitle">Инициализация…</div>
                ) : (
                    <form className="auth__form" onSubmit={onSubmit}>
                        <label className="auth__label">
                            Email или номер студенческого билета
                            <input
                                className="auth__input"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                autoComplete="username"
                                placeholder="Email или номер студенческого билета"
                            />
                        </label>

                        <label className="auth__label">
                            Пароль
                            <input
                                className="auth__input"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                                placeholder="••••••••"
                            />
                        </label>

                        {error && <div className="auth__error">{error}</div>}

                        <button className="auth__btn" disabled={loading}>
                            {loading ? "Входим…" : "Войти"}
                        </button>

                    </form>
                )}
            </div>
        </div>
    );
};

export default LoginPage;
