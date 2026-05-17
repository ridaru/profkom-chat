import { authClient } from "../../lib/auth-client";
import type { User } from "../../db/db";

interface AuthState {
    userId: string | null;
    user: User | null;
    isPending: boolean;
    logout: () => Promise<void>;
}

export function useAuth<T>(selector: (state: AuthState) => T): T {
    const session = authClient.useSession();

    return selector({
        userId: session.data?.user.id ?? null,
        user: (session.data?.user as User | undefined) ?? null,
        isPending: session.isPending,
        logout: async () => {
            await authClient.signOut();
            await session.refetch();
        },
    });
}
