/**
 * Logging types and interfaces
 */

export type LogLevel = "INFO" | "WARN" | "ERROR" | "SUCCESS";

export type LogEventType =
  // System events
  | "SYSTEM_START"
  | "SYSTEM_SHUTDOWN"
  // Service & request events
  | "SERVICE_REQUEST"
  | "REQUEST_RECEIVED"
  | "REQUEST_INVALID"
  // TTP registration
  | "TTP_REGISTER"
  // Authentication / verification events
  | "VERIFY_REQUEST"
  | "VERIFICATION_STEP"
  | "VERIFICATION_SUCCESS"
  | "VERIFICATION_FAILED"
  // Session events
  | "SESSION_ESTABLISHED"
  | "SESSION_ERROR"
  | "SESSION_EXPIRED"
  // Messaging events
  | "MESSAGE_RECEIVED"
  | "MESSAGE_DECRYPTED"
  | "MESSAGE_ENCRYPTED"
  | "MESSAGE_STORED"
  | "MESSAGE_REQUEST"
  | "MESSAGE_QUEUE_CHECK"
  | "MESSAGE_TO_CLIENT"
  | "MESSAGE_QUEUED"
  // Crypto events
  | "DECRYPTION_FAILED"
  | "KEY_GENERATED"
  | "CERT_VERIFICATION"
  // Security events
  | "MITM_DETECTED"
  | "INVALID_CERTIFICATE"
  | "AUTH_ATTEMPT"
  | "AUTH_SUCCESS"
  | "AUTH_FAILED"
  // Connection events
  | "CONNECTION_OPENED"
  | "CONNECTION_CLOSED"
  // General
  | "ERROR";

/** Events classified as security-relevant (written to the security log) */
export const SECURITY_EVENTS: ReadonlySet<LogEventType> = new Set<LogEventType>([
  "TTP_REGISTER",
  "AUTH_ATTEMPT",
  "AUTH_SUCCESS",
  "AUTH_FAILED",
  "VERIFY_REQUEST",
  "VERIFICATION_SUCCESS",
  "VERIFICATION_FAILED",
  "SESSION_ESTABLISHED",
  "SESSION_ERROR",
  "SESSION_EXPIRED",
  "DECRYPTION_FAILED",
  "CERT_VERIFICATION",
  "INVALID_CERTIFICATE",
  "MITM_DETECTED",
  "KEY_GENERATED",
]);

export interface LogEntry {
  timestamp: string; // "YYYY-MM-DD HH:mm:ss" local time
  level: LogLevel;
  event: LogEventType;
  clientId?: string;
  serverId?: string;
  details?: Record<string, string | number | boolean>;
  message?: string;
}
