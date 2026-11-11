import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, NetworkOnly } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<unknown>;
};
type WorkerWaitableEvent = { waitUntil: (promise: Promise<unknown>) => void };
type WorkerPushEvent = WorkerWaitableEvent & { data: { json: () => unknown; text: () => string } | null };
type WorkerNotificationEvent = WorkerWaitableEvent & { notification: { data: unknown; close: () => void } };
type WorkerWindowClient = { url: string; navigate: (url: string) => Promise<unknown>; focus: () => Promise<unknown> };
const serviceWorkerScope = self as unknown as {
  addEventListener: {
    (type: "activate", listener: (event: WorkerWaitableEvent) => void): void;
    (type: "push", listener: (event: WorkerPushEvent) => void): void;
    (type: "notificationclick", listener: (event: WorkerNotificationEvent) => void): void;
  };
  location: { origin: string };
  registration: { showNotification: (title: string, options: NotificationOptions) => Promise<void> };
  clients: {
    claim: () => Promise<void>;
    matchAll: (options: { type: "window"; includeUncontrolled: boolean }) => Promise<WorkerWindowClient[]>;
    openWindow: (url: string) => Promise<unknown>;
  };
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

serviceWorkerScope.addEventListener("push", (event: WorkerPushEvent) => {
  let payload: { title?: unknown; body?: unknown; url?: unknown; tag?: unknown } = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { body: event.data?.text() ?? "Confira a programação deste fim de semana." };
  }
  const title = typeof payload.title === "string" ? payload.title.slice(0, 100) : "WeekendVibes";
  const body = typeof payload.body === "string" ? payload.body.slice(0, 220) : "Novos eventos para curtir na Baixada Santista.";
  const rawUrl = typeof payload.url === "string" ? payload.url : "/agenda";
  let targetUrl = "/agenda";
  try {
    const candidate = new URL(rawUrl, serviceWorkerScope.location.origin);
    if (candidate.origin === serviceWorkerScope.location.origin) targetUrl = `${candidate.pathname}${candidate.search}${candidate.hash}`;
  } catch {
    targetUrl = "/agenda";
  }
  const tag = typeof payload.tag === "string" ? payload.tag.slice(0, 100) : "weekendvibes-events";
  event.waitUntil(serviceWorkerScope.registration.showNotification(title, {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag,
    data: { url: targetUrl },
  }));
});

serviceWorkerScope.addEventListener("notificationclick", (event: WorkerNotificationEvent) => {
  event.notification.close();
  const data = event.notification.data as { url?: unknown } | null;
  const rawUrl = typeof data?.url === "string" ? data.url : "/agenda";
  let targetUrl = new URL("/agenda", serviceWorkerScope.location.origin).href;
  try {
    const candidate = new URL(rawUrl, serviceWorkerScope.location.origin);
    if (candidate.origin === serviceWorkerScope.location.origin) targetUrl = candidate.href;
  } catch {
    targetUrl = new URL("/agenda", serviceWorkerScope.location.origin).href;
  }
  event.waitUntil((async () => {
    const windows = await serviceWorkerScope.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(serviceWorkerScope.location.origin)) {
        await client.navigate(targetUrl);
        await client.focus();
        return;
      }
    }
    await serviceWorkerScope.clients.openWindow(targetUrl);
  })());
});
