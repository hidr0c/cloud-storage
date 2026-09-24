import { type NextRequest } from "next/server";
import { listDirectory, sanitizePath } from "@/lib/storage";
import fs from "fs";
import path from "path";

// GET: List files in a directory
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dirPath = searchParams.get("path") || "";
    const files = listDirectory(dirPath);
    return Response.json(
      { files, path: dirPath },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list files";
    return Response.json({ error: message }, { status: 400 });
  }
}

import { scanFileSecurity, SecurityScanResult } from "@/lib/securityScanner";

// POST: Upload files
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const dirPath = formData.get("path") as string || "";
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return Response.json({ error: "No files provided" }, { status: 400 });
    }

    const targetDir = sanitizePath(dirPath);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const uploaded: string[] = [];
    const securityWarnings: SecurityScanResult[] = [];
    const securityDeletions: SecurityScanResult[] = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const scan = scanFileSecurity(file.name, buffer);

      if (scan.status === "dangerous") {
        // CRITICAL / VERY DANGEROUS: Auto-deleted / blocked from storage
        securityDeletions.push(scan);
        continue;
      }

      // Normal or Suspicious: Write to disk (DO NOT auto-delete suspicious files)
      const filePath = path.join(targetDir, file.name);
      fs.writeFileSync(filePath, buffer);
      uploaded.push(file.name);

      if (scan.status === "warning") {
        securityWarnings.push(scan);
      }
    }

    return Response.json({
      success: true,
      uploaded,
      securityWarnings,
      securityDeletions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

// DELETE: Delete a file or folder
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { path: filePath } = body;

    if (!filePath) {
      return Response.json({ error: "Path is required" }, { status: 400 });
    }

    const fullPath = sanitizePath(filePath);

    if (!fs.existsSync(fullPath)) {
      return Response.json({ error: "File not found" }, { status: 404 });
    }

    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(fullPath);
    }

    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
