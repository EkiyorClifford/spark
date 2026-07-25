import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type StoredShare = {
  id: string;
  idea: string;
  stack: "nextjs" | "none" | "mobile";
  output: string;
  answers?: Array<{ question: string; answer: string }>;
  author?: string;
  generatedAt: string;
  createdAt: string;
};

function newId(): string {
  return randomBytes(6).toString("base64url"); // ~8 chars
}

function localDir(): string {
  return path.join(process.cwd(), ".data", "shares");
}

async function putLocal(record: StoredShare): Promise<void> {
  const dir = localDir();
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, `${record.id}.json`),
    JSON.stringify(record),
    "utf8",
  );
}

async function getLocal(id: string): Promise<StoredShare | null> {
  try {
    const raw = await readFile(path.join(localDir(), `${id}.json`), "utf8");
    return JSON.parse(raw) as StoredShare;
  } catch {
    return null;
  }
}

/** Upstash / Vercel KV REST */
async function putKv(record: StoredShare): Promise<boolean> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;

  const res = await fetch(`${url}/set/spark:share:${record.id}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    // Upstash REST expects the value JSON-encoded as the body
    body: JSON.stringify(JSON.stringify(record)),
  });
  return res.ok;
}

async function getKv(id: string): Promise<StoredShare | null> {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const res = await fetch(`${url}/get/spark:share:${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { result?: string | StoredShare | null };
  if (!data.result) return null;
  if (typeof data.result === "string") {
    try {
      return JSON.parse(data.result) as StoredShare;
    } catch {
      return null;
    }
  }
  return data.result;
}

/** Persist share JSON on a dedicated GitHub branch (works on Vercel with GITHUB_TOKEN). */
async function putGitHub(record: StoredShare): Promise<boolean> {
  const token = process.env.GITHUB_TOKEN || process.env.SHARE_GITHUB_TOKEN;
  const repo = process.env.GITHUB_SHARE_REPO || "EkiyorClifford/spark";
  const branch = process.env.GITHUB_SHARE_BRANCH || "shares-data";
  if (!token) return false;

  const filePath = `shares/${record.id}.json`;
  const content = Buffer.from(JSON.stringify(record, null, 2)).toString(
    "base64",
  );

  // Ensure branch exists (ignore errors if it already does)
  await ensureShareBranch(token, repo, branch);

  let sha: string | undefined;
  const existing = await fetch(
    `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    },
  );
  if (existing.ok) {
    const body = (await existing.json()) as { sha?: string };
    sha = body.sha;
  }

  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/${filePath}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `share: ${record.id}`,
        content,
        branch,
        ...(sha ? { sha } : {}),
      }),
    },
  );
  return res.ok;
}

async function getGitHub(id: string): Promise<StoredShare | null> {
  const token = process.env.GITHUB_TOKEN || process.env.SHARE_GITHUB_TOKEN;
  const repo = process.env.GITHUB_SHARE_REPO || "EkiyorClifford/spark";
  const branch = process.env.GITHUB_SHARE_BRANCH || "shares-data";
  if (!token) return null;

  const res = await fetch(
    `https://api.github.com/repos/${repo}/contents/shares/${id}.json?ref=${branch}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    },
  );
  if (!res.ok) return null;
  const body = (await res.json()) as { content?: string; encoding?: string };
  if (!body.content) return null;
  const json = Buffer.from(body.content, "base64").toString("utf8");
  return JSON.parse(json) as StoredShare;
}

async function ensureShareBranch(
  token: string,
  repo: string,
  branch: string,
): Promise<void> {
  const refRes = await fetch(
    `https://api.github.com/repos/${repo}/git/ref/heads/${branch}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    },
  );
  if (refRes.ok) return;

  const mainRes = await fetch(
    `https://api.github.com/repos/${repo}/git/ref/heads/main`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
      cache: "no-store",
    },
  );
  if (!mainRes.ok) return;
  const main = (await mainRes.json()) as { object?: { sha?: string } };
  const sha = main.object?.sha;
  if (!sha) return;

  await fetch(`https://api.github.com/repos/${repo}/git/refs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
  });
}

export async function createShare(
  input: Omit<StoredShare, "id" | "createdAt">,
): Promise<StoredShare> {
  const record: StoredShare = {
    ...input,
    id: newId(),
    createdAt: new Date().toISOString(),
    author: input.author?.trim() || undefined,
  };

  const kvOk = await putKv(record);
  if (!kvOk) {
    const ghOk = await putGitHub(record);
    if (!ghOk) {
      await putLocal(record);
    }
  }

  return record;
}

export async function getShare(id: string): Promise<StoredShare | null> {
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(id)) return null;

  const fromKv = await getKv(id);
  if (fromKv) return fromKv;

  const fromGh = await getGitHub(id);
  if (fromGh) return fromGh;

  return getLocal(id);
}
