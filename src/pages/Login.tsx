import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "../lib/auth-client";
import "../styles/auth.css";

const LoginPage = () => {
    const navigate = useNavigate();

    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");

    const [boot, setBoot] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setBoot(false);
    }, []);

    const onSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const loginValue = identifier.toLowerCase().trim();
            let email = loginValue;

            if (!loginValue.includes("@")) {
                const response = await fetch(
                    `/api/auth/lookup-student?studentCard=${encodeURIComponent(loginValue)}`,
                    { credentials: "include" },
                );

                if (!response.ok) {
                    setError("Пользователь не найден");
                    return;
                }

                const payload = await response.json() as { email: string };
                email = payload.email;
            }

            const { error: signInError } = await authClient.signIn.email({
                email,
                password,
            });

            if (signInError) {
                setError("Неверный логин или пароль");
                return;
            }

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
                        Авторизация доступна студентам и сотрудникам МГТУ «СТАНКИН»
                    </div>
                </div>

                {boot ? (
                    <div className="auth__subtitle">Инициализация...</div>
                ) : (
                    <form className="auth__form" onSubmit={onSubmit}>
                        <label className="auth__label">
                            Email или номер студенческого билета
                            <input
                                className="auth__input"
                                value={identifier}
                                onChange={(event) => setIdentifier(event.target.value)}
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
                                onChange={(event) => setPassword(event.target.value)}
                                autoComplete="current-password"
                                placeholder="••••••••"
                            />
                        </label>

                        {error && <div className="auth__error">{error}</div>}

                        <button className="auth__btn" disabled={loading}>
                            {loading ? "Входим..." : "Войти"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default LoginPage;
