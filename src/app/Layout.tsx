import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/store";
import "../styles/layout.css";

const Layout = () => {
    const logout = useAuth((s) => s.logout);
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    return (
        <div className="app-shell">
            <header className="topbar">
                <div className="container topbar__inner">
                    <div className="brand">
                        <div className="brand__mark" aria-hidden />
                        <div className="brand__text">
                            <div className="brand__title">Профком СТАНКИН</div>
                            <div className="brand__subtitle">Мессенджер поддержки</div>
                        </div>
                    </div>

                    <div className="topbar__actions">
                        <a className="topbar__link" href="/" onClick={(e) => { e.preventDefault(); navigate("/app"); }}>
                            Обращения
                        </a>

                        {/* На будущее — ссылка “назад на сайт” */}
                        {/* <a className="topbar__link" href="https://prof-stankin.ru/" target="_blank" rel="noreferrer">На сайт</a> */}

                        <button className="btn btn--accent" onClick={handleLogout}>
                            Выйти
                        </button>
                    </div>
                </div>
            </header>

            <main className="container app-shell__content">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;