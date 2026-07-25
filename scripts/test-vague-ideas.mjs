/**
 * Hit /api/generate with deliberately vague ideas and save raw briefs.
 *
 * Usage:
 *   node scripts/test-vague-ideas.mjs
 *   SPARK_URL=https://spark-mvp-orcin.vercel.app node scripts/test-vague-ideas.mjs
 *
 * Does not change prompts — review outputs in /test-outputs/
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(ROOT, "test-outputs");
const BASE = (process.env.SPARK_URL || "https://spark-mvp-orcin.vercel.app").replace(
  /\/$/,
  "",
);

const IDEAS = [
  "an app for dog owners",
  "a marketplace thing",
  "AI for small business",
  "something like Airbnb but different",
  "a tool that helps people be more productive",
];

function slugify(idea) {
  return idea
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function generateBrief(idea) {
  const res = await fetch(`${BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idea, stack: "none", mode: "generate" }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} for "${idea}": ${errBody.slice(0, 400)}`);
  }

  return res.text();
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Endpoint: ${BASE}/api/generate`);
  console.log(`Output:   ${OUT_DIR}\n`);

  for (const idea of IDEAS) {
    const file = path.join(OUT_DIR, `${slugify(idea)}.md`);
    process.stdout.write(`→ ${idea} ... `);
    try {
      const brief = await generateBrief(idea);
      const doc = [
        `<!-- idea: ${idea} -->`,
        `<!-- generated: ${new Date().toISOString()} -->`,
        `<!-- endpoint: ${BASE}/api/generate -->`,
        "",
        brief.trim(),
        "",
      ].join("\n");
      await writeFile(file, doc, "utf8");
      console.log(`ok (${brief.length} chars) → ${path.basename(file)}`);
    } catch (err) {
      console.log("FAIL");
      console.error(`  ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log("\nDone. Review files in test-outputs/");
}

main();
