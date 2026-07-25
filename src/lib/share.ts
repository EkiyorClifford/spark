export type SharePayload = {
  v: 1;
  idea: string;
  stack: "nextjs" | "none" | "mobile";
  output: string;
  answers?: Array<{ question: string; answer: string }>;
  /** Optional display name for shared attribution */
  author?: string;
  /** ISO timestamp when the brief was generated/refined */
  generatedAt?: string;
};

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const bin = atob(padded + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeShare(payload: SharePayload): string {
  const json = JSON.stringify(payload);
  return toBase64Url(new TextEncoder().encode(json));
}

export function decodeShare(encoded: string): SharePayload | null {
  try {
    const json = new TextDecoder().decode(fromBase64Url(encoded));
    const data = JSON.parse(json) as SharePayload;
    if (data?.v !== 1 || typeof data.idea !== "string" || typeof data.output !== "string") {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function buildShareUrl(payload: SharePayload): string {
  const hash = encodeShare(payload);
  const base =
    typeof window !== "undefined"
      ? window.location.origin + window.location.pathname
      : "";
  return `${base}#s=${hash}`;
}

export function formatShareAttribution(payload: {
  author?: string;
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
