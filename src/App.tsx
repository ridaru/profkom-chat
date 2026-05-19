import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import SiteShell from "./app/SiteShell";
import ProtectedRoute from "./app/ProtectedRoute";

import HomePage from "./pages/HomePage";
import LoginPage from "./pages/Login";
import StudentPage from "./pages/Student";
import ProfilePage from "./pages/ProfilePage";
import AdminPage from "./pages/AdminPage";
import AnalyticsPage from "./pages/AnalyticsPage";

export default function App() {
    return (
        <BrowserRouter basename={import.meta.env.BASE_URL}>
            <Routes>
                <Route element={<SiteShell />}>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<Navigate to="/login" replace />} />

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

                    <Route
                        path="/app/admin"
                        element={
                            <ProtectedRoute>
                                <AdminPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/app/analytics"
                        element={
                            <ProtectedRoute>
                                <AnalyticsPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
