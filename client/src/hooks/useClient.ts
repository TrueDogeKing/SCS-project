import { useCallback, useRef, useState } from "react";
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
  getServerPublicKey,
  sendMessage,
  receiveMessages,
  checkServerHealth,
  checkTTPHealth,
  getConfig,
  saveConfig,
} from "../api";

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
      addLog("Fetching server public key...");
      const serverPubKey = await getServerPublicKey(config.serverUrl);
      addLog("Server public key retrieved", "success");

      addLog("Registering server with TTP...");
      const serverReg = await registerWithTTP(
        config.ttpUrl,
        serverId,
        "SERVER",
        "Application Server",
        serverPubKey
      );
      if (!serverReg.success) {
        // It might already be registered, which is fine
        addLog(`Server registration: ${serverReg.error || "already registered"}`, "warn");
      } else {
        addLog(
          `Server registered with TTP (fingerprint: ${serverReg.certificate.fingerprint.substring(0, 16)}...)`,
          "success"
        );
      }

      // Register client with TTP
      addLog("Registering client with TTP...");
      const clientReg = await registerWithTTP(
        config.ttpUrl,
        clientId,
        "CLIENT",
        "React Client",
        keys.publicKeyPem
      );
      console.log("[DEBUG] Client registration response:", clientReg);
      console.log("[DEBUG] Public key PEM (first 100 chars):", keys.publicKeyPem.substring(0, 100));
      
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
      console.log("[DEBUG] verifyResult:", verifyResult);
      
      if (!verifyResult.success || !verifyResult.clientSessionKey) {
        throw new Error(`Authentication failed: ${verifyResult.error}`);
      }
      addLog("Authentication successful", "success");

      // Decrypt session key with client's RSA private key
      addLog("Decrypting session key with RSA private key...");
      addLog(`Encrypted key length: ${verifyResult.clientSessionKey?.length || 0} chars`, "info");
      
      if (!verifyResult.clientSessionKey) {
        throw new Error("No encrypted session key received from server");
      }
      
      console.log("[DEBUG] About to decrypt with private key...");
      const decryptedKey = await rsaDecrypt(
        keys.privateKey,
        verifyResult.clientSessionKey
      );
      console.log("[DEBUG] Decryption succeeded, key length:", decryptedKey.length);
      
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
      try {
        addLog(`Encrypting message: "${plaintext}"`);
        const encrypted = await encryptMessage(
          sessionKey,
          plaintext,
          clientId,
          serverId
        );
        addLog("Message encrypted with AES-256-GCM", "success");

        const result = await sendMessage(
          config.serverUrl,
          clientId,
          serverId,
          encrypted
        );
        if (result.success) {
          addLog(`Message sent (ID: ${result.messageId})`, "success");
          setMessages((prev) => [
            ...prev,
            {
              content: plaintext,
              from: clientId,
              to: serverId,
              timestamp: new Date().toISOString(),
            },
          ]);
        } else {
          addLog(`Send failed: ${result.error}`, "error");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        addLog(`Send error: ${msg}`, "error");
      }
    },
    [sessionKey, clientId, serverId, config, addLog]
  );

  const fetchMessages = useCallback(async () => {
    if (!sessionKey) {
      addLog("No session key - authenticate first", "error");
      return;
    }
    try {
      addLog("Fetching messages from server...");
      const result = await receiveMessages(
        config.serverUrl,
        clientId,
        serverId
      );
      if (result.success && result.messages && result.messages.length > 0) {
        addLog(`Received ${result.messages.length} message(s)`, "success");
        const decrypted: DecryptedMessage[] = [];
        for (const msg of result.messages) {
          try {
            const d = await decryptMessage(sessionKey, msg as EncryptedMessage);
            decrypted.push(d);
            addLog(`Decrypted message from ${d.from}: "${d.content}"`, "success");
          } catch {
            addLog("Failed to decrypt a message", "error");
          }
        }
        setMessages((prev) => [...prev, ...decrypted]);
      } else {
        addLog("No new messages", "info");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog(`Fetch error: ${msg}`, "error");
    }
  }, [sessionKey, clientId, serverId, config, addLog]);

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
    fetchMessages,
    clearLogs,
  };
}
