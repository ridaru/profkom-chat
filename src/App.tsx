import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import SiteShell from "./app/SiteShell";
import ProtectedRoute from "./app/ProtectedRoute";

import HomePage from "./pages/HomePage";
import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import StudentPage from "./pages/Student";

export default function App() {
    return (
        <BrowserRouter basename={import.meta.env.BASE_URL}>
            <Routes>
                {/* Вся “оболочка сайта” (шапка и фон) */}
                <Route element={<SiteShell />}>
                    <Route path="/" element={<HomePage />} />

                    {/* Авторизация/регистрация */}
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />

                    {/* Мессенджер */}
                    <Route
                        path="/app"
                        element={
                            <ProtectedRoute>
                                <StudentPage />
                            </ProtectedRoute>
                        }
                    />

                    {/* fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}