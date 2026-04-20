import { useCallback, useRef, useState, useEffect } from "react";
import type { RSAKeyPair, EncryptedMessage } from "../crypto";
import {
  generateRSAKeyPair,
  rsaDecrypt,
  encryptMessage,
  decryptMessage,
} from "../crypto";
import {
  registerWithTTP,
  verifyClient,
  checkServerHealth,
  checkTTPHealth,
  getConfig,
  saveConfig,
} from "../api";
import { WebSocketClient } from "../api/websocket";

export type LogLevel = "info" | "success" | "error" | "warn";

export interface LogEntry {
  timestamp: string;
  message: string;
  level: LogLevel;
}

export interface DecryptedMessage {
  content: string;
  from: string;
  to: string;
  timestamp: string;
}

export type AppPhase =
  | "idle"
  | "generating-keys"
  | "registering"
  | "authenticating"
  | "authenticated"
  | "error";

export function useClient() {
  const [phase, setPhase] = useState<AppPhase>("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [clientId] = useState(() => `client_${Date.now().toString(36)}`);
  const [serverId] = useState("server_001");
  const [config, setConfigState] = useState(getConfig);
  const [certificate, setCertificate] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [ttpOnline, setTtpOnline] = useState<boolean | null>(null);

  const keysRef = useRef<RSAKeyPair | null>(null);
  const wsRef = useRef<WebSocketClient | null>(null);

  const addLog = useCallback((message: string, level: LogLevel = "info") => {
    setLogs((prev) => [
      ...prev,
      { timestamp: new Date().toLocaleTimeString(), message, level },
    ]);
  }, []);

  const updateConfig = useCallback(
    (serverUrl: string, ttpUrl: string) => {
      const newConfig = { serverUrl, ttpUrl };
      saveConfig(newConfig);
      setConfigState(newConfig);
      addLog(`Config updated: Server=${serverUrl}, TTP=${ttpUrl}`);
    },
    [addLog]
  );

  const checkHealth = useCallback(async () => {
    const [server, ttp] = await Promise.all([
      checkServerHealth(config.serverUrl),
      checkTTPHealth(config.ttpUrl),
    ]);
    setServerOnline(server);
    setTtpOnline(ttp);
    addLog(
      `Health check: Server=${server ? "online" : "offline"}, TTP=${ttp ? "online" : "offline"}`,
      server && ttp ? "success" : "warn"
    );
  }, [config, addLog]);

  const initialize = useCallback(async () => {
    try {
      setPhase("generating-keys");
      addLog("Generating RSA-4096 key pair...");

      const keys = await generateRSAKeyPair();
      keysRef.current = keys;
      addLog("RSA-4096 key pair generated", "success");

      // Register server with TTP (fetch server's public key first)
      setPhase("registering");
      addLog("Registering client with TTP...");
      
      // Register client with TTP
      const clientReg = await registerWithTTP(
        config.ttpUrl,
        clientId,
        "CLIENT",
        "React Client",
        keys.publicKeyPem
      );
      
      if (!clientReg.success) {
        throw new Error(`Client registration failed: ${clientReg.error}`);
      }
      setCertificate(clientReg.certificate.pem);
      addLog(
        `Client registered (fingerprint: ${clientReg.certificate.fingerprint.substring(0, 16)}...)`,
        "success"
      );

      // Authenticate with server via TTP
      setPhase("authenticating");
      addLog("Requesting authentication via TTP...");
      const verifyResult = await verifyClient(
        config.serverUrl,
        clientId,
        serverId,
        config.ttpUrl,
        clientReg.certificate.pem
      );
      
      if (!verifyResult.success || !verifyResult.clientSessionKey) {
        throw new Error(`Authentication failed: ${verifyResult.error}`);
      }
      addLog("Authentication successful", "success");

      // Decrypt session key with client's RSA private key
      addLog("Decrypting session key with RSA private key...");
      
      if (!verifyResult.clientSessionKey) {
        throw new Error("No encrypted session key received from server");
      }
      
      const decryptedKey = await rsaDecrypt(
        keys.privateKey,
        verifyResult.clientSessionKey
      );
      
      if (!decryptedKey) {
        throw new Error("RSA decryption returned empty result");
      }
      
      setSessionKey(decryptedKey);
      addLog("AES-256 session key established", "success");

      setPhase("authenticated");
      addLog("Secure session established! Ready to send messages.", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`Error: ${msg}`, "error");
      setPhase("error");
    }
  }, [config, clientId, serverId, addLog]);

  const sendEncryptedMessage = useCallback(
    async (plaintext: string) => {
      if (!sessionKey) {
        addLog("No session key - authenticate first", "error");
        return;
      }
      if (!wsRef.current || !wsRef.current.isConnected()) {
        addLog("WebSocket not connected - cannot send message", "error");
        return;
      }
      try {
        addLog(`Encrypting message: "${plaintext}"`);
        const encrypted = await encryptMessage(
          sessionKey,
          plaintext,
          clientId,
          serverId
        );
        addLog("Message encrypted with AES-256-GCM", "success");

        // Send encrypted message via WebSocket
        wsRef.current.sendEncryptedMessage(encrypted);
        addLog("Message sent via WebSocket", "success");
        setMessages((prev) => [
          ...prev,
          {
            content: plaintext,
            from: clientId,
            to: serverId,
            timestamp: new Date().toISOString(),
          },
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        addLog(`Send error: ${msg}`, "error");
      }
    },
    [sessionKey, clientId, serverId, addLog]
  );

  // WebSocket connection for real-time message delivery
  useEffect(() => {
    if (phase !== "authenticated" || !sessionKey || !config.serverUrl) {
      return;
    }

    // Create and connect WebSocket
    const wsClient = new WebSocketClient({
      serverUrl: config.serverUrl,
      clientId,
      serverId,
      onMessage: async (msg) => {
        if (msg.type === "MESSAGE" && msg.data) {
          try {
            const decrypted = await decryptMessage(sessionKey, msg.data as EncryptedMessage);
            setMessages((prev) => [...prev, decrypted]);
            addLog(`Received message from ${decrypted.from}: "${decrypted.content}"`, "success");
          } catch (err) {
            const error = err instanceof Error ? err.message : "Unknown error";
            addLog(`Failed to decrypt received message: ${error}`, "error");
          }
        }
      },
      onConnect: () => {
        addLog("Connected to real-time message server", "success");
      },
      onDisconnect: () => {
        addLog("Disconnected from message server", "warn");
      },
      onError: (error) => {
        addLog(`WebSocket error: ${error}`, "warn");
      },
    });

    wsClient.connect().catch(() => {
      addLog("Failed to connect to WebSocket", "error");
    });

    wsRef.current = wsClient;

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
    };
  }, [phase, sessionKey, config, clientId, serverId, addLog]);

  const clearLogs = useCallback(() => setLogs([]), []);

  return {
    phase,
    logs,
    clientId,
    serverId,
    config,
    certificate,
    sessionKey,
    messages,
    serverOnline,
    ttpOnline,
    updateConfig,
    checkHealth,
    initialize,
    sendEncryptedMessage,
    clearLogs,
  };
}
