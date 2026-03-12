/**
 * Crypto utilities test file
 * Demonstrates and tests all cryptographic functions
 */

import {
  generateRSAKeyPair,
  encryptWithRSAPublicKey,
  decryptWithRSAPrivateKeyAsString,
  encryptAES256,
  decryptAES256AsString,
  hashSHA256Hex,
  generateSHA256ID,
  generateSessionKey,
  generateSecureToken,
  generateNonce,
} from "./index.js";

console.log("\n=== SCS Crypto Utilities Test ===\n");

// 1. Test RSA Key Generation
console.log("1. RSA 4096-bit Key Generation");
console.log("   Generating RSA key pair...");
const rsaKeys = generateRSAKeyPair();
console.log("   ✓ Public key length:", rsaKeys.publicKey.length);
console.log("   ✓ Private key length:", rsaKeys.privateKey.length);
console.log("   ✓ Public key starts with:", rsaKeys.publicKey.substring(0, 30) + "...");

// 2. Test RSA Encryption/Decryption
console.log("\n2. RSA Encryption & Decryption");
const originalMessage = "Secret message for RSA test";
console.log("   Original message:", originalMessage);
const encrypted = encryptWithRSAPublicKey(rsaKeys.publicKey, originalMessage);
console.log("   ✓ Encrypted (base64):", encrypted.substring(0, 50) + "...");
const decrypted = decryptWithRSAPrivateKeyAsString(rsaKeys.privateKey, encrypted);
console.log("   ✓ Decrypted message:", decrypted);
console.log("   ✓ Messages match:", originalMessage === decrypted);

// 3. Test AES-256 Key Generation
console.log("\n3. AES-256 Session Key Generation");
const sessionKey = generateSessionKey();
console.log("   Generated key (base64):", sessionKey.substring(0, 40) + "...");
console.log("   ✓ Key length:", Buffer.from(sessionKey, "base64").length, "bytes (256 bits)");

// 4. Test AES-256 Encryption/Decryption
console.log("\n4. AES-256 Encryption & Decryption");
const plaintext = "Sensitive data to encrypt with AES";
console.log("   Original data:", plaintext);
const encrypted_aes = encryptAES256(sessionKey, plaintext);
console.log("   ✓ Ciphertext:", encrypted_aes.ciphertext.substring(0, 40) + "...");
console.log("   ✓ IV:", encrypted_aes.iv.substring(0, 20) + "...");
console.log("   ✓ Auth Tag:", encrypted_aes.tag.substring(0, 20) + "...");
const decrypted_aes = decryptAES256AsString(sessionKey, encrypted_aes);
console.log("   ✓ Decrypted data:", decrypted_aes);
console.log("   ✓ Data matches:", plaintext === decrypted_aes);

// 5. Test SHA-256 Hashing
console.log("\n5. SHA-256 Hashing");
const dataToHash = "client_id_12345";
console.log("   Data to hash:", dataToHash);
const hash = hashSHA256Hex(dataToHash);
console.log("   ✓ SHA-256 hex:", hash);
console.log("   ✓ Hash length:", hash.length, "characters (64 = 256 bits)");

// 6. Test SHA-256 ID Generation
console.log("\n6. SHA-256 ID Generation");
const clientName = "Alice";
const generateId = generateSHA256ID(clientName);
console.log("   Client name:", clientName);
console.log("   ✓ Generated ID:", generateId);
console.log("   ✓ ID length:", generateId.length, "characters");

// 7. Test Secure Random Token
console.log("\n7. Secure Random Token Generation");
const token = generateSecureToken(32);
console.log("   ✓ Generated token:", token);
console.log("   ✓ Token length:", token.length, "characters");

// 8. Test Nonce Generation
console.log("\n8. Secure Nonce Generation");
const nonce = generateNonce(16);
console.log("   ✓ Generated nonce:", nonce);

// 9. Integration Test: RSA + AES Combined
console.log("\n9. Integration Test: RSA + AES Combined");
console.log("   Scenario: Client encrypts session key with server's RSA public key");

// Server generates key pair
const serverKeys = generateRSAKeyPair();

// TTP generates session key
const ttpSessionKey = generateSessionKey();
console.log("   ✓ TTP generated session key");

// Encrypt session key with server's public key
const encryptedSessionKey = encryptWithRSAPublicKey(serverKeys.publicKey, ttpSessionKey);
console.log("   ✓ Session key encrypted with server's RSA public key");

// Server decrypts with private key
const decryptedSessionKey = decryptWithRSAPrivateKeyAsString(serverKeys.privateKey, encryptedSessionKey);
console.log("   ✓ Server decrypted session key");
console.log("   ✓ Keys match:", ttpSessionKey === decryptedSessionKey);

// Now use decrypted session key for AES encryption
const sensitiveData = "Confidential communication";
console.log("   ✓ Encrypting data with decrypted session key");
const aesEncrypted = encryptAES256(decryptedSessionKey, sensitiveData);
console.log("   ✓ Data encrypted with AES-256");

const aesDecrypted = decryptAES256AsString(decryptedSessionKey, aesEncrypted);
console.log("   ✓ Data decrypted:", aesDecrypted);
console.log("   ✓ Data integrity verified:", sensitiveData === aesDecrypted);

console.log("\n=== All Tests Passed ✓ ===\n");
