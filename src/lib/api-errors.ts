export type RateLimitError = {
  kind: "rate_limited";
  retryAfterSeconds: number;
};

export type ApiClientError =
  | RateLimitError
  | { kind: "generic"; message: string };

export async function readGenerateError(
  res: Response,
): Promise<ApiClientError> {
  const data = (await res.json().catch(() => null)) as {
    error?: string;
    retryAfterSeconds?: number;
  } | null;

  if (
    res.status === 429 ||
    data?.error === "rate_limited"
  ) {
    const retryAfterSeconds =
      typeof data?.retryAfterSeconds === "number" && data.retryAfterSeconds > 0
        ? data.retryAfterSeconds
        : Number(res.headers.get("Retry-After")) || 60;
    return { kind: "rate_limited", retryAfterSeconds };
  }

  return {
    kind: "generic",
    message: data?.error || `Request failed (${res.status})`,
  };
}

/** Round seconds up to whole minutes (min 1 when seconds > 0). */
export function minutesCeil(retryAfterSeconds: number): number {
  if (retryAfterSeconds <= 0) return 1;
  return Math.max(1, Math.ceil(retryAfterSeconds / 60));
}
