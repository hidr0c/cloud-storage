import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-change-me";
const STORAGE_PASSWORD = process.env.STORAGE_PASSWORD || "1122004";

// Pre-compute the hash at startup for constant-time comparison
const PASSWORD_HASH = bcrypt.hashSync(STORAGE_PASSWORD, 12);

// Rate limiting: track failed attempts by IP
const failedAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

export function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const record = failedAttempts.get(ip);
  if (!record) return { allowed: true };

  const elapsed = Date.now() - record.lastAttempt;
  if (elapsed > LOCKOUT_MS) {
    failedAttempts.delete(ip);
    return { allowed: true };
  }

  if (record.count >= MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((LOCKOUT_MS - elapsed) / 1000);
    return { allowed: false, retryAfter };
  }

  return { allowed: true };
}

export function recordFailedAttempt(ip: string): void {
  const record = failedAttempts.get(ip);
  if (record) {
    record.count += 1;
    record.lastAttempt = Date.now();
  } else {
    failedAttempts.set(ip, { count: 1, lastAttempt: Date.now() });
  }
}

export function clearFailedAttempts(ip: string): void {
  failedAttempts.delete(ip);
}

export function comparePassword(input: string): boolean {
  // Use bcrypt for constant-time comparison (prevents timing attacks)
  return bcrypt.compareSync(input, PASSWORD_HASH);
}

export function signToken(): string {
  // Include a unique session ID for token revocation capability
  const sessionId = crypto.randomBytes(16).toString("hex");
  return jwt.sign(
    { authenticated: true, sid: sessionId },
    JWT_SECRET,
    { expiresIn: "7d", algorithm: "HS256" }
  );
}

export function verifyToken(token: string): boolean {
  try {
    jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}
