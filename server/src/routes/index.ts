/**
 * Server API routes
 * Implements POST /service-request and POST /verify-client endpoints
 */

import { logInfo, logWarn, logError, logSuccess } from "../logs";
import { ServiceRequestBody, VerifyRequestBody } from "./types";
import {
  verifyClientCertificate,
  authorizeServiceAccess,
  authenticateWithTTP,
} from "../auth";

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

    logSuccess("SERVICE_REQUEST" as any, {
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
 * Request body: { clientId, clientCertificate, sessionId }
 */
export async function handleVerifyClient(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as VerifyRequestBody;
    const { clientId, clientCertificate, sessionId } = body;

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

    logInfo("VERIFY_REQUEST", {
      clientId,
      message: "Client verification request",
      details: sessionId ? { sessionId } : undefined,
    });

    // Verify client certificate
    const certVerification = await verifyClientCertificate(clientId, clientCertificate);
    if (!certVerification.success) {
      logWarn("VERIFICATION_FAILED", {
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

    // Authenticate with TTP
    const authResult = await authenticateWithTTP(clientId, "server_id", clientCertificate);
    if (!authResult.success) {
      logWarn("VERIFICATION_FAILED", {
        clientId,
        message: "TTP authentication failed",
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Authentication failed",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    logSuccess("VERIFICATION_SUCCESS", {
      clientId,
      message: "Client verification successful",
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Client verification successful",
        clientId,
        verified: true,
        sessionKey: authResult.sessionKey,
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
