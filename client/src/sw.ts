import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, NetworkOnly } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<unknown>;
};
const serviceWorkerScope = self as unknown as {
  addEventListener: (type: "activate", listener: (event: { waitUntil: (promise: Promise<unknown>) => void }) => void) => void;
  clients: { claim: () => Promise<void> };
};

// Remove versões antigas antes de ativar o precache atual.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Dados e mutações nunca podem ser servidos por cache local.
registerRoute(
  ({ url }) => url.pathname === "/api" || url.pathname.startsWith("/api/"),
  new NetworkOnly(),
);

// O HTML de navegação sempre vem da rede; o fallback offline fica na UI React.
registerRoute(
  ({ request }) => request.mode === "navigate",
  new NetworkOnly(),
);

// Única exceção runtime: imagens de venues, que são assets públicos estáticos.
registerRoute(
  ({ url, request }) => request.method === "GET" && /^\/venues\/[^/]+\.webp$/i.test(url.pathname),
  new CacheFirst({
    cacheName: "weekendvibes-venues-v1",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

serviceWorkerScope.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith("weekendvibes-venues-") && name !== "weekendvibes-venues-v1")
        .map((name) => caches.delete(name)),
    );
    await serviceWorkerScope.clients.claim();
  })());
});
