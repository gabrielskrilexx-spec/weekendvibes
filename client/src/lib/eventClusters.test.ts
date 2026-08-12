import { describe, expect, it } from "vitest";
import { clusterLabel, groupEventsByRegion } from "./eventClusters";

const event = (id: number, city: string, latitude: string, longitude: string, title = `Evento ${id}`) => ({ id, city, latitude, longitude, title, slug: `evento-${id}`, locationName: `Local ${id}` });

describe("groupEventsByRegion", () => {
  it("mantém Santos e Guarujá em agrupamentos regionais separados", () => {
    const clusters = groupEventsByRegion([event(1, "Santos", "-23.96", "-46.33"), event(2, "Santos", "-23.965", "-46.335"), event(3, "Guarujá", "-23.99", "-46.25")]);
    expect(clusters).toHaveLength(2);
    expect(clusters.map(cluster => cluster.city)).toEqual(["Santos", "Guarujá"]);
    expect(clusters[0].events).toHaveLength(2);
    expect(clusterLabel(clusters[0])).toBe("Santos: 2 eventos");
  });

  it("cria outro cluster quando eventos da mesma cidade estão distantes", () => {
    const clusters = groupEventsByRegion([event(1, "Santos", "-23.96", "-46.33"), event(2, "Santos", "-23.88", "-46.30")]);
    expect(clusters).toHaveLength(2);
  });

  it("ignora eventos sem coordenadas válidas", () => {
    expect(groupEventsByRegion([event(1, "Santos", "não-informada", "-46.33"), event(2, "Guarujá", "-23.99", "-46.25")])).toHaveLength(1);
  });
});
