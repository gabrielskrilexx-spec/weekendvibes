import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "allow" });

function trpcPayload(data: unknown) {
  return { result: { data: { json: data } } };
}

const venueAssets = [
  "goat.webp", "curvao.webp", "guaruja-golf-club.webp", "almare.webp", "flamingos.webp",
  "vallum-garden.webp", "bluemed.webp", "parquevalongo.webp", "casa412.webp", "laroc.webp",
  "obeco.webp", "dolores.webp", "projac.webp", "meulugar.webp", "mobydick.webp",
];

async function prepareHome(page: Page) {
  await page.addInitScript(() => localStorage.setItem("weekendvibes-cookie-consent", "rejected"));
  await page.route("**/api/trpc/**", async route => {
    const procedures = (new URL(route.request().url()).pathname.split("/").pop() ?? "").split(",").filter(Boolean);
    const results = procedures.map(procedure => trpcPayload(procedure === "venues.list" ? [] : procedure === "auth.me" ? null : []));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(results.length > 1 ? results : results[0]) });
  });
}

test("rotas API são network-only e nunca gravadas no CacheStorage", async ({ page }) => {
  await prepareHome(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Palcos da Baixada" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  const apiUrl = new URL("/api/e2e-network-only", page.url()).href;
  const firstResponse = await page.evaluate(async url => {
    const response = await fetch(url);
    return { status: response.status, fromCache: response.headers.get("x-workbox-cache") !== null };
  }, apiUrl);
  expect(firstResponse.status).toBe(200);
  expect(firstResponse.fromCache).toBe(false);
  const cachedResponse = await page.evaluate(async url => Boolean(await caches.match(url)), apiUrl);
  expect(cachedResponse).toBe(false);

  await page.context().setOffline(true);
  const offlineResult = await page.evaluate(async url => {
    try { await fetch(url); return "resolved"; } catch { return "rejected"; }
  }, apiUrl);
  expect(offlineResult).toBe("rejected");
  await page.context().setOffline(false);
});

test("mostra o estado 'Sem conexão' quando o navegador fica offline", async ({ page, context }) => {
  await prepareHome(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Palcos da Baixada" })).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText(/Sem conexão\. Os eventos serão atualizados quando a internet voltar\./)).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText(/Sem conexão\. Os eventos serão atualizados quando a internet voltar\./)).toHaveCount(0);
});

test("renderiza os 15 venues oficiais com WebP válidos e sem imagens quebradas", async ({ page }) => {
  await prepareHome(page);
  await page.goto("/");
  const venueSection = page.locator("section[aria-labelledby='venues-heading']");
  await expect(venueSection.getByRole("heading", { name: "Palcos da Baixada" })).toBeVisible();
  const images = venueSection.locator("#venues-carousel img");
  await expect(images).toHaveCount(15);
  const imageResults = [];
  for (let index = 0; index < await images.count(); index += 1) {
    const image = images.nth(index);
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).complete)).toBe(true);
    imageResults.push(await image.evaluate(element => {
      const img = element as HTMLImageElement;
      return { src: new URL(img.currentSrc || img.src).pathname, complete: img.complete, width: img.naturalWidth };
    }));
  }
  expect(imageResults.map(image => image.src)).toEqual(venueAssets.map(name => `/venues/${name}`));
  for (const image of imageResults) {
    expect(image.complete, `${image.src} deve terminar o carregamento`).toBe(true);
    expect(image.width, `${image.src} deve ter dimensões válidas`).toBeGreaterThan(0);
  }
  const statuses = await Promise.all(venueAssets.map(async filename => {
    const response = await page.request.get(`/venues/${filename}`);
    return { filename, status: response.status(), contentType: response.headers()["content-type"] ?? "" };
  }));
  expect(statuses.filter(item => item.status !== 200)).toEqual([]);
  expect(statuses.filter(item => !item.contentType.includes("image/webp"))).toEqual([]);
});
