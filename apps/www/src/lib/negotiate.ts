interface MediaRange {
  type: string;
  quality: number;
}

function qualityFor(type: string, ranges: MediaRange[]): number {
  for (const match of [type, `${type.split("/")[0]}/*`, "*/*"]) {
    const matches = ranges.filter((range) => range.type === match);
    if (matches.length) return Math.max(...matches.map((range) => range.quality));
  }
  return 0;
}

export function preferredContentType(
  accept: string | null,
  supported: readonly string[],
): string | null {
  const ranges = (accept || "*/*").split(",").map((part) => {
    const [media = "", ...parameters] = part.trim().toLowerCase().split(";");
    const qualityParameter = parameters
      .map((value) => value.trim())
      .find((value) => value.startsWith("q="));
    const qualityText = qualityParameter?.slice(2) ?? "1";
    const quality = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(qualityText)
      ? Number(qualityText)
      : 0;
    return { type: media.trim(), quality };
  });
  let selected: string | null = null;
  let bestQuality = 0;
  for (const type of supported) {
    const quality = qualityFor(type, ranges);
    if (
      quality > bestQuality ||
      (quality > 0 &&
        quality === bestQuality &&
        ranges.some((range) => range.type === type && range.quality > 0))
    ) {
      selected = type;
      bestQuality = quality;
    }
  }
  return selected;
}

export function negotiate(accept: string | null): "html" | "markdown" | null {
  const type = preferredContentType(accept, ["text/html", "text/markdown"]);
  if (type === "text/html") return "html";
  if (type === "text/markdown") return "markdown";
  return null;
}
