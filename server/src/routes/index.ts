/**
 * Server API routes
 * Implements POST /service-request and POST /verify-client endpoints
 */

import { logInfo, logWarn, logError, logSuccess } from "../logs";
import { ServiceRequestBody, VerifyRequestBody } from "./types";
import {
  verifyClientCertificate,
  authorizeServiceAccess,
  requestAuthenticationFromTTP,
  requestSessionKeyFromTTP,
} from "../auth";
import { createSession } from "../session";
import { decryptWithRSAPrivateKeyAsString } from "../crypto";
import { getServerPrivateKey } from "../keys";

// Re-export message handlers
export { handleSendMessage, handleReceiveMessage, handleSendToClient } from "./messages";

/**
 * Handle POST /service-request requests
 * Request body: { clientId, serviceType, clientCertificate }
 */
export async function handleServiceRequest(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as ServiceRequestBody;
    const { clientId, serviceType, clientCertificate } = body;

    // Validate request
    if (!clientId || !serviceType) {
      logWarn("REQUEST_INVALID", {
        clientId,
        message: "Service request missing required fields",
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: clientId, serviceType",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    logInfo("SERVICE_REQUEST", {
      clientId,
      message: `Service request from client`,
      details: { serviceType },
    });

    // Verify client certificate
    const certVerification = await verifyClientCertificate(clientId, clientCertificate);
    if (!certVerification.success) {
      logWarn("REQUEST_INVALID", {
        clientId,
        message: "Certificate verification failed",
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Certificate verification failed",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Authorize service access
    const authResult = await authorizeServiceAccess(clientId, serviceType);
    if (!authResult.success) {
      logWarn("REQUEST_INVALID", {
        clientId,
        message: "Service authorization failed",
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Service authorization failed",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    logSuccess("SERVICE_REQUEST", {
      clientId,
      message: `Service request authorized`,
      details: { serviceType },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Service request authorized",
        clientId,
        serviceType,
        status: "AUTHORIZED",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logError("ERROR", {
      message: `Service request handler error: ${message}`,
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * Handle POST /verify-client requests
 * Request body: { clientId, clientCertificate, serverId, ttpUrl }
 * Implementation of authentication flow:
 * 1. Verify client certificate
 * 2. Request authentication from TTP
 * 3. Request AES session key from TTP
 * 4. Return encrypted session keys to client
 */
export async function handleVerifyClient(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as VerifyRequestBody & { serverId?: string; ttpUrl?: string };
    const { clientId, clientCertificate, serverId, ttpUrl } = body;

    // Validate request
    if (!clientId) {
      logWarn("REQUEST_INVALID", {
        clientId,
        message: "Verification request missing required fields",
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: clientId",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Use default values if not provided
    const serverIdToUse = serverId || "server_001";
    const ttpUrlToUse = ttpUrl || "http://localhost:3002";

    logInfo("VERIFY_REQUEST", {
      clientId,
      message: "Client verification request initiated",
      details: { serverId: serverIdToUse },
    });

    // Step 1: Verify client certificate locally
    const certVerification = await verifyClientCertificate(clientId, clientCertificate);
    if (!certVerification.success) {
      logWarn("VERIFICATION_FAILED", {
        clientId,
        message: "Local certificate verification failed",
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Certificate verification failed",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    logInfo("VERIFICATION_STEP", {
      clientId,
      message: "Local certificate verification passed",
    });

    // Step 2: Request authentication from TTP
    const authResult = await requestAuthenticationFromTTP(
      ttpUrlToUse,
      clientId,
      serverIdToUse,
      clientCertificate
    );
    if (!authResult.success) {
      logWarn("VERIFICATION_FAILED", {
        clientId,
        message: "TTP authentication failed",
        details: { error: authResult.error || "Unknown error" },
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: `TTP authentication failed: ${authResult.error}`,
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    logSuccess("VERIFICATION_STEP", {
      clientId,
      message: "TTP authentication successful",
    });

    // Step 3: Request session key from TTP
    const sessionKeyResult = await requestSessionKeyFromTTP(
      ttpUrlToUse,
      clientId,
      serverIdToUse
    );
    if (!sessionKeyResult.success) {
      logWarn("VERIFICATION_FAILED", {
        clientId,
        message: "TTP session key request failed",
        details: { error: sessionKeyResult.error || "Unknown error" },
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: `Session key generation failed: ${sessionKeyResult.error}`,
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    logSuccess("VERIFICATION_STEP", {
      clientId,
      message: "Session key received from TTP",
    });

    // Step 4: Decrypt server's session key and create session
    let decryptedSessionKey: string;
    try {
      decryptedSessionKey = decryptWithRSAPrivateKeyAsString(
        getServerPrivateKey(),
        sessionKeyResult.serverSessionKey!
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      logError("DECRYPTION_FAILED", {
        clientId,
        message: `Failed to decrypt server session key: ${msg}`,
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to decrypt session key",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create session with decrypted AES key
    const session = createSession(clientId, serverIdToUse, decryptedSessionKey);

    logSuccess("SESSION_ESTABLISHED", {
      clientId,
      message: "Session created with decrypted AES-256 key",
      details: { serverId: serverIdToUse, sessionId: session.id },
    });

    logSuccess("VERIFICATION_SUCCESS", {
      clientId,
      message: "Client verification and session key generation successful",
      details: { serverId: serverIdToUse },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Client verification and session key generation successful",
        clientId,
        verified: true,
        // Server's encrypted session key (server will use this with its private key to decrypt)
        sessionKey: sessionKeyResult.serverSessionKey,
        // Client's encrypted session key (server relays this to client for decryption)
        clientSessionKey: sessionKeyResult.clientSessionKey,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logError("ERROR", {
      message: `Verification handler error: ${message}`,
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
