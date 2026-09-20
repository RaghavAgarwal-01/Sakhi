import { useEffect, useState } from "react";

export default function IncidentList({ incidents, selectedId, onSelect }) {
  if (incidents.length === 0) {
    return (
      <div className="px-4 py-6 text-sm text-console-muted">
        No active dispatches. New severe-stage incidents will appear here the instant they escalate.
      </div>
    );
  }

  return (
    <ul className="divide-y divide-console-border">
      {incidents.map((incident) => {
        const isSelected = incident.incidentId === selectedId;
        return (
          <li key={incident.incidentId}>
            <button
              onClick={() => onSelect(incident.incidentId)}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                isSelected ? "bg-console-panel" : "hover:bg-console-panel/60"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full shrink-0 ${
                  incident.acknowledged ? "bg-calm" : "bg-alert animate-pulse"
                }`}
              />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-console-text truncate">
                  {incident.victim?.name || "Unknown"}
                </span>
                <span className="block text-xs text-console-muted font-mono">
                  {incident.incidentId.slice(0, 8)}
                </span>
              </span>
              <ElapsedTime since={incident.receivedAt} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ElapsedTime({ since }) {
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const seconds = Math.max(0, Math.floor((Date.now() - since) / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <span className="text-xs font-mono text-console-muted">
      {mm}:{ss}
    </span>
  );
}
