/**
 * TTP API endpoint tests
 * Tests POST /register, /authenticate, /session-key endpoints
 */

import { createRegistry } from "../src/registry";
import { handleRegister, handleAuthenticate, handleSessionKey } from "../src/routes";

console.log("\n=== TTP API Endpoint Tests ===\n");

const registry = createRegistry();

// Test 1: Register a client
console.log("1. Testing POST /register - Client Registration");
const clientData = {
  id: "client_alice_001",
  type: "CLIENT",
  name: "Alice",
  publicKey: "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgk...\n-----END PUBLIC KEY-----",
};

const clientRequest = new Request("http://localhost:3002/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(clientData),
});

const clientResponse = await handleRegister(clientRequest, registry);
const clientResult = await clientResponse.json();
console.log("   Response status:", clientResponse.status);
console.log("   Response:", clientResult);

// Test 2: Register a server
console.log("\n2. Testing POST /register - Server Registration");
const serverData = {
  id: "server_app_001",
  type: "SERVER",
  name: "Application Server",
  publicKey: "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgk...\n-----END PUBLIC KEY-----",
};

const serverRequest = new Request("http://localhost:3002/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(serverData),
});

const serverResponse = await handleRegister(serverRequest, registry);
const serverResult = await serverResponse.json();
console.log("   Response status:", serverResponse.status);
console.log("   Response:", serverResult);

// Test 3: Try to register duplicate client (should fail)
console.log("\n3. Testing POST /register - Duplicate Client (should fail)");
const duplicateRequest = new Request("http://localhost:3002/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(clientData),
});

const duplicateResponse = await handleRegister(duplicateRequest, registry);
const duplicateResult = await duplicateResponse.json();
console.log("   Response status:", duplicateResponse.status);
console.log("   Response:", duplicateResult);

// Test 4: Authenticate client
console.log("\n4. Testing POST /authenticate - Valid Authentication");
const authData = {
  clientId: "client_alice_001",
  serverId: "server_app_001",
  clientCertificate: "cert_data_here",
};

const authRequest = new Request("http://localhost:3002/authenticate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(authData),
});

const authResponse = await handleAuthenticate(authRequest, registry);
const authResult = await authResponse.json();
console.log("   Response status:", authResponse.status);
console.log("   Response:", authResult);

// Test 5: Authenticate with non-existent client
console.log("\n5. Testing POST /authenticate - Non-existent Client (should fail)");
const invalidAuthData = {
  clientId: "client_unknown_999",
  serverId: "server_app_001",
};

const invalidAuthRequest = new Request("http://localhost:3002/authenticate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(invalidAuthData),
});

const invalidAuthResponse = await handleAuthenticate(invalidAuthRequest, registry);
const invalidAuthResult = await invalidAuthResponse.json();
console.log("   Response status:", invalidAuthResponse.status);
console.log("   Response:", invalidAuthResult);

// Test 6: Request session key
console.log("\n6. Testing POST /session-key - Session Key Generation");
const sessionKeyData = {
  clientId: "client_alice_001",
  serverId: "server_app_001",
};

const sessionKeyRequest = new Request("http://localhost:3002/session-key", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(sessionKeyData),
});

const sessionKeyResponse = await handleSessionKey(sessionKeyRequest, registry);
const sessionKeyResult = await sessionKeyResponse.json();
console.log("   Response status:", sessionKeyResponse.status);
console.log("   Response:", sessionKeyResult);

// Test 7: Missing required fields
console.log("\n7. Testing POST /register - Missing Required Fields (should fail)");
const invalidRegisterData = {
  id: "invalid_client",
  type: "CLIENT",
  // Missing 'name' and 'publicKey'
};

const invalidRegisterRequest = new Request("http://localhost:3002/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(invalidRegisterData),
});

const invalidRegisterResponse = await handleRegister(invalidRegisterRequest, registry);
const invalidRegisterResult = await invalidRegisterResponse.json();
console.log("   Response status:", invalidRegisterResponse.status);
console.log("   Response:", invalidRegisterResult);

// Test 8: Invalid entity type
console.log("\n8. Testing POST /register - Invalid Entity Type (should fail)");
const invalidTypeData = {
  id: "invalid_entity",
  type: "ADMIN", // Invalid type
  name: "Invalid Entity",
  publicKey: "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgk...\n-----END PUBLIC KEY-----",
};

const invalidTypeRequest = new Request("http://localhost:3002/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(invalidTypeData),
});

const invalidTypeResponse = await handleRegister(invalidTypeRequest, registry);
const invalidTypeResult = await invalidTypeResponse.json();
console.log("   Response status:", invalidTypeResponse.status);
console.log("   Response:", invalidTypeResult);

console.log("\n=== All Tests Completed ===\n");
console.log("Check logs/ttp.log for detailed logging output");
