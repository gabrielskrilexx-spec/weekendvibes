import { expect, test } from "@playwright/test";

function trpcPayload(data: unknown) {
  return { result: { data: { json: data } } };
}

test("mantém mapas isolados na página de detalhes e não os renderiza na Home", async ({ page }) => {
  await page.route("**/api/trpc/**", async route => {
    const url = new URL(route.request().url());
    const procedures = (url.pathname.split("/").pop() ?? "").split(",").filter(Boolean);
    const responses = procedures.map(() => trpcPayload([]));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(responses.length > 1 ? responses : responses[0]),
    });
  });
  await page.addInitScript(() => {
    localStorage.setItem("weekendvibes-cookie-consent", "rejected");
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "O que vai rolar?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mapa dos rolês" })).toHaveCount(0);
  await expect(page.getByTestId("map-canvas")).toHaveCount(0);
});
