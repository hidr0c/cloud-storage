import { type NextRequest } from "next/server";
import { getShare, isShareExpired, verifySharePassword } from "@/lib/share";
import { sanitizePath } from "@/lib/storage";
import { parseDocx, parseDoc, parseCsv } from "@/lib/docParser";
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

    // Password validation if protected
    const searchParams = request.nextUrl.searchParams;
    const inputPassword = searchParams.get("password") || request.headers.get("x-share-password") || undefined;

    if (share.hasPassword && !verifySharePassword(share, inputPassword)) {
      return Response.json({ error: "Incorrect or missing password" }, { status: 401 });
    }

    const fullPath = sanitizePath(share.path);

    if (!fs.existsSync(fullPath)) {
      return Response.json({ error: "File no longer exists" }, { status: 404 });
    }

    const stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      return Response.json({ error: "Cannot parse directory content" }, { status: 400 });
    }

    const ext = path.extname(fullPath).toLowerCase();
    const fileName = path.basename(fullPath);

    // 1. Word Documents (.docx)
    if (ext === ".docx") {
      const buffer = fs.readFileSync(fullPath);
      const parsed = parseDocx(buffer);
      return Response.json({
        type: "docx",
        name: fileName,
        size: stats.size,
        html: parsed.html,
        text: parsed.text,
      });
    }

    // 2. Legacy Word Documents (.doc)
    if (ext === ".doc") {
      const buffer = fs.readFileSync(fullPath);
      const parsed = parseDoc(buffer);
      return Response.json({
        type: "doc",
        name: fileName,
        size: stats.size,
        html: parsed.html,
        text: parsed.text,
      });
    }

    // 3. JSON files
    if (ext === ".json") {
      const raw = fs.readFileSync(fullPath, "utf-8");
      try {
        const parsed = JSON.parse(raw);
        return Response.json({
          type: "json",
          name: fileName,
          size: stats.size,
          content: JSON.stringify(parsed, null, 2),
          isValid: true,
        });
      } catch {
        return Response.json({
          type: "json",
          name: fileName,
          size: stats.size,
          content: raw,
          isValid: false,
        });
      }
    }

    // 4. CSV & TSV
    if (ext === ".csv" || ext === ".tsv") {
      const text = fs.readFileSync(fullPath, "utf-8");
      const parsed = parseCsv(text);
      return Response.json({
        type: "csv",
        name: fileName,
        size: stats.size,
        headers: parsed.headers,
        rows: parsed.rows,
      });
    }

    // 5. XML files
    if (ext === ".xml") {
      const raw = fs.readFileSync(fullPath, "utf-8");
      return Response.json({
        type: "xml",
        name: fileName,
        size: stats.size,
        content: raw,
      });
    }

    // 6. Markdown
    if (ext === ".md") {
      const raw = fs.readFileSync(fullPath, "utf-8");
      return Response.json({
        type: "markdown",
        name: fileName,
        size: stats.size,
        content: raw,
      });
    }

    // 7. General text and code files
    const textExts = [
      ".txt", ".log", ".ini", ".conf", ".cfg", ".env",
      ".js", ".jsx", ".ts", ".tsx", ".html", ".htm", ".css", ".scss",
      ".py", ".sh", ".bash", ".bat", ".cmd", ".ps1",
      ".yml", ".yaml", ".sql", ".rs", ".go", ".c", ".cpp", ".h",
      ".java", ".kt", ".rb", ".php", ".r",
    ];

    if (textExts.includes(ext) || stats.size < 512 * 1024) {
      try {
        const raw = fs.readFileSync(fullPath, "utf-8");
        if (!raw.includes("\0")) {
          return Response.json({
            type: "text",
            name: fileName,
            size: stats.size,
            content: raw,
            extension: ext,
          });
        }
      } catch {
        // Not text
      }
    }

    return Response.json({
      type: "binary",
      name: fileName,
      size: stats.size,
      extension: ext,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load shared content";
    return Response.json({ error: message }, { status: 500 });
  }
}
