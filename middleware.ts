import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ===== CLERK MIDDLEWARE DISABLED =====
// To re-enable Clerk, uncomment the block below and remove the simple middleware.
//
// import {
//     clerkMiddleware,
//     createRouteMatcher,
// } from "@clerk/nextjs/server";
//
// const isPublicRoute = createRouteMatcher(["/login(.*)"]);
//
// export default clerkMiddleware(async (auth, request) => {
//     const userManagementEnabled = process.env.NEXT_PUBLIC_USER_MANAGEMENT === "true";
//
//     if (!userManagementEnabled) {
//         return NextResponse.next();
//     }
//
//     const { userId, redirectToSignIn } = await auth();
//
//     if (!userId && !isPublicRoute(request)) {
//         return redirectToSignIn();
//     }
// });
// ===== END CLERK MIDDLEWARE =====

export default function middleware(_request: NextRequest) {
    return NextResponse.next();
}

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        // Always run for API routes
        "/(api|trpc)(.*)",
    ],
};
