/**
 * SCS Project - Server
 * Provides service to authenticated clients
 */

import { logInfo } from "./logs";
import { handleServiceRequest, handleVerifyClient } from "./routes";

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

    // POST /service-request - Client requests service
    if (url.pathname === "/service-request" && request.method === "POST") {
      return handleServiceRequest(request);
    }

    // POST /verify-client - Server verifies client
    if (url.pathname === "/verify-client" && request.method === "POST") {
      return handleVerifyClient(request);
    }

    return new Response("Not Found", { status: 404 });
  },
});

logInfo("SYSTEM_START", {
  message: `Server listening at http://localhost:${PORT}`,
});
