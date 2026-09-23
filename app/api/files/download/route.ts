import { type NextRequest } from "next/server";
import { sanitizePath } from "@/lib/storage";
import fs from "fs";
import path from "path";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filePath = searchParams.get("path");

    if (!filePath) {
      return Response.json({ error: "Path is required" }, { status: 400 });
    }

    const fullPath = sanitizePath(filePath);

    if (!fs.existsSync(fullPath)) {
      return Response.json({ error: "File not found" }, { status: 404 });
    }

    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      return Response.json({ error: "Cannot download a directory" }, { status: 400 });
    }

    const fileName = path.basename(fullPath);
    const fileSize = stats.size;

    // Stream the file for fast transfer
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

    return new Response(readableStream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Content-Length": fileSize.toString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Download failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
