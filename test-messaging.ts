/**
 * Encrypted Messaging Test
 * Tests the AES-256 encrypted message exchange between client and server
 * 
 * Usage:
 *   bun run test-messaging.ts
 * 
 * Prerequisites:
 *   - TTP running on port 3002
 *   - Server running on port 3001
 */

import { generateKeyPairSync, privateDecrypt, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const TTP_URL = "http://localhost:3002";
const SERVER_URL = "http://localhost:3001";

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  data?: any;
}

const results: TestResult[] = [];

function logResult(result: TestResult) {
  results.push(result);
  const status = result.success ? "✓ PASS" : "✗ FAIL";
  console.log(`\n${status}: ${result.name}`);
  console.log(`  ${result.message}`);
}

// Helper: Generate RSA keys
function generateKeys() {
  const serverKeys = generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const clientKeys = generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  return {
    serverPublic: serverKeys.publicKey,
    serverPrivate: serverKeys.privateKey,
    clientPublic: clientKeys.publicKey,
    clientPrivate: clientKeys.privateKey,
  };
}

// Helper: Register with TTP
async function registerWithTTP(entityId: string, type: "CLIENT" | "SERVER", publicKey: string) {
  const response = await fetch(`${TTP_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: entityId,
      type,
      name: `Test ${type}`,
      publicKey,
    }),
  });

  const data = await response.json();
  return data.certificate?.pem;
}

// Helper: Authenticate and get session key
async function authenticate(clientId: string, serverId: string, clientCert: string) {
  const response = await fetch(`${SERVER_URL}/verify-client`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId,
      clientCertificate: clientCert,
      serverId,
      ttpUrl: TTP_URL,
    }),
  });

  const data = await response.json();
  return data;
}

// Helper: Encrypt message using AES-256-GCM with actual session key
function encryptMessageClient(plaintext: string, sessionKey: string, fromId: string, toId: string): any {
  const keyBuffer = Buffer.from(sessionKey, "base64");
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", keyBuffer, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    from: fromId,
    to: toId,
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    timestamp: new Date().toISOString(),
  };
}

// Test 1: Register entities
async function testRegisterEntities(keys: any) {
  console.log("\n=== Test 1: Register Client and Server ===\n");

  // Fetch the server's actual RSA public key
  let serverPublicKey: string;
  try {
    const res = await fetch(`${SERVER_URL}/public-key`);
    const data = await res.json() as any;
    serverPublicKey = data.publicKey;
  } catch (error) {
    logResult({
      name: "Register Server",
      success: false,
      message: "Failed to fetch server public key",
    });
    return null;
  }

  const serverCert = await registerWithTTP("test_msg_server_001", "SERVER", serverPublicKey);
  if (serverCert) {
    logResult({
      name: "Register Server",
      success: true,
      message: "Server registered successfully",
    });
  } else {
    logResult({
      name: "Register Server",
      success: false,
      message: "Failed to register server",
    });
    return null;
  }

  const clientCert = await registerWithTTP("test_msg_client_001", "CLIENT", keys.clientPublic);
  if (clientCert) {
    logResult({
      name: "Register Client",
      success: true,
      message: "Client registered successfully",
    });
    return clientCert;
  } else {
    logResult({
      name: "Register Client",
      success: false,
      message: "Failed to register client",
    });
    return null;
  }
}

// Test 2: Authenticate and establish session
async function testAuthentication(clientCert: string, keys: any) {
  console.log("\n=== Test 2: Authenticate and Establish Session ===\n");

  const authData = await authenticate(
    "test_msg_client_001",
    "test_msg_server_001",
    clientCert
  );

  if (authData.success && authData.sessionKey && authData.clientSessionKey) {
    // Decrypt the client session key to get the actual AES key
    let decryptedSessionKey: string;
    try {
      const decrypted = privateDecrypt(
        { key: keys.clientPrivate, padding: 4 },
        Buffer.from(authData.clientSessionKey, "base64")
      );
      decryptedSessionKey = decrypted.toString("utf-8");
    } catch (error) {
      logResult({
        name: "Authentication and Key Exchange",
        success: false,
        message: `Failed to decrypt client session key: ${error instanceof Error ? error.message : String(error)}`,
      });
      return null;
    }

    logResult({
      name: "Authentication and Key Exchange",
      success: true,
      message: "Client authenticated and received session keys",
      data: {
        verified: authData.verified,
        hasServerKey: !!authData.sessionKey,
        hasClientKey: !!authData.clientSessionKey,
      },
    });
    return { ...authData, decryptedSessionKey };
  } else {
    logResult({
      name: "Authentication and Key Exchange",
      success: false,
      message: `Authentication failed: ${authData.error}`,
    });
    return null;
  }
}

// Test 3: Send encrypted message to server
async function testSendMessage(sessionKey: string) {
  console.log("\n=== Test 3: Send Encrypted Message to Server ===\n");

  // Create a properly AES-256-GCM encrypted message
  const encryptedMsg = encryptMessageClient("Hello Server!", sessionKey, "test_msg_client_001", "test_msg_server_001");

  try {
    const response = await fetch(`${SERVER_URL}/message/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: "test_msg_client_001",
        serverId: "test_msg_server_001",
        encryptedMessage: encryptedMsg,
      }),
    });

    const data = await response.json();

    if (data.success) {
      logResult({
        name: "Send Encrypted Message",
        success: true,
        message: "Message sent and processed by server",
        data: { messageId: data.messageId },
      });
    } else {
      logResult({
        name: "Send Encrypted Message",
        success: false,
        message: `Send failed: ${data.error}`,
      });
    }
  } catch (error) {
    logResult({
      name: "Send Encrypted Message",
      success: false,
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// Test 4: Receive messages
async function testReceiveMessages() {
  console.log("\n=== Test 4: Receive Encrypted Messages ===\n");

  try {
    const response = await fetch(`${SERVER_URL}/message/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: "test_msg_client_001",
        serverId: "test_msg_server_001",
      }),
    });

    const data = await response.json();

    if (data.success) {
      logResult({
        name: "Receive Encrypted Messages",
        success: true,
        message: `Retrieved ${data.messages?.length || 0} message(s)`,
        data: { messageCount: data.messages?.length || 0 },
      });
    } else {
      logResult({
        name: "Receive Encrypted Messages",
        success: false,
        message: `Receive failed: ${data.error}`,
      });
    }
  } catch (error) {
    logResult({
      name: "Receive Encrypted Messages",
      success: false,
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// Test 5: Server send to client
async function testServerSendToClient(sessionKey: string) {
  console.log("\n=== Test 5: Server Send Message to Client ===\n");

  const encryptedMsg = encryptMessageClient("Response from Server", sessionKey, "test_msg_server_001", "test_msg_client_001");

  try {
    const response = await fetch(`${SERVER_URL}/message/send-to-client`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: "test_msg_client_001",
        serverId: "test_msg_server_001",
        encryptedMessage: encryptedMsg,
      }),
    });

    const data = await response.json();

    if (data.success) {
      logResult({
        name: "Server Send to Client",
        success: true,
        message: "Server message queued for client",
        data: { messageId: data.messageId },
      });
    } else {
      logResult({
        name: "Server Send to Client",
        success: false,
        message: `Send failed: ${data.error}`,
      });
    }
  } catch (error) {
    logResult({
      name: "Server Send to Client",
      success: false,
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// Main test runner
async function runMessagingTests() {
  console.log(
    "\n=====================================================\n" +
      "      SCS Encrypted Messaging - Integration Test\n" +
      "=====================================================\n"
  );

  // Generate keys
  console.log("Generating RSA 4096-bit keys...");
  const keys = generateKeys();

  // Test registration
  const clientCert = await testRegisterEntities(keys);
  if (!clientCert) {
    console.error("\n❌ Cannot continue without client registration");
    process.exit(1);
  }

  // Test authentication
  const authData = await testAuthentication(clientCert, keys);
  if (!authData) {
    console.error("\n❌ Cannot continue without authentication");
    process.exit(1);
  }

  // Test messaging
  await testSendMessage(authData.decryptedSessionKey);
  await testReceiveMessages();
  await testServerSendToClient(authData.decryptedSessionKey);
  await testReceiveMessages(); // Check again for server's response

  // Print summary
  console.log(
    "\n\n=====================================================\n" +
      "                    Test Summary\n" +
      "=====================================================\n"
  );

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  results.forEach((r) => {
    const icon = r.success ? "✓" : "✗";
    console.log(`${icon} ${r.name}`);
  });

  console.log(`\n${passed} passed, ${failed} failed out of ${results.length} tests\n`);

  if (failed === 0) {
    console.log("✓ All messaging tests passed!\n");
  } else {
    console.log("✗ Some tests failed. Check output above.\n");
    process.exit(1);
  }
}

// Run tests
runMessagingTests().catch((error) => {
  console.error("Test runner error:", error);
  process.exit(1);
});
