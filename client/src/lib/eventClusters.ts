export type ClusterableEvent = {
  id: number;
  title: string;
  slug: string;
  city: string;
  locationName: string;
  latitude: string | number | null;
  longitude: string | number | null;
};

export type EventCluster = {
  id: string;
  city: string;
  latitude: number;
  longitude: number;
  events: ClusterableEvent[];
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
    const latitude = Number(event.latitude);
    const longitude = Number(event.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

    const candidate = clusters.find(cluster => cluster.city === event.city && distanceSquared(cluster, { latitude, longitude }) <= radius ** 2);
    if (candidate) {
      candidate.events.push(event);
      candidate.latitude = candidate.events.reduce((sum, item) => sum + Number(item.latitude), 0) / candidate.events.length;
      candidate.longitude = candidate.events.reduce((sum, item) => sum + Number(item.longitude), 0) / candidate.events.length;
    } else {
      clusters.push({ id: `${event.city}-${clusters.length + 1}`, city: event.city, latitude, longitude, events: [event] });
    }
  }

  return clusters.sort((a, b) => CITY_ORDER.indexOf(a.city) - CITY_ORDER.indexOf(b.city) || a.id.localeCompare(b.id));
}

export function clusterLabel(cluster: EventCluster) {
  return `${cluster.city}: ${cluster.events.length} ${cluster.events.length === 1 ? "evento" : "eventos"}`;
}
