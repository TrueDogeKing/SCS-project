export interface WebSocketMessage {
  type: string;
  data?: unknown;
  timestamp?: string;
}

export interface EncryptedMessagePayload {
  encryptedMessage: any;
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

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 2000; // 2 seconds
  private reconnectTimeout: number | null = null;

  constructor(config: WebSocketConfig) {
    this.config = config;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = this.getWebSocketUrl();
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.config.onConnect();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.config.onMessage(data);
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            this.config.onError(`Failed to parse message: ${msg}`);
          }
        };

        this.ws.onerror = () => {
          this.config.onError("WebSocket connection error");
          reject(new Error("WebSocket connection failed"));
        };

        this.ws.onclose = () => {
          this.config.onDisconnect();
          this.attemptReconnect();
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        this.config.onError(`Connection error: ${msg}`);
        reject(err);
      }
    });
  }

  private getWebSocketUrl(): string {
    const baseUrl = this.config.serverUrl.replace("http://", "ws://").replace("https://", "wss://");
    return `${baseUrl}/ws?clientId=${this.config.clientId}&serverId=${this.config.serverId}`;
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.config.onError(`Reconnecting... (attempt ${this.reconnectAttempts})`);

      this.reconnectTimeout = setTimeout(() => {
        this.connect().catch(() => {
          // Reconnection failed, will retry
        });
      }, this.reconnectDelay);
    } else {
      this.config.onError("Failed to reconnect after multiple attempts");
    }
  }

  send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.config.onError("WebSocket not connected");
    }
  }

  sendEncryptedMessage(encryptedMessage: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          encryptedMessage: encryptedMessage,
        })
      );
    } else {
      this.config.onError("WebSocket not connected");
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
