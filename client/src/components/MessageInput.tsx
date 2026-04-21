import { useCallback, useState } from "react";

type MessageInputProps = {
  disabled: boolean;
  onSend: (text: string) => void;
};

export const MessageInput = (function MessageInput({ disabled, onSend }: MessageInputProps) {
  const [input, setInput] = useState("");

  const submit = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput("");
  }, [input, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }, [submit]);

  return (
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
        onClick={submit}
        disabled={disabled || !input.trim()}
      >
        Send
      </button>
    </div>
  );
});
