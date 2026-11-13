import { devices, expect, test, type Page } from "@playwright/test";

test.use({ ...devices["Pixel 5"] });

const mockEvents = [{
  id: 101,
  title: "Santos Sunset",
  slug: "santos-sunset",
  city: "Santos",
  locationName: "Moby House",
  latitude: "-23.9610",
  longitude: "-46.3340",
  locationPrecision: "exact",
  imageUrl: null,
  eventDate: "2026-09-12T22:00:00.000Z",
}];

function trpcPayload(data: unknown) {
  return { result: { data: { json: data } } };
}

async function mockApplicationApis(page: Page) {
  await page.route("**/api/trpc/**", async route => {
    const url = new URL(route.request().url());
    const procedures = (url.pathname.split("/").pop() ?? "").split(",").filter(Boolean);
    const responses = procedures.map(procedure => trpcPayload(procedure.includes("events.list") ? mockEvents : []));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(responses.length > 1 ? responses : responses[0]) });
  });
  await page.addInitScript(() => {
    localStorage.setItem("weekendvibes-cookie-consent", "rejected");
    const errors: string[] = [];
    window.addEventListener("error", event => errors.push(String(event.error ?? event.message)));
    window.addEventListener("unhandledrejection", event => errors.push(String(event.reason)));
    Object.defineProperty(window, "__mapE2eErrors", { configurable: true, get: () => errors });
  });
}

test("mantém a Home mobile sem mapa embutido e sem erros de interface", async ({ page }) => {
  await mockApplicationApis(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Rolês para você" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mapa dos rolês" })).toHaveCount(0);
  await expect(page.getByTestId("map-canvas")).toHaveCount(0);
  await expect(page.evaluate(() => (window as unknown as { __mapE2eErrors: string[] }).__mapE2eErrors)).resolves.toEqual([]);
});
