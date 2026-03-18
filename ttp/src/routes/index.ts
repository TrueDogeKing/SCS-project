/**
 * TTP API routes
 * Implements POST /register, /authenticate, /validate-certificate, /session-key endpoints
 */

import * as forge from "node-forge";
import { logInfo, logSuccess, logWarn, logError } from "../logInfo";
import { RegistryData, registerEntity, getEntity } from "../registry";
import {
  RegisterRequest,
  AuthenticateRequest,
  SessionKeyRequest,
  ValidateCertificateRequest,
} from "./types";
import { generateCertificate, generateSessionKey, encryptWithRSAPublicKey, verifyCertificateValidity } from "../crypto";

function getCertificateFingerprintHexFromPem(certificatePem: string): string {
  const cert = forge.pki.certificateFromPem(certificatePem);
  const certificateDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).bytes();
  const fingerprint = forge.md.sha256.create();
  fingerprint.update(certificateDer);
  return fingerprint.digest().toHex();
}

/**
 * Handle POST /validate-certificate requests
 * Request body: { clientId, clientCertificate }
 */
export async function handleValidateCertificate(
  request: Request,
  registry: RegistryData
): Promise<Response> {
  try {
    const body = (await request.json()) as ValidateCertificateRequest;
    const { clientId, clientCertificate } = body;

    if (!clientId || !clientCertificate) {
      logWarn("REQUEST_INVALID", {
        message: "Certificate validation request missing required fields",
        entityId: clientId,
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: clientId, clientCertificate",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const client = getEntity(registry, clientId);
    if (!client || client.type !== "CLIENT") {
      logWarn("AUTH_FAILED", {
        entityId: clientId,
        message: "Client not found for certificate validation",
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Client not found",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!verifyCertificateValidity(client.certificate)) {
      logWarn("AUTH_FAILED", {
        entityId: clientId,
        message: "Stored client certificate is invalid or expired",
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Client certificate is invalid or expired",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    let providedFingerprint: string;
    try {
      providedFingerprint = getCertificateFingerprintHexFromPem(clientCertificate);
    } catch {
      logWarn("AUTH_FAILED", {
        entityId: clientId,
        message: "Provided client certificate is not valid PEM X.509",
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Provided certificate is not a valid X.509 PEM",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    if (providedFingerprint !== client.certificate.fingerprint) {
      logWarn("AUTH_FAILED", {
        entityId: clientId,
        message: "Provided certificate fingerprint does not match TTP registry",
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Certificate fingerprint mismatch",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    logSuccess("VERIFICATION_STEP", {
      entityId: clientId,
      entityType: "CLIENT",
      message: "Client certificate verified by TTP",
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Client certificate verified",
        clientId,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logError("ERROR", {
      message: `Certificate validation handler error: ${message}`,
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
 * Handle POST /register requests
 * Request body: { id, type, name, publicKey }
 * Response: Certificate for entity
 */
export async function handleRegister(
  request: Request,
  registry: RegistryData
): Promise<Response> {
  try {
    const body = (await request.json()) as RegisterRequest;
    const { id, type, name, publicKey } = body;

    // Validate request
    if (!id || !type || !name || !publicKey) {
      logWarn("REQUEST_INVALID", {
        message: "Registration request missing required fields",
        entityId: id,
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: id, type, name, publicKey",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!["CLIENT", "SERVER"].includes(type)) {
      logWarn("REQUEST_INVALID", {
        message: `Invalid entity type: ${type}`,
        entityId: id,
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid type. Must be CLIENT or SERVER",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    logInfo("REQUEST_RECEIVED", {
      entityId: id,
      entityType: type,
      message: `Registration request from ${type}`,
    });

    // Generate certificate
    let certificate;
    try {
      certificate = generateCertificate(id, type as "CLIENT" | "SERVER", name, publicKey);
    } catch (certError) {
      const message = certError instanceof Error ? certError.message : "Certificate generation failed";
      logError("ERROR", {
        entityId: id,
        message: `Certificate generation error: ${message}`,
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to generate certificate",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Register entity with certificate
    registerEntity(registry, {
      id,
      type: type as "CLIENT" | "SERVER",
      name,
      publicKey,
      certificate,
      registeredAt: new Date().toISOString(),
    });

    const eventType = type === "CLIENT" ? "CLIENT_REGISTERED" : "SERVER_REGISTERED";
    logSuccess(eventType, {
      entityId: id,
      entityType: type,
      message: `${type} registered successfully`,
      details: { certificateFingerprint: certificate.fingerprint.substring(0, 16) },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `${type} registered successfully`,
        entityId: id,
        certificate: {
          pem: certificate.pem,
          fingerprint: certificate.fingerprint,
          validFrom: certificate.validFrom,
          validUntil: certificate.validUntil,
        },
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logError("ERROR", {
      message: `Registration handler error: ${message}`,
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
 * Handle POST /authenticate requests
 * Request body: { clientId, serverId, clientCertificate }
 */
export async function handleAuthenticate(
  request: Request,
  registry: RegistryData
): Promise<Response> {
  try {
    const body = (await request.json()) as AuthenticateRequest;
    const { clientId, serverId, clientCertificate } = body;

    // Validate request
    if (!clientId || !serverId) {
      logWarn("REQUEST_INVALID", {
        message: "Authentication request missing required fields",
        details: { clientId, serverId },
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: clientId, serverId",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    logInfo("AUTH_ATTEMPT", {
      entityId: clientId,
      entityType: "CLIENT",
      message: `Authentication attempt for client ${clientId}`,
      details: { serverId },
    });

    // Check if client and server exist
    const client = getEntity(registry, clientId);
    const server = getEntity(registry, serverId);

    if (!client) {
      logWarn("AUTH_FAILED", {
        entityId: clientId,
        message: "Client not found",
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Client not found",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!server) {
      logWarn("AUTH_FAILED", {
        entityId: serverId,
        entityType: "SERVER",
        message: "Server not found",
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Server not found",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify client certificate validity
    if (!verifyCertificateValidity(client.certificate)) {
      logWarn("AUTH_FAILED", {
        entityId: clientId,
        message: "Client certificate is invalid or expired",
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Client certificate is invalid or expired",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify server certificate validity
    if (!verifyCertificateValidity(server.certificate)) {
      logWarn("AUTH_FAILED", {
        entityId: serverId,
        message: "Server certificate is invalid or expired",
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Server certificate is invalid or expired",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    logSuccess("AUTH_SUCCESS", {
      entityId: clientId,
      entityType: "CLIENT",
      message: `Authentication successful for ${clientId}`,
      details: { serverId },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Authentication successful",
        clientId,
        serverId,
        status: "VERIFIED",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logError("ERROR", {
      message: `Authentication handler error: ${message}`,
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
 * Handle POST /session-key requests
 * Request body: { clientId, serverId }
 * Note: Will return encrypted session keys once crypto is implemented
 */
export async function handleSessionKey(
  request: Request,
  registry: RegistryData
): Promise<Response> {
  try {
    const body = (await request.json()) as SessionKeyRequest;
    const { clientId, serverId } = body;

    // Validate request
    if (!clientId || !serverId) {
      logWarn("REQUEST_INVALID", {
        message: "Session key request missing required fields",
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: clientId, serverId",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    logInfo("REQUEST_RECEIVED", {
      message: "Session key generation request",
      details: { clientId, serverId },
    });

    // Check if both entities exist
    const client = getEntity(registry, clientId);
    const server = getEntity(registry, serverId);

    if (!client || !server) {
      logWarn("AUTH_FAILED", {
        message: "Client or server not found for session key generation",
        details: { clientId, serverId },
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Client or server not found",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Generate AES-256 session key (256 bits / 32 bytes)
    const sessionKeyBase64 = generateSessionKey();

    logInfo("SESSION_KEY_GENERATED", {
      message: "Session key generated for client and server",
      details: { clientId, serverId },
    });

    // Encrypt session key with client's RSA public key
    let encryptedClientSessionKey: string;
    try {
      encryptedClientSessionKey = encryptWithRSAPublicKey(client.publicKey, sessionKeyBase64);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      logError("ERROR", {
        message: `Failed to encrypt session key for client: ${msg}`,
        entityId: clientId,
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to encrypt session key for client",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Encrypt session key with server's RSA public key
    let encryptedServerSessionKey: string;
    try {
      encryptedServerSessionKey = encryptWithRSAPublicKey(server.publicKey, sessionKeyBase64);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      logError("ERROR", {
        message: `Failed to encrypt session key for server: ${msg}`,
        entityId: serverId,
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to encrypt session key for server",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    logSuccess("SESSION_KEY_GENERATED", {
      message: "Session key encrypted for both client and server",
      details: { clientId, serverId },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Session key generation successful",
        clientId,
        serverId,
        clientSessionKey: encryptedClientSessionKey,
        serverSessionKey: encryptedServerSessionKey,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logError("ERROR", {
      message: `Session key handler error: ${message}`,
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
