import { createRegistry } from "./registry";
import { logInfo } from "./logInfo";
import {
  handleRegister,
  handleAuthenticate,
  handleAuthenticateServer,
  handleValidateCertificate,
  handleSessionKey,
} from "./routes";

const PORT = 3002;

// Create entity registry
const registry = createRegistry();

logInfo("SYSTEM_START", {
  entityType: "SYSTEM",
  message: `TTP starting on port ${PORT}`,
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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
      return new Response("Trusted Third Party (TTP) is running", { status: 200, headers: CORS_HEADERS });
    }

    // POST /register - Register client or server
    if (url.pathname === "/register" && request.method === "POST") {
      const res = await handleRegister(request, registry);
      return addCorsHeaders(res);
    }

    // POST /authenticate - Authenticate client
    if (url.pathname === "/authenticate" && request.method === "POST") {
      const res = await handleAuthenticate(request, registry);
      return addCorsHeaders(res);
    }

    // POST /authenticate-server - Authenticate server
    if (url.pathname === "/authenticate-server" && request.method === "POST") {
      const res = await handleAuthenticateServer(request, registry);
      return addCorsHeaders(res);
    }

    // POST /validate-certificate - Validate client X.509 certificate
    if (url.pathname === "/validate-certificate" && request.method === "POST") {
      const res = await handleValidateCertificate(request, registry);
      return addCorsHeaders(res);
    }

    // POST /session-key - Generate and distribute session key
    if (url.pathname === "/session-key" && request.method === "POST") {
      const res = await handleSessionKey(request, registry);
      return addCorsHeaders(res);
    }

    return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
  },
});

logInfo("SYSTEM_START", {
  entityType: "SYSTEM",
  message: `TTP listening at http://localhost:${PORT}`,
});
