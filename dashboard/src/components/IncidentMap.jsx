export default function IncidentMap({ location }) {
  if (!location?.lat || !location?.lon) {
    return (
      <div className="h-full flex items-center justify-center text-console-muted text-sm bg-console-panel">
        No location reported yet.
      </div>
    );
  }

  const { lat, lon } = location;
  const delta = 0.01;
  const bbox = [lon - delta, lat - delta, lon + delta, lat + delta].join(",");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;

  return <iframe title="Incident location" src={src} className="w-full h-full border-0" />;
}
