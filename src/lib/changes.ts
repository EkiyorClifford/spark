/**
 * Split a refine-stream Markdown blob into UI-only Changes bullets
 * and the exportable brief body (Changes removed).
 */
export function splitRefineOutput(markdown: string): {
  changes: string[];
  brief: string;
} {
  if (!markdown.trim()) return { changes: [], brief: "" };

  const changesHeading = /^##\s*Changes\s*$/im;
  const match = markdown.match(changesHeading);
  if (!match || match.index === undefined) {
    return { changes: [], brief: markdown };
  }

  const afterHeading = markdown.slice(match.index + match[0].length);
  const nextHeading = afterHeading.search(/\n##\s+/);
  const changesBlock =
    nextHeading === -1 ? afterHeading : afterHeading.slice(0, nextHeading);
  const rest =
    nextHeading === -1
      ? ""
      : afterHeading.slice(nextHeading).replace(/^\n+/, "");

  const before = markdown.slice(0, match.index).trim();
  const brief = [before, rest].filter(Boolean).join("\n\n").trim();

  const changes = [...changesBlock.matchAll(/^\s*[-*]\s+(.+)$/gm)]
    .map((m) => m[1].replace(/\*\*/g, "").trim())
    .filter(Boolean)
    .slice(0, 6);

  return { changes, brief };
}
