# Spark — Idea → MVP Spec Assistant

Live demo of **LLM API integration** in a real Next.js product: paste a product idea, get a streamed MVP brief (problem, users, features, stack, 2-week plan, open questions).

Built by [Ekiyor Clifford](https://ekiyorclifford.netlify.app/).

## Architecture

```text
Browser (SparkApp)
    │  POST /api/generate { idea }
    ▼
Next.js Route Handler
    │  rate limit (IP, in-memory)
    │  validate idea length
    ▼
Groq Chat Completions (stream: true, OpenAI-compatible)
    │  SSE chunks → plain text tokens
    ▼
Browser streams Markdown into the brief panel
```

- **Frontend:** Next.js App Router + React client component
- **Backend:** Node route handler (`src/app/api/generate/route.ts`)
- **AI:** Groq streaming (free tier; key never exposed to the client)
- **Abuse guard:** simple per-IP rate limit (8 req / minute)

## Setup

```bash
npm install
cp .env.example .env.local
# put GROQ_API_KEY in .env.local (from https://console.groq.com)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Live:** https://spark-mvp-orcin.vercel.app

## Deploy (Vercel)

1. Import this repo in Vercel (root = repo root).
2. Add env vars:
   - `GROQ_API_KEY`
   - `GROQ_MODEL` (optional, default `llama-3.3-70b-versatile`)
3. Deploy.

```bash
npx vercel --prod
```

## Product features

1. **Round-2 founder Q&A** — answer open questions → refined brief  
2. **Export** — copy brief + download Markdown  
3. **Example idea chips** — marketplace, booking, SaaS, local ops  
4. **Local history** — last briefs in `localStorage`  
5. **Stack preference** — Next.js / none / mobile-first  
6. **Shareable links** — short `/s/{id}` URLs (brief stored server-side)

## Share storage

Share links store the brief by short ID (not in the URL). Resolution order:

1. Vercel KV / Upstash (`KV_REST_API_URL` + `KV_REST_API_TOKEN`, or `UPSTASH_*`)
2. GitHub (`GITHUB_TOKEN` or `SHARE_GITHUB_TOKEN`) on branch `shares-data`
3. Local filesystem (`.data/shares/`) for `npm run dev`

```bash
npm run test:share
```

## Why this exists

Proof that I can ship **full-stack product UX + LLM APIs** — the same pattern used for AI features inside real SaaS MVPs (idea → product).
