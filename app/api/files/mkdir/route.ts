import { sanitizePath } from "@/lib/storage";
import fs from "fs";
import path from "path";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { path: dirPath, name } = body;

    if (!name) {
      return Response.json({ error: "Folder name is required" }, { status: 400 });
    }

    // Validate folder name
    if (/[<>:"/\\|?*]/.test(name)) {
      return Response.json(
        { error: "Folder name contains invalid characters" },
        { status: 400 }
      );
    }

    const parentDir = sanitizePath(dirPath || "");
    const newDir = path.join(parentDir, name);

    // Ensure the new directory is still within storage root
    sanitizePath(path.join(dirPath || "", name));

    if (fs.existsSync(newDir)) {
      return Response.json({ error: "Folder already exists" }, { status: 409 });
    }

    fs.mkdirSync(newDir, { recursive: true });
    return Response.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create folder";
    return Response.json({ error: message }, { status: 500 });
  }
}
