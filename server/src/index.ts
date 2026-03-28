/**
 * SCS Project - Server
 * Provides service to authenticated clients
 */

import { logInfo } from "./logInfo/index.js";
import { handleServiceRequest, handleVerifyClient, handleSendMessage, handleReceiveMessage, handleSendToClient } from "./routes/index.js";
import { getServerPublicKey } from "./keys.js";

import { registerServerWithTTP } from "./registerWithTTP.js";

const PORT = 3001;

logInfo("SYSTEM_START", {
  message: `Server starting on port ${PORT}`,
});

// Register server with TTP on startup
const SERVER_ID = "server_001";
const SERVER_NAME = "Application Server";
const TTP_URL = process.env.TTP_URL || "http://localhost:3002";

async function tryRegisterWithTTP() {
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      const res = await registerServerWithTTP(TTP_URL, SERVER_ID, SERVER_NAME);
      if (res.success) {
        logInfo("TTP_REGISTER", {
          message: `Server registered with TTP (fingerprint: ${res.certificate?.fingerprint?.substring(0, 16) || "unknown"})`,
        });
        return;
      } else {
        logInfo("TTP_REGISTER", {
          message: `TTP registration failed: ${res.error || "unknown error"}`,
        });
      }
    } catch (err) {
      logInfo("TTP_REGISTER", {
        message: `TTP not available (attempt ${attempt}), retrying...`,
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  logInfo("TTP_REGISTER", {
    message: "Failed to register with TTP after multiple attempts.",
  });
}

tryRegisterWithTTP();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // GET / - Health check
    if (url.pathname === "/" && request.method === "GET") {
      return new Response("SCS Server is running", { status: 200, headers: CORS_HEADERS });
    }

    // GET /public-key - Return server's RSA public key
    if (url.pathname === "/public-key" && request.method === "GET") {
      return new Response(
        JSON.stringify({ publicKey: getServerPublicKey() }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // POST /service-request - Client requests service
    if (url.pathname === "/service-request" && request.method === "POST") {
      const res = await handleServiceRequest(request);
      return addCorsHeaders(res);
    }

    // POST /verify-client - Server verifies client
    if (url.pathname === "/verify-client" && request.method === "POST") {
      const res = await handleVerifyClient(request);
      return addCorsHeaders(res);
    }

    // POST /message/send - Client sends encrypted message to server
    if (url.pathname === "/message/send" && request.method === "POST") {
      const res = await handleSendMessage(request);
      return addCorsHeaders(res);
    }

    // POST /message/receive - Client receives encrypted messages
    if (url.pathname === "/message/receive" && request.method === "POST") {
      const res = await handleReceiveMessage(request);
      return addCorsHeaders(res);
    }

    // POST /message/send-to-client - Server sends encrypted message to client
    if (url.pathname === "/message/send-to-client" && request.method === "POST") {
      const res = await handleSendToClient(request);
      return addCorsHeaders(res);
    }

    return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
  },
});

function addCorsHeaders(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    newHeaders.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

logInfo("SYSTEM_START", {
  message: `Server listening at http://localhost:${PORT}`,
});
