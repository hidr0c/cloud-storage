import { cookies, headers } from "next/headers";
import {
  comparePassword,
  signToken,
  checkRateLimit,
  recordFailedAttempt,
  clearFailedAttempts,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
    // Get client IP for rate limiting
    const headersList = await headers();
    const ip =
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headersList.get("x-real-ip") ||
      "unknown";

    // Check rate limit
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return Response.json(
        {
          error: `Too many failed attempts. Try again in ${rateCheck.retryAfter} seconds.`,
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { password } = body;

    if (!password) {
      return Response.json(
        { error: "PIN is required" },
        { status: 400 }
      );
    }

    if (!comparePassword(password)) {
      recordFailedAttempt(ip);
      return Response.json(
        { error: "Incorrect PIN" },
        { status: 401 }
      );
    }

    // Successful login: clear failed attempts
    clearFailedAttempts(ip);

    const token = signToken();
    const cookieStore = await cookies();

    cookieStore.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return Response.json({ success: true });
  } catch {
    return Response.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
