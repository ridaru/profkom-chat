import { Navigate } from "react-router-dom"
import { useAuth } from "../features/auth/store"

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
    const userId = useAuth(s => s.userId)

    if (!userId) {
        return <Navigate to="/" replace />
    }

    return children
}

export default ProtectedRoute