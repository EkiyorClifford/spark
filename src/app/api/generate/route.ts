import {
  REFINE_SYSTEM_PROMPT,
  SYSTEM_PROMPT,
  buildRefinePrompt,
  buildUserPrompt,
  type StackPreference,
} from "@/lib/prompt";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

type Answer = { question?: string; answer?: string };

type Body = {
  idea?: string;
  stack?: StackPreference;
  mode?: "generate" | "refine";
  previousBrief?: string;
  answers?: Answer[];
};

function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

function normalizeStack(value: unknown): StackPreference {
  if (value === "nextjs" || value === "mobile" || value === "none") return value;
  return "none";
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const idea = typeof body.idea === "string" ? body.idea.trim() : "";
  if (idea.length < 8) {
    return Response.json(
      { error: "Please describe your idea in at least 8 characters." },
      { status: 400 },
    );
  }
  if (idea.length > 4000) {
    return Response.json(
      { error: "Idea is too long. Keep it under 4000 characters." },
      { status: 400 },
    );
  }

  const stack = normalizeStack(body.stack);
  const mode = body.mode === "refine" ? "refine" : "generate";

  let messages: Array<{ role: "system" | "user"; content: string }>;

  if (mode === "refine") {
    const previousBrief =
      typeof body.previousBrief === "string" ? body.previousBrief.trim() : "";
    if (previousBrief.length < 40) {
      return Response.json(
        { error: "Missing previous brief to refine." },
        { status: 400 },
      );
    }

    const answers = (Array.isArray(body.answers) ? body.answers : [])
      .map((a) => ({
        question: typeof a.question === "string" ? a.question.trim() : "",
        answer: typeof a.answer === "string" ? a.answer.trim() : "",
      }))
      .filter((a) => a.question && a.answer);

    if (!answers.length) {
      return Response.json(
        { error: "Answer at least one founder question to refine." },
        { status: 400 },
      );
    }

    messages = [
      { role: "system", content: REFINE_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildRefinePrompt({ idea, previousBrief, answers, stack }),
      },
    ];
  } else {
    messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(idea, stack) },
    ];
  }

  const limit = rateLimit(getClientKey(request));
  if (!limit.ok) {
    return Response.json(
      {
        error: "rate_limited",
        retryAfterSeconds: limit.retryAfterSec,
      },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSec) },
      },
    );
  }

  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error:
          "Server missing GROQ_API_KEY. Add it to .env.local (local) or Vercel env vars (deploy).",
      },
      { status: 500 },
    );
  }

  const model =
    process.env.GROQ_MODEL ||
    process.env.OPENAI_MODEL ||
    "llama-3.3-70b-versatile";
  const baseUrl =
    process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1";

  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: true,
      temperature: 0.6,
      messages,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return Response.json(
      {
        error: "Upstream AI request failed.",
        detail: detail.slice(0, 300),
      },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") {
              controller.close();
              return;
            }
            try {
              const parsed = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const token = parsed.choices?.[0]?.delta?.content;
              if (token) controller.enqueue(encoder.encode(token));
            } catch {
              // ignore partial JSON chunks
            }
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-RateLimit-Remaining": String(limit.remaining),
    },
  });
}
