"use client";

import { useEffect, useMemo, useState } from "react";
import {
  clearHistory,
  loadHistory,
  saveHistoryItem,
  type HistoryItem,
} from "@/lib/history";
import type { StackPreference } from "@/lib/prompt";
import { extractOpenQuestions } from "@/lib/questions";
import {
  buildShareUrl,
  decodeShare,
  formatShareAttribution,
} from "@/lib/share";
import SparkLogo from "@/components/SparkLogo";
import BriefSections from "@/components/BriefSections";
import ExampleChip, { type ExampleIdea } from "@/components/ExampleChip";
import { minutesCeil, readGenerateError } from "@/lib/api-errors";
import { splitRefineOutput } from "@/lib/changes";
import type { BriefMode } from "@/lib/sections";

const EXAMPLES: ExampleIdea[] = [
  {
    label: "Marketplace",
    idea: "A marketplace that connects landlords directly with tenants in Lagos — listings, approvals, inspections, and rent reminders without agency middlemen.",
    preview:
      "Two-sided supply/demand match, trust/payment flow, and a narrow starting niche instead of 'everything marketplace.'",
  },
  {
    label: "Booking app",
    idea: "A spa and nail booking platform where customers book paid appointments online and the admin manages availability, walk-ins, services, and daily revenue.",
    preview:
      "Live availability, paid appointments, and an ops dashboard for staff — not just a pretty calendar.",
  },
  {
    label: "SaaS tool",
    idea: "A lightweight SaaS for freelancers to send proposals, collect deposits, track project milestones, and auto-generate simple invoices.",
    preview:
      "One clear job-to-be-done, a paid core loop, and a thin first workflow instead of a full suite.",
  },
  {
    label: "Local ops",
    idea: "A real-time outage reporting app where users pin electricity blackouts on a map and neighborhoods see live disruption heatmaps.",
    preview:
      "Geo reports, a live map layer, and a neighborhood signal — scoped for one operational truth.",
  },
];

export default function SparkApp() {
  const [idea, setIdea] = useState("");
  const [stack, setStack] = useState<StackPreference>("none");
  const [output, setOutput] = useState("");
  const [briefMode, setBriefMode] = useState<BriefMode>("generate");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [shareNote, setShareNote] = useState("");
  /** UI-only guidance: shown once after the first generate in a session. */
  const [showScopingNote, setShowScopingNote] = useState(false);
  const [scopingNoteUsed, setScopingNoteUsed] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [shareAuthor, setShareAuthor] = useState("");
  const [shareNamePromptOpen, setShareNamePromptOpen] = useState(false);
  const [viewAttribution, setViewAttribution] = useState<string | null>(null);
  /** UI-only refine delta — never included in copy/download/share. */
  const [changeSummary, setChangeSummary] = useState<string[]>([]);
  const [rateLimitMsg, setRateLimitMsg] = useState("");
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownLeftSec, setCooldownLeftSec] = useState(0);

  const questions = useMemo(
    () => (output && !loading ? extractOpenQuestions(output) : []),
    [output, loading],
  );

  const inCooldown = cooldownUntil !== null && Date.now() < cooldownUntil;

  useEffect(() => {
    if (!cooldownUntil) {
      setCooldownLeftSec(0);
      return;
    }
    function tick() {
      const left = Math.max(0, Math.ceil((cooldownUntil! - Date.now()) / 1000));
      setCooldownLeftSec(left);
      if (left <= 0) {
        setCooldownUntil(null);
        setRateLimitMsg("");
      }
    }
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  function applyRateLimit(retryAfterSeconds: number) {
    const minutes = minutesCeil(retryAfterSeconds);
    setRateLimitMsg(
      `You've hit the free limit for now — try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    );
    setCooldownUntil(Date.now() + retryAfterSeconds * 1000);
    setError("");
  }

  useEffect(() => {
    setHistory(loadHistory());

    const hash = window.location.hash;
    if (!hash.startsWith("#s=")) return;
    const payload = decodeShare(hash.slice(3));
    if (!payload) return;
    setIdea(payload.idea);
    setStack(payload.stack || "none");
    setOutput(payload.output);
    setGeneratedAt(payload.generatedAt || null);
    if (payload.author) setShareAuthor(payload.author);
    setViewAttribution(formatShareAttribution(payload));
    if (payload.answers?.length) {
      const map: Record<number, string> = {};
      payload.answers.forEach((a, i) => {
        map[i] = a.answer;
      });
      setAnswers(map);
    }
    setStatus("Loaded shared brief");
  }, []);

  async function generate() {
    if (inCooldown) return;
    setError("");
    setRateLimitMsg("");
    setStatus("");
    setShareNote("");
    setOutput("");
    setAnswers({});
    setShareNamePromptOpen(false);
    setViewAttribution(null);
    setChangeSummary([]);
    setBriefMode("generate");
    setLoading(true);

    try {
      let text = "";
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, stack, mode: "generate" }),
      });
      if (!res.ok) {
        const err = await readGenerateError(res);
        if (err.kind === "rate_limited") {
          applyRateLimit(err.retryAfterSeconds);
          return;
        }
        throw new Error(err.message);
      }
      if (!res.body) throw new Error("No response stream.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setOutput(text);
      }

      const stamped = new Date().toISOString();
      setGeneratedAt(stamped);
      setHistory(saveHistoryItem({ idea, stack, output: text }));
      setStatus("Brief ready — answer the founder questions below to refine");
      if (!scopingNoteUsed) {
        setShowScopingNote(true);
        setScopingNoteUsed(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function refine() {
    const qa = questions
      .map((question, i) => ({
        question: question.raw,
        answer: (answers[i] || "").trim(),
      }))
      .filter((a) => a.answer);

    if (!qa.length) {
      setError("Answer at least one question before refining.");
      return;
    }
    if (inCooldown) return;

    setError("");
    setRateLimitMsg("");
    setStatus("");
    setShareNote("");
    setShowScopingNote(false);
    const previousBrief = output;
    setBriefMode("refine");
    setOutput("");
    setChangeSummary([]);
    setLoading(true);

    try {
      let text = "";
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea,
          stack,
          mode: "refine",
          previousBrief,
          answers: qa,
        }),
      });
      if (!res.ok) {
        const err = await readGenerateError(res);
        if (err.kind === "rate_limited") {
          applyRateLimit(err.retryAfterSeconds);
          return;
        }
        throw new Error(err.message);
      }
      if (!res.body) throw new Error("No response stream.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        const { changes, brief } = splitRefineOutput(text);
        setChangeSummary(changes);
        setOutput(brief);
      }

      const finalSplit = splitRefineOutput(text);
      setChangeSummary(finalSplit.changes);
      setOutput(finalSplit.brief);
      setGeneratedAt(new Date().toISOString());
      setHistory(
        saveHistoryItem({ idea, stack, output: finalSplit.brief }),
      );
      setStatus("Refined brief ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function copyBrief() {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setStatus("Brief copied");
  }

  function downloadBrief() {
    if (!output) return;
    const blob = new Blob([output], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spark-mvp-brief.md";
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Markdown downloaded");
  }

  async function copyShareLink() {
    if (!output) return;

    // First click: reveal optional name field; second click copies the link.
    if (!shareNamePromptOpen) {
      setShareNamePromptOpen(true);
      setStatus("Optional: add a name for the shared link, then copy again");
      return;
    }

    const qa = questions.map((question, i) => ({
      question: question.raw,
      answer: (answers[i] || "").trim(),
    }));
    const author = shareAuthor.trim();
    const stamped = generatedAt || new Date().toISOString();
    const url = buildShareUrl({
      v: 1,
      idea,
      stack,
      output,
      answers: qa.filter((a) => a.answer),
      author: author || undefined,
      generatedAt: stamped,
    });
    if (url.length > 12000) {
      setShareNote(
        "Share link is very long — copy may fail in some apps. Prefer Download Markdown.",
      );
    } else {
      setShareNote("");
    }
    await navigator.clipboard.writeText(url);
    window.history.replaceState(null, "", url);
    setStatus("Share link copied");
  }

  function restoreHistory(item: HistoryItem) {
    setIdea(item.idea);
    setStack(item.stack);
    setOutput(item.output);
    setAnswers({});
    setGeneratedAt(null);
    setShareNamePromptOpen(false);
    setViewAttribution(null);
    setChangeSummary([]);
    setBriefMode("generate");
    setError("");
    setStatus("Restored from history");
  }

  return (
    <div className="spark-shell">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10 md:py-14">
        <header className="animate-rise flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-6">
          <SparkLogo />
          <p className="max-w-[14rem] text-right font-mono text-[11px] leading-relaxed text-[var(--muted)]">
            Product co-pilot for founders who need a buildable MVP, not another brainstorm.
          </p>
        </header>

        <section className="animate-rise-delay space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-[var(--ink)] md:text-[2.75rem] md:leading-[1.1]">
            Turn a rough idea into a plan you can ship.
          </h1>
          <p className="max-w-xl text-[var(--muted)]">
            Generate a structured brief, answer the hard questions, refine the cut.
          </p>
        </section>

        <section className="animate-rise-delay-2 space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)]/80 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-sm md:p-6">
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <ExampleChip
                key={ex.label}
                example={ex}
                disabled={loading || inCooldown}
                onSelect={setIdea}
              />
            ))}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="idea"
              className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent)]"
            >
              Your idea
            </label>
            <textarea
              id="idea"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              rows={7}
              placeholder={EXAMPLES[0].idea}
              className="w-full resize-y rounded-xl border border-[var(--line)] bg-[#07130f] px-4 py-3 text-sm text-[var(--ink)] outline-none ring-[var(--accent-muted)]/40 placeholder:text-[#5f766c] focus:ring-2"
            />
          </div>

          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent)]">
              Stack preference
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["none", "No preference"],
                  ["nextjs", "Prefer Next.js"],
                  ["mobile", "Mobile-first"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  disabled={loading}
                  onClick={() => setStack(value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition disabled:opacity-40 ${
                    stack === value
                      ? "border-[var(--accent-muted)] bg-[rgba(6,78,59,0.45)] text-[var(--accent)]"
                      : "border-[var(--line)] text-[var(--muted)] hover:border-[#2d5246] hover:text-[var(--ink)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={generate}
              disabled={loading || inCooldown || idea.trim().length < 8}
              className="cta-live rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#042f1e] transition hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {loading
                ? "Working…"
                : inCooldown
                  ? `Try again in ${Math.max(1, Math.ceil(cooldownLeftSec / 60))}m`
                  : "Generate MVP brief"}
            </button>
            <span className="font-mono text-xs text-[#6b8579]">
              {idea.trim().length}/4000
            </span>
          </div>
          {rateLimitMsg ? (
            <p className="text-sm text-amber-300/90">
              {rateLimitMsg}
              {inCooldown && cooldownLeftSec > 0 ? (
                <span className="ml-2 font-mono text-xs text-[#6b8579]">
                  ({Math.floor(cooldownLeftSec / 60)}:
                  {String(cooldownLeftSec % 60).padStart(2, "0")} left)
                </span>
              ) : null}
            </p>
          ) : null}
        </section>

        {history.length > 0 ? (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#6b8579]">
                Recent (this browser)
              </p>
              <button
                type="button"
                onClick={() => {
                  clearHistory();
                  setHistory([]);
                }}
                className="font-mono text-xs text-[#6b8579] hover:text-[var(--ink)]"
              >
                Clear
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {history.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={loading}
                  onClick={() => restoreHistory(item)}
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface)]/70 px-3 py-2.5 text-left text-xs text-[var(--muted)] transition hover:border-[var(--accent-muted)] hover:text-[var(--ink)] disabled:opacity-40"
                >
                  <span className="text-[#6b8579]">
                    {new Date(item.createdAt).toLocaleString()} · {item.stack}
                  </span>
                  <span className="mt-1 block line-clamp-2 text-[var(--ink)]/90">
                    {item.idea}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}

        {status ? (
          <p className="font-mono text-xs text-[var(--accent)]">{status}</p>
        ) : null}

        {(loading || output) && (
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]/85 p-5 md:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#6b8579]">
                Brief
              </p>
              <div className="flex flex-wrap gap-2">
                {loading ? (
                  <span className="font-mono text-xs text-[var(--accent)]">
                    streaming…
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={copyBrief}
                      className="rounded-lg border border-[var(--line)] px-2.5 py-1 font-mono text-xs text-[var(--muted)] hover:text-[var(--ink)]"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={downloadBrief}
                      className="rounded-lg border border-[var(--line)] px-2.5 py-1 font-mono text-xs text-[var(--muted)] hover:text-[var(--ink)]"
                    >
                      Download .md
                    </button>
                    <button
                      type="button"
                      onClick={copyShareLink}
                      className="rounded-lg border border-[var(--line)] px-2.5 py-1 font-mono text-xs text-[var(--muted)] hover:text-[var(--ink)]"
                    >
                      {shareNamePromptOpen
                        ? "Copy share link now"
                        : "Copy share link"}
                    </button>
                  </>
                )}
              </div>
            </div>
            {viewAttribution ? (
              <p className="mb-3 font-mono text-[11px] text-[#6b8579]">
                {viewAttribution}
              </p>
            ) : null}
            {shareNamePromptOpen && !loading ? (
              <div className="mb-3">
                <label
                  htmlFor="share-author"
                  className="mb-1.5 block font-mono text-[11px] text-[#6b8579]"
                >
                  Your name or company, for the shared link — optional
                </label>
                <input
                  id="share-author"
                  type="text"
                  value={shareAuthor}
                  onChange={(e) => setShareAuthor(e.target.value)}
                  placeholder="e.g. Ekiyor / Acme Labs"
                  maxLength={60}
                  className="w-full max-w-md rounded-lg border border-[var(--line)] bg-[#07130f] px-3 py-2 text-sm text-[var(--ink)] outline-none ring-[var(--accent-muted)]/40 placeholder:text-[#5f766c] focus:ring-2"
                />
              </div>
            ) : null}
            {showScopingNote && !loading ? (
              <p className="mb-4 max-w-2xl text-[11px] leading-relaxed text-[#6b8579]">
                This is a scoping document, not a technical spec. Hand it to a
                developer, or paste it into your coding AI (Cursor, Claude, GPT)
                as context before you start building.
              </p>
            ) : null}
            {shareNote ? (
              <p className="mb-3 font-mono text-xs text-amber-400">{shareNote}</p>
            ) : null}
            {(briefMode === "refine" &&
              (changeSummary.length > 0 || loading)) && (
              <div className="mb-5 rounded-xl border border-[var(--line)] bg-[rgba(6,78,59,0.22)] px-4 py-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
                  What changed
                </p>
                {changeSummary.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs text-[var(--muted)]">
                    {changeSummary.map((item) => (
                      <li key={item}>· {item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 font-mono text-[11px] text-[#5f766c]">
                    summarizing updates…
                  </p>
                )}
              </div>
            )}
            <BriefSections
              mode={briefMode}
              markdown={output}
              loading={loading}
            />
          </section>
        )}

        {!loading && questions.length > 0 ? (
          <section className="space-y-4 rounded-2xl border border-[var(--accent-muted)]/50 bg-[rgba(6,78,59,0.18)] p-5 md:p-6">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
                Round 2 · engage
              </p>
              <h2 className="font-display mt-2 text-xl font-semibold text-[var(--ink)]">
                Answer the founder questions
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                This is where Spark becomes a conversation — your answers rewrite the MVP cut.
              </p>
            </div>
            <div className="space-y-4">
              {questions.map((q, i) => (
                <div
                  key={`${i}-${q.text.slice(0, 24)}`}
                  className="space-y-2 rounded-xl border border-[var(--line)]/80 bg-[#07130f]/50 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {q.tag ? (
                      <span className="rounded-md border border-[var(--accent-muted)]/60 bg-[rgba(6,78,59,0.35)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[var(--accent)]">
                        {q.tag}
                      </span>
                    ) : null}
                    <label
                      htmlFor={`q-${i}`}
                      className="text-sm text-[var(--ink)]"
                    >
                      {q.text}
                    </label>
                  </div>
                  <textarea
                    id={`q-${i}`}
                    rows={2}
                    value={answers[i] || ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [i]: e.target.value }))
                    }
                    placeholder="Your answer…"
                    className="w-full resize-y rounded-xl border border-[var(--line)] bg-[#07130f] px-3 py-2 text-sm text-[var(--ink)] outline-none ring-[var(--accent-muted)]/40 placeholder:text-[#5f766c] focus:ring-2"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={refine}
              disabled={loading || inCooldown}
              className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[#042f1e] transition hover:bg-[var(--accent-soft)] disabled:opacity-40"
            >
              Refine brief with my answers
            </button>
          </section>
        ) : null}

        <footer className="mt-auto border-t border-[var(--line)] pt-6 font-mono text-xs text-[#6b8579]">
          Built by{" "}
          <a
            href="https://ekiyorclifford.netlify.app/"
            className="text-[var(--accent)] hover:text-[var(--accent-soft)]"
            target="_blank"
            rel="noreferrer"
          >
            Ekiyor Clifford
          </a>{" "}
          · Next.js + Groq
        </footer>
      </div>
    </div>
  );
}
