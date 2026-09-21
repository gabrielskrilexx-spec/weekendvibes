import { fetchMetaBusinessDiscoveryPostsDetailed } from "../server/instagram-pipeline.ts";

const token = process.env.META_INSTAGRAM_TOKEN?.trim();
const accountId = process.env.META_INSTAGRAM_ACCOUNT_ID?.trim();

if (!token || !accountId) {
  console.error(JSON.stringify({ ok: false, reason: "META_INSTAGRAM_TOKEN ou META_INSTAGRAM_ACCOUNT_ID ausente" }));
  process.exitCode = 2;
} else {
  try {
    process.env.INGESTION_FORCE_INSTAGRAM = "1";
    const result = await fetchMetaBusinessDiscoveryPostsDetailed(token, accountId, { dryRun: false });
    const failures = result.transportFailures.map((failure) => ({
      username: String(failure.username).slice(0, 80),
      status: Number(failure.status),
      kind: String(failure.kind),
      message: String(failure.message).replace(/(token|secret|key|cookie|authorization)=[^\s&]+/gi, "$1=[redacted]").slice(0, 240),
    }));
    console.log(JSON.stringify({
      ok: failures.length === 0,
      httpStatus: failures.length === 0 ? 200 : failures[0]?.status ?? null,
      posts: result.posts.length,
      transportFailures: failures,
      tokenError: failures.some((failure) => /token|oauth/i.test(failure.message)),
    }, null, 2));
    if (failures.length > 0) process.exitCode = 1;
  } catch (error) {
    const message = String(error?.message ?? error)
      .replace(/(token|secret|key|cookie|authorization)=[^\s&]+/gi, "$1=[redacted]")
      .replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]")
      .slice(0, 240);
    console.error(JSON.stringify({ ok: false, httpStatus: error?.upstreamStatus ?? null, tokenError: /token|oauth/i.test(message), message }, null, 2));
    process.exitCode = 1;
  }
}

if (process.env.INGESTION_FORCE_INSTAGRAM === "1") delete process.env.INGESTION_FORCE_INSTAGRAM;
