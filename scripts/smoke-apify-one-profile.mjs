import { buildInstagramStoriesScraperPayload, INSTAGRAM_TARGETS } from "../server/instagram-pipeline.ts";

const token = process.env.APIFY_API_TOKEN?.trim();
if (!token) throw new Error("APIFY_API_TOKEN ausente no runtime.");

const actor = process.env.APIFY_STORIES_ACTOR_ID?.trim() || "zaver.api~instagram-stories-highlights-scraper";
const requestedUsernames = (process.env.APIFY_TEST_USERNAMES || "plantssantos")
  .split(",")
  .map((username) => username.trim().replace(/^@/, "").toLowerCase())
  .filter(Boolean)
  .slice(0, 2);
const targets = requestedUsernames.map((username) => INSTAGRAM_TARGETS.find((candidate) => candidate.username === username) || { username });
const headers = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "User-Agent": "WeekendVibes/1.0",
};
const safeDetail = (body) => String(body?.error?.message ?? body?.message ?? body?.data?.statusMessage ?? "")
  .replace(/(token|secret|key|cookie|authorization)[^\s]*/gi, "$1=[redacted]")
  .slice(0, 240);

const authResponse = await fetch(`https://api.apify.com/v2/users/me?token=${encodeURIComponent(token)}`, { headers });
const authBody = await authResponse.json().catch(() => ({}));
console.log(JSON.stringify({
  check: "credentials",
  httpStatus: authResponse.status,
  ok: authResponse.ok,
  accountConfigured: authResponse.ok && typeof authBody?.data?.username === "string",
}));
if (!authResponse.ok) process.exit(2);

const payload = buildInstagramStoriesScraperPayload(targets);
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 60_000);
let response;
try {
  response = await fetch(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: controller.signal,
  });
} catch (error) {
  clearTimeout(timeout);
  console.log(JSON.stringify({
    check: "one-profile-stories",
    actor,
    profiles: requestedUsernames,
    httpStatus: null,
    ok: false,
    error: error instanceof Error && error.name === "AbortError" ? "actor_timeout" : "network_error",
  }));
  process.exit(3);
}
clearTimeout(timeout);
const body = await response.json().catch(() => null);
const items = Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : [];
const stories = items.filter((item) => String(item?.item_type ?? item?.type ?? item?.mediaType ?? "").toLowerCase().includes("stor"));
console.log(JSON.stringify({
  check: "one-profile-stories",
  actor,
  profiles: requestedUsernames,
  httpStatus: response.status,
  ok: response.ok,
  itemsRead: items.length,
  storiesRead: stories.length,
  providerMessage: safeDetail(body),
}));
if (!response.ok) process.exit(4);
process.exit(0);
