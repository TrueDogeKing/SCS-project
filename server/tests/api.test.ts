/**
 * Server API endpoint tests
 * Tests POST /service-request and /verify-client endpoints
 */

import { handleServiceRequest, handleVerifyClient } from "../src/routes";

console.log("\n=== Server API Endpoint Tests ===\n");

// Test 1: Service request with valid data
console.log("1. Testing POST /service-request - Valid Request");
const serviceRequestData = {
  clientId: "client_alice_001",
  serviceType: "database_query",
  clientCertificate: "cert_data_here",
};

const serviceRequest = new Request("http://localhost:3001/service-request", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(serviceRequestData),
});

const serviceResponse = await handleServiceRequest(serviceRequest);
const serviceResult = await serviceResponse.json();
console.log("   Response status:", serviceResponse.status);
console.log("   Response:", serviceResult);

// Test 2: Service request without clientId
console.log("\n2. Testing POST /service-request - Missing clientId (should fail)");
const invalidServiceData = {
  serviceType: "database_query",
};

const invalidServiceRequest = new Request("http://localhost:3001/service-request", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(invalidServiceData),
});

const invalidServiceResponse = await handleServiceRequest(invalidServiceRequest);
const invalidServiceResult = await invalidServiceResponse.json();
console.log("   Response status:", invalidServiceResponse.status);
console.log("   Response:", invalidServiceResult);

// Test 3: Service request without serviceType
console.log("\n3. Testing POST /service-request - Missing serviceType (should fail)");
const missingTypeData = {
  clientId: "client_alice_001",
};

const missingTypeRequest = new Request("http://localhost:3001/service-request", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(missingTypeData),
});

const missingTypeResponse = await handleServiceRequest(missingTypeRequest);
const missingTypeResult = await missingTypeResponse.json();
console.log("   Response status:", missingTypeResponse.status);
console.log("   Response:", missingTypeResult);

// Test 4: Verify client with valid data
console.log("\n4. Testing POST /verify-client - Valid Request");
const verifyData = {
  clientId: "client_alice_001",
  clientCertificate: "cert_data_here",
  sessionId: "session_12345",
};

const verifyRequest = new Request("http://localhost:3001/verify-client", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(verifyData),
});

const verifyResponse = await handleVerifyClient(verifyRequest);
const verifyResult = await verifyResponse.json();
console.log("   Response status:", verifyResponse.status);
console.log("   Response:", verifyResult);

// Test 5: Verify client without clientId
console.log("\n5. Testing POST /verify-client - Missing clientId (should fail)");
const invalidVerifyData = {
  clientCertificate: "cert_data_here",
};

const invalidVerifyRequest = new Request("http://localhost:3001/verify-client", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(invalidVerifyData),
});

const invalidVerifyResponse = await handleVerifyClient(invalidVerifyRequest);
const invalidVerifyResult = await invalidVerifyResponse.json();
console.log("   Response status:", invalidVerifyResponse.status);
console.log("   Response:", invalidVerifyResult);

// Test 6: Verify client with session ID
console.log("\n6. Testing POST /verify-client - With Session ID");
const verifyWithSessionData = {
  clientId: "client_bob_002",
  sessionId: "session_67890",
};

const verifyWithSessionRequest = new Request("http://localhost:3001/verify-client", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(verifyWithSessionData),
});

const verifyWithSessionResponse = await handleVerifyClient(verifyWithSessionRequest);
const verifyWithSessionResult = await verifyWithSessionResponse.json();
console.log("   Response status:", verifyWithSessionResponse.status);
console.log("   Response:", verifyWithSessionResult);

// Test 7: Service request for different service types
console.log("\n7. Testing POST /service-request - Different Service Types");
const serviceTypes = ["file_upload", "api_call", "report_generation"];

for (const serviceType of serviceTypes) {
  const requestData = {
    clientId: "client_charlie_003",
    serviceType,
  };

  const request = new Request("http://localhost:3001/service-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestData),
  });

  const response = await handleServiceRequest(request);
  const result = await response.json();
  console.log(`   ✓ Service type '${serviceType}': ${result.message}`);
}

console.log("\n=== All Tests Completed ===\n");
console.log("Check logs/server.log for detailed logging output");
