const TRACKING_QUERY_KEYS = new Set([
  "fbclid",
  "gclid",
  "igshid",
  "si",
  "mc_cid",
  "mc_eid",
]);

/**
 * Produces the canonical URL used to compare discovered ingestion sources.
 * Tracking parameters and fragments are discarded, while functional query
 * parameters (for example `coupon`) are retained and sorted deterministically.
 */
export function normalizeDiscoveredSourceUrl(rawUrl: string): string | null {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return null;

  try {
    const url = new URL(rawUrl.trim());
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) return null;

    url.protocol = "https:";
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";

    for (const key of Array.from(url.searchParams.keys())) {
      const normalizedKey = key.toLowerCase();
      if (normalizedKey.startsWith("utm_") || TRACKING_QUERY_KEYS.has(normalizedKey)) {
        url.searchParams.delete(key);
      }
    }
    url.searchParams.sort();

    // A trailing slash is not meaningful for source identity. Keep the root
    // URL readable with one slash and remove repeated/trailing slashes from
    // paths so `/event` and `/event/` compare identically.
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    url.pathname = pathname;
    return url.toString();
  } catch {
    return null;
  }
}

export type CanonicalSourceCandidate = {
  id: number;
  sourceKey: string;
  url: string;
  kind?: string;
};

/** Selects an existing source deterministically, preferring canonical sources. */
export function resolveDiscoveredSourceMatch<T extends CanonicalSourceCandidate>(sources: readonly T[], rawUrl: string): T | undefined {
  const canonicalUrl = normalizeDiscoveredSourceUrl(rawUrl);
  if (!canonicalUrl) return undefined;

  return sources
    .filter(source => normalizeDiscoveredSourceUrl(source.url) === canonicalUrl)
    .sort((a, b) => {
      const aInstagram = a.sourceKey.startsWith("public:instagram-") ? 1 : 0;
      const bInstagram = b.sourceKey.startsWith("public:instagram-") ? 1 : 0;
      return aInstagram - bInstagram || a.id - b.id;
    })[0];
}
