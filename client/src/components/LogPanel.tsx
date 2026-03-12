import type { LogEntry, LogLevel } from "../hooks/useClient";

interface LogPanelProps {
  logs: LogEntry[];
  onClear: () => void;
}

const levelColors: Record<LogLevel, string> = {
  info: "#667eea",
  success: "#27ae60",
  error: "#e74c3c",
  warn: "#f39c12",
};

const levelIcons: Record<LogLevel, string> = {
  info: "ℹ",
  success: "✓",
  error: "✗",
  warn: "⚠",
};

export function LogPanel({ logs, onClear }: LogPanelProps) {
  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Event Log</h3>
        <button className="btn-small" onClick={onClear}>
          Clear
        </button>
      </div>
      <div className="log-container">
        {logs.length === 0 ? (
          <div className="log-empty">No events yet</div>
        ) : (
          logs.map((log, i) => (
            <div
              key={i}
              className="log-entry"
              style={{ borderLeftColor: levelColors[log.level] }}
            >
              <span className="log-icon" style={{ color: levelColors[log.level] }}>
                {levelIcons[log.level]}
              </span>
              <span className="log-time">[{log.timestamp}]</span>
              <span className="log-msg">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
