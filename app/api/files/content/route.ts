import { type NextRequest } from "next/server";
import { sanitizePath } from "@/lib/storage";
import { parseDocx, parseDoc, parseCsv } from "@/lib/docParser";
import fs from "fs";
import path from "path";
import { scanFileSecurity } from "@/lib/securityScanner";

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
      return Response.json({ error: "Cannot read directory content" }, { status: 400 });
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
        // Attempt utf-8 read
        const raw = fs.readFileSync(fullPath, "utf-8");
        // Quick binary check (null byte)
        if (!raw.includes("\0")) {
          const scan = scanFileSecurity(fileName, Buffer.from(raw, "utf-8"));
          return Response.json({
            type: "text",
            name: fileName,
            size: stats.size,
            content: raw,
            extension: ext,
            security: scan.issues.length > 0 ? scan : null,
          });
        }
      } catch {
        // Not text
      }
    }

    const binBuffer = fs.readFileSync(fullPath);
    const binScan = scanFileSecurity(fileName, binBuffer);

    return Response.json({
      type: "binary",
      name: fileName,
      size: stats.size,
      extension: ext,
      security: binScan.issues.length > 0 ? binScan : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load content";
    return Response.json({ error: message }, { status: 500 });
  }
}
