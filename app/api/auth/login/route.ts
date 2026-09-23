import { cookies } from "next/headers";
import { comparePassword, signToken } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return Response.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    if (!comparePassword(password)) {
      return Response.json(
        { error: "Incorrect password" },
        { status: 401 }
      );
    }

    const token = signToken();
    const cookieStore = await cookies();

    cookieStore.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
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
