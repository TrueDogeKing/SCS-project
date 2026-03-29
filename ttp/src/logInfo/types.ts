export type LogLevel = "INFO" | "WARN" | "ERROR" | "SUCCESS";

export type LogEventType =
  // System events
  | "SYSTEM_START"
  | "SYSTEM_SHUTDOWN"
  // Registration events
  | "CLIENT_REGISTERED"
  | "SERVER_REGISTERED"
  | "REGISTRATION_FAILED"
  // Authentication events
  | "AUTH_ATTEMPT"
  | "AUTH_SUCCESS"
  | "AUTH_FAILED"
  | "VERIFICATION_STEP"
  // Session key events
  | "SESSION_KEY_GENERATED"
  | "SESSION_KEY_FAILED"
  // Certificate events
  | "CERT_ISSUED"
  | "CERT_EXPIRED"
  | "CERT_REVOKED"
  | "CERT_VERIFICATION"
  | "INVALID_CERTIFICATE"
  // Security events
  | "MITM_DETECTED"
  | "FORGED_CERTIFICATE"
  // Request events
  | "REQUEST_RECEIVED"
  | "REQUEST_INVALID"
  // Connection events
  | "CONNECTION_OPENED"
  | "CONNECTION_CLOSED"
  // General
  | "ERROR";

export const SECURITY_EVENTS: ReadonlySet<LogEventType> = new Set<LogEventType>([
  "AUTH_ATTEMPT",
  "AUTH_SUCCESS",
  "AUTH_FAILED",
  "VERIFICATION_STEP",
  "SESSION_KEY_GENERATED",
  "SESSION_KEY_FAILED",
  "CERT_ISSUED",
  "CERT_EXPIRED",
  "CERT_REVOKED",
  "CERT_VERIFICATION",
  "INVALID_CERTIFICATE",
  "MITM_DETECTED",
  "FORGED_CERTIFICATE",
  "CLIENT_REGISTERED",
  "SERVER_REGISTERED",
  "REGISTRATION_FAILED",
]);

export interface LogEntry {
  timestamp: string; // "YYYY-MM-DD HH:mm:ss" local time
  level: LogLevel;
  event: LogEventType;
  entityId?: string;
  entityType?: "CLIENT" | "SERVER" | "SYSTEM";
  details?: Record<string, string | number | boolean>;
  message?: string;
}
