import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db, type User } from "../db/db";
import { hashPassword } from "../lib/crypto";
import "../styles/auth.css";

const RegisterPage = () => {
    const navigate = useNavigate();

    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [pass1, setPass1] = useState("");
    const [pass2, setPass2] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const eNorm = email.toLowerCase().trim();
        if (!fullName.trim()) return setError("Введите ФИО");
        if (!eNorm.includes("@")) return setError("Введите корректный email");
        if (pass1.length < 6) return setError("Пароль минимум 6 символов");
        if (pass1 !== pass2) return setError("Пароли не совпадают");

        setLoading(true);
        try {
            const exists = await db.users.where("email").equals(eNorm).count();
            if (exists > 0) {
                setError("Email уже зарегистрирован");
                return;
            }

            const { saltB64, hashB64 } = await hashPassword(pass1);

            const user: User = {
                id: crypto.randomUUID(),
                fullName: fullName.trim(),
                email: eNorm,
                role: "student", // регистрируем только студентов
                passSaltB64: saltB64,
                passHashB64: hashB64,
                createdAt: new Date().toISOString(),
            };

            await db.users.add(user);
            navigate("/login");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Ошибка регистрации");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="container auth-grid">
                <div className="auth-card">
                    <div className="auth-head">
                        <div className="auth-mark auth-mark--alt" aria-hidden />
                        <div>
                            <div className="auth-title">Регистрация</div>
                            <div className="auth-subtitle">только для студентов</div>
                        </div>
                    </div>

                    <form className="auth-form" onSubmit={onSubmit}>
                        <label className="auth-label">
                            ФИО
                            <input
                                className="auth-input"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Иванов Иван Иванович"
                            />
                        </label>

                        <label className="auth-label">
                            Email
                            <input
                                className="auth-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                autoComplete="email"
                            />
                        </label>

                        <label className="auth-label">
                            Пароль
                            <input
                                className="auth-input"
                                type="password"
                                value={pass1}
                                onChange={(e) => setPass1(e.target.value)}
                                placeholder="минимум 6 символов"
                                autoComplete="new-password"
                            />
                        </label>

                        <label className="auth-label">
                            Повтор пароля
                            <input
                                className="auth-input"
                                type="password"
                                value={pass2}
                                onChange={(e) => setPass2(e.target.value)}
                                placeholder="повторите пароль"
                                autoComplete="new-password"
                            />
                        </label>

                        {error && <div className="auth-error">{error}</div>}

                        <button className="btn btn--primary auth-btn" disabled={loading}>
                            {loading ? "Создаём…" : "Создать аккаунт"}
                        </button>

                        <div className="auth-foot">
                            <span className="auth-muted">Уже есть аккаунт?</span>{" "}
                            <Link className="auth-link" to="/login">
                                Войти
                            </Link>
                        </div>
                    </form>
                </div>

                <div className="auth-side">
                    <h1 className="auth-side__h1">Без сервера</h1>
                    <p className="auth-side__p">
                        Все данные (пользователи/пароли-хэши/обращения) лежат в IndexedDB в браузере.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;