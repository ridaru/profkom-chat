import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import SiteShell from "./app/SiteShell";
import ProtectedRoute from "./app/ProtectedRoute";

import HomePage from "./pages/HomePage";
import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import StudentPage from "./pages/Student";
import ProfilePage from "./pages/ProfilePage";

export default function App() {
    return (
        <BrowserRouter basename={import.meta.env.BASE_URL}>
            <Routes>
                <Route element={<SiteShell />}>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />

                    <Route
                        path="/app"
                        element={
                            <ProtectedRoute>
                                <StudentPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/app/profile"
                        element={
                            <ProtectedRoute>
                                <ProfilePage />
                            </ProtectedRoute>
                        }
                    />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}