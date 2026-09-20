export default function VictimDossier({ incident, onAcknowledge }) {
  if (!incident) {
    return (
      <div className="h-full flex items-center justify-center text-console-muted text-sm p-6">
        Select an incident to view details.
      </div>
    );
  }

  const { victim = {}, currentLocation, incidentId, acknowledged } = incident;
  const mapsUrl =
    currentLocation?.lat && currentLocation?.lon
      ? `https://maps.google.com/?q=${currentLocation.lat},${currentLocation.lon}`
      : null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-console-text">{victim.name || "Unknown"}</h2>
          <p className="text-sm text-console-muted font-mono">{incidentId}</p>
        </div>
        {acknowledged ? (
          <span className="shrink-0 rounded border border-calm text-calm px-3 py-1.5 text-sm font-medium">
            Acknowledged
          </span>
        ) : (
          <button
            onClick={() => onAcknowledge(incidentId)}
            className="shrink-0 rounded border border-alert text-alert px-3 py-1.5 text-sm font-medium hover:bg-alert hover:text-console-bg transition-colors"
          >
            Acknowledge
          </button>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
        <Field label="Age" value={victim.age} />
        <Field label="Phone" value={victim.phoneNumber} />
        <Field label="Address" value={victim.address} className="col-span-2" />
      </dl>

      {victim.photoUrl && (
        <img
          src={victim.photoUrl}
          alt={victim.name ? `Photo of ${victim.name}` : "Victim photo"}
          className="w-32 h-32 object-cover rounded border border-console-border"
        />
      )}

      {mapsUrl && (
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-block text-sm text-calm hover:underline">
          Open in Google Maps
        </a>
      )}
    </div>
  );
}

function Field({ label, value, className = "" }) {
  return (
    <div className={className}>
      <dt className="text-xs text-console-muted">{label}</dt>
      <dd className="text-console-text mt-0.5">{value || "—"}</dd>
    </div>
  );
}
