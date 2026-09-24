import fs from "fs";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { sanitizePath, getStorageRoot } from "./storage";

export interface ShareItem {
  id: string;
  path: string; // relative path within storage root
  fileName: string;
  isDirectory: boolean;
  fileSize: number;
  createdAt: string;
  expiresAt: string | null; // ISO string, or null if never
  hasPassword: boolean;
  passwordHash?: string;
  allowDownload: boolean;
  views: number;
  downloads: number;
}

export interface SharePublicInfo {
  id: string;
  fileName: string;
  isDirectory: boolean;
  fileSize: number;
  createdAt: string;
  expiresAt: string | null;
  hasPassword: boolean;
  allowDownload: boolean;
  isExpired: boolean;
  views: number;
  downloads: number;
}

const DATA_DIR = path.join(process.cwd(), "data");
const SHARES_FILE = path.join(DATA_DIR, "shares.json");

function ensureDataFile(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(SHARES_FILE)) {
    fs.writeFileSync(SHARES_FILE, JSON.stringify([], null, 2), "utf-8");
  }
}

function loadShares(): ShareItem[] {
  try {
    ensureDataFile();
    const data = fs.readFileSync(SHARES_FILE, "utf-8");
    return JSON.parse(data) as ShareItem[];
  } catch {
    return [];
  }
}

function saveShares(shares: ShareItem[]): void {
  try {
    ensureDataFile();
    const tempFile = `${SHARES_FILE}.${Date.now()}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(shares, null, 2), "utf-8");
    fs.renameSync(tempFile, SHARES_FILE);
  } catch (error) {
    console.error("Failed to save shares:", error);
  }
}

export function isShareExpired(share: ShareItem): boolean {
  if (!share.expiresAt) return false;
  return new Date(share.expiresAt).getTime() <= Date.now();
}

/**
 * Creates a new share link for a file or folder.
 */
export function createShare(options: {
  filePath: string;
  expiresInHours?: number | null; // null or undefined means never
  password?: string;
  allowDownload?: boolean;
}): ShareItem {
  const fullPath = sanitizePath(options.filePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error("File or folder does not exist");
  }

  const stats = fs.statSync(fullPath);
  const isDirectory = stats.isDirectory();
  const root = getStorageRoot();
  const relativePath = path.relative(root, fullPath).replace(/\\/g, "/");
  const fileName = path.basename(fullPath);

  // Generate unique URL-safe 12-char token
  const id = crypto.randomBytes(9).toString("base64url");

  let expiresAt: string | null = null;
  if (options.expiresInHours && options.expiresInHours > 0) {
    const expDate = new Date(Date.now() + options.expiresInHours * 3600 * 1000);
    expiresAt = expDate.toISOString();
  }

  let hasPassword = false;
  let passwordHash: string | undefined;

  if (options.password && options.password.trim().length > 0) {
    hasPassword = true;
    passwordHash = bcrypt.hashSync(options.password.trim(), 10);
  }

  const newShare: ShareItem = {
    id,
    path: relativePath,
    fileName,
    isDirectory,
    fileSize: isDirectory ? 0 : stats.size,
    createdAt: new Date().toISOString(),
    expiresAt,
    hasPassword,
    passwordHash,
    allowDownload: options.allowDownload !== false,
    views: 0,
    downloads: 0,
  };

  const shares = loadShares();
  shares.push(newShare);
  saveShares(shares);

  return newShare;
}

/**
 * Retrieves a share by ID.
 */
export function getShare(id: string): ShareItem | null {
  const shares = loadShares();
  const share = shares.find((s) => s.id === id);
  return share || null;
}

/**
 * Converts ShareItem to a safe public object without password hashes.
 */
export function toPublicShare(share: ShareItem): SharePublicInfo {
  return {
    id: share.id,
    fileName: share.fileName,
    isDirectory: share.isDirectory,
    fileSize: share.fileSize,
    createdAt: share.createdAt,
    expiresAt: share.expiresAt,
    hasPassword: share.hasPassword,
    allowDownload: share.allowDownload,
    isExpired: isShareExpired(share),
    views: share.views || 0,
    downloads: share.downloads || 0,
  };
}

/**
 * Verifies password if protected.
 */
export function verifySharePassword(share: ShareItem, inputPassword?: string): boolean {
  if (!share.hasPassword) return true;
  if (!inputPassword || !share.passwordHash) return false;
  return bcrypt.compareSync(inputPassword.trim(), share.passwordHash);
}

/**
 * Increments view count.
 */
export function recordShareView(id: string): void {
  const shares = loadShares();
  const index = shares.findIndex((s) => s.id === id);
  if (index !== -1) {
    shares[index].views = (shares[index].views || 0) + 1;
    saveShares(shares);
  }
}

/**
 * Increments download count.
 */
export function recordShareDownload(id: string): void {
  const shares = loadShares();
  const index = shares.findIndex((s) => s.id === id);
  if (index !== -1) {
    shares[index].downloads = (shares[index].downloads || 0) + 1;
    saveShares(shares);
  }
}

/**
 * Revokes / deletes a share link.
 */
export function revokeShare(id: string): boolean {
  const shares = loadShares();
  const filtered = shares.filter((s) => s.id !== id);
  if (filtered.length !== shares.length) {
    saveShares(filtered);
    return true;
  }
  return false;
}

/**
 * Lists active shares, optionally filtered by relative file path.
 */
export function listShares(filterPath?: string): ShareItem[] {
  const shares = loadShares();
  if (filterPath) {
    const normalized = filterPath.replace(/\\/g, "/").replace(/^\/+/, "");
    return shares.filter((s) => s.path === normalized);
  }
  return shares;
}
