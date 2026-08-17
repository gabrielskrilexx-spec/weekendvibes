export type ClusterableEvent = {
  id: number;
  title: string;
  slug: string;
  city: string;
  locationName: string;
  latitude: string | number | null;
  longitude: string | number | null;
  imageUrl?: string | null;
  eventDate?: Date | string | number | null;
  locationPrecision?: string | null;
};

export const BAIXADA_BOUNDS = {
  north: -23.88,
  south: -24.08,
  east: -46.12,
  west: -46.48,
} as const;

export const CITY_CENTERS = {
  Santos: { latitude: -23.9608, longitude: -46.3336 },
  Guarujá: { latitude: -23.9931, longitude: -46.2564 },
} as const;

export function mapCoordinatesFor(event: Pick<ClusterableEvent, "city" | "latitude" | "longitude" | "locationPrecision">) {
  const hasLatitude = event.latitude !== null && event.latitude !== undefined && event.latitude !== "";
  const hasLongitude = event.longitude !== null && event.longitude !== undefined && event.longitude !== "";
  const latitude = Number(event.latitude);
  const longitude = Number(event.longitude);
  if (hasLatitude && hasLongitude && Number.isFinite(latitude) && Number.isFinite(longitude) && event.locationPrecision !== "approximate") return { latitude, longitude, approximate: false };
  const city = event.city === "Guarujá" ? "Guarujá" : "Santos";
  return { ...CITY_CENTERS[city], approximate: true };
}

export type EventCluster = {
  id: string;
  city: string;
  latitude: number;
  longitude: number;
  events: ClusterableEvent[];
  approximate: boolean;
};

const CITY_ORDER = ["Santos", "Guarujá"];

function distanceSquared(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  return (a.latitude - b.latitude) ** 2 + (a.longitude - b.longitude) ** 2;
}

/** Groups nearby events while keeping Santos and Guarujá in separate regional clusters. */
export function groupEventsByRegion(events: ClusterableEvent[], radius = 0.012): EventCluster[] {
  const clusters: EventCluster[] = [];
  const ordered = [...events].sort((a, b) => CITY_ORDER.indexOf(a.city) - CITY_ORDER.indexOf(b.city) || a.title.localeCompare(b.title));

  for (const event of ordered) {
    const coordinates = mapCoordinatesFor(event);
    const { latitude, longitude } = coordinates;

    const candidate = clusters.find(cluster => cluster.city === event.city && distanceSquared(cluster, { latitude, longitude }) <= radius ** 2);
    if (candidate) {
      candidate.events.push(event);
      const points = candidate.events.map(mapCoordinatesFor);
      candidate.latitude = points.reduce((sum, point) => sum + point.latitude, 0) / points.length;
      candidate.longitude = points.reduce((sum, point) => sum + point.longitude, 0) / points.length;
      candidate.approximate = candidate.approximate || coordinates.approximate;
    } else {
      clusters.push({ id: `${event.city}-${clusters.length + 1}`, city: event.city, latitude, longitude, events: [event], approximate: coordinates.approximate });
    }
  }

  return clusters.sort((a, b) => CITY_ORDER.indexOf(a.city) - CITY_ORDER.indexOf(b.city) || a.id.localeCompare(b.id));
}

export function clusterLabel(cluster: EventCluster) {
  return `${cluster.city}: ${cluster.events.length} ${cluster.events.length === 1 ? "evento" : "eventos"}`;
}
