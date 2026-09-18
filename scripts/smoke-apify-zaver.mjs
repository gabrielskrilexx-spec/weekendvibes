import { buildInstagramStoriesScraperPayload, INSTAGRAM_TARGETS } from "../server/instagram-pipeline.ts";

const token = process.env.APIFY_API_TOKEN?.trim();
if (!token) throw new Error("APIFY_API_TOKEN ausente no runtime.");
const actor = "zaver.api~instagram-stories-highlights-scraper";
const headers = { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "WeekendVibes/1.0" };
const payload = JSON.stringify(buildInstagramStoriesScraperPayload(INSTAGRAM_TARGETS));
const safeDetail = body => String(body?.error?.message ?? body?.message ?? body?.data?.statusMessage ?? "").replace(/(token|secret|key|cookie|authorization)[^\s]*/gi, "$1=[redacted]").slice(0, 240);

const authResponse = await fetch(`https://api.apify.com/v2/users/me?token=${encodeURIComponent(token)}`, { headers });
const authBody = await authResponse.json().catch(() => ({}));
console.log(JSON.stringify({ check: "credentials", httpStatus: authResponse.status, ok: authResponse.ok, account: authResponse.ok && typeof authBody?.data?.username === "string" ? authBody.data.username : null }));
if (!authResponse.ok) process.exit(2);

let items = [];
let mode = "sync";
let runStatus = "";
let runId = "";
let datasetId = "";
let providerMessage = "";
try {
  const response = await fetch(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`, { method: "POST", headers, body: payload });
  const body = await response.json().catch(() => null);
  items = Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : [];
  providerMessage = safeDetail(body);
  if (!response.ok) throw new Error(`sync-http-${response.status}`);
} catch {
  mode = "async-fallback";
  const dispatch = await fetch(`https://api.apify.com/v2/acts/${actor}/runs?token=${encodeURIComponent(token)}`, { method: "POST", headers, body: payload });
  const dispatchBody = await dispatch.json().catch(() => ({}));
  providerMessage = safeDetail(dispatchBody);
  if (!dispatch.ok) {
    console.log(JSON.stringify({ check: "zaver-stories", actor, mode, dispatchHttpStatus: dispatch.status, runStatus: "DISPATCH_FAILED", providerMessage, itemsRead: 0, storiesRead: 0 }));
    process.exit(3);
  }
  runId = String(dispatchBody?.data?.id ?? "");
  datasetId = String(dispatchBody?.data?.defaultDatasetId ?? "");
  for (let attempt = 0; attempt < 24 && runId; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    const statusResponse = await fetch(`https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}?token=${encodeURIComponent(token)}`, { headers });
    const statusBody = await statusResponse.json().catch(() => ({}));
    runStatus = String(statusBody?.data?.status ?? "");
    providerMessage = safeDetail(statusBody) || providerMessage;
    if (["FAILED", "ABORTED", "TIMED-OUT"].includes(runStatus)) break;
    if (runStatus === "SUCCEEDED" && datasetId) {
      const datasetResponse = await fetch(`https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?token=${encodeURIComponent(token)}&clean=true`, { headers });
      const datasetBody = await datasetResponse.json().catch(() => null);
      items = Array.isArray(datasetBody) ? datasetBody : [];
      break;
    }
  }
}

const stories = items.filter(item => String(item?.item_type ?? item?.type ?? item?.mediaType ?? "").toLowerCase().includes("stor"));
console.log(JSON.stringify({ check: "zaver-stories", actor, mode, runId: runId || null, datasetId: datasetId || null, runStatus: runStatus || "SYNC_RESPONSE", httpStatus: 200, ok: items.length > 0, itemsRead: items.length, storiesRead: stories.length, sampleUsernames: [...new Set(stories.map(item => String(item?.source_username ?? item?.username ?? "")).filter(Boolean))].slice(0, 10), providerMessage }));
if (items.length === 0) process.exit(3);
