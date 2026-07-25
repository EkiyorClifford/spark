export type FounderQuestion = {
  /** Section tag without brackets, e.g. "Stack" */
  tag: string | null;
  /** Question text without the [Tag] prefix */
  text: string;
  /** Original bullet text (for refine API context) */
  raw: string;
};

const QUESTION_SECTION =
  /##\s*(?:Open questions for the founder|Remaining open questions)\s*\n([\s\S]*?)(?=\n##\s|$)/i;

const TAG_RE = /^\[([^\]]+)\]\s*(.+)$/;

function parseBullet(raw: string): FounderQuestion {
  const cleaned = raw.replace(/\*\*/g, "").trim();
  const tagged = cleaned.match(TAG_RE);
  if (tagged) {
    return {
      tag: tagged[1].trim(),
      text: tagged[2].trim(),
      raw: cleaned,
    };
  }
  return { tag: null, text: cleaned, raw: cleaned };
}

/** Pull tagged questions from open / remaining-questions sections. */
export function extractOpenQuestions(markdown: string): FounderQuestion[] {
  const match = markdown.match(QUESTION_SECTION);
  if (!match) return [];

  const block = match[1];
  const bullets = [...block.matchAll(/^\s*[-*]\s+(.+)$/gm)].map((m) =>
    parseBullet(m[1]),
  );

  const list = bullets.length
    ? bullets
    : [...block.matchAll(/^\s*\d+[.)]\s+(.+)$/gm)].map((m) =>
        parseBullet(m[1]),
      );

  // Skip the "none ready" sentinel from refine
  return list
    .filter((q) => !/^none\b/i.test(q.text))
    .slice(0, 6);
}
