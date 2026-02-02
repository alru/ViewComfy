// ===== CLERK SHIM =====
// No-op replacements for @clerk/nextjs hooks when Clerk is disabled.
// To re-enable Clerk: delete this file and restore the original
// @clerk/nextjs imports (search for "clerk-shim" across the codebase).
// ===== END CLERK SHIM =====

/* eslint-disable @typescript-eslint/no-unused-vars */

export function useAuth(): {
    isLoaded: boolean;
    isSignedIn: boolean;
    userId: string | null;
    signOut: (_opts?: any) => Promise<void>;
    getToken: (_opts?: any) => Promise<string | null>;
} {
    return {
        isLoaded: true,
        isSignedIn: false,
        userId: null,
        signOut: async () => {},
        getToken: async () => null,
    };
}

export function useUser(): {
    isLoaded: boolean;
    isSignedIn: boolean;
    user: any;
} {
    return {
        isLoaded: true,
        isSignedIn: false,
        user: null,
    };
}

export function SignedIn({ children }: { children?: React.ReactNode }) {
    return null;
}

export function UserButton() {
    return null;
}

export function SignIn() {
    return null;
}
