"use client";

import { useEffect, useState } from "react";
import BriefSections from "@/components/BriefSections";
import SparkLogo from "@/components/SparkLogo";
import { formatShareAttribution } from "@/lib/share";
import type { BriefMode } from "@/lib/sections";

type ShareData = {
  id: string;
  idea: string;
  stack: "nextjs" | "none" | "mobile";
  output: string;
  author: string | null;
  generatedAt: string;
};

export default function SharedBriefClient({ id }: { id: string }) {
  const [data, setData] = useState<ShareData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/shares/${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(
            res.status === 404 ? "This share link was not found." : "Failed to load share.",
          );
        }
        const json = (await res.json()) as ShareData;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load share.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const mode: BriefMode = data?.output.includes("## Decisions locked in")
    ? "refine"
    : "generate";

  const attribution = data
    ? formatShareAttribution({
        author: data.author ?? undefined,
        generatedAt: data.generatedAt,
      })
    : "";

  return (
    <div className="spark-shell">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10 md:py-14">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-6">
          <SparkLogo />
          <a
            href="/"
            className="font-mono text-xs text-[var(--accent)] hover:text-[var(--accent-soft)]"
          >
            Create your own →
          </a>
        </header>

        {loading ? (
          <p className="font-mono text-sm text-[#6b8579]">Loading shared brief…</p>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}

        {data ? (
          <>
            <p className="font-mono text-[11px] text-[#6b8579]">{attribution}</p>
            <p className="text-sm text-[var(--muted)]">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
                Idea
              </span>
              <span className="mt-1 block text-[var(--ink)]">{data.idea}</span>
            </p>
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]/85 p-5 md:p-6">
              <BriefSections mode={mode} markdown={data.output} loading={false} />
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
