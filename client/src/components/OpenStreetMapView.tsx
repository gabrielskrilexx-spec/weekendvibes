import { useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type OpenStreetMapViewProps = {
  title: string;
  locationName: string;
  address?: string | null;
  eventDate?: string | number | Date | null;
  latitude: number;
  longitude: number;
  googleMapsUrl: string;
  appleMapsUrl: string;
  className?: string;
  onError?: (message: string) => void;
};

function formatEventDateTime(value: OpenStreetMapViewProps["eventDate"]) {
  if (value === null || value === undefined) return "Horário não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Horário não informado";
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function TileSkeleton() {
  return <div className="pointer-events-none absolute inset-0 z-[500] grid place-items-center bg-zinc-900/90 backdrop-blur-[2px]" role="status" aria-label="Carregando tiles do OpenStreetMap"><div className="space-y-3 text-center"><div className="mx-auto h-10 w-10 animate-pulse rounded-full border-4 border-orange-300/30 border-t-orange-300" /><p className="text-xs font-bold text-zinc-200">Carregando mapa...</p></div></div>;
}

export default function OpenStreetMapView({ title, locationName, address, eventDate, latitude, longitude, googleMapsUrl, appleMapsUrl, className, onError }: OpenStreetMapViewProps) {
  const [tileError, setTileError] = useState(false);
  const [tilesReady, setTilesReady] = useState(false);
  const markerIcon = useMemo(() => L.divIcon({
    className: "weekendvibes-map-pin",
    html: '<span aria-hidden="true"></span>',
    iconSize: [30, 38],
    iconAnchor: [15, 38],
    popupAnchor: [0, -38],
  }), []);
  const formattedDate = formatEventDateTime(eventDate);

  if (tileError) {
    return <div className="grid min-h-72 place-items-center bg-zinc-900 px-6 text-center text-sm text-zinc-300" role="alert">Não foi possível carregar os tiles do mapa. Você ainda pode usar a rota externa acima.</div>;
  }

  return <div data-testid="osm-map" className={`relative ${className ?? "h-72 min-h-72"}`} aria-busy={!tilesReady}>
    <MapContainer center={[latitude, longitude]} zoom={15} scrollWheelZoom={false} className="h-full min-h-72 w-full" aria-label={`Mapa de ${locationName}`}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        eventHandlers={{
          load: () => setTilesReady(true),
          tileerror: () => { setTileError(true); onError?.("Falha ao carregar os tiles do OpenStreetMap"); },
        }}
      />
      <Marker position={[latitude, longitude]} icon={markerIcon}>
        <Popup>
          <div className="min-w-52 space-y-2 text-sm">
            <strong className="block text-base">{title}</strong>
            <span className="block">{locationName}</span>
            {address && <span className="block text-xs opacity-80">{address}</span>}
            <span className="block text-xs opacity-80">{formattedDate}</span>
            <a href={googleMapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center rounded-md bg-orange-500 px-3 py-2 text-xs font-bold text-white">Como chegar</a>
          </div>
        </Popup>
      </Marker>
    </MapContainer>
    {!tilesReady && <TileSkeleton />}
  </div>;
}
