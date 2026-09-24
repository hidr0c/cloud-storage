import { type NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";
import { createShare, listShares, revokeShare, toPublicShare } from "@/lib/share";

// Check if request is from authenticated admin
function isAuthenticated(request: NextRequest): boolean {
  const token = request.cookies.get("auth-token")?.value;
  return Boolean(token && verifyToken(token));
}

// GET: List active shares (optional ?path=... filter)
export async function GET(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const filePath = searchParams.get("path") || undefined;
    const shares = listShares(filePath);
    return Response.json({
      success: true,
      shares: shares.map(toPublicShare),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list shares";
    return Response.json({ error: message }, { status: 500 });
  }
}

// POST: Create a new share link
export async function POST(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { path: filePath, expiresInHours, password, allowDownload } = body;

    if (!filePath) {
      return Response.json({ error: "File path is required" }, { status: 400 });
    }

    const share = createShare({
      filePath,
      expiresInHours: typeof expiresInHours === "number" ? expiresInHours : null,
      password: typeof password === "string" ? password : undefined,
      allowDownload: allowDownload !== false,
    });

    return Response.json({
      success: true,
      share: toPublicShare(share),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create share link";
    return Response.json({ error: message }, { status: 400 });
  }
}

// DELETE: Revoke a share link
export async function DELETE(request: NextRequest) {
  if (!isAuthenticated(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return Response.json({ error: "Share ID is required" }, { status: 400 });
    }

    const revoked = revokeShare(id);
    if (!revoked) {
      return Response.json({ error: "Share not found" }, { status: 404 });
    }

    return Response.json({ success: true, message: "Share link revoked" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to revoke share link";
    return Response.json({ error: message }, { status: 500 });
  }
}
