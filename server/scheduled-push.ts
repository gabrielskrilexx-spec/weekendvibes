import type { Request, Response } from "express";
import { deactivateEventReminder, listDueEventReminders, listUpcomingWeekendEvents, recordPushDispatch } from "./db";
import { buildWeekendPushPayload, sendPushNotification } from "./push-notifications";

export async function weekendPushHandler(_req: Request, res: Response) {
  try {
    const events = await listUpcomingWeekendEvents();
    const payload = buildWeekendPushPayload(events);
    const result = events.length ? await sendPushNotification(payload) : { sent: 0, failed: 0, expired: 0 };
    await recordPushDispatch({ dispatchType: "weekend", title: payload.title, ...result });
    return res.status(200).json({ ok: true, dispatchType: "weekend", events: events.length, ...result });
  } catch (error) {
    const message = error instanceof Error && error.message === "push_service_not_configured" ? "push_not_configured" : "push_dispatch_failed";
    try { await recordPushDispatch({ dispatchType: "weekend", title: "WeekendVibes", sent: 0, failed: 1, expired: 0, errorMessage: message }); } catch { /* preservar o erro original */ }
    return res.status(message === "push_not_configured" ? 503 : 500).json({ ok: false, error: message });
  }
}

export async function reminderPushHandler(_req: Request, res: Response) {
  try {
    const due = await listDueEventReminders();
    let sent = 0; let failed = 0; let expired = 0;
    for (const reminder of due) {
      const result = await sendPushNotification({
        title: `Lembrete · ${reminder.title}`,
        body: `Seu evento acontece em breve. Confira os detalhes no WeekendVibes.`,
        url: `/evento/${reminder.eventId}`,
        tag: `event-reminder-${reminder.eventId}`,
        recipientUserId: reminder.userId,
      });
      sent += result.sent; failed += result.failed; expired += result.expired;
      await deactivateEventReminder(reminder.id);
    }
    await recordPushDispatch({ dispatchType: "reminder", title: "Lembretes de eventos", sent, failed, expired });
    return res.status(200).json({ ok: true, reminders: due.length, sent, failed, expired });
  } catch {
    try { await recordPushDispatch({ dispatchType: "reminder", title: "Lembretes de eventos", sent: 0, failed: 1, expired: 0, errorMessage: "push_dispatch_failed" }); } catch { /* best effort */ }
    return res.status(500).json({ ok: false, error: "push_dispatch_failed" });
  }
}
