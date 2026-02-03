"use client"
import UserAppPage from "@/components/pages/app/user-app-page";
import { Suspense } from "react";

export default function Page() {
    return (<Suspense><UserAppPage /></Suspense>);
}
