interface MediaRange {
  type: string;
  quality: number;
}

function qualityFor(type: string, ranges: MediaRange[]): number {
  for (const match of [type, "text/*", "*/*"]) {
    const matches = ranges.filter((range) => range.type === match);
    if (matches.length) return Math.max(...matches.map((range) => range.quality));
  }
  return 0;
}

export function negotiate(accept: string | null): "html" | "markdown" | null {
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
  const html = qualityFor("text/html", ranges);
  const markdown = qualityFor("text/markdown", ranges);
  if (!html && !markdown) return null;
  return markdown > html ||
    (markdown === html &&
      ranges.some((range) => range.type === "text/markdown" && range.quality > 0))
    ? "markdown"
    : "html";
}
