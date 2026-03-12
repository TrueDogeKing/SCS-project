/**
 * RSA 4096-bit key pair generation and operations using Web Crypto API
 */

export interface RSAKeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeyPem: string;
  privateKeyPem: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  try {
    if (!base64 || typeof base64 !== "string") {
      throw new Error(`Invalid input: expected string, got ${typeof base64}`);
    }
    
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    
    if (bytes.length === 0) {
      throw new Error("Base64 decoded to empty array");
    }
    
    return bytes.buffer;
  } catch (error) {
    throw new Error(`Base64 decode error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function formatPem(base64: string, type: "PUBLIC KEY" | "PRIVATE KEY"): string {
  const lines = base64.match(/.{1,64}/g) || [];
  return `-----BEGIN ${type}-----\n${lines.join("\n")}\n-----END ${type}-----`;
}

export function parsePemToBase64(pem: string): string {
  return pem
    .replace(/-----BEGIN [A-Z ]+-----/, "")
    .replace(/-----END [A-Z ]+-----/, "")
    .replace(/\s/g, "");
}

/**
 * Generate RSA 4096-bit key pair
 */
export async function generateRSAKeyPair(): Promise<RSAKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const publicKeyBuffer = await crypto.subtle.exportKey("spki", keyPair.publicKey);
  const privateKeyBuffer = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

  const publicKeyBase64 = arrayBufferToBase64(publicKeyBuffer);
  const privateKeyBase64 = arrayBufferToBase64(privateKeyBuffer);

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    publicKeyPem: formatPem(publicKeyBase64, "PUBLIC KEY"),
    privateKeyPem: formatPem(privateKeyBase64, "PRIVATE KEY"),
  };
}

/**
 * Decrypt data with RSA private key (OAEP padding)
 * Input: base64-encoded ciphertext
 * Returns: decrypted string
 */
export async function rsaDecrypt(
  privateKey: CryptoKey,
  ciphertextBase64: string
): Promise<string> {
  try {
    console.log("[DEBUG] rsaDecrypt called with ciphertext length:", ciphertextBase64?.length);
    
    if (!ciphertextBase64) {
      throw new Error("Ciphertext is empty or undefined");
    }
    
    console.log("[DEBUG] Converting base64 to ArrayBuffer...");
    const ciphertext = base64ToArrayBuffer(ciphertextBase64);
    console.log("[DEBUG] Ciphertext ArrayBuffer size:", ciphertext.byteLength, "bytes");
    
    if (!ciphertext || ciphertext.byteLength === 0) {
      throw new Error("Failed to convert ciphertext from base64");
    }
    
    console.log("[DEBUG] Starting Web Crypto RSA-OAEP decryption...");
    const decrypted = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      ciphertext
    );
    console.log("[DEBUG] Decryption succeeded, result size:", decrypted.byteLength, "bytes");
    
    if (!decrypted || decrypted.byteLength === 0) {
      throw new Error("Decryption resulted in empty plaintext");
    }
    
    const result = new TextDecoder().decode(decrypted);
    console.log("[DEBUG] Decoded result length:", result.length);
    return result;
  } catch (error) {
    console.error("[ERROR] rsaDecrypt failed:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`RSA decryption failed: ${errorMsg}`);
  }
}

/**
 * Encrypt data with RSA public key (OAEP padding)
 * Returns: base64-encoded ciphertext
 */
export async function rsaEncrypt(
  publicKey: CryptoKey,
  plaintext: string
): Promise<string> {
  const data = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    data
  );
  return arrayBufferToBase64(encrypted);
}

/**
 * Import RSA public key from PEM format
 */
export async function importPublicKey(pem: string): Promise<CryptoKey> {
  const base64 = parsePemToBase64(pem);
  const buffer = base64ToArrayBuffer(base64);
  return crypto.subtle.importKey(
    "spki",
    buffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}
