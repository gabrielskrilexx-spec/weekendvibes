export type PushSubscriptionPayload = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export function vapidPublicKeyToUint8Array(base64Url: string) {
  const normalized = base64Url.trim().replace(/-/g, "+").replace(/_/g, "/");
  if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new Error("invalid_vapid_public_key");
  }
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const decoded = globalThis.atob(padded);
  return Uint8Array.from(decoded, character => character.charCodeAt(0));
}

export function serializePushSubscription(subscription: PushSubscription): PushSubscriptionPayload {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) throw new Error("invalid_push_subscription");
  return { endpoint: json.endpoint, keys: { p256dh, auth } };
}

async function requestSubscriptionMutation(method: "POST" | "DELETE", body: unknown) {
  const response = await fetch("/api/push/subscriptions", {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("push_subscription_request_failed");
}

export async function persistPushSubscription(subscription: PushSubscription) {
  await requestSubscriptionMutation("POST", serializePushSubscription(subscription));
}

export async function deletePushSubscription(endpoint: string) {
  await requestSubscriptionMutation("DELETE", { endpoint });
}

export async function subscribeAndPersistPush(
  registration: ServiceWorkerRegistration,
  vapidPublicKey: string,
  persist: (subscription: PushSubscription) => Promise<void> = persistPushSubscription,
) {
  let subscription = await registration.pushManager.getSubscription();
  let createdHere = false;
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidPublicKeyToUint8Array(vapidPublicKey) as unknown as BufferSource,
    });
    createdHere = true;
  }
  try {
    await persist(subscription);
    return subscription;
  } catch (error) {
    if (createdHere) await subscription.unsubscribe().catch(() => false);
    throw error;
  }
}
