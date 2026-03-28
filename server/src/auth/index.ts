/**
 * Server authentication utilities
 * Handles authentication with TTP and session key management
 */

import { timingSafeEqual } from "crypto";
import { isValidAES256Key } from "../crypto/index.js";
import { getAllSessions } from "../session/index.js";

export interface AuthResult {
  success: boolean;
  clientId?: string;
  sessionKey?: string;
  clientSessionKey?: string;
  serverSessionKey?: string;
  message?: string;
  error?: string;
}

/**
 * Verify client certificate with TTP.
 * Sends certificate to TTP for X.509 parsing, validity and fingerprint checks.
 */
export async function verifyClientCertificate(
  clientId: string,
  certificate?: string,
  ttpUrl: string = process.env.TTP_URL || "http://localhost:3002"
): Promise<AuthResult> {
  if (!clientId || !certificate) {
    return {
      success: false,
      error: "Client ID and certificate are required",
    };
  }

  if (!ttpUrl) {
    return {
      success: false,
      error: "TTP URL is required",
    };
  }

  try {
    const response = await fetch(`${ttpUrl}/validate-certificate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clientId,
        clientCertificate: certificate,
      }),
    });

    const data = (await response.json()) as any;

    if (!response.ok) {
      return {
        success: false,
        error: data.error || "Certificate verification failed",
      };
    }

    return {
      success: true,
      clientId,
      message: data.message || "Client certificate verified",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: `TTP certificate verification request failed: ${message}`,
    };
  }
}

/**
 * Request server authentication from TTP.
 * Server authenticates itself using its certificate.
 */
export async function requestServerAuthenticationFromTTP(
  ttpUrl: string,
  serverId: string,
  serverCertificate?: string
): Promise<AuthResult> {
  if (!serverId) {
    return {
      success: false,
      error: "Server ID is required",
    };
  }

  if (!ttpUrl) {
    return {
      success: false,
      error: "TTP URL is required",
    };
  }

  try {
    const response = await fetch(`${ttpUrl}/authenticate-server`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        serverId,
        serverCertificate,
      }),
    });

    const data = (await response.json()) as any;

    if (!response.ok) {
      return {
        success: false,
        error: data.error || "Server authentication failed",
      };
    }

    return {
      success: true,
      message: data.message || "Server authenticated successfully",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: `Server authentication request failed: ${message}`,
    };
  }
}

/**
 * Request authentication from TTP
 * Makes HTTP POST request to TTP /authenticate endpoint
 */
export async function requestAuthenticationFromTTP(
  ttpUrl: string,
  clientId: string,
  serverId: string,
  clientCertificate?: string
): Promise<AuthResult> {
  if (!clientId || !serverId) {
    return {
      success: false,
      error: "Client ID and Server ID are required",
    };
  }

  if (!ttpUrl) {
    return {
      success: false,
      error: "TTP URL is required",
    };
  }

  try {
    const response = await fetch(`${ttpUrl}/authenticate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clientId,
        serverId,
        clientCertificate,
      }),
    });

    const data = (await response.json()) as any;

    if (!response.ok) {
      return {
        success: false,
        error: data.error || "Authentication failed",
      };
    }

    return {
      success: true,
      clientId,
      message: data.message,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: `TTP authentication request failed: ${message}`,
    };
  }
}

/**
 * Request session key from TTP
 * Makes HTTP POST request to TTP /session-key endpoint
 * Returns encrypted session keys for both client and server
 */
export async function requestSessionKeyFromTTP(
  ttpUrl: string,
  clientId: string,
  serverId: string
): Promise<{
  success: boolean;
  sessionKey?: string; // Encrypted for server
  clientSessionKey?: string; // Encrypted for client (for relaying)
  serverSessionKey?: string; // Encrypted for server
  message?: string;
  error?: string;
}> {
  if (!clientId || !serverId) {
    return {
      success: false,
      error: "Client ID and Server ID are required",
    };
  }

  if (!ttpUrl) {
    return {
      success: false,
      error: "TTP URL is required",
    };
  }

  try {
    const response = await fetch(`${ttpUrl}/session-key`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clientId,
        serverId,
      }),
    });

    const data = (await response.json()) as any;

    if (!response.ok) {
      return {
        success: false,
        error: data.error || "Session key request failed",
      };
    }

    return {
      success: true,
      clientSessionKey: data.clientSessionKey,
      serverSessionKey: data.serverSessionKey,
      message: data.message,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      success: false,
      error: `TTP session key request failed: ${message}`,
    };
  }
}

/**
 * Authenticate client with TTP (deprecated - use requestAuthenticationFromTTP and requestSessionKeyFromTTP)
 * TODO: Remove once new flow is fully integrated
 */
export async function authenticateWithTTP(
  clientId: string,
  serverId: string,
  certificate?: string,
  ttpUrl: string = process.env.TTP_URL || "http://localhost:3002"
): Promise<AuthResult> {
  if (!clientId || !serverId) {
    return {
      success: false,
      error: "Client ID and Server ID are required",
    };
  }

  // Step 1: Authenticate client and server with TTP
  const authResult = await requestAuthenticationFromTTP(
    ttpUrl,
    clientId,
    serverId,
    certificate
  );
  if (!authResult.success) {
    return {
      success: false,
      error: authResult.error || "TTP authentication failed",
    };
  }

  // Step 2: Request encrypted session keys from TTP
  const sessionKeyResult = await requestSessionKeyFromTTP(ttpUrl, clientId, serverId);
  if (!sessionKeyResult.success) {
    return {
      success: false,
      error: sessionKeyResult.error || "TTP session key request failed",
    };
  }

  if (!sessionKeyResult.serverSessionKey || !sessionKeyResult.clientSessionKey) {
    return {
      success: false,
      error: "TTP response missing encrypted session keys",
    };
  }

  return {
    success: true,
    clientId,
    // Backward-compatible alias for older callers expecting `sessionKey`.
    sessionKey: sessionKeyResult.serverSessionKey,
    serverSessionKey: sessionKeyResult.serverSessionKey,
    clientSessionKey: sessionKeyResult.clientSessionKey,
    message: "Authentication successful with TTP session key issuance",
  };
}

/**
 * Verify session key against active sessions for the client.
 * Expects a base64-encoded AES-256 key.
 */
export async function verifySessionKey(
  clientId: string,
  sessionKey?: string,
  serverId?: string
): Promise<AuthResult> {
  if (!clientId || !sessionKey) {
    return {
      success: false,
      error: "Client ID and session key are required",
    };
  }

  if (!isValidAES256Key(sessionKey)) {
    return {
      success: false,
      error: "Invalid session key format",
    };
  }

  const activeSessionsForClient = getAllSessions().filter((session) => {
    if (session.clientId !== clientId) {
      return false;
    }

    if (serverId && session.serverId !== serverId) {
      return false;
    }

    return true;
  });
  if (activeSessionsForClient.length === 0) {
    return {
      success: false,
      error: serverId
        ? "No active session found for client and server"
        : "No active session found for client",
    };
  }

  const providedKeyBuffer = Buffer.from(sessionKey, "base64");
  const hasMatchingSession = activeSessionsForClient.some((session) => {
    const storedKeyBuffer = Buffer.from(session.sessionKey, "base64");
    if (storedKeyBuffer.length !== providedKeyBuffer.length) {
      return false;
    }

    return timingSafeEqual(storedKeyBuffer, providedKeyBuffer);
  });

  if (!hasMatchingSession) {
    return {
      success: false,
      error: "Session key does not match active session",
    };
  }

  return {
    success: true,
    clientId,
    message: "Session key verified",
  };
}

/**
 * Authorize service access using policy rules.
 * - Unknown services are denied
 * - Sensitive services require an active session
 */
export async function authorizeServiceAccess(
  clientId: string,
  serviceType: string
): Promise<AuthResult> {
  if (!clientId || !serviceType) {
    return {
      success: false,
      error: "Client ID and service type are required",
    };
  }

  // Basic client identity format guard.
  if (!/^client_[a-zA-Z0-9_-]+$/.test(clientId)) {
    return {
      success: false,
      error: "Invalid client ID format",
    };
  }

  const normalizedServiceType = serviceType.trim().toLowerCase();
  if (!normalizedServiceType) {
    return {
      success: false,
      error: "Service type is required",
    };
  }

  // Services supported by the server.
  const supportedServices = new Set([
    "database_query",
    "file_upload",
    "api_call",
    "report_generation",
    "messaging",
  ]);

  if (!supportedServices.has(normalizedServiceType)) {
    return {
      success: false,
      error: `Unsupported service type: ${serviceType}`,
    };
  }

  // Sensitive services require an active session with this client.
  const sessionRequiredServices = new Set(["messaging", "file_upload"]);
  if (sessionRequiredServices.has(normalizedServiceType)) {
    const hasActiveSession = getAllSessions().some(
      (session) => session.clientId === clientId
    );

    if (!hasActiveSession) {
      return {
        success: false,
        error: `Active session required for service: ${serviceType}`,
      };
    }
  }

  return {
    success: true,
    clientId,
    message: `Access to ${normalizedServiceType} authorized`,
  };
}

