import { createHash } from "crypto";
import { HashResult } from "./types.js";

export function hashSHA256(data: string | Buffer): HashResult {
  const buffer = typeof data === "string" ? Buffer.from(data, "utf-8") : data;

  const hash = createHash("sha256");
  hash.update(buffer);

  const hashBuffer = hash.digest();

  return {
    hex: hashBuffer.toString("hex"),
    base64: hashBuffer.toString("base64"),
    buffer: hashBuffer,
  };
}

export function hashSHA256Hex(data: string | Buffer): string {
  return hashSHA256(data).hex;
}

export function hashSHA256Base64(data: string | Buffer): string {
  return hashSHA256(data).base64;
}

export function generateSHA256ID(data: string | Buffer): string {
  const hash = hashSHA256(data).hex;
  return hash.substring(0, 12);
}

export function verifySHA256(data: string | Buffer, hash: string): boolean {
  const computed = hashSHA256(data);
  return computed.hex === hash || computed.base64 === hash;
}
