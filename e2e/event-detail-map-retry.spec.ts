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

test("limita o retry do mapa a três tentativas em navegador real", async ({ page }) => {
  await mockDetailApis(page);
  let relayAttempts = 0;
  await page.route("**/api/maps/javascript**", async route => {
    relayAttempts += 1;
    await route.abort("failed");
  });

  await page.goto("/eventos/santos-sunset");
  await expect(page.getByRole("heading", { name: "Santos Sunset" })).toBeVisible();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("Mapa temporariamente indisponível");
  const retry = page.getByRole("button", { name: /Tentar/ });
  await expect(retry).toBeVisible();

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await retry.click();
    await expect.poll(() => relayAttempts).toBe(attempt + 1);
  }

  await expect(alert).toContainText("Não foi possível conectar ao mapa.");
  await expect(alert).toContainText("Atingimos o limite de 3 tentativas.");
  await expect(page.getByRole("button", { name: "Tentativas esgotadas" })).toBeDisabled();
});
