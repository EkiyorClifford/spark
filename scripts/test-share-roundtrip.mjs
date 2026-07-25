/**
 * Manual/CI check: create a share with an author, fetch it back, assert name.
 *
 *   node scripts/test-share-roundtrip.mjs
 *   SPARK_URL=http://localhost:3000 node scripts/test-share-roundtrip.mjs
 */

const BASE = (process.env.SPARK_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);

async function main() {
  const author = "Jordizzy";
  const created = await fetch(`${BASE}/api/shares`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idea: "A marketplace for testing share links and author attribution.",
      stack: "nextjs",
      output: [
        "## Problem",
        "Founders need short share URLs.",
        "## Target user",
        "People reviewing Spark demos.",
        "## MVP features",
        "- Share by ID — short links",
        "  Done when: a private window loads the brief by id",
        "## Suggested stack",
        "Next.js",
        "## 2-week build plan",
        "Day 1: ship share store",
        "## Open questions for the founder",
        "- [Stack] Keep Next.js?",
      ].join("\n"),
      author,
      generatedAt: new Date().toISOString(),
    }),
  });

  const createdBody = await created.json();
  if (!created.ok) {
    console.error("CREATE_FAIL", created.status, createdBody);
    process.exit(1);
  }

  console.log("url", createdBody.url, "len", createdBody.url.length);
  if (createdBody.url.length > 120) {
    console.error("URL_TOO_LONG", createdBody.url.length);
    process.exit(1);
  }

  const got = await fetch(`${BASE}/api/shares/${createdBody.id}`);
  const body = await got.json();
  if (!got.ok) {
    console.error("GET_FAIL", got.status, body);
    process.exit(1);
  }

  console.log("stored.author", body.author);
  if (body.author !== author) {
    console.error("AUTHOR_MISMATCH", { expected: author, got: body.author });
    process.exit(1);
  }

  console.log("OK round-trip");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
