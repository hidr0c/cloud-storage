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
    return Response.json({ files, path: dirPath });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list files";
    return Response.json({ error: message }, { status: 400 });
  }
}

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

    for (const file of files) {
      const filePath = path.join(targetDir, file.name);
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(filePath, buffer);
      uploaded.push(file.name);
    }

    return Response.json({ success: true, uploaded });
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
