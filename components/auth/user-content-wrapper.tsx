"use client"
import { useAuth } from "@/lib/clerk-shim";
import { ReactNode } from "react";

interface UserContentWrapperProps {
    children: (userId: string | null) => ReactNode;
}

export default function UserContentWrapper({ children }: UserContentWrapperProps) {
    const { userId, isLoaded } = useAuth();

    if (!isLoaded) {
        return <div>Loading...</div>;
    }

    return <>{children(userId)}</>;
} 