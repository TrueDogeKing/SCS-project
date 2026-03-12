/**
 * RSA cryptography utilities
 * Implements RSA 4096-bit key generation and encryption/decryption
 */

import { generateKeyPairSync, publicEncrypt, privateDecrypt } from "crypto";
import { RSAKeyPair } from "./types";

export function generateRSAKeyPair(): RSAKeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  return {
    publicKey,
    privateKey,
  };
}

export function encryptWithRSAPublicKey(publicKey: string, data: string | Buffer): string {
  const dataBuffer = typeof data === "string" ? Buffer.from(data, "utf-8") : data;

  const encrypted = publicEncrypt(
    {
      key: publicKey,
      padding: 4, // RSA_PKCS1_OAEP_PADDING
    },
    dataBuffer
  );

  return encrypted.toString("base64");
}

export function decryptWithRSAPrivateKey(privateKey: string, ciphertext: string): Buffer {
  const ciphertextBuffer = Buffer.from(ciphertext, "base64");

  const decrypted = privateDecrypt(
    {
      key: privateKey,
      padding: 4, // RSA_PKCS1_OAEP_PADDING
    },
    ciphertextBuffer
  );

  return decrypted;
}

export function decryptWithRSAPrivateKeyAsString(privateKey: string, ciphertext: string): string {
  return decryptWithRSAPrivateKey(privateKey, ciphertext).toString("utf-8");
}
