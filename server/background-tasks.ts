import { waitUntil } from "@vercel/functions";

/**
 * Registers work with Vercel's request lifecycle so it may continue after the
 * HTTP response is sent. Outside a Vercel request context, the handled promise
 * remains active in the current Node process for local development and tests.
 */
export function registerBackgroundTask(task: Promise<unknown>, label: string) {
  const handledTask = task.catch(error => {
    console.error(`[Background task] ${label} failed`, error instanceof Error ? error.message : "unknown_error");
  });
  try {
    waitUntil(handledTask);
  } catch (error) {
    console.warn(`[Background task] ${label} could not register with waitUntil`, error instanceof Error ? error.message : "unknown_error");
  }
  return handledTask;
}
