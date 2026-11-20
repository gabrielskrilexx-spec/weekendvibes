import { expect, test } from "@playwright/test";

test("publica sitemap XML e JSON-LD/canonical no detalhe de evento", async ({ page, request }) => {
  const sitemapResponse = await request.get("/sitemap.xml");
  expect(sitemapResponse.ok()).toBeTruthy();
  const contentType = sitemapResponse.headers()["content-type"] ?? "";
  if (!contentType.includes("application/xml")) {
    test.skip(true, "O preview Vite estático não registra as rotas Express de sitemap; use E2E_BASE_URL para validar SEO server-side.");
    return;
  }
  const sitemap = await sitemapResponse.text();
  expect(sitemap).toContain("<urlset");
  expect(sitemap).toContain("<loc>");

  const eventUrlMatch = sitemap.match(/<loc>[^<]*\/evento\/[^<]+<\/loc>/);
  if (!eventUrlMatch) {
    test.skip(true, "O ambiente E2E não possui eventos futuros publicados no sitemap.");
    return;
  }

  const eventUrl = eventUrlMatch[0].replace(/^<loc>|<\/loc>$/g, "");
  const detailResponse = await page.goto(eventUrl, { waitUntil: "domcontentloaded" });
  expect(detailResponse?.ok()).toBeTruthy();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", eventUrl);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(2);
  await expect(page.locator('script[type="application/ld+json"]').first()).toContainText('"@type":"Event"');
  await expect(page.locator('script[type="application/ld+json"]').nth(1)).toContainText('"@type":"BreadcrumbList"');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("mobile-event-action-bar")).toBeVisible();
  const relatedLink = page.getByTestId("related-event-link").first();
  if (await relatedLink.count()) {
    const relatedHref = await relatedLink.getAttribute("href");
    expect(relatedHref).toMatch(/^\/evento\/\d+$/);
    await relatedLink.click();
    await expect(page).toHaveURL(new RegExp(`${relatedHref?.replace("/", "\\/")}$`));
    await expect(page.getByTestId("mobile-event-action-bar")).toBeVisible();
  }
});
