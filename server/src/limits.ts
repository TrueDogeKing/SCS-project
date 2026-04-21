const DEFAULT_MAX_POST_BODY_BYTES = 64 * 1024;
const DEFAULT_MAX_WEBSOCKET_MESSAGE_BYTES = 64 * 1024;
const DEFAULT_MAX_ENCRYPTED_CIPHERTEXT_CHARS = 32 * 1024;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

export const MAX_POST_BODY_BYTES = parsePositiveInt(
  process.env.MAX_POST_BODY_BYTES,
  DEFAULT_MAX_POST_BODY_BYTES,
);

export const MAX_WEBSOCKET_MESSAGE_BYTES = parsePositiveInt(
  process.env.MAX_WEBSOCKET_MESSAGE_BYTES,
  DEFAULT_MAX_WEBSOCKET_MESSAGE_BYTES,
);

export const MAX_ENCRYPTED_CIPHERTEXT_CHARS = parsePositiveInt(
  process.env.MAX_ENCRYPTED_CIPHERTEXT_CHARS,
  DEFAULT_MAX_ENCRYPTED_CIPHERTEXT_CHARS,
);

export function getContentLength(request: Request): number | null {
  const contentLengthHeader = request.headers.get("content-length");
  if (!contentLengthHeader) return null;
  const parsed = Number(contentLengthHeader);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

export async function parseJsonBodyWithLimit<T>(
  request: Request,
  maxBytes: number,
): Promise<{ success: true; body: T } | { success: false; response: Response }> {
  const contentLength = getContentLength(request);
  if (contentLength !== null && contentLength > maxBytes) {
    return {
      success: false,
      response: new Response(
        JSON.stringify({
          success: false,
          error: `Payload too large. Maximum allowed is ${maxBytes} bytes.`,
        }),
        { status: 413, headers: { "Content-Type": "application/json" } },
      ),
    };
  }

  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    return {
      success: false,
      response: new Response(
        JSON.stringify({
          success: false,
          error: "Unable to read request body",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    };
  }

  const actualBytes = new TextEncoder().encode(rawBody).length;
  if (actualBytes > maxBytes) {
    return {
      success: false,
      response: new Response(
        JSON.stringify({
          success: false,
          error: `Payload too large. Maximum allowed is ${maxBytes} bytes.`,
        }),
        { status: 413, headers: { "Content-Type": "application/json" } },
      ),
    };
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return {
      success: false,
      response: new Response(
        JSON.stringify({
          success: false,
          error: "Invalid JSON body",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      ),
    };
  }

  return {
    success: true,
    body: parsedBody as T,
  };
}
