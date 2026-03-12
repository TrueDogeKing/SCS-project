/**
 * SCS Project - Trusted Third Party
 * Authentication Authority and Session Key Distributor
 */

const PORT = 3002;

console.log(`[${new Date().toISOString()}] TTP starting on port ${PORT}`);

const server = Bun.serve({
  port: PORT,
  fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/" && request.method === "GET") {
      return new Response("Trusted Third Party (TTP) is running", { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`[${new Date().toISOString()}] TTP listening at http://localhost:${PORT}`);
