import { randomBytes } from "crypto";

export function generateRandomBytes(length: number): string {
  if (length <= 0) {
    throw new Error("Length must be greater than 0");
  }
  return randomBytes(length).toString("base64");
}

export function generateSessionKey(): string {
  return generateRandomBytes(32); // 256 bits
}

export function generateNonce(length: number = 16): string {
  return generateRandomBytes(length);
}

export function generateIV(): string {
  return generateRandomBytes(16); // 128 bits
}

export function generateRandomHex(length: number): string {
  const bytes = Math.ceil(length / 2);
  return randomBytes(bytes).toString("hex").substring(0, length);
}

export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString("base64url");
}
