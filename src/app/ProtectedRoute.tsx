import { Navigate } from "react-router-dom"
import type { ReactElement } from "react"
import { useAuth } from "../features/auth/store"

const ProtectedRoute = ({ children }: { children: ReactElement }) => {
    const userId = useAuth(s => s.userId)

    if (!userId) {
        return <Navigate to="/" replace />
    }

    return children
}

export default ProtectedRoute
