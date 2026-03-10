import { Outlet } from "react-router-dom";
import ProfHeader from "../components/ProfHeader";
import "../styles/site-shell.css";

export default function SiteShell() {
    return (
        <div className="shell">
            <ProfHeader />
            <main className="shell__main">
                <Outlet />
            </main>
        </div>
    );
}