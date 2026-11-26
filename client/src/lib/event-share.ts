export type EventShareData = { title: string; text: string; url: string };

export function canonicalEventUrl(eventId: number, origin?: string) {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "https://weekendvib-oficial.manus.space");
  return `${base.replace(/\/$/, "")}/evento/${eventId}`;
}

export async function shareEventLink(
  data: EventShareData,
  capabilities: { share?: (data: EventShareData) => Promise<void>; writeText: (url: string) => Promise<void> },
) {
  try {
    if (capabilities.share) {
      await capabilities.share(data);
      return "shared" as const;
    }
    await capabilities.writeText(data.url);
    return "copied" as const;
  } catch {
    return "cancelled" as const;
  }
}
