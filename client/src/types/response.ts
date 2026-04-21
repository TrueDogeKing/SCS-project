export interface Config {
  serverUrl: string;
  ttpUrl: string;
}

export interface RegisterResponse {
  success: boolean;
  entityId: string;
  certificate: {
    pem: string;
    fingerprint: string;
    validFrom: string;
    validUntil: string;
  };
  error?: string;
}

export interface VerifyClientResponse {
  success: boolean;
  verified?: boolean;
  clientId?: string;
  sessionKey?: string;
  clientSessionKey?: string;
  error?: string;
}