const RESPONSIVE_WIDTHS = [480, 768, 1200] as const;

function withWidth(url: string, width: number) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("w", String(width));
    parsed.searchParams.set("q", "82");
    return parsed.toString();
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}w=${width}&q=82`;
  }
}

export function responsiveImageProps(url: string | null | undefined, sizes: string) {
  if (!url) return { src: "", srcSet: undefined, sizes };
  return {
    src: url,
    srcSet: RESPONSIVE_WIDTHS.map(width => `${withWidth(url, width)} ${width}w`).join(", "),
    sizes,
  };
}

export const EVENT_CARD_IMAGE_SIZES = "(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 420px";
export const EVENT_DETAIL_IMAGE_SIZES = "(max-width: 639px) 100vw, 1024px";
export const EVENT_SHARE_IMAGE_SIZES = "(max-width: 639px) 100vw, 320px";
export const AGENDA_HIGHLIGHT_IMAGE_SIZES = "(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 400px";

type ResponsiveImageProps = ReturnType<typeof responsiveImageProps>;
export function responsiveImageAttributes(url: string | null | undefined, sizes: string): ResponsiveImageProps {
  return responsiveImageProps(url, sizes);
}
