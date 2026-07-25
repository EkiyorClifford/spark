export type SharePayload = {
  v: 1;
  idea: string;
  stack: "nextjs" | "none" | "mobile";
  output: string;
  answers?: Array<{ question: string; answer: string }>;
  author?: string;
  generatedAt?: string;
};

/** @deprecated Legacy hash payload — kept only to open old links. */
export function decodeShare(encoded: string): SharePayload | null {
  try {
    const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const pad =
      padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    const bin = atob(padded + pad);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const data = JSON.parse(json) as SharePayload;
    if (
      data?.v !== 1 ||
      typeof data.idea !== "string" ||
      typeof data.output !== "string"
    ) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function formatShareAttribution(payload: {
  author?: string | null;
  generatedAt?: string;
}): string {
  const dateLabel = payload.generatedAt
    ? new Date(payload.generatedAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;
  const author = payload.author?.trim();

  if (author && dateLabel) return `Generated via Spark — ${author} · ${dateLabel}`;
  if (author) return `Generated via Spark — ${author}`;
  if (dateLabel) return `Generated via Spark · ${dateLabel}`;
  return "Generated via Spark";
}

export function buildSharePageUrl(id: string, origin?: string): string {
  const base =
    origin ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/s/${id}`;
}
