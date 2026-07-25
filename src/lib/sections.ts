export type BriefMode = "generate" | "refine";

export type SectionDef = {
  id: string;
  /** Label shown in the UI shell */
  label: string;
  /** Match streamed ## heading text (case-insensitive, prefix ok) */
  match: RegExp;
};

/** Initial generate — six section shells shown immediately. */
export const GENERATE_SECTIONS: SectionDef[] = [
  { id: "problem", label: "Problem", match: /^problem$/i },
  { id: "target-user", label: "Target user", match: /^target user$/i },
  { id: "mvp-features", label: "MVP features", match: /^mvp features$/i },
  { id: "suggested-stack", label: "Suggested stack", match: /^suggested stack$/i },
  {
    id: "build-plan",
    label: "2-week build plan",
    match: /^2-week build plan$/i,
  },
  {
    id: "open-questions",
    label: "Open questions",
    match: /^open questions/i,
  },
];

/** Round-2 refine shells. */
export const REFINE_SECTIONS: SectionDef[] = [
  { id: "problem", label: "Problem", match: /^problem$/i },
  { id: "target-user", label: "Target user", match: /^target user$/i },
  { id: "mvp-features", label: "MVP features", match: /^mvp features$/i },
  { id: "suggested-stack", label: "Suggested stack", match: /^suggested stack$/i },
  {
    id: "build-plan",
    label: "2-week build plan",
    match: /^2-week build plan$/i,
  },
  {
    id: "decisions",
    label: "Decisions locked in",
    match: /^decisions locked in$/i,
  },
  {
    id: "remaining",
    label: "Remaining open questions",
    match: /^remaining open questions$/i,
  },
];

export function sectionsForMode(mode: BriefMode): SectionDef[] {
  return mode === "refine" ? REFINE_SECTIONS : GENERATE_SECTIONS;
}

/**
 * Split accumulating Markdown into bodies keyed by section id.
 * Headers themselves are ignored — UI owns those shells.
 */
export function parseSectionBodies(
  markdown: string,
  sections: SectionDef[],
): Record<string, string> {
  const bodies: Record<string, string> = {};
  for (const s of sections) bodies[s.id] = "";

  if (!markdown.trim()) return bodies;

  const headingRe = /^##\s+(.+)$/gm;
  const hits: Array<{ index: number; title: string; start: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(markdown)) !== null) {
    hits.push({
      index: m.index,
      title: m[1].trim(),
      start: m.index + m[0].length,
    });
  }

  for (let i = 0; i < hits.length; i += 1) {
    const hit = hits[i];
    const end = i + 1 < hits.length ? hits[i + 1].index : markdown.length;
    const body = markdown.slice(hit.start, end).replace(/^\n+/, "").trimEnd();
    const def = sections.find((s) => s.match.test(hit.title));
    if (def) bodies[def.id] = body.trim();
  }

  return bodies;
}
