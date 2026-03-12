/**
 * SCS Project - Server
 * Provides service to authenticated clients
 */

const PORT = 3001;

console.log(`[${new Date().toISOString()}] Server starting on port ${PORT}`);

const server = Bun.serve({
  port: PORT,
  fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/" && request.method === "GET") {
      return new Response("SCS Server is running", { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`[${new Date().toISOString()}] Server listening at http://localhost:${PORT}`);
