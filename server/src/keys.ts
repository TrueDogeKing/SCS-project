/**
 * Server RSA key management
 * Generates and stores the server's RSA 4096-bit keypair
 */

import { generateRSAKeyPair } from "./crypto/index.js";
import { logInfo } from "./logInfo/index.js";

const serverKeys = generateRSAKeyPair();

logInfo("SYSTEM_START", {
  message: "Server RSA 4096-bit keypair generated",
});

export function getServerPublicKey(): string {
  return serverKeys.publicKey;
}

export function getServerPrivateKey(): string {
  return serverKeys.privateKey;
}
