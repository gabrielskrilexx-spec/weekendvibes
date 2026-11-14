import webPush from "web-push";
import { deletePushSubscription, listPushSubscriptions, upsertPushSubscription } from "./db";

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type PushNotificationInput = {
  title: string;
  body: string;
  url: string;
  tag?: string;
};

export class PushServiceConfigurationError extends Error {
  constructor() {
    super("push_service_not_configured");
    this.name = "PushServiceConfigurationError";
  }
}

/** Only browser push-service origins are accepted; this prevents arbitrary server-side HTTPS requests. */
export function isAllowedPushEndpoint(endpoint: string) {
  try {
    const parsed = new URL(endpoint);
    const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
    return parsed.protocol === "https:" && (
      host === "fcm.googleapis.com" ||
      host === "web.push.apple.com" ||
      host === "updates.push.services.mozilla.com" ||
      host.endsWith(".push.services.mozilla.com")
    );
  } catch {
    return false;
  }
}

export async function savePushSubscription(input: PushSubscriptionInput) {
  if (!isAllowedPushEndpoint(input.endpoint)) throw new Error("invalid_push_endpoint");
  await upsertPushSubscription({
    endpoint: input.endpoint,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
  });
}

export async function removePushSubscription(endpoint: string) {
  if (!isAllowedPushEndpoint(endpoint)) throw new Error("invalid_push_endpoint");
  return deletePushSubscription(endpoint);
}

function readVapidConfiguration() {
  const publicKey = process.env.VITE_VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = process.env.VAPID_SUBJECT?.trim() ?? "";
  const subjectIsValid = subject.startsWith("mailto:") || (() => {
    try { return new URL(subject).protocol === "https:"; } catch { return false; }
  })();
  if (!publicKey || !privateKey || !subjectIsValid) throw new PushServiceConfigurationError();
  return { publicKey, privateKey, subject };
}

function statusCodeOf(error: unknown) {
  if (!error || typeof error !== "object" || !("statusCode" in error)) return undefined;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === "number" ? statusCode : undefined;
}

export async function sendPushNotification(input: PushNotificationInput) {
  const vapid = readVapidConfiguration();
  try {
    webPush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  } catch {
    throw new PushServiceConfigurationError();
  }

  const subscriptions = await listPushSubscriptions();
  const payload = JSON.stringify({
    title: input.title,
    body: input.body,
    url: input.url,
    ...(input.tag ? { tag: input.tag } : {}),
  });
  let sent = 0;
  let failed = 0;
  let expired = 0;
  const batchSize = 20;

  for (let offset = 0; offset < subscriptions.length; offset += batchSize) {
    const batch = subscriptions.slice(offset, offset + batchSize);
    await Promise.all(batch.map(async subscription => {
      if (!isAllowedPushEndpoint(subscription.endpoint)) {
        failed += 1;
        return;
      }
      try {
        await webPush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, payload, { TTL: 60 * 60, urgency: "high" });
        sent += 1;
      } catch (error) {
        if (statusCodeOf(error) === 404 || statusCodeOf(error) === 410) {
          try {
            await deletePushSubscription(subscription.endpoint);
            expired += 1;
          } catch {
            failed += 1;
          }
          return;
        }
        failed += 1;
      }
    }));
  }

  return { sent, failed, expired };
}
