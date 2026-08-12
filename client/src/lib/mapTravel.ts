export const TRAVEL_MODES = {
  driving: { label: "Carro", mapsMode: "driving", speedKmh: 28 },
  transit: { label: "Transporte público", mapsMode: "transit", speedKmh: 22 },
  bicycling: { label: "Bicicleta", mapsMode: "bicycling", speedKmh: 15 },
  walking: { label: "Caminhada", mapsMode: "walking", speedKmh: 5.5 },
} as const;

export type TravelMode = keyof typeof TRAVEL_MODES;
export type Coordinates = { latitude: number; longitude: number };

export function distanceInKm(from: Coordinates, to: Coordinates) {
  const earthRadiusKm = 6371;
  const latDelta = ((to.latitude - from.latitude) * Math.PI) / 180;
  const lngDelta = ((to.longitude - from.longitude) * Math.PI) / 180;
  const fromLat = (from.latitude * Math.PI) / 180;
  const toLat = (to.latitude * Math.PI) / 180;
  const a = Math.sin(latDelta / 2) ** 2 + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estimateMinutes(distanceKm: number, mode: TravelMode) {
  return Math.max(1, Math.round((distanceKm / TRAVEL_MODES[mode].speedKmh) * 60));
}

export function formatDistance(distanceKm: number) {
  return distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1).replace(".", ",")} km`;
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}min` : `${hours}h`;
}
