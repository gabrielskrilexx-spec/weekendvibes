import { expect, test, type Page } from "@playwright/test";

const event = {
  id: 101,
  title: "Santos Sunset",
  slug: "santos-sunset",
  city: "Santos",
  locationName: "Moby House",
  address: "Avenida Atlântica, 101",
  latitude: "-23.9610",
  longitude: "-46.3340",
  locationPrecision: "exact",
  imageUrl: null,
  eventDate: "2026-09-12T22:00:00.000Z",
  endDate: null,
  category: "Música",
  genre: "House",
  description: "Uma noite especial em Santos.",
  priceCents: 5000,
  priceNote: "R$ 50,00",
  sourceUrl: "https://example.com/ingressos",
  ticketStatus: "available",
};

function trpcPayload(data: unknown) {
  return { result: { data: { json: data } } };
}

async function mockDetailApis(page: Page) {
  await page.route("**/api/trpc/**", async route => {
    const url = new URL(route.request().url());
    const procedures = (url.pathname.split("/").pop() ?? "").split(",").filter(Boolean);
    const responses = procedures.map(procedure => trpcPayload(procedure.includes("events.bySlug") ? event : []));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(responses.length > 1 ? responses : responses[0]),
    });
  });
  await page.addInitScript(() => {
    localStorage.setItem("weekendvibes-cookie-consent", "rejected");
  });
}

test("carrega mapa zero-config do OpenStreetMap e posiciona o pin do evento", async ({ page }) => {
  await mockDetailApis(page);
  const externalRequests: string[] = [];
  page.on("request", request => {
    if (request.url().includes("maps.googleapis.com") || request.url().includes("mapbox")) externalRequests.push(request.url());
  });
  await page.route("https://{a,b,c}.tile.openstreetmap.org/**", async route => {
    await route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") });
  });

  await page.goto("/eventos/santos-sunset");
  await expect(page.getByRole("heading", { name: "Santos Sunset" })).toBeVisible();
  await expect(page.getByTestId("osm-map")).toBeVisible();
  await expect(page.locator(".weekendvibes-map-pin")).toHaveCount(1);
  await page.locator(".weekendvibes-map-pin").click();
  await expect(page.getByTestId("osm-map").getByText("Avenida Atlântica, 101")).toBeVisible();
  await expect(page.getByTestId("osm-map").getByText(/12\/09\/2026/)).toBeVisible();
  await expect(page.getByTestId("osm-map").getByRole("link", { name: "Como chegar" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Traçar rota/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Pontos próximos/ })).toBeVisible();
  expect(externalRequests).toEqual([]);
});
