import { useState } from "react";
import type { DecryptedMessage } from "../hooks/useClient";

interface MessagingPanelProps {
  messages: DecryptedMessage[];
  clientId: string;
  onSend: (message: string) => void;
  onFetch: () => void;
  disabled: boolean;
}

export function MessagingPanel({
  messages,
  clientId,
  onSend,
  onFetch,
  disabled,
}: MessagingPanelProps) {
  const [input, setInput] = useState("");

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="panel messaging-panel">
      <h3>Encrypted Messaging (AES-256-GCM)</h3>

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="messages-empty">
            {disabled
              ? "Authenticate first to send messages"
              : "No messages yet — send one!"}
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`message ${msg.from === clientId ? "message-sent" : "message-received"}`}
            >
              <div className="message-header">
                <span className="message-from">
                  {msg.from === clientId ? "You" : msg.from}
                </span>
                <span className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="message-content">{msg.content}</div>
            </div>
          ))
        )}
      </div>

      <div className="message-input-row">
        <input
          type="text"
          placeholder={disabled ? "Authenticate first..." : "Type a message..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <button
          className="btn-primary"
          onClick={handleSend}
          disabled={disabled || !input.trim()}
        >
          Send
        </button>
        <button
          className="btn-secondary"
          onClick={onFetch}
          disabled={disabled}
        >
          Fetch
        </button>
      </div>
    </div>
  );
}
