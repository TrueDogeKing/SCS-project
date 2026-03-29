export interface Session {
  id: string; // Session ID (hash of clientId + serverId)
  clientId: string;
  serverId: string;
  sessionKey: string; // AES-256 session key (base64)
  createdAt: Date;
  expiresAt: Date;
  lastActivity: Date;
}

export interface EncryptedMessage {
  from: string; 
  to: string; 
  ciphertext: string; 
  iv: string; 
  tag: string; 
  timestamp: string; 
}

export interface DecryptedMessage {
  content: string;
  from: string;
  to: string;
  timestamp: string;
}
