import type { AppPhase } from "../hooks/useClient";

interface StatusBarProps {
  phase: AppPhase;
  clientId: string;
  serverId: string;
  certificate: string | null;
  sessionKey: string | null;
}

const phaseLabels: Record<AppPhase, string> = {
  idle: "Not Connected",
  "generating-keys": "Generating RSA Keys...",
  registering: "Registering with TTP...",
  authenticating: "Authenticating...",
  authenticated: "Secure Session Active",
  error: "Error",
};

const phaseColors: Record<AppPhase, string> = {
  idle: "#999",
  "generating-keys": "#f39c12",
  registering: "#f39c12",
  authenticating: "#f39c12",
  authenticated: "#27ae60",
  error: "#e74c3c",
};

export function StatusBar({
  phase,
  clientId,
  serverId,
  certificate,
  sessionKey,
}: StatusBarProps) {
  return (
    <div className="status-bar">
      <div className="status-main">
        <span
          className="status-indicator"
          style={{ backgroundColor: phaseColors[phase] }}
        />
        <span className="status-label">{phaseLabels[phase]}</span>
      </div>
      <div className="status-details">
        <span>
          <strong>Client:</strong> {clientId}
        </span>
        <span>
          <strong>Server:</strong> {serverId}
        </span>
        <span>
          <strong>Certificate:</strong>{" "}
          {certificate ? "✓ Issued" : "✗ None"}
        </span>
        <span>
          <strong>Session Key:</strong>{" "}
          {sessionKey ? "✓ Established" : "✗ None"}
        </span>
      </div>
    </div>
  );
}
