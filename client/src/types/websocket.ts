export interface WebSocketMessage {
  type: string;
  data?: unknown;
  timestamp?: string;
}

export interface WebSocketConfig {
  serverUrl: string;
  clientId: string;
  serverId: string;
  onMessage: (message: WebSocketMessage) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onError: (error: string) => void;
}
