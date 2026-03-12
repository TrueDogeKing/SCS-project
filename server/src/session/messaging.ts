/**
 * Message encryption/decryption utilities for AES-256 encrypted messaging
 */

import { encryptAES256, decryptAES256AsString, EncryptedData } from "../crypto/index.js";
import { EncryptedMessage, DecryptedMessage } from "./types.js";

export function encryptMessage(
  sessionKey: string,
  message: string,
  fromId: string,
  toId: string
): EncryptedMessage {
  const encryptedData = encryptAES256(sessionKey, message);

  return {
    from: fromId,
    to: toId,
    ciphertext: encryptedData.ciphertext,
    iv: encryptedData.iv,
    tag: encryptedData.tag,
    timestamp: new Date().toISOString(),
  };
}

export function decryptMessage(
  sessionKey: string,
  encryptedMessage: EncryptedMessage
): DecryptedMessage {
  const encryptedData: EncryptedData = {
    ciphertext: encryptedMessage.ciphertext,
    iv: encryptedMessage.iv,
    tag: encryptedMessage.tag,
  };

  const plaintext = decryptAES256AsString(sessionKey, encryptedData);

  return {
    content: plaintext,
    from: encryptedMessage.from,
    to: encryptedMessage.to,
    timestamp: encryptedMessage.timestamp,
  };
}

/**
 * Validate encrypted message structure
 */
export function isValidEncryptedMessage(obj: any): obj is EncryptedMessage {
  return (
    obj &&
    typeof obj === "object" &&
    typeof obj.from === "string" &&
    typeof obj.to === "string" &&
    typeof obj.ciphertext === "string" &&
    typeof obj.iv === "string" &&
    typeof obj.tag === "string" &&
    typeof obj.timestamp === "string"
  );
}
