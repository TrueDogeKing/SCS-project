/**
 * TTP API request/response type definitions
 */

import { Certificate } from "../crypto";

// Register endpoint types
export interface RegisterRequest {
  id: string;
  type: "CLIENT" | "SERVER";
  name: string;
  publicKey: string;
}

export interface RegisterResponse {
  success: boolean;
  message?: string;
  error?: string;
  entityId?: string;
  certificate?: Certificate; // X.509 certificate
}

// Authenticate endpoint types
export interface AuthenticateRequest {
  clientId: string;
  serverId: string;
  clientCertificate?: string;
}

export interface AuthenticateResponse {
  success: boolean;
  message?: string;
  error?: string;
  clientId?: string;
  serverId?: string;
}

// Certificate validation endpoint types
export interface ValidateCertificateRequest {
  clientId: string;
  clientCertificate: string;
}

export interface ValidateCertificateResponse {
  success: boolean;
  message?: string;
  error?: string;
  clientId?: string;
}

// Session key endpoint types
export interface SessionKeyRequest {
  clientId: string;
  serverId: string;
}

export interface SessionKeyResponse {
  success: boolean;
  message?: string;
  error?: string;
  clientId?: string;
  serverId?: string;
  clientSessionKey?: string; // Encrypted session key for client
  serverSessionKey?: string; // Encrypted session key for server
}
