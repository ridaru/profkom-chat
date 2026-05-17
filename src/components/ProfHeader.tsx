import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/store";
import { db, type User } from "../db/db";
import "../styles/prof-header.css";
import { useEffect, useMemo, useRef, useState } from "react";

const Logo = () => (
<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg" className="ph__logo"><path fillRule="evenodd" clipRule="evenodd" d="M22.8372 1.68963L11.8027 4.64632L11.6634 4.68362C8.99104 5.39963 6.78733 5.99006 5.10606 6.69188C3.3409 7.42868 1.86756 8.39877 0.919661 10.0406C-0.0282389 11.6824 -0.13166 13.4434 0.112798 15.3404C0.345644 17.1474 0.936177 19.351 1.65232 22.0234L1.68964 22.1627L4.64631 33.1972L4.68362 33.3365C5.39962 36.0089 5.99005 38.2126 6.69187 39.8938C7.42872 41.6591 8.39877 43.1322 10.0406 44.0802C11.6824 45.0282 13.4434 45.1316 15.3404 44.8873C17.1474 44.6543 19.3511 44.0639 22.0234 43.3475L22.1627 43.3104L33.1972 40.3536L33.3365 40.3163C36.0089 39.6003 38.2126 39.0098 39.8939 38.308C41.6591 37.5712 43.1322 36.6011 44.0802 34.9593C45.0282 33.3175 45.1316 31.5565 44.8873 29.6595C44.6543 27.8525 44.0639 25.6489 43.3475 22.9765L43.3103 22.8372L40.3536 11.8027L40.3163 11.6634C39.6003 8.991 39.0099 6.78733 38.3081 5.10603C37.5713 3.3409 36.6012 1.86756 34.9594 0.91966C33.3176 -0.0282385 31.5566 -0.13166 29.6595 0.112799C27.8525 0.345644 25.6489 0.936177 22.9765 1.65231L22.8372 1.68963ZM3.66317 21.6339C2.16748 16.0519 1.41963 13.2609 2.68909 11.0621C3.95854 8.86338 6.74953 8.11555 12.3316 6.61984L23.366 3.66317C28.948 2.16747 31.739 1.41963 33.9378 2.68908C36.1365 3.95855 36.8844 6.74954 38.3801 12.3315L41.3367 23.366C42.8327 28.948 43.5805 31.739 42.3108 33.9378C41.0412 36.1365 38.2504 36.8844 32.6684 38.3801L21.6339 41.3367C16.0519 42.8323 13.2609 43.5805 11.0621 42.3108C8.86338 41.0412 8.11554 38.2504 6.61987 32.6684L3.66317 21.6339ZM13.1064 10.2975H17.0554C19.8338 10.2975 21.9566 10.8282 21.9566 14.1528C21.9566 17.4931 19.8338 18.0238 17.0554 18.0238H15.6038V21.3016H13.1064V10.2975ZM15.6038 15.8386H17.2115C18.6943 15.8386 19.4592 15.6825 19.4592 14.1528C19.4592 12.6388 18.6943 12.4827 17.2115 12.4827H15.6038V15.8386ZM25.2416 21.3016H22.7442V10.2975H27.0054C29.6276 10.2975 31.9065 10.9062 31.9065 13.3724C31.9065 15.183 30.4393 15.6825 29.1125 15.8386V16.4629H30.7202C31.5787 16.4629 32.047 16.9312 32.047 17.7897V21.3016H29.5496V17.4306H25.2416V21.3016ZM25.2416 12.4827V15.2455H27.0054C28.4882 15.2455 29.4091 15.2455 29.4091 13.8719C29.4091 12.4827 28.4882 12.4827 27.0054 12.4827H25.2416ZM12.3406 28.9991C12.3406 32.2145 14.4634 34.665 17.9597 34.665C21.4405 34.665 23.5633 32.2145 23.5633 28.9991C23.5633 25.7993 21.4405 23.3488 17.9597 23.3488C14.4634 23.3488 12.3406 25.7993 12.3406 28.9991ZM14.838 28.9991C14.838 26.8919 15.8838 25.5339 17.9597 25.5339C20.0357 25.5339 21.0659 26.8919 21.0659 28.9991C21.0659 31.1219 20.0357 32.4798 17.9597 32.4798C15.8838 32.4798 14.838 31.1219 14.838 28.9991ZM27.0097 34.5089H24.5123V23.5048H32.3635V25.69H27.0097V28.8586L32.0045 28.5465V30.7629L27.0097 31.0751V34.5089Z"></path></svg>
);

const TgIcon = () => (
    <svg viewBox="0 0 32 33" xmlns="http://www.w3.org/2000/svg" className="ph__soc">
        <path d="M16 2.75293C8.64002 2.75293 2.66669 8.72626 2.66669 16.0863C2.66669 23.4463 8.64002 29.4196 16 29.4196C23.36 29.4196 29.3334 23.4463 29.3334 16.0863C29.3334 8.72626 23.36 2.75293 16 2.75293ZM22.1867 11.8196C21.9867 13.9263 21.12 19.0463 20.68 21.4063C20.4934 22.4063 20.12 22.7396 19.7734 22.7796C19 22.8463 18.4134 22.2729 17.6667 21.7796C16.4934 21.0063 15.8267 20.5263 14.6934 19.7796C13.3734 18.9129 14.2267 18.4329 14.9867 17.6596C15.1867 17.4596 18.6 14.3529 18.6667 14.0729C18.52 13.7663 18.4134 13.7929 18.32 13.8063C18.2 13.8329 16.3334 15.0729 12.6934 17.5263C12.16 17.8863 11.68 18.0729 11.2534 18.0596C10.7734 18.0463 9.86669 17.7929 9.18669 17.5663C8.34669 17.2996 7.69335 17.1529 7.74669 16.6863C7.77335 16.4463 8.10669 16.2063 8.73335 15.9529C12.6267 14.2596 15.2134 13.1396 16.5067 12.6063C20.2134 11.0596 20.9734 10.7929 21.48 10.7929C21.84 10.8196 22 10.9529 22.1867 11.8196Z" />
    </svg>
);

const VkIcon = () => (
    <svg viewBox="0 0 32 33" xmlns="http://www.w3.org/2000/svg" className="ph__soc">
        <path d="M16 2.75293C8.63613 2.75293 2.66669 8.72237 2.66669 16.0863C2.66669 23.4502 8.63613 29.4196 16 29.4196C23.3639 29.4196 29.3334 23.4502 29.3334 16.0863C29.3334 8.72237 23.3639 2.75293 16 2.75293ZM21.1278 17.796C21.1278 17.796 22.307 18.9599 22.5972 19.5002C22.7301 19.7252 22.7593 19.8812 22.7 19.996C22.6028 20.1877 22.2695 20.2821 22.1556 20.2904H20.0722C19.625 20.2529 19.2584 20.0002 18.4278 19.164C18.0236 18.6946 17.6736 18.289 17.3209 18.289C16.5806 18.7765 16.5806 19.7904 16.1542 20.289H15.2C13.182 20.1752 11.682 18.5932 8.17919 12.7335C8.07502 12.4821 8.2903 12.3474 8.52502 12.3474H10.6292C11.0014 12.5182 11.8667 14.3363 12.5986 15.6224C13.407 16.1446 13.6 16.0946 13.9611 13.8127C13.9597 13.064 13.7195 12.7363 13.0764 12.3752C13.675 11.9793 14.832 11.9557 16.1653 12.0613C16.6334 12.4668 16.5681 14.0918 16.5681 14.4752C16.5334 15.8418 16.8972 16.0821 17.0556 16.1279C17.5625 16.1279 18.5931 14.3599 19.4195 12.5904C19.5736 12.4002 19.7459 12.3599 22.2195 12.3599C22.6972 13.1738 21.5681 14.7029 21.0639 15.3682C20.0403 16.7099 20.0403 16.7779 21.1278 17.796Z" />
    </svg>
);

function getInitials(fullName?: string | null) {
    if (!fullName) return "П";
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function getRoleLabel(role?: string | null) {
    if (role === "admin") return "Администратор";
    if (role === "operator") return "Оператор";
    return "Студент";
}

export default function ProfHeader() {
    const { pathname } = useLocation();
    const navigate = useNavigate();

    const userId = useAuth((s) => s.userId);
    const logout = useAuth((s) => s.logout);

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);

    const isHome = pathname === "/";
    const messengerHref = userId ? "/app" : "/login";
    const fullName = currentUser?.fullName ?? "Пользователь";
    const role = currentUser?.role ?? "student";
    const avatarUrl = "";
    const isAdmin = currentUser?.role === "admin";

    const initials = useMemo(() => getInitials(fullName), [fullName]);

    useEffect(() => {
        let ignore = false;

        const loadCurrentUser = async () => {
            if (!userId) {
                setCurrentUser(null);
                return;
            }

            const user = await db.users.get(userId);
            if (!ignore) setCurrentUser(user ?? null);
        };

        void loadCurrentUser();

        return () => {
            ignore = true;
        };
    }, [userId, pathname]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (!menuRef.current) return;
            if (!menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLogout = () => {
        setMenuOpen(false);
        void logout();
        navigate("/");
    };

    const handleProfile = () => {
        setMenuOpen(false);
        navigate("/app/profile");
    };

    const handleAdmin = () => {
        setMenuOpen(false);
        navigate("/app/admin");
    };

    return (
        <header className={`ph ${isHome ? "ph--blend" : "ph"}`}>
            <div className="ph__inner">
                <nav className="ph__nav ph__nav--left">
                    <NavLink className={({ isActive }) => `ph__link ${isActive ? "is-active" : ""}`} to="/">
                        Главная
                    </NavLink>

                    <a className="ph__link" href="https://prof-stankin.ru/news" target="_blank" rel="noreferrer">
                        Новости
                    </a>
                    <a className="ph__link" href="https://prof-stankin.ru/management" target="_blank" rel="noreferrer">
                        Структура
                    </a>
                </nav>

                <NavLink to="/" className="ph__center" aria-label="На главную">
                    <Logo />
                </NavLink>

                <nav className="ph__nav ph__nav--right">
                    <a className="ph__link" href="https://prof-stankin.ru/support" target="_blank" rel="noreferrer">
                        Социальная поддержка
                    </a>
                    <a className="ph__link" href="https://prof-stankin.ru/concession" target="_blank" rel="noreferrer">
                        Льготный проезд
                    </a>

                    <NavLink
                        className={({ isActive }) =>
                            `ph__link ph__link--accent ${
                                isActive || pathname.startsWith("/app") || pathname.startsWith("/login")
                                    ? "is-active"
                                    : ""
                            }`
                        }
                        to={messengerHref}
                    >
                        Мессенджер
                    </NavLink>

                    <div className="ph__social">
                        <a className="ph__socBtn" href="https://t.me/profkomstankin" target="_blank" rel="noreferrer" aria-label="Telegram">
                            <TgIcon />
                        </a>
                        <a className="ph__socBtn" href="https://vk.com/profstankin" target="_blank" rel="noreferrer" aria-label="VK">
                            <VkIcon />
                        </a>
                    </div>

                    {userId && (
                        <div className="ph__user" ref={menuRef}>
                            <button
                                type="button"
                                className={`ph__userBtn ${menuOpen ? "is-open" : ""}`}
                                onClick={() => setMenuOpen((prev) => !prev)}
                            >
                                <span className="ph__avatar">
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt={fullName} className="ph__avatarImg" />
                                    ) : (
                                        initials
                                    )}
                                </span>

                                <span className="ph__userMeta">
                                    <span className="ph__userName">{fullName}</span>
                                    <span className="ph__userRole">{getRoleLabel(role)}</span>
                                </span>

                                <span className={`ph__userArrow ${menuOpen ? "is-open" : ""}`}>
                                    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                                        <path
                                            d="M5 7.5L10 12.5L15 7.5"
                                            stroke="currentColor"
                                            strokeWidth="1.8"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </svg>
                                </span>
                            </button>

                            {menuOpen && (
                                <div className="ph__userMenu">
                                    <button type="button" className="ph__userMenuItem" onClick={handleProfile}>
                                        Личный кабинет
                                    </button>
                                    {isAdmin && (
                                        <button type="button" className="ph__userMenuItem" onClick={handleAdmin}>
                                            Административная панель
                                        </button>
                                    )}
                                    <button type="button" className="ph__userMenuItem ph__userMenuItem--danger" onClick={handleLogout}>
                                        Выйти
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </nav>
            </div>
        </header>
    );
}
