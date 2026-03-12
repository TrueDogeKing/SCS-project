/**
 * Server API request/response type definitions
 */

import { EncryptedMessage } from "../session/types.js";

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

// Message endpoints types
export interface SendMessageBody {
  clientId: string;
  serverId: string;
  sessionKey?: string; // Optional: if not using stored session
  encryptedMessage: EncryptedMessage;
}

export interface SendMessageResponse {
  success: boolean;
  message?: string;
  error?: string;
  messageId?: string;
  timestamp?: string;
}

export interface ReceiveMessageBody {
  clientId: string;
  serverId: string;
}

export interface ReceiveMessageResponse {
  success: boolean;
  messages?: any[]; // Array of messages
  message?: string;
  error?: string;
}

