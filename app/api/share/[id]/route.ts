import { type NextRequest } from "next/server";
import { getShare, isShareExpired, toPublicShare, verifySharePassword, recordShareView } from "@/lib/share";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;

    if (!id) {
      return Response.json({ error: "Share ID is required" }, { status: 400 });
    }

    const share = getShare(id);

    if (!share) {
      return Response.json({ error: "Share link not found or has been revoked" }, { status: 404 });
    }

    if (isShareExpired(share)) {
      return Response.json(
        {
          error: "expired",
          message: "This share link has expired",
          share: { ...toPublicShare(share), isExpired: true },
        },
        { status: 410 }
      );
    }

    // Password verification if protected
    const searchParams = request.nextUrl.searchParams;
    const inputPassword = searchParams.get("password") || request.headers.get("x-share-password") || undefined;

    if (share.hasPassword) {
      const isValid = verifySharePassword(share, inputPassword);
      if (!isValid) {
        return Response.json({
          unlocked: false,
          requiresPassword: true,
          share: {
            id: share.id,
            fileName: share.fileName,
            isDirectory: share.isDirectory,
            fileSize: share.fileSize,
            hasPassword: true,
            expiresAt: share.expiresAt,
            createdAt: share.createdAt,
          },
        });
      }
    }

    // Record view upon valid access
    recordShareView(id);

    return Response.json({
      success: true,
      unlocked: true,
      requiresPassword: false,
      share: toPublicShare(share),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load share";
    return Response.json({ error: message }, { status: 500 });
  }
}
