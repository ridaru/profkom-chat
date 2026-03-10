import { create } from "zustand";

interface AuthState {
    userId: string | null;
    login: (id: string) => void;
    logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
    userId: localStorage.getItem("userId"),
    login: (id) => {
        localStorage.setItem("userId", id);
        set({ userId: id });
    },
    logout: () => {
        localStorage.removeItem("userId");
        set({ userId: null });
    },
}));