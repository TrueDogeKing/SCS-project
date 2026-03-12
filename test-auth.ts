/**
 * Automated Authentication Flow Test
 * Tests the complete server-TTP authentication flow
 * 
 * Usage:
 *   bun run test-auth.ts
 */

import { generateKeyPairSync, privateDecrypt } from "node:crypto";

// Configuration
const TTP_URL = "http://localhost:3002";
const SERVER_URL = "http://localhost:3001";

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  data?: any;
}

const results: TestResult[] = [];

// Helper function to log test results
function logResult(result: TestResult) {
  results.push(result);
  const status = result.success ? "✓ PASS" : "✗ FAIL";
  console.log(`\n${status}: ${result.name}`);
  console.log(`  ${result.message}`);
  if (result.data) {
    console.log(`  Data: ${JSON.stringify(result.data).substring(0, 100)}...`);
  }
}

// Generate RSA keys
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

// Test 1: Register Server
async function testRegisterServer(publicKey: string) {
  try {
    const response = await fetch(`${TTP_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "test_server_001",
        type: "SERVER",
        name: "Test Server",
        publicKey,
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      logResult({
        name: "Register Server with TTP",
        success: true,
        message: `Server registered successfully (status ${response.status})`,
        data: { entityId: data.entityId, fingerprint: data.certificate?.fingerprint },
      });
      return data.certificate;
    } else {
      logResult({
        name: "Register Server with TTP",
        success: false,
        message: `Registration failed: ${data.error}`,
      });
      return null;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logResult({
      name: "Register Server with TTP",
      success: false,
      message: `Network error: ${msg}`,
    });
    return null;
  }
}

// Test 2: Register Client
async function testRegisterClient(publicKey: string) {
  try {
    const response = await fetch(`${TTP_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "test_client_001",
        type: "CLIENT",
        name: "Test Client",
        publicKey,
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      logResult({
        name: "Register Client with TTP",
        success: true,
        message: `Client registered successfully (status ${response.status})`,
        data: { entityId: data.entityId, fingerprint: data.certificate?.fingerprint },
      });
      return data.certificate;
    } else {
      logResult({
        name: "Register Client with TTP",
        success: false,
        message: `Registration failed: ${data.error}`,
      });
      return null;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logResult({
      name: "Register Client with TTP",
      success: false,
      message: `Network error: ${msg}`,
    });
    return null;
  }
}

// Test 3: Verify Client and Get Session Key
async function testVerifyClient(clientCert: string) {
  try {
    const response = await fetch(`${SERVER_URL}/verify-client`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: "test_client_001",
        clientCertificate: clientCert,
        serverId: "test_server_001",
        ttpUrl: TTP_URL,
      }),
    });

    const data = await response.json();

    if (response.ok && data.success) {
      logResult({
        name: "Verify Client and Get Session Keys",
        success: true,
        message: `Verification successful (status ${response.status})`,
        data: { clientId: data.clientId, verified: data.verified },
      });
      return data;
    } else {
      logResult({
        name: "Verify Client and Get Session Keys",
        success: false,
        message: `Verification failed: ${data.error}`,
      });
      return null;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logResult({
      name: "Verify Client and Get Session Keys",
      success: false,
      message: `Network error: ${msg}`,
    });
    return null;
  }
}

// Test 4: Validate Decrypted Session Keys Match
function testSessionKeyDecryption(
  serverPrivate: string,
  clientPrivate: string,
  serverSessionKeyEncrypted: string,
  clientSessionKeyEncrypted: string
) {
  try {
    // Decrypt server session key
    const serverSessionKeyBuffer = privateDecrypt(
      { key: serverPrivate, padding: 4 }, // RSA_PKCS1_OAEP_PADDING = 4
      Buffer.from(serverSessionKeyEncrypted, "base64")
    );
    const serverSessionKey = serverSessionKeyBuffer.toString("base64");

    // Decrypt client session key
    const clientSessionKeyBuffer = privateDecrypt(
      { key: clientPrivate, padding: 4 },
      Buffer.from(clientSessionKeyEncrypted, "base64")
    );
    const clientSessionKey = clientSessionKeyBuffer.toString("base64");

    // Verify they match
    const keysMatch = serverSessionKey === clientSessionKey;

    logResult({
      name: "Session Key Decryption and Validation",
      success: keysMatch,
      message: keysMatch
        ? "Decrypted session keys match (TTP distributed same key to both parties)"
        : "Decrypted session keys DO NOT match (ERROR: keys should be identical)",
      data: {
        serverKeyLength: serverSessionKey.length,
        clientKeyLength: clientSessionKey.length,
        match: keysMatch,
      },
    });

    return keysMatch;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logResult({
      name: "Session Key Decryption and Validation",
      success: false,
      message: `Decryption failed: ${msg}`,
    });
    return false;
  }
}

// Test 5: Test Failed Scenarios
async function testFailureScenarios() {
  // Test with non-existent client
  try {
    const response = await fetch(`${SERVER_URL}/verify-client`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: "nonexistent_client",
        serverId: "test_server_001",
        ttpUrl: TTP_URL,
      }),
    });

    const data = await response.json();
    const success = !data.success && response.status === 401;

    logResult({
      name: "Reject Non-Existent Client",
      success,
      message: success
        ? `Correctly rejected non-existent client (${data.error})`
        : "Failed to reject non-existent client",
    });
  } catch (error) {
    logResult({
      name: "Reject Non-Existent Client",
      success: false,
      message: `Test error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  // Test with missing required fields
  try {
    const response = await fetch(`${SERVER_URL}/verify-client`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const data = await response.json();
    const success = !data.success && response.status === 400;

    logResult({
      name: "Reject Missing Required Fields",
      success,
      message: success
        ? `Correctly rejected invalid request (${data.error})`
        : "Failed to reject invalid request",
    });
  } catch (error) {
    logResult({
      name: "Reject Missing Required Fields",
      success: false,
      message: `Test error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

// Main test runner
async function runTests() {
  console.log(
    "\n=====================================================\n" +
      "     SCS Authentication Flow - Automated Tests\n" +
      "=====================================================\n"
  );

  console.log("Generating RSA keys...");
  const keys = generateKeys();

  console.log("Starting test sequence...");

  // Register server
  const serverCert = await testRegisterServer(keys.serverPublic);
  if (!serverCert) {
    console.error("\n❌ Cannot continue without server registration");
    process.exit(1);
  }

  // Register client
  const clientCert = await testRegisterClient(keys.clientPublic);
  if (!clientCert) {
    console.error("\n❌ Cannot continue without client registration");
    process.exit(1);
  }

  // Verify client and get session keys
  const verifyResult = await testVerifyClient(clientCert.pem);
  if (!verifyResult) {
    console.error("\n❌ Cannot continue without successful verification");
    process.exit(1);
  }

  // Test session key decryption
  testSessionKeyDecryption(
    keys.serverPrivate,
    keys.clientPrivate,
    verifyResult.sessionKey,
    verifyResult.clientSessionKey
  );

  // Test failure scenarios
  await testFailureScenarios();

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
    console.log("✓ All tests passed! Authentication flow is working correctly.\n");
  } else {
    console.log("✗ Some tests failed. Check the output above for details.\n");
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error("Test runner error:", error);
  process.exit(1);
});
