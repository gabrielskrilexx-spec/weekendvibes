import { Resvg } from "@resvg/resvg-js";

export type SocialCardInput = {
  title: string;
  description: string;
  location?: string;
  date?: string;
  kind?: "event" | "venues";
};

export type SocialMetadata = {
  title: string;
  description: string;
  canonicalUrl?: string;
  imageUrl?: string;
  type?: "website" | "event";
  noIndex?: boolean;
  bodyFallback?: { heading: string; paragraphs: string[]; href?: string; linkLabel?: string };
};

export type PublicOrigins = { canonicalOrigin?: string; deploymentOrigin?: string };

function normalizeOrigin(value: string | undefined) {
  const raw = value?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return undefined;
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

export function resolvePublicOrigins(env: NodeJS.ProcessEnv = process.env): PublicOrigins {
  const configured = normalizeOrigin(env.PUBLIC_SITE_URL);
  const deployment = normalizeOrigin(env.VERCEL_URL) ?? configured;
  const canonical = configured ?? normalizeOrigin(env.VERCEL_PROJECT_PRODUCTION_URL);
  return { ...(canonical ? { canonicalOrigin: canonical } : {}), ...(deployment ? { deploymentOrigin: deployment } : {}) };
}

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeXml(value: unknown) {
  return escapeHtml(value);
}

function truncate(value: string, max: number) {
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function titleLines(input: string) {
  const words = truncate(input, 106).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > 33 && current) {
      lines.push(current);
      current = word;
    } else current = candidate;
  }
  if (current) lines.push(current);
  if (lines.length > 2) lines[1] = truncate(`${lines.slice(1).join(" ")}`, 33);
  return lines.slice(0, 2);
}

export function renderSocialCardSvg(input: SocialCardInput) {
  const title = titleLines(input.title || "Eventos na Baixada");
  const description = truncate(input.description, 82);
  const location = truncate(input.location ?? "Santos · Guarujá", 70);
  const date = truncate(input.date ?? "", 48);
  const titleMarkup = title.map((line, index) => `<text x="84" y="${286 + index * 72}" fill="#ffffff" font-family="Arial, sans-serif" font-size="58" font-weight="800">${escapeXml(line)}</text>`).join("");
  const accent = input.kind === "venues" ? "#d946ef" : "#f97316";
  const lowerLine = [date, location].filter(Boolean).join("  ·  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#09090b"/><stop offset="0.58" stop-color="#17111f"/><stop offset="1" stop-color="#34112f"/></linearGradient>
      <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f97316"/><stop offset="0.55" stop-color="#d946ef"/><stop offset="1" stop-color="#facc15"/></linearGradient>
      <radialGradient id="glow"><stop offset="0" stop-color="${accent}" stop-opacity=".42"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    <circle cx="1030" cy="105" r="390" fill="url(#glow)"/>
    <path d="M0 530 C250 460 430 650 720 555 S1040 495 1200 540 V630 H0Z" fill="#09090b" fill-opacity=".42"/>
    <rect x="82" y="74" width="58" height="58" rx="18" fill="#ffffff" fill-opacity=".08"/>
    <path fill="#FF8A3D" transform="translate(88 83) scale(1.4)" d="M3.5 7.25a1.75 1.75 0 0 1 3.36-.69l4.33 10.56 3.2-8.05a1.75 1.75 0 0 1 3.25 0l3.2 8.05 4.33-10.56a1.75 1.75 0 1 1 3.24 1.38l-5.94 14.5a1.75 1.75 0 0 1-3.24.02L16 14.55l-3.23 7.91a1.75 1.75 0 0 1-3.24-.02L3.59 7.94a1.75 1.75 0 0 1-.09-.69Z"/>
    <text x="158" y="111" fill="#ffffff" font-family="Arial, sans-serif" font-size="25" font-weight="800" letter-spacing="3">WEEKENDVIBES</text>
    <rect x="84" y="176" width="160" height="7" rx="4" fill="url(#accent)"/>
    ${titleMarkup}
    <text x="86" y="438" fill="#e4e4e7" font-family="Arial, sans-serif" font-size="25" font-weight="500">${escapeXml(description)}</text>
    <text x="86" y="520" fill="#f4f4f5" font-family="Arial, sans-serif" font-size="22" font-weight="700">${escapeXml(lowerLine || "Descubra seu próximo rolê")}</text>
    <text x="86" y="578" fill="#a1a1aa" font-family="Arial, sans-serif" font-size="17" font-weight="600" letter-spacing="2">SANTOS · GUARUJÁ · BAIXADA SANTISTA</text>
  </svg>`;
}

export function renderSocialCardPng(input: SocialCardInput) {
  const svg = renderSocialCardSvg(input);
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng());
}

export function injectSocialMetadata(html: string, metadata: SocialMetadata) {
  const tagsToReplace = /<(?:title\b[^>]*>[\s\S]*?<\/title\s*>|meta\b[^>]*(?:name|property)\s*=\s*["'](?:description|robots|og:[^"']+|twitter:[^"']+)["'][^>]*>|link\b[^>]*rel\s*=\s*["']canonical["'][^>]*>)/gi;
  const cleaned = html.replace(tagsToReplace, "");
  const tags = [
    `<title>${escapeHtml(metadata.title)}</title>`,
    `<meta name="description" content="${escapeHtml(metadata.description)}">`,
    `<meta property="og:type" content="${metadata.type ?? "website"}">`,
    `<meta property="og:site_name" content="WeekendVibes">`,
    `<meta property="og:title" content="${escapeHtml(metadata.title)}">`,
    `<meta property="og:description" content="${escapeHtml(metadata.description)}">`,
    ...(metadata.canonicalUrl ? [`<link rel="canonical" href="${escapeHtml(metadata.canonicalUrl)}">`, `<meta property="og:url" content="${escapeHtml(metadata.canonicalUrl)}">`] : []),
    ...(metadata.imageUrl ? [`<meta property="og:image" content="${escapeHtml(metadata.imageUrl)}">`, `<meta property="og:image:type" content="image/png">`, `<meta property="og:image:width" content="1200">`, `<meta property="og:image:height" content="630">`] : []),
    `<meta name="twitter:card" content="${metadata.imageUrl ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${escapeHtml(metadata.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(metadata.description)}">`,
    ...(metadata.imageUrl ? [`<meta name="twitter:image" content="${escapeHtml(metadata.imageUrl)}">`] : []),
    ...(metadata.noIndex ? [`<meta name="robots" content="noindex, nofollow">`] : []),
  ].join("\n    ");
  const withHead = cleaned.replace(/<\/head\s*>/i, `    ${tags}\n  </head>`);
  if (!metadata.bodyFallback) return withHead;
  const fallback = `<noscript><main aria-label="${escapeHtml(metadata.bodyFallback.heading)}"><h1>${escapeHtml(metadata.bodyFallback.heading)}</h1>${metadata.bodyFallback.paragraphs.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join("")}${metadata.bodyFallback.href && metadata.bodyFallback.linkLabel ? `<p><a href="${escapeHtml(metadata.bodyFallback.href)}">${escapeHtml(metadata.bodyFallback.linkLabel)}</a></p>` : ""}</main></noscript>`;
  return withHead.replace(/<body\b[^>]*>/i, match => `${match}${fallback}`);
}

export function formatSocialEventDate(value: string | Date) {
  const date = value instanceof Date ? value : /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00-03:00`) : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(date);
}
