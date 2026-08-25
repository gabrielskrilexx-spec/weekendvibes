import { useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type OpenStreetMapViewProps = {
  title: string;
  locationName: string;
  latitude: number;
  longitude: number;
  className?: string;
  onError?: (message: string) => void;
};

export default function OpenStreetMapView({ title, locationName, latitude, longitude, className, onError }: OpenStreetMapViewProps) {
  const [tileError, setTileError] = useState(false);
  const markerIcon = useMemo(() => L.divIcon({
    className: "weekendvibes-map-pin",
    html: '<span aria-hidden="true"></span>',
    iconSize: [30, 38],
    iconAnchor: [15, 38],
    popupAnchor: [0, -38],
  }), []);

  if (tileError) {
    return <div className="grid min-h-72 place-items-center bg-zinc-900 px-6 text-center text-sm text-zinc-300" role="alert">Não foi possível carregar os tiles do mapa. Você ainda pode usar a rota externa acima.</div>;
  }

  return <div data-testid="osm-map" className={className ?? "h-72 min-h-72"}>
    <MapContainer center={[latitude, longitude]} zoom={15} scrollWheelZoom={false} className="h-full min-h-72 w-full" aria-label={`Mapa de ${locationName}`}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        eventHandlers={{ tileerror: () => { setTileError(true); onError?.("Falha ao carregar os tiles do OpenStreetMap"); } }}
      />
      <Marker position={[latitude, longitude]} icon={markerIcon}>
        <Popup><strong>{title}</strong><br />{locationName}</Popup>
      </Marker>
    </MapContainer>
  </div>;
}
