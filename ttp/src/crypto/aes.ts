/**
 * AES-256 encryption utilities
 * Implements AES-256-GCM for authenticated encryption
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { EncryptedData } from "./types";

const ALGORITHM = "aes-256-gcm";
const KEY_SIZE = 32; // 256 bits
const IV_SIZE = 16; // 128 bits
const TAG_SIZE = 16; // 128 bits

export function encryptAES256(key: string, plaintext: string | Buffer): EncryptedData {
  const keyBuffer = Buffer.from(key, "base64");

  if (keyBuffer.length !== KEY_SIZE) {
    throw new Error(`AES key must be ${KEY_SIZE} bytes (${KEY_SIZE * 8} bits)`);
  }

  const iv = randomBytes(IV_SIZE);
  const plaintextBuffer = typeof plaintext === "string" ? Buffer.from(plaintext, "utf-8") : plaintext;

  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}
export function decryptAES256(key: string, encryptedData: EncryptedData): Buffer {
  const keyBuffer = Buffer.from(key, "base64");
  const ciphertextBuffer = Buffer.from(encryptedData.ciphertext, "base64");
  const iv = Buffer.from(encryptedData.iv, "base64");
  const tag = Buffer.from(encryptedData.tag, "base64");

  if (keyBuffer.length !== KEY_SIZE) {
    throw new Error(`AES key must be ${KEY_SIZE} bytes (${KEY_SIZE * 8} bits)`);
  }

  const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(tag);

  try {
    const plaintext = Buffer.concat([decipher.update(ciphertextBuffer), decipher.final()]);
    return plaintext;
  } catch (error) {
    throw new Error("AES decryption failed: authentication tag verification failed");
  }
}

export function decryptAES256AsString(key: string, encryptedData: EncryptedData): string {
  return decryptAES256(key, encryptedData).toString("utf-8");
}

export function isValidAES256Key(key: string): boolean {
  try {
    const keyBuffer = Buffer.from(key, "base64");
    return keyBuffer.length === KEY_SIZE;
  } catch {
    return false;
  }
}
