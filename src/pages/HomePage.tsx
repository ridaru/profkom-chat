import { Link } from "react-router-dom";
import { useAuth } from "../features/auth/store";
import "../styles/home.css";

export default function HomePage() {
    const userId = useAuth((s) => s.userId);

    return (
        <div className="home">
            <section className="home__hero">
                <div className="home__bg" aria-hidden />
                <div className="home__wrap">
                    <div className="home__title">Профком обучающихся</div>
                    <div className="home__subtitle">
                        Московского государственного технологического университета «СТАНКИН»
                    </div>

                    <p className="home__lead">
                        Студенческая общественная организация, ведущий орган в системе студенческого самоуправления и сердце
                        студенческой жизни современной молодежи.
                    </p>

                    <div className="home__cta">
                        <Link className="home__btn home__btn--primary" to={userId ? "/app" : "/login"}>
                            Открыть мессенджер
                        </Link>
                        <a className="home__btn" href="https://prof-stankin.ru/" target="_blank" rel="noreferrer">
                            Официальный сайт
                        </a>
                    </div>
                </div>
            </section>

            <section className="home__section">
                <div className="home__wrap">
                    <h2 className="home__h2">О профкоме</h2>
                    <p className="home__text">
                        Профком обучающихся МГТУ «СТАНКИН» проводит множество культурно-массовых, спортивных, развлекательных
                        мероприятий, занимается развитием волонтерской и добровольческой деятельности.
                    </p>
                </div>
            </section>
        </div>
    );
}