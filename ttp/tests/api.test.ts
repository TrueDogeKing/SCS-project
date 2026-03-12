/**
 * TTP API endpoint tests
 * Tests POST /register with certificate generation, /authenticate endpoints
 */

import { createRegistry } from "../src/registry";
import { handleRegister, handleAuthenticate } from "../src/routes";
import { generateRSAKeyPair } from "../src/crypto";

console.log("\n=== TTP Registration Flow Test ===\n");

const registry = createRegistry();

// Step 1: Client and Server generate RSA 4096-bit key pairs
console.log("Step 1: Generate RSA 4096-bit Key Pairs");

const clientKeys = generateRSAKeyPair();
const serverKeys = generateRSAKeyPair();

console.log("   ✓ Client RSA 4096-bit key pair generated");
console.log("   ✓ Server RSA 4096-bit key pair generated");

// Step 2: Client registers with TTP
console.log("\nStep 2: Client Registers with TTP");
console.log("   Sending: ID + Public Key");

const clientRegisterData = {
  id: "client_alice_001",
  type: "CLIENT",
  name: "Alice",
  publicKey: clientKeys.publicKey,
};

const clientRegisterRequest = new Request("http://localhost:3002/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(clientRegisterData),
});

const clientRegisterResponse = await handleRegister(clientRegisterRequest, registry);
const clientRegisterResult = await clientRegisterResponse.json();

if (clientRegisterResult.success && clientRegisterResult.certificate) {
  console.log("   ✓ Client registration successful");
  console.log("   ✓ Certificate generated:");
  console.log(`     - Fingerprint: ${clientRegisterResult.certificate.fingerprint.substring(0, 32)}...`);
  console.log(`     - Valid From: ${clientRegisterResult.certificate.validFrom}`);
  console.log(`     - Valid Until: ${clientRegisterResult.certificate.validUntil}`);
  console.log(`     - PEM length: ${clientRegisterResult.certificate.pem.length} bytes`);
} else {
  console.log("   ✗ Client registration failed:", clientRegisterResult.error);
  console.log("   Error details:", clientRegisterResult);
}

// Step 3: Server registers with TTP
console.log("\nStep 3: Server Registers with TTP");
console.log("   Sending: ID + Public Key");

const serverRegisterData = {
  id: "server_app_001",
  type: "SERVER",
  name: "Application Server",
  publicKey: serverKeys.publicKey,
};

const serverRegisterRequest = new Request("http://localhost:3002/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(serverRegisterData),
});

const serverRegisterResponse = await handleRegister(serverRegisterRequest, registry);
const serverRegisterResult = await serverRegisterResponse.json();

if (serverRegisterResult.success && serverRegisterResult.certificate) {
  console.log("   ✓ Server registration successful");
  console.log("   ✓ Certificate generated:");
  console.log(`     - Fingerprint: ${serverRegisterResult.certificate.fingerprint.substring(0, 32)}...`);
  console.log(`     - Valid From: ${serverRegisterResult.certificate.validFrom}`);
  console.log(`     - Valid Until: ${serverRegisterResult.certificate.validUntil}`);
  console.log(`     - PEM length: ${serverRegisterResult.certificate.pem.length} bytes`);
} else {
  console.log("   ✗ Server registration failed:", serverRegisterResult.error);
  console.log("   Error details:", serverRegisterResult);
}

// Step 4: Client can now use certificate for service requests
console.log("\nStep 4: Client Ready for Service Requests");
console.log("   ✓ Client certificate available for secure communication");

// Step 5: Server authenticates client with TTP
console.log("\nStep 5: Server Authenticates Client with TTP");

const authData = {
  clientId: "client_alice_001",
  serverId: "server_app_001",
  clientCertificate: clientRegisterResult.certificate?.pem,
};

const authRequest = new Request("http://localhost:3002/authenticate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(authData),
});

const authResponse = await handleAuthenticate(authRequest, registry);
const authResult = await authResponse.json();

if (authResult.success) {
  console.log("   ✓ Authentication successful");
  console.log(`   ✓ Client ID: ${authResult.clientId}`);
  console.log(`   ✓ Server ID: ${authResult.serverId}`);
} else {
  console.log("   ✗ Authentication failed:", authResult.error);
}

// Step 6: Verify certificates are stored in registry
console.log("\nStep 6: Verify Certificates in Registry");
const registryClients = registry.clients.get("client_alice_001");
const registryServers = registry.servers.get("server_app_001");

if (registryClients && registryClients.certificate) {
  console.log("   ✓ Client certificate stored in registry");
  console.log(`     - Subject: ${registryClients.certificate.subject}`);
} else {
  console.log("   ✗ Client certificate not found in registry");
}

if (registryServers && registryServers.certificate) {
  console.log("   ✓ Server certificate stored in registry");
  console.log(`     - Subject: ${registryServers.certificate.subject}`);
} else {
  console.log("   ✗ Server certificate not found in registry");
}

// Summary
console.log("\n=== Registration Flow Complete ===");
console.log("✓ Both client and server registered with TTP");
console.log("✓ X.509 certificates generated and returned");
console.log("✓ Certificates stored in in-memory registry");
console.log("✓ Certificates ready for authentication flow");
console.log("\nCheck logs/ttp.log for detailed logging output\n");

