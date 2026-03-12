/**
 * Cryptographic type definitions
 */

export interface RSAKeyPair {
  publicKey: string; 
  privateKey: string; 
}

export interface EncryptedData {
  ciphertext: string; // Base64 encoded
  iv: string; 
  tag: string; 
}

export interface SessionKey {
  key: string; // Base64 encoded 256-bit AES key
  generatedAt: string; 
}

export interface HashResult {
  hex: string; 
  base64: string; 
  buffer: Buffer; 
}

export interface Certificate {
  pem: string; // PEM encoded certificate
  der: string; // Base64 encoded DER
  fingerprint: string; // SHA-256 fingerprint
  subject: string;
  issuer: string;
  validFrom: string; // ISO timestamp
  validUntil: string; // ISO timestamp
}
