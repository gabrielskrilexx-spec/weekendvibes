import { reprocessApifyStoriesRunById } from "./apify-async";

const TARGET_RUN_ID = 71;

export async function temporaryApifyDatasetSyncHandler(_req: any, res: any) {
  try {
    const result = await reprocessApifyStoriesRunById(TARGET_RUN_ID);
    console.info("[temporary Apify dataset sync] completed", result);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.error("[temporary Apify dataset sync] failed", { runId: TARGET_RUN_ID, error: message });
    return res.status(500).json({ ok: false, runId: TARGET_RUN_ID, error: message });
  }
}
