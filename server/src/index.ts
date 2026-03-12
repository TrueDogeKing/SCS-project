/**
 * SCS Project - Server
 * Provides service to authenticated clients
 */

import { logInfo } from "./logs";
import { handleServiceRequest, handleVerifyClient, handleSendMessage, handleReceiveMessage, handleSendToClient } from "./routes";
import { getServerPublicKey } from "./keys";

const PORT = 3001;

logInfo("SYSTEM_START", {
  message: `Server starting on port ${PORT}`,
});

const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);

    // GET / - Health check
    if (url.pathname === "/" && request.method === "GET") {
      return new Response("SCS Server is running", { status: 200 });
    }

    // GET /public-key - Return server's RSA public key
    if (url.pathname === "/public-key" && request.method === "GET") {
      return new Response(
        JSON.stringify({ publicKey: getServerPublicKey() }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // POST /service-request - Client requests service
    if (url.pathname === "/service-request" && request.method === "POST") {
      return handleServiceRequest(request);
    }

    // POST /verify-client - Server verifies client
    if (url.pathname === "/verify-client" && request.method === "POST") {
      return handleVerifyClient(request);
    }

    // POST /message/send - Client sends encrypted message to server
    if (url.pathname === "/message/send" && request.method === "POST") {
      return handleSendMessage(request);
    }

    // POST /message/receive - Client receives encrypted messages
    if (url.pathname === "/message/receive" && request.method === "POST") {
      return handleReceiveMessage(request);
    }

    // POST /message/send-to-client - Server sends encrypted message to client
    if (url.pathname === "/message/send-to-client" && request.method === "POST") {
      return handleSendToClient(request);
    }

    return new Response("Not Found", { status: 404 });
  },
});

logInfo("SYSTEM_START", {
  message: `Server listening at http://localhost:${PORT}`,
});
