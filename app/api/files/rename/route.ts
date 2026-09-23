import { sanitizePath, getStorageRoot } from "@/lib/storage";
import fs from "fs";
import path from "path";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { path: filePath, newName } = body;

    if (!filePath || !newName) {
      return Response.json(
        { error: "Path and new name are required" },
        { status: 400 }
      );
    }

    // Validate new name
    if (/[<>:"/\\|?*]/.test(newName)) {
      return Response.json(
        { error: "Name contains invalid characters" },
        { status: 400 }
      );
    }

    const fullPath = sanitizePath(filePath);

    if (!fs.existsSync(fullPath)) {
      return Response.json({ error: "File not found" }, { status: 404 });
    }

    const parentDir = path.dirname(fullPath);
    const newPath = path.join(parentDir, newName);

    // Ensure new path is within storage root
    const root = getStorageRoot();
    if (!newPath.startsWith(root)) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    if (fs.existsSync(newPath)) {
      return Response.json(
        { error: "A file or folder with that name already exists" },
        { status: 409 }
      );
    }

    fs.renameSync(fullPath, newPath);
    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rename failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
