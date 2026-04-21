type RateLimitState = {
  windowStartMs: number;
  count: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

const DEFAULT_RATE_LIMIT_WINDOW_MS = 10_000;
const DEFAULT_MAX_REQUESTS_PER_IP = 120;
const DEFAULT_MAX_REQUESTS_PER_CLIENT = 60;
const DEFAULT_MAX_WS_UPGRADES_PER_IP = 40;
const DEFAULT_MAX_WS_MESSAGES_PER_CLIENT = 100;

const CLEANUP_INTERVAL_MS = 30_000;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

const RATE_LIMIT_WINDOW_MS = parsePositiveInt(
  process.env.RATE_LIMIT_WINDOW_MS,
  DEFAULT_RATE_LIMIT_WINDOW_MS,
);

const MAX_REQUESTS_PER_IP = parsePositiveInt(
  process.env.RATE_LIMIT_MAX_REQUESTS_PER_IP,
  DEFAULT_MAX_REQUESTS_PER_IP,
);

const MAX_REQUESTS_PER_CLIENT = parsePositiveInt(
  process.env.RATE_LIMIT_MAX_REQUESTS_PER_CLIENT,
  DEFAULT_MAX_REQUESTS_PER_CLIENT,
);

const MAX_WS_UPGRADES_PER_IP = parsePositiveInt(
  process.env.RATE_LIMIT_MAX_WS_UPGRADES_PER_IP,
  DEFAULT_MAX_WS_UPGRADES_PER_IP,
);

const MAX_WS_MESSAGES_PER_CLIENT = parsePositiveInt(
  process.env.RATE_LIMIT_MAX_WS_MESSAGES_PER_CLIENT,
  DEFAULT_MAX_WS_MESSAGES_PER_CLIENT,
);

const rateLimitStore = new Map<string, RateLimitState>();
let lastCleanupMs = Date.now();

function cleanupExpiredWindows(nowMs: number): void {
  if (nowMs - lastCleanupMs < CLEANUP_INTERVAL_MS) {
    return;
  }

  for (const [key, state] of rateLimitStore.entries()) {
    if (nowMs - state.windowStartMs >= RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.delete(key);
    }
  }

  lastCleanupMs = nowMs;
}

function applyLimit(key: string, maxRequests: number): RateLimitResult {
  const nowMs = Date.now();
  cleanupExpiredWindows(nowMs);

  const existing = rateLimitStore.get(key);
  if (!existing) {
    rateLimitStore.set(key, { windowStartMs: nowMs, count: 1 });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const elapsedMs = nowMs - existing.windowStartMs;
  if (elapsedMs >= RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(key, { windowStartMs: nowMs, count: 1 });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= maxRequests) {
    const retryAfterMs = Math.max(0, RATE_LIMIT_WINDOW_MS - elapsedMs);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  existing.count += 1;
  rateLimitStore.set(key, existing);
  return { allowed: true, retryAfterSeconds: 0 };
}

export function getRequestIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const ip = forwardedFor.split(",")[0]?.trim();
    if (ip) return ip;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  return "unknown-ip";
}

export function checkHttpRateLimit(request: Request, scope: string, clientId?: string): RateLimitResult {
  const ip = getRequestIp(request);
  const ipKey = `http:ip:${scope}:${ip}`;
  const ipResult = applyLimit(ipKey, MAX_REQUESTS_PER_IP);
  if (!ipResult.allowed) {
    return ipResult;
  }

  if (!clientId) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const clientKey = `http:client:${scope}:${ip}:${clientId}`;
  return applyLimit(clientKey, MAX_REQUESTS_PER_CLIENT);
}

export function checkWsUpgradeRateLimit(ip: string, clientId?: string): RateLimitResult {
  const ipKey = `ws:upgrade:ip:${ip}`;
  const ipResult = applyLimit(ipKey, MAX_WS_UPGRADES_PER_IP);
  if (!ipResult.allowed) {
    return ipResult;
  }

  if (!clientId) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const clientKey = `ws:upgrade:client:${ip}:${clientId}`;
  return applyLimit(clientKey, MAX_REQUESTS_PER_CLIENT);
}

export function checkWsMessageRateLimit(ip: string, clientId: string): RateLimitResult {
  const key = `ws:message:${ip}:${clientId}`;
  return applyLimit(key, MAX_WS_MESSAGES_PER_CLIENT);
}

export function makeRateLimitResponse(retryAfterSeconds: number, message?: string): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: message || "Too many requests. Please retry later.",
      retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}
