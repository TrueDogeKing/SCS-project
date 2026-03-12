/**
 * Server API request/response type definitions
 */

// Service request endpoint types
export interface ServiceRequestBody {
  clientId: string;
  serviceType: string;
  clientCertificate?: string;
}

export interface ServiceRequestResponse {
  success: boolean;
  message?: string;
  error?: string;
  clientId?: string;
  status?: string;
}

// Verify endpoint types
export interface VerifyRequestBody {
  clientId: string;
  clientCertificate?: string;
  sessionId?: string;
}

export interface VerifyResponse {
  success: boolean;
  message?: string;
  error?: string;
  clientId?: string;
  verified?: boolean;
}
