import path from "path";
import fs from "fs";
import { execSync } from "child_process";

export function getStorageRoot(): string {
  const root = process.env.STORAGE_ROOT || "E:\\STORAGE FOR CLOUD";
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
  return root;
}

export function sanitizePath(userPath: string): string {
  const root = getStorageRoot();
  // Normalize and resolve the path
  const normalized = path.normalize(userPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const resolved = path.resolve(root, normalized);

  // Ensure the resolved path is within the storage root
  if (!resolved.startsWith(root)) {
    throw new Error("Access denied: path outside storage root");
  }

  return resolved;
}

export function getRelativePath(absolutePath: string): string {
  const root = getStorageRoot();
  return path.relative(root, absolutePath).replace(/\\/g, "/");
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export interface DiskUsage {
  total: number;
  used: number;
  free: number;
  percent: number;
}

export function getDiskUsage(): DiskUsage {
  try {
    const root = getStorageRoot();
    const drive = root.charAt(0).toUpperCase();
    const output = execSync(
      `wmic logicaldisk where "DeviceID='${drive}:'" get Size,FreeSpace /format:csv`,
      { encoding: "utf-8" }
    );
    const lines = output.trim().split("\n").filter((l) => l.trim());
    const lastLine = lines[lines.length - 1];
    const parts = lastLine.split(",");
    // CSV format: Node,FreeSpace,Size
    const free = parseInt(parts[1], 10);
    const total = parseInt(parts[2], 10);
    const used = total - free;
    const percent = Math.round((used / total) * 10000) / 100;

    return { total, used, free, percent };
  } catch {
    // Fallback: try PowerShell
    try {
      const root = getStorageRoot();
      const drive = root.charAt(0).toUpperCase();
      const output = execSync(
        `powershell -Command "Get-PSDrive ${drive} | Select-Object Used,Free | ConvertTo-Json"`,
        { encoding: "utf-8" }
      );
      const data = JSON.parse(output.trim());
      const used = data.Used;
      const free = data.Free;
      const total = used + free;
      const percent = Math.round((used / total) * 10000) / 100;
      return { total, used, free, percent };
    } catch {
      return { total: 0, used: 0, free: 0, percent: 0 };
    }
  }
}

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string;
}

export function listDirectory(dirPath: string): FileInfo[] {
  const root = getStorageRoot();
  const fullPath = sanitizePath(dirPath);

  if (!fs.existsSync(fullPath)) {
    return [];
  }

  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  const files: FileInfo[] = [];

  for (const entry of entries) {
    try {
      const entryPath = path.join(fullPath, entry.name);
      const stats = fs.statSync(entryPath);
      const relativePath = path.relative(root, entryPath).replace(/\\/g, "/");

      files.push({
        name: entry.name,
        path: relativePath,
        isDirectory: entry.isDirectory(),
        size: entry.isDirectory() ? 0 : stats.size,
        modified: stats.mtime.toISOString(),
      });
    } catch {
      // Skip files that can't be read
    }
  }

  // Sort: folders first, then files, alphabetically
  files.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  return files;
}
