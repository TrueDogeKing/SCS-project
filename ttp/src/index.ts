/**
 * SCS Project - Trusted Third Party
 * Authentication Authority and Session Key Distributor
 */

import { createRegistry } from "./registry";
import { logInfo } from "./logs";
import { handleRegister, handleAuthenticate, handleSessionKey } from "./routes";

const PORT = 3002;

// Create entity registry
const registry = createRegistry();

logInfo("SYSTEM_START", {
  entityType: "SYSTEM",
  message: `TTP starting on port ${PORT}`,
});

const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);

    // GET / - Health check
    if (url.pathname === "/" && request.method === "GET") {
      return new Response("Trusted Third Party (TTP) is running", { status: 200 });
    }

    // POST /register - Register client or server
    if (url.pathname === "/register" && request.method === "POST") {
      return handleRegister(request, registry);
    }

    // POST /authenticate - Authenticate client
    if (url.pathname === "/authenticate" && request.method === "POST") {
      return handleAuthenticate(request, registry);
    }

    // POST /session-key - Generate and distribute session key
    if (url.pathname === "/session-key" && request.method === "POST") {
      return handleSessionKey(request, registry);
    }

    return new Response("Not Found", { status: 404 });
  },
});

logInfo("SYSTEM_START", {
  entityType: "SYSTEM",
  message: `TTP listening at http://localhost:${PORT}`,
});
