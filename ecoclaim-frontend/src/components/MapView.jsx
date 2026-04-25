import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";

const RUSE_CENTER = [43.8356, 25.9657];

export default function MapView({ reports, onMarkerClick, onReportClick }) {
  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={RUSE_CENTER}
        zoom={14}
        className="h-full w-full"
        style={{ background: "#0f172a" }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {reports.map((report) => {
          const isReported = report.status === "reported";
          const color = isReported ? "#ef4444" : "#10b981";
          const radius = 8 + (report.hazard_score / 10) * 12;
          const opacity = 0.4 + (report.hazard_score / 10) * 0.5;

          return (
            <CircleMarker
              key={report.id}
              center={[report.coordinates.lat, report.coordinates.lng]}
              radius={radius}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: opacity,
                weight: 2,
              }}
              eventHandlers={{
                click: () => onMarkerClick(report),
              }}
            >
              <Popup>
                <div className="text-sm">
                  <strong>{isReported ? "🚨 Reported" : "✅ Cleaned"}</strong>
                  <br />
                  Hazard: {report.hazard_score}/10
                  <br />
                  Bounty: {report.bounty_tokens} tokens
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      <button
        className="absolute bottom-6 right-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full w-16 h-16 shadow-lg flex items-center justify-center text-3xl transition z-[1000]"
        title="Report a dump"
        onClick={onReportClick}
      >
        +
      </button>
    </div>
  );
}