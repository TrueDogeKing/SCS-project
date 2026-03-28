/**
 * Message handlers for encrypted client-server communication
 */

import { logInfo, logWarn, logError, logSuccess } from "../logInfo/index.js";
import { SendMessageBody, ReceiveMessageBody, SendMessageResponse, ReceiveMessageResponse } from "./types.js";
import { getSession, createSession, updateSessionActivity } from "../session/index.js";
import { decryptMessage, encryptMessage, isValidEncryptedMessage } from "../session/messaging.js";
import { EncryptedMessage, DecryptedMessage } from "../session/types.js";
import { broadcastMessage } from "../websocket/index.js";

const SERVER_ID = "server_001";

// In-memory message queue (in production, use a database)
// Key: "clientId:serverId" -> array of messages
const messageQueue = new Map<string, EncryptedMessage[]>();

/**
 * Handle POST /message/send - Client sends encrypted message to server
 * Request body: { clientId, serverId, encryptedMessage, sessionKey? }
 */
export async function handleSendMessage(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as SendMessageBody;
    const { clientId, serverId, encryptedMessage, sessionKey } = body;

    // Validate request
    if (!clientId || !serverId) {
      logWarn("REQUEST_INVALID", {
        clientId,
        message: "Send message request missing required fields",
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: clientId, serverId",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!isValidEncryptedMessage(encryptedMessage)) {
      logWarn("REQUEST_INVALID", {
        clientId,
        message: "Invalid encrypted message format",
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid encrypted message format",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    logInfo("MESSAGE_RECEIVED", {
      clientId,
      message: "Encrypted message received from client",
      details: { serverId, messageLen: encryptedMessage.ciphertext.length },
    });

    // Get or use provided session key
    let session = getSession(clientId, serverId);
    if (!session && sessionKey) {
      // Create session if not exists but key provided
      session = createSession(clientId, serverId, sessionKey);
    }

    if (!session) {
      logWarn("SESSION_ERROR", {
        clientId,
        message: "No active session found",
        details: { serverId },
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "No active session. Please authenticate first.",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Decrypt message
    let decryptedMsg: DecryptedMessage;
    try {
      decryptedMsg = decryptMessage(session.sessionKey, encryptedMessage);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      logError("DECRYPTION_FAILED", {
        clientId,
        message: `Message decryption failed: ${msg}`,
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Message decryption failed",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    logSuccess("MESSAGE_DECRYPTED", {
      clientId,
      message: `Message decrypted successfully (${decryptedMsg.content.length} bytes)`,
      details: { serverId },
    });

    // Modify message by appending "-server"
    const modifiedContent = `${decryptedMsg.content}-server`;
    logInfo("MESSAGE_RECEIVED", {
      clientId,
      message: `Message modified: "${decryptedMsg.content}" → "${modifiedContent}"`,
    });

    // Re-encrypt the modified message with swapped from/to (server sends back to client)
    const reencryptedMessage = encryptMessage(session.sessionKey, modifiedContent, SERVER_ID, clientId);
    logSuccess("MESSAGE_ENCRYPTED", {
      clientId,
      message: "Modified message re-encrypted with AES-256-GCM",
    });

    // Store original message for potential queuing
    const queueKey = `${clientId}:${serverId}`;
    if (!messageQueue.has(queueKey)) {
      messageQueue.set(queueKey, []);
    }
    messageQueue.get(queueKey)!.push(encryptedMessage);

    // Update session activity
    updateSessionActivity(clientId, serverId);

    logSuccess("MESSAGE_STORED", {
      clientId,
      message: "Message processed and stored",
      details: { serverId, originalContent: decryptedMsg.content, modifiedContent },
    });

    // Send HTTP response immediately (confirms receipt via TCP acknowledgment)
    const response = new Response(
      JSON.stringify({
        success: true,
        message: "Message received and decrypted successfully",
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
    setTimeout(() => {
      broadcastMessage(clientId, serverId, reencryptedMessage);
    }, 100);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logError("ERROR", {
      message: `Send message handler error: ${message}`,
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
 * Handle POST /message/receive - Client receives encrypted messages from server
 * Request body: { clientId, serverId }
 */
export async function handleReceiveMessage(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as ReceiveMessageBody;
    const { clientId, serverId } = body;

    // Validate request
    if (!clientId || !serverId) {
      logWarn("REQUEST_INVALID", {
        clientId,
        message: "Receive message request missing required fields",
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: clientId, serverId",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    logInfo("MESSAGE_REQUEST", {
      clientId,
      message: "Client requesting messages",
      details: { serverId },
    });

    // Get session
    const session = getSession(clientId, serverId);
    if (!session) {
      logWarn("SESSION_ERROR", {
        clientId,
        message: "No active session found",
        details: { serverId },
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "No active session. Please authenticate first.",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get messages from queue
    const queueKey = `${clientId}:${serverId}`;
    const messages = messageQueue.get(queueKey) || [];
    const pendingCount = messages.length;

    logInfo("MESSAGE_QUEUE_CHECK", {
      clientId,
      message: `Message queue has ${pendingCount} messages`,
      details: { serverId },
    });

    // Clear queue after retrieval
    if (messages.length > 0) {
      messageQueue.delete(queueKey);
    }

    // Update session activity
    updateSessionActivity(clientId, serverId);

    return new Response(
      JSON.stringify({
        success: true,
        messages: messages,
        message: `Retrieved ${pendingCount} message(s)`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logError("ERROR", {
      message: `Receive message handler error: ${message}`,
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
 * Handle POST /message/send-to-client - Server sends encrypted message to client
 * Request body: { clientId, serverId, encryptedMessage, sessionKey? }
 */
export async function handleSendToClient(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as SendMessageBody;
    const { clientId, serverId, encryptedMessage, sessionKey } = body;

    // Validate request
    if (!clientId || !serverId) {
      logWarn("REQUEST_INVALID", {
        message: "Send to client request missing required fields",
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: clientId, serverId",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!isValidEncryptedMessage(encryptedMessage)) {
      logWarn("REQUEST_INVALID", {
        message: "Invalid encrypted message format",
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid encrypted message format",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    logInfo("MESSAGE_TO_CLIENT", {
      clientId,
      message: "Server sending encrypted message to client",
      details: { serverId },
    });

    // Get or use provided session key
    let session = getSession(clientId, serverId);
    if (!session && sessionKey) {
      session = createSession(clientId, serverId, sessionKey);
    }

    if (!session) {
      logWarn("SESSION_ERROR", {
        clientId,
        message: "No active session found",
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "No active session",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    // Decrypt message to validate it
    try {
      decryptMessage(session.sessionKey, encryptedMessage);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      logError("DECRYPTION_FAILED", {
        clientId,
        message: `Message decryption failed: ${msg}`,
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Message decryption failed",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Queue message for client
    const queueKey = `${serverId}:${clientId}`; // Reverse direction
    if (!messageQueue.has(queueKey)) {
      messageQueue.set(queueKey, []);
    }
    messageQueue.get(queueKey)!.push(encryptedMessage);

    // Update session activity
    updateSessionActivity(clientId, serverId);

    logSuccess("MESSAGE_QUEUED", {
      clientId,
      message: "Encrypted message queued for client",
      details: { serverId },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Message queued for client successfully",
        messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logError("ERROR", {
      message: `Send to client handler error: ${message}`,
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
