import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  const publicPaths = ["/login", "/api/auth/login"];
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for auth token
  const token = request.cookies.get("auth-token")?.value;

  if (!token || !verifyToken(token)) {
    // Redirect to login for page requests
    if (!pathname.startsWith("/api/")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    // Return 401 for API requests
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
