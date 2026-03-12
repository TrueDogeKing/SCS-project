/**
 * Session management utility
 * Manages active sessions between clients and servers
 */

import { hashSHA256Hex } from "../crypto";
import { Session } from "./types";

// In-memory session store (in production, use a database)
const sessions = new Map<string, Session>();

// Session timeout: 1 hour
const SESSION_TIMEOUT_MS = 60 * 60 * 1000;

/**
 * Generate a session ID from client and server IDs
 */
function generateSessionId(clientId: string, serverId: string): string {
  return hashSHA256Hex(`${clientId}:${serverId}`);
}

/**
 * Create a new session
 */
export function createSession(
  clientId: string,
  serverId: string,
  sessionKey: string
): Session {
  const id = generateSessionId(clientId, serverId);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TIMEOUT_MS);

  const session: Session = {
    id,
    clientId,
    serverId,
    sessionKey,
    createdAt: now,
    expiresAt,
    lastActivity: now,
  };

  sessions.set(id, session);
  return session;
}

/**
 * Get a session by client and server IDs
 */
export function getSession(clientId: string, serverId: string): Session | null {
  const id = generateSessionId(clientId, serverId);
  const session = sessions.get(id);

  if (!session) {
    return null;
  }

  // Check if session has expired
  if (new Date() > session.expiresAt) {
    sessions.delete(id);
    return null;
  }

  // Update last activity
  session.lastActivity = new Date();
  return session;
}

/**
 * Get session by session ID
 */
export function getSessionById(sessionId: string): Session | null {
  const session = sessions.get(sessionId);

  if (!session) {
    return null;
  }

  // Check if session has expired
  if (new Date() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }

  // Update last activity
  session.lastActivity = new Date();
  return session;
}

/**
 * Update session last activity time
 */
export function updateSessionActivity(clientId: string, serverId: string): boolean {
  const session = getSession(clientId, serverId);
  if (!session) {
    return false;
  }
  session.lastActivity = new Date();
  return true;
}

/**
 * Delete a session
 */
export function deleteSession(clientId: string, serverId: string): boolean {
  const id = generateSessionId(clientId, serverId);
  return sessions.delete(id);
}

/**
 * Check if session exists and is valid
 */
export function sessionExists(clientId: string, serverId: string): boolean {
  return getSession(clientId, serverId) !== null;
}

/**
 * Clean up expired sessions (can be called periodically)
 */
export function cleanupExpiredSessions(): number {
  const now = new Date();
  let cleaned = 0;

  for (const [id, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(id);
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * Get all active sessions (for debugging/monitoring)
 */
export function getAllSessions(): Session[] {
  cleanupExpiredSessions();
  return Array.from(sessions.values());
}
