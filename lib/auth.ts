import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-change-me";
const STORAGE_PASSWORD = process.env.STORAGE_PASSWORD || "changeme";

export function getPasswordHash(): string {
  return bcrypt.hashSync(STORAGE_PASSWORD, 10);
}

export function comparePassword(input: string): boolean {
  // Compare directly since we hash on the fly from env
  return input === STORAGE_PASSWORD;
}

export function signToken(): string {
  return jwt.sign({ authenticated: true }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): boolean {
  try {
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}
