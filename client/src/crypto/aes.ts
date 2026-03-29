export interface EncryptedData {
  ciphertext: string; // base64
  iv: string;         // base64
  tag: string;        // base64
}

export interface EncryptedMessage {
  from: string;
  to: string;
  ciphertext: string;
  iv: string;
  tag: string;
  timestamp: string;
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
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Import AES-256 key from base64 string
 */
async function importAESKey(keyBase64: string): Promise<CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(keyBase64);
  return crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt plaintext with AES-256-GCM
 * The server's Node.js implementation outputs separate ciphertext + tag,
 * while Web Crypto API appends the tag to ciphertext.
 * We split them to match the server format (last 16 bytes = tag).
 */
export async function encryptAES256(
  keyBase64: string,
  plaintext: string
): Promise<EncryptedData> {
  const key = await importAESKey(keyBase64);
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const data = new TextEncoder().encode(plaintext);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    data
  );

  // Web Crypto appends 16-byte auth tag at the end
  const encryptedBytes = new Uint8Array(encrypted);
  const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - 16);
  const tag = encryptedBytes.slice(encryptedBytes.length - 16);

  return {
    ciphertext: arrayBufferToBase64(ciphertext.buffer),
    iv: arrayBufferToBase64(iv.buffer),
    tag: arrayBufferToBase64(tag.buffer),
  };
}

/**
 * Decrypt AES-256-GCM encrypted data
 * Reassembles ciphertext + tag as Web Crypto expects them concatenated.
 */
export async function decryptAES256(
  keyBase64: string,
  encryptedData: EncryptedData
): Promise<string> {
  const key = await importAESKey(keyBase64);
  const iv = new Uint8Array(base64ToArrayBuffer(encryptedData.iv));
  const ciphertext = new Uint8Array(base64ToArrayBuffer(encryptedData.ciphertext));
  const tag = new Uint8Array(base64ToArrayBuffer(encryptedData.tag));

  // Web Crypto expects ciphertext + tag concatenated
  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    combined.buffer
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Create an encrypted message ready to send
 */
export async function encryptMessage(
  sessionKey: string,
  message: string,
  fromId: string,
  toId: string
): Promise<EncryptedMessage> {
  const encrypted = await encryptAES256(sessionKey, message);
  return {
    from: fromId,
    to: toId,
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
    tag: encrypted.tag,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Decrypt a received encrypted message
 */
export async function decryptMessage(
  sessionKey: string,
  msg: EncryptedMessage
): Promise<{ content: string; from: string; to: string; timestamp: string }> {
  const content = await decryptAES256(sessionKey, {
    ciphertext: msg.ciphertext,
    iv: msg.iv,
    tag: msg.tag,
  });
  return {
    content,
    from: msg.from,
    to: msg.to,
    timestamp: msg.timestamp,
  };
}
