import { expect, test, type Page } from "@playwright/test";

test.use({ serviceWorkers: "allow" });

function trpcPayload(data: unknown) {
  return { result: { data: { json: data } } };
}

const venueAssets = [
  "goat.webp", "curvao.webp", "guaruja-golf-club.webp", "almare.webp", "flamingos.webp",
  "vallum-garden.webp", "bluemed.webp", "parquevalongo.webp", "casa412.webp", "laroc.webp",
  "obeco.webp", "dolores.webp", "projac.webp", "meulugar.webp", "mobydick.webp", "arena-club.webp", "yellow-house.webp",
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
  const oauthCallbackUrl = new URL("/api/oauth/callback?code=single-use&state=opaque", page.url()).href;
  const oauthCallbackCached = await page.evaluate(async url => Boolean(await caches.match(url)), oauthCallbackUrl);
  expect(oauthCallbackCached).toBe(false);

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

test("exibe erro OAuth de forma amigável e limpa o motivo na nova tentativa", async ({ page }) => {
  await page.route("**/api/trpc/auth.me**", async route => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(trpcPayload(null)) });
  });
  await page.goto("/admin?oauth_error=bad_verification_code");
  await expect(page.getByRole("alert")).toContainText("código do GitHub expirou ou já foi usado");
  await expect(page.getByTestId("admin-oauth-login")).toHaveAttribute("href", "/api/oauth/login?redirect_to=%2Fadmin");
  await expect(page.locator("body")).not.toContainText("The code passed is incorrect or expired");
});

test("renderiza os 17 venues oficiais com WebP válidos e sem imagens quebradas", async ({ page }) => {
  await prepareHome(page);
  await page.goto("/");
  const venueSection = page.locator("section[aria-labelledby='venues-heading']");
  await expect(venueSection.getByRole("heading", { name: "Palcos da Baixada" })).toBeVisible();
  const images = venueSection.locator("#venues-carousel img");
  await expect(images).toHaveCount(17);
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

test("separa o manifesto e o ícone do atalho administrativo", async ({ page }) => {
  const adminHtml = await page.request.get("/admin");
  expect(adminHtml.status()).toBe(200);
  const adminHtmlBody = await adminHtml.text();
  expect(adminHtmlBody).toContain('<link rel="manifest" href="/admin-manifest.webmanifest"');
  expect(adminHtmlBody).toContain('<link rel="icon" type="image/png" sizes="192x192" href="/icons/admin-icon-192.png"');
  expect(adminHtmlBody).toContain('<link rel="shortcut icon" type="image/png" href="/icons/admin-icon-192.png"');
  expect(adminHtmlBody).toContain('<link rel="apple-touch-icon" sizes="180x180" href="/icons/admin-icon-180.png"');
  expect(adminHtmlBody).not.toContain("/favicon.svg");
  expect(adminHtmlBody).not.toContain("/icons/icon-");
  expect(adminHtmlBody).toContain("WeekendVibes Admin");
  const adminHealthHtml = await page.request.get("/admin/health");
  expect(adminHealthHtml.status()).toBe(200);
  expect(await adminHealthHtml.text()).toContain('/admin-manifest.webmanifest');
  await page.goto("/admin");
  await expect.poll(() => page.locator('link[data-pwa-manifest]').getAttribute("href")).toBe("/admin-manifest.webmanifest");
  await expect(page).toHaveTitle("WeekendVibes Admin");
  await expect.poll(() => page.locator('link[data-pwa-apple-icon]').getAttribute("href")).toBe("/icons/admin-icon-180.png");
  const manifestResponse = await page.request.get("/admin-manifest.webmanifest");
  expect(manifestResponse.status()).toBe(200);
  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe("WeekendVibes Admin");
  expect(manifest.id).toBe("/admin");
  expect(manifest.start_url).toBe("/admin");
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ src: "/icons/admin-icon-512-maskable.png", purpose: "maskable" }),
  ]));
  for (const icon of ["/icons/admin-icon-180.png", "/icons/admin-icon-192.png", "/icons/admin-icon-512.png", "/icons/admin-icon-512-maskable.png"]) {
    const response = await page.request.get(icon);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  }
});

test("mantém a tela de login na rota admin antes da autenticação", async ({ page }) => {
  await page.route("**/api/trpc/auth.me**", async route => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(trpcPayload(null)) });
  });
  await page.goto("/admin/health");
  await expect(page).toHaveURL(/\/admin\/health$/);
  await expect(page.getByTestId("admin-login-screen")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Acesse o painel administrativo" })).toBeVisible();
  const loginLink = page.getByRole("link", { name: "Entrar como administrador" });
  await expect(loginLink).toBeVisible();
  await expect(loginLink).toHaveAttribute("href", "/api/oauth/login?redirect_to=%2Fadmin%2Fhealth");
  await expect(page.locator('link[data-pwa-manifest]')).toHaveAttribute("href", "/admin-manifest.webmanifest");
});
