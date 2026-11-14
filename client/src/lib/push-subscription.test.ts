import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deletePushSubscription,
  persistPushSubscription,
  serializePushSubscription,
  subscribeAndPersistPush,
  vapidPublicKeyToUint8Array,
} from "./push-subscription";

afterEach(() => vi.unstubAllGlobals());

function subscription(endpoint = "https://fcm.googleapis.com/fcm/send/example"): PushSubscription {
  return {
    endpoint,
    expirationTime: null,
    options: {} as PushSubscriptionOptions,
    getKey: () => null,
    toJSON: () => ({ endpoint, keys: { p256dh: "p256dh-base64url", auth: "auth-base64url" } }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  } as unknown as PushSubscription;
}

describe("client Push subscription helpers", () => {
  it("converte VAPID base64url para bytes", () => {
    const bytes = vapidPublicKeyToUint8Array("AQIDBA");
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4]);
    expect(bytes).toBeInstanceOf(Uint8Array);
  });

  it("rejeita chave pública VAPID vazia ou malformada", () => {
    expect(() => vapidPublicKeyToUint8Array("")).toThrow("invalid_vapid_public_key");
    expect(() => vapidPublicKeyToUint8Array("!!!")).toThrow("invalid_vapid_public_key");
  });

  it("serializa os campos previstos na API", () => {
    expect(serializePushSubscription(subscription())).toEqual({
      endpoint: "https://fcm.googleapis.com/fcm/send/example",
      keys: { p256dh: "p256dh-base64url", auth: "auth-base64url" },
    });
  });

  it("cria a inscrição com applicationServerKey e a persiste após consentimento", async () => {
    const created = subscription();
    const getSubscription = vi.fn().mockResolvedValue(null);
    const subscribe = vi.fn().mockResolvedValue(created);
    const registration = { pushManager: { getSubscription, subscribe } } as unknown as ServiceWorkerRegistration;
    const persist = vi.fn().mockResolvedValue(undefined);
    const result = await subscribeAndPersistPush(registration, "AQIDBA", persist);
    expect(subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: expect.any(Uint8Array) });
    expect(persist).toHaveBeenCalledWith(created);
    expect(result).toBe(created);
  });

  it("remove a subscription criada localmente se persistência backend falhar", async () => {
    const created = subscription();
    const registration = { pushManager: { getSubscription: vi.fn().mockResolvedValue(null), subscribe: vi.fn().mockResolvedValue(created) } } as unknown as ServiceWorkerRegistration;
    await expect(subscribeAndPersistPush(registration, "AQIDBA", vi.fn().mockRejectedValue(new Error("offline")))).rejects.toThrow("offline");
    expect(created.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("sincroniza criação e remoção pela API com fetch sem cache", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    await persistPushSubscription(subscription());
    await deletePushSubscription("https://fcm.googleapis.com/fcm/send/example");
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/push/subscriptions", expect.objectContaining({
      method: "POST", cache: "no-store", credentials: "same-origin",
      body: JSON.stringify({ endpoint: "https://fcm.googleapis.com/fcm/send/example", keys: { p256dh: "p256dh-base64url", auth: "auth-base64url" } }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/push/subscriptions", expect.objectContaining({
      method: "DELETE", cache: "no-store", body: JSON.stringify({ endpoint: "https://fcm.googleapis.com/fcm/send/example" }),
    }));
  });
});
