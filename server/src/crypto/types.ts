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
