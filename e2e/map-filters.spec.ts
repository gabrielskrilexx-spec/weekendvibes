import { expect, test, type Page } from "@playwright/test";

const mockEvents = [
  {
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
  },
  {
    id: 102,
    title: "Santos After",
    slug: "santos-after",
    city: "Santos",
    locationName: "Moby House",
    latitude: "-23.9615",
    longitude: "-46.3345",
    locationPrecision: "exact",
    imageUrl: null,
    eventDate: "2026-09-13T22:00:00.000Z",
  },
  {
    id: 103,
    title: "Guarujá Beats",
    slug: "guaruja-beats",
    city: "Guarujá",
    locationName: "Rocket Sea Club",
    latitude: "-23.9930",
    longitude: "-46.2560",
    locationPrecision: "exact",
    imageUrl: null,
    eventDate: "2026-09-12T22:00:00.000Z",
  },
];

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

async function openMap(page: Page) {
  await mockApplicationApis(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Mapa dos rolês" })).toBeVisible();
  await expect(page.getByTestId("map-visible-event-count")).toHaveText("3 eventos visíveis");
  await expect(page.getByTestId("map-canvas")).toHaveAttribute("data-marker-count", "3");
  await expect(page.getByTestId("map-canvas")).toHaveAttribute("data-cluster-count", "2");
}

test.describe("Mapa dos rolês — filtros e clustering", () => {
  test("alterna Santos e Guarujá sem erro de console e atualiza pins/clusters", async ({ page }) => {
    await openMap(page);

    await page.getByRole("checkbox", { name: "Filtrar Santos" }).setChecked(false, { force: true });
    await expect(page.getByTestId("map-visible-event-count")).toHaveText("1 eventos visíveis");
    await expect(page.getByTestId("map-canvas")).toHaveAttribute("data-marker-count", "1");
    await expect(page.getByTestId("map-canvas")).toHaveAttribute("data-cluster-count", "1");
    await expect(page.getByRole("button", { name: "Guarujá Rocket Sea Club" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Santos Moby House" })).toHaveCount(0);

    await page.getByRole("checkbox", { name: "Filtrar Santos" }).setChecked(true, { force: true });
    await page.getByRole("checkbox", { name: "Filtrar Guarujá" }).setChecked(false, { force: true });
    await expect(page.getByTestId("map-visible-event-count")).toHaveText("2 eventos visíveis");
    await expect(page.getByTestId("map-canvas")).toHaveAttribute("data-marker-count", "2");
    await expect(page.getByTestId("map-canvas")).toHaveAttribute("data-cluster-count", "1");

    const errors = await page.evaluate(() => (window as unknown as { __mapE2eErrors: string[] }).__mapE2eErrors);
    expect(errors).toEqual([]);
  });

  test("mantém o carregamento perceptível e registra FCP/LCP sem erros", async ({ page }) => {
    await openMap(page);

    const metrics = await page.evaluate(() => {
      const paints = performance.getEntriesByType("paint") as PerformancePaintTiming[];
      const fcp = paints.find(entry => entry.name === "first-contentful-paint")?.startTime ?? 0;
      const lcp = (performance.getEntriesByType("largest-contentful-paint").at(-1) as LargestContentfulPaint | undefined)?.startTime ?? 0;
      return { fcp, lcp, hasMapLoadingSemantics: Boolean(document.querySelector('[aria-busy="false"], [aria-label*="Carregando"]')) };
    });

    expect(metrics.fcp).toBeGreaterThan(0);
    expect(metrics.fcp).toBeLessThan(4000);
    if (metrics.lcp > 0) expect(metrics.lcp).toBeLessThan(5000);
    expect(metrics.hasMapLoadingSemantics).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { __mapE2eErrors: string[] }).__mapE2eErrors)).toEqual([]);
  });

  test("filtra coordenadas exatas e aproximadas preservando o estado do cluster", async ({ page }) => {
    await openMap(page);

    await page.getByRole("checkbox", { name: "Filtrar Exato" }).setChecked(false, { force: true });
    await expect(page.getByTestId("map-visible-event-count")).toHaveText("0 eventos visíveis");
    await expect(page.getByTestId("map-canvas")).toHaveAttribute("data-marker-count", "0");
    await expect(page.getByTestId("map-canvas")).toHaveAttribute("data-cluster-count", "0");
    await expect(page.getByText("Nenhum evento com localização disponível para exibir no mapa.")).toBeVisible();

    await page.getByRole("checkbox", { name: "Filtrar Exato" }).setChecked(true, { force: true });
    await expect(page.getByTestId("map-visible-event-count")).toHaveText("3 eventos visíveis");
    await expect(page.getByTestId("map-canvas")).toHaveAttribute("data-marker-count", "3");
    await expect(page.getByTestId("map-canvas")).toHaveAttribute("data-cluster-count", "2");
  });
});


test.describe("Mapa dos rolês — recuperação e preferência de visualização", () => {
  test("avisa quando a conexão impede o carregamento do mapa", async ({ page }) => {
    await mockApplicationApis(page);
    await page.addInitScript(() => Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false }));
    await page.route("**/api/maps/javascript**", route => route.abort("failed"));
    await page.goto("/");
    await page.getByRole("heading", { name: "Mapa dos rolês" }).scrollIntoViewIfNeeded();

    await expect(page.getByRole("alert")).toContainText("Parece que você está sem conexão.");
    await expect(page.getByRole("alert")).toContainText("Verifique sua internet e tente novamente.");
    await expect(page.getByRole("button", { name: "Ver em Lista" })).toBeVisible();
    await page.getByRole("button", { name: "Ver em Lista" }).click();
    await expect(page.getByTestId("detailed-event-list")).toBeVisible();
    await expect(page.getByRole("button", { name: "Lista detalhada" })).toHaveAttribute("aria-pressed", "true");
  });

  test("persiste a escolha de lista detalhada após recarregar", async ({ page }) => {
    await openMap(page);
    await page.getByRole("button", { name: "Lista detalhada" }).click();
    await expect(page.getByTestId("detailed-event-list")).toBeVisible();
    await expect(page.getByRole("button", { name: "Lista detalhada" })).toHaveAttribute("aria-pressed", "true");

    await page.reload();
    await expect(page.getByTestId("detailed-event-list")).toBeVisible();
    await expect(page.getByRole("button", { name: "Lista detalhada" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("view-mode-toggle")).toBeVisible();
  });
});

  test("recarrega automaticamente quando a conexão é restabelecida", async ({ page }) => {
    await mockApplicationApis(page);
    await page.addInitScript(() => {
      let online = false;
      Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });
      Object.defineProperty(window, "__setMapOnline", {
        configurable: true,
        value: () => {
          online = true;
          window.dispatchEvent(new Event("online"));
        },
      });
    });

    let relayAttempts = 0;
    await page.route("**/api/maps/javascript**", async route => {
      relayAttempts += 1;
      if (relayAttempts === 1) {
        await route.abort("failed");
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: "window.google={maps:{Map:function(){},}}; window.__weekendVibesMapsReady&&window.__weekendVibesMapsReady();",
      });
    });

    await page.goto("/");
    await page.getByRole("heading", { name: "Mapa dos rolês" }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("alert")).toContainText("Parece que você está sem conexão.");

    await page.evaluate(() => (window as unknown as { __setMapOnline: () => void }).__setMapOnline());
    await expect.poll(() => relayAttempts).toBeGreaterThanOrEqual(2);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
