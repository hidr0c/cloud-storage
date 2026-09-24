import { type NextRequest } from "next/server";
import { getShare, isShareExpired, verifySharePassword, recordShareDownload } from "@/lib/share";
import { sanitizePath } from "@/lib/storage";
import fs from "fs";
import path from "path";

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
      return Response.json({ error: "Share link not found or revoked" }, { status: 404 });
    }

    if (isShareExpired(share)) {
      return Response.json({ error: "This share link has expired" }, { status: 410 });
    }

    if (!share.allowDownload) {
      return Response.json({ error: "Downloads are disabled for this shared file" }, { status: 403 });
    }

    // Password validation if protected
    const searchParams = request.nextUrl.searchParams;
    const inputPassword = searchParams.get("password") || request.headers.get("x-share-password") || undefined;

    if (share.hasPassword && !verifySharePassword(share, inputPassword)) {
      return Response.json({ error: "Incorrect or missing password" }, { status: 401 });
    }

    const fullPath = sanitizePath(share.path);

    if (!fs.existsSync(fullPath)) {
      return Response.json({ error: "File no longer exists on server" }, { status: 404 });
    }

    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      return Response.json({ error: "Cannot download directory directly" }, { status: 400 });
    }

    recordShareDownload(id);

    const stream = fs.createReadStream(fullPath);
    const readableStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk: Buffer | string) => {
          const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
          controller.enqueue(new Uint8Array(buf));
        });
        stream.on("end", () => {
          controller.close();
        });
        stream.on("error", (err) => {
          controller.error(err);
        });
      },
      cancel() {
        stream.destroy();
      },
    });

    const fileName = path.basename(fullPath);

    return new Response(readableStream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Content-Length": stats.size.toString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Download failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
