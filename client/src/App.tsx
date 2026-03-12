import { useClient } from "./hooks/useClient";
import { StatusBar } from "./components/StatusBar";
import { ConfigPanel } from "./components/ConfigPanel";
import { LogPanel } from "./components/LogPanel";
import { MessagingPanel } from "./components/MessagingPanel";
import "./App.css";

function App() {
  const {
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
  } = useClient();

  const isConnecting =
    phase === "generating-keys" ||
    phase === "registering" ||
    phase === "authenticating";

  return (
    <div className="app">
      <header className="app-header">
        <h1>SCS Secure Client</h1>
        <p className="subtitle">
          Trusted Third Party Authentication &amp; AES-256 Encrypted Messaging
        </p>
      </header>

      <StatusBar
        phase={phase}
        clientId={clientId}
        serverId={serverId}
        certificate={certificate}
        sessionKey={sessionKey}
      />

      <div className="main-grid">
        <div className="left-column">
          <ConfigPanel
            serverUrl={config.serverUrl}
            ttpUrl={config.ttpUrl}
            serverOnline={serverOnline}
            ttpOnline={ttpOnline}
            onSave={updateConfig}
            onCheckHealth={checkHealth}
          />

          <div className="panel auth-panel">
            <h3>Authentication</h3>
            <p className="panel-desc">
              Generate RSA-4096 keys, register with TTP, authenticate with
              server, and establish AES-256 session key.
            </p>
            <button
              className="btn-primary btn-full"
              onClick={initialize}
              disabled={isConnecting || phase === "authenticated"}
            >
              {phase === "idle" || phase === "error"
                ? "Connect & Authenticate"
                : phase === "authenticated"
                  ? "✓ Authenticated"
                  : "Connecting..."}
            </button>
          </div>

          <MessagingPanel
            messages={messages}
            clientId={clientId}
            onSend={sendEncryptedMessage}
            onFetch={fetchMessages}
            disabled={phase !== "authenticated"}
          />
        </div>

        <div className="right-column">
          <LogPanel logs={logs} onClear={clearLogs} />
        </div>
      </div>
    </div>
  );
}

export default App;
