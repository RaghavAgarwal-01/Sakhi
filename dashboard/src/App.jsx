import { useState } from "react";
import { useSakhiSocket } from "./hooks/useSakhiSocket";
import IncidentList from "./components/IncidentList";
import VictimDossier from "./components/VictimDossier";
import IncidentMap from "./components/IncidentMap";

export default function App() {
  const { incidents, connected, acknowledge } = useSakhiSocket();
  const [selectedId, setSelectedId] = useState(null);

  const selected = incidents.find((incident) => incident.incidentId === selectedId) || incidents[0] || null;
  const activeSelectedId = selected?.incidentId ?? null;
  const unacknowledgedCount = incidents.filter((incident) => !incident.acknowledged).length;

  return (
    <div className="h-screen flex flex-col bg-console-bg text-console-text">
      <header className="flex items-center justify-between px-4 py-3 border-b border-console-border">
        <h1 className="text-base font-semibold">Sakhi Dispatch</h1>
        <div className="flex items-center gap-2 text-sm">
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-calm" : "bg-alert"}`} />
          <span className="text-console-muted">{connected ? "Connected" : "Reconnecting…"}</span>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <aside className="w-72 shrink-0 border-r border-console-border flex flex-col min-h-0">
          <div className="px-4 py-3 border-b border-console-border text-sm text-console-muted">
            Active ({unacknowledgedCount})
          </div>
          <div className="flex-1 overflow-y-auto">
            <IncidentList incidents={incidents} selectedId={activeSelectedId} onSelect={setSelectedId} />
          </div>
        </aside>

        <main className="flex-1 flex min-h-0">
          <div className="flex-1 min-h-0">
            <IncidentMap location={selected?.currentLocation} />
          </div>
          <div className="w-96 shrink-0 border-l border-console-border overflow-y-auto">
            <VictimDossier incident={selected} onAcknowledge={acknowledge} />
          </div>
        </main>
      </div>
    </div>
  );
}
