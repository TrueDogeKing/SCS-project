/**
 * WebSocket server for real-time message delivery
 * Maintains active connections and broadcasts messages instantly
 */

import { logInfo, logSuccess, logError, logWarn } from "../logInfo/logger.js";
import { ClientConnection } from "../types/types";

const activeConnections = new Map<string, ClientConnection>();

export function getActiveConnections(): Map<string, ClientConnection> {
  return activeConnections;
}

export function addConnection(clientId: string, serverId: string, ws: any, sessionId?: string): void {
  const connectionId = `${clientId}:${serverId}`;
  activeConnections.set(connectionId, {
    clientId,
    serverId,
    ws,
    sessionId,
    connectedAt: new Date(),
  });

  logSuccess("CONNECTION_OPENED", {
    clientId,
    message: `Client connected via WebSocket`,
    details: { serverId, connectionId },
  });
}

export function removeConnection(clientId: string, serverId: string): void {
  const connectionId = `${clientId}:${serverId}`;
  activeConnections.delete(connectionId);

  logSuccess("CONNECTION_CLOSED", {
    clientId,
    message: `Client disconnected from WebSocket`,
    details: { serverId, connectionId },
  });
}

export function broadcastMessage(senderClientId: string, serverId: string, encryptedMessage: any): void {
  const targetConnectionId = `${senderClientId}:${serverId}`;
  const connection = activeConnections.get(targetConnectionId);

  if (connection && connection.ws.readyState === WebSocket.OPEN) {
    try {
      connection.ws.send(
        JSON.stringify({
          type: "MESSAGE",
          data: encryptedMessage,
          timestamp: new Date().toISOString(),
        })
      );

      logInfo("MESSAGE_TO_CLIENT", {
        clientId: senderClientId,
        message: "Message delivered via WebSocket",
        details: { serverId },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      logError("ERROR", {
        clientId: senderClientId,
        message: `Failed to deliver message via WebSocket: ${msg}`,
      });
    }
  } else {
    logWarn("MESSAGE_QUEUE_CHECK", {
      clientId: senderClientId,
      message: "Client not connected - message will be queued",
      details: { serverId },
    });
  }
}

export function getConnectionStats(): { activeConnections: number; connections: any[] } {
  const connections = Array.from(activeConnections.values()).map((conn) => ({
    clientId: conn.clientId,
    serverId: conn.serverId,
    connectedAt: conn.connectedAt.toISOString(),
    uptime: new Date().getTime() - conn.connectedAt.getTime(),
  }));

  return {
    activeConnections: activeConnections.size,
    connections,
  };
}
