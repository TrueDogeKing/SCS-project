import { useState } from "react";

interface ConfigPanelProps {
  serverUrl: string;
  ttpUrl: string;
  serverOnline: boolean | null;
  ttpOnline: boolean | null;
  onSave: (serverUrl: string, ttpUrl: string) => void;
  onCheckHealth: () => void;
}

export function ConfigPanel({
  serverUrl,
  ttpUrl,
  serverOnline,
  ttpOnline,
  onSave,
  onCheckHealth,
}: ConfigPanelProps) {
  const [server, setServer] = useState(serverUrl);
  const [ttp, setTtp] = useState(ttpUrl);

  function statusDot(online: boolean | null) {
    if (online === null) return <span className="dot dot-unknown" />;
    return online ? <span className="dot dot-online" /> : <span className="dot dot-offline" />;
  }

  return (
    <div className="panel">
      <h3>Configuration</h3>
      <div className="config-row">
        <label>
          Server URL {statusDot(serverOnline)}
          <input
            type="text"
            value={server}
            onChange={(e) => setServer(e.target.value)}
          />
        </label>
      </div>
      <div className="config-row">
        <label>
          TTP URL {statusDot(ttpOnline)}
          <input
            type="text"
            value={ttp}
            onChange={(e) => setTtp(e.target.value)}
          />
        </label>
      </div>
      <div className="config-actions">
        <button className="btn-secondary" onClick={onCheckHealth}>
          Check Health
        </button>
        <button className="btn-secondary" onClick={() => onSave(server, ttp)}>
          Save Config
        </button>
      </div>
    </div>
  );
}
